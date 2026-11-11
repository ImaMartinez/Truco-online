-- Formato de juego de 20 cartas. Conserva los mazos y partidas clásicos de 12.
USE truco_arena_dev;
ALTER TABLE copia_carta_partida DROP CONSTRAINT ck_copia_posicion,
  ADD CONSTRAINT ck_copia_posicion CHECK (posicion_original BETWEEN 1 AND 20);
DELIMITER $$
DROP PROCEDURE IF EXISTS ta_validar_mazo$$
CREATE PROCEDURE ta_validar_mazo(IN p_mazo INT UNSIGNED, IN p_exacto BOOLEAN)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_total INT;
  SELECT COALESCE(SUM(cantidad),0) INTO v_total FROM mazo_carta WHERE id_mazo=p_mazo;
  IF v_total>20 OR (p_exacto AND v_total NOT IN (12,20)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_INVALIDO: El mazo debe tener 20 cartas (o clásico de 12), y nunca superar 20.'; END IF;
  IF EXISTS(SELECT 1 FROM mazo_carta mc JOIN mazo m ON m.id_mazo=mc.id_mazo
    LEFT JOIN coleccion_jugador c ON c.id_jugador=m.id_jugador AND c.id_carta=mc.id_carta
    WHERE mc.id_mazo=p_mazo AND (c.cantidad IS NULL OR mc.cantidad>c.cantidad)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='COLECCION_INSUFICIENTE: El dueño no posee las copias seleccionadas.';
  END IF;
END$$
DROP PROCEDURE IF EXISTS ta_guardar_mazo$$
CREATE PROCEDURE ta_guardar_mazo(IN p_jugador INT UNSIGNED, IN p_id INT UNSIGNED, IN p_nombre VARCHAR(60), IN p_descripcion VARCHAR(200), IN p_entries LONGTEXT)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_id INT UNSIGNED;
  DECLARE v_owner INT UNSIGNED DEFAULT NULL;
  DECLARE v_lock INT UNSIGNED;
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_card VARCHAR(100);
  DECLARE v_qty INT;
  DECLARE v_sp BOOLEAN DEFAULT FALSE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
    IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_mazo; END IF; RESIGNAL;
  END;
  IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
  SAVEPOINT ta_mazo; SET v_sp=TRUE;
  IF NOT EXISTS(SELECT 1 FROM jugador WHERE id_jugador=p_jugador AND fecha_archivo IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: Jugador no disponible.'; END IF;
  SELECT id_jugador INTO v_lock FROM jugador WHERE id_jugador=p_jugador FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM jugador WHERE id_jugador=p_jugador AND fecha_archivo IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: Jugador no disponible.'; END IF;
  IF p_nombre IS NULL OR CHAR_LENGTH(TRIM(p_nombre))<1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_INVALIDO: El nombre es obligatorio.'; END IF;
  IF p_entries IS NULL OR NOT JSON_VALID(p_entries) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_INVALIDO: Composición JSON inválida.'; END IF;
  IF JSON_TYPE(p_entries)<>'ARRAY' OR JSON_LENGTH(p_entries)>20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_INVALIDO: La composición debe ser un arreglo de hasta 20 tipos.'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO mazo(id_jugador,nombre,descripcion) VALUES(p_jugador,TRIM(p_nombre),COALESCE(p_descripcion,'')); SET v_id=LAST_INSERT_ID();
  ELSE
    IF NOT EXISTS(SELECT 1 FROM mazo WHERE id_mazo=p_id AND fecha_archivo IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_NO_ENCONTRADO: Mazo no disponible.'; END IF;
    SELECT id_jugador INTO v_owner FROM mazo WHERE id_mazo=p_id FOR UPDATE;
    IF v_owner<>p_jugador THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_AJENO: El mazo pertenece a otro jugador.'; END IF;
    IF EXISTS(SELECT 1 FROM mazo WHERE id_mazo=p_id AND fecha_archivo IS NOT NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_NO_ENCONTRADO: Mazo archivado.'; END IF;
    IF EXISTS(SELECT 1 FROM participante_partida WHERE id_mazo=p_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_UTILIZADO: Duplicá el mazo usado para editarlo.'; END IF;
    SET v_id=p_id;
    UPDATE mazo SET nombre=TRIM(p_nombre),descripcion=COALESCE(p_descripcion,'') WHERE id_mazo=v_id;
    DELETE FROM mazo_carta WHERE id_mazo=v_id;
  END IF;
  WHILE v_i<JSON_LENGTH(p_entries) DO
    IF JSON_TYPE(JSON_EXTRACT(p_entries,CONCAT('$[',v_i,'].cardId')))<>'STRING'
      OR COALESCE(JSON_TYPE(JSON_EXTRACT(p_entries,CONCAT('$[',v_i,'].quantity'))),'NULL')<>'INTEGER' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_INVALIDO: Cada carta requiere código y cantidad entera.';
    END IF;
    SET v_card=JSON_UNQUOTE(JSON_EXTRACT(p_entries,CONCAT('$[',v_i,'].cardId')));
    SET v_qty=CAST(JSON_UNQUOTE(JSON_EXTRACT(p_entries,CONCAT('$[',v_i,'].quantity'))) AS SIGNED);
    IF v_card IS NULL OR CHAR_LENGTH(v_card)<>6 OR NOT EXISTS(SELECT 1 FROM carta WHERE id_carta=v_card) OR v_qty NOT BETWEEN 1 AND 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_INVALIDO: Carta inexistente o cantidad fuera de 1-2.'; END IF;
    INSERT INTO mazo_carta(id_mazo,id_carta,cantidad) VALUES(v_id,v_card,v_qty);
    SET v_i=v_i+1;
  END WHILE;
  CALL ta_validar_mazo(v_id,FALSE);
  RELEASE SAVEPOINT ta_mazo;
  SELECT v_id AS id_mazo;
END$$
DROP PROCEDURE IF EXISTS ta_iniciar_partida$$
CREATE PROCEDURE ta_iniciar_partida(IN p_clave CHAR(36),IN p_hash CHAR(64),IN p_jugador1 INT UNSIGNED,IN p_mazo1 INT UNSIGNED,IN p_jugador2 INT UNSIGNED,IN p_mazo2 INT UNSIGNED)
SQL SECURITY DEFINER
main: BEGIN
  DECLARE v_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_hash CHAR(64); DECLARE v_tipo VARCHAR(20); DECLARE v_version INT;
  DECLARE v_lock INT; DECLARE v_swap BOOLEAN;
  DECLARE v_size INT; DECLARE v_side INT DEFAULT 1; DECLARE v_deck INT; DECLARE v_part INT; DECLARE v_pos INT;
  DECLARE v_card CHAR(6); DECLARE v_done BOOLEAN DEFAULT FALSE; DECLARE v_sp BOOLEAN DEFAULT FALSE;
  DECLARE copies CURSOR FOR SELECT mc.id_carta FROM mazo_carta mc JOIN (SELECT 1 AS n UNION ALL SELECT 2) s ON s.n<=mc.cantidad WHERE mc.id_mazo=v_deck ORDER BY RAND();
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
    IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_inicio; END IF; RESIGNAL;
  END;
  IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
  SAVEPOINT ta_inicio; SET v_sp=TRUE;
  IF p_clave IS NULL OR p_hash IS NULL OR p_clave NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_hash NOT REGEXP '^[0-9a-f]{64}$' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SOLICITUD_INVALIDA: Clave o huella inválida.'; END IF;
  SELECT id_partida,hash_parametros,tipo_operacion,version_resultante INTO v_id,v_hash,v_tipo,v_version FROM solicitud_operacion WHERE clave_reintento=p_clave FOR UPDATE;
  IF v_id IS NOT NULL THEN
    IF v_hash<>p_hash OR v_tipo<>'CREAR_PARTIDA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CLAVE_REUTILIZADA: La clave corresponde a otro comando.'; END IF;
    RELEASE SAVEPOINT ta_inicio; SELECT v_id AS id_partida,v_version AS version_resultante,1 AS replayed; LEAVE main;
  END IF;
  IF p_jugador1=p_jugador2 OR p_jugador1 IS NULL OR p_jugador2 IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADORES_INVALIDOS: Se necesitan dos jugadores distintos.'; END IF;
  IF (SELECT COUNT(*) FROM jugador WHERE id_jugador IN(p_jugador1,p_jugador2) AND fecha_archivo IS NULL)<>2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: Jugador no disponible.'; END IF;
  SELECT id_jugador INTO v_lock FROM jugador WHERE id_jugador=LEAST(p_jugador1,p_jugador2) FOR UPDATE;
  SELECT id_jugador INTO v_lock FROM jugador WHERE id_jugador=GREATEST(p_jugador1,p_jugador2) FOR UPDATE;
  SET v_id=NULL;
  SELECT id_partida,hash_parametros,tipo_operacion,version_resultante INTO v_id,v_hash,v_tipo,v_version FROM solicitud_operacion WHERE clave_reintento=p_clave FOR UPDATE;
  IF v_id IS NOT NULL THEN
    IF v_hash<>p_hash OR v_tipo<>'CREAR_PARTIDA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CLAVE_REUTILIZADA: La clave corresponde a otro comando.'; END IF;
    RELEASE SAVEPOINT ta_inicio; SELECT v_id AS id_partida,v_version AS version_resultante,1 AS replayed; LEAVE main;
  END IF;
  IF (SELECT COUNT(*) FROM jugador WHERE id_jugador IN(p_jugador1,p_jugador2) AND fecha_archivo IS NULL)<>2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: Jugador no disponible.'; END IF;
  IF EXISTS(SELECT 1 FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo JOIN partida p ON p.id_partida=pp.id_partida WHERE m.id_jugador IN(p_jugador1,p_jugador2) AND p.fecha_fin IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PARTIDA_ACTIVA: Un jugador ya tiene una partida activa.'; END IF;
  IF (SELECT COUNT(*) FROM mazo WHERE (id_mazo=p_mazo1 AND id_jugador=p_jugador1 OR id_mazo=p_mazo2 AND id_jugador=p_jugador2) AND fecha_archivo IS NULL)<>2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_AJENO: Elegí un mazo habilitado de cada dueño.'; END IF;
  SELECT id_mazo INTO v_lock FROM mazo WHERE id_mazo=LEAST(p_mazo1,p_mazo2) FOR UPDATE;
  SELECT id_mazo INTO v_lock FROM mazo WHERE id_mazo=GREATEST(p_mazo1,p_mazo2) FOR UPDATE;
  IF (SELECT COUNT(*) FROM mazo WHERE ((id_mazo=p_mazo1 AND id_jugador=p_jugador1) OR (id_mazo=p_mazo2 AND id_jugador=p_jugador2)) AND fecha_archivo IS NULL)<>2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_AJENO: Elegí un mazo habilitado de cada dueño.'; END IF;
  CALL ta_validar_mazo(p_mazo1,TRUE); CALL ta_validar_mazo(p_mazo2,TRUE);
  SELECT SUM(cantidad) INTO v_size FROM mazo_carta WHERE id_mazo=p_mazo1;
  IF v_size<>(SELECT SUM(cantidad) FROM mazo_carta WHERE id_mazo=p_mazo2) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_INVALIDO: Ambos jugadores deben usar mazos del mismo tamaño.'; END IF;
  INSERT INTO partida(version) VALUES(1); SET v_id=LAST_INSERT_ID(); SET v_swap=RAND()<0.5;
  WHILE v_side<=2 DO
    SET v_deck=IF((v_side=1 AND NOT v_swap) OR (v_side=2 AND v_swap),p_mazo1,p_mazo2);
    INSERT INTO participante_partida(id_partida,posicion,id_mazo,vida_heroe) VALUES(v_id,v_side,v_deck,20); SET v_part=LAST_INSERT_ID();
    SET v_pos=0; SET v_done=FALSE; OPEN copies;
    copy_loop: LOOP
      FETCH copies INTO v_card; IF v_done THEN LEAVE copy_loop; END IF;
      SET v_pos=v_pos+1;
      INSERT INTO copia_carta_partida(id_participante,id_carta,posicion_original,zona,vida_actual) VALUES(v_part,v_card,v_pos,IF(v_pos<=3,'MANO','MAZO'),NULL);
    END LOOP; CLOSE copies;
    IF v_pos<>v_size OR EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=v_deck AND mc.cantidad<>(SELECT COUNT(*) FROM copia_carta_partida c WHERE c.id_participante=v_part AND c.id_carta=mc.id_carta))
      OR EXISTS(SELECT 1 FROM copia_carta_partida c WHERE c.id_participante=v_part AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=v_deck AND mc.id_carta=c.id_carta)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='COMPOSICION_INVALIDA: Las copias no corresponden exactamente al mazo.'; END IF;
    SET v_side=v_side+1;
  END WHILE;
  IF (SELECT COUNT(*) FROM participante_partida WHERE id_partida=v_id)<>2
    OR (SELECT COUNT(*) FROM copia_carta_partida c JOIN participante_partida pp ON pp.id_participante=c.id_participante WHERE pp.id_partida=v_id)<>2*v_size THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INICIO_INVALIDO: Se requieren dos participantes y exactamente dos copias individuales por posición del mazo.';
  END IF;
  INSERT INTO turno(id_partida,numero_global,energia_disponible) VALUES(v_id,1,1);
  INSERT INTO solicitud_operacion(clave_reintento,id_partida,tipo_operacion,hash_parametros,version_resultante) VALUES(p_clave,v_id,'CREAR_PARTIDA',p_hash,1);
  RELEASE SAVEPOINT ta_inicio;
  SELECT v_id AS id_partida,1 AS version_resultante,0 AS replayed;
END$$
DELIMITER ;
