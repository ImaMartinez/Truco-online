# Construcción manual del MER en draw.io

Actualización de cierre 03/11/2026: usar esta guía junto con [auditoría y normalización resueltas técnicamente](../hito-2/02-auditoria-implementacion.md) y [MR/diccionario verificado](../hito-2/01-modelo-relacional-preliminar.md). No es necesario crear otra guía ni otro diagrama por IA. Estado de Partida y momento de Jugada se dibujan **derivados** de fecha_fin y Solicitud_Operacion; el barajado real lo realiza SQL. El costo es independiente de la jerarquía. B1–B4 siguen pendientes de ratificación del grupo.

Identificadores conceptuales por revisar: Jugador(identidad/alias); Carta(tipo identificado por palo+número y código estable); Mazo(identidad, o dueño+nombre); Coleccion_Jugador(par jugador+tipo); Mazo_Carta(par mazo+tipo); Partida(identidad); Participante(Partida+posición); Copia(Participante+posición original, conservando identidad al cambiar zona); Turno(Partida+número global); Jugada(Turno+orden); Invocacion y Ataque(identidad heredada de Jugada); Solicitud_Operacion(UUID global). En el MR existen IDs globales adicionales; no confundir su elección física con una entidad nueva ni duplicar los atributos heredados.

Usar después de revisar B1–B4 en [la matriz](07-matriz-de-decisiones-cierre.md). El grupo construye el diagrama; esta guía no es un MER generado ni una aprobación. El inventario completo de atributos/cardinalidades sigue en [el candidato](04-modelo-conceptual-candidato.md); aquí se indica qué decidir y cómo comprobar el dibujo.

## Preparar el archivo y la notación

