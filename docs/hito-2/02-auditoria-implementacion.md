# Auditoría del modelo implementado y guía de revisión humana

**Dictamen de cierre 03/11/2026:** el usuario precisó que jerarquía y costo son conceptos independientes y que el costo puede elegirse por tipo sin cambiar jerarquía. Bajo esa semántica, las trece relaciones satisfacen 1FN, 2FN y 3FN para las DF identificadas abajo. Es un dictamen técnico revisable, no aprobación humana del MER/MR. La reserva A01 del análisis anterior queda resuelta como interpretación de dominio; su texto se conserva como antecedente, no como impedimento vigente. No se requiere descomposición ni cambio del juego.

## Justificación final de normalización, tabla por tabla

Una DF es una regla para todos los estados legales del dominio, no una regularidad de un conjunto finito de filas. Las catorce jerarquías actuales tienen un único costo observado. Un SELECT puramente hipotético que cambia solo el costo de ESP-02 a 3 produce dos costos para jerarquía6, conservando jerarquía y números; no se ejecutó UPDATE. El costo sigue en1..5 y ninguna regla exige calcularlo desde jerarquía. Por tanto **jerarquia_truco → costo_energia no pertenece a F**. Tampoco ataque/vida obedecen una fórmula normativa del presupuesto editorial. La libertad conceptual de equilibrar una edición futura no autoriza editar estadísticas durante partidas ni romper el catálogo congelado del MVP: cambiarlo requeriría preservar la interpretación histórica antes de otra edición.

En la tabla, K representa cualquiera de las claves candidatas de la fila; «resto» son atributos de esa misma relación. Una clave candidata es mínima. Las claves declaradas son PK o UNIQUE NOT NULL; las semánticas inferidas se distinguen explícitamente. 1FN exige valores atómicos respecto de estos dominios, 2FN ausencia de dependencia parcial de atributos **no primos respecto de cualquier clave candidata**, y 3FN exige para cada X→A no trivial que X sea superclave o A primo.

| Tabla | Claves candidatas y DF relevantes | 1FN | 2FN | 3FN |
|---|---|---|---|---|
| jugador | id_jugador; alias. K→resto | Alias y fechas escalares; sin lista de mazos | Ambas claves simples | Ningún determinante no clave de atributo no primo identificado |
| carta | Declaradas id_carta y(palo,numero); semántica(palo,jerarquia_truco). K→resto; jerarquia_truco→numero | Código, palo, número y estadísticas escalares | La dependencia parcial jerarquía→número tiene RHS primo; los atributos no primos dependen de claves completas | Número es primo; jerarquía→número está permitida por3FN. No existe jerarquía→costo ni otra DF editorial no clave. **No BCNF**, pues jerarquía no identifica el palo |
| coleccion_jugador | (id_jugador,id_carta)→cantidad | Una fila por tipo poseído, cantidad escalar | Ninguna parte del par determina cantidad | No hay DF no clave adicional |
| mazo | id_mazo;(id_jugador,nombre). K→resto | Composición en filas hijas, sin arreglo en Mazo | Dueño solo no determina nombre/descripción ni fechas; nombre solo tampoco | No se almacena alias ni información dependiente del dueño |
| mazo_carta | (id_mazo,id_carta)→cantidad | Una cantidad por tipo incluido | Mazo o carta solos no determinan la cantidad de ese par | Sin atributos de catálogo ni totales repetidos |
| partida | id_partida→resto | Fechas, motivo, posición y versión escalares | Clave simple | Fecha_fin no determina por sí sola ganador/motivo; estado no se almacena. Las condiciones con NULL no constituyen otra clave |
| participante_partida | id_participante;(id_partida,posicion);(id_partida,id_mazo). K→resto | Participación/héroe única, sin lista de cartas | Ningún componente de las claves compuestas determina vida o posición del hecho completo | No duplica jugador: mazo→dueño pertenece a Mazo, no otra columna transitiva aquí |
| copia_carta_partida | id_copia;(id_participante,posicion_original). K→resto | Una copia, zona y vida escalar o NULL tipado | Participante o ordinal solos no determinan carta/vida/zona | No repite nombre/ataque/costo del catálogo, ni partida/mazo derivados de participante |
| turno | id_turno;(id_partida,numero_global). K→resto | Energía y fechas escalares | Número global solo no determina energía restante ni fechas de una partida | Energía máxima se calcula; no se duplica actor ni número propio |
| solicitud_operacion | clave_reintento;(id_partida,version_resultante). K→resto | UUID, huella y fecha escalares; sin JSON de snapshot | Partida o versión solos no identifican la operación | Huella no es clave ni determina un único comando registrado; clase no determina versión/fecha |
| jugada | id_jugada;(id_turno,orden_en_turno);clave_reintento. K→resto | Evento escalar, sin lista de acciones | Turno solo u orden solo no determinan solicitud/evento | Partida/actor/fecha se obtienen por fuentes, sin columnas transitivas. La DF de Solicitud a Partida cruza relaciones, no viola esta tabla |
| invocacion | id_jugada;id_copia. Cada uno→el otro | Una copia por evento | Claves simples; todos los atributos son primos | Ambas DF tienen determinante clave |
| ataque | id_jugada→resto | Dos FK objetivo opcionales con XOR, no una celda multivaluada | Clave simple; atacantes/objetivos se repiten entre eventos | Vidas previas son observaciones de ese evento, no funciones del tipo de carta ni de la copia aislada. Sin daño/vidas posteriores almacenados |

