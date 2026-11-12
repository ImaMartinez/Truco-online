-- Phase 6: server deadlines; no new game tables/columns/catalog changes.
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ta_timer_runner') THEN CREATE ROLE ta_timer_runner NOLOGIN NOBYPASSRLS; END IF;
 EXECUTE format('GRANT ta_engine_owner TO %I',current_user);
 EXECUTE format('GRANT ta_timer_runner TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $$;
GRANT CREATE ON SCHEMA truco_arena_der TO ta_engine_owner;
GRANT USAGE ON SCHEMA truco_arena_der TO ta_timer_runner;
CREATE FUNCTION truco_arena_der.ta_online_now() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT clock_timestamp() $$;
ALTER TABLE truco_arena_der.turno ALTER COLUMN fecha_apertura SET DEFAULT (truco_arena_der.ta_online_now() AT TIME ZONE 'UTC');
CREATE INDEX ta_turnos_por_vencer ON truco_arena_der.turno(fecha_apertura,id_partida) WHERE fecha_cierre IS NULL;
CREATE OR REPLACE FUNCTION truco_arena_der.ta_actuar(p_clave uuid,p_partida bigint,p_version bigint,p_accion jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE who bigint:=ta_contexto(); h text; receipt solicitud_operacion%ROWTYPE; g partida%ROWTYPE; t turno%ROWTYPE;
 actor participante_partida%ROWTYPE; enemy participante_partida%ROWTYPE; src copia_carta_partida%ROWTYPE; dst copia_carta_partida%ROWTYPE;
 card carta%ROWTYPE; target carta%ROWTYPE; kind text:=p_accion->>'type'; op text; a bigint; b bigint; ev bigint; ord integer;
 hp_a integer; hp_b integer; attack_turn integer; l1 integer; l2 integer;
BEGIN
 IF p_clave IS NULL OR p_partida IS NULL OR p_version IS NULL OR p_version<1 OR kind IS NULL OR kind NOT IN('play','attack','endTurn') THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_array(who,p_partida,p_version,p_accion)::text,'UTF8')),'hex');
 op:=CASE kind WHEN 'play' THEN 'INVOCAR' WHEN 'attack' THEN 'ATACAR' ELSE 'FINALIZAR_TURNO' END;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 SELECT * INTO g FROM partida WHERE id_partida=p_partida FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PARTIDA_NO_ENCONTRADA'; END IF;
 IF NOT EXISTS(SELECT FROM participante_partida pp JOIN mazo m USING(id_mazo) WHERE pp.id_partida=p_partida AND m.id_jugador=who) THEN RAISE EXCEPTION 'PARTIDA_AJENA'; END IF;
 SELECT * INTO receipt FROM solicitud_operacion WHERE clave_reintento=p_clave;
 IF FOUND THEN
  IF receipt.id_partida<>p_partida OR receipt.hash_parametros<>h OR receipt.tipo_operacion<>op THEN RAISE EXCEPTION 'CLAVE_REUTILIZADA'; END IF;
  RETURN jsonb_build_object('id',p_partida::text,'versionResult',receipt.version_resultante,'replayed',true);
 END IF;
 IF g.fecha_fin IS NOT NULL THEN RAISE EXCEPTION 'PARTIDA_FINALIZADA'; END IF;
 IF g.version<>p_version THEN RAISE EXCEPTION 'ESTADO_DESACTUALIZADO'; END IF;
 SELECT * INTO STRICT t FROM turno WHERE id_partida=p_partida AND fecha_cierre IS NULL;
 SELECT * INTO STRICT actor FROM participante_partida WHERE id_partida=p_partida AND posicion=CASE WHEN t.numero_global%2=1 THEN 1 ELSE 2 END;
 SELECT * INTO STRICT enemy FROM participante_partida WHERE id_partida=p_partida AND posicion=3-actor.posicion;
 IF NOT EXISTS(SELECT FROM mazo WHERE id_mazo=actor.id_mazo AND id_jugador=who) THEN RAISE EXCEPTION 'TURNO_AJENO'; END IF;
 IF g.modalidad='ONLINE' AND ta_online_now() >= (t.fecha_apertura AT TIME ZONE 'UTC')+interval '15 seconds' THEN RAISE EXCEPTION 'TURNO_VENCIDO'; END IF;
 IF kind='play' THEN
  a:=(p_accion->>'instanceId')::bigint;
  SELECT * INTO src FROM copia_carta_partida WHERE id_copia=a;
  IF NOT FOUND OR src.id_participante<>actor.id_participante THEN RAISE EXCEPTION 'COPIA_AJENA'; END IF;
  IF src.zona<>'MANO' THEN RAISE EXCEPTION 'COPIA_NO_EN_MANO'; END IF;
  SELECT * INTO STRICT card FROM carta WHERE id_carta=src.id_carta;
  IF t.energia_disponible<card.costo_energia THEN RAISE EXCEPTION 'ENERGIA_INSUFICIENTE'; END IF;
  IF (SELECT count(*) FROM copia_carta_partida WHERE id_participante=actor.id_participante AND zona='CAMPO')>=3 THEN RAISE EXCEPTION 'CAMPO_LLENO'; END IF;
  UPDATE turno SET energia_disponible=energia_disponible-card.costo_energia WHERE id_turno=t.id_turno;
  UPDATE copia_carta_partida SET zona='CAMPO',vida_actual=card.vida_base WHERE id_copia=a;
 ELSIF kind='attack' THEN
  a:=(p_accion->>'attackerId')::bigint;
  SELECT * INTO src FROM copia_carta_partida WHERE id_copia=a;
  IF NOT FOUND OR src.id_participante<>actor.id_participante THEN RAISE EXCEPTION 'COPIA_AJENA'; END IF;
  IF src.zona<>'CAMPO' THEN RAISE EXCEPTION 'ATACANTE_INVALIDO'; END IF;
  SELECT tt.numero_global INTO attack_turn FROM invocacion i JOIN jugada j USING(id_jugada) JOIN turno tt USING(id_turno) WHERE i.id_copia=a;
  IF attack_turn IS NULL OR attack_turn>=t.numero_global THEN RAISE EXCEPTION 'CARTA_NUEVA'; END IF;
  IF EXISTS(SELECT FROM ataque aa JOIN jugada j USING(id_jugada) WHERE aa.id_copia_atacante=a AND j.id_turno=t.id_turno) THEN RAISE EXCEPTION 'CARTA_AGOTADA'; END IF;
  SELECT * INTO STRICT card FROM carta WHERE id_carta=src.id_carta;
  IF p_accion->>'targetId'='hero' THEN
   IF EXISTS(SELECT FROM copia_carta_partida WHERE id_participante=enemy.id_participante AND zona='CAMPO') THEN RAISE EXCEPTION 'HEROE_PROTEGIDO'; END IF;
   hp_b:=enemy.vida_heroe;
   UPDATE participante_partida SET vida_heroe=greatest(0,vida_heroe-card.ataque_base) WHERE id_participante=enemy.id_participante;
   IF hp_b<=card.ataque_base THEN
    UPDATE turno SET fecha_cierre=ta_online_now() AT TIME ZONE 'UTC',motivo_cierre='FIN_PARTIDA' WHERE id_turno=t.id_turno;
    UPDATE partida SET fecha_fin=ta_online_now() AT TIME ZONE 'UTC',motivo_cierre='VIDA_CERO',ganador_posicion=actor.posicion WHERE id_partida=p_partida;
   END IF;
  ELSE
   IF p_accion->>'targetId' IS NULL THEN RAISE EXCEPTION 'OBJETIVO_INVALIDO'; END IF;
   b:=(p_accion->>'targetId')::bigint;
   SELECT * INTO dst FROM copia_carta_partida WHERE id_copia=b;
   IF NOT FOUND OR dst.id_participante<>enemy.id_participante OR dst.zona<>'CAMPO' THEN RAISE EXCEPTION 'OBJETIVO_INVALIDO'; END IF;
   SELECT * INTO STRICT target FROM carta WHERE id_carta=dst.id_carta;
   hp_a:=greatest(0,src.vida_actual-target.ataque_base); hp_b:=greatest(0,dst.vida_actual-card.ataque_base);
   UPDATE copia_carta_partida SET vida_actual=hp_a,zona=CASE WHEN hp_a=0 THEN 'DESCARTE' ELSE 'CAMPO' END WHERE id_copia=a;
   UPDATE copia_carta_partida SET vida_actual=hp_b,zona=CASE WHEN hp_b=0 THEN 'DESCARTE' ELSE 'CAMPO' END WHERE id_copia=b;
  END IF;
 ELSE
  UPDATE turno SET fecha_cierre=ta_online_now() AT TIME ZONE 'UTC',motivo_cierre='MANUAL' WHERE id_turno=t.id_turno;
  IF t.numero_global=30 THEN
   SELECT vida_heroe INTO l1 FROM participante_partida WHERE id_partida=p_partida AND posicion=1;
   SELECT vida_heroe INTO l2 FROM participante_partida WHERE id_partida=p_partida AND posicion=2;
   UPDATE partida SET fecha_fin=ta_online_now() AT TIME ZONE 'UTC',motivo_cierre='LIMITE_TURNOS',ganador_posicion=CASE WHEN l1=l2 THEN NULL WHEN l1>l2 THEN 1 ELSE 2 END WHERE id_partida=p_partida;
  ELSE
   INSERT INTO turno(id_partida,numero_global,energia_disponible) VALUES(p_partida,t.numero_global+1,least(5,(t.numero_global+2)/2));
   IF t.numero_global+1>2 THEN
    UPDATE copia_carta_partida SET zona='MANO' WHERE id_copia=(SELECT id_copia FROM copia_carta_partida WHERE id_participante=enemy.id_participante AND zona='MAZO' ORDER BY posicion_original LIMIT 1);
   END IF;
  END IF;
 END IF;
 UPDATE partida SET version=version+1 WHERE id_partida=p_partida;
 INSERT INTO solicitud_operacion VALUES(p_clave,p_partida,op,h,g.version+1,ta_online_now() AT TIME ZONE 'UTC');
 IF kind IN('play','attack') THEN
  SELECT coalesce(max(orden_en_turno),0)+1 INTO ord FROM jugada WHERE id_turno=t.id_turno;
  INSERT INTO jugada(id_turno,orden_en_turno,clave_reintento) VALUES(t.id_turno,ord,p_clave) RETURNING id_jugada INTO ev;
  IF kind='play' THEN INSERT INTO invocacion VALUES(ev,a);
  ELSE INSERT INTO ataque VALUES(ev,a,b,CASE WHEN b IS NULL THEN enemy.id_participante ELSE NULL END,src.vida_actual,CASE WHEN b IS NULL THEN enemy.vida_heroe ELSE dst.vida_actual END); END IF;
 END IF;
 RETURN jsonb_build_object('id',p_partida::text,'versionResult',g.version+1,'replayed',false);
