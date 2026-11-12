# Plan de los cuatro hitos y validación

Estado: plan propuesto. Las casillas representan trabajo pendiente, no aprobación ni pruebas realizadas. No hay fechas de entrega estimadas sin conocer el calendario y la disponibilidad del grupo.

## Secuencia y condiciones de avance

| Etapa/hito | Trabajo y entregables | Evidencia para considerarlo terminado |
|---|---|---|
| Etapa 0, actual | Idea, reglas precisas, catálogo de 40, candidatos, arquitectura, riesgos y plan | Documentos coherentes; inventario del entorno; revisión inicial del grupo pendiente |
| Hito 1 | Revisar reglas y alcance; ejemplos de partidas en papel; construir MER con cardinalidades y estructura avanzada | El grupo explica cada entidad/relación; docente/grupo validan especialización y decisiones; acta de cambios y MER revisado |
| Hito 2 | Transformar MER aprobado en MR; elegir claves; restricciones; dependencias funcionales; 3FN; diccionario | Trazabilidad MER→MR, al menos 8 tablas justificadas, N:M con atributos, especialización representada y revisión del grupo registrada |
| Hito 3 | Implementar primero MariaDB; estructura, rutinas, permisos, seeds, vista, 10 consultas y transacciones | Instalación limpia reproducible en 10.4.32, pruebas de reglas desde SQL, ROLLBACK y concurrencia con resultados guardados |
| Hito 4 | API y frontend incremental; juego local completo, estadísticas, documentación, informe y bitácora | Dos perfiles/mazos inician y terminan partidas; pruebas críticas pasan; README reproducible; revisión visual y entrega académica |
| Complemento condicionado | Tras aprobación docente, scripts PostgreSQL y repositorio pg | Misma batería sobre versión real de destino, estados equivalentes y permisos revisados; luego evaluar publicación separadamente |

La IA puede proponer y criticar en Hitos 1 y 2. La construcción, comprensión y validación finales corresponden al grupo. Un archivo generado o una casilla marcada por la IA no sustituye esa revisión. Todo cambio posterior al modelo aprobado debe dejar motivo, impacto y nueva validación.

## Hito 1: preguntas y revisión humana

- [ ] Resolver D01–D10 en [decisiones](06-decisiones-y-riesgos.md).
- [ ] Jugar escenarios en papel: doble muerte, héroe protegido, mazo vacío, empate y turno 30.
- [ ] Dibujar el MER por el grupo y justificar cardinalidades y participación total/parcial.
- [ ] Validar con el docente la especialización y el alcance de «administrar colección».
- [ ] Registrar quién revisó, qué entendió y qué cambió, con fecha y documento aprobado.

No se crea ahora un MER listo para entregar sin esa actividad.

## Hito 2: decisiones físicas antes de SQL

- [ ] Listar atributos, dominios, nulabilidad, claves primarias/candidatas y FKs.
- [ ] Resolver referencias que no puedan cruzar participantes de distintas partidas.
- [ ] Representar especialización total/disjunta y objetivos excluyentes.
- [ ] Justificar estados persistidos, snapshots históricos y datos derivados.
- [ ] Demostrar 1FN, 2FN y 3FN mediante dependencias, no mediante afirmación genérica.
- [ ] Especificar límites transaccionales, orden de bloqueos y permisos por operación.
- [ ] Aprobar el diccionario y las operaciones antes de generar scripts finales.

## Hito 3: implementación y fixtures

Orden propuesto: estructura/FKs/CHECK → datos de catálogo y perfiles → composición y validaciones de mazos → inicio/copias/turnos → invocación → ataque/final → vistas/consultas → permisos y pruebas completas. Ejecutar verificaciones en cada incremento.

Separar un fixture mínimo jugable de los datos académicos ampliados. Objetivo de carga ampliada:

| Conjunto | Cantidad prevista | Propósito |
|---|---:|---|
| Cartas | 40 | Toda la baraja, sin 8/9 |
| Jugadores | 15 | Perfiles de prueba, no datos personales reales |
| Colecciones | 600 asociaciones | 40 tipos por cada jugador, con cantidad 2 |
| Mazos | Al menos 15 | Composiciones legales y curvas distintas |
| Mazo_Carta | Al menos 90 | Seis tipos × dos copias en cada mazo de referencia |
| Partidas completas | Al menos 18 | Victorias, empates y cierres por límite |
| Participantes | Al menos 36 | Dos por cada partida |
| Copias de partida | Al menos 432 | 24 por cada partida |
| Turnos, jugadas y subtipos | Al menos 15 de cada tabla principal aplicable | Evidencia suficiente de invocaciones, ataques y contraataques |