**Cierre por clausura de Carta:** jerarquía→número y(palo,número)→id_carta implican(palo,jerarquía)→id_carta→resto. Ninguno de sus dos componentes identifica todas las cartas, por lo que es una clave candidata semántica mínima, aunque no tenga UNIQUE propio. El catálogo congelado asegura actualmente esta interpretación; si se habilitara administración del catálogo, habría que validar también su correspondencia con la jerarquía tradicional. Las UQ declaradas y sus CHECK solo validan rangos/código, no esa tabla tradicional completa. La ausencia de una UQ redundante no invalida el razonamiento conceptual; tampoco debe confundirse una DF semántica con una restricción SQL ya declarada.

Las fechas opcionales y objetivos NULL se interpretan como atributos opcionales de hechos, no como claves candidatas nullable. Una condición de zona/vida, un rango o un límite agregado no equivalen a una DF global. Las relaciones satisfacen3FN **bajo F explícito y el alcance del MVP**, sin afirmar que todo esquema futuro o toda regla imaginable también lo satisfaga. No se detectó una violación real que obligue a descomponer.

## Conciliación final de B1–B4

| Bloque | Correspondencia actual | Qué debe registrar el grupo |
|---|---|---|
| B1 | Cantidad por tipo, sin intercambio/baja en MVP; rutinas bloquean cambios en mazo utilizado. Dueño derivado por Mazo mantiene historia | Ratificación de inmutabilidad y alcance de colección; no hay aprobación registrada |
| B2 | Jugada tiene exactamente Invocacion o Ataque por caminos autorizados; pasar turno no es Jugada. PK compartida, triggers de exclusión, rutinas y permisos | Aceptación conceptual y docente de total/disjunta y explicación de por qué FK sola no basta |
| B3 | Vida/energía/zona operativas y vidas previas históricas almacenadas; actor, estado, agotamiento, totales y vidas posteriores derivados. Costo independiente según aclaración del usuario | Ratificar fuentes, DF y redundancia temporal justificada; la aclaración no aprueba automáticamente el bloque completo |
| B4 | Las24 reglas de0.2 tienen representación y motor; cierre inmediato letal y límite al finalizar global30 | Ratificar reglamento y restricciones entre filas, además de cardinalidades |

No hay contradicción funcional nueva con estos cuatro bloques. Límites que deben explicarse: un administrador puede saltar rutinas; editar catálogo usado rompería cálculos históricos; no existen endpoints de intercambio/archivo. Eso no autoriza inventar nuevas entidades ni modificar reglas. El mínimo8tablas, las dos N:M, estructura avanzada, claves/restricciones y más de3reglasSQL están demostrados técnicamente; aprobación conceptual y docente siguen pendientes.

