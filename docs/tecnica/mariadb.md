# Persistencia provisional MariaDB/XAMPP

> Guía actualizada 13/11/2026: para instalar desde cero y ejecutar la app, seguir el [instructivo completo con XAMPP](../../README.md#instalación-local-con-xampp). Incluye descarga del repo, Node, dependencias, credenciales, ambos entornos y diagnóstico. Este documento conserva contratos y evidencia histórica; el instalador actual aplica 01–05 y 08–10, concede ocho procedimientos públicos y admite mazos de 12/20. La base de la app es `truco_arena_dev`; `truco_online_xampp` pertenece al SQL separado de inspección.

Actualización académica: el instalador agrega `05-vistas.sql` y datos reproducibles (16 perfiles/mazos adicionales, 19 partidas) mediante las rutinas existentes. La colección consulta una vista. Consultas, auditoría 3FN, instalación aislada y rollback en [entrega académica](../hito-3/01-entrega-y-ejecucion.md); los párrafos siguientes conservan la referencia del corte jugable previo.

03/11/2026. Implementación de desarrollo sobre el [MR preliminar de 13 tablas](../hito-2/01-modelo-relacional-preliminar.md) y el [reglamento 0.2](../hito-1/02-reglamento-recomendado.md). **B1–B4 siguen pendientes; esto no aprueba el MER/MR ni el Hito 3.** No sustituye los documentos académicos.

## Instalar y ejecutar

Desde la raíz del repositorio, con Node 24.16 o superior y MariaDB iniciado en XAMPP:

```powershell
npm install
npm run db:install
npm run dev:sql
```

Abrir <http://127.0.0.1:5173/>. API: <http://127.0.0.1:4000/api/health>. Detener cualquier ejecución previa que ocupe esos puertos antes de cambiar de proveedor. `Ctrl+C` detiene ambos procesos. El modo persistente debe informar `storage: mariadb`, `database: connected`, `agreements: pending`; si la base falla, no se sustituye silenciosamente por memoria.

El instalador usa por defecto `root` local sin contraseña, propio de esta instalación XAMPP. Si tu administrador tiene contraseña, definirla en la terminal antes de instalar:

```powershell
$env:DB_ADMIN_USER = 'root'
$env:DB_ADMIN_PASSWORD = 'tu-clave-local'
npm run db:install
Remove-Item Env:DB_ADMIN_PASSWORD
```

El instalador solo apunta a `truco_arena_dev`. No contiene `DROP DATABASE`, no vacía tablas ni modifica otras bases. Aplica `01-schema.sql`, `02-routines.sql`, `03-seed.sql` y `04-combat.sql` en ese orden; separa sentencias `DELIMITER` para crear rutinas con mysql2. Para actualizar el primer corte ya instalado, detener el backend y ejecutar `npm run db:install`: conserva los datos y agrega las rutinas de combate y sus permisos. No es un migrador para versiones futuras del esquema: `IF NOT EXISTS` no altera tablas antiguas incompatibles. El DDL implica commits propios de MariaDB; una instalación interrumpida debe revisarse/repetirse, no se promete rollback del DDL.

Genera `backend/.env.mariadb`, ignorado por Git, con una contraseña aleatoria para `truco_arena_app`@`127.0.0.1`. No se imprime ni se comparte. En reinstalaciones reutiliza ese archivo; si la cuenta ya existía sin la credencial del proyecto, se detiene para evitar apropiarse de ella. Permisos: `SELECT` sobre esta base y `EXECUTE` exclusivamente sobre seis rutinas públicas: crear jugador, guardar mazo, iniciar partida, finalizar turno, invocar y atacar; sin DML directo. El administrador conserva sus permisos normales. No usar la cuenta root en Express.

Para iniciar por separado:

```powershell
# Terminal 1, raíz del repositorio
node --env-file=backend/.env.mariadb node_modules/tsx/dist/cli.mjs watch backend/src/server.ts
# Terminal 2, raíz
npm run dev:frontend
```

La demo previa sigue con `npm run dev` (sin definir `ARENA_STORAGE`). También puede fijarse `ARENA_STORAGE=memory`. Para cambiar de modo, reiniciar el backend. Nunca poner credenciales en variables `VITE_`.

## Corte funcional

| Operación | Persistencia |
|---|---|
| Catálogo de 40 cartas | `GET /api/catalog` lee `carta`; estadísticas originales |
| Jugadores y colección | `GET/POST /api/players`, `GET /api/players/:id/collection`; crear perfil de prueba concede dos copias de cada tipo |
| Mazos | `GET /api/decks?ownerId=…`, `POST /api/decks`, `PUT /api/decks/:id`; dueño explícito, borradores 0–12, máximos dos y colección |
| Inicio | `POST /api/duels`; dos jugadores, mazos propios exactos de doce, sorteo de posiciones y 24 copias |
| Recuperación | `GET /api/duels/:id`, `GET /api/players/:id/duels`; snapshot consistente y partidas activas |
| Turnos | `POST /api/duels/:id/actions` con `endTurn`; alternancia, energía, robo único, límite 30 y empate/victoria por comparación de vidas |
| Invocar | Mismo endpoint con `play`: mano propia, energía, campo <3, vida base, registro Jugada/Invocacion |
| Atacar | Mismo endpoint con `attack`: preparación, ataque único, objetivo rival, protección del héroe, daño simultáneo y descarte persistente |
| Victoria y recuperación | Letal registra VIDA_CERO y cierra turno/partida inmediatamente, también en 30; GET del duelo incluye estado, historial completo y resultado final |

La UI identifica el proveedor. Los perfiles son selección presencial local, **sin autenticación**; enviar un actor sirve para comprobar el turno, no prueba identidad ante usuarios remotos. Se mantienen las manos ocultas durante la transición local. Los datos completos del DTO llegan al navegador como en la demo; no es una arquitectura de multijugador remoto con secretos.

Datos iniciales: Ana, Bruno, Carla y Diego `demo SQL`, cada uno con colección de 40 tipos × 2 y un mazo de doce. Las pruebas agregan perfiles `test-…` para conservar evidencia, sin borrar partidas ajenas. Se pueden crear otros perfiles desde la UI/API. No se alteran colecciones durante partidas ni se permiten intercambios/bajas.

## Contrato de escrituras

Crear mazo requiere `{ ownerId, name, description?, entries: [{cardId, quantity}] }`. Editar conserva propietario; un mazo usado queda bloqueado y se duplica mediante POST con un nombre nuevo.

Inicio:

```json
{"scenario":"inicio","playerIds":["1","2"],"deckIds":["1","2"],"requestId":"11111111-1111-4111-8111-111111111111"}
```

IDs ilustrativos: usar los que devuelve la API. `mesa-abierta` solo existe en memoria.

Finalizar turno:

```json
{"expectedVersion":1,"actorId":"1","requestId":"22222222-2222-4222-8222-222222222222","action":{"type":"endTurn"}}
```

Invocar usa `action: {"type":"play","instanceId":"ID_DE_COPIA"}`; atacar usa `action: {"type":"attack","attackerId":"ID_DE_COPIA","targetId":"ID_DE_COPIA_RIVAL"}` o `targetId: "hero"`. Los otros campos del sobre son los mismos: versión esperada, actor y UUID propio de la acción. El cliente nunca envía daño, vida calculada ni ganador. Para héroe, Express resuelve el participante rival y SQL verifica su ámbito; los valores de combate se leen del catálogo y del estado bloqueado.

El cliente genera UUID antes del envío y conserva UUID **y payload** ante respuesta incierta. SHA-256 de parámetros canónicos lo calcula Express, no el navegador. La clave es global en `solicitud_operacion`; se escribe al final de la misma transacción del comando. Repetir recupera la misma partida/resultado sin otro sorteo, copia o robo. Cambiar el contenido con la misma clave es conflicto. El snapshot devuelto es actual; `operation.versionResult` identifica la versión del comando original y `operation.replayed` distingue el reintento. No confundirla con `version` actual.

Operaciones en una conexión, consultas parametrizadas mysql2, transacción coordinada por Express, locks y comprobaciones en procedimientos. Error: limpieza local por SAVEPOINT/handler y ROLLBACK completo del coordinador. Los deadlocks/timeouts o colisiones de la clave técnica tienen reintento acotado; no confirmar trabajo parcial. Lecturas compuestas del tablero usan transacción coherente.

## Correspondencia con el modelo y límites

- Se mantienen las 13 tablas y columnas propuestas: catálogo separado de copias, dueño de participante derivado del mazo, actor por posición/paridad, estado por fecha de cierre, contadores calculados. No se agrega `estado`, `id_jugador` redundante ni tablas para zonas/resultados.
- **Variación técnica:** la rutina expande `mazo_carta` y baraja sus doce filas mediante `ORDER BY RAND()` dentro de SQL, en lugar del JSON de permutación preparado por Node propuesto en el MR. Evita transportar/aceptar una composición del cliente y conserva el multiconjunto exacto, con postcondiciones en ambos sentidos. No cambia reglas ni estadísticas; sorteo para una demo, sin afirmación de aleatoriedad criptográfica.
- Los nuevos perfiles reciben colección completa como dato de desarrollo; no se modela una economía nueva.
- Jugada/Invocacion/Ataque conservan PK compartida y FKs. Pasar turno no crea una Jugada. `ta_invocar` y `ta_atacar` insertan el padre y exactamente su subtipo, comprueban totalidad/disyunción y deshacen su trabajo ante fallos. El rol app no puede insertar, actualizar ni borrar eventos directamente. **La totalidad es una garantía de los procedimientos y permisos**, no una CHECK/FK diferida: un administrador con DML puede insertar un padre sin hijo. Los triggers existentes refuerzan exclusión e inmutabilidad de actualizaciones. El adaptador rechaza como estado inválido un historial que el administrador haya dejado con cero o dos subtipos.
- Integridad interfilas (exactamente dos participantes, sumas, única activa, inmutabilidad de mazos usados, único turno abierto) se garantiza para los caminos concedidos al rol app con rutinas y bloqueo. Un administrador con DML puede eludirlos. FK/CHECK no prueban por sí solos todas esas reglas.
- `DuelState` añade campos opcionales `players[].discard`, `history` y `result`, sin romper el DTO de memoria. Copias descartadas y ataques utilizados proceden de SQL; el historial se ordena por turno/orden. La bitácora intercala turnos y eventos reales. Las vidas posteriores históricas se calculan desde las vidas previas y ataques congelados del catálogo, sin nuevas columnas ni duplicar hechos derivados. `result` informa VIDA_CERO/LIMITE_TURNOS y fecha final. El tablero presenta descartes públicos, historial completo y resultado, y desmonta ambas manos durante la transición.
- No hay importación de los duelos simulados, archivado UI ni autorización de usuarios. El selector lista partidas activas; las finalizadas se recuperan por su URL/ID. No se cambian reglas, estadísticas, tablas ni las 65 columnas del modelo preliminar. El motor en memoria conserva su implementación independiente.

## Verificar

```powershell
npm run db:seed:check
npm run test:sql
npm run test:e2e:sql
npm run check
```

`test:sql` exige la base instalada y el archivo local, compila el backend y arranca procesos Node reales. Ejecuta secuencialmente `sql-integration.test.ts` y `sql-combat.test.ts`. Usa administrador local solo para inyectar fallos y comprobar constraints en `truco_arena_dev`; la API usa el rol limitado. Las pruebas no se saltan si falta MariaDB. No ejecutarlas sobre una sesión de juego en uso: los triggers temporales se eliminan en `finally`. Tras interrumpir forzosamente una prueba, revisar únicamente `ta_test_fail_receipt`, `ta_test_wrong_card`, `ta_test_combat_inv`, `ta_test_combat_attack` y `ta_test_combat_lethal` de esta base antes de seguir. Los tres de combate solo inyectan errores para las copias concretas del fixture.

Resultados ejecutados el **03/11/2026**, con Node 24.16.0 y MariaDB **10.4.32-MariaDB** de XAMPP:

| Validación | Resultado |
|---|---|
| Instalación inicial y repetida en la base aislada | Correctas; 13 tablas / 65 columnas, 40 cartas exactas, cuenta limitada |
| `db:seed:check` y `catalog:check` | Correctos, estadísticas originales preservadas |
| `test:sql` | **25/25**, cero omitidas: los 12 casos previos y 13 de combate: invocación válida/energía/campo/propiedad/repetición; preparación, ataque usado y objetivos; 3/2 contra 2/3 con doble muerte; daño persistente/defensa; concurrencia de invocación y ataque; replay; fallo entre padre/hijo aun haciendo COMMIT tras error; rollback de daño y de golpe letal; SQL directo con snapshot RR anterior; victoria legal y en turno 30; reinicio con combate, historial/resultado y permisos |
| `test:e2e:sql` | **4/4**, navegador con API y MariaDB reales: los dos recorridos previos de persistencia y dos de combate. Partida completa desde el tablero hasta VIDA_CERO, daño a cartas/héroe, descartes, historial y recuperación; respuestas perdidas tras COMMIT con UUID/payload preservados al recargar para invocación/ataque/inicio/cierre |
| `check` | Build TypeScript/Vite, **14/14 backend en memoria + 5/5 frontend**, smoke del build y **8/8 E2E memoria** aprobados |
| Conservación del corte de combate | SHA-256 de **31 archivos** originales de documentación/catálogo/repositorio demo/esquema sin cambios; metadatos confirman 13 tablas/65 columnas |

El combate reutiliza mutex de Partida, control de versión, receipts y snapshots existentes; los conteos decisivos usan lecturas actuales aun si un cliente SQL abrió un snapshot RR anterior. La resta de vida usa variables con signo para evitar underflow de columnas UNSIGNED antes de limitar a cero. Un fallo tras marcar letal también restaura héroe/ganador/fecha de fin/turno/eventos/versión. La UI generaliza los reintentos pendientes a las tres acciones y vuelve a ocultar manos si un replay devuelve un turno más avanzado. Se ajustaron los errores de copia ajena a 403 y de partida inexistente a 404. No se detectó incompatibilidad que exigiera alterar el esquema.

Capturas revisadas: [tablero SQL] (artefacto local no versionado), [combate y victoria] (artefacto local no versionado). `test:e2e:sql` utiliza 4100/5273 para no interferir con 4000/5173. Los fallos de red son deliberados: SQL confirma y después se pierde la respuesta; reintentar recupera el resultado sin otra partida, robo, invocación ni daño.

Archivos principales del corte: `database/mariadb/04-combat.sql` (nuevo), `scripts/db-install.mjs`, `backend/src/repositories/mariadb-repository.ts`, `backend/src/validation.ts`, `shared/contracts.ts`, `frontend/src/pages/Battlefield.tsx` y textos de App/Home/PersistentGames, CSS, `backend/test/sql-combat.test.ts` (nuevo), ajuste de la expectativa 501 anterior en `sql-integration.test.ts`, `tests/sql-e2e/combat.spec.ts` (nuevo) y comando `test:sql` en `package.json`. El esquema, las rutinas anteriores, el seed, el simulador y los documentos académicos permanecen intactos.

El siguiente paso académico sigue siendo la revisión humana de B1–B4 y del MER/MR. El motor completo de esta entrega está implementado y probado localmente; no constituye aprobación del Hito 3, autenticación remota ni despliegue.

## Reinicio desde Jugar

Instalación existente: `npm run db:update:restart` aplica `database/mariadb/10-restart-game.sql` solamente a `truco_arena_dev`. La instalación completa también incluye esta migración y el permiso EXECUTE para `ta_reiniciar_partida`. No se cierran partidas al instalar.

`POST /api/duels` admite `replaceActive: true` únicamente después de la confirmación de la UI. El backend incluye ese indicador en la huella de la solicitud; mantiene el UUID al reintentar. La rutina bloquea los perfiles seleccionados, cierra sus partidas abiertas con motivo `REINICIO` y ganador nulo, cierra los turnos abiertos y llama al inicio existente dentro de la misma transacción. Un savepoint restaura todo si falla la creación, incluso cuando un cliente SQL intenta COMMIT después del error. Los recibos se consultan con lectura bloqueante antes de modificar las partidas: un replay no cierra la partida nueva. Las sesiones SQL directas deben usar UTC, igual que la capa de conexión de Express.

Los mazos, copias, vida, energía e historial de jugadas de la partida anterior se conservan. La UI y la bitácora distinguen este cierre administrativo de victoria o empate. No se agregan tablas y B1–B4 continúan pendientes. Pruebas: `tests/sql-e2e/restart.spec.ts` y la prueba de reinicio directo de `backend/test/sql-integration.test.ts`.
