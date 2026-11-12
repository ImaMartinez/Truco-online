# Publicación del cierre CPU y avisos popup

12/11/2026. El titular autorizó subir los cambios previamente mantenidos en local. Destinos verificados: repositorio `ImaMartinez/Truco-online`, rama `master`; Supabase `gjcpcbrkdjymrwktshfr`; Railway proyecto `0ceb2799-958c-4881-965a-5266897c51ca`, entorno preview, único servicio `truco-arena-api`; Vercel `prj_0pXPak6IHEJwrXAe4NP8VeodVD4r`, equipo `ima-7bec`. No se crea infraestructura adicional ni se modifican planes/secretos.

## Impacto y recuperación, antes de aplicar

Se aplica solamente `20261112220307_arena_close_cpu_and_switch_online.sql`, mediante la operación de migración transaccional de Supabase. No se ejecutan el instalador completo, migraciones anteriores, db push/reset ni DML de usuarios. La consulta previa confirmó 16 tablas con RLS, 28 FK, 40 cartas y dos jobs Cron activos. Hay partidas existentes que se conservan.

La comparación exacta de los cuerpos remotos de `ta_rooms_interno` y `ta_web_timed` con sus fuentes de las fases 5/6 no encontró diferencias. Sus definiciones anteriores quedaron respaldadas en `tmp/release-prior-functions.json`, fuera de Git. Las tres funciones nuevas aún no existen. La migración añade esos helpers privados y actualiza los dos cuerpos existentes, sin cambiar tablas, catálogo, políticas de dificultad o reglas de combate. Se probaron previamente cierre, propiedad, concurrencia y rollback en PostgreSQL aislado.

Si el DDL falla, la transacción se revierte. Si hay un fallo funcional después, restaurar los dos cuerpos anteriores conservando las funciones nuevas privadas y todos los resultados confirmados. No borrar partidas/historial. El frontend anterior es `dpl_2SHt5V5Q6ULuZNmBg8ASLJ4e5z4d`; Railway anterior `6f062181-3934-4aed-aa99-073c5d6297e3`. La ampliación SQL es compatible con clientes anteriores.

Orden: pruebas y auditoría de secretos; commit/archivo Git limpio; migración única; backend Railway compilado en el servicio existente; frontend Vercel Production con `--skip-domain`; QA con perfiles nuevos y posterior promoción del mismo build. La lista de orígenes sigue exacta y la clave de sesión se mantiene. El canario protegido se prueba con un adaptador de Origin exclusivo del arnés; Production debe probarse con su Origin nativo.

El complemento Vercel no encuentra el proyecto en el contexto conectado; la CLI autenticada verificó ID, nombre, framework Vite y ausencia de integración Git. Se utiliza esa vía sin sustituir el destino. Railway confirma una réplica sana, sin configuración pendiente; su complemento no ofrece carga de fuentes locales a un servicio existente, por lo que la carga usa la CLI autenticada con IDs explícitos.

El instalador SQL para compañeros se actualiza con la nueva migración y se vuelve a verificar desde cero. Ese archivo sigue destinado exclusivamente a una base nueva, nunca a la actualización del proyecto publicado. El MER y sus fuentes se versionan como documentación conceptual, con sus omisiones explicadas.

Resultado de publicación y evidencia pública: pendientes al preparar este registro; completar con los IDs y verificaciones efectivamente obtenidos.
