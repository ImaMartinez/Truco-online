-- Motor provisional sobre las 13 tablas existentes. B1-B4 siguen pendientes.
-- Solo truco_arena_dev. El coordinador abre/confirma la transacción en una conexión.
USE truco_arena_dev;
SET NAMES utf8mb4 COLLATE utf8mb4_bin;
SET SESSION sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION';
DELIMITER $$

DROP PROCEDURE IF EXISTS ta_invocar$$
CREATE PROCEDURE ta_invocar(
  IN p_clave CHAR(36), IN p_hash CHAR(64), IN p_partida INT UNSIGNED,
  IN p_actor INT UNSIGNED, IN p_version INT UNSIGNED, IN p_copia INT UNSIGNED)
SQL SECURITY DEFINER
main: BEGIN
  DECLARE v_version INT UNSIGNED DEFAULT NULL;
  DECLARE v_fin DATETIME(6);
  DECLARE v_req INT UNSIGNED DEFAULT NULL; DECLARE v_hash CHAR(64);
  DECLARE v_tipo VARCHAR(20); DECLARE v_reqversion INT UNSIGNED;
  DECLARE v_turno INT UNSIGNED; DECLARE v_num INT; DECLARE v_energia INT;
  DECLARE v_participante INT UNSIGNED DEFAULT NULL; DECLARE v_actor INT UNSIGNED DEFAULT NULL;
  DECLARE v_propietario INT UNSIGNED DEFAULT NULL; DECLARE v_zona VARCHAR(8); DECLARE v_carta CHAR(6);
  DECLARE v_costo INT; DECLARE v_vida INT; DECLARE v_cantidad INT;
  DECLARE v_jugada INT UNSIGNED; DECLARE v_orden INT;
  DECLARE v_sp BOOLEAN DEFAULT FALSE;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
    IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_invocar_sp; END IF;
    RESIGNAL;
  END;
  IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
  SAVEPOINT ta_invocar_sp; SET v_sp=TRUE;
  IF p_clave IS NULL OR p_hash IS NULL OR p_clave NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_hash NOT REGEXP '^[0-9a-f]{64}$'
    OR p_partida IS NULL OR p_actor IS NULL OR p_version IS NULL OR p_version<1 OR p_copia IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SOLICITUD_INVALIDA: Clave, huella, partida, actor, versión y copia son obligatorios.';
  END IF;
  -- Mutex de toda mutación de esta partida; también serializa energía/campo/eventos.
  SELECT version,fecha_fin INTO v_version,v_fin FROM partida WHERE id_partida=p_partida FOR UPDATE;
  IF v_version IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PARTIDA_NO_ENCONTRADA: Partida inexistente.'; END IF;
  SELECT id_partida,hash_parametros,tipo_operacion,version_resultante INTO v_req,v_hash,v_tipo,v_reqversion
    FROM solicitud_operacion WHERE clave_reintento=p_clave FOR UPDATE;
  IF v_req IS NOT NULL THEN
    IF v_req<>p_partida OR v_hash<>p_hash OR v_tipo<>'INVOCAR' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CLAVE_REUTILIZADA: La clave corresponde a otro comando.'; END IF;
    RELEASE SAVEPOINT ta_invocar_sp;
    SELECT p_partida AS id_partida,v_reqversion AS version_resultante,1 AS replayed; LEAVE main;
  END IF;
  IF v_fin IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PARTIDA_FINALIZADA: La partida terminó.'; END IF;
  IF v_version<>p_version THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ESTADO_DESACTUALIZADO: Consultá el estado actual.'; END IF;
  IF (SELECT COUNT(*) FROM turno WHERE id_partida=p_partida AND fecha_cierre IS NULL)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TURNO_INVALIDO: No existe un único turno abierto.'; END IF;
  SELECT id_turno,numero_global,energia_disponible INTO v_turno,v_num,v_energia
    FROM turno WHERE id_partida=p_partida AND fecha_cierre IS NULL FOR UPDATE;
  -- Dueño inmutable del mazo usado. No adquirir locks superiores (Jugador/Mazo) después de Partida.
  SELECT pp.id_participante,m.id_jugador INTO v_participante,v_actor
    FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo
    WHERE pp.id_partida=p_partida AND pp.posicion=IF(MOD(v_num,2)=1,1,2);
  IF v_actor IS NULL OR v_actor<>p_actor THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TURNO_AJENO: Solo puede actuar el jugador del turno.'; END IF;
  SELECT id_participante,zona,id_carta INTO v_propietario,v_zona,v_carta FROM copia_carta_partida WHERE id_copia=p_copia FOR UPDATE;
  IF v_propietario IS NULL OR v_propietario<>v_participante THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='COPIA_AJENA: Elegí una copia propia de esta partida.'; END IF;
  IF v_zona<>'MANO' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='COPIA_NO_EN_MANO: La copia debe estar en mano.'; END IF;
  SELECT COUNT(*) INTO v_cantidad FROM invocacion WHERE id_copia=p_copia FOR UPDATE;
  IF v_cantidad<>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='COPIA_YA_INVOCADA: La copia ya fue invocada.'; END IF;
  SELECT costo_energia,vida_base INTO v_costo,v_vida FROM carta WHERE id_carta=v_carta;
  IF v_energia<v_costo THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ENERGIA_INSUFICIENTE: No alcanza la energía para invocar.'; END IF;
  SELECT COUNT(*) INTO v_cantidad FROM copia_carta_partida WHERE id_participante=v_participante AND zona='CAMPO' FOR UPDATE;
  IF v_cantidad>=3 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CAMPO_LLENO: El campo admite hasta tres cartas propias.'; END IF;

  UPDATE turno SET energia_disponible=v_energia-v_costo WHERE id_turno=v_turno;
  UPDATE copia_carta_partida SET zona='CAMPO',vida_actual=v_vida WHERE id_copia=p_copia;
  UPDATE partida SET version=v_version+1 WHERE id_partida=p_partida;
  INSERT INTO solicitud_operacion(clave_reintento,id_partida,tipo_operacion,hash_parametros,version_resultante)
    VALUES(p_clave,p_partida,'INVOCAR',p_hash,v_version+1);
  SELECT COALESCE(MAX(orden_en_turno),0)+1 INTO v_orden FROM jugada WHERE id_turno=v_turno FOR UPDATE;
  INSERT INTO jugada(id_turno,orden_en_turno,clave_reintento) VALUES(v_turno,v_orden,p_clave); SET v_jugada=LAST_INSERT_ID();
  INSERT INTO invocacion(id_jugada,id_copia) VALUES(v_jugada,p_copia);
  -- Totalidad + disyunción en el único camino de escritura concedido al rol app.
  IF (SELECT COUNT(*) FROM invocacion WHERE id_jugada=v_jugada AND id_copia=p_copia)<>1
    OR EXISTS(SELECT 1 FROM ataque WHERE id_jugada=v_jugada) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SUBTIPO_INVALIDO: La invocación requiere exactamente su subtipo.';
  END IF;
  RELEASE SAVEPOINT ta_invocar_sp;
  SELECT p_partida AS id_partida,v_version+1 AS version_resultante,0 AS replayed;
