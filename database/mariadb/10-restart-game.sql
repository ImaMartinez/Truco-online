-- Administrative restart, not a game victory or draw. Existing history is preserved.
USE truco_arena_dev;
ALTER TABLE partida DROP CONSTRAINT ck_partida_motivo,
  ADD CONSTRAINT ck_partida_motivo CHECK (motivo_cierre IS NULL OR motivo_cierre IN ('VIDA_CERO','LIMITE_TURNOS','REINICIO'));
ALTER TABLE partida ADD CONSTRAINT IF NOT EXISTS ck_partida_reinicio CHECK (motivo_cierre<>'REINICIO' OR ganador_posicion IS NULL);
DELIMITER $$
DROP PROCEDURE IF EXISTS ta_reiniciar_partida$$
CREATE PROCEDURE ta_reiniciar_partida(IN p_clave CHAR(36),IN p_hash CHAR(64),IN p_jugador1 INT UNSIGNED,IN p_mazo1 INT UNSIGNED,IN p_jugador2 INT UNSIGNED,IN p_mazo2 INT UNSIGNED)
SQL SECURITY DEFINER
main: BEGIN
 DECLARE v_lock INT UNSIGNED;
 DECLARE v_now DATETIME(6);
 DECLARE v_sp BOOLEAN DEFAULT FALSE;
 DECLARE v_receipt CHAR(36) DEFAULT NULL;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_receipt=NULL;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
  IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_reinicio; END IF;
  RESIGNAL;
 END;
 IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
 SAVEPOINT ta_reinicio; SET v_sp=TRUE;
 IF p_clave IS NULL OR p_hash IS NULL OR p_clave NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_hash NOT REGEXP '^[0-9a-f]{64}$' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SOLICITUD_INVALIDA: Clave o huella inválida.';
 END IF;
 -- A replay must never close the newly created match (or a later match).
 SELECT clave_reintento INTO v_receipt FROM solicitud_operacion WHERE clave_reintento=p_clave FOR UPDATE;
 IF v_receipt IS NOT NULL THEN
  CALL ta_iniciar_partida(p_clave,p_hash,p_jugador1,p_mazo1,p_jugador2,p_mazo2);RELEASE SAVEPOINT ta_reinicio;LEAVE main;
 END IF;
 IF p_jugador1 IS NULL OR p_jugador2 IS NULL OR p_jugador1=p_jugador2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: Elegí dos jugadores distintos.'; END IF;
 IF (SELECT COUNT(*) FROM jugador WHERE id_jugador IN(p_jugador1,p_jugador2) AND fecha_archivo IS NULL)<>2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: Jugadores no disponibles.'; END IF;
 SELECT id_jugador INTO v_lock FROM jugador WHERE id_jugador=LEAST(p_jugador1,p_jugador2) FOR UPDATE;
 SELECT id_jugador INTO v_lock FROM jugador WHERE id_jugador=GREATEST(p_jugador1,p_jugador2) FOR UPDATE;
 SELECT clave_reintento INTO v_receipt FROM solicitud_operacion WHERE clave_reintento=p_clave FOR UPDATE;
 IF v_receipt IS NOT NULL THEN
  CALL ta_iniciar_partida(p_clave,p_hash,p_jugador1,p_mazo1,p_jugador2,p_mazo2);RELEASE SAVEPOINT ta_reinicio;LEAVE main;
 END IF;
 SET v_now=CURRENT_TIMESTAMP(6);
 UPDATE partida SET fecha_fin=v_now,motivo_cierre='REINICIO',ganador_posicion=NULL,version=version+1
 WHERE fecha_fin IS NULL AND EXISTS(SELECT 1 FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo WHERE pp.id_partida=partida.id_partida AND m.id_jugador IN(p_jugador1,p_jugador2)) ORDER BY id_partida;
 UPDATE turno t JOIN partida p ON p.id_partida=t.id_partida SET t.fecha_cierre=v_now
 WHERE t.fecha_cierre IS NULL AND p.motivo_cierre='REINICIO' AND p.fecha_fin=v_now
 AND EXISTS(SELECT 1 FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo WHERE pp.id_partida=p.id_partida AND m.id_jugador IN(p_jugador1,p_jugador2));
 -- Any failure below rolls back both the administrative closure and the new match.
 CALL ta_iniciar_partida(p_clave,p_hash,p_jugador1,p_mazo1,p_jugador2,p_mazo2);
 RELEASE SAVEPOINT ta_reinicio;
END$$
DELIMITER ;
