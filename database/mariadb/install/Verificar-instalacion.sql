-- SOLO LECTURA. Ejecutar despues de importar TrucoOnline-XAMPP.sql.
USE truco_online_xampp;
SELECT VERSION() AS servidor,DATABASE() AS base;
SELECT COUNT(*) AS tablas_esperadas_13 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE';
SELECT COUNT(*) AS relaciones_fk_esperadas_20 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE();
SELECT COUNT(*) AS procedimientos_esperados_9 FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() AND ROUTINE_TYPE='PROCEDURE';
SELECT COUNT(*) AS triggers_esperados_5 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE();
SELECT COUNT(*) AS cartas_esperadas_40 FROM carta;
SELECT palo,COUNT(*) AS cartas_por_palo FROM carta GROUP BY palo;
SELECT j.alias,m.nombre,SUM(mc.cantidad) AS cartas FROM mazo m JOIN jugador j USING(id_jugador) JOIN mazo_carta mc USING(id_mazo) GROUP BY j.alias,m.id_mazo,m.nombre ORDER BY j.alias,cartas;
SELECT COUNT(*) AS colecciones_esperadas_160 FROM v_coleccion_jugador;
SELECT COUNT(*) AS partidas_iniciales_0 FROM partida;
