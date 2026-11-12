# Entidades y relaciones candidatas

**Propuesta para que el grupo construya y valide el MER en el Hito 1. No es un MER definitivo ni un modelo relacional aprobado.** Los nombres son provisionales y no fijan columnas, claves físicas o sintaxis SQL.

## Separar catálogo, propiedad y copia de partida

Una `Carta` identifica un tipo del catálogo, por ejemplo el ancho de espadas. `Coleccion_Jugador` expresa cuántas copias posee una persona. `Mazo_Carta` expresa cuántas de ellas desea incluir en un mazo. `Copia_Carta_Partida` representa una instancia concreta creada para una partida.

Si se incluyen dos anchos de espadas, se crean dos instancias distintas. Cada una tiene una única zona actual: mazo, mano, campo o descarte. No se crean cuatro tablas independientes de zonas que permitan que la misma copia figure en varias a la vez.

Las copias de partida no son préstamos que resten disponibilidad de la colección: son la materialización de la composición seleccionada para ese enfrentamiento.

## Candidatos y responsabilidad

| Candidato | Información propia propuesta | Relaciones a estudiar |
|---|---|---|
| Jugador | Identidad, alias, fecha y posible archivo lógico | Una colección, varios mazos y participaciones |
| Carta | Palo, número, ataque base, vida base, energía, jerarquía | Colecciones, mazos y copias; combinación palo/número única |
| Coleccion_Jugador | Cantidad poseída | Asociación N:M Jugador–Carta con cantidad propia |
| Mazo | Dueño, nombre, creación y archivo | Un dueño; varios tipos de carta; utilizado en participaciones |
| Mazo_Carta | Cantidad incluida | Asociación N:M Mazo–Carta con cantidad propia |
| Partida | Estado, inicio/fin, ganador opcional, motivo de cierre y versión de concurrencia | Exactamente dos participantes una vez activa; varios turnos |
| Participante_Partida | Jugador, mazo utilizado, posición inicial y vida actual del héroe | Pertenece a una partida; posee 12 copias; juega varios turnos |
| Turno | Número global, participante activo, energía disponible, inicio y cierre | Pertenece a una partida y a un participante de esa misma partida; contiene jugadas |
| Copia_Carta_Partida | Carta de catálogo, participante dueño, posición original, zona, vida temporal, turno de invocación y último turno de ataque | Una instancia dentro de una sola participación |
| Jugada | Turno, secuencia y momento de una acción exitosa | Su actor se obtiene del turno; exactamente un subtipo |
| Invocacion | Copia invocada | Especialización de Jugada |
| Ataque | Copia atacante; objetivo carta o héroe; evidencia del intercambio | Especialización de Jugada |
| Solicitud_Operacion | Clave de idempotencia, tipo, huella de parámetros, partida y versión resultante | Evidencia técnica de operaciones de partida confirmadas; incluye inicio y cierre de turno |

Son 12 candidatos de dominio más uno técnico. Aunque alguno se combine al revisar el modelo, el alcance permite superar ocho tablas con funciones justificables. Una tabla de palos sería opcional: cuatro valores también pueden ser un dominio restringido si no tienen otros atributos. No se añaden filas ficticias a un catálogo pequeño para alcanzar quince registros.

## Cardinalidades y restricciones conceptuales

- Un jugador puede tener cero o muchos mazos; un mazo tiene exactamente un dueño.
- Cada par jugador/carta aparece como máximo una vez en colección; cada par mazo/carta, como máximo una vez en composición. Las cantidades pertenecen a la asociación completa.
- Un mazo puede estar incompleto mientras se edita. La participación solo se crea si la composición suma exactamente 12 y se conserva al iniciar la partida.
- Una partida activa o finalizada tiene dos participaciones distintas, con jugadores y posiciones diferentes. Una participación utiliza un mazo de su jugador. Si existe un estado interno de preparación, no será visible ni persistirá tras fallar el inicio.
- Un jugador solo participa en una partida activa a la vez en el MVP propuesto. Esta restricción se reconsiderará si se habilitan varias salas.
- Cada participación tiene exactamente 12 copias al finalizar la operación de inicio. Dentro de ella las posiciones originales 1–12 no se repiten.
- Una copia pertenece al mismo participante durante toda la partida. La posición original no cambia al robar; se elige la menor de las que siguen en zona mazo.
- El turno referencia un participante de su propia partida. Los números globales no se repiten dentro de ella. Solo puede existir un turno abierto y debe corresponder a la alternancia establecida.
- La invocación y el atacante pertenecen al actor del turno. Los objetivos pertenecen al otro participante de la misma partida.
- El objetivo de ataque es **una copia o un héroe, exactamente uno**. Se estudiarán dos referencias opcionales con exclusión mutua, evitando un identificador genérico cuyo destino no pueda proteger una FK.

