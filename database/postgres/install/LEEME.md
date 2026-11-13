# TrucoOnline — instalación completa de la base de datos

Entrega del 12/11/2026. El archivo `TrucoOnline-completo.sql` reúne la estructura inicial, las ampliaciones y las rutinas vigentes. Puede abrirse con pgAdmin o ejecutarse con psql; no necesita los demás SQL para instalarse.

Incluye 16 tablas de juego, 28 relaciones FK, las 40 cartas originales, índices, CHECK, triggers, RLS, motor transaccional, perfiles/recuperación, mazos de 12/20 cartas, CPU, salas privadas, temporizador de 15 segundos e inactividad. No contiene jugadores, partidas, perfiles Auth, contraseñas, claves API ni datos del servidor publicado.

## Instalación en PostgreSQL local

1. Instalar PostgreSQL 17 o posterior y sus herramientas `psql`/`createdb` o pgAdmin. XAMPP/MariaDB no ejecuta este dialecto SQL.
2. Usar una instancia local de desarrollo sin otra instalación de TrucoOnline. Los roles son compartidos entre bases del mismo servidor: si ya existen roles `ta_*`, el instalador se detiene para no alterar sus permisos.
3. Abrir una terminal en la carpeta de este paquete. Si las herramientas no están en PATH, abrir SQL Shell (psql), o agregar la carpeta `bin` de PostgreSQL al PATH de esa terminal.
4. Crear la base y ejecutar el archivo completo como el administrador `postgres`. La contraseña se solicita interactivamente; cada compañero usa la de su instalación:

```powershell
createdb -h 127.0.0.1 -U postgres -E UTF8 truco_arena_local
psql -h 127.0.0.1 -U postgres -d truco_arena_local -v ON_ERROR_STOP=1 -f TrucoOnline-completo.sql
psql -h 127.0.0.1 -U postgres -d truco_arena_local -v ON_ERROR_STOP=1 -f Verificar-instalacion.sql
```

En pgAdmin: crear `truco_arena_local`, abrir Query Tool de esa base, cargar `TrucoOnline-completo.sql` y ejecutar **todo el archivo**. Después ejecutar `Verificar-instalacion.sql`. Se esperan 16 tablas con RLS, 28 FK y 40 cartas. `ta_cpu_node` debe estar sin login hasta configurarlo expresamente.

El instalador tiene una transacción global y rechaza una base que ya contiene `truco_arena_der`; no borra ni reemplaza nada. Si falla desde pgAdmin y la sesión queda en transacción abortada, ejecutar `ROLLBACK;`, corregir el requisito y volver a intentar en la base nueva. No cambiar las guardas para forzar una reinstalación.

## Qué significa «local» para la autenticación

PostgreSQL por sí solo no incluye Supabase Auth, PostgREST ni validación de JWT. En el modo predeterminado `postgres-local`, este archivo crea únicamente una tabla `auth.users(id)` y una función `auth.uid()` de compatibilidad para probar las relaciones y rutinas SQL con identidades controladas por un administrador. **No son un login real y no deben exponerse como servicio de autenticación.** No hay usuarios creados ni roles de navegador con LOGIN.

Las rutinas finales de la aplicación confían en claims establecidos por el servidor autenticador. No se debe permitir que un navegador se conecte a PostgreSQL ni que establezca esos claims por su cuenta. Para ejecutar la web con login real hace falta una instancia Supabase completa, además del backend Express/worker y el frontend.

## Instalación en una instancia Supabase nueva

El mismo SQL admite Supabase local completo o un proyecto de desarrollo **nuevo y vacío**. Cambiar únicamente la línea inicial:

```sql
SET LOCAL truco.install_target = 'supabase-new';
```

En ese modo usa las tablas/funciones Auth nativas y no crea ni sustituye el esquema `auth`. Ejecutar como `postgres`. Habilitar Anonymous sign-ins por separado en Auth; esa configuración no se instala mediante el SQL del juego. Mantener `truco_arena_der` fuera de los esquemas expuestos por Data API y conservar los permisos incluidos. No ejecutar este archivo sobre el proyecto del equipo `gjcpcbrkdjymrwktshfr`: allí ya está instalado.

