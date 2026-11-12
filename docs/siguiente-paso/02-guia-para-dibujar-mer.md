# Truco Arena — cómo dibujar el MER a mano y entenderlo

> Esta guía toma el modelo candidato como material de estudio, **no como un MER generado y aprobado**. Antes de pasar al modelo relacional del Hito 2, el equipo debe dibujar, revisar y explicar sus propias entidades, cardinalidades y decisiones.

## 1. Qué dibujo conviene entregar

- Trabajar en [draw.io / diagrams.net](https://app.diagrams.net/).
- Usar notación **Chen extendida** si el docente la acepta: entidades = rectángulos; atributos = óvalos; relaciones = rombos; clave conceptual subrayada; especialización = círculo con `d` (disjunta) y línea doble desde el supertipo (total).
- Escribir cardinalidades mínimas y máximas junto a cada participación: `(0,N)`, `(1,1)`, `(2,2)`, etc. No confundir con pata de cuervo; escoger **una** notación y aplicarla consistentemente.
- Identificar el nombre de cada **rol** cuando una asociación involucra una misma clase de entidad en papeles diferentes, como atacante/objetivo.
- Dibujar la **cantidad** como atributo de las relaciones N:M o como campo en la entidad asociativa, pero **no como dos hechos duplicados**.
- Mantener los estados `MAZO`, `MANO`, `CAMPO`, `DESCARTE` como valores de una instancia: **no** dibujarlos como cuatro entidades distintas.

## 2. Dibujar en cinco bloques

### Bloque A: catálogo y propiedad

1. Rectángulos `Jugador`, `Carta`, `Mazo`.
2. Conectar `Jugador — posee — Mazo`: un jugador 0..N mazos; cada mazo exactamente un dueño.
3. Conectar `Jugador — posee — Carta` como N:M con atributo **cantidad poseída** (`Coleccion_Jugador` en el MR).
4. Conectar `Mazo — contiene — Carta` como N:M con atributo **cantidad incluida** (`Mazo_Carta` en el MR).
5. En `Carta`: palo, número, nombre, ataque base, vida base, costo y jerarquía.

**Preguntas del grupo:** ¿Por qué una carta puede aparecer en varios mazos? ¿Por qué `cantidad` depende del par mazo/carta y no de carta sola?

### Bloque B: participación y copias

1. Crear `Partida`, `Participante_Partida`, `Copia_Carta_Partida`.
2. Una partida confirmada tiene exactamente **2 participaciones**, cada una con un mazo (sus dueños son distintos).
3. Cada participación tiene exactamente **12 instancias**, cada una de un tipo `Carta`.
4. `Copia_Carta_Partida` conserva `posicion_original`, `zona` y `vida_actual`.
5. `Partida` tiene un ganador opcional relacionado con **una participación de esa misma partida**.

**Preguntas:** ¿Por qué no alcanza con guardar `Carta` para simular un ataque? ¿Cómo distinguir dos copias del mismo Ancho de Espadas, una en mano y otra en campo?

### Bloque C: tiempo y acciones

1. `Partida — contiene — Turno` (1..30 durante una partida); cada turno pertenece a una partida.
2. `Turno — contiene — Jugada` (0..N jugadas por turno).
3. `Turno` tiene número global, energía actual, apertura y cierre.
4. Anotar que el **actor** se deriva por paridad del número global y posición inicial, por lo que no hace falta copiarlo en cada jugada.

**Pregunta:** ¿Cómo encontrar el turno actual sin guardarlo por segunda vez en Partida? Respuesta a discutir: el único turno sin fecha de cierre.

### Bloque D: especialización

1. `Jugada` es supertipo.
2. Desde `Jugada`, círculo `d` y dos subtipos `Invocacion` y `Ataque`.
3. Marcar **total**: toda Jugada tiene uno de esos dos subtipos.
4. Marcar **disjunta**: no puede tener ambos.
5. `Invocacion — coloca — Copia_Carta_Partida`.
6. `Ataque — ejecuta — Copia_Carta_Partida` (rol atacante).
7. `Ataque — apunta — Copia_Carta_Partida` (rol objetivo carta opcional).
8. `Ataque — apunta — Participante_Partida` (rol héroe objetivo opcional).
9. Anotar **XOR**: exactamente uno de los dos objetivos, no ambos ni ninguno.

**Pregunta:** ¿Por qué cerrar un turno no es `Jugada` aquí? Porque el vocabulario elegido restringe `Jugada` a invocación y ataque; cierre queda representado en `Turno`. Confirmar con el profesor.

### Bloque E: soporte técnico (separado)

Mostrar `Solicitud_Operacion` en una zona aparte con línea discontinua a `Partida` y relación opcional a `Jugada`. Su cometido es detectar repeticiones de un comando y permitir reanudar sin aplicar el efecto dos veces. No usar esa tabla para justificar el cumplimiento de la especialización.

## 3. Checklist mínimo del MER

- [ ] Cada entidad tiene identidad y atributos propios.
- [ ] Todas las relaciones muestran cardinalidades y, donde corresponde, participación mínima.
- [ ] Existen dos N:M con cantidad, sin duplicación en el dibujo.
- [ ] Se distinguen `Carta` y `Copia_Carta_Partida`.
- [ ] Se representa correctamente la especialización total/disjunta.
- [ ] Se representa explícitamente XOR de los objetivos de Ataque.
- [ ] Se indica que `ganador` pertenece a la misma partida.
- [ ] Se anotan las reglas que no caben en las cardinalidades: total 12, máximo dos por tipo, campo hasta tres, un turno activo, etc.
- [ ] El grupo puede explicar un inicio, una invocación, un ataque y un cierre sobre el dibujo.
- [ ] Se registran dudas y correcciones docentes; el diagrama definitivo no se da por aprobado sin revisión.

## 4. Recorrido de prueba de escritorio

**Inicio:** Juan elige `Mazo A` y Ana elige `Mazo B`; `Partida` crea dos participaciones y cada participación genera exactamente doce copias correspondientes a su mazo. Tres copias empiezan en mano, nueve en mazo. Se abre el turno global 1.

**Invocación:** Juan, con energía 1, invoca una copia de costo 1. La copia cambia de MANO a CAMPO, toma su vida base y se registra una Jugada de subtipo Invocacion. La energía se reduce a cero, todo en un mismo cambio confirmado.

**Ataque:** en un turno posterior, Juan ataca una carta enemiga. Se crea una Jugada subtipo Ataque, se registran vidas anteriores y se aplican simultáneamente los daños. Si una copia llega a cero, pasa a DESCARTE; su tipo de catálogo no se modifica.

**Cierre:** si un héroe llega a vida cero, se cierra el turno y la partida. En otro caso, al finalizar el global 30 se comparan las vidas y se registra victoria o empate.

**Prueba de comprensión:** cada integrante debe poder indicar para cada evento qué entidades se usan, qué registros se crean, cuáles cambian y cuáles permanecen iguales.

## 5. Qué guardar

- `docs/hito-1/mer-truco-arena-v1.drawio` (editable).
- `docs/hito-1/mer-truco-arena-v1.png` o PDF (legible).
- Documento breve de decisiones del equipo B1–B4, fecha y autores/revisores.
- Versión actualizada de la bitácora de IA.

No comenzar a presentar tablas como «normalizadas a 3FN» hasta identificar dependencias funcionales y realizar el análisis del Hito 2.
