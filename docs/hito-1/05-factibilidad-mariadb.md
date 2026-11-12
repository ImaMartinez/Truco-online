# Factibilidad técnica — MariaDB 10.4.32 en XAMPP

Fecha de comprobación: 02/11/2026. **Conclusión:** el modelo candidato y las operaciones recomendadas son implementables con capacidades disponibles en MariaDB 10.4.32 e InnoDB. Se comprobó el servidor y se contrastó documentación; no se implementó ni se probó todavía el esquema del juego. Esta distinción evita presentar factibilidad como prueba funcional aprobada.

## Evidencia del entorno

Se ejecutaron únicamente lecturas de versión, configuración y `information_schema.ENGINES` mediante el cliente de XAMPP. No se inspeccionaron datos de otras aplicaciones ni se crearon objetos.

| Dato | Resultado observado |
|---|---|
| Servidor conectado | 10.4.32-MariaDB |
| Distribución | mariadb.org binary distribution |
| InnoDB | DEFAULT; transacciones YES; savepoints YES |
| Autocommit de la sesión de inspección | 1 |
| Aislamiento de esa sesión | REPEATABLE-READ |
| foreign_key_checks | 1 |
| check_constraint_checks | 1 |
| sql_mode | NO_ZERO_IN_DATE, NO_ZERO_DATE, NO_ENGINE_SUBSTITUTION |

Los controles FK/CHECK estaban habilitados en **esa sesión**. No se extrapola a futuras conexiones. El modo no incluye STRICT_TRANS_TABLES ni ONLY_FULL_GROUP_BY: se deberán definir y comprobar en las sesiones de aplicación/prueba al implementar, sin cambiar ahora la configuración global de XAMPP. No se verificó interfaz/versión de phpMyAdmin ni conexión `mysql2`.

## Capacidades y precauciones de versión

