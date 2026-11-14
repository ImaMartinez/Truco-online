-- SOLO para la base de ejemplos recien importada que fallo con #2014.
-- No borra, no actualiza filas existentes y no reemplaza rutinas.
-- Rechaza bases con partidas, jugadores adicionales o estructura incompleta.
USE truco_online_xampp;
DELIMITER $$
BEGIN NOT ATOMIC
 IF (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE')<>13
 OR (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE())<>20
 OR (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() AND ROUTINE_TYPE='PROCEDURE')<>9
 OR (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE())<>5 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Estructura incompleta: conservar la base y revisar el primer error de importacion.';
 END IF;
 IF (SELECT COUNT(*) FROM jugador)<>4
 OR (SELECT COUNT(*) FROM jugador WHERE alias IN ('Ana demo SQL','Bruno demo SQL','Carla demo SQL','Diego demo SQL'))<>4
 OR (SELECT COUNT(*) FROM carta)<>40
 OR (SELECT COUNT(*) FROM coleccion_jugador)<>160
 OR (SELECT COUNT(*) FROM partida)<>0
 OR EXISTS(SELECT 1 FROM mazo WHERE nombre NOT IN ('Mazo inicial 1','Mazo inicial 2','Mazo inicial 3','Mazo inicial 4','Mazo 20 · Ana','Mazo 20 · Bruno','Mazo 20 · Carla','Mazo 20 · Diego')) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La base no es una instalacion inicial de ejemplos: no se modifico; requiere revision.';
 END IF;
END$$
DELIMITER ;
START TRANSACTION;
INSERT INTO mazo(id_jugador,nombre,descripcion)
SELECT j.id_jugador,'Mazo 20 · Ana','Formato de 20 cartas para revision local.' FROM jugador j
WHERE j.alias='Ana demo SQL' AND NOT EXISTS(SELECT 1 FROM mazo m WHERE m.id_jugador=j.id_jugador AND m.nombre='Mazo 20 · Ana');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-01',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-01');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-02',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-02');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-03',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-03');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-04',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-04');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-05',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-05');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-06',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-06');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-07',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-07');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-10',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-10');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-11',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-11');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ESP-12',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo 20 · Ana' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ESP-12');
INSERT INTO mazo(id_jugador,nombre,descripcion)
SELECT j.id_jugador,'Mazo 20 · Bruno','Formato de 20 cartas para revision local.' FROM jugador j
WHERE j.alias='Bruno demo SQL' AND NOT EXISTS(SELECT 1 FROM mazo m WHERE m.id_jugador=j.id_jugador AND m.nombre='Mazo 20 · Bruno');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-01',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-01');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-02',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-02');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-03',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-03');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-04',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-04');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-05',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-05');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-06',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-06');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-07',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-07');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-10',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-10');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-11',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-11');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'BAS-12',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo 20 · Bruno' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='BAS-12');
INSERT INTO mazo(id_jugador,nombre,descripcion)
SELECT j.id_jugador,'Mazo 20 · Carla','Formato de 20 cartas para revision local.' FROM jugador j
WHERE j.alias='Carla demo SQL' AND NOT EXISTS(SELECT 1 FROM mazo m WHERE m.id_jugador=j.id_jugador AND m.nombre='Mazo 20 · Carla');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-01',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-01');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-02',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-02');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-03',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-03');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-04',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-04');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-05',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-05');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-06',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-06');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-07',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-07');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-10',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-10');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-11',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-11');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'ORO-12',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo 20 · Carla' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='ORO-12');
INSERT INTO mazo(id_jugador,nombre,descripcion)
SELECT j.id_jugador,'Mazo 20 · Diego','Formato de 20 cartas para revision local.' FROM jugador j
WHERE j.alias='Diego demo SQL' AND NOT EXISTS(SELECT 1 FROM mazo m WHERE m.id_jugador=j.id_jugador AND m.nombre='Mazo 20 · Diego');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-01',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-01');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-02',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-02');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-03',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-03');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-04',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-04');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-05',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-05');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-06',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-06');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-07',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-07');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-10',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-10');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-11',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-11');
INSERT INTO mazo_carta(id_mazo,id_carta,cantidad)
SELECT m.id_mazo,'COP-12',2 FROM mazo m JOIN jugador j USING(id_jugador)
WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo 20 · Diego' AND NOT EXISTS(SELECT 1 FROM mazo_carta mc WHERE mc.id_mazo=m.id_mazo AND mc.id_carta='COP-12');
COMMIT;
SELECT 'INSTALACION_COMPLETA_XAMPP' AS resultado,VERSION() AS servidor,DATABASE() AS base,
 (SELECT COUNT(*) FROM carta) AS cartas,(SELECT COUNT(*) FROM jugador) AS jugadores_ficticios,
 (SELECT COUNT(*) FROM mazo) AS mazos_ejemplo;
