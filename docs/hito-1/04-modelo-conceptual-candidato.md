# Modelo conceptual candidato para construir el MER

**Borrador para discusión; no es el MER definitivo ni su traducción relacional.** Se proponen hechos, roles, atributos y cardinalidades, sin elegir tipos SQL, claves físicas o una representación que el grupo no haya validado. Se interpreta la «relación N con atributos» del pedido como la relación **N:M** exigida originalmente.

## Entidades y atributos propuestos

Las identidades indicadas son conceptuales; no implican que cada una necesite un ID numérico global. «Referencia» nombra un vínculo con otra entidad, no una decisión anticipada de columnas.

| Candidato | Atributos propios recomendados | Referencias/roles conceptuales |
|---|---|---|
| Jugador | Identidad, alias, fecha de alta, fecha de archivo opcional | Posee colección y mazos; participa mediante el mazo seleccionado |
| Carta | Identidad del tipo, nombre editorial, palo, número, ataque base, vida base, costo de energía, jerarquía | Aparece en colecciones/composiciones y tipifica copias. Nombre y estadísticas se consultan del catálogo SQL |
| Coleccion_Jugador | Cantidad poseída positiva | Asociación de un jugador y un tipo de carta; par sin duplicados |
| Mazo | Identidad, nombre, fecha de creación, fecha de archivo opcional | Un dueño; composición; usos en participaciones |
| Mazo_Carta | Cantidad incluida: 1 o 2 | Asociación de un mazo y un tipo de carta; par sin duplicados |
| Partida | Identidad, estado ACTIVA/FINALIZADA, fecha de inicio, fecha de fin opcional, motivo de cierre opcional, versión técnica | Dos participaciones; turnos; ganador opcional de esas participaciones |
| Participante_Partida | Identidad dentro de su partida, posición inicial 1/2, vida actual del héroe | Una partida y un mazo seleccionado. Jugador derivado del propietario del mazo |
| Turno | Número global dentro de la partida, energía disponible, fecha de apertura y de cierre opcional | Una partida; actor derivado de paridad y posición inicial; jugadas |
| Copia_Carta_Partida | Identidad de instancia, posición original 1–12, zona actual, vida actual opcional antes de invocar | Una participación dueña y un tipo del catálogo. Invocación/ataques se obtienen de eventos |
| Jugada | Identidad del evento, orden dentro del turno, fecha/hora | Un turno; exactamente un subtipo; una solicitud técnica que la originó |
| Invocacion | Sin repetir atributos comunes; el hecho específico es qué copia se invocó | Subtipo de Jugada; una copia propia |
| Ataque | Vida previa del atacante y vida previa del objetivo como observaciones históricas | Subtipo de Jugada; una copia atacante; objetivo copia **o** participación/héroe, excluyentes |
| Solicitud_Operacion | Clave única de reintento, clase de comando, huella de parámetros normalizados, fecha y versión resultante | Una partida confirmada; cero o una jugada asociada |

Coleccion_Jugador y Mazo_Carta son asociaciones con atributos propios, no catálogos independientes. Invocacion necesita su vínculo específico a la copia aunque no añada otra cifra: no es un subtipo vacío. Solicitud_Operacion es soporte técnico para no duplicar comandos ante reintentos; no cuenta como una nueva mecánica ni sustituye Jugada. El grupo puede separarlo visualmente del dominio en su MER y debe decidir cómo representarlo al pasar al modelo relacional.

## Relaciones y cardinalidades propuestas

Cada intervalo se interpreta desde una instancia de la entidad nombrada, contando las relacionadas. Son restricciones sobre estados confirmados, no sobre las inserciones intermedias de una transacción.