MariaDB ofrece las restricciones PK, FK, UNIQUE, NOT NULL y CHECK necesarias para dominios y referencias; elegir InnoDB y restricciones explícitas. CHECK no sustituye NOT NULL ni valida por sí solo sumas o conteos de otras filas. [Referencia oficial de restricciones](https://mariadb.com/docs/server/reference/sql-statements/data-definition/constraint).

En 10.4 no debe usarse como garantía una cláusula abreviada REFERENCES junto a una columna: hay sintaxis aceptada que no crea la FK. Al implementar, escribir la restricción FOREIGN KEY completa, comprobar metadatos/SHOW CREATE TABLE y probar un rechazo real. Esta advertencia de versiones está documentada en la [base oficial de conocimientos de MariaDB, sección CREATE TABLE](https://mariadb.org/wp-content/uploads/2025/03/MariaDBServerKnowledgeBase.pdf) y la [referencia de claves foráneas](https://mariadb.com/docs/server/ha-and-performance/optimization-and-tuning/optimization-and-indexes/foreign-keys).

Los [procedimientos almacenados](https://mariadb.com/docs/server/server-usage/stored-routines/stored-procedures) pueden concentrar las reglas. SIGNAL permite informar un rechazo de negocio, pero el coordinador debe ejecutar ROLLBACK de la transacción completa al recibir un error; no asumir que emitir el error revierte todas las sentencias anteriores. [Referencia SIGNAL](https://mariadb.com/docs/server/reference/sql-statements/programmatic-compound-statements/signal).

FOR UPDATE necesita una transacción efectiva con InnoDB. Una consulta aislada con autocommit no conserva el bloqueo para los pasos siguientes. Bajo REPEATABLE-READ, las lecturas que fundamentan una decisión deben ver el estado actual después de adquirir el bloqueo; usar lecturas bloqueantes pertinentes y evitar reutilizar una lectura consistente anterior. [Referencia de bloqueo](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update).

No se requieren JSON como estado completo, índices parciales de PostgreSQL, restricciones diferidas ni extensiones de otro motor. La exclusividad de turno abierto, los dos participantes y la especialización pueden controlarse por operaciones autorizadas y validaciones, con las restricciones declarativas que resulten aplicables al modelo final.

## Reglas que deben imponerse desde la base

Los identificadores SQL-R01…SQL-R10 son etiquetas de esta documentación; no son nombres de rutinas ya creadas.

| ID | Regla | Implementación recomendada | Por qué no basta el frontend |
|---|---|---|---|
| SQL-R01 | Máximo 2 por tipo en un mazo | CHECK de cantidad + UNIQUE de la asociación | Otra solicitud puede intentar cantidad 3 o repetir la asociación |
| SQL-R02 | Mazo de hasta 12; exactamente 12 para iniciar | Procedimiento de composición/inicio y bloqueo del mazo | Es una suma de filas y puede cambiar concurrentemente |
| SQL-R03 | Cartas poseídas por el dueño, en cantidad suficiente | Procedimiento que consulta colección y propietario; FKs para existencia | Una carta válida del catálogo puede no estar en esa colección |
| SQL-R04 | Actor correcto y partida activa | Procedimiento sobre la partida bloqueada y turno abierto | Una pantalla vieja o el rival puede emitir comandos |
| SQL-R05 | Invocar con energía y espacio | Procedimiento: comprobar mano/dueño/costo, contar campo, descontar y mover | Varios registros deben cambiar juntos; el campo puede estar vacío y aun así necesita mutex estable |
| SQL-R06 | Preparación y un ataque por copia/turno | Procedimiento consulta Invocacion y ataques del turno, bajo bloqueo | Dos solicitudes pueden leer inicialmente «no atacó» |
| SQL-R07 | Combate simultáneo y objetivos legales | Procedimiento lee ambas vidas antes de modificar, verifica rivales y aplica ambos daños/descartes | Actualizar un lado antes de calcular el otro rompe la simultaneidad |
| SQL-R08 | Dos participantes, 24 copias, un turno activo y apertura única | Procedimientos de inicio/cierre con comprobaciones de ámbito, conteos y orden | FKs de existencia no garantizan cardinalidades ni robo exactamente una vez |
| SQL-R09 | Victoria y límite 30 | Procedimiento de ataque/cierre: resultado, cierre de turno y ausencia de turno siguiente | Una operación posterior no puede modificar el resultado |
| SQL-R10 | Jugada total/disjunta y reintentos sin duplicación | Procedimientos crean padre/subtipo/solicitud juntos; claves únicas donde corresponda | FK del hijo al padre no impide otro subtipo ni una segunda ejecución |

Se identifican más de las tres reglas mínimas. Al implementarlas deberá existir evidencia de rechazo usando SQL con el rol de aplicación y pruebas REST; escribirlas en esta tabla no las convierte en restricciones ejecutadas.

## Procedimientos, triggers y permisos

Recomendación base: procedimientos pequeños por caso de uso para composición, inicio, invocación, ataque y cierre; restricciones declarativas para dominios/unicidades/referencias. No añadir un trigger diferente por cada regla si el mismo procedimiento y sus permisos ya la garantizan.

Triggers quedan como alternativa de refuerzo, a evaluar en Hito 2: proteger mazos usados contra cambios por otros caminos autorizados, o comprobar coherencia de subtipo/estado. No se propone que un trigger de fila compruebe sin bloqueo una suma global ni que un trigger inicie/confirme transacciones. Las [limitaciones oficiales de triggers](https://mariadb.com/docs/server/server-usage/triggers-events/triggers/trigger-limitations) deben revisarse antes de elegirlos.

Rol de aplicación: lecturas autorizadas y EXECUTE de procedimientos, sin DML libre sobre tablas de juego. Rol de instalación separado. El contexto DEFINER de las rutinas debe tener solo los permisos necesarios y existir en XAMPP al instalarlas. Verificar concesiones y rechazos reales; una cuenta administrativa no demuestra la frontera de permisos.

La composición y el dueño de un mazo usado no pueden cambiar por una ruta alternativa. Si más adelante se autorizan bajas de colección, esa operación deberá definir qué ocurre con mazos previos y bloquearlos de manera compatible; no inventar esa operación ahora.

## Límite transaccional y concurrencia

Cada acción crítica exige una transacción activa en una única conexión. El backend será responsable de comenzar, confirmar o revertirla; el procedimiento rechazará un uso sin el contexto transaccional exigido, sin hacer COMMIT interno. En pruebas directas SQL, el cliente debe respetar el mismo contrato.

Orden común cuando sea necesario adquirir varios recursos: jugadores ordenados → mazos ordenados → partidas ordenadas → hijos ordenados. Una acción de una partida existente bloquea su fila primero y no solicita después bloqueos superiores. Inicio y edición se sincronizan por el mazo; inicio bloquea también a los jugadores para impedir dos partidas activas.

Ejemplo conceptual de ataque, sin SQL de implementación:

1. Adquirir bloqueo de la partida y volver a consultar la solicitud idempotente.
2. Si ya está confirmada con el mismo comando, responder sin repetir el efecto. Si cambia el contenido, rechazar.
3. Verificar versión esperada, estado, actor y turno; consultar atacante, objetivo y eventos con la visibilidad actual requerida.
4. Tomar las vidas y ataques previos, actualizar ambas vidas/zonas y registrar una Jugada y su Ataque.
5. Si hay victoria, cerrar también turno y partida. Registrar versión/solicitud y confirmar todo; ante cualquier fallo, ROLLBACK completo.

La invocación une energía, zona/vida y evento. El cierre une turno anterior, comprobación de límite y apertura/energía/robo siguiente. El inicio une todos los objetos iniciales. Un error después del descuento de energía o del primer daño debe restaurar el estado previo, no solo impedir el último INSERT.

El bloqueo estable de Partida serializa las escrituras de esa partida, también cuando no hay copias en campo. La clave idempotente evita duplicados y la versión esperada rechaza estado obsoleto; no reemplazan las restricciones del dominio. Pérdida de respuesta durante COMMIT exige consultar el resultado antes de repetir.

Los DDL de instalación se separan de estas transacciones de negocio porque MariaDB tiene [sentencias con COMMIT implícito](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit). No se redactaron scripts ni se ejecutaron demostraciones de rollback en esta etapa.

## Adaptación posterior

PostgreSQL/Supabase sigue condicionado a la aprobación docente. Conservar el significado de entidades y reglas, y escribir después restricciones/rutinas/repositorios propios de ese motor. La factibilidad principal no depende de funciones exclusivas de PostgreSQL ni de una cuenta Supabase. La equivalencia de resultados requiere pruebas posteriores; no se afirma por tener un modelo común.

## Pendiente para confirmar la implementación

Después del MR aprobado: instalación limpia en 10.4.32; inspección de restricciones; pruebas de cada SQL-R; rollback con fallo después de escribir; dos sesiones concurrentes; permisos mínimos; consulta real de la vista; secuencia completa de victoria y empate. Todo eso sigue pendiente. La conexión de solo lectura y la documentación oficial confirman recursos disponibles, no certifican código inexistente.
