-- LOCAL ONLY until explicitly released. No tables, catalog or combat rules changed.
-- CPU close = ABANDONO (opponent wins); no history or cards deleted.
-- Room hooks run inside its existing exception subtransaction: failures undo closure
-- while lookup/join throttling outside that block still persists.
SET LOCAL lock_timeout='5s';
DO $$ BEGIN EXECUTE format('GRANT ta_engine_owner TO %I',current_user); END $$;
GRANT CREATE ON SCHEMA truco_arena_der TO ta_engine_owner;

CREATE FUNCTION truco_arena_der.ta_cpu_abandon(p_key uuid,p_game bigint,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE who bigint:=ta_contexto();g partida%ROWTYPE; receipt solicitud_operacion%ROWTYPE;side integer;h text; now_at timestamptz; BEGIN
 IF p_key IS NULL OR p_game IS NULL OR p_version IS NULL OR p_version<1 THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_array(who,p_game,p_version,'abandon')::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO g FROM partida WHERE id_partida=p_game FOR UPDATE;
 SELECT pp.posicion INTO side FROM participante_partida pp JOIN mazo m USING(id_mazo) WHERE pp.id_partida=p_game AND m.id_jugador=who;
 IF side IS NULL THEN RAISE EXCEPTION 'PARTIDA_AJENA'; END IF;
 IF g.modalidad<>'PC' OR g.dificultad_pc IS NULL OR NOT EXISTS(SELECT FROM jugador WHERE id_jugador=who AND tipo_jugador='HUMANO') THEN RAISE EXCEPTION 'MODALIDAD_INVALIDA'; END IF;
 SELECT * INTO receipt FROM solicitud_operacion WHERE clave_reintento=p_key;
 IF FOUND THEN
  IF receipt.id_partida<>p_game OR receipt.tipo_operacion<>'ABANDONAR_PARTIDA' OR receipt.hash_parametros<>h THEN RAISE EXCEPTION 'CLAVE_REUTILIZADA'; END IF;
  RETURN jsonb_build_object('id',p_game::text,'versionResult',receipt.version_resultante,'replayed',true);
 END IF;
 IF g.fecha_fin IS NOT NULL THEN RAISE EXCEPTION 'PARTIDA_FINALIZADA'; END IF;
 IF g.version<>p_version THEN RAISE EXCEPTION 'ESTADO_DESACTUALIZADO'; END IF;
 now_at:=ta_online_now();
 UPDATE turno SET fecha_cierre=now_at AT TIME ZONE 'UTC',motivo_cierre='FIN_PARTIDA' WHERE id_partida=p_game AND fecha_cierre IS NULL;
 UPDATE partida SET fecha_fin=now_at AT TIME ZONE 'UTC',motivo_cierre='ABANDONO',ganador_posicion=3-side,version=version+1 WHERE id_partida=p_game;
 INSERT INTO solicitud_operacion VALUES(p_key,p_game,'ABANDONAR_PARTIDA',h,g.version+1,now_at AT TIME ZONE 'UTC');
 RETURN jsonb_build_object('id',p_game::text,'versionResult',g.version+1,'replayed',false);
END $$;

CREATE FUNCTION truco_arena_der.ta_abandon_game(p_key uuid,p_game bigint,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE mode text;who bigint:=ta_contexto(); BEGIN
 SELECT p.modalidad INTO mode FROM partida p JOIN participante_partida pp USING(id_partida) JOIN mazo m USING(id_mazo) WHERE p.id_partida=p_game AND m.id_jugador=who;
 IF mode IS NULL THEN RAISE EXCEPTION 'PARTIDA_AJENA'; END IF;
 IF mode='ONLINE' THEN RETURN ta_online_abandon(p_key,p_game,p_version); END IF;
 RETURN ta_cpu_abandon(p_key,p_game,p_version);
END $$;
CREATE FUNCTION truco_arena_der.ta_replace_cpu_for_room(p_game bigint,p_key uuid,p_operation text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE who bigint:=ta_contexto();g partida%ROWTYPE;close_key uuid; BEGIN
 IF p_game IS NULL THEN RETURN; END IF;
 IF p_key IS NULL OR p_operation NOT IN('create','join') THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
 -- The surrounding room operation has locked all relevant players in ID order.
 close_key:=md5('close-cpu-for-room:'||p_key::text||':'||p_operation||':'||p_game::text)::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(close_key::text,0));
 SELECT p.* INTO g FROM partida p JOIN participante_partida pp USING(id_partida) JOIN mazo m USING(id_mazo)
 WHERE p.id_partida=p_game AND m.id_jugador=who FOR UPDATE OF p;
 IF NOT FOUND THEN RAISE EXCEPTION 'PARTIDA_AJENA'; END IF;
 IF g.modalidad<>'PC' OR g.dificultad_pc IS NULL THEN RAISE EXCEPTION 'MODALIDAD_INVALIDA'; END IF;
 IF g.fecha_fin IS NULL THEN
  PERFORM ta_cpu_abandon(close_key,p_game,g.version);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION truco_arena_der.ta_rooms_interno(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE uid uuid:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
 who bigint; r sala%ROWTYPE; key uuid; deck bigint; code text; count_attempts integer; room_id bigint; result jsonb; receipt solicitud_operacion%ROWTYPE; expected_hash text;
BEGIN
 SELECT ja.id_jugador INTO who FROM jugador_auth ja JOIN jugador j USING(id_jugador) WHERE ja.auth_user_id=uid AND j.tipo_jugador='HUMANO' AND j.fecha_archivo IS NULL;
 IF who IS NULL THEN RAISE EXCEPTION 'PERFIL_REQUERIDO'; END IF;
 PERFORM set_config('ta.player_id',who::text,true);
 IF p_op IN('lookup','join') THEN
  -- Separate counters: recovery throttling remains unchanged. Return errors, rather than
  -- raising outside the subtransaction, so failed guesses persist their attempt counter.
  INSERT INTO intento_recuperacion(auth_user_id,ventana,intentos,sala_ventana,sala_intentos) VALUES(uid,clock_timestamp(),0,clock_timestamp(),1)
  ON CONFLICT(auth_user_id) DO UPDATE SET
   sala_intentos=CASE WHEN intento_recuperacion.sala_ventana<clock_timestamp()-interval '1 minute' THEN 1 ELSE intento_recuperacion.sala_intentos+1 END,
   sala_ventana=CASE WHEN intento_recuperacion.sala_ventana<clock_timestamp()-interval '1 minute' THEN clock_timestamp() ELSE intento_recuperacion.sala_ventana END
  RETURNING sala_intentos INTO count_attempts;
  IF count_attempts>10 THEN RETURN '{"error":"SALA_INTENTOS_LIMITADOS"}'::jsonb; END IF;
 END IF;
 BEGIN
  IF p_op='list' THEN
   UPDATE sala SET estado='EXPIRADA' WHERE id_anfitrion=who AND estado='ESPERANDO' AND fecha_expiracion<=clock_timestamp();
   RETURN jsonb_build_object('rooms',coalesce((SELECT jsonb_agg(ta_room_snapshot(id_sala) ORDER BY id_sala DESC) FROM sala WHERE who IN(id_anfitrion,id_invitado) AND estado IN('ESPERANDO','EN_CURSO')),'[]'::jsonb));
  ELSIF p_op='state' THEN RETURN ta_room_snapshot((p_data->>'id')::bigint);
  ELSIF p_op='cancel' THEN
   PERFORM 1 FROM jugador WHERE id_jugador=who FOR UPDATE;
   SELECT * INTO r FROM sala WHERE id_sala=(p_data->>'id')::bigint FOR UPDATE;
   IF NOT FOUND OR r.id_anfitrion<>who THEN RAISE EXCEPTION 'SALA_AJENA'; END IF;
   IF r.estado='ESPERANDO' THEN UPDATE sala SET estado=CASE WHEN fecha_expiracion<=clock_timestamp() THEN 'EXPIRADA' ELSE 'CANCELADA' END WHERE id_sala=r.id_sala;
   ELSIF r.estado NOT IN('CANCELADA','EXPIRADA') THEN RAISE EXCEPTION 'SALA_YA_INICIADA'; END IF;
   RETURN ta_room_snapshot(r.id_sala);
  ELSIF p_op='create' THEN
   key:=(p_data->>'requestId')::uuid; deck:=(p_data->>'deckId')::bigint;
   IF key IS NULL OR deck IS NULL THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(key::text,0));
   SELECT * INTO r FROM sala WHERE clave_creacion=key;
   IF FOUND THEN
    IF r.id_anfitrion<>who OR r.id_mazo_anfitrion<>deck THEN RAISE EXCEPTION 'CLAVE_REUTILIZADA'; END IF;
    RETURN ta_room_snapshot(r.id_sala)||'{"replayed":true}'::jsonb;
   END IF;
   PERFORM 1 FROM jugador WHERE id_jugador=who FOR UPDATE;
   UPDATE sala SET estado='EXPIRADA' WHERE id_anfitrion=who AND estado='ESPERANDO' AND fecha_expiracion<=clock_timestamp();
   IF EXISTS(SELECT FROM sala WHERE id_anfitrion=who AND estado='ESPERANDO') THEN RAISE EXCEPTION 'SALA_PENDIENTE'; END IF;
   PERFORM ta_replace_cpu_for_room((p_data->>'replaceCpuGameId')::bigint,key,'create');
   IF EXISTS(SELECT FROM participante_partida pp JOIN mazo m USING(id_mazo) JOIN partida p USING(id_partida) WHERE m.id_jugador=who AND p.fecha_fin IS NULL) THEN RAISE EXCEPTION 'PARTIDA_ACTIVA'; END IF;
   PERFORM 1 FROM mazo WHERE id_mazo=deck AND id_jugador=who AND fecha_archivo IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'MAZO_AJENO'; END IF;
   PERFORM ta_validar_mazo(deck,true);
   FOR count_attempts IN 1..5 LOOP
    INSERT INTO sala(codigo,id_anfitrion,id_mazo_anfitrion,fecha_expiracion,clave_creacion) VALUES(ta_room_code(),who,deck,clock_timestamp()+interval '15 minutes',key) ON CONFLICT(codigo) DO NOTHING RETURNING id_sala INTO room_id;
    IF room_id IS NOT NULL THEN RETURN ta_room_snapshot(room_id)||'{"replayed":false}'::jsonb; END IF;
   END LOOP;
   RAISE EXCEPTION 'CODIGO_NO_DISPONIBLE';
  ELSIF p_op IN('lookup','join') THEN
   code:=upper(regexp_replace(coalesce(p_data->>'code',''),'[[:space:]-]','','g'));
   IF code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN RAISE EXCEPTION 'SALA_CODIGO_INVALIDO'; END IF;
   code:=substr(code,1,4)||'-'||substr(code,5,4);
   IF p_op='join' THEN
    key:=(p_data->>'requestId')::uuid;deck:=(p_data->>'deckId')::bigint;
    IF key IS NULL OR deck IS NULL THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(key::text,0));
    SELECT * INTO receipt FROM solicitud_operacion WHERE clave_reintento=key;
    IF FOUND THEN
     SELECT * INTO r FROM sala WHERE id_partida=receipt.id_partida;
     expected_hash:=encode(sha256(convert_to((jsonb_build_array(r.id_anfitrion,r.id_mazo_anfitrion,who,deck,false)||'"ONLINE"'::jsonb)::text,'UTF8')),'hex');
     IF r.id_invitado IS DISTINCT FROM who OR r.codigo IS DISTINCT FROM code OR r.id_mazo_invitado IS DISTINCT FROM deck OR receipt.tipo_operacion<>'CREAR_PARTIDA' OR receipt.hash_parametros<>expected_hash THEN RAISE EXCEPTION 'CLAVE_REUTILIZADA'; END IF;
     RETURN ta_room_snapshot(r.id_sala)||'{"replayed":true}'::jsonb;
    END IF;
   END IF;
   SELECT * INTO r FROM sala WHERE codigo=code;
   IF NOT FOUND THEN RAISE EXCEPTION 'SALA_NO_DISPONIBLE'; END IF;
   IF r.id_anfitrion=who THEN RAISE EXCEPTION 'SALA_PROPIA'; END IF;
   IF p_op='lookup' THEN
    IF r.estado<>'ESPERANDO' OR r.fecha_expiracion<=clock_timestamp() THEN RAISE EXCEPTION 'SALA_NO_DISPONIBLE'; END IF;
    RETURN jsonb_build_object('code',r.codigo,'hostAlias',(SELECT alias FROM jugador WHERE id_jugador=r.id_anfitrion),'deckSize',ta_validar_mazo(r.id_mazo_anfitrion,true),'expiresAt',r.fecha_expiracion);
   END IF;
   -- All room lifecycle mutations lock players in ID order, then room, then decks.
   PERFORM 1 FROM jugador WHERE id_jugador IN(who,r.id_anfitrion) ORDER BY id_jugador FOR UPDATE;
   SELECT * INTO r FROM sala WHERE codigo=code FOR UPDATE;
   IF r.estado<>'ESPERANDO' OR r.fecha_expiracion<=clock_timestamp() THEN RAISE EXCEPTION 'SALA_NO_DISPONIBLE'; END IF;
   IF EXISTS(SELECT FROM sala WHERE id_anfitrion=who AND estado='ESPERANDO' AND fecha_expiracion>clock_timestamp()) THEN RAISE EXCEPTION 'SALA_PENDIENTE'; END IF;
   PERFORM 1 FROM mazo WHERE id_mazo IN(deck,r.id_mazo_anfitrion) ORDER BY id_mazo FOR UPDATE;
   IF NOT EXISTS(SELECT FROM mazo WHERE id_mazo=deck AND id_jugador=who AND fecha_archivo IS NULL) THEN RAISE EXCEPTION 'MAZO_AJENO'; END IF;
   IF ta_validar_mazo(deck,true)<>ta_validar_mazo(r.id_mazo_anfitrion,true) THEN RAISE EXCEPTION 'SALA_FORMATO_INCOMPATIBLE'; END IF;
   PERFORM ta_replace_cpu_for_room((p_data->>'replaceCpuGameId')::bigint,key,'join');
   PERFORM set_config('ta.player_id',r.id_anfitrion::text,true);
   result:=ta_iniciar_base(key,r.id_mazo_anfitrion,who,deck,false,true);
   UPDATE sala SET id_invitado=who,id_mazo_invitado=deck,id_partida=(result->>'id')::bigint,fecha_union=clock_timestamp(),estado='EN_CURSO' WHERE id_sala=r.id_sala;
   PERFORM set_config('ta.player_id',who::text,true);
   RETURN ta_room_snapshot(r.id_sala)||'{"replayed":false}'::jsonb;
  END IF;
  RAISE EXCEPTION 'OPERACION_NO_DISPONIBLE';
 EXCEPTION WHEN raise_exception THEN
  PERFORM set_config('ta.player_id',who::text,true);
  IF SQLERRM ~ '^[A-Z_]+$' THEN RETURN jsonb_build_object('error',SQLERRM); ELSE RAISE; END IF;
 END;
END $$;

CREATE OR REPLACE FUNCTION truco_arena_der.ta_web_timed(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE result jsonb;me jsonb;receipt jsonb; BEGIN
 IF p_op='abandon' THEN
  me:=ta_web_online('me','{}'::jsonb);
  IF me->'profile' IS NULL OR me->'profile'='null'::jsonb THEN RAISE EXCEPTION 'PERFIL_REQUERIDO'; END IF;
  PERFORM set_config('ta.player_id',me->'profile'->>'id',true);
  receipt:=ta_abandon_game((p_data->>'requestId')::uuid,(p_data->>'id')::bigint,(p_data->>'expectedVersion')::bigint);
  RETURN ta_estado_privado((p_data->>'id')::bigint)||ta_cpu_metadata((p_data->>'id')::bigint)||ta_room_game_meta((p_data->>'id')::bigint)||ta_online_meta((p_data->>'id')::bigint)||jsonb_build_object('operation',receipt);
 END IF;
 result:=ta_web_online(p_op,p_data);
 IF p_op IN('state','act') THEN result:=result||ta_online_meta((p_data->>'id')::bigint); END IF;
 RETURN result;
END $$;

DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='truco_arena_der' AND p.proname IN('ta_cpu_abandon','ta_abandon_game','ta_replace_cpu_for_room') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO ta_engine_owner',f);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,ta_engine_server,ta_cpu_worker,ta_timer_runner',f);
 END LOOP;
END $$;
-- Existing authenticated gateways are retained; helpers are not exposed.
REVOKE CREATE ON SCHEMA truco_arena_der FROM ta_engine_owner;
DO $$ BEGIN EXECUTE format('REVOKE ta_engine_owner FROM %I',current_user); END $$;
