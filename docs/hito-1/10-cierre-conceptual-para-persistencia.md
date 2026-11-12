# Cierre conceptual para pasar de demo a persistencia

02/11/2026. **Propuesta revisable, no MER definitivo. B1–B4 siguen pendientes.** El pedido actual autoriza preparar un MR preliminar; no aprueba el Hito 1 ni autoriza ejecutar SQL. La demo, el catálogo y los documentos anteriores se preservan.

Esta revisión tiene solo dos entregables: este anexo para revisar/dibujar y la [referencia relacional MariaDB](../hito-2/01-modelo-relacional-preliminar.md), que concreta tablas, dependencias, transacciones y conexión futura. Reutiliza el [reglamento 0.2](02-reglamento-recomendado.md), la [matriz existente](07-matriz-de-decisiones-cierre.md) y la [guía manual](08-guia-manual-mer-drawio.md); no los reemplaza.

## 1. Brecha verificada entre demo y reglamento

Se revisaron contratos, cliente HTTP, rutas, validación y `backend/src/demo/demo-repository.ts`. Las diferencias siguientes son límites de la demo, no propuestas de cambio de reglas:

| Hecho actual | Requisito persistente y solución propuesta |
|---|---|
| Colección implícita de dos copias; mazos globales sin propietario | Jugador y colección explícitos; cada mazo tiene dueño; SQL cruza cantidades y propietario al guardar/iniciar |
| Los mazos usados se pueden editar | Bloquear su composición/nombre/dueño cuando exista una participación que los use; para editar, duplicar |
| `createDuel` permite elegir el mismo mazo para ambos y usa IDs `jugador-1/2` | Dos jugadores reales distintos y mazos de sus dueños; una partida activa por jugador |
| Se barajan cartas, pero el primer argumento siempre comienza | Sortear quién ocupa posición 1 y conservar esa asignación en Participante |
| `mesa-abierta` es el escenario predeterminado y contiene campo preparado | Mantenerlo únicamente en proveedor demo. El proveedor SQL solo admite un inicio reglamentario; no importar ese fixture como historial real |
| La expansión en memoria sí genera copias desde la composición | Conservar el principio en SQL, bajo bloqueo, y verificar igualdad de cantidades por tipo en ambos sentidos antes de confirmar |
| Las cartas en mano/mazo tienen vida base y `enteredTurn=0` en el DTO | SQL guarda vida NULL antes de invocar. El adaptador puede presentar vida base y un valor de presentación para no rehacer Card; eso no crea columnas equivalentes |
| `expectedVersion` rechaza una segunda acción sobre un snapshot viejo; no identifica reintentos | Añadir clave global por solicitud, incluida la creación antes del ID de partida; consultar replay antes de rechazar versión/estado antiguos |
| El servidor interpreta todo comando como del actor actual | Incluir contexto explícito de jugador/participante y verificarlo contra turno; la versión no identifica quién emitió la acción. El modo local sigue sin autenticar identidad remota |
| Solo conserva snapshots, contadores de descartes y hasta 60 líneas de texto | Persistir todas las copias, turnos, Jugada y subtipos; obtener contadores/textos del historial, sin eliminar instancias muertas |
| Ganador/estado visibles no representan fecha de cierre del turno ni motivo | Actualizar héroe, evento, turno y Partida en la misma transacción; vida cero prevalece sobre límite 30 |
| Recargar pierde el vínculo visual con el duelo y el reinicio del servidor borra todo | Recuperar por ID en URL/listado de partidas activas y consultar SQL, conservando la transición de mano |
| Salud y tipos HTTP contienen literales `mode:'demo'`, `storage:'memory'`, `database:'not-connected'` | Versionar/ampliar esos contratos para informar honestamente el proveedor; no basta inyectar SQL y dejar salud/modo fijos |

Invocaciones, gasto visible, tres espacios, espera para atacar, ataque único, daño simultáneo, victoria y empate al global 30 ya se comportan de forma compatible en el simulador. Sus comprobaciones JavaScript no acreditan integridad SQL. No se modificó la demo para resolver esta brecha en esta etapa.

## 2. Qué dibujar y por qué

Los atributos completos y sus tipos se precisan una sola vez en el MR enlazado. Para el dibujo conceptual, revisar este inventario y los ejemplos; las identidades conceptuales no obligan a dibujar columnas FK.

| Candidato | Atributos principales / ejemplo del hecho |
|---|---|
| Jugador | Alias, alta/archivo. Ana y Bruno son perfiles distintos |
| Carta | Código, nombre, palo/número, ataque/vida base, costo y jerarquía. `ESP-02` es un único tipo 3/2 de costo 2 |
| Coleccion_Jugador | Cantidad del par jugador/carta. Ana posee dos `ESP-02`; no son todavía instancias de una partida |
| Mazo | Dueño, nombre, descripción y fechas. El mazo 10 es de Ana |
| Mazo_Carta | Cantidad del par mazo/carta. El mazo 10 incluye dos `ESP-02` y diez copias de otros tipos |
| Partida | Inicio/fin, motivo, ganador opcional y versión técnica; estado derivado de fin. Partida 100 activa porque fin es NULL, sin ganador |
| Participante_Partida | Posición inicial y vida del héroe; utiliza un mazo. Participación 1001 usa mazo 10, posición 1, vida 20 |
| Copia_Carta_Partida | Posición original, zona y vida actual. Copias 2001 y 2002 del mismo `ESP-02`: una descartada con vida 0, otra en mano con vida NULL |
| Turno | Número global, energía disponible y fechas. Turno global 5: actor de posición 1, energía máxima derivada 3 |
| Jugada | Orden, momento y turno. Evento 703, primero del turno 5; no guarda el texto «atacó» como sustituto del hecho |
| Invocacion | Misma identidad de Jugada y copia invocada. Evento 701 colocó la copia 2001 en el turno 3 |
| Ataque | Misma identidad de Jugada, atacante, un objetivo y dos vidas previas. Evento 703: `ESP-02` 3/2 contra `COP-02` 2/3; ambos mueren |
| Solicitud_Operacion | Clave global, clase, huella y resultado técnico. Una clave de creación recupera siempre la misma partida confirmada |