| Relación | Cardinalidades y participación |
|---|---|
| Jugador posee Mazo | Jugador: 0..N mazos; Mazo: exactamente 1 dueño |
| Jugador posee Carta, mediante Coleccion_Jugador | Jugador: 0..40 tipos; Carta: 0..N jugadores; cada asociación une exactamente 1 de cada lado |
| Mazo contiene Carta, mediante Mazo_Carta | Mazo: 0..12 tipos mientras es borrador; Carta: 0..N mazos; cada asociación une exactamente 1 de cada lado. Mazo listo: 6..12 tipos y suma de cantidades = 12 |
| Partida tiene Participante_Partida | Partida: exactamente 2; Participante: exactamente 1 partida. Posiciones distintas y propietarios de mazos distintos |
| Mazo se usa en Participante_Partida | Mazo: 0..N participaciones históricas; Participante: exactamente 1 mazo. Si se archiva no admite nuevos usos, sin perder los anteriores |
| Jugador participa en Partida | Relación conceptual N:M derivada de Partida → Participante → Mazo → Jugador. Cada partida tiene 2 jugadores distintos; jugador 0..N históricas y como máximo 1 activa |
| Participante posee Copia_Carta_Partida | Participante: exactamente 12 instancias; Copia: exactamente 1 participante |
| Carta tipifica Copia_Carta_Partida | Carta: 0..N instancias; Copia: exactamente 1 tipo |
| Partida contiene Turno | Partida: 1..30 turnos; Turno: exactamente 1 partida. Números consecutivos desde 1, sin duplicados |
| Participante actúa en Turno | Participante: 0..15 turnos; Turno: exactamente 1 actor, derivado de la posición y paridad dentro de su propia partida |
| Turno contiene Jugada | Turno: 0..N jugadas; Jugada: exactamente 1 turno. Orden de acciones único y creciente dentro del turno |
| Jugada se especializa | Cada Jugada corresponde a exactamente 1 Invocacion **o** exactamente 1 Ataque; los subtipos comparten su identidad |
| Invocacion coloca Copia | Invocacion: exactamente 1 copia; Copia: 0..1 invocaciones en toda la partida. En campo/descarte ya debe tener una |
| Copia origina Ataque | Ataque: exactamente 1 atacante; Copia: 0..N ataques históricos y como máximo 1 por turno |
| Ataque apunta a Copia | Ataque: 0..1 copia objetivo; Copia: 0..N ataques recibidos. Si no hay copia objetivo debe haber héroe objetivo |
| Ataque apunta a héroe/Participante | Ataque: 0..1 participación objetivo; Participante: 0..N ataques recibidos. Copia y héroe objetivo no pueden aparecer juntos ni faltar ambos |
| Partida tiene ganador Participante | Partida: 0..1 ganador; Participante: ganador de 0..1 partida, necesariamente la suya. Una activa o un empate no tiene ganador |
| Partida registra Solicitud_Operacion | Partida: 1..N operaciones confirmadas, incluida su creación; Solicitud: exactamente 1 partida |
| Solicitud_Operacion produce Jugada | Solicitud: 0..1 jugadas; Jugada: exactamente 1 solicitud. Invocar/atacar producen una; iniciar/finalizar turno producen cero |

No basta con escribir «1:N» para garantizar que existan exactamente doce copias o dos participantes. Son restricciones adicionales que validan las operaciones SQL. Los límites condicionales (partida activa, copia en campo, mazo listo) deben acompañar el dibujo del grupo como reglas textuales.

## Dos relaciones N:M con atributos

En `Mazo_Carta`, la cantidad depende del **par mazo/carta**, no de la carta sola ni del mazo solo. Ejemplo: Mesa de espadas contiene dos ESP-05, y otro mazo podría contener una. El par no se repite, su cantidad máxima es dos y la suma por mazo no supera doce.

En `Coleccion_Jugador`, la cantidad depende del par jugador/carta. Poseer una copia permite incluir una de ese tipo en cada mazo, pero no dos dentro del mismo mazo. No se suman los usos entre mazos: tener cinco mazos no consume cinco veces la colección. No se necesita una entidad «Colección» adicional sin atributos propios.

## Especialización total y disjunta de Jugada

El supertipo contiene orden, momento y turno. Invocacion incorpora la copia que entra al campo. Ataque incorpora atacante, objetivo y observaciones del combate. **Total:** ninguna jugada queda sin subtipo. **Disjunta:** una jugada no es invocación y ataque a la vez.