03/11/2026. **Revisión técnica provisional; B1–B4, MER, MR y 3FN no están aprobados por el grupo.** Este anexo contrasta la implementación con la consigna original aportada al proyecto, el [modelo conceptual candidato](../hito-1/04-modelo-conceptual-candidato.md), el [cierre conceptual](../hito-1/10-cierre-conceptual-para-persistencia.md), el [reglamento 0.2](../hito-1/02-reglamento-recomendado.md), la [matriz B1–B4](../hito-1/07-matriz-de-decisiones-cierre.md) y el [MR/diccionario preliminar](01-modelo-relacional-preliminar.md). No reemplaza esos antecedentes ni inventa acuerdos.

## Resultado y alcance de la inspección

Se revisaron `database/mariadb/01-schema.sql`, `02-routines.sql`, `04-combat.sql` y los permisos del instalador. Una consulta de solo lectura a `information_schema` de MariaDB local comprobó **13 tablas, 65 columnas, 13 PK, 20 FK, 11 UNIQUE adicionales a PK, 36 CHECK y 56 columnas NOT NULL**. Las nueve columnas nullable representan archivo, cierre/ganador, vida antes de invocar y objetivos alternativos; no equivalen a nueve relaciones opcionales.

No se encontró una incompatibilidad de representación que obligue a cambiar las tablas para jugar bajo 0.2. Esto acredita viabilidad técnica del modelo, no una demostración completa ni una aprobación humana de normalización. La aclaración del usuario fija el costo como atributo independiente; el grupo debe revisar y ratificar el conjunto de DF documentado.

Las pruebas ejecutadas, la instalación limpia, las consultas, la vista y los datos de defensa se registran en el paquete del [Hito 3](../hito-3/README.md); no se consideran aprobadas solo por inspeccionar código. Esta auditoría no realizó escrituras en la base ni cambios de esquema.

## Hallazgos y correcciones mínimas propuestas

Gravedad alta = puede impedir defender un requisito académico; media = límite que debe explicarse; baja = precisión documental. No se identificó aquí un defecto crítico que haga perder partidas por los caminos autorizados.

| ID / gravedad | Hallazgo | Corrección mínima propuesta / estado |
|---|---|---|
| A01 — reserva técnica resuelta por aclaración del usuario; ratificación B3 pendiente | El MR enumera claves, pero su afirmación preliminar de ausencia de determinantes no clave no analiza `jerarquia_truco → costo_energia`, observada en las 40 filas | Resolver en B3 si es una regla general o una coincidencia editorial del catálogo 0.1. Si es regla, revisar la descomposición antes de declarar 3FN; ver análisis inferior. **Sin cambio de esquema en esta auditoría** |
| A02 — media, límite del mecanismo | FK hijo→padre no impone por sí sola totalidad/disyunción de Jugada; un administrador puede insertar un padre sin hijo o borrar historia | Defender la garantía de `ta_invocar`/`ta_atacar`, comprobación del subtipo, SAVEPOINT/handler y rol sin DML. No afirmar una garantía declarativa absoluta frente al administrador |
| A03 — media, integridad histórica condicionada | Dueño/composición de mazos usados y catálogo congelado son condición de la historia derivada. Un administrador puede cambiarlos | Mantener rol de aplicación limitado y no conceder CRUD directo; revisión humana de B1. Si se habilita edición administrativa futura, diseñar versionado antes de usarla; no añadirlo en este MVP |
| A04 — media, defensa de cardinalidades | CHECK/FK no obligan por sí solos a dos participantes, doce copias, un turno abierto o una activa por jugador | Asociar esas cardinalidades a rutinas, postcondiciones y transacciones; distinguir el MER del mecanismo físico que las exige |
| A05 — baja, diferencia de ejecución | MR §4.3 proponía permutación JSON preparada por Node; ahora `ta_iniciar_partida` expande `mazo_carta` y baraja en SQL con `ORDER BY RAND()` | Registrar la diferencia: mantiene multiconjunto exacto y sorteo dentro de la transacción, sin cambiar regla ni tabla. No es una garantía criptográfica |
| A06 — baja, antecedente histórico | El candidato mostraba estado de Partida y momento de Jugada como atributos propios; el MR y SQL los obtienen de fecha_fin y Solicitud_Operacion | Dibujar como derivados o anotar su fuente, sin añadir otra columna para hacer coincidir un borrador anterior |
| A07 — media, aprobación humana | Existen scripts funcionales, pero no hay aceptación humana de B1–B4 ni del significado de la especialización | El grupo debe registrar sus acuerdos y defender su propio diagrama; la ejecución de código no sustituye esa revisión |

