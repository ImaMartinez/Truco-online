# Arquitectura e integridad propuestas

Estado: decisiones de Etapa 0, sujetas a validación del grupo. Aquí se describe el comportamiento esperado; no se define DDL, nombres definitivos de rutinas ni contratos implementados.

## Recorrido de una operación

El navegador React envía una solicitud a Express. El controlador valida forma y tipos, el servicio coordina el caso de uso y el repositorio del motor invoca SQL parametrizado. La base comprueba las reglas y confirma el cambio completo. El repositorio traduce el resultado y los errores a un contrato común; el frontend vuelve a mostrar el estado confirmado.

React/Vite/TypeScript en `localhost:5173` → API Node/Express/TypeScript en `localhost:4000` → MariaDB de XAMPP. La alternativa usa la misma API y PostgreSQL alojado en Supabase. No hay acceso SQL desde el navegador, ORM ni persistencia alternativa en localStorage.

El frontend conserva únicamente estado de presentación y respuestas temporales. El catálogo, manos, orden de robo, daño y resultados residen en SQL. No se introduce un motor completo de reglas paralelo en TypeScript: las decisiones autoritativas del combate viven en rutinas SQL; el servicio coordina la solicitud y la interfaz anticipa restricciones con fines de usabilidad.

## Módulos y contratos

| Módulo | Responsabilidad | Operaciones de repositorio propuestas |
|---|---|---|
| Jugadores | Perfiles locales y selección | Crear/listar perfiles |
| Colección | Catálogo, filtros y cantidades | Consultar catálogo/colección con orden permitido |
| Mazos | Composición, borradores, duplicación y archivo | Crear, guardar composición atómica, listar, duplicar/archivar |
| Partidas | Inicio, turnos, combate y reanudación | Iniciar, leer vista pública/privada, invocar, atacar, finalizar turno |
| Estadísticas | Historial y rendimiento | Leer ranking SQL, detalle y consultas de estadísticas |

Se proponen carpetas `modules/<modulo>/` con rutas/controlador, servicio y repositorio; pools/configuración y middleware de errores compartidos. Un repositorio por módulo puede tener implementación MariaDB y PostgreSQL. No hace falta una capa genérica por cada tabla.

La interfaz común expresa **operaciones del juego**, no solo CRUD ni una cadena de SQL universal. Cada adaptación tiene consultas legibles, parámetros, resultados y traducción de errores propios. Evitar reemplazar `?` por `$1` mediante expresiones regulares: diferencias de dialecto, rutinas y resultados van más allá de los marcadores.

Rutas conceptuales: jugadores, colección de jugador, mazos de jugador, creación de partida, vista de partida, invocaciones, ataques, cierre de turno y estadísticas. El diseño HTTP definitivo se hará después de aprobar las operaciones del dominio.

## Reglas críticas impuestas en la base

| Regla | Mecanismo SQL propuesto | Qué debe probarse |
|---|---|---|
| No repetir número/palo | UNIQUE, NOT NULL y dominio de números/palos | Rechazo de duplicados y de 8/9 |
| Una o dos copias por tipo en mazo | CHECK de cantidad y UNIQUE del par mazo/carta | Rechazo de 0, 3 y filas duplicadas |
| Mazo de hasta 12 | Rutina de composición con bloqueo del mazo y suma final | Dos ediciones concurrentes no superan 12 |
| Exactamente 12 para jugar | Rutina de inicio con lectura bloqueada y validación final | 11/13 no inician; no queda media partida |
| Solo cartas poseídas | Rutina que cruza dueño, colección y cantidad; FKs para existencia | Sin fila de colección o con cantidad insuficiente, rechazo |
| Solo el actor del turno | Rutina que bloquea Partida y comprueba participante, turno y estado | Rival, turno viejo y partida finalizada, rechazo |
| Energía suficiente | Rutina de invocación; descuento y movimiento atómicos; CHECK no negativo | Sin energía no cambia mano ni se registra invocación |
| Máximo tres en campo | Rutina cuenta bajo el bloqueo compartido por todas las acciones de esa partida | Dos invocaciones por el último lugar no producen cuatro |
| Preparación y ataque único | Rutina verifica turno de invocación y último ataque; actualiza con el combate | Doble clic concurrente aplica un solo ataque |
| Objetivos legales | FKs, exclusión de objetivos y comprobaciones de dueño, zona y misma partida | No atacar aliados, otras partidas ni héroe protegido |
| Dos participantes y un turno abierto | Rutinas de inicio/cierre y restricciones de unicidad posibles | No aparece un tercero ni dos turnos activos |
| Fin coherente | Rutina comprueba vida y límite; finaliza una sola vez | Sin turno 31 ni nuevas acciones después del resultado |

Los CHECK se limitan a condiciones de una fila y se combinan con NOT NULL cuando corresponda. Sumas, conteos y pertenencias a otros registros no se resolverán con CHECK agregado. Las comprobaciones SQL tienen que existir dentro de la rutina/trigger, no ser un `if` exclusivo de Node.

