# Verificación de reglas y cierre del Hito 1

Revisión documental: 02/11/2026. Resultado: **propuesta conceptual viable, Hito 1 aún no validado**. No se detecta una regla 0.2 que obligue a añadir otra entidad de dominio. La cobertura depende de aceptar las decisiones de [la matriz](07-matriz-de-decisiones-cierre.md) y de representar correctamente sus restricciones al construir [el MER manual](08-guia-manual-mer-drawio.md).

## Trazabilidad de las 24 reglas

Cada número remite al [reglamento 0.2](02-reglamento-recomendado.md). Se agregan datos/relaciones necesarios a los mecanismos ya estudiados en [factibilidad MariaDB](05-factibilidad-mariadb.md); no se repite el reglamento ni se implementan rutinas. «Procedimiento» siempre implica comprobaciones dentro de la base, permisos limitados y transacción cuando modifica varios hechos.

| Regla 0.2 | Datos y relaciones necesarios | Mecanismo posible en MariaDB 10.4.32 |
|---:|---|---|
| 1 | Carta: nombre, palo/número, ataque, vida, costo, jerarquía | PK, UNIQUE del par, NOT NULL y CHECK de dominios; catálogo congelado por permisos |
| 2 | Jugador–Coleccion_Jugador–Carta: cantidad poseída | Asociación única, FKs y CHECK positivo; consulta por dueño sin descontar copias al jugar |
| 3 | Mazo–Mazo_Carta–Carta y dueño–Coleccion_Jugador | CHECK 1–2 y UNIQUE por par; procedimiento bloquea Mazo y comprueba suma ≤12 y disponibilidad; inicio exige suma =12 |
| 4 | Mazo usado en Participante; dueño, composición, nombres y archivo; Carta congelada | Procedimiento rechaza edición de usado y conserva referencias; permisos/posible trigger de refuerzo; sin borrado histórico |
| 5 | Partida–Participante–Mazo–Jugador: posiciones y vida | CHECK de vida/posición; inicio bloquea jugadores/mazos, exige dos dueños distintos y ausencia de otra activa; sorteo persistido |
| 6 | Partida, dos participaciones, sus 24 copias y Turno inicial | Procedimiento transaccional valida cardinalidades y permutación; unicidad de posiciones por participación; estado parcial no se confirma |
| 7 | Copia–Participante y Copia–Carta; zona única | FKs y CHECK de dominio; procedimientos permiten solo transiciones legales, dueño/tipo inmutables |
| 8 | Partida–Turno, número global; posiciones de participantes | UNIQUE por partida/número y CHECK 1–30; procedimiento bajo bloqueo controla consecutividad y un abierto; actor derivado |
| 9 | Turno: energía/orden; Copia: posición/zona; solicitud confirmada | Apertura transaccional roba una sola copia por orden y repone energía; idempotencia evita repetir apertura |
| 10 | Turno: energía disponible; Carta: costo; Invocacion | CHECK no negativo y rango básico; procedimiento valida máximo derivado y descuenta solo al invocar; ataque no descuenta |
| 11 | Turno abierto y Partida activa; órdenes de Jugada | Procedimientos permiten intercalar acciones; cierre no requiere agotamiento de recursos; orden único por turno |
| 12 | Copia propia en mano, Carta costo/vida, energía del Turno y campo por Participante | Procedimiento bloquea Partida, verifica energía y conteo <3, descuenta, mueve y registra Jugada/Invocacion atómicamente |
| 13 | Copia–Invocacion–Jugada–Turno | Procedimiento exige invocación en turno anterior para atacar; defensa no exige ese plazo |
| 14 | Ataque–Jugada–Turno y copia atacante | Procedimiento consulta ataques previos de esa copia/turno bajo el mismo bloqueo; no confunde defensa con ataque propio |
| 15 | Roles de Ataque a Copia o Participante; dueños y partida del turno | FKs, CHECK de objetivo exclusivo cuando se traduzca a referencias opcionales y procedimiento que valida rivales/zonas/ámbito/campo vacío para héroe |
| 16 | Ataque base de Carta; vidas previas de ambas Copias o del héroe; Ataque | Procedimiento toma ambos valores previos, calcula daño y actualiza todo en una transacción; error provoca ROLLBACK completo |
| 17 | Zona/vida actuales de Copia y eventos Ataque | CHECK zona/vida de una fila y procedimiento para límite con vida base; cambio a descarte junto al daño, sin reinicio por turno |
| 18 | Campo rival actualizado y ataques consumidos de otras copias | Procedimiento vuelve a comprobar campo y preparación al ejecutar la siguiente acción; no reutiliza una lectura anterior |
| 19 | Turno actual/siguiente, Partida, energía, copia robada y solicitud | Procedimiento cierra y abre en una transacción; lecturas de manos son proyecciones; ocultación presencial corresponde a la interfaz futura |
| 20 | Ataque, vida del héroe, Partida: ganador/motivo/fin, Turno: cierre | Procedimiento de ataque cierra turno y partida al llegar a cero; rechaza acciones posteriores; no abre ni roba |
| 21 | Último Turno global 30; vidas de ambos participantes; ganador opcional/motivo | Procedimiento de cierre compara, registra victoria o empate y no crea 31; prevalece victoria letal previa |
| 22 | Posiciones y zonas de las doce Copias por participante; Turno propio derivado | Procedimiento de apertura admite cero candidatas al robo sin modificar vida ni terminar partida |
| 23 | Partida: estado/versión; Turno; Solicitud_Operacion: clave/clase/huella | Procedimientos rechazan errores, UNIQUE/idempotencia y transacción completa; reanudación por estado persistido, sin cambio por desconexión |
| 24 | Partida–Participante, ganador de la misma partida, motivo/fechas y Turnos/Jugadas | CHECK de coherencia local más procedimiento de cierre para condiciones cruzadas; historial por consulta y conservación de eventos |

