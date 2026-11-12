-- Incremental engine only. Existing 15 tables/catalog are prerequisites, never recreated here.
-- Apply atomically, only to TrucoOnline gjcpcbrkdjymrwktshfr after isolated tests.
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='truco_arena_der'::regnamespace AND relkind='r')<>15
 OR (SELECT count(*) FROM truco_arena_der.carta)<>40 THEN RAISE EXCEPTION 'BASELINE_INVALIDO'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ta_engine_owner') THEN CREATE ROLE ta_engine_owner NOLOGIN NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ta_engine_server') THEN CREATE ROLE ta_engine_server NOLOGIN NOBYPASSRLS; END IF;
END $$;
-- Managed Supabase postgres is not superuser: temporary membership permits ownership transfer.
DO $$ BEGIN EXECUTE format('GRANT ta_engine_owner TO %I',current_user); END $$;
GRANT USAGE ON SCHEMA truco_arena_der TO ta_engine_owner,ta_engine_server;
GRANT CREATE ON SCHEMA truco_arena_der TO ta_engine_owner;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA truco_arena_der TO ta_engine_owner;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA truco_arena_der TO ta_engine_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA truco_arena_der FROM ta_engine_server;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='truco_arena_der' LOOP
  EXECUTE format('CREATE POLICY ta_engine_internal ON truco_arena_der.%I TO ta_engine_owner USING (true) WITH CHECK (true)',t.tablename);
 END LOOP;
END $$;
ALTER TABLE truco_arena_der.turno DROP CONSTRAINT ck_turno_motivo_cierre;
ALTER TABLE truco_arena_der.turno ADD CONSTRAINT ck_turno_motivo_cierre CHECK (
 (fecha_cierre IS NULL AND motivo_cierre IS NULL) OR
 (fecha_cierre IS NOT NULL AND motivo_cierre IS NOT NULL AND motivo_cierre IN ('MANUAL','TIEMPO_AGOTADO','FIN_PARTIDA')));
CREATE UNIQUE INDEX ta_un_turno_abierto ON truco_arena_der.turno(id_partida) WHERE fecha_cierre IS NULL;

-- Trusted BFF must set this transaction-local context AFTER authenticating the caller.
-- No browser role can execute or set this through a game endpoint in this phase.
CREATE FUNCTION truco_arena_der.ta_contexto() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE v bigint; BEGIN
 v:=nullif(current_setting('ta.player_id',true),'')::bigint;
 IF v IS NULL OR NOT EXISTS(SELECT FROM jugador WHERE id_jugador=v AND fecha_archivo IS NULL) THEN RAISE EXCEPTION 'IDENTIDAD_REQUERIDA'; END IF;
 RETURN v;
