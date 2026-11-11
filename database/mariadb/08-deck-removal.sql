-- Provisional: remove unused decks; archive used decks without breaking game history.
USE truco_arena_dev;
DELIMITER $$
DROP PROCEDURE IF EXISTS ta_eliminar_mazo$$
CREATE PROCEDURE ta_eliminar_mazo(IN p_jugador INT UNSIGNED, IN p_mazo INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_owner INT UNSIGNED;
  DECLARE v_lock INT UNSIGNED;
  DECLARE v_sp BOOLEAN DEFAULT FALSE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
    IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_eliminar; END IF;
    RESIGNAL;
  END;
  IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
  SAVEPOINT ta_eliminar; SET v_sp=TRUE;
  IF NOT EXISTS(SELECT 1 FROM jugador WHERE id_jugador=p_jugador AND fecha_archivo IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: Jugador no disponible.';
  END IF;
  SELECT id_jugador INTO v_lock FROM jugador WHERE id_jugador=p_jugador FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM mazo WHERE id_mazo=p_mazo) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_NO_ENCONTRADO: Mazo no disponible.';
  END IF;
  SELECT id_jugador INTO v_owner FROM mazo WHERE id_mazo=p_mazo FOR UPDATE;
  IF v_owner<>p_jugador THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MAZO_AJENO: El mazo pertenece a otro jugador.'; END IF;
  IF EXISTS(SELECT 1 FROM participante_partida WHERE id_mazo=p_mazo) THEN
    UPDATE mazo SET fecha_archivo=COALESCE(fecha_archivo,CURRENT_TIMESTAMP(6)) WHERE id_mazo=p_mazo;
  ELSE
    DELETE FROM mazo_carta WHERE id_mazo=p_mazo;
    DELETE FROM mazo WHERE id_mazo=p_mazo;
  END IF;
  RELEASE SAVEPOINT ta_eliminar;
  SELECT p_mazo AS id_mazo;
END$$
DELIMITER ;
