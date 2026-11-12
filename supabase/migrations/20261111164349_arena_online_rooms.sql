-- Fase 5: no new tables, no combat/catalog changes. See docs/supabase/08-salas-online.md.
SET LOCAL lock_timeout='5s';
DO $$ BEGIN EXECUTE format('GRANT ta_engine_owner TO %I',current_user); END $$;
GRANT CREATE ON SCHEMA truco_arena_der TO ta_engine_owner;
ALTER TABLE truco_arena_der.sala ADD COLUMN clave_creacion uuid UNIQUE;
ALTER TABLE truco_arena_der.intento_recuperacion ADD COLUMN sala_ventana timestamptz NOT NULL DEFAULT clock_timestamp(), ADD COLUMN sala_intentos integer NOT NULL DEFAULT 0 CHECK(sala_intentos>=0);
CREATE UNIQUE INDEX ta_sala_un_anfitrion_esperando ON truco_arena_der.sala(id_anfitrion) WHERE estado='ESPERANDO';
CREATE FUNCTION truco_arena_der.ta_iniciar_base(p_clave uuid,p_mazo bigint,p_rival bigint,p_mazo_rival bigint,p_reiniciar boolean,p_online boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE who bigint:=ta_contexto(); h text; receipt solicitud_operacion%ROWTYPE; game bigint; part bigint; n integer; side integer; deck bigint; swap boolean; old record;
BEGIN
 IF p_clave IS NULL OR p_rival IS NULL OR p_rival=who OR p_reiniciar IS NULL THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
 h:=encode(sha256(convert_to((jsonb_build_array(who,p_mazo,p_rival,p_mazo_rival,p_reiniciar)||CASE WHEN p_online THEN '"ONLINE"'::jsonb ELSE '[]'::jsonb END)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 SELECT * INTO receipt FROM solicitud_operacion WHERE clave_reintento=p_clave;
 IF FOUND THEN
  IF receipt.tipo_operacion<>'CREAR_PARTIDA' OR receipt.hash_parametros<>h THEN RAISE EXCEPTION 'CLAVE_REUTILIZADA'; END IF;
  RETURN jsonb_build_object('id',receipt.id_partida::text,'versionResult',receipt.version_resultante,'replayed',true);
 END IF;
 PERFORM 1 FROM jugador WHERE id_jugador IN(who,p_rival) AND fecha_archivo IS NULL ORDER BY id_jugador FOR UPDATE;
 IF (SELECT count(*) FROM jugador WHERE id_jugador IN(who,p_rival) AND fecha_archivo IS NULL)<>2 THEN RAISE EXCEPTION 'JUGADOR_INVALIDO'; END IF;
 PERFORM 1 FROM mazo WHERE id_mazo IN(p_mazo,p_mazo_rival) ORDER BY id_mazo FOR UPDATE;
 IF NOT EXISTS(SELECT FROM mazo WHERE id_mazo=p_mazo AND id_jugador=who AND fecha_archivo IS NULL)
 OR NOT EXISTS(SELECT FROM mazo WHERE id_mazo=p_mazo_rival AND id_jugador=p_rival AND fecha_archivo IS NULL) THEN RAISE EXCEPTION 'MAZO_AJENO'; END IF;
 n:=ta_validar_mazo(p_mazo,true);
 IF n<>ta_validar_mazo(p_mazo_rival,true) THEN RAISE EXCEPTION 'MAZO_INVALIDO'; END IF;
 FOR old IN SELECT DISTINCT p.id_partida FROM partida p JOIN participante_partida pp USING(id_partida) JOIN mazo m USING(id_mazo) WHERE p.fecha_fin IS NULL AND m.id_jugador IN(who,p_rival) ORDER BY p.id_partida LOOP
  PERFORM 1 FROM partida WHERE id_partida=old.id_partida FOR UPDATE;
  IF NOT p_reiniciar THEN RAISE EXCEPTION 'PARTIDA_ACTIVA'; END IF;
  IF EXISTS(SELECT FROM partida WHERE id_partida=old.id_partida AND modalidad<>'PC') THEN RAISE EXCEPTION 'REINICIO_ONLINE_PROHIBIDO'; END IF;
  UPDATE turno SET fecha_cierre=clock_timestamp() AT TIME ZONE 'UTC',motivo_cierre='FIN_PARTIDA' WHERE id_partida=old.id_partida AND fecha_cierre IS NULL;
  UPDATE partida SET fecha_fin=clock_timestamp() AT TIME ZONE 'UTC',motivo_cierre='REINICIO',ganador_posicion=NULL,version=version+1 WHERE id_partida=old.id_partida AND fecha_fin IS NULL;
 END LOOP;
 INSERT INTO partida(modalidad,dificultad_pc) VALUES(CASE WHEN p_online THEN 'ONLINE' ELSE 'PC' END,CASE WHEN p_online THEN NULL ELSE 'NORMAL' END) RETURNING id_partida INTO game;
 swap:=NOT p_online AND random()<0.5;
 FOR side IN 1..2 LOOP
  deck:=CASE WHEN (side=1 AND NOT swap) OR (side=2 AND swap) THEN p_mazo ELSE p_mazo_rival END;
  INSERT INTO participante_partida(id_partida,posicion,id_mazo) VALUES(game,side,deck) RETURNING id_participante INTO part;
  INSERT INTO copia_carta_partida(id_participante,id_carta,posicion_original,zona)
   SELECT part,id_carta,row_number() OVER(ORDER BY random()) AS pos,'MAZO' FROM mazo_carta CROSS JOIN LATERAL generate_series(1,cantidad) WHERE id_mazo=deck;
  UPDATE copia_carta_partida SET zona='MANO' WHERE id_participante=part AND posicion_original<=3;
  IF (SELECT count(*) FROM copia_carta_partida WHERE id_participante=part)<>n OR EXISTS(
   SELECT id_carta,cantidad::bigint FROM mazo_carta WHERE id_mazo=deck EXCEPT SELECT id_carta,count(*) FROM copia_carta_partida WHERE id_participante=part GROUP BY id_carta
  ) THEN RAISE EXCEPTION 'COMPOSICION_INVALIDA'; END IF;
 END LOOP;
 INSERT INTO turno(id_partida,numero_global,energia_disponible) VALUES(game,1,1);
 INSERT INTO solicitud_operacion VALUES(p_clave,game,'CREAR_PARTIDA',h,1,clock_timestamp() AT TIME ZONE 'UTC');
 RETURN jsonb_build_object('id',game::text,'versionResult',1,'replayed',false);
END $$;

-- Invitation codes are CSPRNG-derived, 8 independent base32 characters (40 bits).
CREATE FUNCTION truco_arena_der.ta_room_code() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE bytes bytea:=sha256(convert_to(gen_random_uuid()::text,'UTF8')); alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text:=''; i integer;
BEGIN FOR i IN 0..7 LOOP code:=code||substr(alphabet,1+get_byte(bytes,i)%32,1); END LOOP; RETURN substr(code,1,4)||'-'||substr(code,5,4); END $$;

CREATE FUNCTION truco_arena_der.ta_room_snapshot(p_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE r sala%ROWTYPE; who bigint:=ta_contexto(); BEGIN
 -- Do not take a room lock while reading a joined game: game finalization locks game -> room.
 IF NOT EXISTS(SELECT FROM sala WHERE id_sala=p_id AND who IN(id_anfitrion,id_invitado)) THEN RAISE EXCEPTION 'SALA_AJENA'; END IF;
 UPDATE sala SET estado='EXPIRADA' WHERE id_sala=p_id AND estado='ESPERANDO' AND fecha_expiracion<=clock_timestamp();
 SELECT * INTO STRICT r FROM sala WHERE id_sala=p_id;
 RETURN jsonb_build_object('id',r.id_sala::text,'code',r.codigo,'status',r.estado,'duelId',r.id_partida::text,'expiresAt',r.fecha_expiracion,
 'host',(SELECT jsonb_build_object('id',j.id_jugador::text,'alias',j.alias,'deckId',m.id_mazo::text,'deckName',m.nombre,'deckSize',(SELECT sum(cantidad) FROM mazo_carta WHERE id_mazo=m.id_mazo)) FROM jugador j JOIN mazo m ON m.id_mazo=r.id_mazo_anfitrion WHERE j.id_jugador=r.id_anfitrion),
 'guest',(SELECT jsonb_build_object('id',id_jugador::text,'alias',alias) FROM jugador WHERE id_jugador=r.id_invitado));
END $$;

-- Private gate: JWT subject is verified by PostgREST, never taken from a browser field.
CREATE FUNCTION truco_arena_der.ta_rooms_interno(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
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

CREATE FUNCTION truco_arena_der.ta_room_game_meta(p_game bigint) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
 SELECT coalesce((SELECT jsonb_build_object('room',jsonb_build_object('id',s.id_sala::text,'code',s.codigo,'status',s.estado),'finishedAt',p.fecha_fin AT TIME ZONE 'UTC') FROM sala s JOIN partida p USING(id_partida) WHERE id_partida=p_game),'{}'::jsonb)
$$;
CREATE FUNCTION truco_arena_der.ta_web_online(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE result jsonb; BEGIN
 result:=ta_web_cpu(p_op,p_data);
 IF p_op IN('state','act') THEN result:=result||ta_room_game_meta((p_data->>'id')::bigint); END IF;
 IF p_op='history' THEN result:=jsonb_set(result,'{duels}',coalesce((SELECT jsonb_agg(e||ta_room_game_meta((e->>'id')::bigint)) FROM jsonb_array_elements(result->'duels') e),'[]'::jsonb)); END IF;
 RETURN result;
END $$;

CREATE FUNCTION truco_arena_der.ta_room_finalized() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
BEGIN UPDATE sala SET estado='FINALIZADA' WHERE id_partida=NEW.id_partida AND estado='EN_CURSO'; RETURN NEW; END $$;
CREATE TRIGGER ta_room_finalized AFTER UPDATE OF fecha_fin ON truco_arena_der.partida FOR EACH ROW WHEN(NEW.fecha_fin IS NOT NULL) EXECUTE FUNCTION truco_arena_der.ta_room_finalized();

CREATE FUNCTION truco_arena_der.ta_room_reserved_deck() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE deck bigint; BEGIN
 deck:=CASE WHEN TG_OP='DELETE' THEN OLD.id_mazo ELSE NEW.id_mazo END;
 IF EXISTS(SELECT FROM sala WHERE estado='ESPERANDO' AND fecha_expiracion>clock_timestamp() AND id_mazo_anfitrion=deck) THEN RAISE EXCEPTION 'MAZO_RESERVADO'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER ta_room_reserved_deck BEFORE UPDATE OR DELETE ON truco_arena_der.mazo FOR EACH ROW EXECUTE FUNCTION truco_arena_der.ta_room_reserved_deck();
CREATE TRIGGER ta_room_reserved_composition BEFORE INSERT OR UPDATE OR DELETE ON truco_arena_der.mazo_carta FOR EACH ROW EXECUTE FUNCTION truco_arena_der.ta_room_reserved_deck();
CREATE FUNCTION truco_arena_der.ta_room_no_cpu() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
BEGIN
 IF EXISTS(SELECT FROM partida WHERE id_partida=NEW.id_partida AND modalidad='PC') AND EXISTS(SELECT FROM sala s JOIN mazo m ON m.id_mazo=NEW.id_mazo WHERE s.id_anfitrion=m.id_jugador AND s.estado='ESPERANDO' AND s.fecha_expiracion>clock_timestamp()) THEN RAISE EXCEPTION 'SALA_PENDIENTE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ta_room_no_cpu BEFORE INSERT ON truco_arena_der.participante_partida FOR EACH ROW EXECUTE FUNCTION truco_arena_der.ta_room_no_cpu();

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='truco_arena_der' AND (p.proname LIKE 'ta_room_%' OR p.proname IN('ta_rooms_interno','ta_web_online','ta_iniciar_base')) LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO ta_engine_owner',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,ta_engine_server,ta_cpu_worker',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION truco_arena_der.ta_rooms_interno(text,jsonb),truco_arena_der.ta_web_online(text,jsonb) TO authenticated;
CREATE FUNCTION public.ta_rooms(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT truco_arena_der.ta_rooms_interno(p_op,p_data) $$;
REVOKE ALL ON FUNCTION public.ta_rooms(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ta_rooms(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.ta_web(p_op text,p_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT truco_arena_der.ta_web_online(p_op,p_data) $$;



CREATE OR REPLACE FUNCTION truco_arena_der.ta_iniciar_partida(p_clave uuid,p_mazo bigint,p_rival bigint,p_mazo_rival bigint,p_reiniciar boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$ SELECT ta_iniciar_base(p_clave,p_mazo,p_rival,p_mazo_rival,p_reiniciar,false) $$;
CREATE OR REPLACE FUNCTION truco_arena_der.ta_eliminar_mazo(p_id bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE who bigint:=ta_contexto(); BEGIN
 PERFORM 1 FROM jugador WHERE id_jugador=who FOR UPDATE;
 PERFORM 1 FROM mazo WHERE id_mazo=p_id AND id_jugador=who FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MAZO_AJENO'; END IF;
 IF EXISTS(SELECT FROM participante_partida WHERE id_mazo=p_id) OR EXISTS(SELECT FROM sala WHERE id_mazo_anfitrion=p_id OR id_mazo_invitado=p_id) THEN UPDATE mazo SET fecha_archivo=coalesce(fecha_archivo,clock_timestamp() AT TIME ZONE 'UTC') WHERE id_mazo=p_id;
 ELSE DELETE FROM mazo_carta WHERE id_mazo=p_id; DELETE FROM mazo WHERE id_mazo=p_id; END IF;
END $$;



REVOKE CREATE ON SCHEMA truco_arena_der FROM ta_engine_owner;
DO $$ BEGIN EXECUTE format('REVOKE ta_engine_owner FROM %I',current_user); END $$;
