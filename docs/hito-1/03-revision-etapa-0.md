# Revisión crítica de la Etapa 0

Fecha: 02/11/2026. Se revisaron íntegramente los seis documentos existentes. No se modificó ninguno; este registro conserva su trazabilidad. No hay decisiones del grupo identificadas como aprobadas en los archivos. Se mantienen las restricciones explícitas del usuario y se separan de las propuestas D01–D10, aún pendientes.

## Cobertura de lectura

| Documento original | Conclusión |
|---|---|
| [01 — Idea y reglas](../etapa-0/01-idea-y-reglas.md) | Ciclo de juego viable; precisar cierre por ataque letal, costo de ataques y estados de copias |
| [02 — Cartas](../etapa-0/02-cartas-y-equilibrio.md) | Las 40 filas respetan palos/números/jerarquía y la curva declarada; presupuesto matemático no prueba balance |
| [03 — Modelo candidato](../etapa-0/03-modelo-candidato.md) | Identidad de copias y especialización útiles; revisar datos transitivos y cachés de eventos antes de afirmar 3FN |
| [04 — Arquitectura y SQL](../etapa-0/04-arquitectura-y-sql.md) | Procedimientos, permisos y transacciones adecuados; precisar requisitos de transacción y visibilidad al esperar bloqueos |
| [05 — Plan y validación](../etapa-0/05-plan-y-validacion.md) | Se conserva el orden de hitos y sus consultas; cambiar recorridos de consultas si se simplifican relaciones |
| [06 — Decisiones y riesgos](../etapa-0/06-decisiones-y-riesgos.md) | D01–D10 continúan pendientes; el nuevo pedido autoriza preparar el Hito 1, no valida el modelo final |

## Problemas y soluciones propuestas

| ID | Tipo y origen | Problema | Propuesta y efecto |
|---|---|---|---|
| H01 | Omisión: reglas 14–16 y un turno abierto | La victoria inmediata no decía explícitamente que cerrara el turno; una implementación podría dejarlo abierto | Ataque letal cierra turno y partida en la misma transacción, sin robo ni siguiente turno. Aclaración, no cambio de condición de victoria |
| H02 | Omisión: acciones y energía | No era explícito si atacar costaba energía ni si se podía pasar con acciones legales | Ataques cuestan cero; pasar siempre permitido. Evita bloqueos y gastos inventados |
| H03 | Omisión: estado de copias | No había dominio preciso de vida en MAZO/MANO ni consistencia entre zona e invocación | Vida NULL antes de invocar, positiva en campo y cero en descarte; grafo sin retornos. Precisa atributos opcionales y validaciones |
| H04 | Riesgo de 3FN: Participante | Guardar jugador y mazo con dueño inmutable introduce la dependencia mazo → jugador | Mantener jugador como vínculo conceptual derivado del mazo seleccionado; no convertir ambos automáticamente en columnas. Revisión de representación, no cambio de participantes |
| H05 | Riesgo de redundancia: Turno | Guardar partida, participante global y orden inicial sin estudiar claves puede duplicar el ámbito o el actor | Turno pertenece a Partida; actor derivado de paridad y posición inicial. No repetir turno actual en Partida si puede obtenerse del único abierto |
| H06 | Redundancia: Copia | Turno de invocación y último turno de ataque ya están en Invocacion/Ataque y sus jugadas | Derivarlos de eventos; conservar zona y vida actuales por ser estado operativo. Evita cachés que deben sincronizarse |
| H07 | Decisión abierta: auditoría de ataque | Guardar ataque base, daño, todas las vidas previas/posteriores y un Historial_Combate duplicaría hechos | Dos observaciones históricas de vida previa por ataque, objetivos y atacante; calcular daños/resultados desde catálogo congelado. Historial como consulta, no otra tabla |
| H08 | Ambigüedad terminológica | «Jugada» podía interpretarse como cualquier comando, aunque la especialización solo admite invocar/atacar | Jugada de dominio = invocación o ataque exitoso. Inicio/cierre se representan en Partida/Turno; Solicitud_Operacion es registro técnico, no otro subtipo |
| H09 | Riesgo transaccional | SIGNAL no equivale a probar rollback de toda una operación; lecturas antiguas bajo REPEATABLE-READ pueden engañar | Exigir transacción activa, propagar errores al coordinador para ROLLBACK completo y usar lecturas actuales/bloqueantes tras el bloqueo estable |
| H10 | Desfase de consultas si se adopta H04/H05 | El plan de estadísticas asume acceso directo Jugador–Participante | Resolver ese recorrido por Mazo → Jugador; siguen cumpliéndose los JOIN requeridos. No hace falta almacenar una FK redundante para facilitar la consulta |
| H11 | Asimetría de fin y balance | El segundo tiene la última oportunidad de ataque; el primero puede protegerse invocando en el 29. Invocar en el 30 no aporta beneficio sin habilidades | Conservar el límite y permitir esas acciones; medir por posición. No resolverlo con una fase nueva ni alterar silenciosamente la regla |
| H12 | Desajuste con la especificación original: nombre de carta | El modelo de Etapa 0 permitía formar el nombre solo en la API, aunque el pedido original incluía nombre entre los atributos del catálogo almacenado | Conservar nombre editorial en Carta y consultarlo desde SQL, sin copiarlo a instancias. Corrección propuesta para cumplir el requisito original, no un cambio de estadísticas |