END $$;
CREATE FUNCTION truco_arena_der.ta_crear_jugador(p_alias text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE v bigint; BEGIN
 INSERT INTO jugador(alias) VALUES(trim(p_alias)) RETURNING id_jugador INTO v;
 INSERT INTO coleccion_jugador SELECT v,id_carta,2 FROM carta;
 IF (SELECT count(*) FROM coleccion_jugador WHERE id_jugador=v)<>40 THEN RAISE EXCEPTION 'CATALOGO_INVALIDO'; END IF;
 RETURN v;
END $$;
CREATE FUNCTION truco_arena_der.ta_validar_mazo(p_id bigint,p_exacto boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE n integer; BEGIN
 SELECT coalesce(sum(cantidad),0) INTO n FROM mazo_carta WHERE id_mazo=p_id;
 IF NOT EXISTS(SELECT FROM mazo WHERE id_mazo=p_id AND fecha_archivo IS NULL) OR n>20 OR (p_exacto AND n NOT IN(12,20)) THEN RAISE EXCEPTION 'MAZO_INVALIDO'; END IF;
 IF EXISTS(SELECT FROM mazo_carta mc JOIN mazo m USING(id_mazo) LEFT JOIN coleccion_jugador c ON c.id_jugador=m.id_jugador AND c.id_carta=mc.id_carta WHERE mc.id_mazo=p_id AND (c.cantidad IS NULL OR mc.cantidad>c.cantidad)) THEN RAISE EXCEPTION 'COLECCION_INSUFICIENTE'; END IF;
 RETURN n;
END $$;
CREATE FUNCTION truco_arena_der.ta_guardar_mazo(p_id bigint,p_nombre text,p_entries jsonb,p_descripcion text DEFAULT '') RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE who bigint:=ta_contexto(); v bigint; e jsonb; BEGIN
 PERFORM 1 FROM jugador WHERE id_jugador=who FOR UPDATE;
 IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array' THEN RAISE EXCEPTION 'MAZO_INVALIDO'; END IF;
 IF jsonb_array_length(p_entries)>20 THEN RAISE EXCEPTION 'MAZO_INVALIDO'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO mazo(id_jugador,nombre,descripcion) VALUES(who,trim(p_nombre),coalesce(p_descripcion,'')) RETURNING id_mazo INTO v;
 ELSE
  PERFORM 1 FROM mazo WHERE id_mazo=p_id AND id_jugador=who AND fecha_archivo IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAZO_AJENO'; END IF;
  IF EXISTS(SELECT FROM participante_partida WHERE id_mazo=p_id) THEN RAISE EXCEPTION 'MAZO_UTILIZADO'; END IF;
  v:=p_id; UPDATE mazo SET nombre=trim(p_nombre),descripcion=coalesce(p_descripcion,'') WHERE id_mazo=v;
  DELETE FROM mazo_carta WHERE id_mazo=v;
 END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  IF jsonb_typeof(e->'cardId') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'quantity') IS DISTINCT FROM 'number'
   OR (e->>'quantity') !~ '^[12]$' OR NOT EXISTS(SELECT FROM carta WHERE id_carta=e->>'cardId') THEN RAISE EXCEPTION 'MAZO_INVALIDO'; END IF;
  INSERT INTO mazo_carta VALUES(v,e->>'cardId',(e->>'quantity')::smallint);
 END LOOP;
 PERFORM ta_validar_mazo(v,false); RETURN v;
END $$;
CREATE FUNCTION truco_arena_der.ta_eliminar_mazo(p_id bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE who bigint:=ta_contexto(); BEGIN
 PERFORM 1 FROM jugador WHERE id_jugador=who FOR UPDATE;
 PERFORM 1 FROM mazo WHERE id_mazo=p_id AND id_jugador=who FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MAZO_AJENO'; END IF;
 IF EXISTS(SELECT FROM participante_partida WHERE id_mazo=p_id) THEN UPDATE mazo SET fecha_archivo=coalesce(fecha_archivo,clock_timestamp() AT TIME ZONE 'UTC') WHERE id_mazo=p_id;
 ELSE DELETE FROM mazo_carta WHERE id_mazo=p_id; DELETE FROM mazo WHERE id_mazo=p_id; END IF;
END $$;

CREATE FUNCTION truco_arena_der.ta_iniciar_partida(p_clave uuid,p_mazo bigint,p_rival bigint,p_mazo_rival bigint,p_reiniciar boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE who bigint:=ta_contexto(); h text; receipt solicitud_operacion%ROWTYPE; game bigint; part bigint; n integer; side integer; deck bigint; swap boolean; old record;
BEGIN
 IF p_clave IS NULL OR p_rival IS NULL OR p_rival=who OR p_reiniciar IS NULL THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_array(who,p_mazo,p_rival,p_mazo_rival,p_reiniciar)::text,'UTF8')),'hex');
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
 INSERT INTO partida(modalidad,dificultad_pc) VALUES('PC','NORMAL') RETURNING id_partida INTO game;
 swap:=random()<0.5;
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