Los catálogos de dominio pequeños, como cuatro palos si se elige esa tabla, conservan su cardinalidad real. Los casos inválidos se ejecutan como pruebas y se revierten; no quedan como seeds inconsistentes. Generar partidas de historial mediante las operaciones válidas o fixtures revisados que satisfagan sus invariantes. No insertar ganadores ficticios desconectados de las acciones.

### Diez consultas previstas, todavía sin SQL

Los nombres y recorridos dependen del modelo final. Cada consulta deberá incluir un JOIN de al menos tres tablas o una subconsulta, comprobado individualmente al escribirla.

| Nº | Enunciado y uso | Recorrido y requisito previsto |
|---:|---|---|
| 1 | ¿Qué cartas se invocaron más veces en partidas finalizadas? Mostrar popularidad. | Carta → Copia → Invocacion → Jugada → Turno → Partida; GROUP BY, conteo de eventos, no de copias robadas |
| 2 | ¿Qué jugadores ganaron más partidas? Ranking de victorias. | Jugador → Participante → Partida; comparar ganador con participación; incluir jugadores sin victorias |
| 3 | ¿Qué porcentaje ganó cada jugador sobre sus partidas finalizadas? | Jugador/Participante/Partida; subconsulta escalar correlacionada de total finalizado, con protección frente a cero |
| 4 | ¿Qué mazos tienen mejor rendimiento con al menos tres partidas finalizadas? | Mazo → Participante → Partida; GROUP BY y HAVING de cantidad mínima; tasa de victorias |
| 5 | ¿Qué cartas nunca fueron invocadas? Detectar cartas ignoradas. | Carta LEFT JOIN a subconsulta DISTINCT de tipos realmente invocados (Copia + Invocacion), IS NULL: anti-join explícito |
| 6 | ¿Cuál es el costo medio por copia de cada mazo? Ayudar al editor. | Mazo → Mazo_Carta → Carta; SUM(costo × cantidad)/SUM(cantidad), no promedio simple por tipo |
| 7 | ¿Qué cartas poseídas por un jugador no aparecen en un mazo suyo seleccionado? | Coleccion_Jugador + Carta y anti-join con composición filtrada por ese Mazo; validar dueño del mazo |
| 8 | ¿Qué jugadores tienen más partidas finalizadas y cuántas siguen activas? | Jugador → Participante → Partida; agregaciones condicionales y jugadores con cero partidas |
| 9 | ¿Qué cartas causaron más eliminaciones? Valorar combate. | Ataque → Jugada, Copia y Carta; atribuir muertes de objetivo y atacante a cada causante, incluso contraataques y doble muerte |
| 10 | ¿Cuál es el historial completo de una partida en orden? Mostrar detalle. | Partida → Turno → Jugada → subtipos → Copia/Carta/Participante; combinar inicio/cierre de turnos y resultado, orden explícito |

En la consulta 5 no alcanza con unir todas las copias y filtrar las que no tienen invocación: una misma carta podría tener una copia invocada y otra no. Primero se obtiene el conjunto de tipos utilizados y luego se aplica el anti-join.

Definiciones compartidas: «utilizada» = invocada; «victoria» = participante registrado como ganador; porcentaje = victorias/partidas finalizadas, incluyendo empates en el denominador. Las partidas activas no afectan esa tasa. Las eliminaciones incluyen las producidas al defender. Documentar tratamiento de jugadores/mazos sin partidas y de mazos vacíos.

### Vista y transacciones de la entrega

Vista candidata `vista_ranking_jugadores`: jugador, finalizadas, victorias, derrotas, empates y porcentaje. La pantalla Estadísticas debe consumirla mediante la API y ordenar con desempate explícito. El nombre y definición se fijan en el Hito 3; no será una vista creada solo para mostrar en el informe.

Ejemplos transaccionales mínimos a documentar con estado anterior/posterior:

1. Invocación correcta: energía, zona y evento cambian juntos al confirmar.
2. Ataque con doble muerte: dos vidas y descartes, consumo de ataque y evento se confirman juntos.
3. Operación inválida por regla: ROLLBACK deja estado y eventos sin cambios.
4. Fallo provocado **después de una modificación** en una base de pruebas: por ejemplo, luego del descuento de energía y antes del registro, para demostrar atomicidad real. Una validación que falla antes de escribir no basta como única evidencia de ROLLBACK.
5. Edición de mazo que falla a mitad: vuelve la composición anterior completa.
6. Dos sesiones concurrentes: último espacio de campo y doble ataque de la misma copia.

