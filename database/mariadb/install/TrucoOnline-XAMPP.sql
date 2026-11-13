-- TRUCOONLINE PARA XAMPP / MariaDB 10.4.32 o posterior (NO PostgreSQL).
-- Generado: node scripts/build-xampp-install.mjs
-- Instalar UNA VEZ como administrador en una instancia LOCAL de MariaDB.
-- Crea la base NUEVA truco_online_xampp; no debe existir previamente.
-- Importar desde phpMyAdmin > Inicio del servidor > Importar, formato SQL, UTF-8.
-- Alternativa CMD: C:\xampp\mysql\bin\mysql.exe -u root -p --default-character-set=utf8mb4 < TrucoOnline-XAMPP.sql
-- No usar --force ni continuar despues de un error. No borra bases ni crea cuentas.
-- Incluye: 13 tablas academicas, 40 cartas originales, 4 jugadores FICTICIOS,
-- 8 mazos de ejemplo (4 de 12 y 4 de 20), motor SQL, triggers y vista de coleccion.
-- NO equivale a las 16 tablas y servicios operativos de Supabase.
-- No incluye Auth/JWT, recuperacion, salas online, Cron ni worker CPU autonomo.
-- Las rutinas requieren START TRANSACTION / COMMIT del coordinador.
-- MariaDB hace commit implicito de DDL: este instalador NO es una transaccion global.
-- Si falla, conservar el error y revisar la base parcial antes de volver a importar.
-- B1-B4 academicos pendientes. Sin datos de personas ni credenciales de produccion.

-- Truco Arena: implementation PROVISIONAL. B1-B4 remain pending.
-- Base NUEVA de entrega XAMPP. CREATE DATABASE falla si ya existe; no usar --force.
CREATE DATABASE truco_online_xampp CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
USE truco_online_xampp;
SET NAMES utf8mb4 COLLATE utf8mb4_bin;
SET time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION';

CREATE TABLE jugador (
  id_jugador INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alias VARCHAR(40) NOT NULL,
  fecha_alta DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  fecha_archivo DATETIME(6) NULL,
  PRIMARY KEY (id_jugador), UNIQUE KEY uq_jugador_alias (alias),
  CONSTRAINT ck_jugador_alias CHECK (CHAR_LENGTH(TRIM(alias)) BETWEEN 1 AND 40 AND CHAR_LENGTH(alias)=CHAR_LENGTH(TRIM(alias))),
  CONSTRAINT ck_jugador_archivo CHECK (fecha_archivo IS NULL OR fecha_archivo>=fecha_alta)
) ENGINE=InnoDB;

CREATE TABLE carta (
  id_carta CHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  palo VARCHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  numero TINYINT UNSIGNED NOT NULL,
  ataque_base TINYINT UNSIGNED NOT NULL,
  vida_base TINYINT UNSIGNED NOT NULL,
  costo_energia TINYINT UNSIGNED NOT NULL,
  jerarquia_truco TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_carta), UNIQUE KEY uq_carta_palo_numero (palo,numero),
  CONSTRAINT ck_carta_nombre CHECK (CHAR_LENGTH(TRIM(nombre))>0 AND CHAR_LENGTH(nombre)=CHAR_LENGTH(TRIM(nombre))),
  CONSTRAINT ck_carta_palo CHECK (palo IN ('espadas','bastos','oros','copas')),
  CONSTRAINT ck_carta_numero CHECK (numero IN (1,2,3,4,5,6,7,10,11,12)),
  CONSTRAINT ck_carta_ataque CHECK (ataque_base>0),
  CONSTRAINT ck_carta_vida CHECK (vida_base>0),
  CONSTRAINT ck_carta_costo CHECK (costo_energia BETWEEN 1 AND 5),
  CONSTRAINT ck_carta_jerarquia CHECK (jerarquia_truco BETWEEN 1 AND 14),
  CONSTRAINT ck_carta_codigo CHECK (id_carta REGEXP '^(ESP|BAS|ORO|COP)-(0[1-7]|1[012])$'),
  CONSTRAINT ck_carta_codigo_tipo CHECK (
    LEFT(id_carta,3)=CASE palo WHEN 'espadas' THEN 'ESP' WHEN 'bastos' THEN 'BAS' WHEN 'oros' THEN 'ORO' ELSE 'COP' END
    AND CAST(RIGHT(id_carta,2) AS UNSIGNED)=numero)
) ENGINE=InnoDB;

