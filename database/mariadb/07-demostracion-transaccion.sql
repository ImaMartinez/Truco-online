-- Ejecutar solo sobre el fixture reservado de desarrollo. No cambia el motor.
-- Para evidencia completa de COMMIT/ROLLBACK e instalación aislada: npm run db:audit.
USE truco_arena_dev;
SELECT p.id_partida,m.id_jugador,p.version,c.id_copia
INTO @demo_partida,@demo_actor,@demo_version,@demo_copia
FROM partida p JOIN turno t ON t.id_partida=p.id_partida AND t.fecha_cierre IS NULL
JOIN participante_partida pp ON pp.id_partida=p.id_partida AND pp.posicion=IF(MOD(t.numero_global,2)=1,1,2)
JOIN mazo m ON m.id_mazo=pp.id_mazo
JOIN copia_carta_partida c ON c.id_participante=pp.id_participante
JOIN carta ca ON ca.id_carta=c.id_carta
WHERE m.nombre LIKE 'Academia TA v1 Mazo %' AND p.fecha_fin IS NULL
AND c.zona='MANO' AND ca.costo_energia<=t.energia_disponible
AND (SELECT COUNT(*) FROM copia_carta_partida f WHERE f.id_participante=pp.id_participante AND f.zona='CAMPO')<3
ORDER BY ca.costo_energia,c.id_copia LIMIT 1;
SELECT 'ANTES' etapa,c.id_copia,c.zona,c.vida_actual,p.version,t.energia_disponible
FROM copia_carta_partida c JOIN partida p ON p.id_partida=@demo_partida
JOIN turno t ON t.id_partida=p.id_partida AND t.fecha_cierre IS NULL WHERE c.id_copia=@demo_copia;
DELIMITER $$
DROP PROCEDURE IF EXISTS ta_demo_rollback$$
CREATE PROCEDURE ta_demo_rollback()
BEGIN
 DECLARE v_error TEXT;
 DECLARE EXIT HANDLER FOR SQLSTATE '45000'
 BEGIN
  GET DIAGNOSTICS CONDITION 1 v_error=MESSAGE_TEXT;
  ROLLBACK;
  IF v_error<>'ERROR CONTROLADO DESPUES DEL CALL EXITOSO' THEN RESIGNAL; END IF;
  SELECT 'ROLLBACK TRAS ERROR CONTROLADO' etapa,c.id_copia,c.zona,c.vida_actual,p.version,t.energia_disponible
  FROM copia_carta_partida c JOIN partida p ON p.id_partida=@demo_partida
  JOIN turno t ON t.id_partida=p.id_partida AND t.fecha_cierre IS NULL WHERE c.id_copia=@demo_copia;
 END;
 IF @demo_copia IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='No hay fixture apto; ejecutar db:install.'; END IF;
 START TRANSACTION;
 CALL ta_invocar(UUID(),SHA2('demostracion rollback academica',256),@demo_partida,@demo_actor,@demo_version,@demo_copia);
 SELECT 'CAMBIO PARCIAL VISIBLE EN LA TRANSACCION' etapa,c.id_copia,c.zona,c.vida_actual,p.version,t.energia_disponible
 FROM copia_carta_partida c JOIN partida p ON p.id_partida=@demo_partida
 JOIN turno t ON t.id_partida=p.id_partida AND t.fecha_cierre IS NULL WHERE c.id_copia=@demo_copia;
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ERROR CONTROLADO DESPUES DEL CALL EXITOSO';
END$$
DELIMITER ;
CALL ta_demo_rollback();
DROP PROCEDURE ta_demo_rollback;