La recomendación es concentrar acciones en rutinas con permisos: rol de aplicación con SELECT sobre lecturas autorizadas y EXECUTE sobre operaciones, sin INSERT/UPDATE/DELETE libre en tablas de juego. Rol de migraciones independiente. Para escrituras simples de perfiles también se puede usar una rutina pequeña y conservar este límite. Debe verificarse con intentos SQL directos usando **el rol de aplicación**, además de los tests REST.

Si una rutina necesita ejecutar con privilegios del propietario, usar un propietario sin acceso interactivo ni permisos innecesarios y conceder únicamente la ejecución necesaria. En PostgreSQL preferir invocador; un definidor se justifica solo para esta frontera concreta, en esquema privado, con referencias calificadas, `search_path` controlado y ejecución revocada a PUBLIC/roles no autorizados. No añadir SECURITY DEFINER para resolver indiscriminadamente errores de permisos. En MariaDB revisar igualmente el DEFINER y SQL SECURITY al instalar.

Un administrador de la base siempre puede alterar datos o desactivar controles: la garantía operativa se refiere a las cuentas y caminos de escritura definidos, no a resistir al administrador de XAMPP.

## Una transacción por acción

Recomendación: el backend obtiene una conexión, inicia la transacción, invoca la rutina del motor, obtiene el estado resultante, hace COMMIT y libera la conexión. Ante cualquier error hace ROLLBACK y libera la conexión. **Las rutinas no hacen COMMIT propio** ni inician otra transacción; así se mantiene un único responsable del límite transaccional.

Secuencia conceptual de **invocar**:

1. Bloquear la fila Partida. Es el mutex estable para todas sus escrituras, incluso cuando el campo está vacío.
2. Buscar una operación confirmada con la misma clave de solicitud. Si coincide tipo/actor/parámetros, devolver «ya aplicada» sin repetir; si no coincide, rechazar reutilización de clave.
3. Comprobar versión esperada, estado activo, turno y actor. Volver a comprobar después de esperar el bloqueo, no antes solamente.
4. Leer la copia, su dueño/zona y el costo del catálogo; comprobar energía y contar el campo propio.
5. Descontar energía; cambiar zona a campo, vida y turno de invocación; crear Jugada e Invocacion.
6. Incrementar versión; registrar Solicitud_Operacion confirmada dentro de esta misma transacción.
7. Leer la vista permitida, hacer COMMIT y recién entonces mostrar éxito.

Para **atacar**, el bloqueo y las validaciones son equivalentes: tomar ambos valores anteriores, aplicar los dos daños, mover a descarte las copias muertas, consumir el ataque, registrar Jugada/Ataque y resolver victoria en el mismo cambio. No dividir los daños en dos solicitudes o dos transacciones.

Para **finalizar turno**, cerrar el actual, comprobar límite y, si sigue, abrir el siguiente con energía/robo. Para **iniciar**, bloquear jugadores y mazos seleccionados, validar ambos, materializar copias y reparto, y activar la partida únicamente cuando esté completa.

Guardar una composición completa también debe ser atómico: validar la composición propuesta, reemplazar sus renglones y verificar el total antes de confirmar. Si se elimina primero la composición vieja y una inserción falla, ROLLBACK debe restaurarla.

## Concurrencia, reintentos y errores

- Las operaciones que bloqueen varios recursos respetarán un orden común: jugadores por identificador, mazos por identificador, partidas por identificador y después sus filas hijas por identificador. Un ataque solo necesita Partida y sus hijos; no adquirirá después bloqueos de jugadores/mazos.
- Inicio y edición de mazos comparten el bloqueo estable del mazo; el inicio también bloquea los jugadores para impedir dos partidas activas simultáneas. Una vez utilizado, el mazo queda inmutable.
- Consultas que fundamenten una decisión usarán lecturas bloqueantes apropiadas dentro de la transacción. No depender del aislamiento predeterminado ni de un conteo leído antes de obtener el mutex.
- Clave de solicitud y versión esperada son complementarias: la primera detecta reintentos; la segunda rechaza acciones de una pantalla obsoleta. Solicitud_Operacion guarda huella de parámetros, no secretos ni el estado entero en JSON. Su unicidad se comprueba en SQL y se relee tras obtener el bloqueo.
- Ante pérdida de conexión durante COMMIT, el resultado es incierto para el cliente. Consultar la clave de solicitud y el estado actual; no repetir a ciegas. Una respuesta «ya aplicada» puede adjuntar la vista actual y su versión, sin prometer reconstruir una respuesta HTTP antigua.
- Traducir errores de rutinas/restricciones a códigos estables: TURNO_INVALIDO, ENERGIA_INSUFICIENTE, CAMPO_LLENO, CARTA_AGOTADA, MAZO_INVALIDO, ESTADO_DESACTUALIZADO. Los textos técnicos, SQL y secretos no llegan al usuario.
- Deadlock o fallo de serialización: ROLLBACK completo, reintento limitado con la misma clave cuando se conozca el desenlace, y error claro si persiste. Una violación de regla no se reintenta automáticamente.

