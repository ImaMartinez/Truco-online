# Modelo relacional implementado y diccionario — MariaDB 10.4.32

Actualización de cierre: 03/11/2026. **Referencia técnica del SQL real; no aprobado por el grupo.** Las fichas T01–T13 cubren las 65 columnas verificadas por metadatos. La normalización actual se justifica en [la auditoría](02-auditoria-implementacion.md). Antecedente: 02/11/2026. Deriva del reglamento 0.2 y del [cierre conceptual para persistencia](../hito-1/10-cierre-conceptual-para-persistencia.md). B1–B4 y el MER/MR deben ser revisados por el grupo antes de implementar. Se preservan demo, catálogo, guías y matrices anteriores.

## 1. Convenciones y elecciones físicas implementadas, pendientes de ratificación

- Trece tablas: doce de dominio (incluidas asociaciones/subtipos) y una técnica. No se agregan tablas para alcanzar el mínimo ocho.
- InnoDB en todas; identificadores globales `INT UNSIGNED` con AUTO_INCREMENT salvo asociaciones, subtipos y claves naturales indicadas. IDs inmutables; las FK tienen exactamente el tipo/signo/collation de su destino.
- `NN` = NOT NULL; `NULL` = opcional. Las PK son NN y únicas por definición. Cada tabla enumera sus otras UQ, FK y CHECK; no hay restricciones implícitas omitidas bajo «etc.».
- Textos visibles `utf8mb4` con propuesta `utf8mb4_bin`; códigos/UUID/huellas `ascii` y `ascii_bin`. Alias/nombres se guardan sin blancos extremos. En esta política candidata «Ana»/«ana» y «José»/«Jose» son distintos; el grupo puede elegir otra política D10 antes de implementar, sin añadir una clave normalizada redundante automáticamente.
- Fechas `DATETIME(6)` en UTC; la presentación convierte a horario local. `fecha_registro` no pretende ser el timestamp exacto del COMMIT.
- FK con eliminación/actualización RESTRICT. Archivar conserva historia. El borrado de renglones de composición se permite solo al editar un mazo nunca usado, mediante rutina.
- Catálogo congelado y tomado de las cuarenta filas existentes. No imponer el presupuesto estadístico como CHECK: es una heurística de balance, no una ley del modelo.

**Diferencias justificadas frente a la guía orientativa:** `carta.id_carta` será el código natural `ESP-02`, sin ID numérico más otro código duplicado; `solicitud_operacion.clave_reintento` será su PK global, sin otro ID artificial; Jugada tendrá la FK única a la solicitud, en lugar de poner `id_jugada` opcional en el registro técnico. Así se conserva la asociación sin guardar en ese registro una jugada que vuelve a determinar su partida. La fecha del evento se obtiene de esa solicitud 1:1, sin repetir fecha_hora en Jugada. El estado ACTIVA/FINALIZADA de Partida se deriva de fecha_fin, evitando otro dato dependiente de una columna no clave; no se introduce un tercer estado. No se agregan discriminadores constantes en los hijos. Todas son elecciones preliminares incluidas en B3.

Los ejemplos son filas parciales de una misma historia explicativa, **no seeds listos para insertar**. Ana=1, Bruno=2; mazos 10/20, partida 100, participaciones 1001/1002. `t0=2026-11-02 23:00:00.000000 UTC`, t3/t4/t5 son uno/dos/tres minutos después. `K4=00000000-0000-4000-8000-000000000004`, K6 y K8 usan el mismo prefijo con terminaciones 0006 y 0008: son alias de UUID ilustrativos de 36 caracteres, no cadenas con puntos suspensivos. H8 representa 64 dígitos hexadecimales de una huella a recalcular con los parámetros reales.

## 2. Tablas propuestas

### T01 — jugador

Finalidad: perfil local, dueño de colección y mazos; sin contraseñas ni autenticación remota.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_jugador | INT UNSIGNED AUTO_INCREMENT | PK, NN | Identidad del perfil dueño; no acredita autenticación remota. |
| alias | VARCHAR(40) utf8mb4_bin | NN | Nombre único visible del perfil. |
| fecha_alta | DATETIME(6) | NN | Instante UTC de creación del perfil. |
| fecha_archivo | DATETIME(6) | NULL | Archivo lógico opcional; conserva referencias históricas. |

**PK:** id_jugador. **FK:** ninguna. **UNIQUE:** alias. **CHECK:** alias con 1–40 caracteres tras recortar, sin blancos extremos (comparar longitudes, no confiar en comparación PAD SPACE); fecha_archivo nula o ≥ fecha_alta.

**Relaciones/reglas:** jugador 0..N mazos y 0..40 tipos poseídos. No borrar perfil con historia; archivado no inicia partidas. Una activa por jugador requiere rutina cruzando Mazo/Participante/Partida. **Ejemplo:** `(1,'Ana',t0,NULL)`.

### T02 — carta

Finalidad: un tipo de naipe del catálogo, no una instancia de combate.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_carta | CHAR(6) ascii_bin | PK, NN; código existente | Código estable del tipo del catálogo, no de una copia. |
| nombre | VARCHAR(60) utf8mb4_bin | NN | Nombre editorial de carta o nombre del mazo de su dueño. |
| palo | VARCHAR(7) ascii_bin | NN | Familia tradicional del naipe. |
| numero | TINYINT UNSIGNED | NN | Valor impreso 1–7,10,11,12. |
| ataque_base | TINYINT UNSIGNED | NN | Daño base del tipo; no cambia durante la partida. |
| vida_base | TINYINT UNSIGNED | NN | Vida con que una copia entra en campo. |
| costo_energia | TINYINT UNSIGNED | NN | Costo editorial independiente de la jerarquía. |
| jerarquia_truco | TINYINT UNSIGNED | NN | Clase de fuerza tradicional; no determina resultados del combate. |