CREATE TABLE coleccion_jugador (
  id_jugador INT UNSIGNED NOT NULL,
  id_carta CHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  cantidad SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_jugador,id_carta),
  KEY ix_coleccion_carta (id_carta),
  CONSTRAINT fk_coleccion_jugador FOREIGN KEY (id_jugador) REFERENCES jugador(id_jugador) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_coleccion_carta FOREIGN KEY (id_carta) REFERENCES carta(id_carta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_coleccion_cantidad CHECK (cantidad>0)
) ENGINE=InnoDB;

CREATE TABLE mazo (
  id_mazo INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_jugador INT UNSIGNED NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(200) NOT NULL DEFAULT '',
  fecha_creacion DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  fecha_archivo DATETIME(6) NULL,
  PRIMARY KEY (id_mazo), UNIQUE KEY uq_mazo_dueno_nombre (id_jugador,nombre),
  CONSTRAINT fk_mazo_jugador FOREIGN KEY (id_jugador) REFERENCES jugador(id_jugador) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_mazo_nombre CHECK (CHAR_LENGTH(TRIM(nombre))>0 AND CHAR_LENGTH(nombre)=CHAR_LENGTH(TRIM(nombre))),
  CONSTRAINT ck_mazo_archivo CHECK (fecha_archivo IS NULL OR fecha_archivo>=fecha_creacion)
) ENGINE=InnoDB;

CREATE TABLE mazo_carta (
  id_mazo INT UNSIGNED NOT NULL,
  id_carta CHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  cantidad TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_mazo,id_carta), KEY ix_mazocarta_carta (id_carta),
  CONSTRAINT fk_mazocarta_mazo FOREIGN KEY (id_mazo) REFERENCES mazo(id_mazo) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_mazocarta_carta FOREIGN KEY (id_carta) REFERENCES carta(id_carta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_mazocarta_cantidad CHECK (cantidad BETWEEN 1 AND 2)
) ENGINE=InnoDB;

CREATE TABLE partida (
  id_partida INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha_inicio DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  fecha_fin DATETIME(6) NULL,
  motivo_cierre VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ganador_posicion TINYINT UNSIGNED NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id_partida), KEY ix_partida_abierta (fecha_fin,id_partida),
  CONSTRAINT ck_partida_version CHECK (version>=1),
  CONSTRAINT ck_partida_ganador CHECK (ganador_posicion IS NULL OR ganador_posicion IN (1,2)),
  CONSTRAINT ck_partida_motivo CHECK (motivo_cierre IS NULL OR motivo_cierre IN ('VIDA_CERO','LIMITE_TURNOS','REINICIO')),
  CONSTRAINT ck_partida_reinicio CHECK (motivo_cierre<>'REINICIO' OR ganador_posicion IS NULL),
  CONSTRAINT ck_partida_cierre CHECK (
    (fecha_fin IS NULL AND motivo_cierre IS NULL AND ganador_posicion IS NULL) OR
    (fecha_fin IS NOT NULL AND fecha_fin>=fecha_inicio AND motivo_cierre IS NOT NULL
      AND (motivo_cierre<>'VIDA_CERO' OR ganador_posicion IS NOT NULL)))
) ENGINE=InnoDB;

CREATE TABLE participante_partida (
  id_participante INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_partida INT UNSIGNED NOT NULL,
  posicion TINYINT UNSIGNED NOT NULL,
  id_mazo INT UNSIGNED NOT NULL,
  vida_heroe TINYINT UNSIGNED NOT NULL DEFAULT 20,
  PRIMARY KEY (id_participante),
  UNIQUE KEY uq_participante_posicion (id_partida,posicion),
  UNIQUE KEY uq_participante_mazo (id_partida,id_mazo),
  KEY ix_participante_mazo (id_mazo,id_partida),
  CONSTRAINT fk_participante_partida FOREIGN KEY (id_partida) REFERENCES partida(id_partida) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_participante_mazo FOREIGN KEY (id_mazo) REFERENCES mazo(id_mazo) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_participante_posicion CHECK (posicion IN (1,2)),
  CONSTRAINT ck_participante_vida CHECK (vida_heroe BETWEEN 0 AND 20)
) ENGINE=InnoDB;

