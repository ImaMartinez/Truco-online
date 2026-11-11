-- Truco Arena: implementation PROVISIONAL. B1-B4 remain pending.
-- Only this isolated development database is targeted. No DROP DATABASE.
CREATE DATABASE IF NOT EXISTS truco_arena_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
USE truco_arena_dev;
SET NAMES utf8mb4 COLLATE utf8mb4_bin;
SET time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION';

CREATE TABLE IF NOT EXISTS jugador (
  id_jugador INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alias VARCHAR(40) NOT NULL,
  fecha_alta DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  fecha_archivo DATETIME(6) NULL,
  PRIMARY KEY (id_jugador), UNIQUE KEY uq_jugador_alias (alias),
  CONSTRAINT ck_jugador_alias CHECK (CHAR_LENGTH(TRIM(alias)) BETWEEN 1 AND 40 AND CHAR_LENGTH(alias)=CHAR_LENGTH(TRIM(alias))),
  CONSTRAINT ck_jugador_archivo CHECK (fecha_archivo IS NULL OR fecha_archivo>=fecha_alta)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carta (
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

CREATE TABLE IF NOT EXISTS coleccion_jugador (
  id_jugador INT UNSIGNED NOT NULL,
  id_carta CHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  cantidad SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_jugador,id_carta),
  KEY ix_coleccion_carta (id_carta),
  CONSTRAINT fk_coleccion_jugador FOREIGN KEY (id_jugador) REFERENCES jugador(id_jugador) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_coleccion_carta FOREIGN KEY (id_carta) REFERENCES carta(id_carta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_coleccion_cantidad CHECK (cantidad>0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mazo (
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

CREATE TABLE IF NOT EXISTS mazo_carta (
  id_mazo INT UNSIGNED NOT NULL,
  id_carta CHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  cantidad TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_mazo,id_carta), KEY ix_mazocarta_carta (id_carta),
  CONSTRAINT fk_mazocarta_mazo FOREIGN KEY (id_mazo) REFERENCES mazo(id_mazo) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_mazocarta_carta FOREIGN KEY (id_carta) REFERENCES carta(id_carta) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_mazocarta_cantidad CHECK (cantidad BETWEEN 1 AND 2)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS partida (
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

CREATE TABLE IF NOT EXISTS participante_partida (
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
SET @ta_fk_ddl = IF((SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='truco_arena_dev' AND CONSTRAINT_NAME='fk_partida_ganador')=0,
  'ALTER TABLE truco_arena_dev.partida ADD CONSTRAINT fk_partida_ganador FOREIGN KEY (id_partida,ganador_posicion) REFERENCES truco_arena_dev.participante_partida(id_partida,posicion) ON DELETE RESTRICT ON UPDATE RESTRICT',
  'DO 0');
PREPARE ta_stmt FROM @ta_fk_ddl;
EXECUTE ta_stmt;
DEALLOCATE PREPARE ta_stmt;

CREATE TABLE IF NOT EXISTS copia_carta_partida (
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

CREATE TABLE IF NOT EXISTS turno (
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

CREATE TABLE IF NOT EXISTS solicitud_operacion (
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

CREATE TABLE IF NOT EXISTS jugada (
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

CREATE TABLE IF NOT EXISTS invocacion (
  id_jugada INT UNSIGNED NOT NULL,
  id_copia INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_jugada), UNIQUE KEY uq_invocacion_copia (id_copia),
  CONSTRAINT fk_invocacion_jugada FOREIGN KEY (id_jugada) REFERENCES jugada(id_jugada) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invocacion_copia FOREIGN KEY (id_copia) REFERENCES copia_carta_partida(id_copia) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ataque (
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