El Hito 2 debe decidir cómo expresar las referencias del mismo ámbito mediante claves y restricciones, y qué parte necesita rutinas. No alcanza con FKs independientes si permiten cruzar cartas o participantes de partidas distintas.

## Estructura avanzada recomendada: especialización de Jugada

Se propone una especialización **total y disjunta**: toda jugada exitosa es una invocación o un ataque, y nunca ambos. Los datos comunes quedan en Jugada; cada subtipo tiene sus datos específicos y comparte su identidad. La inserción del padre y su subtipo se realiza conjuntamente.

Su función observable es mostrar una línea temporal: «invocó el siete de oros» o «atacó al ancho de bastos». Los campos obligatorios y las validaciones de un ataque difieren de los de una invocación. Un cambio de turno se registra mediante el cierre/apertura de Turno, no como una tercera clase vacía de jugada.

Las FKs por sí solas no garantizan que exista exactamente un subtipo. Se propondrán rutinas con permisos limitados y comprobaciones de tipo/exclusividad; su solución física y pruebas directas de SQL deben resolverse en el Hito 2/3. Confirmar con el docente que reconoce esta especialización como estructura avanzada.

**Alternativas examinadas:** una ventaja reflexiva Carta–Carta alteraría el combate y exigiría otra matriz de balance; no se recomienda en el MVP. Llamar ternaria a una asociación que solo añade una FK redundante tampoco demuestra una relación ternaria real. Si la especialización no es aceptada, el grupo debe rediseñar esta parte antes de aprobar el modelo; no añadir una relación decorativa.

## Estado e historial sin doble registro

`Copia_Carta_Partida` reemplaza como nombre más claro al candidato `Estado_Carta_Partida`. Contiene el estado actual y su identidad permanece aunque cambie de zona.

`Historial_Combate` se propone como consulta o vista sobre Ataque, Jugada, Turno y las referencias correspondientes. No se añade otra tabla que duplique cada ataque. El descarte se representa por la zona de la copia y el ataque que produjo su muerte; un registro separado de descartes solo se justificaría si aparecen otras causas de descarte.

Para auditar un combate se consideran vidas anteriores y posteriores y daños aplicados en Ataque. Son hechos históricos de ese instante; no deben confundirse con la vida actual de la copia. Se documentará cada dato redundante de auditoría si finalmente se guarda. Una eliminación por contraataque se atribuye a la carta defensora, incluso si ambas mueren.

Los mazos utilizados quedan inmutables y las 12 instancias conservan la composición de cada partida. Esto evita que editar un mazo reescriba las estadísticas históricas. Cambiar el catálogo durante partidas o después de generar un historial invalidaría reconstrucciones: para el MVP se congela la versión del catálogo; el versionado de reglas/cartas se estudiará antes de una actualización pública.

## Dependencias funcionales a revisar en el Hito 2

Estos son argumentos iniciales, **no una certificación de 3FN**:

- La identidad de Carta y su combinación única palo/número determinan sus atributos base para el catálogo congelado. El nombre visible puede formarse en la API a partir del número y palo; se decidirá si hace falta un nombre editorial almacenado.
- El par jugador/carta determina cantidad poseída; el par mazo/carta determina cantidad incluida. No guardar el alias del jugador ni el nombre del palo en esas asociaciones.
- Mazo determina su dueño. No repetir el dueño en Mazo_Carta solo para facilitar consultas; la disponibilidad se comprueba por relación con Mazo y Coleccion_Jugador.
- Turno determina actor y partida. No duplicar actor y partida en Jugada sin una razón y una restricción de consistencia documentadas.
- Copia determina su tipo de carta y estado temporal. No copiar ataque base, palo, jerarquía o nombre a cada instancia mientras no exista una necesidad de snapshot/versionado aprobada.
- Jugada determina su subtipo y datos de evento. Una Invocacion/Ataque depende de esa identidad completa, sin repetir los datos comunes.
- Cantidad del mazo, energía máxima, turno propio, número de cartas en campo y ranking se calculan a partir de sus fuentes. No añadir contadores permanentes sin necesidad medida.
- La vida del héroe y la energía disponible son estados mutables usados por las operaciones; se guardan y cambian atómicamente junto con sus eventos. No basta con decir «se derivan» si su reconstrucción exige reproducir toda la partida.
- La versión de concurrencia y la huella de solicitud son datos técnicos justificados para evitar solicitudes obsoletas o repetidas; no sustituyen la integridad del dominio.

El grupo debe enumerar atributos y claves candidatas, verificar dependencias completas y transitivas, y justificar snapshots y estados antes de afirmar 3FN. Una tabla con más de una FK no es por sí misma una prueba de normalización.