**PK:** id_carta. **FK:** ninguna. **UNIQUE:** (palo,numero). **CHECK:** nombre no vacío/recortado; palo en espadas/bastos/oros/copas; número en 1..7,10,11,12; ataque/vida >0; costo 1..5; jerarquía 1..14; código con seis caracteres y formato de los códigos documentados. La coherencia de código/palo/número está declarada en ck_carta_codigo_tipo; las cuarenta estadísticas se verifican en carga y pruebas, sin inventarlas.

**Relaciones/reglas:** tipo 0..N colecciones/composiciones/instancias; no cambiar catálogo usado. **Ejemplo:** `('ESP-02','Dos de espadas','espadas',2,3,2,2,6)`.

### T03 — coleccion_jugador

Finalidad: cantidad poseída, atributo de la N:M Jugador–Carta.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_jugador | INT UNSIGNED | PK parcial, NN, FK | Identidad del perfil dueño; no acredita autenticación remota. |
| id_carta | CHAR(6) ascii_bin | PK parcial, NN, FK | Código estable del tipo del catálogo, no de una copia. |
| cantidad | SMALLINT UNSIGNED | NN | Copias poseídas o incluidas por el par completo. |

**PK:** (id_jugador,id_carta). **FK:** id_jugador→jugador.id_jugador; id_carta→carta.id_carta. **UNIQUE:** ninguna adicional. **CHECK:** cantidad >0; no hay renglón de cantidad cero.

**Relaciones/reglas:** cada fila exactamente un jugador/tipo. Ausencia = no poseída; cantidad puede exceder dos aunque un mazo nunca incluya más de dos. Seed demo propuesto: dos por tipo. No consumir al jugar ni sumar usos entre distintos mazos. Bajas/adquisiciones fuera de alcance. **Ejemplo:** `(1,'ESP-02',2)`.

### T04 — mazo

Finalidad: composición nombrada de un dueño, seleccionable para jugar.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_mazo | INT UNSIGNED AUTO_INCREMENT | PK, NN | Identidad de composición nombrada y su dueño estable. |
| id_jugador | INT UNSIGNED | NN, FK | Identidad del perfil dueño; no acredita autenticación remota. |
| nombre | VARCHAR(60) utf8mb4_bin | NN | Nombre editorial de carta o nombre del mazo de su dueño. |
| descripcion | VARCHAR(200) utf8mb4_bin | NN, permite texto vacío | Texto editorial del mazo; no estadísticas calculadas. |
| fecha_creacion | DATETIME(6) | NN | Instante UTC de creación del mazo. |
| fecha_archivo | DATETIME(6) | NULL | Archivo lógico opcional; conserva referencias históricas. |

**PK:** id_mazo. **FK:** id_jugador→jugador.id_jugador. **UNIQUE:** (id_jugador,nombre). **CHECK:** nombre no vacío y sin blancos extremos; fecha_archivo nula o ≥ fecha_creacion. Descripción es texto editorial, no un promedio de energía almacenado.

**Relaciones/reglas:** un dueño; 0..12 tipos por composición; 0..N usos en participaciones. Dueño inmutable; desde el primer uso, nombre/descripción/composición conservados; archivo permitido. Usado se determina por existencia de participación, sin booleano cacheado. Duplicación crea otro mazo con nombre disponible. **Ejemplo:** `(10,1,'Mesa de espadas','Curva de inicio',t0,NULL)`.

### T05 — mazo_carta

Finalidad: cantidad incluida en la N:M Mazo–Carta.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_mazo | INT UNSIGNED | PK parcial, NN, FK | Identidad de composición nombrada y su dueño estable. |
| id_carta | CHAR(6) ascii_bin | PK parcial, NN, FK | Código estable del tipo del catálogo, no de una copia. |
| cantidad | TINYINT UNSIGNED | NN | Copias poseídas o incluidas por el par completo. |

**PK:** (id_mazo,id_carta). **FK:** id_mazo→mazo.id_mazo; id_carta→carta.id_carta. **UNIQUE:** ninguna adicional. **CHECK:** cantidad entre 1 y 2.

**Relaciones/reglas:** suma 0..12 para borrador y 12 para iniciar. Cantidad ≤ colección del dueño. Estas sumas/joins requieren rutina bloqueando Mazo; no copiar id_jugador a esta tabla para construir una FK más cómoda. **Ejemplo:** `(10,'ESP-02',2)` y otras cinco asociaciones de cantidad 2 completan doce.

### T06 — partida

Finalidad: estado, resultado y versión de una batalla.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_partida | INT UNSIGNED AUTO_INCREMENT | PK, NN | Identidad del encuentro confirmado. |
| fecha_inicio | DATETIME(6) | NN | Instante UTC de inicio del encuentro. |
| fecha_fin | DATETIME(6) | NULL | Instante UTC de finalización; NULL significa activa. |
| motivo_cierre | VARCHAR(16) ascii_bin | NULL | Causa del resultado: VIDA_CERO o LIMITE_TURNOS. |
| ganador_posicion | TINYINT UNSIGNED | NULL, parte de FK compuesta | Posición ganadora de esa partida; NULL si activa o empate. |
| version | INT UNSIGNED | NN, inicia en 1 | Versión del estado para control de concurrencia. |