END $$;

-- Own turns only. An open turn with no action is not yet a miss; an action resets immediately.
CREATE FUNCTION truco_arena_der.ta_online_streak(p_game bigint,p_side integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE t record; n integer:=0; BEGIN
 FOR t IN SELECT tt.*,EXISTS(SELECT FROM jugada j WHERE j.id_turno=tt.id_turno) acted FROM turno tt WHERE tt.id_partida=p_game AND tt.numero_global%2=p_side%2 ORDER BY tt.numero_global DESC LOOP
  IF t.acted THEN EXIT; END IF;
  IF t.fecha_cierre IS NULL THEN CONTINUE; END IF;
  IF t.motivo_cierre='TIEMPO_AGOTADO' THEN n:=n+1; ELSE EXIT; END IF;
 END LOOP;
 RETURN n;
END $$;

CREATE FUNCTION truco_arena_der.ta_online_expire(p_game bigint,p_turn bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE g partida%ROWTYPE; t turno%ROWTYPE; receipt solicitud_operacion%ROWTYPE; now_at timestamptz; side integer; h text; key uuid; l1 integer; l2 integer;
BEGIN
 -- The game row is the single mutex shared with manual actions and abandonment.
 SELECT * INTO g FROM partida WHERE id_partida=p_game FOR UPDATE;
 IF NOT FOUND OR g.modalidad<>'ONLINE' THEN RETURN '{"expired":false}'::jsonb; END IF;
 h:=encode(sha256(convert_to(jsonb_build_array('expire',p_game,p_turn)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM solicitud_operacion WHERE id_partida=p_game AND tipo_operacion='EXPIRAR_TURNO' AND hash_parametros=h;
 IF FOUND THEN RETURN jsonb_build_object('expired',false,'replayed',true,'versionResult',receipt.version_resultante); END IF;
 IF g.fecha_fin IS NOT NULL THEN RETURN '{"expired":false}'::jsonb; END IF;
 SELECT * INTO t FROM turno WHERE id_turno=p_turn AND id_partida=p_game AND fecha_cierre IS NULL;
 IF NOT FOUND THEN RETURN '{"expired":false}'::jsonb; END IF;
 now_at:=ta_online_now();
 IF now_at < (t.fecha_apertura AT TIME ZONE 'UTC')+interval '15 seconds' THEN RETURN '{"expired":false}'::jsonb; END IF;
 side:=CASE WHEN t.numero_global%2=1 THEN 1 ELSE 2 END;
 UPDATE turno SET fecha_cierre=now_at AT TIME ZONE 'UTC',motivo_cierre='TIEMPO_AGOTADO' WHERE id_turno=t.id_turno;
 IF ta_online_streak(p_game,side)>=3 THEN
  UPDATE partida SET fecha_fin=now_at AT TIME ZONE 'UTC',motivo_cierre='INACTIVIDAD',ganador_posicion=3-side WHERE id_partida=p_game;
 ELSIF t.numero_global=30 THEN
  SELECT vida_heroe INTO l1 FROM participante_partida WHERE id_partida=p_game AND posicion=1;
  SELECT vida_heroe INTO l2 FROM participante_partida WHERE id_partida=p_game AND posicion=2;
  UPDATE partida SET fecha_fin=now_at AT TIME ZONE 'UTC',motivo_cierre='LIMITE_TURNOS',ganador_posicion=CASE WHEN l1=l2 THEN NULL WHEN l1>l2 THEN 1 ELSE 2 END WHERE id_partida=p_game;
 ELSE
  INSERT INTO turno(id_partida,numero_global,energia_disponible) VALUES(p_game,t.numero_global+1,least(5,(t.numero_global+2)/2));
  IF t.numero_global+1>2 THEN
   UPDATE copia_carta_partida SET zona='MANO' WHERE id_copia=(SELECT c.id_copia FROM copia_carta_partida c JOIN participante_partida pp USING(id_participante) WHERE pp.id_partida=p_game AND pp.posicion=3-side AND c.zona='MAZO' ORDER BY c.posicion_original LIMIT 1);
  END IF;
 END IF;
 UPDATE partida SET version=version+1 WHERE id_partida=p_game;
 -- Row lock + old turn identity make retries idempotent. Random UUID avoids a client
 -- preclaiming a predictable global request key. A rollback also rolls back this receipt.
 key:=gen_random_uuid();
 INSERT INTO solicitud_operacion VALUES(key,p_game,'EXPIRAR_TURNO',h,g.version+1,now_at AT TIME ZONE 'UTC');
 RETURN jsonb_build_object('expired',true,'replayed',false,'versionResult',g.version+1);
END $$;

CREATE FUNCTION truco_arena_der.ta_online_tick() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE r record; result jsonb; processed integer:=0; failed integer:=0; BEGIN
 FOR r IN SELECT p.id_partida,t.id_turno FROM partida p JOIN turno t USING(id_partida)
  WHERE p.modalidad='ONLINE' AND p.fecha_fin IS NULL AND t.fecha_cierre IS NULL AND t.fecha_apertura<=((ta_online_now() AT TIME ZONE 'UTC')-interval '15 seconds')
  ORDER BY t.fecha_apertura,p.id_partida LIMIT 100 FOR UPDATE OF p SKIP LOCKED LOOP
  BEGIN
   result:=ta_online_expire(r.id_partida,r.id_turno);
   IF (result->>'expired')::boolean THEN processed:=processed+1; END IF;
  EXCEPTION WHEN OTHERS THEN
   failed:=failed+1;RAISE WARNING 'Truco deadline game % failed [%]; next tick retries',r.id_partida,SQLSTATE;
  END;
 END LOOP;
 RETURN jsonb_build_object('processed',processed,'failed',failed);
END $$;

CREATE FUNCTION truco_arena_der.ta_online_abandon(p_key uuid,p_game bigint,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE who bigint:=ta_contexto();g partida%ROWTYPE; receipt solicitud_operacion%ROWTYPE;side integer;h text; now_at timestamptz; BEGIN
 IF p_key IS NULL OR p_game IS NULL OR p_version IS NULL OR p_version<1 THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_array(who,p_game,p_version,'abandon')::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO g FROM partida WHERE id_partida=p_game FOR UPDATE;
 SELECT pp.posicion INTO side FROM participante_partida pp JOIN mazo m USING(id_mazo) WHERE pp.id_partida=p_game AND m.id_jugador=who;
 IF side IS NULL THEN RAISE EXCEPTION 'PARTIDA_AJENA'; END IF;
 IF g.modalidad<>'ONLINE' THEN RAISE EXCEPTION 'MODALIDAD_INVALIDA'; END IF;
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

CREATE FUNCTION truco_arena_der.ta_online_meta(p_game bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE g partida%ROWTYPE;t turno%ROWTYPE;last_closed turno%ROWTYPE; BEGIN
 SELECT * INTO g FROM partida WHERE id_partida=p_game;
 IF g.modalidad IS DISTINCT FROM 'ONLINE' THEN RETURN '{}'::jsonb; END IF;
 SELECT * INTO t FROM turno WHERE id_partida=p_game ORDER BY numero_global DESC LIMIT 1;
 SELECT * INTO last_closed FROM turno WHERE id_partida=p_game AND fecha_cierre IS NOT NULL ORDER BY numero_global DESC LIMIT 1;
 RETURN jsonb_build_object('onlineTimer',jsonb_build_object('turnId',t.id_turno::text,'serverNow',ta_online_now(),'openedAt',t.fecha_apertura AT TIME ZONE 'UTC','deadlineAt',(t.fecha_apertura AT TIME ZONE 'UTC')+interval '15 seconds','durationSeconds',15,'running',g.fecha_fin IS NULL,
 'lastClosure',CASE WHEN last_closed.id_turno IS NULL THEN NULL ELSE jsonb_build_object('turn',last_closed.numero_global,'reason',last_closed.motivo_cierre,'closedAt',last_closed.fecha_cierre AT TIME ZONE 'UTC') END,
 'inactivity',(SELECT jsonb_agg(jsonb_build_object('playerId',m.id_jugador::text,'count',ta_online_streak(p_game,pp.posicion)) ORDER BY pp.posicion) FROM participante_partida pp JOIN mazo m USING(id_mazo) WHERE pp.id_partida=p_game)));
END $$;

CREATE FUNCTION truco_arena_der.ta_web_timed(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der,pg_temp AS $$
DECLARE result jsonb;me jsonb;receipt jsonb; BEGIN
 IF p_op='abandon' THEN
  me:=ta_web_online('me','{}'::jsonb);
  IF me->'profile' IS NULL OR me->'profile'='null'::jsonb THEN RAISE EXCEPTION 'PERFIL_REQUERIDO'; END IF;
  PERFORM set_config('ta.player_id',me->'profile'->>'id',true);
  receipt:=ta_online_abandon((p_data->>'requestId')::uuid,(p_data->>'id')::bigint,(p_data->>'expectedVersion')::bigint);
  RETURN ta_estado_privado((p_data->>'id')::bigint)||ta_room_game_meta((p_data->>'id')::bigint)||ta_online_meta((p_data->>'id')::bigint)||jsonb_build_object('operation',receipt);
 END IF;
 result:=ta_web_online(p_op,p_data);
 IF p_op IN('state','act') THEN result:=result||ta_online_meta((p_data->>'id')::bigint); END IF;
 RETURN result;
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='truco_arena_der' AND (p.proname LIKE 'ta_online_%' OR p.proname='ta_web_timed') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO ta_engine_owner',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,ta_cpu_worker,ta_engine_server',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION truco_arena_der.ta_online_tick() TO ta_timer_runner;
GRANT EXECUTE ON FUNCTION truco_arena_der.ta_web_timed(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.ta_web(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT truco_arena_der.ta_web_timed(p_op,p_data) $$;
REVOKE CREATE ON SCHEMA truco_arena_der FROM ta_engine_owner;
DO $$ BEGIN EXECUTE format('REVOKE ta_engine_owner FROM %I',current_user); END $$;
