# Fase 5 — salas privadas y multijugador

Destino exclusivo: TrucoOnline `gjcpcbrkdjymrwktshfr`. Implementado y verificado el 11/11/2026 en PostgreSQL aislado y cinco sesiones/contextos reales. B1–B4 y los documentos académicos conservan su estado anterior.

## Impacto antes de aplicar

Migración nueva creada con CLI: `20261111164349_arena_online_rooms.sql`. No crea tablas ni cambia cartas, estadísticas o combate. Conserva 16 tablas y 28 FK. Reutiliza `sala`, sus estados y sus FK originales.

Cambios mínimos de columnas: `sala.clave_creacion uuid UNIQUE`, necesaria para reintentos durables de creación antes de existir una partida (solicitud_operacion requiere partida); `intento_recuperacion.sala_ventana` y `sala_intentos`, contadores independientes de unión/búsqueda por identidad Auth. Se reutiliza esa tabla técnica de protección de operaciones de perfil conservando su nombre legado y los campos de recuperación originales; evita una tabla nueva y evita depender de un límite Express que pueda saltarse llamando al RPC. Máximo 10 consultas/uniones por minuto. Los errores previstos se retornan desde un bloque SQL interno para persistir el intento y revertir completamente cualquier unión fallida.

Se extrae el cuerpo existente del inicio a `ta_iniciar_base` privado. La firma y permisos de `ta_iniciar_partida` se conservan como envoltorio PC; su hash/reparto/sorteo permanecen iguales. ONLINE fija anfitrión posición 1, invitado posición 2 y dificultad NULL. Esa excepción de inicio responde al pedido explícito de Fase 5; no altera combate/energía/robo/30 turnos. Se agrega modo a la huella ONLINE, sin invalidar recibos PC históricos.

Un índice único limita una sala ESPERANDO por anfitrión. El mazo queda reservado mientras espera y no ha expirado. Triggers impiden editarlo/borrarlo o iniciar CPU durante esa espera. El borrado de mazos referenciados por salas ahora archiva, preservando esas FK e historial incluso si nunca se inició la partida. Trigger de cierre de partida actualiza la sala a FINALIZADA atómicamente.

## Seguridad y concurrencia

RPC público `ta_rooms` SECURITY INVOKER, solo authenticated, delega en `ta_rooms_interno` privado con propietario NOLOGIN/NOBYPASSRLS y search_path fijo. Obtiene identidad del sub JWT verificado por PostgREST y jugador_auth; nunca del JSON del cliente. BFF sigue validando el token con getUser, cookie HttpOnly cifrada y Origin. No se conceden tablas, helpers, DML ni acceso a manos a authenticated/anon. Los helpers de salas y de inicio no están concedidos al worker CPU.

Código generado en PostgreSQL: ocho símbolos base32 de SHA256(gen_random_uuid), 40 bits, alfabeto sin I/O/0/1, formato XXXX-XXXX y UNIQUE global. Su unicidad global es más restrictiva que unicidad entre utilizables y evita reutilizar códigos históricos. No sustituye Auth. Expiración de espera: 15 minutos; no es temporizador de turnos. Se evalúa con reloj SQL al consultar/crear/unirse, sin cron ni pérdida de partida por desconexión.

Unión: clave UUID/advisory lock, jugadores ordenados por ID, sala bloqueada y releída, mazos bloqueados y validados, creación de partida/copias/turno y actualización de sala en una transacción. Dos invitados compiten por un solo lugar. Se rechaza propietario ajeno, anfitrión como invitado, formato distinto, sala cerrada/vencida, otro juego activo y otra sala propia en espera. Los reintentos conservan la misma partida; un UUID reutilizado con otros parámetros se rechaza.

## API y web

API: GET `/api/rooms`, GET `/api/rooms/:id`, POST `/api/rooms`, POST `/api/rooms/lookup`, POST `/api/rooms/join`, POST `/api/rooms/:id/cancel`. Estado/acciones e historial siguen en los endpoints existentes. Búsqueda por código devuelve solo alias/formato/expiración; estado de sala completo se restringe a anfitrión/invitado. No se crea partida incompleta durante la espera.

Jugar conserva Contra PC y habilita Multijugador → Crear sala / Unirse a partida. Sala de espera muestra alias, mazo, código copiable, conexión, puntos animados y cancelación confirmada. Recarga/recovery recuperan la sala por SQL. Los comandos pendientes conservan UUID en localStorage; nunca contiene credenciales Auth ni manos.

