-- No tables/statistics/rules changed. CPU has no Supabase Auth identity.
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ta_cpu_worker') THEN CREATE ROLE ta_cpu_worker NOLOGIN NOBYPASSRLS; END IF;
 EXECUTE format('GRANT ta_engine_owner TO %I',current_user);
END $$;
GRANT CREATE ON SCHEMA truco_arena_der TO ta_engine_owner;
GRANT USAGE ON SCHEMA truco_arena_der TO ta_cpu_worker;

CREATE FUNCTION truco_arena_der.ta_cpu_metadata(p_game bigint) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
 SELECT coalesce((SELECT jsonb_build_object('cpuPlayerId',j.id_jugador::text,'cpuDifficulty',lower(p.dificultad_pc),'finishedAt',p.fecha_fin AT TIME ZONE 'UTC')
 FROM partida p JOIN participante_partida pp USING(id_partida) JOIN mazo m USING(id_mazo) JOIN jugador j ON j.id_jugador=m.id_jugador
 WHERE p.id_partida=p_game AND p.modalidad='PC' AND j.tipo_jugador='CPU'),'{}'::jsonb)
$$;
CREATE FUNCTION truco_arena_der.ta_web_cpu(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE result jsonb; BEGIN
 result:=ta_web_interno(p_op,p_data); -- Existing gate derives identity and authorizes every access.
 IF p_op IN('state','act') THEN result:=result||ta_cpu_metadata((p_data->>'id')::bigint); END IF;
 IF p_op='history' THEN
  result:=jsonb_set(result,'{duels}',coalesce((SELECT jsonb_agg(e||ta_cpu_metadata((e->>'id')::bigint)||jsonb_build_object('ownPosition',(SELECT pp.posicion FROM participante_partida pp JOIN mazo m USING(id_mazo) WHERE pp.id_partida=(e->>'id')::bigint AND m.id_jugador=ta_contexto()))) FROM jsonb_array_elements(result->'duels') e),'[]'::jsonb));
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION truco_arena_der.ta_cpu_start(p_key uuid,p_deck bigint,p_difficulty text,p_restart boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE uid uuid:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
 human bigint; cpu bigint; deck bigint; n integer; entries jsonb; receipt solicitud_operacion%ROWTYPE; result jsonb; h text;
BEGIN
 SELECT ja.id_jugador INTO human FROM jugador_auth ja JOIN jugador j USING(id_jugador) WHERE ja.auth_user_id=uid AND j.tipo_jugador='HUMANO' AND j.fecha_archivo IS NULL;
 IF human IS NULL THEN RAISE EXCEPTION 'PERFIL_REQUERIDO'; END IF;
 IF p_key IS NULL OR p_difficulty IS NULL OR p_difficulty NOT IN('FACIL','NORMAL','DIFICIL') OR p_restart IS NULL THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO receipt FROM solicitud_operacion WHERE clave_reintento=p_key;
 IF FOUND THEN
  SELECT j.id_jugador,m.id_mazo INTO cpu,deck FROM participante_partida pp JOIN mazo m USING(id_mazo) JOIN jugador j ON j.id_jugador=m.id_jugador WHERE pp.id_partida=receipt.id_partida AND j.tipo_jugador='CPU';
  h:=encode(sha256(convert_to(jsonb_build_array(human,p_deck,cpu,deck,p_restart)::text,'UTF8')),'hex');
  IF receipt.tipo_operacion<>'CREAR_PARTIDA' OR receipt.hash_parametros<>h OR cpu IS NULL OR NOT EXISTS(
   SELECT FROM partida p JOIN participante_partida pp USING(id_partida) JOIN mazo m USING(id_mazo)
   WHERE p.id_partida=receipt.id_partida AND m.id_jugador=human AND m.id_mazo=p_deck AND p.dificultad_pc=p_difficulty
  ) THEN RAISE EXCEPTION 'CLAVE_REUTILIZADA'; END IF;
  PERFORM set_config('ta.player_id',human::text,true);
  RETURN ta_estado_privado(receipt.id_partida)||ta_cpu_metadata(receipt.id_partida)||jsonb_build_object('operation',jsonb_build_object('requestId',p_key,'versionResult',receipt.version_resultante,'replayed',true));
 END IF;
 PERFORM 1 FROM jugador WHERE id_jugador=human FOR UPDATE;
 PERFORM 1 FROM mazo WHERE id_mazo=p_deck AND id_jugador=human AND fecha_archivo IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MAZO_AJENO'; END IF;
 n:=ta_validar_mazo(p_deck,true);
 IF EXISTS(SELECT FROM participante_partida pp JOIN mazo m USING(id_mazo) JOIN partida p USING(id_partida) WHERE m.id_jugador=human AND p.fecha_fin IS NULL) THEN
  IF NOT p_restart THEN RAISE EXCEPTION 'PARTIDA_ACTIVA'; END IF;
  IF EXISTS(SELECT FROM partida p JOIN participante_partida pp USING(id_partida) JOIN mazo m USING(id_mazo)
   WHERE p.fecha_fin IS NULL AND m.id_jugador=human AND NOT EXISTS(SELECT FROM participante_partida e JOIN mazo em USING(id_mazo) JOIN jugador ej ON ej.id_jugador=em.id_jugador WHERE e.id_partida=p.id_partida AND ej.tipo_jugador='CPU')) THEN RAISE EXCEPTION 'REINICIO_NO_CPU'; END IF;
 END IF;
 cpu:=ta_crear_jugador('CPU-'||replace(gen_random_uuid()::text,'-',''));
 UPDATE jugador SET tipo_jugador='CPU' WHERE id_jugador=cpu;
 SELECT jsonb_agg(jsonb_build_object('cardId',id_carta,'quantity',qty)) INTO entries FROM (
  SELECT id_carta,count(*) qty FROM (SELECT c.id_carta FROM carta c CROSS JOIN generate_series(1,2) ORDER BY random() LIMIT n) s GROUP BY id_carta
 ) composition;
 PERFORM set_config('ta.player_id',cpu::text,true);
 deck:=ta_guardar_mazo(NULL,'Mazo CPU',entries,'Mazo independiente de la computadora');
 PERFORM set_config('ta.player_id',human::text,true);
 result:=ta_iniciar_partida(p_key,p_deck,cpu,deck,p_restart);
 UPDATE partida SET dificultad_pc=p_difficulty WHERE id_partida=(result->>'id')::bigint;
 RETURN ta_estado_privado((result->>'id')::bigint)||ta_cpu_metadata((result->>'id')::bigint)||jsonb_build_object('operation',result||jsonb_build_object('requestId',p_key));
END $$;

CREATE FUNCTION truco_arena_der.ta_cpu_jobs() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
 SELECT coalesce(jsonb_agg(p.id_partida::text ORDER BY p.id_partida),'[]'::jsonb)
 FROM partida p JOIN turno t ON t.id_partida=p.id_partida AND t.fecha_cierre IS NULL
 JOIN participante_partida pp ON pp.id_partida=p.id_partida AND pp.posicion=CASE WHEN t.numero_global%2=1 THEN 1 ELSE 2 END
 JOIN mazo m USING(id_mazo) JOIN jugador j ON j.id_jugador=m.id_jugador
 WHERE p.fecha_fin IS NULL AND p.modalidad='PC' AND j.tipo_jugador='CPU'
$$;
CREATE FUNCTION truco_arena_der.ta_cpu_state(p_game bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE cpu bigint; BEGIN
 SELECT j.id_jugador INTO cpu FROM partida p JOIN turno t ON t.id_partida=p.id_partida AND t.fecha_cierre IS NULL
 JOIN participante_partida pp ON pp.id_partida=p.id_partida AND pp.posicion=CASE WHEN t.numero_global%2=1 THEN 1 ELSE 2 END
 JOIN mazo m USING(id_mazo) JOIN jugador j ON j.id_jugador=m.id_jugador
 WHERE p.id_partida=p_game AND p.fecha_fin IS NULL AND p.modalidad='PC' AND j.tipo_jugador='CPU';
 IF cpu IS NULL THEN RETURN NULL; END IF;
 PERFORM set_config('ta.player_id',cpu::text,true);
 RETURN ta_estado_privado(p_game)||ta_cpu_metadata(p_game);
END $$;
CREATE FUNCTION truco_arena_der.ta_cpu_step(p_game bigint,p_version bigint,p_action jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE state jsonb; key uuid; BEGIN
 state:=ta_cpu_state(p_game);
 IF state IS NULL OR (state->>'version')::bigint<>p_version THEN RETURN NULL; END IF;
 key:=md5('truco-cpu-v1:'||p_game::text||':'||p_version::text)::uuid;
 -- State above sets context ONLY to this game's active CPU, never a supplied actor.
 RETURN ta_actuar(key,p_game,p_version,p_action);
END $$;
CREATE FUNCTION truco_arena_der.ta_cpu_catalog() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
 SELECT jsonb_agg(jsonb_build_object('id',id_carta,'name',nombre,'suit',palo,'number',numero,'attack',ataque_base,'health',vida_base,'cost',costo_energia,'hierarchy',jerarquia_truco) ORDER BY id_carta) FROM carta
$$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='truco_arena_der' AND (p.proname LIKE 'ta_cpu_%' OR p.proname='ta_web_cpu') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO ta_engine_owner',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION truco_arena_der.ta_cpu_jobs(),truco_arena_der.ta_cpu_state(bigint),truco_arena_der.ta_cpu_step(bigint,bigint,jsonb),truco_arena_der.ta_cpu_catalog() TO ta_cpu_worker;
GRANT EXECUTE ON FUNCTION truco_arena_der.ta_cpu_start(uuid,bigint,text,boolean),truco_arena_der.ta_web_cpu(text,jsonb) TO authenticated;
CREATE FUNCTION public.ta_start_cpu(p_key uuid,p_deck bigint,p_difficulty text,p_restart boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT truco_arena_der.ta_cpu_start(p_key,p_deck,p_difficulty,p_restart) $$;
REVOKE ALL ON FUNCTION public.ta_start_cpu(uuid,bigint,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ta_start_cpu(uuid,bigint,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.ta_web(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT truco_arena_der.ta_web_cpu(p_op,p_data) $$;
REVOKE CREATE ON SCHEMA truco_arena_der FROM ta_engine_owner;
DO $$ BEGIN EXECUTE format('REVOKE ta_engine_owner FROM %I',current_user); END $$;
