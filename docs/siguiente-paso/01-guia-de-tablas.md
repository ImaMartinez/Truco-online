# Truco Arena — guía propuesta de tablas y relaciones

**Propósito:** permitir que el equipo entienda qué información necesita almacenar el juego y pueda dibujar su MER a mano. **No es un esquema final ni certifica 3FN.** Las columnas, claves y tipos indicados son una **posible traducción relacional futura**, útil como guía; el MER del Hito 1 debe empezar por entidades, atributos y relaciones, sin copiar automáticamente columnas FK.

## 0. Convenciones

- `PK`: clave primaria que identifica una fila.
- `FK`: clave foránea que relaciona dos tablas.
- `UQ`: conjunto de valores que no se puede repetir.
- `NN`: no permite `NULL`.
- `?`: atributo opcional.
- `INT`, `VARCHAR`, `DATETIME`, `TINYINT`: orientativos de MariaDB; los tipos precisos corresponden al Hito 2.
- Los valores derivados deben **consultarse**, no guardarse redundantemente sin justificarlo.
- Las restricciones que involucran **varias filas o varias tablas** no pueden resolverse con un `CHECK` aislado: requieren operaciones SQL controladas.

## 1. Vista general

| Nº | Tabla candidata | Para qué sirve | Clave propuesta |
|---:|---|---|---|
| 1 | `jugador` | Perfil y nombre del jugador | `id_jugador` |
| 2 | `carta` | Catálogo de los 40 tipos de naipes | `id_carta` |
| 3 | `coleccion_jugador` | Cuántas copias de cada tipo posee cada jugador | `(id_jugador, id_carta)` |
| 4 | `mazo` | Mazo creado por un jugador | `id_mazo` |
| 5 | `mazo_carta` | Composición y cantidad de cada tipo en un mazo | `(id_mazo, id_carta)` |
| 6 | `partida` | Estado y resultado global de una batalla | `id_partida` |
| 7 | `participante_partida` | Posición, mazo y vida de cada héroe | `id_participante` |
| 8 | `copia_carta_partida` | Instancia única de un naipe dentro de una batalla | `id_copia` |
| 9 | `turno` | Número global, energía y apertura/cierre | `id_turno` |
| 10 | `jugada` | Evento ordenado de una acción exitosa | `id_jugada` |
| 11 | `invocacion` | Especialización de una Jugada que pone una carta en campo | `id_jugada` |
| 12 | `ataque` | Especialización de una Jugada de combate | `id_jugada` |
| 13 | `solicitud_operacion` | Reintentos sin efectos duplicados (tabla técnica) | `id_solicitud` |

**Nota:** las tablas 3 y 5 son traducciones de relaciones N:M con atributo `cantidad`. En un MER de notación Chen pueden ser rombos con atributo, no necesariamente entidades rectangulares. `solicitud_operacion` puede quedar fuera del diagrama de dominio y documentarse como soporte técnico, según lo que el docente exija.

## 2. Definición orientativa de cada tabla

### 2.1 `jugador`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_jugador` | Identificador | PK |
| `alias` | Nombre visible | NN, UQ por política de nombres a acordar |
| `fecha_alta` | Fecha de creación | NN |
| `fecha_archivo` | Perfil desactivado | Opcional |

Un jugador puede poseer múltiples mazos y tipos de carta. En el MVP no hay registro con contraseña ni sesiones remotas.

### 2.2 `carta`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_carta` | Identificador del tipo | PK |
| `codigo` | Código estable, ej. `ESP-01` | NN, UQ |
| `nombre` | Nombre editorial, ej. «Ancho de espadas» | NN |
| `palo` | ESPADA, BASTO, ORO o COPA | NN, dominio controlado |
| `numero` | 1–7, 10–12 | NN, dominio controlado |
| `ataque_base` | Daño ofensivo | NN, positivo |
| `vida_base` | Vida al invocar | NN, positiva |
| `costo_energia` | Costo de ponerla en juego | NN, entre 1 y 5 |
| `jerarquia_truco` | Orden tradicional de fuerza | NN |