No mezclar CREATE/ALTER/DROP con estas demostraciones DML: MariaDB puede realizar commits implícitos de DDL. Las inyecciones de fallos se ejecutan solo en el entorno de pruebas, sin un endpoint público que permita provocarlas.

## Hito 4: aplicación en incrementos comprobables

1. Configuración/pools, API de salud y perfiles; validación de entorno y errores.
2. Catálogo/colección y editor de mazos contra SQL real. Validar borrador y mazo listo.
3. Inicio/reanudación y transición privada, con manos iniciales persistidas.
4. Invocación y cambio de turno; después ataque y resultado alcanzable.
5. Estadísticas e historial mediante consultas/vista reales, pulido responsive y accesibilidad.
6. Instalación desde cero, revisión de secretos, informe final de 2–3 páginas y bitácora actualizada.

Con cada incremento, verificar la ruta frontend → API → SQL y guardar evidencia. No comenzar por una interfaz que simule una partida sin base.

## Matriz de pruebas previstas

| Área | Casos principales | Evidencia esperada |
|---|---|---|
| Jugadores | Crear; alias vacío/duplicado; reglas de mayúsculas | Respuesta validada y unicidad comprobada en SQL |
| Colección/mazos | Borrador; 12 válidas; 13; tercera copia; no poseída; cantidad poseída insuficiente; mazo ajeno | Rechazos desde la base y composición previa intacta |
| Inicio | Distintos jugadores; propiedad; exactamente dos participantes y 24 instancias; 3+3 en mano y 9+9 en mazo | Unicidad de posiciones y ausencia de copias duplicadas |
| Energía/robo | Primer turno de ambos a 1 sin robo; segundo a 2 con robo; tope 5; robo sin reposición; mazo vacío | Estados y secuencia esperados |
| Invocación | Consumo exacto; energía insuficiente; cuarto espacio; copia ajena/fuera de mano; rival actuando | Estado y eventos sin cambios en rechazos |
| Ataque | Recién invocada; preparada; ya atacó; aliado; otra partida; héroe protegido; héroe expuesto | Reglas comprobadas en rutinas y API |
| Combate | Daño simultáneo; persistencia; una/dos muertes; exceso sin transferencia; contraataque no consume ataque propio | Vidas, zonas y atribución de eliminaciones coherentes |
| Turnos/final | Alternancia; cierre 29 sin límite; cierre 30; victoria inmediata; empate; acciones tras final | Resultado único y ausencia de turno 31 |
| Recuperación | Recarga; respuesta perdida; reintento igual y clave reutilizada con otro contenido | Reanudación sin duplicar efecto ni revelar mano en transición |
| Atomicidad | Fallo antes y después de escribir; fallo al crear evento; composición interrumpida | Snapshot canónico completo anterior = posterior al ROLLBACK |
| Concurrencia | Misma copia dos veces; dos invocaciones por último lugar; dos inicios con mismo jugador; edición frente a inicio | Un solo efecto legal, sin sobrepasar límites ni partidas parciales |
| Permisos | Intento de escritura directa con rol de aplicación | Rechazo; rutinas autorizadas siguen funcionando |
| UI | Transición, errores/carga, teclado, móvil, movimiento reducido | Revisión real en navegador, con evidencia y limitaciones |
| Paridad | Fixtures y secuencias idénticos en ambos motores aprobados | Mismos estados canónicos tras cada aceptación/rechazo |

No duplicar pruebas que solo repitan el código. Priorizar invariantes, casos límite, transacciones y concurrencia contra bases reales. Dobles de repositorios pueden ayudar a probar HTTP, pero no prueban una FK, trigger, permiso o bloqueo SQL.

## Verificado ahora y pendiente

En Etapa 0 se comprueban inventario, versiones/conexión MariaDB y consistencia documental del catálogo/enlaces. No hay aplicación, migraciones ni conexiones `mysql2`/`pg` que probar todavía. No se ejecutaron pruebas de partida, SQL de negocio, ROLLBACK, permisos, concurrencia, UI ni equivalencia PostgreSQL. No se afirma balance empírico.

Los resultados reales de cada hito deberán incluir comando o procedimiento, entorno, resultado esperado, observado y, si falla, incidencia o limitación. No reemplazar esta evidencia por una lista de casos planeados.