## PK, FK, dominios y alcance de las garantías

| Bloque | Comprobación de implementación |
|---|---|
| Identidades y asociaciones | PK simples en entidades; pares completos en `coleccion_jugador` y `mazo_carta`; PK compartida Jugada/subtipos. El código natural de Carta no se confunde con ID de instancia |
| Claves alternativas | Alias; (palo,numero); (dueño,nombre de mazo); (partida,posicion); (partida,mazo); (participante,posicion_original); (partida,numero_global); (partida,version_resultante); (turno,orden); clave de solicitud de Jugada; copia de Invocacion |
| Integridad referencial | Veinte FK explícitas, tipos/signos/collations compatibles y RESTRICT. Ganador usa FK `(id_partida,ganador_posicion)` a `(id_partida,posicion)` de Participante: impide un ganador de otra partida |
| Dominios | CHECK de valores de palo/número/código coherentes; cantidades 1–2; vida/energía/posición/global; nombre/alias no vacíos; fechas coherentes; zona/vida condicional; XOR del objetivo de Ataque; cierre/ganador/motivo coherentes |
| Ámbito del juego | Mismo duelo, rival correcto, actor/versión, propiedad, preparación, ataque usado y colección se comprueban bajo bloqueo en las rutinas; tener una FK a una copia existente no prueba pertenencia a la partida |
| Atomicidad | Express coordina una transacción por comando en una conexión. Las rutinas exigen transacción, establecen SAVEPOINT y deshacen sus cambios ante error; el coordinador además hace ROLLBACK completo. No hay COMMIT interno del motor |
| Historia | Se conservan identidades de las doce copias aunque mueran; no se borran descartes ni eventos. Triggers rechazan doble subtipo e UPDATE de eventos/subtipos. App carece de DML directo; el administrador conserva sus privilegios |

No confundir `CHECK (vida_actual>0)` en campo con un límite respecto de `carta.vida_base`: esa comparación cruza tablas y la vida inicial/daño quedan a cargo del procedimiento. Tampoco un CHECK de `cantidad BETWEEN 1 AND 2` comprueba la suma de las doce cartas.

## Dependencias funcionales y estado de 3FN