Agregar `UNIQUE(palo, numero)`. Usar **exactamente las 40 estadísticas del archivo de Etapa 0**, sin volver a inventarlas. El catálogo queda congelado en este MVP.

### 2.3 `coleccion_jugador`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_jugador` | Dueño | PK parcial, FK a `jugador` |
| `id_carta` | Tipo que posee | PK parcial, FK a `carta` |
| `cantidad` | Copias poseídas de ese tipo | NN, positiva |

Una fila expresa «el jugador A posee 2 copias del tipo ESP-01». Se permite usar esas 2 copias en distintos mazos **sin consumirlas**. Para el demo, crear dos copias de cada tipo en la colección de cada perfil inicial, salvo decisión posterior del grupo.

### 2.4 `mazo`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_mazo` | Identificador | PK |
| `id_jugador` | Dueño inmutable | FK a `jugador`, NN |
| `nombre` | Nombre del mazo | NN; definir política de repetición |
| `fecha_creacion` | Cuándo se creó | NN |
| `fecha_archivo` | Mazo archivado | Opcional |

Un mazo usado en una partida conserva su dueño, nombre y composición. Para editar uno usado se crea una **copia nueva**. Que un mazo haya sido utilizado se deriva de `participante_partida`; no hace falta guardar un booleano duplicado.

### 2.5 `mazo_carta`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_mazo` | Mazo | PK parcial, FK a `mazo` |
| `id_carta` | Tipo incluido | PK parcial, FK a `carta` |
| `cantidad` | Copias de este tipo en el mazo | NN, 1 o 2 |

**Reglas cruzadas:** un mazo de borrador suma de 0 a 12 cartas; para iniciar una partida suma **exactamente 12**. Para cada tipo, `mazo_carta.cantidad ≤ coleccion_jugador.cantidad` del dueño. No sumar la utilización de cartas entre distintos mazos.

### 2.6 `partida`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_partida` | Identificador | PK |
| `estado` | ACTIVA o FINALIZADA | NN, dominio controlado |
| `fecha_inicio` | Creación | NN |
| `fecha_fin` | Cierre | Opcional, requerida si terminó |
| `motivo_cierre` | VIDA_CERO o LIMITE_TURNOS | Opcional, requerido si terminó |
| `ganador_posicion` | 1, 2 o `NULL` si no hay ganador | Opcional; validar que pertenezca a la misma partida |
| `version` | Control de concurrencia | NN, entero no negativo |

**Decisión para Hito 2:** `ganador_posicion` puede validarse mediante FK compuesta a `(id_partida, posicion)` de `participante_partida` (implica dependencia circular gestionable porque al crear partida el ganador es `NULL`) o mediante rutina con garantía equivalente. No decidirlo sin revisar el MR. `NULL` de ganador **no significa empate por sí solo**: en una partida ACTIVA tampoco hay ganador; interpretar también `estado` y `motivo_cierre`.

### 2.7 `participante_partida`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_participante` | Identificador | PK |
| `id_partida` | Partida a la que pertenece | FK a `partida`, NN |
| `posicion` | 1 o 2; 1 comienza | NN, UQ junto a `id_partida` |
| `id_mazo` | Mazo elegido | FK a `mazo`, NN |
| `vida_heroe` | Vida actual del héroe | NN, entre 0 y 20 |

El **jugador se obtiene a través del dueño del mazo**, que es inmutable. No agregar otra columna de jugador por comodidad antes de estudiar 3FN. Deben existir exactamente dos participaciones, con dueños diferentes y, según el reglamento, cada jugador solo puede tener una partida activa.

### 2.8 `copia_carta_partida`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_copia` | Identidad única de una copia en partida | PK |
| `id_participante` | Dueño dentro de la partida | FK a `participante_partida`, NN |
| `id_carta` | Tipo del catálogo | FK a `carta`, NN |
| `posicion_original` | Posición mezclada de 1 a 12 | NN, UQ junto a participante |
| `zona` | MAZO, MANO, CAMPO o DESCARTE | NN, dominio controlado |
| `vida_actual` | Vida tras daño, solo si fue invocada | `NULL` en MAZO/MANO, positiva en CAMPO, 0 en DESCARTE |

