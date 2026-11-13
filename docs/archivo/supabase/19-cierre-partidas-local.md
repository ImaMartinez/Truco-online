# Cierre de partidas y cambio de CPU a online — solo local

> Archivo histórico de desarrollo. Para el estado vigente ver [arquitectura](../../arquitectura.md) y [despliegue](../../despliegue.md). Los JSON/capturas QA mencionados se consolidaron en el [historial de validaciones](../../historial-validaciones.md); las afirmaciones de esta fase conservan su fecha y alcance.

12/11/2026. Pedido del titular: poder cerrar una partida en curso desde Jugar/Historial y confirmar su cierre al crear una sala o unirse a online. **Cambios sin commit, push, despliegue ni aplicación SQL remota.** Las modificaciones y entregas locales anteriores se preservan.

## Comportamiento

- Jugar, Historial y el tablero persistente ofrecen `Cerrar partida` contra CPU y `Abandonar partida` online.
- Siempre se confirma. El cierre voluntario es `ABANDONO`: gana el rival/CPU, se conserva el historial y no se elimina ninguna partida, copia o jugada. Reiniciar CPU mantiene su operación y motivo anteriores.
- Crear o unirse consulta el historial actualizado antes de preguntar. Si hay CPU activa, el diálogo explica el abandono y ofrece `Cerrar y crear sala` / `Cerrar y unirme`. Cancelar no manda ningún comando de escritura.
- Se envía el ID exacto consentido en `replaceCpuGameId`; no existe un flag que cierre indiscriminadamente la última partida. Una partida online activa no se reemplaza mediante ese campo: debe abandonarse explícitamente.
- Cerrar CPU y confirmar la operación de sala ocurre dentro de la misma transacción del servidor. Si la sala está llena, venció, el mazo es inválido o falla el inicio, se conserva la partida CPU y se revierte su recibo de cierre.
- Un resultado de red incierto conserva el requestId y el consentimiento en el almacenamiento de reintentos, sin usarlo como autorización. La sesión verificada sigue determinando la identidad. El reintento no cierra otra partida nueva.

## Cambios y seguridad

Migración incremental nueva: `supabase/migrations/20261112220307_arena_close_cpu_and_switch_online.sql`, creada con `supabase migration new`. **Pendiente de aplicar**. No crea tablas, columnas, estadísticas ni reglas de combate.

Funciones privadas nuevas: `ta_cpu_abandon`, `ta_abandon_game`, `ta_replace_cpu_for_room`. La primera aplica versión, clave idempotente, identidad, modalidad y bloqueo de partida; la segunda conserva el abandono online existente y delega CPU; la tercera restringe la sustitución a una partida CPU propia y a su ID explícito. Los bloqueos advisory del recibo preceden al bloqueo de partida. Las operaciones de sala conservan su orden de bloqueo de jugadores y mazos.

Se reemplazan únicamente `ta_rooms_interno` para insertar dos llamadas al helper en sus bloques transaccionales existentes, y `ta_web_timed` para permitir abandono CPU y conservar sus metadatos. La limitación de intentos de unión sigue fuera del subbloque que revierte el cierre. Los gateways públicos mantienen sus firmas y permisos; no se concede EXECUTE público a los nuevos helpers ni DML de tablas al navegador. RLS y las 16 tablas/28 FK/40 cartas permanecen.

Express valida y transmite el ID consentido en create/join, sin confiar en IDs de identidad del cliente. No cambia cookies, Auth, CORS, CSRF, variables ni rol del worker. La UI reutiliza las confirmaciones accesibles existentes y separa los botones de cierre/continuación.

Archivos de producto: `backend/src/supabase-app.ts`; `frontend/src/duelLifecycle.ts`, `components/CloseDuelButton.tsx`, `SupabaseWebApp.tsx`, `pages/PlayCpu.tsx`, `pages/OnlineRooms.tsx`, `pages/Battlefield.tsx` y `styles.css`.

## Validación efectivamente realizada

- `npm test`: 47 pruebas aprobadas (24 backend, 23 frontend), incluyendo HTTP Express autenticado con Auth/RPC simulados para validar parámetros, origen, sesión y rechazo de suplantación.
- `node --import tsx tests/postgres/close-and-switch.mjs`: 12 grupos en PostgreSQL 17 aislado con la migración nueva; cierre, replay, versión, propiedad, rollback de create/join después del cierre, sustitución, dos invitados concurrentes, competencia con worker, privacidad y ACL.
- Regresiones del motor actual: 14 grupos; perfiles/recuperación; 7 grupos CPU; 7 salas; 14 temporizador/inactividad. Los cargadores de fixtures actuales comparten la lista de migraciones para incluir este cambio. La expectativa antigua que prohibía abandono CPU se actualizó a la nueva conducta solicitada; se mantiene la comprobación de que CPU no vence por reloj online.
- Playwright `playwright.arena.config.ts`: 38 pruebas aprobadas, cinco nuevas de flujo de cierre/cambio de modalidad, cancelación sin escritura, sala rechazada, reintento después de recarga, historial y tablero. Las otras 33 cubren regresiones de juego y responsive.
- Build TypeScript/Vite y smoke del compilado aprobados; catálogo y sprites originales verificados por las suites. Revisión React: hooks sin condiciones, estado derivado de props, diálogos con foco/cancelación y botones bloqueados ante operaciones pendientes.
- Capturas inspeccionadas: `artifacts/close-and-switch/mobile-confirm.png` y `history-desktop.png`. Pruebas UI con fixtures en localhost y SQL en clúster efímero; no se probó un nuevo login Auth real ni se modificó ningún perfil/partida del proyecto publicado.

Resultados específicos de SQL: `artifacts/close-and-switch/postgres.json`. Resumen versionable: `20-evidencia-cierre-local.json`.

## Para habilitarlo después

El modo `npm run dev:supabase` utiliza la base remota compartida. Como este pedido exige dejar los cambios locales, **esa base todavía no tiene las nuevas funciones**: mostrar la UI local no habilita por sí solo el cierre CPU o la sustitución atómica en ese entorno. Para comprobar ahora el motor nuevo sin tocarla, ejecutar las pruebas aisladas anteriores tras `npm ci`.

Cuando el equipo decida habilitarlo, revisar el estado remoto y aplicar **solo esta migración incremental**, transaccionalmente, antes de publicar backend/frontend. No ejecutar `db push/reset` con el historial local/remoto desalineado, ni el instalador completo de la entrega a compañeros sobre TrucoOnline. No se realizaron esos pasos en esta tarea.

Impacto futuro: tres funciones nuevas y dos funciones privadas actualizadas, sin eliminación de datos. Ante fallo de DDL, rollback de la transacción. Si hubiera que retirar la funcionalidad después de habilitarla, restaurar los cuerpos anteriores de los dos gateways privados y desplegar la UI previa; mantener partidas/resultados ya confirmados y helpers privados sin acceso público. No borrar historial ni restablecer permisos abiertos para revertir.