Para cada dependencia no trivial `X → A`, 3FN exige que X sea superclave o que A sea primo, es decir, pertenezca a alguna clave candidata. No basta examinar solamente la PK ni decir «hay IDs». Se usó esta definición formal para evitar confundir 3FN con BCNF. [Referencia docente de RPI](https://www.cs.rpi.edu/~sibel/csci4380/fall2026/lecture_notes/lecture5.html).

Esta tabla es el conjunto de determinantes que debe revisar el grupo. «Resto» significa los otros atributos de esa relación, no columnas de tablas enlazadas.

| Relación | Determinantes candidatos y dependencias a justificar |
|---|---|
| jugador | `id_jugador → resto`; `alias → resto` con unicidad/collation actuales |
| carta | `id_carta → resto`; `(palo,numero) → resto`; análisis específico inferior |
| coleccion_jugador | `(id_jugador,id_carta) → cantidad`; ninguna parte del par determina cantidad por sí sola |
| mazo | `id_mazo → resto`; `(id_jugador,nombre) → resto`. `id_jugador` solo no identifica un mazo |
| mazo_carta | `(id_mazo,id_carta) → cantidad`; la suma/tamaño es una restricción agregada, no otro atributo |
| partida | `id_partida → resto`; fecha_fin no determina por regla general motivo ni ganador. No suponer claves por timestamps distintos de un fixture |
| participante_partida | `id_participante → resto`; `(id_partida,posicion) → resto`; `(id_partida,id_mazo) → resto`. No almacenar jugador adicional: `id_mazo → dueño` ya vive en Mazo |
| copia_carta_partida | `id_copia → resto`; `(id_participante,posicion_original) → resto`. Tipo/participante/posición se conservan; vida/zona son estado mutable |
| turno | `id_turno → resto`; `(id_partida,numero_global) → resto`. Número global determina el máximo energético calculado, no la energía disponible después de invocar |
| solicitud_operacion | `clave_reintento → resto`; `(id_partida,version_resultante) → resto`. No usar la huella como clave: no se declara única ni sustituye la solicitud |
| jugada | `id_jugada → resto`; `(id_turno,orden_en_turno) → resto`; `clave_reintento → resto`. Momento/partida/actor se obtienen de sus referencias |
| invocacion | `id_jugada → id_copia` e `id_copia → id_jugada`, por invocación única de una copia |
| ataque | `id_jugada → resto`; una copia puede atacar/recibir ataques distintos y sus vidas previas varían: el identificador de copia no determina por sí solo esas observaciones |

Con esas DF y las reservas de Carta, no se identificó otra dependencia parcial/transitiva que obligue a una descomposición. Las cantidades dependen del par completo (2FN); datos editoriales/tipos no se repiten en cada copia. Esa conclusión es **condicional**, no una certificación de que ya se enumeró todo F+ ni de que el grupo aceptó las reglas.

### Carta: analizar las dependencias que la PK no revela

1. `id_carta` codifica palo y número, y `(palo,numero)` es UNIQUE/NN. Ambas formas identifican la carta: esta doble representación es verificable con CHECK, pero no constituye por sí sola una violación de 3FN; los determinantes completos son claves. Guardar otro ID numérico no resolvería una dependencia transitiva.
2. La jerarquía tradicional determina el número: una jerarquía dada corresponde a un único número, aunque no identifique el palo. Por ejemplo, jerarquía 6 abarca los cuatro doses. `jerarquia_truco → numero` tiene determinante no superclave, pero numero **es primo** por la clave candidata `(palo,numero)`. Esta DF no viola por sí sola 3FN; sí impide afirmar BCNF para Carta bajo esa semántica.
3. También se observa `jerarquia_truco → costo_energia` en las cuarenta filas actuales: cada jerarquía tiene un único costo. Un SELECT por jerarquía con `COUNT(DISTINCT costo_energia)` devolvió 1 en las catorce clases. **La observación de datos no prueba que sea una regla de dominio.** Etapa 0 presenta costos/ataque/vida como asignaciones editoriales y el presupuesto como heurística, no como una fórmula SQL obligatoria.
4. Antecedente de la reserva: se estudiaron dos alternativas, sin tocar estadísticas. La aclaración actual del usuario elige la alternativa a como semántica técnica del proyecto; B3 completo sigue pendiente de ratificación grupal: **a)** costo es atributo independiente asignado a cada tipo; la igualdad actual por jerarquía es una coincidencia de esta edición, no se incorpora esa DF a F. **b)** el grupo declara que jerarquía fija siempre costo; entonces existe `id_carta → jerarquia_truco → costo_energia`, con costo no primo, y **Carta no está en 3FN bajo esa DF**. La corrección mínima propuesta sería separar la política jerarquía/costo y obtener el costo por JOIN/vista, o derivarlo de una política explícita; requiere revisar esquema, contrato del catálogo y defensa antes de implementarse. No cambiar valores ni añadir una tabla solo para alcanzar un número.
5. No introducir automáticamente DF desde nombre, ataque, vida o combinaciones que resulten únicas en el fixture. Tampoco convertir `ataque+vida = 2×costo+1` en DF normativa: el documento original la llama heurística. Si el grupo ratifica esa igualdad como invariante del dominio, deberá estudiar también sus DF y la redundancia de las tres estadísticas antes de afirmar 3FN.

**Estado actualizado:** el conjunto semántico de DF se precisó con la aclaración del usuario indicada al principio. Dictamen técnico de3FN favorable para13relaciones; aprobación del grupo pendiente. No se descompuso ninguna tabla.

### Estado actual e información histórica

Vida del héroe, zona/vida de copia y energía disponible son estado operativo: permiten validar el próximo comando sin reproducir todos los eventos. Las dos vidas previas de Ataque son observaciones de otro instante, justificadas para consultar muerte/daño históricos. No son otra copia independiente de la vida actual en el mismo momento. Deben actualizarse atómicamente con el estado y quedan sujetas a B3.