-- Single command gateway: actor comes from trusted transaction context, never a browser field.
CREATE FUNCTION truco_arena_der.ta_actuar(p_clave uuid,p_partida bigint,p_version bigint,p_accion jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
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
    UPDATE turno SET fecha_cierre=clock_timestamp() AT TIME ZONE 'UTC',motivo_cierre='FIN_PARTIDA' WHERE id_turno=t.id_turno;
    UPDATE partida SET fecha_fin=clock_timestamp() AT TIME ZONE 'UTC',motivo_cierre='VIDA_CERO',ganador_posicion=actor.posicion WHERE id_partida=p_partida;
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
  UPDATE turno SET fecha_cierre=clock_timestamp() AT TIME ZONE 'UTC',motivo_cierre='MANUAL' WHERE id_turno=t.id_turno;
  IF t.numero_global=30 THEN
   SELECT vida_heroe INTO l1 FROM participante_partida WHERE id_partida=p_partida AND posicion=1;
   SELECT vida_heroe INTO l2 FROM participante_partida WHERE id_partida=p_partida AND posicion=2;
   UPDATE partida SET fecha_fin=clock_timestamp() AT TIME ZONE 'UTC',motivo_cierre='LIMITE_TURNOS',ganador_posicion=CASE WHEN l1=l2 THEN NULL WHEN l1>l2 THEN 1 ELSE 2 END WHERE id_partida=p_partida;
  ELSE
   INSERT INTO turno(id_partida,numero_global,energia_disponible) VALUES(p_partida,t.numero_global+1,least(5,(t.numero_global+2)/2));
   IF t.numero_global+1>2 THEN
    UPDATE copia_carta_partida SET zona='MANO' WHERE id_copia=(SELECT id_copia FROM copia_carta_partida WHERE id_participante=enemy.id_participante AND zona='MAZO' ORDER BY posicion_original LIMIT 1);
   END IF;
  END IF;
 END IF;
 UPDATE partida SET version=version+1 WHERE id_partida=p_partida;
 INSERT INTO solicitud_operacion VALUES(p_clave,p_partida,op,h,g.version+1,clock_timestamp() AT TIME ZONE 'UTC');
 IF kind IN('play','attack') THEN
  SELECT coalesce(max(orden_en_turno),0)+1 INTO ord FROM jugada WHERE id_turno=t.id_turno;
  INSERT INTO jugada(id_turno,orden_en_turno,clave_reintento) VALUES(t.id_turno,ord,p_clave) RETURNING id_jugada INTO ev;
  IF kind='play' THEN INSERT INTO invocacion VALUES(ev,a);
  ELSE INSERT INTO ataque VALUES(ev,a,b,CASE WHEN b IS NULL THEN enemy.id_participante ELSE NULL END,src.vida_actual,CASE WHEN b IS NULL THEN enemy.vida_heroe ELSE dst.vida_actual END); END IF;
 END IF;
 RETURN jsonb_build_object('id',p_partida::text,'versionResult',g.version+1,'replayed',false);
END $$;

CREATE FUNCTION truco_arena_der.ta_estado_privado(p_partida bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE who bigint:=ta_contexto(); g partida%ROWTYPE; t turno%ROWTYPE; players jsonb; hist jsonb;
BEGIN
 SELECT * INTO g FROM partida WHERE id_partida=p_partida FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PARTIDA_NO_ENCONTRADA'; END IF;
 IF NOT EXISTS(SELECT FROM participante_partida pp JOIN mazo m USING(id_mazo) WHERE pp.id_partida=p_partida AND m.id_jugador=who) THEN RAISE EXCEPTION 'PARTIDA_AJENA'; END IF;
 SELECT * INTO STRICT t FROM turno WHERE id_partida=p_partida ORDER BY numero_global DESC LIMIT 1;
 SELECT jsonb_agg(jsonb_build_object('id',m.id_jugador::text,'name',j.alias,'position',pp.posicion,'life',pp.vida_heroe,
  'handCount',(SELECT count(*) FROM copia_carta_partida c WHERE c.id_participante=pp.id_participante AND zona='MANO'),
  'deckCount',(SELECT count(*) FROM copia_carta_partida c WHERE c.id_participante=pp.id_participante AND zona='MAZO'),
  'energy',coalesce((SELECT energia_disponible FROM turno WHERE id_partida=p_partida AND numero_global%2=pp.posicion%2 ORDER BY numero_global DESC LIMIT 1),0),
  'cards',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id_copia::text,'cardId',c.id_carta,'zone',c.zona,'health',c.vida_actual,
   'enteredTurn',(SELECT tt.numero_global FROM invocacion i JOIN jugada jj USING(id_jugada) JOIN turno tt USING(id_turno) WHERE i.id_copia=c.id_copia),
   'lastAttackTurn',(SELECT max(tt.numero_global) FROM ataque a JOIN jugada jj USING(id_jugada) JOIN turno tt USING(id_turno) WHERE a.id_copia_atacante=c.id_copia)) ORDER BY c.id_copia)
   FROM copia_carta_partida c WHERE c.id_participante=pp.id_participante AND (c.zona IN('CAMPO','DESCARTE') OR (m.id_jugador=who AND c.zona='MANO'))),'[]'::jsonb)) ORDER BY pp.posicion)
  INTO players FROM participante_partida pp JOIN mazo m USING(id_mazo) JOIN jugador j ON j.id_jugador=m.id_jugador WHERE pp.id_partida=p_partida;
 SELECT coalesce(jsonb_agg(jsonb_build_object('turn',tt.numero_global,'order',jj.orden_en_turno,'invocation',i.id_copia::text,'attacker',a.id_copia_atacante::text,'target',a.id_copia_objetivo::text,'hero',a.id_participante_objetivo::text,'attackerHealthBefore',a.vida_previa_atacante,'targetHealthBefore',a.vida_previa_objetivo) ORDER BY tt.numero_global,jj.orden_en_turno),'[]'::jsonb)
 INTO hist FROM turno tt JOIN jugada jj USING(id_turno) LEFT JOIN invocacion i USING(id_jugada) LEFT JOIN ataque a USING(id_jugada) WHERE tt.id_partida=p_partida;
 RETURN jsonb_build_object('id',g.id_partida::text,'version',g.version,'turn',t.numero_global,'viewerPlayerId',who::text,'activePosition',CASE WHEN t.numero_global%2=1 THEN 1 ELSE 2 END,'players',players,'history',hist,'status',CASE WHEN g.fecha_fin IS NULL THEN 'active' ELSE 'finished' END,'winnerPosition',g.ganador_posicion,'reason',g.motivo_cierre);