No se encontró una contradicción entre las estadísticas de las cartas y el cálculo de energía o daño. H01/H02/H03/H08 completan definiciones; H04–H07 son simplificaciones candidatas que requieren aprobación. H09 no cambia el juego, precisa una implementación correcta. No se presenta el modelo previo como 3FN demostrada ni se aprueban automáticamente estas correcciones.

## Evaluación estática del catálogo

Se conservaron todas las estadísticas. Se comprobaron 40 códigos distintos, diez números válidos por palo y la jerarquía solicitada. La distribución energética sigue siendo 8/14/10/6/2 para costos 1/2/3/4/5.

Hay **16 perfiles distintos de costo/ataque/vida** para cuarenta cartas. Por ejemplo, seis tipos tienen costo 2, ataque 2 y vida 3. En ausencia de habilidades o efectos por palo, los tipos con el mismo perfil son funcionalmente equivalentes. La jerarquía distinta no rompe esa equivalencia. Puede aceptarse para mantener la identidad de la baraja y el alcance, pero no debe prometerse que cada tipo tiene una función táctica exclusiva.

No se halló dominancia estricta por las tres estadísticas: ningún tipo ofrece costo menor o igual y ataque/vida mayores o iguales que otro con al menos una mejora estricta. Es esperable con el presupuesto `ataque + vida = 2 × costo + 1`. Esto solo descarta una forma simple de inferioridad; no mide intercambios favorables, supervivencia ni ocupación del campo.

## Iniciativa y problemas de equilibrio

- El primero puede invocar en el turno 1 y atacar en el 3; el segundo tiene el 2 para defenderse. No existe daño de apertura inevitable, pero sí iniciativa de desarrollo. El sorteo distribuye la ventaja, no demuestra que desaparezca.
- Ambos tienen tres cartas y ninguna cuarta carta en su primer turno. Con cuatro cartas de costo 1 en el mazo, no recibir ninguna sucede en 56/220 ≈ 25,45 % de manos. No añadir mulligan antes de comprobar si el paso inicial resulta molesto.
- Toda carta protege al héroe. Una copia 1/4 barata puede bloquear daño y exigir varias acciones; una copia de ataque alto puede morir ante una defensa pequeña por el intercambio simultáneo. Sumar ataque y vida no captura esos casos.
- Tres espacios hacen costosa la ocupación con cartas pequeñas, pero estas permiten actuar temprano y combinar invocaciones. Las figuras 3/6 o 6/3 pueden rendir distinto según el campo; no hay una razón empírica todavía para modificar sus valores.
- En el cierre, la última respuesta pertenece al segundo. Una invocación en el turno 30 no ataca y ya no protegerá de otro turno enemigo. No prohibirla: es legal y simplemente puede ser inútil. El primero, en el 29, sí puede invocar para proteger su vida antes del último turno rival.

Recomendación: mantener catálogo 0.1 y reglas 0.2 como hipótesis. Al tener prototipo, jugar al menos veinte partidas exploratorias alternando posición y mazos, y medir victorias, cierres por límite, vida final, uso de tipos y turnos sin acciones. No se jugaron partidas ni se estimó una tasa de ventaja inicial en esta revisión.

## Efectos sobre el diseño pendiente

D01, D05 y D06 afectan qué hechos habrá que representar; D07 agrega una restricción entre participaciones activas; D10 afecta claves candidatas y collations. H04–H07 afectan atributos y recorridos, por lo que deben resolverse antes de transformar el MER en tablas. D02/D03 y H01–H03 determinan los invariantes temporales de turnos y copias. Mantener todos esos puntos visibles en [la revisión del grupo](06-revision-del-grupo-y-escenarios.md).