-- The only cycle is the optional winner. Add this FK once both tables exist.
SET @ta_fk_ddl = IF((SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='truco_online_xampp' AND CONSTRAINT_NAME='fk_partida_ganador')=0,
  'ALTER TABLE truco_online_xampp.partida ADD CONSTRAINT fk_partida_ganador FOREIGN KEY (id_partida,ganador_posicion) REFERENCES truco_online_xampp.participante_partida(id_partida,posicion) ON DELETE RESTRICT ON UPDATE RESTRICT',
  'DO 0');
PREPARE ta_stmt FROM @ta_fk_ddl;
EXECUTE ta_stmt;
DEALLOCATE PREPARE ta_stmt;

CREATE TABLE copia_carta_partida (
  id_copia INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_participante INT UNSIGNED NOT NULL,
  id_carta CHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  posicion_original TINYINT UNSIGNED NOT NULL,
  zona VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  vida_actual TINYINT UNSIGNED NULL,
  PRIMARY KEY (id_copia), UNIQUE KEY uq_copia_posicion (id_participante,posicion_original),
  KEY ix_copia_zona (id_participante,zona,posicion_original), KEY ix_copia_carta (id_carta),
  CONSTRAINT fk_copia_participante FOREIGN KEY (id_participante) REFERENCES participante_partida(id_participante) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_copia_carta FOREIGN KEY (id_carta) REFERENCES carta(id_carta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_copia_posicion CHECK (posicion_original BETWEEN 1 AND 20),
  CONSTRAINT ck_copia_zona CHECK (zona IN ('MAZO','MANO','CAMPO','DESCARTE')),
  CONSTRAINT ck_copia_vida_zona CHECK (
    (zona IN ('MAZO','MANO') AND vida_actual IS NULL) OR
    (zona='CAMPO' AND vida_actual IS NOT NULL AND vida_actual>0) OR
    (zona='DESCARTE' AND vida_actual IS NOT NULL AND vida_actual=0))
) ENGINE=InnoDB;

CREATE TABLE turno (
  id_turno INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_partida INT UNSIGNED NOT NULL,
  numero_global TINYINT UNSIGNED NOT NULL,
  energia_disponible TINYINT UNSIGNED NOT NULL,
  fecha_apertura DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  fecha_cierre DATETIME(6) NULL,
  PRIMARY KEY (id_turno), UNIQUE KEY uq_turno_global (id_partida,numero_global),
  KEY ix_turno_abierto (id_partida,fecha_cierre),
  CONSTRAINT fk_turno_partida FOREIGN KEY (id_partida) REFERENCES partida(id_partida) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_turno_global CHECK (numero_global BETWEEN 1 AND 30),
  CONSTRAINT ck_turno_energia CHECK (energia_disponible BETWEEN 0 AND LEAST(5,FLOOR((numero_global+1)/2))),
  CONSTRAINT ck_turno_cierre CHECK (fecha_cierre IS NULL OR fecha_cierre>=fecha_apertura)
) ENGINE=InnoDB;

CREATE TABLE solicitud_operacion (
  clave_reintento CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id_partida INT UNSIGNED NOT NULL,
  tipo_operacion VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  hash_parametros CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  version_resultante INT UNSIGNED NOT NULL,
  fecha_registro DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (clave_reintento), UNIQUE KEY uq_solicitud_version (id_partida,version_resultante),
  CONSTRAINT fk_solicitud_partida FOREIGN KEY (id_partida) REFERENCES partida(id_partida) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_solicitud_clave CHECK (clave_reintento REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  CONSTRAINT ck_solicitud_hash CHECK (hash_parametros REGEXP '^[0-9a-f]{64}$'),
  CONSTRAINT ck_solicitud_tipo CHECK (tipo_operacion IN ('CREAR_PARTIDA','INVOCAR','ATACAR','FINALIZAR_TURNO')),
  CONSTRAINT ck_solicitud_numero CHECK (version_resultante>=1 AND (tipo_operacion<>'CREAR_PARTIDA' OR version_resultante=1))
) ENGINE=InnoDB;

CREATE TABLE jugada (
  id_jugada INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_turno INT UNSIGNED NOT NULL,
  orden_en_turno SMALLINT UNSIGNED NOT NULL,
  clave_reintento CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (id_jugada), UNIQUE KEY uq_jugada_orden (id_turno,orden_en_turno),
  UNIQUE KEY uq_jugada_solicitud (clave_reintento),
  CONSTRAINT fk_jugada_turno FOREIGN KEY (id_turno) REFERENCES turno(id_turno) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_jugada_solicitud FOREIGN KEY (clave_reintento) REFERENCES solicitud_operacion(clave_reintento) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_jugada_orden CHECK (orden_en_turno>0)
) ENGINE=InnoDB;

CREATE TABLE invocacion (
  id_jugada INT UNSIGNED NOT NULL,
  id_copia INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_jugada), UNIQUE KEY uq_invocacion_copia (id_copia),
  CONSTRAINT fk_invocacion_jugada FOREIGN KEY (id_jugada) REFERENCES jugada(id_jugada) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invocacion_copia FOREIGN KEY (id_copia) REFERENCES copia_carta_partida(id_copia) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE ataque (
  id_jugada INT UNSIGNED NOT NULL,
  id_copia_atacante INT UNSIGNED NOT NULL,
  id_copia_objetivo INT UNSIGNED NULL,
  id_participante_objetivo INT UNSIGNED NULL,
  vida_previa_atacante TINYINT UNSIGNED NOT NULL,
  vida_previa_objetivo TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_jugada), KEY ix_ataque_atacante (id_copia_atacante),
  KEY ix_ataque_objetivo (id_copia_objetivo), KEY ix_ataque_heroe (id_participante_objetivo),
  CONSTRAINT fk_ataque_jugada FOREIGN KEY (id_jugada) REFERENCES jugada(id_jugada) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_ataque_atacante FOREIGN KEY (id_copia_atacante) REFERENCES copia_carta_partida(id_copia) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_ataque_objetivo FOREIGN KEY (id_copia_objetivo) REFERENCES copia_carta_partida(id_copia) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_ataque_heroe FOREIGN KEY (id_participante_objetivo) REFERENCES participante_partida(id_participante) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_ataque_xor CHECK ((id_copia_objetivo IS NOT NULL)+(id_participante_objetivo IS NOT NULL)=1),
  CONSTRAINT ck_ataque_vidas CHECK (vida_previa_atacante>0 AND vida_previa_objetivo>0),
  CONSTRAINT ck_ataque_distinto CHECK (id_copia_objetivo IS NULL OR id_copia_objetivo<>id_copia_atacante),
  CONSTRAINT ck_ataque_vida_heroe CHECK (id_participante_objetivo IS NULL OR vida_previa_objetivo<=20)
) ENGINE=InnoDB;

-- RUTINAS FINALES: se conservan los cuerpos vigentes, sin DROP/ALTER historicos.
DELIMITER $$

-- Fuente: 09-decks-20.sql
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

-- Fuente: 02-routines.sql
CREATE PROCEDURE ta_crear_jugador(IN p_alias VARCHAR(40))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_id INT UNSIGNED;
  DECLARE v_sp BOOLEAN DEFAULT FALSE;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
    IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_jugador; END IF;
    RESIGNAL;
  END;
  IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
  SAVEPOINT ta_jugador; SET v_sp=TRUE;
  IF p_alias IS NULL OR CHAR_LENGTH(TRIM(p_alias))<1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='JUGADOR_INVALIDO: El alias es obligatorio.'; END IF;
  INSERT INTO jugador(alias) VALUES(TRIM(p_alias)); SET v_id=LAST_INSERT_ID();
  INSERT INTO coleccion_jugador(id_jugador,id_carta,cantidad) SELECT v_id,id_carta,2 FROM carta;
  IF (SELECT COUNT(*) FROM coleccion_jugador WHERE id_jugador=v_id)<>40 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CATALOGO_INVALIDO: Faltan las 40 cartas.'; END IF;
  RELEASE SAVEPOINT ta_jugador;
  SELECT v_id AS id_jugador;
END$$

-- Fuente: 09-decks-20.sql
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

-- Fuente: 09-decks-20.sql
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

-- Fuente: 02-routines.sql
CREATE PROCEDURE ta_finalizar_turno(IN p_clave CHAR(36),IN p_hash CHAR(64),IN p_partida INT UNSIGNED,IN p_actor INT UNSIGNED,IN p_version INT UNSIGNED)
SQL SECURITY DEFINER
main: BEGIN
  DECLARE v_version INT; DECLARE v_fin DATETIME(6); DECLARE v_num INT; DECLARE v_turn INT;
  DECLARE v_actor INT; DECLARE v_pos INT; DECLARE v_copy INT DEFAULT NULL; DECLARE v_part INT;
  DECLARE v_req INT DEFAULT NULL; DECLARE v_hash CHAR(64); DECLARE v_tipo VARCHAR(20); DECLARE v_reqversion INT;
  DECLARE v_life1 INT; DECLARE v_life2 INT; DECLARE v_sp BOOLEAN DEFAULT FALSE;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
    IF v_sp AND @@in_transaction THEN ROLLBACK TO SAVEPOINT ta_turno; END IF; RESIGNAL;
  END;
  IF NOT @@in_transaction THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TRANSACCION_REQUERIDA: Abrí una transacción.'; END IF;
  SAVEPOINT ta_turno; SET v_sp=TRUE;
  IF p_clave IS NULL OR p_hash IS NULL OR p_clave NOT REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_hash NOT REGEXP '^[0-9a-f]{64}$' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SOLICITUD_INVALIDA: Clave o huella inválida.'; END IF;
  IF p_partida IS NULL OR p_actor IS NULL OR p_version IS NULL OR p_version<1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SOLICITUD_INVALIDA: Partida, actor y versión son obligatorios.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM partida WHERE id_partida=p_partida) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PARTIDA_NO_ENCONTRADA: Partida inexistente.'; END IF;
  SELECT version,fecha_fin INTO v_version,v_fin FROM partida WHERE id_partida=p_partida FOR UPDATE;
  SELECT id_partida,hash_parametros,tipo_operacion,version_resultante INTO v_req,v_hash,v_tipo,v_reqversion FROM solicitud_operacion WHERE clave_reintento=p_clave FOR UPDATE;
  IF v_req IS NOT NULL THEN
    IF v_req<>p_partida OR v_hash<>p_hash OR v_tipo<>'FINALIZAR_TURNO' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CLAVE_REUTILIZADA: La clave corresponde a otro comando.'; END IF;
    RELEASE SAVEPOINT ta_turno; SELECT p_partida AS id_partida,v_reqversion AS version_resultante,1 AS replayed; LEAVE main;
  END IF;
  IF v_fin IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PARTIDA_FINALIZADA: La partida terminó.'; END IF;
  IF v_version<>p_version THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ESTADO_DESACTUALIZADO: Consultá el estado actual.'; END IF;
  IF (SELECT COUNT(*) FROM turno WHERE id_partida=p_partida AND fecha_cierre IS NULL)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TURNO_INVALIDO: No existe un único turno abierto.'; END IF;
  SELECT id_turno,numero_global INTO v_turn,v_num FROM turno WHERE id_partida=p_partida AND fecha_cierre IS NULL FOR UPDATE;
  SELECT m.id_jugador INTO v_actor FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo WHERE pp.id_partida=p_partida AND pp.posicion=IF(MOD(v_num,2)=1,1,2);
  IF p_actor IS NULL OR p_actor<>v_actor THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TURNO_AJENO: Solo puede actuar el jugador del turno.'; END IF;
  UPDATE turno SET fecha_cierre=CURRENT_TIMESTAMP(6) WHERE id_turno=v_turn;
  IF v_num=30 THEN
    SELECT vida_heroe INTO v_life1 FROM participante_partida WHERE id_partida=p_partida AND posicion=1;
    SELECT vida_heroe INTO v_life2 FROM participante_partida WHERE id_partida=p_partida AND posicion=2;
    UPDATE partida SET fecha_fin=CURRENT_TIMESTAMP(6),motivo_cierre='LIMITE_TURNOS',ganador_posicion=IF(v_life1=v_life2,NULL,IF(v_life1>v_life2,1,2)) WHERE id_partida=p_partida;
  ELSE
    SET v_num=v_num+1; SET v_pos=IF(MOD(v_num,2)=1,1,2);
    INSERT INTO turno(id_partida,numero_global,energia_disponible) VALUES(p_partida,v_num,LEAST(5,FLOOR((v_num+1)/2)));
    IF v_num>2 THEN
      SELECT id_participante INTO v_part FROM participante_partida WHERE id_partida=p_partida AND posicion=v_pos;
      SELECT id_copia INTO v_copy FROM copia_carta_partida WHERE id_participante=v_part AND zona='MAZO' ORDER BY posicion_original LIMIT 1 FOR UPDATE;
      IF v_copy IS NOT NULL THEN UPDATE copia_carta_partida SET zona='MANO' WHERE id_copia=v_copy; END IF;
    END IF;
  END IF;
  UPDATE partida SET version=version+1 WHERE id_partida=p_partida;
  INSERT INTO solicitud_operacion(clave_reintento,id_partida,tipo_operacion,hash_parametros,version_resultante) VALUES(p_clave,p_partida,'FINALIZAR_TURNO',p_hash,v_version+1);
  RELEASE SAVEPOINT ta_turno;
  SELECT p_partida AS id_partida,v_version+1 AS version_resultante,0 AS replayed;