Se crean **12 copias para cada participante al comenzar**; no puede generarse un tipo ni una cantidad que no figure en el mazo seleccionado. Las posiciones 1–3 empiezan en MANO y las 4–12 en MAZO. La carta de catálogo no es una copia de combate.

### 2.9 `turno`

| Campo | Significado | Regla posible |
|---|---|---|
| `id_turno` | Identificador | PK |
| `id_partida` | Batalla | FK a `partida`, NN |
| `numero_global` | De 1 a 30 | NN, UQ con `id_partida` |
| `energia_disponible` | Energía restante del actor | NN, entre 0 y 5 |
| `fecha_apertura` | Inicio del turno | NN |
| `fecha_cierre` | Final del turno | Opcional |

El actor se **deriva**: impar = participante de posición 1; par = posición 2. No repetir `id_participante_actor` sin justificarlo. Hay un solo turno abierto por partida activa; el anterior se cierra antes de abrir el siguiente en **una transacción**.

### 2.10 `jugada` (supertipo)

| Campo | Significado | Regla posible |
|---|---|---|
| `id_jugada` | Identificador | PK |
| `id_turno` | Turno de la acción | FK a `turno`, NN |
| `orden_en_turno` | Secuencia de acciones exitosas | NN, UQ junto a `id_turno` |
| `fecha_hora` | Momento de ejecución | NN |

Una jugada es **únicamente invocación o ataque exitoso**. Iniciar/cerrar un turno se registra en `turno`, no creando un tercer subtipo artificial. El concepto de especialización **total y disjunta** debe confirmarse con el docente.

### 2.11 `invocacion` (subtipo)

| Campo | Significado | Regla posible |
|---|---|---|
| `id_jugada` | Misma identidad que Jugada | PK y FK a `jugada` |
| `id_copia` | Copia colocada en campo | FK a `copia_carta_partida`, NN y UQ |

Una copia solo puede invocarse una vez. La preparación para atacar se obtiene desde el turno de su invocación (no hace falta guardar `esta_preparada`).

### 2.12 `ataque` (subtipo)

| Campo | Significado | Regla posible |
|---|---|---|
| `id_jugada` | Misma identidad que Jugada | PK y FK a `jugada` |
| `id_copia_atacante` | Copia que ataca | FK a `copia_carta_partida`, NN |
| `id_copia_objetivo` | Carta que recibe ataque | FK opcional a `copia_carta_partida` |
| `id_participante_objetivo` | Héroe que recibe ataque | FK opcional a `participante_partida` |
| `vida_previa_atacante` | Vida antes del intercambio | NN, positiva |
| `vida_previa_objetivo` | Vida de carta o héroe antes del ataque | NN, positiva |

**Exclusión XOR:** debe existir *exactamente uno* de los dos objetivos. Validar además que objetivo y atacante sean rivales de la misma partida y que la carta atacante esté preparada y no haya atacado antes en ese turno. Los dos valores de vida previa son observaciones históricas justificadas; daños y vida posterior se calculan desde ellos y los atributos del catálogo congelado.

### 2.13 `solicitud_operacion` (soporte técnico)

| Campo | Significado | Regla posible |
|---|---|---|
| `id_solicitud` | Identificador | PK |
| `clave_reintento` | Idempotencia de la operación | NN, UQ global |
| `id_partida` | Partida afectada o creada | FK a `partida`, NN al confirmar |
| `tipo_operacion` | CREAR_PARTIDA, INVOCAR, ATACAR, FINALIZAR_TURNO | NN |
| `hash_parametros` | Firma de parámetros originales | NN |
| `version_resultante` | Versión de partida luego de ejecutar | NN |
| `fecha_confirmacion` | Operación confirmada | NN |
| `id_jugada` | Jugada producida, si existe | FK opcional a `jugada`, UQ si no nula |

Tabla complementaria: sirve para repetir una solicitud sin efectuar nuevamente su efecto. **Caso especial creación:** la primera solicitud llega antes de existir `partida`; una implementación posible es bloquear participantes involucrados, consultar la clave, crear la partida y luego insertar la solicitud asociada **dentro de la misma transacción**. Una carrera sobre la clave única debe resolverse mediante ROLLBACK y lectura del resultado confirmado. Esto se decidirá y probará en el Hito 3.