Ambos tableros consultan el BFF cada 1,5 segundos tras completar la consulta anterior, con cancelación al desmontar, timeout y reintento. Cada respuesta contiene únicamente mano propia; solo contador del rival y campos/descartes/eventos públicos. El cliente rechaza versiones anteriores y utiliza eventos confirmados para las animaciones existentes. No hay CPU ni otro motor en ONLINE. Código y estado de conexión aproximado se muestran dentro del tablero. Presencia se infiere de consultas autorizadas recientes en memoria del BFF; al reiniciarse es desconocida, no derrota. No es una prueba de desconexión ni se utiliza para adjudicar resultados.

## Recuperación operativa

Probar primero aislado y aplicar solo esta migración al remoto. Si falla DDL, rollback completo. Tras aplicar, si hay que retirar ONLINE: deshabilitar entradas de salas en BFF y su RPC, mantener los datos y el trigger de finalización; no borrar salas/partidas/cartas ni deshacer columnas o FK. El camino PC conserva su firma y puede continuar. Reemplazos posteriores deben ser incrementales y probados, no repetir migraciones ni ejecutar db reset/push con historial local incompleto.

Aplicación efectuada: archivo local `20261111164349_arena_online_rooms.sql` → registro remoto `20261111165448_arena_online_rooms`. No son migraciones distintas y no hay que repetirlas.

Arranque habitual, con las variables Supabase ya existentes: `npm run dev:supabase`. Web `http://127.0.0.1:5173/`; BFF `http://127.0.0.1:4200/api/health`. No requiere variables nuevas ni credenciales administrativas. En Jugar → Multijugador, el anfitrión crea con su mazo y comparte el código; otro perfil, en otro navegador/contexto, busca el código y elige un mazo del mismo tamaño. Las sesiones de un mismo perfil recuperado siguen siendo el mismo jugador y no pueden ocupar ambas posiciones.

## Validación

| Ejecución | Resultado real |
|---|---|
| `npm run test:online` | 7 grupos PostgreSQL real: espera sin partida, códigos/replays, reserva de mazo, acceso y formatos, dos invitados concurrentes, posiciones, 24/40 copias, acciones/combate, privacidad, empate 30 y cierre de sala, cancelación/expiración, límite persistente, salas aisladas, ACL y rollback completo tras unión. |
| `npm run test:postgres:current` | 14 grupos del motor + perfiles/Auth + 7 grupos CPU aprobados después de aplicar **todas las migraciones actuales**, incluido el nuevo inicio compartido. No se limita a probar el esquema histórico. |
| `tests/postgres/web-online.mjs` con Auth y BFF reales | 8 grupos, cinco contextos independientes: creación/unión por UI, código persistente tras recarga, errores/cancelación/expiración, privacidad, invocaciones y ataque a carta con animaciones en ambos tableros, reinicio real de Node, ambos dispositivos recargados, pérdida/restauración de conexión, recuperación del anfitrión en otra sesión, victoria/derrota y empate con ambos historiales, disputa por un lugar y salas paralelas. |
| `node --env-file=backend/.env.supabase tests/postgres/web-online-sync.mjs` | 5 grupos sobre localhost/Supabase: portapapeles real y sala mobile sin desborde, respuesta SQL/HTTP auténtica retenida y entregada tarde sin retroceder la versión, dos comandos sobre una versión (200/409), convergencia de tableros, límite de búsquedas HTTP (429), parámetro viewerPlayerId falsificado ignorado. |
| Regresión `web-auth.mjs` | 4 grupos E2E Auth/perfiles/mazos, recuperación y juego CPU real aprobados; actualiza la antigua expectativa de modalidad deshabilitada. |
| Regresión `web-security.mjs` | Cookie/refresh concurrente real, CSRF, sesión, IDs falsos, esquema privado y protección de recuperación aprobados. |
| `npm test`, `npm run build` | 36 pruebas locales aprobadas, TypeScript/Vite correctos y catálogo original de 40 intacto. |
| Playwright memory: computer, deck-tools, arena-viewport con `tmp/playwright.draw.config.ts` | 8 pruebas aprobadas: CPU, mazos, arrastre, mobile, arena y fuegos artificiales. |
| Auditoría remota de ACL/RLS | 16 tablas/28 FK/40 cartas; todas las tablas con RLS. anon sin RPC salas, authenticated sin SELECT sala ni helper de inicio, worker CPU sin gate de salas, propietario sin BYPASSRLS. |