END$$

-- Fuente: 02-routines.sql
CREATE TRIGGER ta_invocacion_exclusiva BEFORE INSERT ON invocacion FOR EACH ROW
BEGIN
  DECLARE v_parent INT UNSIGNED DEFAULT NULL;
  DECLARE v_sibling INT UNSIGNED DEFAULT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  -- Parent row is the stable mutex even when neither subtype exists yet.
  SELECT id_jugada INTO v_parent FROM jugada WHERE id_jugada=NEW.id_jugada FOR UPDATE;
  IF v_parent IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SUBTIPO_INVALIDO: Falta la jugada padre.'; END IF;
  SELECT id_jugada INTO v_sibling FROM ataque WHERE id_jugada=NEW.id_jugada FOR UPDATE;
  IF v_sibling IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SUBTIPO_INVALIDO: La jugada ya es ataque.'; END IF;
END$$

-- Fuente: 02-routines.sql
CREATE TRIGGER ta_ataque_exclusivo BEFORE INSERT ON ataque FOR EACH ROW
BEGIN
  DECLARE v_parent INT UNSIGNED DEFAULT NULL;
  DECLARE v_sibling INT UNSIGNED DEFAULT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  SELECT id_jugada INTO v_parent FROM jugada WHERE id_jugada=NEW.id_jugada FOR UPDATE;
  IF v_parent IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SUBTIPO_INVALIDO: Falta la jugada padre.'; END IF;
  SELECT id_jugada INTO v_sibling FROM invocacion WHERE id_jugada=NEW.id_jugada FOR UPDATE;
  IF v_sibling IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='SUBTIPO_INVALIDO: La jugada ya es invocación.'; END IF;