END $$;

CREATE FUNCTION truco_arena_der.ta_evento_inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'HISTORIAL_INMUTABLE'; END $$;
CREATE FUNCTION truco_arena_der.ta_subtipo_total() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,truco_arena_der AS $$
DECLARE n integer; BEGIN
 PERFORM 1 FROM jugada WHERE id_jugada=NEW.id_jugada FOR UPDATE;
 SELECT (SELECT count(*) FROM invocacion WHERE id_jugada=NEW.id_jugada)+(SELECT count(*) FROM ataque WHERE id_jugada=NEW.id_jugada) INTO n;
 IF n<>1 THEN RAISE EXCEPTION 'SUBTIPO_INVALIDO'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ta_total_parent AFTER INSERT ON truco_arena_der.jugada DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION truco_arena_der.ta_subtipo_total();
CREATE CONSTRAINT TRIGGER ta_total_inv AFTER INSERT ON truco_arena_der.invocacion DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION truco_arena_der.ta_subtipo_total();
CREATE CONSTRAINT TRIGGER ta_total_atk AFTER INSERT ON truco_arena_der.ataque DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION truco_arena_der.ta_subtipo_total();
DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['jugada','invocacion','ataque','solicitud_operacion'] LOOP
  EXECUTE format('CREATE TRIGGER ta_inmutable BEFORE UPDATE OR DELETE ON truco_arena_der.%I FOR EACH ROW EXECUTE FUNCTION truco_arena_der.ta_evento_inmutable()',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='truco_arena_der' AND p.proname LIKE 'ta_%' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO ta_engine_owner',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION truco_arena_der.ta_crear_jugador(text),truco_arena_der.ta_guardar_mazo(bigint,text,jsonb,text),truco_arena_der.ta_eliminar_mazo(bigint),truco_arena_der.ta_iniciar_partida(uuid,bigint,bigint,bigint,boolean),truco_arena_der.ta_actuar(uuid,bigint,bigint,jsonb),truco_arena_der.ta_estado_privado(bigint) TO ta_engine_server;
REVOKE CREATE ON SCHEMA truco_arena_der FROM ta_engine_owner;
DO $$ BEGIN EXECUTE format('REVOKE ta_engine_owner FROM %I',current_user); END $$;
