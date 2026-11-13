# Fase 6 — Plazos online, inactividad y abandono

> Archivo histórico de desarrollo. Para el estado vigente ver [arquitectura](../../arquitectura.md) y [despliegue](../../despliegue.md). Los JSON/capturas QA mencionados se consolidaron en el [historial de validaciones](../../historial-validaciones.md); las afirmaciones de esta fase conservan su fecha y alcance.

Implementación provisional sobre **TrucoOnline `gjcpcbrkdjymrwktshfr`**. Conserva los acuerdos académicos B1–B4 pendientes. Complementa las fases anteriores; no reemplaza MER, MR ni reglamento.

## Impacto y recuperación antes de aplicar

- Migración local `20261111202129_arena_online_deadlines.sql`: ninguna tabla o columna nueva. Conserva 16 tablas, 28 FK y las 40 cartas. Cambia el default de `turno.fecha_apertura` a reloj real UTC y añade un índice parcial de turnos abiertos. Sustituye `ta_actuar` únicamente para validar el plazo ONLINE y usar el reloj real; conserva combate, límites, versiones y recibos. Añade funciones privadas y un rol NOLOGIN sin acceso directo a tablas.
- `20261111202132_arena_deadline_cron.sql`: habilita la extensión administrada pg_cron y programa dos tareas propias. No cambia datos de catálogo ni elimina historial. No vuelve a ejecutar migraciones anteriores.
- Los turnos ONLINE que ya estaban abiertos antes de activar Cron se evalúan por su fecha original: si vencieron, se cierran. El siguiente turno recibe 15 segundos completos desde su apertura efectiva. No se fabrican turnos retroactivos durante una caída. Las partidas PC quedan excluidas.
- Aplicar primero el motor probado en PostgreSQL aislado, después Cron; comprobar ejecuciones y ACL. Ante un problema, desactivar **solo** `truco-arena-online-deadlines` mediante `cron.alter_job(..., active := false)`; conservar tablas, recibos e historial. Corregir hacia delante con otra migración y reactivar. No deshabilitar la validación de plazos para aceptar acciones tardías. Las operaciones ya confirmadas no se revierten borrando datos.

## Autoridad, integridad e interfaz

La apertura se almacena en UTC (columna histórica sin zona) y se interpreta explícitamente como UTC. `ta_online_now()` utiliza `clock_timestamp()`, no el inicio de la transacción ni un valor enviado por el navegador. No contiene un override de reloj en producción. El vencimiento es apertura + 15 segundos; invocar o atacar no lo renueva. Las acciones verifican versión, turno, participante y plazo después del bloqueo de partida. Los reintentos confirmados recuperan su recibo incluso después del vencimiento.

`ta_online_streak` deriva el conteo de turnos propios y sus jugadas: una jugada válida lo reinicia inmediatamente; un cierre manual lo corta; un timeout con jugadas no cuenta. Al tercer timeout propio consecutivo sin jugadas, `INACTIVIDAD` concede la victoria al rival. Si coincide con el turno 30, prevalece esta derrota; sin ella se conserva la comparación de vida y empate del límite.

`ta_online_expire` comparte el mutex de partida con las jugadas y el abandono. Cierre, siguiente turno/robo/energía o resultado, versión, recibo y cierre de sala forman una transacción. El recibo EXPIRAR_TURNO usa una UUID aleatoria: la identidad idempotente efectiva es la partida + turno cerrado bajo bloqueo, evitando que un cliente reserve una clave predecible. Un error revierte ese cierre completo y se reintenta en el siguiente ciclo.

`ta_online_abandon` permite abandonar fuera de turno, valida la identidad derivada de Auth y conserva versión/idempotencia. Cierra el turno como FIN_PARTIDA, termina con ABANDONO y gana el otro participante sin alterar artificialmente sus vidas. No equivale a cerrar la pestaña. Las escrituras pasan por `public.ta_web` → `ta_web_timed` privado; el backend expone `POST /api/duels/:id/abandon`. Una solicitud incierta se reintenta con la misma UUID.