**PK:** id_partida. **FK:** (id_partida,ganador_posicion)→participante_partida.(id_partida,posicion), añadida después de crear ambas tablas. **UNIQUE:** ninguna adicional. **CHECK:** versión ≥1; ganador NULL o 1/2; motivo NULL o VIDA_CERO/LIMITE_TURNOS. Si fecha_fin IS NULL, motivo y ganador deben ser NULL; si fecha_fin IS NOT NULL, debe ser ≥ inicio y motivo no nulo; VIDA_CERO exige ganador no nulo. Escribir IS NULL/IS NOT NULL explícitos para que un UNKNOWN no acepte casos inválidos. Estado es una proyección: fin NULL → ACTIVA, fin no NULL → FINALIZADA.

**Relaciones/reglas:** exactamente dos participantes; 1..30 turnos; ganador solo de esa partida. La igualdad de vidas, la victoria por cero y el cierre de todos los turnos se verifican por rutina. Activa sin ganador no es empate. No guardar además estado/id_ganador/resultado textual/turno_actual. **Ejemplo:** `(100,t0,NULL,NULL,NULL,8)`, proyectada como ACTIVA.

### T07 — participante_partida

Finalidad: héroe/posición y mazo seleccionado por un jugador en una batalla.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_participante | INT UNSIGNED AUTO_INCREMENT | PK, NN | Identidad del héroe/participación y dueño de doce copias. |
| id_partida | INT UNSIGNED | NN, FK | Identidad del encuentro confirmado. |
| posicion | TINYINT UNSIGNED | NN | Lugar inicial sorteado 1/2; determina alternancia. |
| id_mazo | INT UNSIGNED | NN, FK | Identidad de composición nombrada y su dueño estable. |
| vida_heroe | TINYINT UNSIGNED | NN, inicial 20 | Vida operativa actual del héroe. |

**PK:** id_participante. **FK:** id_partida→partida.id_partida; id_mazo→mazo.id_mazo. **UNIQUE:** (id_partida,posicion) y (id_partida,id_mazo). **CHECK:** posición 1/2; vida 0..20.

**Relaciones/reglas:** una partida, un mazo, doce copias. Jugador derivado por Mazo; no guardar otra FK de jugador. Dos mazos distintos no bastan: la rutina exige también dueños distintos. Posición 1 sorteada comienza, posición 2 juega pares. **Ejemplos:** `(1001,100,1,10,20)`, `(1002,100,2,20,20)`.

### T08 — copia_carta_partida

Finalidad: instancia identificable que cambia de zona y recibe daño, sin cambiar su tipo.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_copia | INT UNSIGNED AUTO_INCREMENT | PK, NN | Identidad individual conservada entre todas las zonas. |
| id_participante | INT UNSIGNED | NN, FK | Identidad del héroe/participación y dueño de doce copias. |
| id_carta | CHAR(6) ascii_bin | NN, FK | Código estable del tipo del catálogo, no de una copia. |
| posicion_original | TINYINT UNSIGNED | NN | Ordinal original inmutable 1–12 del reparto barajado. |
| zona | VARCHAR(8) ascii_bin | NN | Ubicación operativa: MAZO, MANO, CAMPO o DESCARTE. |
| vida_actual | TINYINT UNSIGNED | NULL | NULL antes de invocar; positiva en campo; cero descartada. |

**PK:** id_copia. **FK:** id_participante→participante_partida.id_participante; id_carta→carta.id_carta. **UNIQUE:** (id_participante,posicion_original). **CHECK:** posición 1..12; zona MAZO/MANO/CAMPO/DESCARTE; MAZO/MANO exige vida IS NULL, CAMPO exige vida IS NOT NULL y >0, DESCARTE exige vida IS NOT NULL y =0. No omitir el IS NOT NULL de las ramas de campo/descarte. Vida ≤ vida_base requiere consulta/rutina.

**Relaciones/reglas:** las doce instancias corresponden exactamente al mazo del participante, contando todas las zonas. Dueño/tipo/posición no cambian. No añadir id_mazo/id_partida/ataque/preparación/último ataque: se obtienen de relaciones/eventos. **Ejemplos después del combate:** `(2001,1001,'ESP-02',4,'DESCARTE',0)`, `(2002,1001,'ESP-02',2,'MANO',NULL)`, `(3001,1002,'COP-02',1,'DESCARTE',0)`.

### T09 — turno

Finalidad: apertura/cierre, orden global y energía restante de su actor.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_turno | INT UNSIGNED AUTO_INCREMENT | PK, NN | Identidad global del turno. |
| id_partida | INT UNSIGNED | NN, FK | Identidad del encuentro confirmado. |
| numero_global | TINYINT UNSIGNED | NN | Ordinal del turno dentro de la partida, 1–30. |
| energia_disponible | TINYINT UNSIGNED | NN | Energía operativa restante después de invocaciones. |
| fecha_apertura | DATETIME(6) | NN | Instante UTC de apertura del turno. |
| fecha_cierre | DATETIME(6) | NULL | Cierre UTC del turno; NULL si sigue abierto. |

**PK:** id_turno. **FK:** id_partida→partida.id_partida. **UNIQUE:** (id_partida,numero_global). **CHECK:** global 1..30; energía 0..min(5,floor((global+1)/2)), expresión determinista de esa fila; fecha_cierre nula o ≥ apertura.

