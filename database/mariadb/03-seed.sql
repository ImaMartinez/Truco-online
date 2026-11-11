-- Generado desde catalog.json; no modifica estadísticas existentes. B1-B4 pendientes.
USE truco_arena_dev;
SET NAMES utf8mb4 COLLATE utf8mb4_bin;
START TRANSACTION;
INSERT IGNORE INTO carta(id_carta,nombre,palo,numero,ataque_base,vida_base,costo_energia,jerarquia_truco) VALUES
('ESP-01','Ancho de espadas','espadas',1,6,5,5,1),
('ESP-02','Dos de espadas','espadas',2,3,2,2,6),
('ESP-03','Tres de espadas','espadas',3,4,3,3,5),
('ESP-04','Cuatro de espadas','espadas',4,1,2,1,14),
('ESP-05','Cinco de espadas','espadas',5,2,1,1,13),
('ESP-06','Seis de espadas','espadas',6,2,3,2,12),
('ESP-07','Siete de espadas','espadas',7,5,4,4,3),
('ESP-10','Diez de espadas','espadas',10,4,1,2,10),
('ESP-11','Once de espadas','espadas',11,5,2,3,9),
('ESP-12','Doce de espadas','espadas',12,6,3,4,8),
('BAS-01','Ancho de bastos','bastos',1,5,6,5,2),
('BAS-02','Dos de bastos','bastos',2,2,3,2,6),
('BAS-03','Tres de bastos','bastos',3,3,4,3,5),
('BAS-04','Cuatro de bastos','bastos',4,2,1,1,14),
('BAS-05','Cinco de bastos','bastos',5,1,2,1,13),
('BAS-06','Seis de bastos','bastos',6,1,4,2,12),
('BAS-07','Siete de bastos','bastos',7,2,3,2,11),
('BAS-10','Diez de bastos','bastos',10,1,4,2,10),
('BAS-11','Once de bastos','bastos',11,2,5,3,9),
('BAS-12','Doce de bastos','bastos',12,3,6,4,8),
('ORO-01','Ancho de oros','oros',1,4,3,3,7),
('ORO-02','Dos de oros','oros',2,3,2,2,6),
('ORO-03','Tres de oros','oros',3,4,3,3,5),
('ORO-04','Cuatro de oros','oros',4,1,2,1,14),
('ORO-05','Cinco de oros','oros',5,2,1,1,13),
('ORO-06','Seis de oros','oros',6,3,2,2,12),
('ORO-07','Siete de oros','oros',7,4,5,4,4),
('ORO-10','Diez de oros','oros',10,3,2,2,10),
('ORO-11','Once de oros','oros',11,4,3,3,9),
('ORO-12','Doce de oros','oros',12,5,4,4,8),
('COP-01','Ancho de copas','copas',1,3,4,3,7),
('COP-02','Dos de copas','copas',2,2,3,2,6),
('COP-03','Tres de copas','copas',3,3,4,3,5),
('COP-04','Cuatro de copas','copas',4,2,1,1,14),
('COP-05','Cinco de copas','copas',5,1,2,1,13),
('COP-06','Seis de copas','copas',6,2,3,2,12),
('COP-07','Siete de copas','copas',7,1,4,2,11),
('COP-10','Diez de copas','copas',10,2,3,2,10),
('COP-11','Once de copas','copas',11,3,4,3,9),
('COP-12','Doce de copas','copas',12,4,5,4,8);
INSERT IGNORE INTO jugador(alias) VALUES('Ana demo SQL');
INSERT IGNORE INTO coleccion_jugador(id_jugador,id_carta,cantidad) SELECT j.id_jugador,c.id_carta,2 FROM jugador j CROSS JOIN carta c WHERE j.alias='Ana demo SQL';
INSERT IGNORE INTO mazo(id_jugador,nombre,descripcion) SELECT id_jugador,'Mazo inicial 1','Datos iniciales de desarrollo' FROM jugador WHERE alias='Ana demo SQL';
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-01',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo inicial 1' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-02',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo inicial 1' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-03',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo inicial 1' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-04',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo inicial 1' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-05',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo inicial 1' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-06',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Ana demo SQL' AND m.nombre='Mazo inicial 1' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO jugador(alias) VALUES('Bruno demo SQL');
INSERT IGNORE INTO coleccion_jugador(id_jugador,id_carta,cantidad) SELECT j.id_jugador,c.id_carta,2 FROM jugador j CROSS JOIN carta c WHERE j.alias='Bruno demo SQL';
INSERT IGNORE INTO mazo(id_jugador,nombre,descripcion) SELECT id_jugador,'Mazo inicial 2','Datos iniciales de desarrollo' FROM jugador WHERE alias='Bruno demo SQL';
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-07',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo inicial 2' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-10',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo inicial 2' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-11',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo inicial 2' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ESP-12',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo inicial 2' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-01',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo inicial 2' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-02',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Bruno demo SQL' AND m.nombre='Mazo inicial 2' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO jugador(alias) VALUES('Carla demo SQL');
INSERT IGNORE INTO coleccion_jugador(id_jugador,id_carta,cantidad) SELECT j.id_jugador,c.id_carta,2 FROM jugador j CROSS JOIN carta c WHERE j.alias='Carla demo SQL';
INSERT IGNORE INTO mazo(id_jugador,nombre,descripcion) SELECT id_jugador,'Mazo inicial 3','Datos iniciales de desarrollo' FROM jugador WHERE alias='Carla demo SQL';
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-03',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo inicial 3' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-04',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo inicial 3' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-05',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo inicial 3' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-06',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo inicial 3' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-07',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo inicial 3' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-10',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Carla demo SQL' AND m.nombre='Mazo inicial 3' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO jugador(alias) VALUES('Diego demo SQL');
INSERT IGNORE INTO coleccion_jugador(id_jugador,id_carta,cantidad) SELECT j.id_jugador,c.id_carta,2 FROM jugador j CROSS JOIN carta c WHERE j.alias='Diego demo SQL';
INSERT IGNORE INTO mazo(id_jugador,nombre,descripcion) SELECT id_jugador,'Mazo inicial 4','Datos iniciales de desarrollo' FROM jugador WHERE alias='Diego demo SQL';
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-11',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo inicial 4' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'BAS-12',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo inicial 4' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ORO-01',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo inicial 4' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ORO-02',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo inicial 4' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ORO-03',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo inicial 4' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,'ORO-04',2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias='Diego demo SQL' AND m.nombre='Mazo inicial 4' AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);
COMMIT;