`ta_online_meta` añade un plazo absoluto, hora del servidor, último cierre y conteos públicos a la vista ya autorizada. No añade manos ocultas. React ancla el tiempo a `performance.now()` con corrección aproximada de medio RTT. La hora del equipo no autoriza acciones. A cero bloquea nuevas jugadas mientras espera el estado confirmado. El polling existente sincroniza turnos/resultados y la recarga conserva el plazo SQL.

## Scheduler y permisos

`truco-arena-online-deadlines` se ejecuta **cada segundo**, dentro de PostgreSQL, con `SET LOCAL ROLE ta_timer_runner`. Este rol NOLOGIN/NOBYPASSRLS puede ejecutar únicamente `ta_online_tick`, sin DML/SELECT de tablas ni acceso concedido a navegador/CPU. El tick toma hasta 100 partidas vencidas con `FOR UPDATE SKIP LOCKED`; cada partida tiene un bloque atómico independiente. Fallos por partida generan WARNING con SQLSTATE, sin secretos. Fallos de sentencia completa revierten el tick.

En condiciones normales el retraso de planificación esperado es de **0 a 1 segundo**, más duración de la consulta; ambos tableros suman el polling (~1,5 s) y la latencia. No es una garantía de tiempo real durante bloqueos, saturación o indisponibilidad de PostgreSQL. Las acciones tardías se rechazan aunque Cron todavía no haya cerrado el turno. Tras recuperar el servicio, los vencimientos pendientes se retoman sin depender de Node ni de pestañas.

`truco-arena-deadline-log-retention` borra cada hora únicamente registros técnicos del job de vencimientos terminados hace más de seis horas. No borra movimientos del juego ni logs de otros jobs. Verificar `cron.job_run_details` y los avisos SQL para operación. El scheduler no necesita claves administrativas en React ni un proceso persistente en Vercel. La CPU conserva su worker Node de la fase 4.