**Relaciones/reglas:** actor derivado por paridad y posiciones de esa partida; ningún id_actor repetido. Consecutividad, un abierto si ACTIVA/ninguno si FINALIZADA y apertura/robo único requieren rutina con bloqueo de Partida. El último turno de cada posición permite presentar la energía del otro jugador; antes de su primer turno se muestra 0 sin crear un turno ficticio. **Ejemplo:** `(505,100,5,3,t5,NULL)`; precedentes 503/global3 y 504/global4 ya cerrados.

### T10 — solicitud_operacion (soporte técnico)

Finalidad: conservar el resultado confirmado de un comando para reconocer reintentos, también antes de que el cliente conozca id_partida.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| clave_reintento | CHAR(36) ascii_bin | PK global, NN; UUID canónico | UUID global del comando; en Jugada referencia la solicitud. |
| id_partida | INT UNSIGNED | NN, FK | Identidad del encuentro confirmado. |
| tipo_operacion | VARCHAR(20) ascii_bin | NN | Clase del comando confirmado, incluido inicio y cierre. |
| hash_parametros | CHAR(64) ascii_bin | NN; SHA-256 hexadecimal | Huella SHA-256 de parámetros canónicos para detectar reutilización. |
| version_resultante | INT UNSIGNED | NN | Versión creada por el comando original, no la actual al reintentar. |
| fecha_registro | DATETIME(6) | NN | Instante UTC del registro del comando; fuente temporal del evento. |

**PK:** clave_reintento. **FK:** id_partida→partida.id_partida. **UNIQUE:** (id_partida,version_resultante), porque cada comando exitoso crea una única nueva versión, incluido CREAR_PARTIDA en 1. **CHECK:** UUID canónico con formato válido; hash de 64 caracteres hexadecimales; tipo CREAR_PARTIDA/INVOCAR/ATACAR/FINALIZAR_TURNO; versión ≥1 y CREAR_PARTIDA implica versión 1.

**Relaciones/reglas:** solo operaciones confirmadas; ninguna fila «pendiente» ni FK ficticia a partida inexistente. La fila se escribe dentro de la transacción después de crear la partida y antes de confirmar. Su id_partida NN no impide recibir la clave antes de crearla. Tipo/huella/destino/versiones no se modifican al reintentar; no borrar la clave al terminar la partida, porque volvería a permitir repetir el efecto. No guardar JSON del estado ni id_jugada que determinaría nuevamente partida. **Ejemplo:** `(K8,100,'ATACAR',H8,8,t5)`; la clave de creación de esta partida tiene tipo CREAR_PARTIDA y versión 1.

### T11 — jugada

Finalidad: supertipo de una invocación o ataque exitoso, ordenado dentro de Turno.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_jugada | INT UNSIGNED AUTO_INCREMENT | PK, NN | Identidad del evento y PK compartida de sus subtipos. |
| id_turno | INT UNSIGNED | NN, FK | Identidad global del turno. |
| orden_en_turno | SMALLINT UNSIGNED | NN | Ordinal de la acción exitosa dentro del turno. |
| clave_reintento | CHAR(36) ascii_bin | NN, FK | UUID global del comando; en Jugada referencia la solicitud. |

**PK:** id_jugada. **FK:** id_turno→turno.id_turno; clave_reintento→solicitud_operacion.clave_reintento. **UNIQUE:** (id_turno,orden_en_turno) y clave_reintento. **CHECK:** orden >0.

**Relaciones/reglas:** un turno y una solicitud; exactamente un subtipo. La fecha se consulta de la solicitud (es la misma operación), no se almacena otra fecha_hora duplicada. Partida/actor se derivan del turno; tipo por pertenencia al hijo. La rutina comprueba que la solicitud corresponde a la misma partida y clase de acción. Crear/cerrar turno no producen Jugada. **Ejemplos:** `(701,503,1,K4)` para invocar, `(702,504,1,K6)` para invocar rival y `(703,505,1,K8)` para atacar.

### T12 — invocacion

Finalidad: especialización que identifica qué copia se colocó en campo.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_jugada | INT UNSIGNED | PK, NN, FK | Identidad del evento y PK compartida de sus subtipos. |
| id_copia | INT UNSIGNED | NN, FK | Identidad individual conservada entre todas las zonas. |

**PK:** id_jugada. **FK:** id_jugada→jugada.id_jugada; id_copia→copia_carta_partida.id_copia. **UNIQUE:** id_copia (invocación única por instancia). **CHECK:** ninguno adicional útil de una fila; no inventar un CHECK decorativo.

**Relaciones/reglas:** comparte identidad con padre; copia del actor, antes en mano; costo/espacio/energía y evento cambian juntos. No almacenar turno de invocación también en Copia. **Ejemplos:** `(701,2001)`, `(702,3001)`; no crear un padre sin hijo aunque falle la operación.

### T13 — ataque

Finalidad: especialización que identifica atacante, objetivo y observaciones del instante previo al daño.

| Columna | Tipo MariaDB implementado | Nulabilidad / clave | Significado funcional |
|---|---|---|---|
| id_jugada | INT UNSIGNED | PK, NN, FK | Identidad del evento y PK compartida de sus subtipos. |
| id_copia_atacante | INT UNSIGNED | NN, FK | Copia que inicia el ataque. |
| id_copia_objetivo | INT UNSIGNED | NULL, FK | Copia rival objetivo, excluyente con héroe. |
| id_participante_objetivo | INT UNSIGNED | NULL, FK | Héroe rival objetivo, excluyente con copia. |
| vida_previa_atacante | TINYINT UNSIGNED | NN | Vida observada del atacante antes del intercambio. |
| vida_previa_objetivo | TINYINT UNSIGNED | NN | Vida observada del objetivo antes del intercambio. |