Partida #11: victoria del anfitrión por VIDA_CERO, turno 13 (después del primer combate el invitado de prueba pasa deliberadamente). Partida #13: empate con ambos pasando hasta 30. Partida #12, creada en la prueba de dos invitados, conserva su estado independiente mientras termina #13. No se presentan esos escenarios controlados como partidas competitivas humanas.

La expiración remota se verificó desplazando exclusivamente fechas de una sala QA ESPERANDO (#2) mediante SQL administrador; no se esperaron 15 minutos ni se acortó la duración de salas reales. El flujo E2E conserva esa prueba opcional con `ONLINE_TEST_EXPIRY=manual`: emite el ID/sufijo en `tmp/online-expire-request.json` y espera confirmación en `tmp/online-expire-done.json`. Por defecto el script es automático y omite esa preparación administrativa; la expiración siempre está cubierta automáticamente por la suite aislada. La ejecución registrada aquí sí incluyó el fixture remoto.

Prueba web completa automática: `node --env-file=backend/.env.supabase --import tsx tests/postgres/web-online.mjs`. Usa puertos propios 5178/4220 y reinicia solo su BFF de prueba. No modifica la configuración del servidor habitual. `web-online-sync.mjs` utiliza la aplicación habitual 5173/4200. Ambas crean perfiles QA aislados; no borran datos existentes.

Evidencias sin sesiones, tokens ni secretos: `artifacts/postgres/online-results.json`, `artifacts/online/web-results.json`, `artifacts/online/sync-results.json` y resumen versionable `09-evidencia-online.json`. Capturas en `artifacts/online/`: sala-espera, sala-mobile, tablero-anfitrion, tablero-invitado, victoria y derrota.

## Archivos de esta fase

- SQL: `supabase/migrations/20261111164349_arena_online_rooms.sql`.
- Backend: `backend/src/supabase-app.ts` (rutas, mensajes, privacidad y presencia aproximada).
- Frontend: `pages/OnlineRooms.tsx` nuevo; `pages/PlayCpu.tsx`, `SupabaseWebApp.tsx`, `pages/Battlefield.tsx`, `remoteCpuAnimation.ts`, `combatAnimation.ts`, `components/GameHelpDialog.tsx` y `profile.css` adaptados. El archivo de animación conserva su nombre anterior, pero ahora admite CPU y adversario online confirmado.
- Contratos: `shared/contracts.ts` (sala, vista previa y metadatos públicos opcionales de partida).
- Tests: `online.mjs`, `online-http-server.mjs`, `web-online.mjs`, `web-online-sync.mjs`, `current-schema.mjs`, `current-suite.mjs` nuevos. Suites motor/perfiles/CPU aceptan el esquema actual para regresión. `web-auth.mjs` deja de esperar un botón «Próximamente».
- Scripts: `test:online` y `test:postgres:current` en package.json. Documentación: este registro, evidencia y `docs/bitacora-ia.md`. No se reescribieron documentos académicos ni fases anteriores.

## Límites y observaciones

La presencia es aproximada y local al proceso BFF: un navegador en segundo plano puede dejar de emitir consultas frecuentes; por eso el mensaje dice «sin señal reciente», no adjudica desconexión ni derrota. Una futura instalación con varios BFF deberá compartir presencia o utilizar un canal adecuado. El juego persistente y sus permisos no dependen de esa presencia. Se probó en contextos independientes de Chrome; no se afirma prueba en dos teléfonos físicos ni en un hosting publicado.

Se conserva la restricción UNIQUE original `(id_jugador,nombre)` de mazos: un nombre archivado continúa reservado; un nuevo mazo debe usar otro nombre. No se relajó el modelo para ocultar esa limitación. Los fixtures QA se conservan bajo perfiles propios, sin aparecer en la colección/mazos de otros usuarios.

Advisor de seguridad sin avisos nuevos; permanece el aviso previo de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), flujo no utilizado por Auth anónimo. Advisor de rendimiento informa 10 FK originales sin índice completo y 2 índices sin uso observado, sin error funcional; no se agregan índices especulativos a las tablas académicas en esta fase. Referencias: [FK sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [índice no utilizado](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Fuera de alcance: temporizador de 15 segundos, derrota por inactividad, salas públicas, despliegue y commits. No se declara ninguna aprobación humana.
