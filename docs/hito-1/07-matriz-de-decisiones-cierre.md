# Decisiones para cerrar el Hito 1

Nota de cierre 03/11/2026: el usuario aclaró que costo de energía y jerarquía tradicional son independientes. Esa aclaración resuelve la reserva técnica jerarquía→costo, según [auditoría actualizada](../hito-2/02-auditoria-implementacion.md), sin modificar estadísticas ni aprobar B3 completo. Los estados pendientes de esta matriz se conservan: no hay acta de ratificación grupal.

Revisión: 02/11/2026. No hay aprobaciones humanas registradas. Este documento consolida D01–D10 y H01–H12, sin reescribir el [reglamento 0.2](02-reglamento-recomendado.md), el [modelo candidato](04-modelo-conceptual-candidato.md) ni los [escenarios](06-revision-del-grupo-y-escenarios.md).

El paquete de cierre se completa con la [guía manual del MER](08-guia-manual-mer-drawio.md) y la [verificación de reglas y consigna](09-validacion-reglas-y-cierre.md). Los archivos anteriores se conservan sin cambios. «Impacto en MR» anticipa consecuencias, no constituye un modelo relacional aprobado.

## Orden de resolución: cuatro acuerdos, sin nuevas mecánicas

| Acuerdo de trabajo | IDs relacionados | Resolución necesaria para cerrar el dibujo |
|---|---|---|
| B1 — Colección y propiedad histórica | D01, D06, H04; consecuencia H10 | Confirmar cantidades por tipo, ausencia de bajas/intercambios, mazos usados inmutables y jugador derivado del dueño del mazo |
| B2 — Especialización | D05, H08 | Confirmar qué es Jugada y aceptación docente de Invocacion/Ataque total y disjunta |
| B3 — Fuentes de los datos | H03, H05, H06, H07, H12 | Marcar atributos almacenados/derivados, vida según zona y observaciones históricas del ataque |
| B4 — Invariantes del reglamento | D02, D03, D07, H01, H02 | Ratificar 0.2: turnos, preparación, cierre, paso libre y una partida activa por jugador |

B1–B4 agrupan decisiones existentes para una revisión finita; no son cuatro decisiones adicionales. Pueden dibujarse borradores mientras se discute, pero no rotular el MER como validado con alguno de estos acuerdos sin resolver. Las alternativas que contradicen requisitos obligatorios no quedan habilitadas por mencionarlas en la matriz.

## Matriz completa

Todos los estados son **pendiente**. Solo el grupo puede cambiarlos a **aprobado** o **rechazado**, indicando qué alternativa eligió y su evidencia. Rechazar una recomendación no rechaza automáticamente la regla obligatoria que debía satisfacer.