**PK:** id_jugada. **FK:** id_jugada→jugada.id_jugada; ambas referencias de copia→copia_carta_partida.id_copia; id_participante_objetivo→participante_partida.id_participante. **UNIQUE:** ninguna adicional. **CHECK:** exactamente un objetivo IS NOT NULL; vidas previas >0; si objetivo carta existe, es distinto del atacante; si héroe, vida previa objetivo ≤20. Límites contra vida_base y concordancia con el estado anterior los impone la rutina.

**Relaciones/reglas:** atacante preparado y sin otro ataque en ese turno; enemigo y misma partida; héroe solo si campo vacío. Defensa no produce otra Jugada/Ataque ni consume ataque propio. **Ejemplo:** `(703,2001,3001,NULL,2,3)`: los ataques base 3 y 2 producen dos descartes. No guardar daños/vidas posteriores adicionales. La muerte del atacante se atribuye al defensor al calcular eliminaciones.

## 3. Dependencias funcionales y revisión de 3FN

| Relación | Determinantes candidatos → resto de atributos |
|---|---|
| jugador | id_jugador; alias bajo política elegida |
| carta | id_carta; (palo,numero); (palo,jerarquia_truco) como clave semántica; ver auditoría |
| coleccion_jugador | (id_jugador,id_carta) → cantidad |
| mazo | id_mazo; (id_jugador,nombre) |
| mazo_carta | (id_mazo,id_carta) → cantidad |
| partida | id_partida |
| participante_partida | id_participante; (id_partida,posicion); (id_partida,id_mazo) |
| copia_carta_partida | id_copia; (id_participante,posicion_original) |
| turno | id_turno; (id_partida,numero_global) |
| solicitud_operacion | clave_reintento; (id_partida,version_resultante) |
| jugada | id_jugada; (id_turno,orden_en_turno); clave_reintento |
| invocacion | id_jugada; id_copia |
| ataque | id_jugada |

Propuesta de argumento: atributos atómicos (sin listas de cartas en una celda); cantidades dependen del par completo; en las relaciones propuestas no se identifica un determinante no clave de otro atributo no primo, bajo estas reglas y claves. No se usa una UQ nullable como candidata universal. El grupo debe verificar las dependencias completas y justificar la traducción para afirmar 3FN, no solo copiar esta tabla.

Se evitan dependencias transitivas visibles: mazo→dueño en Participante; participante→partida/mazo en Copia; turno→partida/actor en Jugada; carta→estadísticas en instancias; invocación/ataques→preparación/agotamiento. Con IDs globales no se propaga id_partida a cada hijo por comodidad de FK compuesta; la validación de ámbito queda expresamente en SQL.

Vida/energía/zona actuales son estado operativo consultado al ejecutar el siguiente comando. Las vidas previas son observaciones históricas con otro momento y propósito, que evitan reproducir todos los eventos para consultar eliminaciones; su redundancia temporal se justifica y se valida atómicamente. No son una segunda vida actual. Se deriva estado desde fecha_fin para no introducir fecha_fin → estado como dependencia no clave; versión/registro técnico deben mantenerse coherentes. Las comprobaciones no sustituyen el análisis de dependencias. No guardar «ganó» además del ganador opcional, ni promedios, totales de mazo/campo o contadores de descartes.

## 4. A — Exactitud de la composición al iniciar

1. Bloquear los jugadores y mazos seleccionados con orden estable; leer composición/colección actuales. Exigir mazos habilitados, dueño correcto, tipos poseídos y suma exactamente 12.
2. Expandir **desde mazo_carta** una o dos instancias de cada tipo. No aceptar las doce cartas elegidas arbitrariamente por el navegador como fuente de verdad.
3. **Implementación actual:** la rutina expande mazo_carta y baraja las doce filas con ORDER BY RAND(), sin aceptar una permutación del cliente. Conserva composición y posiciones bajo transacción. **Antecedente descartado como transporte:** el backend produciría una permutación de los doce elementos expandidos. Transporte propuesto a la rutina: parámetro LONGTEXT con arreglo JSON de doce objetos (código de carta, ordinal local de copia 1/2). Validar documento, tipo arreglo, longitud, tipos de campos y cada token con funciones JSON y un recorrido acotado; contrastar contra la composición bloqueada. Si cambió desde que el backend leyó/preparó la permutación, rechazar y reintentar de forma controlada. No permitir introducir tipos ni duplicar tokens. No usar JSON_TABLE (disponible desde 10.6), ni almacenar ese payload como estado de partida; los tokens son transitorios, las instancias terminan en filas relacionales.
4. Insertar las doce copias con posiciones 1–12. Las tres primeras MANO y demás MAZO, todas con vida NULL. Tipo, dueño y posición quedan inmutables.
5. Antes de confirmar, comparar el multiconjunto esperado E(tipo,cantidad del mazo) con A(tipo,COUNT de **todas** las copias de la participación), en ambos sentidos: cada tipo de E tiene exactamente su cantidad en A y A no contiene tipos ajenos. Exigir además total 12. UQ de posición + dominio 1..12 + doce filas garantizan la permutación completa de posiciones.
6. Crear primer turno con energía 1 y guardar resultado idempotente; confirmar todo o nada. La composición usada no puede editarse mientras el inicio espera ni después del uso.