No agregar entidades para mano/campo/descarte, energía máxima, resultado o historial si solo repetirían datos. Héroe es el rol de una participación, no una clase adicional sin atributos propios.

## 3. Relaciones y cardinalidades a ratificar

Lectura por instancia en palabras, para no invertir los extremos de la notación:

| Relación | Mínimos/máximos propuestos y justificación |
|---|---|
| Jugador posee Mazo | Jugador 0..N mazos; cada mazo 1 dueño. Ese dueño no cambia |
| Jugador posee Carta | N:M con cantidad: jugador 0..40 tipos y carta 0..N jugadores; cada par aparece una vez |
| Mazo contiene Carta | N:M con cantidad: mazo 0..12 tipos, carta 0..N mazos. Listo exige suma 12 y 6..12 tipos por máximo dos copias |
| Partida tiene Participante | Partida confirmada exactamente 2; participante pertenece a 1 partida. Posiciones y dueños distintos |
| Mazo se utiliza en Participante | Mazo 0..N usos históricos; participación utiliza 1 mazo. Jugador se deriva del dueño, no otra fuente almacenada |
| Participante tiene Copia | Exactamente 12 por participación y 1 dueño por copia; permanecen doce aunque cambien de zona |
| Carta tipifica Copia | Tipo 0..N instancias; instancia 1 tipo. No son copias compartidas entre partidas |
| Partida contiene Turno | Partida 1..30 turnos, cada turno 1 partida; actor derivado de posición y paridad, 0..15 turnos por participación |
| Turno contiene Jugada | Turno 0..N jugadas; jugada 1 turno; orden único. Apertura y cierre no son subtipos de Jugada |
| Jugada se especializa | Total y disjunta: exactamente una Invocacion o un Ataque; cada hijo hereda la identidad del padre |
| Invocacion coloca Copia | Evento 1 copia; copia 0..1 invocaciones. En campo/descarte ya debe existir una |
| Ataque tiene atacante | Ataque 1 copia atacante; copia 0..N ataques históricos, máximo uno por turno |
| Ataque tiene objetivo | Dos relaciones 0..1: copia o participación/héroe, con XOR exactamente uno. Cada objetivo recibe 0..N ataques |
| Partida tiene ganador | Partida 0..1 participante ganador, necesariamente de esa partida; activa/empate sin ganador |
| Partida registra Solicitud | Partida 1..N solicitudes confirmadas; solicitud 1 partida. La clave nace antes; la fila final se inserta con la partida ya creada, en la misma transacción |
| Solicitud produce Jugada | Solicitud 0..1 jugadas; jugada 1 solicitud. Crear/cerrar turno producen cero, invocar/atacar producen una |

En Chen, las dos N:M se dibujan como relaciones con atributo cantidad o como asociaciones, sin representar el mismo hecho dos veces. Marcar la especialización con total/disjunta y el objetivo con su XOR independiente. Usar línea/atributo derivado para actor, turno actual y jugador de la participación. Los límites agregados, el ámbito de partida y la igualdad de composición necesitan notas y validación SQL, no se demuestran solo dibujando una línea.

## 4. Cuatro acuerdos, no otra ronda de planificación

| Acuerdo existente | Elección propuesta para validar | Estado |
|---|---|---|
| B1 | Colección por cantidades; mazo con dueño estable e inmutable al usarse; copias generadas exactamente desde su composición. Sin adquisición/bajas en este MVP | pendiente |
| B2 | Jugada solo invocación/ataque, especialización total/disjunta aceptada por docente; garantía SQL por rutinas/permisos y limpieza de errores | pendiente |
| B3 | Vida/energía/zona actuales almacenadas; estado de Partida derivado de fecha_fin; otros datos derivados y dos vidas previas históricas; claves/tipos/collation preliminares y solicitud confirmada global sin filas pendientes | pendiente |
| B4 | Reglamento 0.2 sin cambios, sorteo inicial, una activa por jugador y cierre letal/30; corregir diferencias de la demo al incorporar SQL | pendiente |

La elección física de una clave textual de carta y de vincular Jugada a su solicitud son propuestas de MR, no cambios del juego. La limpieza local ante error refuerza el contrato transaccional anterior sin introducir COMMIT internos; se explica en el MR. Ningún acuerdo está aprobado por existir este archivo.

Para cerrar el Hito 1: el grupo dibuja/revisa su `.drawio`, registra B1–B4 y aceptación docente de la estructura avanzada, y recorre los ejemplos/escenarios existentes. La referencia de Hito 2 sirve para discutir y corregir ese dibujo; no sustituye la revisión ni debe presentarse como esquema definitivo aprobado.

## 5. Alcance y verificaciones de esta revisión

La IA revisó documentos y código en solo lectura, con auditorías paralelas de brecha y de las tres garantías críticas. Se agregaron únicamente este anexo y la referencia relacional enlazada; no se editaron antecedentes ni aplicación. Se comprobaron enlaces y estructura documental y se contrastaron mecanismos con documentación MariaDB. No se conectó una base ni se ejecutaron pruebas SQL. No se repitieron pruebas de la demo sin cambios, ni hubo commits o despliegues.