1. Abrir draw.io/diagrams.net o su aplicación de escritorio y crear un diagrama vacío. Guardar el archivo editable con extensión `.drawio`, nombre de versión y autores. La [documentación oficial de formatos](https://www.drawio.com/docs/manual/editor/save-file-formats/) recomienda ese formato.
2. Acordar con el docente la notación. Para esta guía se propone **Chen extendida**: rectángulos para entidades, rombos para relaciones, óvalos para atributos y un círculo de especialización con `d`. Pueden componerse con formas básicas; la biblioteca Entity Relation se habilita desde More Shapes según la [guía oficial de formas](https://www.drawio.com/docs/diagram-types/entity-relationship-tables/).
3. Escribir una leyenda propia: `(mínimo,máximo)` junto a una entidad expresa cuántas instancias de la relación puede integrar **esa entidad**. No mezclar esa lectura con los extremos de pata de cuervo, cuya colocación es diferente. Usar `N` para muchos y notas para límites condicionales.
4. Marcar atributos derivados con óvalo discontinuo y relaciones derivadas con línea discontinua rotulada «derivada». Las observaciones históricas deben distinguirse de atributos actuales. La convención debe quedar visible; no depender solo del color.
5. No añadir columnas FK, tipos SQL ni todas las claves sustitutas por anticipado. Si el docente pide identificadores conceptuales, señalar los del candidato y las identidades dentro de Partida/Turno; elegir su implementación corresponde al Hito 2.

## Dibujar por bloques

La columna «Verificación» lee las cardinalidades en palabras para evitar invertirlas. No copiar una línea sin resolver la decisión de su última columna.

| Bloque | Entidades/atributos principales y relaciones por revisar | Verificación de mínimos/máximos | Antes de dibujar |
|---|---|---|---|
| Propiedad | Jugador (alias, alta/archivo), Carta (nombre, palo, número, ataque/vida/costo/jerarquía), Mazo (nombre, creación/archivo); Jugador posee Mazo | Un jugador tiene 0..N mazos; cada mazo exactamente 1 dueño | B1: dueño inmutable e historial estable |
| Colección N:M | Relación posee entre Jugador y Carta, con atributo cantidad poseída; nombre documental Coleccion_Jugador | Jugador posee 0..40 tipos; Carta pertenece a 0..N colecciones; cantidad positiva por par | D01: ausencia de fila = no poseída; no crear otra entidad Colección sin información propia |
| Composición N:M | Relación contiene entre Mazo y Carta, con cantidad incluida; nombre documental Mazo_Carta | Mazo contiene 0..12 tipos en borrador; Carta aparece en 0..N mazos; listo requiere 6..12 tipos y suma 12 | B1/B4: cantidad 1–2, disponibilidad por dueño y sumas; doce copias no significa doce tipos |
| Participación | Partida (estado, fechas, motivo), Participante_Partida (posición inicial, vida del héroe); relaciones con Partida y Mazo | Partida tiene exactamente 2 participaciones; cada participación pertenece a 1 partida y usa 1 mazo; mazo usado en 0..N participaciones | D06/H04: jugador derivado vía Mazo; participantes con dueños distintos y máximo una activa por jugador |
| Instancias | Copia_Carta_Partida (posición original, zona, vida actual), propiedad por Participante y tipo por Carta | Participación posee exactamente 12 copias; cada copia tiene 1 dueño y 1 tipo; un tipo tiene 0..N instancias | H03/H06: vida según zona; no usar Carta de catálogo como objetivo individual |
| Turnos | Turno (número global, energía, fechas), contenido en Partida; actor derivado desde posición/paridad | Partida tiene 1..30 turnos; turno pertenece a 1 partida y tiene 1 actor; participación actúa 0..15 veces | B3/B4: único abierto si activa, ninguno si finalizada; no duplicar actor ni turno actual |
| Acciones | Jugada (orden, fecha/hora) dentro de Turno; Invocacion relacionada con Copia | Turno contiene 0..N jugadas; cada una pertenece a 1 turno; invocación usa 1 copia; copia tiene 0..1 invocaciones | B2/H06: Jugada solo contiene dos clases; cierre se representa en Turno |
| Combate | Ataque (vidas previas), rol atacante de Copia, roles objetivo carta y objetivo héroe/Participante | Ataque tiene 1 atacante; 0..1 copia objetivo y 0..1 héroe objetivo, **exactamente uno**; cada objetivo recibe 0..N ataques históricos | H07: aceptar snapshots; exclusión de objetivos, rivales y misma partida; máximo un ataque por copia/turno |
| Resultado | Relación gana entre Partida y Participante | Partida tiene 0..1 ganador; una participación gana 0..1 partida, siempre la propia | D02/H01: activa sin ganador; finalizada sin ganador significa empate; motivo y cierre coherentes |
| Soporte técnico | Solicitud_Operacion (clave, clase, huella, versión), relacionada con Partida y opcionalmente Jugada | Una partida tiene 1..N solicitudes confirmadas; una solicitud pertenece a 1 partida y produce 0..1 jugadas; cada jugada proviene de 1 solicitud | H08: separar visualmente soporte; no contar solicitudes como un tercer subtipo |

En notación Chen, Coleccion_Jugador y Mazo_Carta pueden representarse como relaciones N:M con el óvalo cantidad conectado al rombo. Si el docente prefiere entidades asociativas, usar esa alternativa y sustituir cada relación N:M por sus dos vínculos: no dibujar además otra relación independiente para el mismo hecho. No hace falta aprobar una entidad nueva por elegir otra notación del mismo hecho.

En copia y participación, «exactamente 12» y «exactamente 2» se refieren al estado confirmado, no a los pasos intermedios de una transacción de inicio. Los rectángulos de MAZO/MANO/CAMPO/DESCARTE serían una duplicación equivocada de la instancia: son valores de su zona, no cuatro poblaciones independientes.

## Representar la especialización

Conectar Jugada a un círculo `d` y de allí a Invocacion y Ataque. Usar doble línea entre el supertipo y el círculo para participación total, y explicar en la leyenda: toda Jugada pertenece a uno y solo uno de esos subtipos. Es herencia, no dos relaciones 1:N comunes. Confirmar esta convención con el docente si utiliza otra notación EER.

Invocacion hereda el turno/orden de Jugada y agrega el vínculo a una copia. Ataque hereda esos datos y agrega atacante/objetivo y observaciones del intercambio. No repetir los atributos heredados en ambos hijos. Escribir la nota «cierre de turno no es Jugada» y conectar ese hecho a Turno.

El objetivo de Ataque requiere otra exclusión, distinta de la especialización: carta **o** héroe. Rotular la condición XOR/exactamente uno entre sus dos relaciones opcionales. Dos líneas 0..1 solas permiten que falten ambos o existan ambos y no bastan para describir la regla.

## Anotaciones obligatorias junto al dibujo

- Cantidad de mazo = suma de cantidades de composición, máximo 12 y exactamente 12 para iniciar; no es un atributo contador adicional.
- Cantidad incluida por tipo ≤ cantidad poseída por el dueño; no se suman usos entre mazos.
- Carta describe el tipo; Copia describe una instancia y su zona/vida. Dos copias del mismo tipo pueden estar en zonas diferentes.
- Actor, preparación y ataque consumido se obtienen de sus fuentes. Vida/energía actuales son estado operativo; vidas previas de Ataque son observaciones históricas justificadas.
- Participantes, copias, turnos, atacante, objetivos y ganador deben estar en la misma partida; atacante y objetivo son rivales. Una FK de existencia aislada no expresa esa condición completa.
- Turno global, apertura/robo, cierre letal y límite 30 siguen 0.2; las reglas de [la trazabilidad](09-validacion-reglas-y-cierre.md) acompañan al MER aunque no sean dibujables como una cardinalidad.

## Validar y entregar para auditoría

Recorrer sobre el diagrama los escenarios E01, E03, E08, E10, E14–E18 del [documento existente](06-revision-del-grupo-y-escenarios.md), además de sus secuencias completas de victoria y empate. Para cada paso, señalar qué instancia cambia, qué evento se crea y dónde se obtiene cada dato. Si hay que inventar una columna o vínculo para explicarlo, corregir el dibujo antes de aprobarlo.

Conservar el `.drawio` editable y una exportación legible PNG/PDF con el mismo número de versión, autores, leyenda y acuerdos B1–B4. El grupo podrá entregar esos archivos junto con la matriz actualizada para una auditoría crítica de cardinalidades, especialización, redundancias, cobertura de reglas y cumplimiento de la consigna. La auditoría de IA identifica defectos; la aprobación final sigue siendo del grupo/docente.