Las diez exigencias destacadas por el usuario quedan cubiertas: 12/2/disponibilidad (regla 3), energía/3 activas (12), turno (8/11), ataque único (14), atomicidad (16), victoria (20) y global 30 (21). La especialización y sus atributos se auditan además contra H08/D05: procedimientos deben crear supertipo y un único subtipo juntos; una FK por sí sola no garantiza total/disjunta.

Constraints, permisos y procedimientos son garantías de la base previstas, no pruebas ejecutadas. CHECK es de fila; no reemplaza sumas, conteos, pertenencia a la misma partida ni verificaciones temporales. FOR UPDATE debe mantenerse dentro de una transacción InnoDB. Se contrastaron las referencias oficiales de [restricciones](https://mariadb.com/docs/server/reference/sql-statements/data-definition/constraint) y [bloqueos](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update). Se conserva el contrato del documento 05: coordinador único, errores propagados, ROLLBACK completo, lecturas actuales tras bloquear y sin COMMIT interno de rutinas.

## Cumplimiento posible de la consigna

| Exigencia | Dictamen de esta revisión | Evidencia que todavía falta |
|---|---|---|
| Mínimo ocho tablas | Viable: ocho entidades de base (Jugador, Carta, Mazo, Partida, Participante, Turno, Copia, Jugada), dos asociaciones y dos subtipos permiten una traducción prevista de doce, sin contar soporte técnico | MR aprobado y tablas realmente creadas en Hitos 2/3; entidad conceptual no equivale automáticamente a tabla |
| N:M con atributos | Viable: composición con cantidad y colección con cantidad poseída | MER manual sin duplicar asociaciones; luego claves/unicidad de cada par |
| Estructura avanzada | Candidata útil: Jugada total/disjunta; no habilidad ficticia | Aceptación docente y dibujo EER correcto; después implementación de exclusividad/totalidad |
| Al menos tres reglas SQL | Superable por mecanismos identificados en 3, 12 y 14, entre otros | SQL real, rol limitado y pruebas de rechazo/atomicidad en Hito 3 |
| Modelo normalizable a 3FN | No se observa un obstáculo conceptual con las fuentes propuestas | Claves y dependencias completas en Hito 2; no hay certificación 3FN actual |
| MariaDB 10.4.32 | Factibilidad ya comprobada documentalmente y con conexión en documento 05; no requiere PostgreSQL | DDL compatible y pruebas reales; no se repitió la conexión en esta revisión |
| Partida completa con final alcanzable | Reglas cubiertas y secuencias razonadas de victoria/empate ya documentadas | Revisión humana de escenarios y, en Hito 4, aplicación jugable; no hay partida de software ejecutada |

No hay un incumplimiento conceptual inevitable identificado. **No están cumplidas todavía** la entrega de un MER humano validado, la aceptación de la estructura avanzada ni las exigencias de implementación de hitos posteriores. El mayor riesgo académico es confundir viabilidad o documentación de IA con aprobación humana o evidencia SQL.

## Observaciones para resolver antes de empezar el Hito 2

| Punto abierto | Acción concreta y condición de resolución |
|---|---|
| Propiedad y colección | Resolver B1; no necesitar movimientos de inventario ni versiones históricas que el MER no represente |
| Especialización | Resolver B2 con el docente; si la rechaza, corregir el MER antes de validarlo, sin agregar una relación decorativa |
| Duplicación de fuentes | Resolver B3; etiquetar jugador/actor/preparación derivados y observaciones de ataque almacenadas; no repetir estadísticas base en Copia |
| Temporalidad y ámbito | Resolver B4; anotar dos participantes, doce copias, un turno abierto y mismo ámbito para objetivos/ganador |
| Nombres y claves | Asignar responsable para D10; su collation/normalización se decide al elegir claves en Hito 2, sin bloquear el dibujo conceptual |
| Traducción posterior | Dejar identificados D08/H09 y las condiciones cruzadas que requerirán rutinas; no confundir una nota de cardinalidad con un CHECK ya diseñado |

En particular, mazo → dueño vuelve potencialmente redundante almacenar ambos en Participante; turno → actor vuelve redundante repetir actor en Jugada; Copia → Carta evita copiar atributos base; eventos de invocación/ataque evitan cachés de preparación. Las vidas previas de Ataque son observaciones temporales justificadas, no otra fuente de vida actual. Esa redundancia histórica no demuestra ni refuta por sí sola 3FN: las dependencias de las relaciones finales deben analizarse formalmente.

## Condiciones finitas para terminar el Hito 1

- [ ] B1–B4 resueltos con IDs, alternativa elegida, integrantes, fecha y versión; sin aprobaciones supuestas.
- [ ] MER dibujado por el grupo en `.drawio`, con atributos, roles, mínimos/máximos, N:M con cantidades, especialización y relaciones derivadas identificadas.
- [ ] E01/E03/E08/E10/E14–E18 y las secuencias completas existentes recorridas por el grupo sobre el diagrama, registrando observaciones y correcciones.
- [ ] Diagrama y matriz revisados, incluidos sus requisitos con el docente; estructura avanzada aceptada y observaciones conceptuales bloqueantes resueltas.
- [ ] Versión final, revisores y participación de IA registrados; asuntos propios del Hito 2 asignados sin afirmar que ya están implementados.

No se exige escribir procedimientos, probar frontend ni finalizar el balance empírico para cerrar este hito. Cumplir esta lista permite declarar terminado el Hito 1; no autoriza por sí solo comenzar el Hito 2 en este chat. El siguiente insumo esperado es el MER manual del grupo para auditoría.

## Registro de esta intervención

Trabajo de IA: lectura de los seis documentos de Etapa 0 y siete documentos previos del Hito 1; consolidación de 22 IDs existentes en cuatro acuerdos; trazabilidad de 24 reglas; guía manual y condiciones de cierre. No se agregaron entidades, estadísticas ni reglas de juego. No hay aprobaciones humanas nuevas.

Para preservar los antecedentes se añadieron únicamente los documentos 07, 08 y 09; esta sección registra el aporte sin editar índices, reglamento ni bitácora anteriores. La verificación documental contrasta hashes de los originales, enlaces locales y cobertura de identificadores. No se ejecutaron pruebas de negocio SQL ni se creó un diagrama, SQL de implementación, frontend, backend o commit.