## 3. Asociaciones para dibujar en el MER

- `jugador 1 — N mazo`.
- `jugador N — M carta` con atributo `cantidad_poseida` (o entidad asociativa `coleccion_jugador`).
- `mazo N — M carta` con atributo `cantidad_incluida` (o entidad asociativa `mazo_carta`).
- `partida 1 — 2 participante_partida` **en estados confirmados**.
- `mazo 1 — N participante_partida` a lo largo del historial; una participación usa un solo mazo.
- `participante_partida 1 — 12 copia_carta_partida` al inicio confirmado.
- `carta 1 — N copia_carta_partida`.
- `partida 1 — N turno`, entre 1 y 30 durante el ciclo.
- `turno 1 — N jugada`, incluyendo la posibilidad de cero jugadas.
- `jugada` **especialización total/disjunta** `invocacion` o `ataque`.
- `invocacion 1 — 1 copia_carta_partida` para la copia invocada (una copia puede tener 0 o 1 invocación).
- `ataque N — 1 copia_carta_partida` en rol atacante.
- `ataque N — 0/1 copia_carta_partida` en rol objetivo carta.
- `ataque N — 0/1 participante_partida` en rol objetivo héroe; XOR con objetivo carta.
- `partida 0/1 — 1 participante_partida` en rol ganador (siempre de esa misma partida).

**Importante:** `jugador` que interviene en una partida se deduce desde `participante_partida → mazo → jugador`; el actor de turno se deduce de `numero_global + posicion`. Evitar relaciones dibujadas dos veces cuando se trata de información derivada.

## 4. Reglas que no quedan resueltas solo con el dibujo

1. Composición del mazo (12 totales, máximo 2 por tipo y solo poseídas).
2. Exactamente dos participantes distintos, cada uno con 12 copias idénticas en cantidad y tipo a su mazo.
3. Estado de zona y vida temporal coherente.
4. Energía y cupo de hasta 3 cartas en campo.
5. Actor válido, carta preparada, una sola acción de ataque por copia/turno.
6. Ataque a carta u héroe, nunca ambos y nunca al héroe si tiene defensores.
7. Registro **atómico** de cada cambio de energía, vida, zona, jugada y cierre de partida.
8. Máximo una partida activa por jugador y un único turno abierto por partida.
9. Comandos repetidos sin efecto duplicado.
10. Subtipo exactamente uno por Jugada, no garantizado solo con las FK simples de los hijos.

Estas reglas se implementarán principalmente con **restricciones de fila, claves, rutinas SQL, permisos y transacciones**, usando InnoDB. El backend no debe tener permisos para saltarse procedimientos críticos escribiendo libremente en tablas de juego.

## 5. Puntos de discusión antes de aprobar

- ¿La colección puede permanecer fija y precargada para la primera entrega, sin compra ni intercambio? Confirmar alcance con el docente.
- ¿Acepta el docente la especialización `Jugada → Invocacion/Ataque` como la estructura avanzada exigida?
- ¿Se conserva `ganador_posicion` y se valida por FK compuesta, o se adopta otra representación que no duplique fuentes?
- ¿Conservar `vida_previa_atacante` y `vida_previa_objetivo` como instantáneas históricas es suficiente para el informe de ataques?
- ¿Qué política de alias/nombres únicos se utilizará? Resolver la collation en Hito 2.

## 6. Mini-ejemplo para explicar en una defensa

Jugador **Ana** tiene 2 cartas `ESP-01` en `coleccion_jugador`. En `mazo_carta`, el mazo **Mesa Roja** incluye 2 copias de `ESP-01` entre sus 12 cartas. Al iniciar una partida, la base crea **dos filas distintas** de `copia_carta_partida` de tipo `ESP-01` y dueño Ana, con posiciones diferentes. Una puede estar en CAMPO con 2 puntos de vida y otra en MANO con `vida_actual = NULL`. El registro `carta` del Ancho de Espadas sigue teniendo una sola fila de catálogo. Esto es precisamente por qué hacen falta catálogo, composición e instancias.