END$$

DROP PROCEDURE IF EXISTS ta_atacar$$
CREATE PROCEDURE ta_atacar(
  IN p_clave CHAR(36), IN p_hash CHAR(64), IN p_partida INT UNSIGNED,
  IN p_actor INT UNSIGNED, IN p_version INT UNSIGNED, IN p_atacante INT UNSIGNED,
  IN p_objetivo_copia INT UNSIGNED, IN p_objetivo_participante INT UNSIGNED)
SQL SECURITY DEFINER
main: BEGIN
  DECLARE v_version INT UNSIGNED DEFAULT NULL; DECLARE v_fin DATETIME(6);
  DECLARE v_req INT UNSIGNED DEFAULT NULL; DECLARE v_hash CHAR(64);
  DECLARE v_tipo VARCHAR(20); DECLARE v_reqversion INT UNSIGNED;
  DECLARE v_turno INT UNSIGNED; DECLARE v_num INT; DECLARE v_pos INT;
  DECLARE v_participante INT UNSIGNED DEFAULT NULL; DECLARE v_rival INT UNSIGNED DEFAULT NULL;
  DECLARE v_actor INT UNSIGNED DEFAULT NULL; DECLARE v_propietario INT UNSIGNED DEFAULT NULL;
  DECLARE v_zona VARCHAR(8); DECLARE v_carta CHAR(6); DECLARE v_invocado INT DEFAULT NULL;
  -- INT SIGNED: restar directamente columnas UNSIGNED podría fallar antes de GREATEST.
  DECLARE v_vida_atacante INT; DECLARE v_vida_objetivo INT; DECLARE v_ataque_atacante INT; DECLARE v_ataque_objetivo INT;
  DECLARE v_nueva_atacante INT; DECLARE v_nueva_objetivo INT;
  DECLARE v_jugada INT UNSIGNED; DECLARE v_orden INT; DECLARE v_cantidad INT;
  DECLARE v_sp BOOLEAN DEFAULT FALSE;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
    IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_atacar_sp; END IF;
    RESIGNAL;
  END;
  IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
  SAVEPOINT ta_atacar_sp; SET v_sp=TRUE;
  IF p_clave IS NULL OR p_hash IS NULL OR p_clave NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_hash NOT REGEXP '^[0-9a-f]{64}$'
    OR p_partida IS NULL OR p_actor IS NULL OR p_version IS NULL OR p_version<1 OR p_atacante IS NULL
    OR (p_objetivo_copia IS NOT NULL)+(p_objetivo_participante IS NOT NULL)<>1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SOLICITUD_INVALIDA: Se requiere un atacante y exactamente un objetivo.';
  END IF;
  SELECT version,fecha_fin INTO v_version,v_fin FROM partida WHERE id_partida=p_partida FOR UPDATE;
  IF v_version IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PARTIDA_NO_ENCONTRADA: Partida inexistente.'; END IF;
  SELECT id_partida,hash_parametros,tipo_operacion,version_resultante INTO v_req,v_hash,v_tipo,v_reqversion
    FROM solicitud_operacion WHERE clave_reintento=p_clave FOR UPDATE;
  IF v_req IS NOT NULL THEN
    IF v_req<>p_partida OR v_hash<>p_hash OR v_tipo<>'ATACAR' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CLAVE_REUTILIZADA: La clave corresponde a otro comando.'; END IF;
    RELEASE SAVEPOINT ta_atacar_sp;
    SELECT p_partida AS id_partida,v_reqversion AS version_resultante,1 AS replayed; LEAVE main;
  END IF;
  IF v_fin IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PARTIDA_FINALIZADA: La partida terminó.'; END IF;
  IF v_version<>p_version THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ESTADO_DESACTUALIZADO: Consultá el estado actual.'; END IF;
  IF (SELECT COUNT(*) FROM turno WHERE id_partida=p_partida AND fecha_cierre IS NULL)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TURNO_INVALIDO: No existe un único turno abierto.'; END IF;
  SELECT id_turno,numero_global INTO v_turno,v_num FROM turno WHERE id_partida=p_partida AND fecha_cierre IS NULL FOR UPDATE;
  SET v_pos=IF(MOD(v_num,2)=1,1,2);
  SELECT pp.id_participante,m.id_jugador INTO v_participante,v_actor
    FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo WHERE pp.id_partida=p_partida AND pp.posicion=v_pos;
  SELECT id_participante INTO v_rival FROM participante_partida WHERE id_partida=p_partida AND posicion=3-v_pos;
  IF v_actor IS NULL OR v_actor<>p_actor THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TURNO_AJENO: Solo puede actuar el jugador del turno.'; END IF;
  IF v_rival IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TURNO_INVALIDO: Falta el participante rival.'; END IF;
  SELECT id_participante,zona,id_carta,vida_actual INTO v_propietario,v_zona,v_carta,v_vida_atacante
    FROM copia_carta_partida WHERE id_copia=p_atacante FOR UPDATE;
  IF v_propietario IS NULL OR v_propietario<>v_participante THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='COPIA_AJENA: Elegí un atacante propio de esta partida.'; END IF;
  IF v_zona<>'CAMPO' OR v_vida_atacante IS NULL OR v_vida_atacante<=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ATACANTE_INVALIDO: El atacante debe estar vivo en campo.'; END IF;
  SELECT t.numero_global INTO v_invocado FROM invocacion i JOIN jugada j ON j.id_jugada=i.id_jugada JOIN turno t ON t.id_turno=j.id_turno
    WHERE i.id_copia=p_atacante AND t.id_partida=p_partida AND MOD(t.numero_global,2)=MOD(v_num,2) FOR UPDATE;
  IF v_invocado IS NULL OR v_invocado>=v_num THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CARTA_NUEVA: La carta debe esperar al siguiente turno propio para atacar.'; END IF;
  SELECT COUNT(*) INTO v_cantidad FROM ataque a JOIN jugada j ON j.id_jugada=a.id_jugada WHERE a.id_copia_atacante=p_atacante AND j.id_turno=v_turno FOR UPDATE;
  IF v_cantidad<>0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CARTA_AGOTADA: Esta copia ya atacó en este turno.';
  END IF;
  SELECT ataque_base INTO v_ataque_atacante FROM carta WHERE id_carta=v_carta;

  IF p_objetivo_copia IS NOT NULL THEN
    SET v_propietario=NULL;
    SELECT id_participante,zona,id_carta,vida_actual INTO v_propietario,v_zona,v_carta,v_vida_objetivo
      FROM copia_carta_partida WHERE id_copia=p_objetivo_copia FOR UPDATE;
    IF v_propietario IS NULL OR v_propietario<>v_rival OR v_zona<>'CAMPO' OR v_vida_objetivo IS NULL OR v_vida_objetivo<=0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='OBJETIVO_INVALIDO: Elegí una carta enemiga viva en campo de esta partida.';
    END IF;
    SELECT ataque_base INTO v_ataque_objetivo FROM carta WHERE id_carta=v_carta;
    -- Ambas vidas y ataques son anteriores a cualquier modificación.
    SET v_nueva_atacante=GREATEST(0,v_vida_atacante-v_ataque_objetivo);
    SET v_nueva_objetivo=GREATEST(0,v_vida_objetivo-v_ataque_atacante);
    UPDATE copia_carta_partida SET vida_actual=v_nueva_atacante,zona=IF(v_nueva_atacante=0,'DESCARTE','CAMPO') WHERE id_copia=p_atacante;
    UPDATE copia_carta_partida SET vida_actual=v_nueva_objetivo,zona=IF(v_nueva_objetivo=0,'DESCARTE','CAMPO') WHERE id_copia=p_objetivo_copia;
  ELSE
    IF p_objetivo_participante<>v_rival THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='OBJETIVO_INVALIDO: El héroe debe ser el rival de esta partida.'; END IF;
    SELECT vida_heroe INTO v_vida_objetivo FROM participante_partida WHERE id_participante=v_rival FOR UPDATE;
    IF v_vida_objetivo IS NULL OR v_vida_objetivo<=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='OBJETIVO_INVALIDO: El héroe rival no está vivo.'; END IF;
    SELECT COUNT(*) INTO v_cantidad FROM copia_carta_partida WHERE id_participante=v_rival AND zona='CAMPO' AND vida_actual>0 FOR UPDATE;
    IF v_cantidad<>0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='HEROE_PROTEGIDO: Eliminá primero las cartas del campo rival.';
    END IF;
    SET v_nueva_objetivo=GREATEST(0,v_vida_objetivo-v_ataque_atacante);
    UPDATE participante_partida SET vida_heroe=v_nueva_objetivo WHERE id_participante=v_rival;
    -- El héroe no contraataca. Letal tiene prioridad también durante el turno 30.
    IF v_nueva_objetivo=0 THEN
      UPDATE turno SET fecha_cierre=CURRENT_TIMESTAMP(6) WHERE id_turno=v_turno;
      UPDATE partida SET fecha_fin=CURRENT_TIMESTAMP(6),motivo_cierre='VIDA_CERO',ganador_posicion=v_pos WHERE id_partida=p_partida;
    END IF;
  END IF;
  UPDATE partida SET version=v_version+1 WHERE id_partida=p_partida;
  INSERT INTO solicitud_operacion(clave_reintento,id_partida,tipo_operacion,hash_parametros,version_resultante)
    VALUES(p_clave,p_partida,'ATACAR',p_hash,v_version+1);
  SELECT COALESCE(MAX(orden_en_turno),0)+1 INTO v_orden FROM jugada WHERE id_turno=v_turno FOR UPDATE;
  INSERT INTO jugada(id_turno,orden_en_turno,clave_reintento) VALUES(v_turno,v_orden,p_clave); SET v_jugada=LAST_INSERT_ID();
  INSERT INTO ataque(id_jugada,id_copia_atacante,id_copia_objetivo,id_participante_objetivo,vida_previa_atacante,vida_previa_objetivo)
    VALUES(v_jugada,p_atacante,p_objetivo_copia,p_objetivo_participante,v_vida_atacante,v_vida_objetivo);
  IF (SELECT COUNT(*) FROM ataque WHERE id_jugada=v_jugada AND id_copia_atacante=p_atacante
      AND id_copia_objetivo<=>p_objetivo_copia AND id_participante_objetivo<=>p_objetivo_participante)<>1
    OR EXISTS(SELECT 1 FROM invocacion WHERE id_jugada=v_jugada) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SUBTIPO_INVALIDO: El ataque requiere exactamente su subtipo.';
  END IF;
  RELEASE SAVEPOINT ta_atacar_sp;
  SELECT p_partida AS id_partida,v_version+1 AS version_resultante,0 AS replayed;
END$$
DELIMITER ;