Contraejemplo para la prueba: un mazo exige dos ESP-02 y dos ESP-04; una carga con tres ESP-02 y una ESP-04 sigue sumando doce al completar otros tipos, pero es inválida. También lo es sustituir un tipo por otro del catálogo que no está en el mazo. No agregar id_mazo en Copia para resolver esta igualdad: ya se obtiene por Participante.

## 5. B — Crear idempotentemente sin id_partida previo

Propuesta: **registro solo de solicitudes confirmadas**, sin filas pendientes, sin id_partida NULL ni partida ficticia. El cliente genera una clave UUID antes del POST y la conserva para todos los reintentos del mismo intento. El backend calcula SHA-256 de parámetros canónicos: versión de protocolo, operación, jugadores y mazos elegidos, conservando el orden lógico solicitado. Excluir sorteo, posiciones finalmente asignadas, barajado generado, timestamps y resultado; no confiar en una huella elegida por el navegador.

Secuencia propuesta, dentro de una transacción en una conexión:

1. Consultar si ya existe la clave global. Si coincide clase y huella, devolver id_partida/version_resultante de la operación original y, si corresponde, una proyección actual; no sortear ni crear otra vez. Otro contenido con esa clave implica conflicto.
2. Si falta, bloquear jugadores por ID, luego mazos por ID. Releer la clave con lectura actual **antes** de rechazar una partida activa: un reintento del inicio exitoso debe recuperar su partida, no fallar por haberla creado.
3. Validar disponibilidad y ejecutar el inicio A, incluida la asignación aleatoria de posiciones. Crear Partida/participantes/copias/Turno y versión 1.
4. Insertar solicitud con la clave única, id_partida recién creado, tipo CREAR_PARTIDA y versión 1; es ahora cuando existe el destino de la FK NN. Confirmar solo después de las postcondiciones.
5. Si otra transacción ganó la misma clave y el INSERT detecta **esa** colisión, hacer ROLLBACK completo de la perdedora y leer el registro confirmado en una transacción nueva. Si coincide huella/clase, devolver el resultado ganador; si no, conflicto. No convertir cualquier error de unicidad en un replay: identificar la restricción de la clave y distinguir otras UQ.

Mismos jugadores suelen serializarse por sus bloqueos. La unicidad global cubre también solicitudes simultáneas que reutilicen la clave con jugadores distintos: puede haber trabajo/IDs tentativos, pero nunca dos partidas **confirmadas** por la misma clave; la perdedora no conserva copias ni resultados. Los huecos de AUTO_INCREMENT tras rollback no son partidas duplicadas.

Deadlocks/timeouts requieren rollback y reintento acotado con la misma clave. No suponer que una consulta ausente reserva una clave inexistente ni reutilizar un snapshot anterior bajo REPEATABLE-READ. Si no se ve registro después de perder una respuesta de COMMIT, eso no prueba fracaso: la primera operación puede seguir en vuelo. Reintentar con la misma clave, nunca inventar otra para el mismo comando incierto. Si el cliente pierde esa clave, esta garantía de replay no puede reconstruirse mágicamente.

Para acciones con partida existente, bloquear Partida y consultar primero la solicitud, después versión/actor/estado. La huella incluye también partida, actor, versión esperada y parámetros de acción. Un replay conserva la versión esperada original y puede recuperar éxito aunque la partida ya haya avanzado/finalizado. Un cierre de turno tampoco roba otra vez.

Contrato de respuesta propuesto: primer inicio devuelve 201; replay confirmado puede devolver 200 con el mismo ID. El cuerpo DuelState lleva **versión/snapshot actuales** y los metadatos de replay informan por separado la versión_resultante original. No etiquetar una mesa actual como si fuera el snapshot de la versión antigua ni guardar todo el JSON de respuesta para fingir una reproducción exacta.

## 6. C — Especialización total y disjunta desde MariaDB

No agregar un subtipo «fin de turno»: eso cambia el vocabulario del MER. No repetir columnas constantes tipo en ambos hijos. FKs hijo→padre y PK compartida garantizan identidad/existencia, **no** que todo padre tenga hijo ni que solo exista uno entre ambas tablas.

Garantía operativa propuesta: rol de aplicación con EXECUTE de rutinas autorizadas y SELECT de proyecciones, sin DML directo sobre juego/registro técnico. Cada rutina verifica bajo bloqueo de Partida que creará exactamente un hijo, genera solicitud/Jugada/hijo y comprueba exclusión/totalidad antes de devolver éxito. No hay endpoint CRUD de Jugada ni procedimiento que inserte solo un padre. Las actualizaciones/borrados de eventos tampoco se conceden al rol.

**Refuerzo necesario respecto del contrato previo:** si falla el hijo después de insertar el padre, SIGNAL por sí solo no hace imposible que un cliente SQL ejecute COMMIT y deje el padre huérfano. La rutina exige transacción activa, establece un SAVEPOINT local antes de modificar y usa un handler de error que deshace sus propios cambios y reemite el error. El coordinador realiza además ROLLBACK completo. El handler verifica si sigue existiendo transacción/savepoint: un deadlock puede haber revertido todo y eliminado el punto, y la limpieza no debe ocultar el error original. No hay transacción anidada ni COMMIT interno; la limpieza se aplica también al resto de operaciones críticas.