Referencias verificadas: [Supabase Cron](https://supabase.com/docs/guides/cron), [instalación](https://supabase.com/docs/guides/cron/install), [pg_cron](https://github.com/citusdata/pg_cron) (intervalos en segundos y ejecución única por job).

## Validación y aplicación

Aplicado y verificado el 11/11/2026, exclusivamente en TrucoOnline:

| Archivo local (creado por CLI) | Versión registrada por MCP remoto |
|---|---|
| `20261111202129_arena_online_deadlines.sql` | `20261111203315_arena_online_deadlines` |
| `20261111202132_arena_deadline_cron.sql` | `20261111203323_arena_deadline_cron` |

Son dos cambios, no cuatro migraciones. No usar `db reset`, `db push` ni volver a aplicar el historial local incompleto contra este proyecto. Cron 1.6.4 se instaló correctamente; los dos jobs quedaron activos. Se observaron 414 ejecuciones exitosas consecutivas del tick en la consulta de evidencia, sin ejecuciones fallidas. El esquema de juego conserva 16 tablas con RLS, 28 FK y 40 cartas.

| Verificación ejecutada | Resultado |
|---|---|
| `npm run test:deadlines` | **14 grupos** en PostgreSQL 17.6 real aislado: 14.999/15.000 s, plazo fijo, acción esperando bloqueo, dos workers, competencia con acciones/fin/abandono, rachas, reinicio, límite 30/empate, roles, rollback inyectado y lectura concurrente consistente. Una caída simulada de una hora cierra el pendiente y abre un turno fresco; no produce derrotas retroactivas. El reloj controlado existe solo como sustitución de función dentro del clúster aislado. |
| `npm run test:postgres:current` | **14 grupos del motor**, suite de perfiles/Auth, **7 CPU** y **7 salas** aprobados sobre todas las migraciones actuales del juego. |
| `node --env-file=backend/.env.supabase --import tsx tests/postgres/web-deadlines.mjs` | **7 grupos reales**: dos sesiones Auth, reloj del cliente desfasado, recargas, timeout real, inactividad sin navegadores/BFF, reinicio real Node, acción sin renovar plazo, abandono con cancelación/confirmación fuera de turno, cierre de sala/historial, PC automático sin timer, privacidad y consola. |
| `node --env-file=backend/.env.supabase tests/postgres/web-deadline-layout.mjs` | **4 tamaños**: 1440×900, 1280×720, 390×844 y 844×390. Contador ≥20 px, resaltado de últimos cinco segundos, acciones dentro del viewport, sin desborde horizontal ni solapamiento de perfiles largos. En horizontal bajo, la mano pasa a una zona lateral sin invadir indicadores y cartas/campo conservan ≥40 px. El tablero final mantiene su altura al cerrar el resultado. Capturas inspeccionadas. |
| `node --env-file=backend/.env.supabase --import tsx tests/postgres/web-online.mjs` | **8 grupos de regresión reales**: combate/animaciones, espera/unión, privacidad, reinicio Node, presencia/reconexión, recuperación, victoria por daño, empate 30, carreras de invitados y aislamiento. |
| `node --env-file=backend/.env.supabase tests/postgres/web-online-sync.mjs` | **5 grupos** reales: respuesta antigua retenida, concurrencia HTTP 200/409, convergencia, límite SQL 429, identidad falsificada ignorada y sala móvil/portapapeles. |
| `node --env-file=backend/.env.supabase --import tsx tests/postgres/web-auth.mjs` | **4 grupos** reales de alta, sesión, recuperación/rotación, aislamiento, mazos, motor e historial. |
| `node --env-file=backend/.env.supabase tests/postgres/web-security.mjs` | Refresh concurrente real, cookie falsificada, CSRF, RPC anónimo, IDs ajenos y límites de recuperación rechazados. |
| `node --env-file=backend/.env.supabase tests/postgres/web-local-origin.mjs` | Alta/recarga en localhost, recuperación en 127.0.0.1 y rechazo de Origin externo. |
| `npm test` | **41 pruebas**: 18 backend y 23 frontend. Incluye contador monotónico/RTT/recarga y sprites v3 originales. |
| `npx playwright test --config tmp/playwright.draw.config.ts tests/e2e/computer.spec.ts tests/e2e/deck-tools.spec.ts tests/e2e/arena-viewport.spec.ts` | **8 E2E memoria** aprobados: PC, arrastre móvil, mazos, viewport y resultado/fuegos artificiales. Configuración local aislada en puertos 5473/4300; `tmp` no se versiona. |
| `npm run build`, `npm run test:build`, `git diff --check` | Compilación TypeScript/Vite, smoke y formato aprobados; catálogo sin cambios. |

Evidencia remota principal: partida QA **17**, sala **9**, creada con dos perfiles aislados. El primer cierre fue a los **15,480 s**. Se cerraron ambos navegadores y el BFF de prueba a las **20:35:25.845 UTC**; al reiniciar a las **20:36:43.400 UTC**, SQL devolvió `INACTIVIDAD`, turno 5, versión 6, ganador posición 2. Los cinco turnos duraron **15,221–15,480 s**, con cinco recibos EXPIRAR_TURNO y exactamente 24 copias. La partida **19** confirmó una invocación seguida de timeout sin sumar inactividad y abandono del anfitrión durante el turno del invitado. Vidas y cartas se conservaron.

Las sesiones/cookies de reconexión estuvieron únicamente en memoria del proceso de prueba; los archivos de evidencia no incluyen códigos de recuperación, cookies, tokens ni claves. Los perfiles/partidas QA permanecen como historial aislado, sin borrar datos existentes. [Evidencia compacta](../../historial-validaciones.md). Artefactos completos locales: `artifacts/postgres/deadline-results.json`, `artifacts/deadlines/`, `artifacts/online/` y `artifacts/profiles/web-results.json` (ignorados por Git).

Se corrigieron dos supuestos de pruebas anteriores y se ejecutaron otra vez: un cierre de fixture usaba hora local en vez de UTC, y una recuperación exigía que energía/mano permanecieran congeladas durante una desconexión. Ahora se comprueban conservación de copias/campo/descarte, privacidad y versión creciente mientras los vencimientos continúan. No se deshabilitó Cron para hacer pasar regresiones. Una prueba adicional con dos conexiones y barrera entre estado/metadata confirmó que el bloqueo FOR SHARE ya existente en `ta_estado_privado` conserva una respuesta consistente frente a vencimientos concurrentes. Se descartó una migración redundante que aún no había sido aplicada.

## Archivos e interfaz operativa

- SQL: las dos migraciones anteriores. Funciones nuevas `ta_online_now`, `ta_online_streak`, `ta_online_expire`, `ta_online_tick`, `ta_online_abandon`, `ta_online_meta`, `ta_web_timed`; modificadas `ta_actuar` y gateway invocador `public.ta_web`.
- Backend: `backend/src/supabase-app.ts` (ruta segura de abandono, códigos HTTP y DTO con metadata del plazo). Sin cambios de políticas CPU ni un segundo motor JavaScript.
- Frontend: `onlineClock.ts`, `components/OnlineTurnTimer.tsx`, `components/onlineTimer.css`, `pages/Battlefield.tsx`, `components/Confirmation.tsx`, `components/GameHelpDialog.tsx`, `SupabaseWebApp.tsx`, `api.ts`; contrato `shared/contracts.ts`. Tipografía del contador y truncado de alias largos corregidos después de inspeccionar capturas.
- Tests: `tests/postgres/deadlines.mjs`, `web-deadlines.mjs`, `web-deadline-layout.mjs`, carga de esquema actual y adaptación de regresiones; `frontend/test/online-clock.test.tsx`. `package.json` añade `test:deadlines` y amplía las regresiones actuales. `.gitignore` permite versionar el nuevo test y bitácora, sin secretos.

Para ejecutar la web existente: `npm run dev:supabase`, abrir `http://127.0.0.1:5173/#/jugar`, elegir Multijugador, crear/unirse a sala desde dos perfiles. No volver a instalar SQL. Se conservan las variables documentadas en fase 3 y 4; esta fase no añade secretos ni variables. Cron continúa aun si este comando no está activo; para abrir la web o usar CPU sí se requiere el backend de la aplicación.

## Límites y observaciones abiertas

- Sin prueba de carga de cientos/miles de partidas ni garantía de cierre instantáneo durante una caída de PostgreSQL. Lote de 100, timeout SQL de 5 s y reintentos documentados; observar saturación, backlog y logs. El indicador puede diferir una fracción de segundo entre redes; la decisión SQL es única.
- Advisors posteriores: sin nuevos errores de seguridad. Dos WARN corresponden a las políticas administradas de `cron.job` y `cron.job_run_details`, dirigidas a PUBLIC pero filtradas por `username = current_user`. Se verificó que **anon y authenticated no tienen USAGE del esquema cron**, que no está expuesto por esta aplicación y que no se concedió acceso desde React. No se alteraron políticas administradas de la extensión. [Referencia del aviso](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).
- Permanece el aviso de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), sin flujo de contraseña en esta app. Performance informa diez FK sin índice específico y dos índices aún no usados por el pequeño volumen actual; [revisar ante carga real](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). No se borraron índices ni se amplió el modelo para silenciar avisos.
- La retención horaria quedó programada y se verificó su comando/alcance; no se esperaron seis horas para probar envejecimiento real de logs. La independencia online está comprobada; el alojamiento futuro del worker CPU y Vercel continúan fuera de esta fase.
- Sin commits, despliegues ni aprobaciones humanas del MER/MR/B1–B4.