| ID | Problema o decisión / prioridad | Alternativas | Recomendación | Impacto en MR | Impacto en juego | Estado |
|---|---|---|---|---|---|---|
| D01 | B1: alcance de colección | Cantidades por tipo sin bajas; gestión de adquisiciones/bajas con políticas adicionales | Mantener cantidades y alcance MVP; confirmar «administrar» con docente | Asociación Jugador–Carta con cantidad; sin movimientos de colección | Sin consumo permanente ni intercambio | pendiente |
| D02 | B4: cierre por límite | Representar cierre en Partida/Turno; un resultado separado duplicaría el hecho. Cortar en 29 incumple 0.2 | Conservar cierre al finalizar global 30 | Número global, fin de turno, vida y ganador/motivo | Quince turnos propios salvo victoria previa | pendiente |
| D03 | B4: robo y preparación | Derivar de orden/aperturas/eventos; agregar registros redundantes | Mantener reglas 9 y 13, con fuentes derivables | Posición original y eventos de invocación; sin bandera extra | Sin robo propio 1 ni ataque al invocar | pendiente |
| D04 | Posterior: balance | Mantener 0.1; rebalancear tras evidencia | Mantener cuarenta estadísticas | No cambia entidades ni relaciones | Equilibrio todavía no probado | pendiente |
| D05 | B2: estructura avanzada | Especialización real; revisar otra estructura solo si el docente la rechaza | Total/disjunta Jugada–Invocacion/Ataque | Posible traducción a supertipo y subtipos; técnica en Hito 2 | No añade habilidades | pendiente |
| D06 | B1: estabilidad histórica | Congelar mazo usado/catálogo; versionarlos con mayor complejidad | Congelar y duplicar para editar | Mazo conserva dueño/composición; instancias preservadas | Edición de mazo usado mediante copia | pendiente |
| D07 | B4: modo local y simultaneidad | Una activa por jugador; múltiples activas con otra restricción | Mantener local, una activa y reanudación | Restricción entre participaciones y partidas activas | No hay derrota por desconexión | pendiente |
| D08 | Hito 2/3: garantía SQL | Procedimientos con permisos; triggers complementarios | Conservar frontera SQL; elegir detalles después | Constraints, rutinas y privilegios, no nuevas entidades | Acciones inválidas rechazadas | pendiente |
| D09 | Posterior: PostgreSQL | Adaptación aprobada más adelante; solo MariaDB académico | Posponer adaptación | SQL propio después; no condiciona MER | Sin cambio del MVP | pendiente |
| D10 | Hito 2: nombres | Collation explícita; clave canónica normalizada | Acordar unicidad antes de fijar claves/collation | Claves candidatas; sin entidad adicional | Define nombres repetidos y equivalencias | pendiente |
| H01 | B4: ataque letal | Cerrar turno y partida juntos; esperar otro botón dejaría un estado inválido | Cierre inmediato en la acción letal | Fecha de cierre y resultado coherentes | No hay robo ni turno siguiente | pendiente |
| H02 | B4: ataque y paso | Hacer explícitos costo cero y paso libre; añadir otra regla exigiría cambiar 0.2 | Ratificar reglas 10 y 11 | No hay gasto energético por Ataque | Pasar siempre permite avanzar | pendiente |
| H03 | B3: vida de copia por zona | NULL antes de invocar; inicializar vida anticipadamente sin utilidad | NULL en mazo/mano, positiva en campo, cero descartada | Nulabilidad y dominio condicional | Evita cartas muertas en campo | pendiente |
| H04 | B1: jugador de participación | Derivarlo del mazo; almacenarlo también y justificar dependencia | Derivar de dueño inmutable | Evita duplicar jugador con mazo → dueño | Mismo jugador conceptual | pendiente |
| H05 | B3: actor y turno actual | Paridad/posición y único abierto; referencias almacenadas adicionales | Derivar actor y turno actual | Evita dos fuentes y referencia circular innecesaria | Conserva alternancia | pendiente |
| H06 | B3: preparación y agotamiento | Consultar eventos; mantener cachés sincronizadas | Derivar de Invocacion/Ataque | Sin banderas/último ataque duplicados | Un ataque por copia y turno | pendiente |
| H07 | B3: estado e historia | Dos vidas previas por ataque; reconstrucción íntegra sin snapshots | Conservar dos observaciones justificadas; no duplicar daños/vidas posteriores | Atributos históricos en Ataque y estado actual separado | Mismos combates; cambia consulta histórica | pendiente |
| H08 | B2: significado de Jugada | Solo invocar/atacar; incluir cierres exigiría rediseñar la especialización | Conservar definición restringida | Turno registra cierre; Solicitud_Operacion es soporte técnico | No cambia acciones disponibles | pendiente |
| H09 | Hito 2/3: transacción | Coordinador único y lecturas actuales; rutinas con transacciones internas cambiarían el contrato | Mantener una transacción por acción | Protocolo de bloqueo/error; sin tabla nueva | Fallo no deja daño parcial | pendiente |
| H10 | Consecuencia de B1 | Consultar por Mazo → Jugador; agregar FK redundante por comodidad | Seguir la ruta de H04 | Ajusta JOIN previstos; no otra relación base | Ninguno | pendiente |
| H11 | Posterior: asimetría final | Mantener 0.2 y medir; cambiar secuencia final necesitaría nueva aprobación | Conservar regla, no rebalancear ahora | Ninguno con reglamento actual | Última respuesta del segundo; invocar en 30 puede ser inútil | pendiente |
| H12 | B3: nombre de carta | Nombre editorial en SQL; generarlo solo en API se aparta del pedido original | Nombre en Carta, sin copia en cada instancia | Atributo de catálogo | Presentación consistente | pendiente |

Los puntos de prioridad «Hito 2» o «Posterior» no bloquean el cierre conceptual si quedan documentados con responsable y etapa. No exigir su implementación para aprobar el Hito 1. H10 se resuelve como consecuencia del acuerdo de propiedad, sin otra votación.

## Registro humano de los cuatro acuerdos

Al aprobar un bloque, enumerar los IDs aceptados: un acuerdo parcial no aprueba el resto. Si se elige otra alternativa, describir el cambio y comprobar su efecto en los otros bloques, sin editar silenciosamente antecedentes.

| Acuerdo | IDs y alternativa elegida | Estado | Integrantes/revisor | Fecha y versión del MER | Observación o evidencia |
|---|---|---|---|---|---|
| B1 | Sin confirmar | pendiente | Sin registrar | Sin registrar | Colección y estabilidad histórica |
| B2 | Sin confirmar | pendiente | Sin registrar | Sin registrar | Incluir validación docente de estructura avanzada |
| B3 | Sin confirmar | pendiente | Sin registrar | Sin registrar | Fuentes de atributos y observaciones históricas |
| B4 | Sin confirmar | pendiente | Sin registrar | Sin registrar | Ratificación de invariantes 0.2 |

No se creó un MER definitivo ni se autorizó avanzar al Hito 2. El próximo resultado útil es el diagrama manual del grupo con estos acuerdos registrados.