Triggers de refuerzo podrían serializar por el padre y rechazar un segundo hijo si se habilitan otros caminos de escritura, pero no se proponen como sustituto de la operación completa. MariaDB no ofrece aquí una FK/CHECK diferida de fin de transacción para exigir un hijo después del INSERT del padre. Un administrador con DML/DDL puede violar el contrato; la garantía se prueba para el rol y caminos autorizados, no se presenta como invariante puramente declarativa frente al administrador.

## 7. Orden de creación y ejecución posterior

Orden ya implementado en los scripts MariaDB; su aprobación académica sigue pendiente:

1. jugador y carta.
2. coleccion_jugador y mazo; después mazo_carta.
3. partida inicialmente sin su FK de ganador; participante_partida; añadir entonces FK compuesta de ganador. Ganador NULL permite insertar el inicio sin restricciones diferidas.
4. copia_carta_partida y turno.
5. solicitud_operacion, que solo depende de partida.
6. jugada, que depende de turno y solicitud; después invocacion y ataque.
7. Índices secundarios de FK/consultas, rutinas/posibles triggers y rol de aplicación. Catálogo/perfiles/colecciones; mazos y partidas de prueba mediante caminos válidos. Vistas/consultas y batería de integridad.

Las restricciones tienen nombres únicos en la base para 10.4. Declarar FOREIGN KEY completa (no abreviatura REFERENCES de columna), verificar SHOW CREATE TABLE/metadatos y rechazos. InnoDB, CHECK/FK habilitados y modo estricto de las sesiones; no cambiar globalmente XAMPP. DDL separado de demostraciones DML/ROLLBACK por commits implícitos.

**Orden de inserción para acciones:** primero comprobar y modificar estado bajo bloqueo; después actualizar versión e insertar solicitud, y luego Jugada/hijo si aplica (la FK de Jugada necesita que exista solicitud). Si cualquier paso falla, la limpieza local y el rollback completo revierten todo. El replay no crea otra solicitud ni otro evento.

## 8. Restricciones cruzadas y transacciones requeridas

| Operación | Comprobaciones SQL y conjunto atómico |
|---|---|
| Guardar/duplicar mazo | Dueño y archivo, no usado, colección, máximo dos/suma ≤12; reemplazo completo de composición o nuevo ID |
| Iniciar | Jugadores distintos/sin otra activa, propiedad, suma 12, igualdad A, sorteo, 24 copias, turno inicial y solicitud B |
| Invocar | Actor/versión/estado, copia en mano de esa partida, energía y campo <3; energía + zona/vida + solicitud + Jugada/Invocacion |
| Atacar | Copia propia preparada/sin ataque en ese turno, objetivo XOR rival/misma partida, héroe desprotegido; vidas previas, dos daños/descartes, solicitud/Jugada/Ataque y cierre si letal |
| Finalizar turno | Actor/versión, cierre actual, límite 30, o siguiente apertura/energía/robo por orden; una solicitud, ninguna Jugada |
| Reanudar/consultar | Snapshot consistente de partida/copias/eventos/turnos; lectura transaccional si se arma con varias consultas, sin combinar versiones de momentos distintos |

Bloqueos estables: jugadores ordenados → mazos ordenados → partidas ordenadas → hijos ordenados. Una acción existente empieza en Partida y no adquiere luego bloqueos superiores. Las lecturas decisivas deben ser actuales/bloqueantes dentro del protocolo; ni conteos previos en Node ni un SELECT ausente bastan. El CHECK de fila cubre rangos/XOR/NULL; procedimientos cubren sumas, ámbito, temporalidad, actor, preparación, mismo turno, fin y composición exacta.

El usuario puede continuar usando la demo sin estos scripts. Para iniciar implementación: aprobar la referencia, crear base de pruebas separada en XAMPP, escribir un instalador único con estructura→rutinas/permisos→datos→vistas/consultas en orden correcto, ejecutar pruebas y recién después seleccionar el repositorio SQL por configuración del backend. No convertir el proveedor demo en una base SQL improvisada.

## 9. Conexión futura de endpoints y DTO

La frontera asíncrona ArenaRepository ya sirve para adaptar las pantallas, pero hay extensiones pequeñas de contrato que son necesarias; no prometer que reemplazar solo una clase alcanza.

| Ruta actual | Lectura/operación MariaDB propuesta |
|---|---|
| GET /api/catalog | carta; mantener códigos y atributos HTTP existentes |
| GET /api/decks | mazo/mazo_carta filtrados por jugador; añadir contexto y disponibilidad |
| POST /api/decks | Crear con dueño explícito y composición validada |
| PUT /api/decks/:id | Editar solo no usado; duplicar mediante POST con nuevo nombre/ID cuando ya fue utilizado |
| POST /api/duels | Dos jugadores/mazos, clave idempotente previa al ID y solo inicio reglamentario; rutina A/B |
| GET /api/duels/:id | Partida, participantes, turnos, copias y eventos, proyectados con snapshot consistente |
| POST /api/duels/:id/actions | Actor explícito, clave idempotente y expectedVersion; despachar invocar/atacar/fin a rutinas |
| GET /api/health | Separar estado vivo del proceso y disponibilidad de base; informar proveedor real sin secretos |

Añadir después perfiles/selección de jugadores, colección por dueño, partidas activas e historial completo; no exponer un CRUD genérico de tablas. El cliente genera `Idempotency-Key` o un campo requestId equivalente para creación/acciones; se acuerda un solo formato al implementar y conserva clave/payload mientras el resultado sea incierto. La identidad enviada en modo local permite validar el turno, pero no equivale a autenticar un usuario remoto.