No se guardan tamaño del mazo/mano/campo, energía máxima, banderas de preparación/agotamiento, nombre/ataque por instancia, daño/vida posterior ni una tabla de historial paralela. Los JOIN y el catálogo congelado permiten calcularlos. Si se editan las estadísticas usadas históricamente, esas reconstrucciones dejarán de ser confiables: por eso B1 y los permisos son parte de la defensa.

## Qué debe dibujar/revisar el grupo a partir de lo implementado

Usar la [guía de draw.io existente](../hito-1/08-guia-manual-mer-drawio.md), no volver a crear una guía general. Este es el control puntual de sus extremos; leer cada fila por una instancia de cada entidad:

| Relación / rol | Cardinalidades a representar y decisión previa |
|---|---|
| Jugador posee Carta | Jugador 0..40 tipos; Carta 0..N jugadores; asociación `Coleccion_Jugador` con cantidad. B1 define cantidades, no copias serializadas permanentes |
| Jugador posee Mazo | Jugador 0..N mazos; Mazo exactamente 1 dueño estable. Evitar otra FK de Jugador en Participante |
| Mazo contiene Carta | Mazo 0..12 tipos; Carta 0..N mazos; N:M `Mazo_Carta(cantidad)`. Doce copias para iniciar, 6..12 tipos cuando está listo; no equivale a doce filas siempre |
| Partida tiene Participante | Partida confirmada exactamente 2; Participante exactamente 1 partida. Posiciones 1/2; mazos/jugadores distintos |
| Participante usa Mazo | Participante exactamente 1 mazo; Mazo 0..N participaciones. B1 congela el mazo usado |
| Participante posee Copia | Participante exactamente 12; Copia exactamente 1 participante y 1 tipo Carta. Carta 0..N copias. Los descartes siguen contando entre las doce |
| Partida contiene Turno | Partida 1..30; Turno exactamente 1 partida. Actor es derivado, no otra entidad ni atributo repetido |
| Turno contiene Jugada | Turno 0..N; Jugada exactamente 1 turno; orden único por turno |
| Jugada se especializa | Total y disjunta hacia Invocacion/Ataque; ambos hijos heredan la identidad del padre. B2 debe aceptar el vocabulario y su utilidad |
| Invocacion coloca Copia | Invocacion exactamente 1 copia; Copia 0..1 invocaciones. No agregar «fin de turno» como tercer subtipo |
| Ataque usa atacante y objetivo | Atacante exactamente 1 copia; Copia 0..N ataques. Objetivo: 0..1 copia o 0..1 participante/héroe, **XOR** exactamente uno; cada objetivo 0..N ataques recibidos |
| Partida tiene ganador | Partida 0..1 participante ganador, de esa misma partida. Una activa y un empate tienen cero ganador; no crear otra entidad Resultado |
| Partida registra Solicitud | Partida 1..N solicitudes confirmadas; Solicitud exactamente 1 partida. Una clave se genera antes del ID, pero su fila se inserta con FK NN al confirmar el comando |
| Solicitud produce Jugada | Solicitud 0..1; Jugada exactamente 1 solicitud. Iniciar/cerrar turno producen cero; invocar/atacar producen una |

En Chen, representar cada N:M con cantidad una sola vez, como relación o asociación. No duplicar el mismo hecho con ambas formas. Marcar derivados y anotar restricciones interfilas junto al diagrama, porque las cardinalidades no prueban por sí solas propiedad, preparación ni mismo ámbito.

Para el **MR y diccionario**, reutilizar las trece fichas T01–T13 de [la referencia preliminar](01-modelo-relacional-preliminar.md): sus nombres, tipos, columnas, PK/FK/UQ/nulabilidad y ejemplos corresponden a los scripts actuales. Las diferencias de ejecución/mecanismos se registran en esta auditoría; no hace falta copiar las 65 columnas a un segundo diccionario. El grupo debe contrastar esas fichas con SHOW CREATE TABLE y con los metadatos de la instalación limpia que acompañen la entrega.

Antes de rotular el trabajo como definitivo, registrar B1 (historia), B2 (especialización), B3 (DF/estado/observaciones) y B4 (0.2), y hacer que cada integrante explique una N:M, una FK, una DF, una restricción de rutina y un rollback. La aceptación docente de la estructura avanzada y la revisión de 3FN siguen siendo humanas.