END$$

-- Fuente: 02-routines.sql
CREATE TRIGGER ta_invocacion_inmutable BEFORE UPDATE ON invocacion FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='HISTORIAL_INMUTABLE: No se puede modificar una invocación.';
END$$

-- Fuente: 02-routines.sql
CREATE TRIGGER ta_ataque_inmutable BEFORE UPDATE ON ataque FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='HISTORIAL_INMUTABLE: No se puede modificar un ataque.';
END$$

-- Fuente: 02-routines.sql
CREATE TRIGGER ta_jugada_inmutable BEFORE UPDATE ON jugada FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='HISTORIAL_INMUTABLE: No se puede modificar una jugada.';
END$$

-- Fuente: 04-combat.sql
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

-- Fuente: 04-combat.sql
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

-- Fuente: 08-deck-removal.sql
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

-- Fuente: 10-restart-game.sql
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

-- CATALOGO ORIGINAL Y EJEMPLOS FICTICIOS
-- Generado desde catalog.json; no modifica estadísticas existentes. B1-B4 pendientes.
USE truco_online_xampp;
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

-- Vista real de la pantalla Colección. No agrega datos almacenados ni otra mecánica.
USE truco_online_xampp;
CREATE OR REPLACE ALGORITHM=MERGE SQL SECURITY INVOKER VIEW v_coleccion_jugador AS
SELECT j.id_jugador,j.alias,c.id_carta,c.nombre,c.palo,c.numero,
       c.ataque_base,c.vida_base,c.costo_energia,c.jerarquia_truco,cj.cantidad