Es útil en la línea temporal y las estadísticas, además de permitir restricciones distintas para cada acción. El grupo debe justificar esta utilidad ante el docente. Cerrar un turno no es otra Jugada en este vocabulario: se registra en Turno y en la operación técnica. Esto conserva una especialización pequeña, con dos hechos diferentes, sin inventar un tercer subtipo solo para completar la consigna.

Una futura FK de subtipo a supertipo garantiza existencia del padre, pero no totalización ni exclusión entre hijos por sí sola. La creación del padre y su hijo debe quedar en procedimientos autorizados, dentro de una transacción, y rechazar combinaciones incoherentes. Se estudian claves, discriminador o triggers en el Hito 2; no se finge que la especialización está impuesta por SQL todavía.

## Simplificaciones y normalización pendiente

1. **Jugador de la participación.** Dado un mazo, se conoce su dueño. Se propone conservar ese dueño inmutable y obtener al jugador por esa ruta. La participación sigue representando al jugador conceptualmente, sin duplicar obligatoriamente `jugador` y `mazo` como datos almacenados. Si el grupo decide guardarlos ambos, debe demostrar por qué no introduce dependencia transitiva o justificar expresamente la redundancia; una FK extra no demuestra 3FN.
2. **Actor y turno actual.** Partida agrupa Turno, y la paridad del número global elige la posición inicial del actor. No se propone guardar además el mismo actor como otro atributo independiente. El turno actual se obtiene del único abierto; no se agrega una referencia circular a Partida por comodidad.
3. **Preparación y agotamiento.** El turno de invocación se obtiene de Invocacion → Jugada → Turno. El ataque ya consumido se verifica por existencia de Ataque de esa copia en ese turno. No guardar simultáneamente esas fuentes y banderas «preparada», «atacó» o «último ataque» sin necesidad medida.
4. **Estado operativo.** Zona, vida actual del héroe/copia y energía disponible sí se conservan para ejecutar la siguiente operación y reanudar sin reproducir todo el historial. Deben actualizarse junto con sus eventos. La justificación es operativa y explícita, no la afirmación de que nunca pueden derivarse.
5. **Observaciones de ataque.** Las dos vidas previas son hechos del instante del intercambio y permiten consultar eliminaciones sin reproducir toda la secuencia. Son una redundancia histórica deliberada respecto del estado anterior, que el grupo debe aceptar. No se copian ataque base, palo o costo a Ataque ni se guardan además todos los daños y vidas posteriores. Estos se calculan con el catálogo congelado. Si se exige cero snapshots, estudiar reconstrucción completa y el costo de las consultas antes de quitarlos.
6. **Sin tabla de historial duplicada.** La historia se consulta desde Partida, participaciones, Turno, Jugada, subtipos y las identidades de copia. No crear tablas separadas para mano, campo, descarte, resultado y cada combate si solo replican los mismos hechos.

Turno propio, energía máxima, tamaño de mano/campo, promedio de mazo y tipo de jugada por pertenencia al subtipo son datos derivados. Se propone conservar el nombre editorial en Carta para cumplir la especificación original de atributos de catálogo en SQL; no es un nombre duplicado en cada copia. Las claves y dependencias funcionales deben enumerarse formalmente en el Hito 2; este listado no certifica normalización ni impone una clave sustituta sobre una compuesta.

## Integridad de ámbito e historial

Atacante y objetivo deben pertenecer a la misma partida del turno y ser rivales. La copia invocada debe pertenecer al actor. Ganador solo puede referenciar una participación de la partida que termina. Los vínculos derivados tampoco eximen de validar estas condiciones al ejecutar una acción.

La composición del mazo usado, su dueño, la posición inicial de los participantes y el orden original de las copias no cambian. Así el historial puede reconstruir qué se repartió y robó, sin una tabla adicional de robos: las tres primeras posiciones fueron mano inicial; después se robó una por apertura propia 2–10. El orden de jugadas, no solo sus marcas horarias, permite reconstruir los combates.

El registro técnico conserva una huella de parámetros para detectar reutilización de clave con otro comando. No almacena todo el juego en JSON. Las operaciones fallidas revierten también ese registro; sus diagnósticos pueden ir al log del backend, separados del historial de jugadas exitosas.
