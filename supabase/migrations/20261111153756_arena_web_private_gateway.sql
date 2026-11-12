-- Only the unprivileged wrapper is exposed. All privileged code remains private.
DO $$ BEGIN EXECUTE format('GRANT ta_engine_owner TO %I',current_user); END $$;
GRANT CREATE ON SCHEMA truco_arena_der TO ta_engine_owner;
CREATE FUNCTION truco_arena_der.ta_web_interno(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE uid uuid:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid; who bigint; code text; hash text; n integer; v bigint; result jsonb; me jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'SESION_REQUERIDA'; END IF;
 -- Stable lock for registration/recovery by the same Auth identity.
 IF p_op IN('register','recover','rotate') THEN PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,123)); END IF;
 SELECT id_jugador INTO who FROM jugador_auth WHERE auth_user_id=uid;
 IF p_op='register' THEN
  IF who IS NOT NULL THEN RAISE EXCEPTION 'PERFIL_EXISTENTE'; END IF;
  IF p_data->>'alias' IS NULL OR char_length(p_data->>'alias')>40 THEN RAISE EXCEPTION 'ALIAS_INVALIDO'; END IF;
  who:=ta_crear_jugador(p_data->>'alias');
  code:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  UPDATE jugador SET codigo_recuperacion_hash=encode(sha256(convert_to(code,'UTF8')),'hex') WHERE id_jugador=who;
  INSERT INTO jugador_auth(auth_user_id,id_jugador) VALUES(uid,who);
 ELSIF p_op='recover' THEN
  IF who IS NOT NULL THEN RAISE EXCEPTION 'PERFIL_EXISTENTE'; END IF;
  INSERT INTO intento_recuperacion(auth_user_id,ventana,intentos) VALUES(uid,clock_timestamp(),1)
   ON CONFLICT(auth_user_id) DO UPDATE SET
    intentos=CASE WHEN intento_recuperacion.ventana<clock_timestamp()-interval '15 minutes' THEN 1 ELSE intento_recuperacion.intentos+1 END,
    ventana=CASE WHEN intento_recuperacion.ventana<clock_timestamp()-interval '15 minutes' THEN clock_timestamp() ELSE intento_recuperacion.ventana END
   RETURNING intentos INTO n;
  IF n>5 THEN RETURN jsonb_build_object('error','RECUPERACION_LIMITADA'); END IF;
  code:=p_data->>'code';
  IF code IS NULL OR code !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('error','CODIGO_INVALIDO'); END IF;
  hash:=encode(sha256(convert_to(code,'UTF8')),'hex');
  SELECT id_jugador INTO who FROM jugador WHERE codigo_recuperacion_hash=hash AND fecha_archivo IS NULL AND tipo_jugador='HUMANO' FOR UPDATE;
  IF who IS NULL THEN RETURN jsonb_build_object('error','CODIGO_INVALIDO'); END IF;
  -- Explicit recheck after row lock: two browser recoveries cannot consume the same secret.
  IF NOT EXISTS(SELECT FROM jugador WHERE id_jugador=who AND codigo_recuperacion_hash=hash) THEN RETURN jsonb_build_object('error','CODIGO_INVALIDO'); END IF;
  code:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  UPDATE jugador SET codigo_recuperacion_hash=encode(sha256(convert_to(code,'UTF8')),'hex') WHERE id_jugador=who;
  INSERT INTO jugador_auth(auth_user_id,id_jugador) VALUES(uid,who);
 ELSIF p_op='rotate' THEN
  IF who IS NULL THEN RAISE EXCEPTION 'PERFIL_REQUERIDO'; END IF;
  PERFORM 1 FROM jugador WHERE id_jugador=who FOR UPDATE;
  code:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  UPDATE jugador SET codigo_recuperacion_hash=encode(sha256(convert_to(code,'UTF8')),'hex') WHERE id_jugador=who;
 END IF;
 IF p_op IN('me','register','recover','rotate') THEN
  SELECT jsonb_build_object('id',id_jugador::text,'alias',alias) INTO me FROM jugador WHERE id_jugador=who AND fecha_archivo IS NULL;
  RETURN jsonb_build_object('profile',me)||CASE WHEN p_op='me' THEN '{}'::jsonb ELSE jsonb_build_object('recoveryCode',code) END;
 END IF;
 IF p_op='catalog' THEN
  SELECT jsonb_agg(jsonb_build_object('id',id_carta,'name',nombre,'suit',palo,'number',numero,'attack',ataque_base,'health',vida_base,'cost',costo_energia,'hierarchy',jerarquia_truco) ORDER BY id_carta) INTO result FROM carta;
  RETURN jsonb_build_object('cards',result,'mode','persistent','source','Supabase TrucoOnline');
 END IF;
 IF who IS NULL THEN RAISE EXCEPTION 'PERFIL_REQUERIDO'; END IF;
 PERFORM set_config('ta.player_id',who::text,true);
 IF p_op='collection' THEN
  SELECT jsonb_agg(jsonb_build_object('id',c.id_carta,'name',nombre,'suit',palo,'number',numero,'attack',ataque_base,'health',vida_base,'cost',costo_energia,'hierarchy',jerarquia_truco,'quantity',cantidad) ORDER BY c.id_carta) INTO result FROM coleccion_jugador cj JOIN carta c USING(id_carta) WHERE id_jugador=who;
  RETURN jsonb_build_object('cards',coalesce(result,'[]'::jsonb),'mode','persistent');
 ELSIF p_op='decks' THEN
  SELECT jsonb_agg(jsonb_build_object('id',m.id_mazo::text,'ownerId',who::text,'name',m.nombre,'description',m.descripcion,'used',EXISTS(SELECT FROM participante_partida WHERE id_mazo=m.id_mazo),
   'entries',coalesce((SELECT jsonb_agg(jsonb_build_object('cardId',id_carta,'quantity',cantidad) ORDER BY id_carta) FROM mazo_carta WHERE id_mazo=m.id_mazo),'[]'::jsonb)) ORDER BY m.id_mazo)
   INTO result FROM mazo m WHERE id_jugador=who AND fecha_archivo IS NULL;
  RETURN jsonb_build_object('decks',coalesce(result,'[]'::jsonb),'mode','persistent');
 ELSIF p_op='saveDeck' THEN
  v:=ta_guardar_mazo((p_data->>'id')::bigint,p_data->>'name',p_data->'entries',coalesce(p_data->>'description',''));
  RETURN jsonb_build_object('id',v::text);
 ELSIF p_op='deleteDeck' THEN
  PERFORM ta_eliminar_mazo((p_data->>'id')::bigint);RETURN '{"deleted":true}'::jsonb;
 ELSIF p_op='history' THEN
  SELECT jsonb_agg(jsonb_build_object('id',p.id_partida::text,'turn',(SELECT max(numero_global) FROM turno WHERE id_partida=p.id_partida),'version',p.version,'startedAt',p.fecha_inicio AT TIME ZONE 'UTC','status',CASE WHEN p.fecha_fin IS NULL THEN 'active' ELSE 'finished' END,'reason',p.motivo_cierre,'winnerPosition',p.ganador_posicion) ORDER BY p.id_partida DESC)
   INTO result FROM partida p WHERE EXISTS(SELECT FROM participante_partida pp JOIN mazo m USING(id_mazo) WHERE pp.id_partida=p.id_partida AND m.id_jugador=who);
  RETURN jsonb_build_object('duels',coalesce(result,'[]'::jsonb),'mode','persistent');
 ELSIF p_op='state' THEN RETURN ta_estado_privado((p_data->>'id')::bigint);
 ELSIF p_op='act' THEN
  result:=ta_actuar((p_data->>'requestId')::uuid,(p_data->>'id')::bigint,(p_data->>'expectedVersion')::bigint,p_data->'action');
  RETURN ta_estado_privado((p_data->>'id')::bigint)||jsonb_build_object('operation',result);
 END IF;
 RAISE EXCEPTION 'OPERACION_NO_DISPONIBLE';
END $$;

ALTER FUNCTION truco_arena_der.ta_web_interno(text,jsonb) OWNER TO ta_engine_owner;
REVOKE ALL ON FUNCTION truco_arena_der.ta_web_interno(text,jsonb) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA truco_arena_der TO authenticated;
GRANT EXECUTE ON FUNCTION truco_arena_der.ta_web_interno(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.ta_web(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT truco_arena_der.ta_web_interno(p_op,p_data) $$;
REVOKE ALL ON FUNCTION public.ta_web(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ta_web(text,jsonb) TO authenticated;
REVOKE CREATE ON SCHEMA truco_arena_der FROM ta_engine_owner;
DO $$ BEGIN EXECUTE format('REVOKE ta_engine_owner FROM %I',current_user); END $$;