FROM jugador j
JOIN coleccion_jugador cj ON cj.id_jugador=j.id_jugador
JOIN carta c ON c.id_carta=cj.id_carta
WHERE j.fecha_archivo IS NULL;

-- Mazos de 20: misma composicion que scripts/lib/decks-20.mjs.
START TRANSACTION;
CALL ta_guardar_mazo((SELECT id_jugador FROM jugador WHERE alias='Ana demo SQL'),NULL,'Mazo 20 · Ana','Formato de 20 cartas para revision local.','[{"cardId":"ESP-01","quantity":2},{"cardId":"ESP-02","quantity":2},{"cardId":"ESP-03","quantity":2},{"cardId":"ESP-04","quantity":2},{"cardId":"ESP-05","quantity":2},{"cardId":"ESP-06","quantity":2},{"cardId":"ESP-07","quantity":2},{"cardId":"ESP-10","quantity":2},{"cardId":"ESP-11","quantity":2},{"cardId":"ESP-12","quantity":2}]');
CALL ta_guardar_mazo((SELECT id_jugador FROM jugador WHERE alias='Bruno demo SQL'),NULL,'Mazo 20 · Bruno','Formato de 20 cartas para revision local.','[{"cardId":"BAS-01","quantity":2},{"cardId":"BAS-02","quantity":2},{"cardId":"BAS-03","quantity":2},{"cardId":"BAS-04","quantity":2},{"cardId":"BAS-05","quantity":2},{"cardId":"BAS-06","quantity":2},{"cardId":"BAS-07","quantity":2},{"cardId":"BAS-10","quantity":2},{"cardId":"BAS-11","quantity":2},{"cardId":"BAS-12","quantity":2}]');
CALL ta_guardar_mazo((SELECT id_jugador FROM jugador WHERE alias='Carla demo SQL'),NULL,'Mazo 20 · Carla','Formato de 20 cartas para revision local.','[{"cardId":"ORO-01","quantity":2},{"cardId":"ORO-02","quantity":2},{"cardId":"ORO-03","quantity":2},{"cardId":"ORO-04","quantity":2},{"cardId":"ORO-05","quantity":2},{"cardId":"ORO-06","quantity":2},{"cardId":"ORO-07","quantity":2},{"cardId":"ORO-10","quantity":2},{"cardId":"ORO-11","quantity":2},{"cardId":"ORO-12","quantity":2}]');
CALL ta_guardar_mazo((SELECT id_jugador FROM jugador WHERE alias='Diego demo SQL'),NULL,'Mazo 20 · Diego','Formato de 20 cartas para revision local.','[{"cardId":"COP-01","quantity":2},{"cardId":"COP-02","quantity":2},{"cardId":"COP-03","quantity":2},{"cardId":"COP-04","quantity":2},{"cardId":"COP-05","quantity":2},{"cardId":"COP-06","quantity":2},{"cardId":"COP-07","quantity":2},{"cardId":"COP-10","quantity":2},{"cardId":"COP-11","quantity":2},{"cardId":"COP-12","quantity":2}]');
COMMIT;
SELECT 'INSTALACION_COMPLETA_XAMPP' AS resultado,VERSION() AS servidor,DATABASE() AS base,
 (SELECT COUNT(*) FROM carta) AS cartas,(SELECT COUNT(*) FROM jugador) AS jugadores_ficticios,
 (SELECT COUNT(*) FROM mazo) AS mazos_ejemplo;