DTO: convertir IDs SQL a strings al salir; `health` de carta en mano puede proyectar vida_base aunque vida_actual sea NULL. `enteredTurn` y `lastAttackTurn` se consultan desde eventos; energía máxima/actor/contadores por zona se derivan. El log de presentación se genera desde eventos sin almacenar solo frases ni truncar historia. `mode`, `storage`, `database` y `scenario` deben discriminar demo/persistencia con veracidad, sin aceptar mesa-abierta en SQL. Mantener componentes visuales y actualizar el cliente API/selección de jugadores, no un motor de reglas React.

## 10. Pruebas necesarias antes de habilitar persistencia

La tabla siguiente conserva los casos de diseño. Ejecución real actual en [Hito 3](../hito-3/03-evidencia-ejecucion.md) y README-PERSISTENCIA.md; no confundir los antecedentes con el estado técnico actual.

| Caso | Evidencia mínima esperada |
|---|---|
| Dominios, NN y FK | Rechazar carta 8/9, par duplicado, copias/costos inválidos, FK inexistente, NULL en campo/descarte y zonas incoherentes |
| Colección/mazo | 13 totales, tercera copia, carta ausente o cantidad insuficiente rechazados; borrador válido y edición fallida sin perder composición anterior |
| Inmutabilidad | Cambio de dueño/nombre/composición de mazo usado rechazado; duplicación con otro ID permite editar sin reescribir historia |
| Exactitud A | Doce correctas aceptadas; doce con distribución errónea o tipo extra rechazadas; posiciones incompletas/duplicadas rechazadas |
| Inicio reglamentario | Dos jugadores reales, dos mazos propios, 24 copias, reparto 3+3 y 9+9; una activa por jugador y sorteo registrado |
| Replay B secuencial | Misma clave/payload devuelve misma partida incluso ya activa/finalizada, con mazo archivado o versión avanzada; sin otro sorteo ni filas nuevas |
| Replay B concurrente | Dos conexiones con misma clave/mismos jugadores; también misma clave/diferentes jugadores; máximo una partida confirmada y conflicto si cambia huella |
| Inicio fallido | Fallo después de crear Partida/primer participante/copias o antes del registro final revierte todo; siguiente intento con misma clave puede realizarse |
| Respuesta perdida | Cliente repite misma clave tras COMMIT incierto; recupera resultado sin duplicar. Dos claves distintas para mismos jugadores solo permiten una activa |
| Especialización C | Padre solo, ambos hijos y borrar hijo rechazados para rol app; invocar/atacar crean exactamente uno |
| Error de subtipo | Fallo provocado entre padre/hijo; incluso un cliente que intenta COMMIT tras el error no conserva padre ni gasto parcial; probar también deadlock sin savepoint vigente |
| Ámbito/actor | Rechazar rival fuera de turno, copia/objetivo de otra partida y ganador de otra partida, aun existiendo todas sus FKs |
| Invocación concurrente | Último espacio del campo y energía disponible no pueden consumirse por dos comandos; acciones rechazadas dejan estado/eventos/versión iguales |
| Combate | Preparación, ataque único, héroe protegido y daño simultáneo; doble muerte conserva ambas copias en descarte; contraataque atribuido al defensor |
| Ciclo completo | Aperturas propias 1 sin robo, 2..10 con robo único, energía tope 5, agotamiento sin penalización, global29 no termina por límite |
| Final | Letal cierra turno/partida inmediatamente, también en 30; límite 30 decide victoria/empate sin turno31 ni comandos posteriores |
| Persistencia y proyección | Recarga/reinicio backend reconsultan misma partida y eventos; captura consistente; frontend sigue mostrando catálogo exacto y transición |
| Permisos/instalación | Rol app no puede eludir rutinas; instalación limpia 10.4.32, constraints reales, tests de rollback después de escribir y dos sesiones concurrentes |

## 11. Fuentes y límites de la validación

Se contrastaron [restricciones MariaDB](https://mariadb.com/docs/server/reference/sql-statements/data-definition/constraint), [transacciones/aislamiento](https://mariadb.com/docs/server/reference/sql-statements/transactions/set-transaction), [SAVEPOINT](https://mariadb.com/docs/server/reference/sql-statements/transactions/savepoint), [SIGNAL](https://mariadb.com/docs/server/reference/sql-statements/programmatic-compound-statements/signal) y [handlers](https://mariadb.com/docs/server/reference/sql-statements/programmatic-compound-statements/declare-handler). SAVEPOINT permite limpieza local sin confirmar y un rollback total elimina los puntos; la implementación debe probar sus ramas de error. Para el transporte se revisaron [JSON_VALID](https://mariadb.com/docs/server/reference/sql-functions/special-functions/json-functions/json_valid), [JSON_LENGTH](https://mariadb.com/docs/server/reference/sql-functions/special-functions/json-functions/json_length) y la limitación de versión de [JSON_TABLE](https://mariadb.com/docs/server/reference/sql-functions/special-functions/json-functions/json_table). No se trasladan capacidades de versiones nuevas a 10.4 sin ejecutar luego la batería correspondiente.

Registro histórico de la preparación inicial: se verificó documentación/código, sin conexión SQL ni paquetes en ese momento. La implementación y evidencia actuales están en Hito 3. Los ejemplos no acreditan una base cargada, los mecanismos no están implementados y 3FN no tiene validación humana. Los archivos anteriores y la demo quedan intactos; no hubo commits/despliegues ni trabajo de adaptación PostgreSQL.