El repositorio web actual valida explícitamente el proyecto del equipo en `backend/src/supabase-app.ts` y `backend/src/cpu/worker.ts`. Crear otra base no cambia ese destino. Conectar la aplicación a otra instancia requiere una adaptación de configuración revisada y sus pruebas; este paquete instala la base, no elimina esas validaciones ni configura servicios externos. Para desarrollar solo la interfaz con el repositorio, `npm ci` y `npm run dev` ofrecen el modo demo en memoria; no utilizan esta base.

## CPU y temporizador automático

El SQL instala las rutinas CPU y el rol limitado. La decisión de jugadas está en el worker Node del repositorio (`backend/src/cpu/policy.ts` y `worker.ts`): es necesario ejecutar ese proceso para que la computadora juegue automáticamente. No se introduce otro motor.

Se crea `ta_cpu_node` sin login ni contraseña. Solo al configurar un backend de desarrollo, su administrador puede habilitarlo y asignar una clave propia de forma interactiva en psql:

```sql
ALTER ROLE ta_cpu_node LOGIN;
```

```text
\password ta_cpu_node
```

Usar esa clave únicamente en el entorno privado del backend. El worker sigue conectándose con el rol limitado; no usar `postgres` como usuario de la aplicación. Este paso no es necesario para inspeccionar el modelo en pgAdmin.

El archivo incluye los dos jobs originales de Cron. Solo los instala cuando `pg_cron` está disponible, precargado y configurado para esta base (`cron.database_name`), o ya está instalado en ella. En PostgreSQL común sin esos requisitos emite `CRON_NO_DISPONIBLE` y termina correctamente la instalación del motor. En ese caso **no habrá vencimiento automático**: debe prepararse pg_cron o un scheduler de servidor que invoque `truco_arena_der.ta_online_tick()` cada segundo con el rol `ta_timer_runner`. No se debe dar ese permiso al navegador ni sustituirlo por un reloj del cliente. La preparación de extensiones/servicios del sistema no puede hacerse solo con este SQL.

## Verificación de la entrega

el historial consolidado de validaciones (docs/historial-validaciones.md) registra las pruebas reales de este archivo en una instancia PostgreSQL 17 aislada. Incluyen instalación vacía, rollback de toda la instalación, rechazo de reinstalación, catálogo intacto, perfiles SQL/recuperación, aislamiento, mazos 12/20, CPU en tres dificultades usando el worker original, salas, mano privada, invocación, idempotencia concurrente, vencimientos/inactividad, permisos y recuperación tras reiniciar PostgreSQL. No certifica un servicio Supabase Auth/JWT real ni pg_cron: este último no estaba disponible en el PostgreSQL aislado y se probaron los ticks manualmente.

En el repositorio original se puede regenerar y repetir:

```powershell
node scripts/build-postgres-install.mjs
node scripts/build-postgres-install.mjs --check
node --import tsx tests/postgres/install.mjs
```

`fuentes.json` identifica las secciones y sus huellas. Las tres fuentes iniciales se recuperaron del historial de migraciones mediante una consulta de solo lectura al proyecto autorizado; las nueve ampliaciones proceden de los archivos versionados e incluyen el cierre CPU/cambio a salas. El aprovisionamiento de credenciales CPU se reemplaza por el rol bloqueado, para no compartir secretos. No se modifica el historial de migraciones de otro servidor ni se marca ningún cambio remoto como aplicado.

Referencias: [PostgreSQL para Windows](https://www.postgresql.org/download/windows/), [psql](https://www.postgresql.org/docs/17/app-psql.html), [Supabase local](https://supabase.com/docs/guides/local-development/cli/getting-started), [Supabase Cron](https://supabase.com/docs/guides/cron).