Caso de concurrencia obligatorio: dos solicitudes distintas para invocar por el último lugar. La primera confirma; la segunda espera el mismo bloqueo y luego ve otra versión/campo completo. Con la misma clave se devuelve el resultado ya aplicado. El conteo y el descuento no deben hacerse fuera de la transacción.

## MariaDB y PostgreSQL: equivalencia funcional

| Aspecto | MariaDB principal | PostgreSQL complementario |
|---|---|---|
| Motor verificado | 10.4.32, InnoDB | Versión pendiente de SELECT version() en destino |
| Controlador | mysql2/promise; conexión obtenida del pool | pg; cliente obtenido de pool.connect() |
| Parámetros | execute con `?` y valores separados | query con `$1`, `$2`, … y valores separados |
| Identidad y devolución | AUTO_INCREMENT y resultado del controlador | Identidad y RETURNING, según versión comprobada |
| Rutinas y errores | Procedimientos/SQL propio y SIGNAL | Funciones o rutinas PL/pgSQL y RAISE EXCEPTION |
| Bloqueos | InnoDB y FOR UPDATE dentro de transacción | FOR UPDATE y bloqueos transaccionales |
| Tipos/dominos | Enteros, textos, fechas y CHECK explícitos | Equivalentes nativos con conversión en repositorio |
| Texto | utf8mb4 y collation elegida explícitamente | UTF-8 y collation elegida explícitamente |
| Instalación | DDL separado de DML transaccional | Scripts propios; no importar dump MariaDB |
| Errores | Mapear códigos del controlador/SQLSTATE | Mapear SQLSTATE, sin depender del texto libre |

Se propondrán identificadores y códigos técnicos normalizados; alias/nombres visibles preservan español. La política de unicidad de alias, acentos y mayúsculas debe definirse explícitamente y probarse, porque las collations pueden producir resultados distintos.

Montos, ataques y vidas son enteros; porcentajes se calculan evitando división entera y división por cero. Fechas del backend y la base se tratarán en UTC y la UI las mostrará en horario local. No depender de orden de filas implícito: toda consulta que afecte robos o presentación lleva un orden explícito.

Variables conceptuales del backend: DB_ENGINE, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD y configuración TLS; para PostgreSQL puede utilizarse DATABASE_URL en su lugar. Rechazar combinaciones incompletas o motores desconocidos al iniciar. No se crean todavía archivos .env con valores inventados.

El barajado y el sorteo se generan una sola vez en backend; la base recibe y valida una permutación completa y el jugador inicial. Para pruebas de equivalencia se proporciona el mismo orden fijo a ambos motores; no se comparan sus funciones aleatorias. Los fixtures compartirán códigos lógicos de cartas, no identificadores autogenerados.

Se mantendrán scripts y rutinas específicos por motor, fixtures equivalentes y una sola especificación de reglas. La paridad se demostrará reproduciendo secuencias y comparando estados canónicos después de cada acción: zonas, vidas, energía, turnos, eventos y resultado, excluyendo IDs físicos y marcas horarias.

## Versión pública futura

La aprobación docente es condición de la adaptación académica PostgreSQL. No habilita por sí sola una publicación: faltarán autenticación, autorización por participante, HTTPS, gestión de secretos y pruebas de exposición de datos.

Para un backend Node persistente, elegir conexión directa si la red lo admite o pooler de sesión según el destino comprobado. Si se usa pooler de transacción, revisar restricciones antes de habilitar prepared statements con nombre o estado de sesión. TLS debe validar certificados; no deshabilitar su validación para lograr conexión.

Preferir tablas/rutinas de juego en esquema no expuesto por la Data API y rol SQL mínimo para el backend. Si se exponen tablas, revisar GRANT y RLS por separado; las vistas y funciones también requieren permisos explícitos. No exponer tablas de manos a usuarios anónimos. No hay necesidad de una clave service_role en el frontend ni de usar supabase-js para reemplazar el repositorio SQL.

La lectura de partida tendrá una proyección pública (héroes, campo, cantidades de mano/mazo y turno) y otra privada para la mano del participante que corresponde. Al finalizar turno no se devuelve la mano siguiente a la pantalla anterior; se solicita después de la transición. La versión local sigue siendo de confianza compartida y no equivale a autenticación remota.

GitHub alojará el repositorio y podrá originar despliegues futuros. GitHub Pages no ejecuta este backend ni aloja SQL. No se realizó ningún despliegue en Etapa 0.

## Referencias técnicas

La estrategia de transacciones, marcadores, CHECK y permisos se contrastó con [mysql2](https://sidorares.github.io/node-mysql2/docs), [transacciones de pg](https://node-postgres.com/features/transactions), [FOR UPDATE en MariaDB](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update), [constraints PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html) y [seguridad de Data API](https://supabase.com/docs/guides/api/securing-your-api). Evidencia de versiones, limitaciones y demás fuentes en [entorno y fuentes](../entorno-y-fuentes.md).
