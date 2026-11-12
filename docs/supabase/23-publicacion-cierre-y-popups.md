# Publicación del cierre CPU y avisos popup

12/11/2026. El titular autorizó subir los cambios previamente mantenidos en local. Destinos verificados: repositorio `ImaMartinez/Truco-online`, rama `master`; Supabase `gjcpcbrkdjymrwktshfr`; Railway proyecto `0ceb2799-958c-4881-965a-5266897c51ca`, entorno preview, único servicio `truco-arena-api`; Vercel `prj_0pXPak6IHEJwrXAe4NP8VeodVD4r`, equipo `ima-7bec`. No se crea infraestructura adicional ni se modifican planes/secretos.

## Impacto y recuperación, antes de aplicar

Se aplica solamente `20261112220307_arena_close_cpu_and_switch_online.sql`, mediante la operación de migración transaccional de Supabase. No se ejecutan el instalador completo, migraciones anteriores, db push/reset ni DML de usuarios. La consulta previa confirmó 16 tablas con RLS, 28 FK, 40 cartas y dos jobs Cron activos. Hay partidas existentes que se conservan.

La comparación exacta de los cuerpos remotos de `ta_rooms_interno` y `ta_web_timed` con sus fuentes de las fases 5/6 no encontró diferencias. Sus definiciones anteriores quedaron respaldadas en `tmp/release-prior-functions.json`, fuera de Git. Las tres funciones nuevas aún no existen. La migración añade esos helpers privados y actualiza los dos cuerpos existentes, sin cambiar tablas, catálogo, políticas de dificultad o reglas de combate. Se probaron previamente cierre, propiedad, concurrencia y rollback en PostgreSQL aislado.

Si el DDL falla, la transacción se revierte. Si hay un fallo funcional después, restaurar los dos cuerpos anteriores conservando las funciones nuevas privadas y todos los resultados confirmados. No borrar partidas/historial. El frontend anterior es `dpl_2SHt5V5Q6ULuZNmBg8ASLJ4e5z4d`; Railway anterior `6f062181-3934-4aed-aa99-073c5d6297e3`. La ampliación SQL es compatible con clientes anteriores.

Orden: pruebas y auditoría de secretos; commit/archivo Git limpio; migración única; backend Railway compilado en el servicio existente; frontend Vercel Production con `--skip-domain`; QA con perfiles nuevos y posterior promoción del mismo build. La lista de orígenes sigue exacta y la clave de sesión se mantiene. El canario protegido se prueba con un adaptador de Origin exclusivo del arnés; Production debe probarse con su Origin nativo.

El complemento Vercel no encuentra el proyecto en el contexto conectado; la CLI autenticada verificó ID, nombre, framework Vite y ausencia de integración Git. Se utiliza esa vía sin sustituir el destino. Railway confirma una réplica sana, sin configuración pendiente; su complemento no ofrece carga de fuentes locales a un servicio existente, por lo que la carga usa la CLI autenticada con IDs explícitos.

El instalador SQL para compañeros se actualiza con la nueva migración y se vuelve a verificar desde cero. Ese archivo sigue destinado exclusivamente a una base nueva, nunca a la actualización del proyecto publicado. El MER y sus fuentes se versionan como documentación conceptual, con sus omisiones explicadas.

## Resultado verificado

Publicado en https://truco-online-beta.vercel.app desde el commit de aplicación `c1974328c0d3495e97e270dce22ed84438ff419f`. GitHub recibió ese commit y el instalador/MER del commit `de0f660`, mediante push normal a `master`. El commit posterior de evidencia solo modifica documentación.

- Supabase registró la única migración nueva como `20261112225134_arena_close_cpu_and_switch_online`; corresponde al archivo local `20261112220307_arena_close_cpu_and_switch_online.sql`. No se repitieron migraciones previas. Se conservaron 16 tablas con RLS, 28 FK, 40 cartas y dos jobs Cron activos. Los tres helpers nuevos no conceden EXECUTE a anon ni authenticated; siguen bajo `ta_engine_owner` y se utilizan mediante los gateways privados validados.
- Railway: deployment `696f040b-01c3-4ad1-bd11-ac9b5372f278`, SUCCESS, una réplica online, sin trabajo pendiente ni errores en los logs consultados. Health confirma PostgreSQL conectado y worker CPU ready, sin fallos consecutivos. No se cambiaron variables, clave de sesión, plan ni configuración de infraestructura.
- Vercel: deployment `dpl_5pXVHSWb11LxvC7azCEL691HAsX8`, READY. Se probaron seis grupos reales en el canario protegido y se promovió exactamente ese build, sin reconstruir. Otros seis grupos pasaron en el dominio público con Origin nativo y sin bypass. Los bytes JS/CSS públicos coinciden con el build local. No quedaron accesos temporales de automatización.

Pruebas previas a la publicación: 47 unitarias, 41 E2E completos, build, smoke compilado y dos verificaciones de configuración. PostgreSQL aislado: 12 grupos de cierre/sustitución; regresiones del motor (14), perfiles, CPU (7), salas (7) y plazos (14); instalador autocontenido actualizado (14 grupos). No se presentan los fixtures locales como pruebas del servicio remoto.

Pruebas públicas reales mediante `tests/deployment/lifecycle-public.mjs`: perfiles nuevos, cookies Secure/HttpOnly/SameSite Lax, restauración de sesión, colecciones y mazos privados; CPU desde Railway; popup de energía con geometría estable; cancelar/confirmar cierre y reintento sin duplicación; crear sala cerrando exactamente la CPU consentida; join inválido que conserva CPU; join válido con cierre y sincronización Chrome/Edge; privacidad y rechazo del tercero; metadata de 15 s; abandono online e historial de ambos. El canario usó perfiles QA 168–170 y partidas 102–105; Production usó QA 174–176 y partidas 106–109. El arnés conserva esos registros y cierra sus partidas/salas remanentes; no modifica datos de jugadores existentes.

Se inspeccionaron capturas desktop 1366×768 y mobile 390×844 de ambas ejecuciones: popup de error y confirmación de cambio de modalidad. Archivos locales en `artifacts/deployment/lifecycle-canary/` y `artifacts/deployment/lifecycle-production/`, sin secretos. La evidencia estructurada pública se conserva en `24-evidencia-publicacion-cierre.json`.

## Límites y avisos

Esta publicación no repite todos los ensayos históricos de tres dificultades, recuperación por código e inactividad triple; conserva las regresiones aisladas y añade el recorrido público específico de estos cambios. No se hizo una nueva prueba de carga ni estimación de costos; se mantiene la infraestructura existente.

El advisor de Supabase conserva tres avisos administrados: políticas de lectura de `cron.job` y `cron.job_run_details` para roles anónimos, y protección de contraseñas filtradas deshabilitada. La comprobación adicional confirma que anon/authenticated carecen de USAGE en el esquema cron y de UPDATE sobre sus jobs; esta migración no modifica esos objetos. La aplicación usa Auth anónimo sin contraseñas. No se relajaron permisos para desplegar. Referencias: [advisor de acceso anónimo](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Estado: versión publicada y recorrido específico aprobado. Los acuerdos académicos B1–B4 continúan pendientes; no se inventan aprobaciones humanas ni se modifica el reglamento.
