# Instalar y ejecutar Truco Arena en local con XAMPP

Guía para Windows y PowerShell. Actualizada el **13/11/2026**. Permite descargar el repositorio, preparar MariaDB y ejecutar frontend/backend sin cuentas ni credenciales cloud.

## 1. Qué vas a ejecutar

| Componente | Función | Dirección predeterminada |
|---|---|---|
| React + Vite | Pantallas del juego | http://127.0.0.1:5173 |
| Node + Express | API y acceso al motor SQL | http://127.0.0.1:4000/api/health |
| MariaDB de XAMPP | Persistencia local | `127.0.0.1:3306`, base `truco_arena_dev` |
| Apache + phpMyAdmin | Inspección visual de la base | http://localhost/phpmyadmin |

El navegador consulta `/api/...` a Vite; Vite reenvía a Express y Express se conecta a MariaDB con una cuenta limitada. **No copiar el proyecto a `htdocs`**: Apache no ejecuta React ni Express; solo hace falta para phpMyAdmin.

**Importante sobre el SQL entregado anteriormente:**

- Para **ejecutar la app**, seguir esta guía: `npm run db:install` crea `truco_arena_dev`, su cuenta y configuración del backend.
- `TrucoOnline-XAMPP.sql` crea **`truco_online_xampp` para inspección de la base**. No configura el backend. No es necesario importarlo antes de esta instalación; si ya lo importaste, podés conservarlo aparte. El backend local exige `truco_arena_dev`.
- `TrucoOnline-completo.sql` es para **PostgreSQL**, no se importa en MariaDB/phpMyAdmin.

## 2. Instalar los requisitos

1. Instalar [Git para Windows](https://git-scm.com/install/windows), habilitado para su uso desde la terminal.
2. Instalar [Node.js](https://nodejs.org/en/download) **24.x desde 24.16.0 y menor que 25**. Elegir esa línea aunque la página ofrezca otra versión principal por defecto. npm viene incluido; el rango procede del `package.json` del proyecto.
3. Instalar [XAMPP para Windows](https://www.apachefriends.org/download.html), con MySQL/MariaDB, Apache y phpMyAdmin. El entorno verificado es **MariaDB 10.4.32**; otras versiones posteriores no se certifican en esta guía.
4. Tener Chrome o Edge. VS Code es opcional.

El paquete utilizado para la verificación fue **XAMPP 8.2.12**, que incluye MariaDB 10.4.32. Su [archivo oficial de versiones](https://sourceforge.net/projects/xampp/files/XAMPP%20Windows/8.2.12/) permite reproducir ese entorno local; no se necesita reinstalarlo si ya se dispone de esa versión. El número de PHP del paquete no es la versión de MariaDB y la aplicación no utiliza PHP como backend.

Después de instalar Git y Node, cerrar y volver a abrir PowerShell. Comprobar:

```powershell
git --version
node --version
npm --version
```

Los tres deben devolver una versión. Node debe indicar `v24.16.0` o una versión 24.x posterior. Esta guía se verificó con Node **24.16.0** y npm **11.13.0**.

Si PowerShell bloquea `npm.ps1`, usar **`npm.cmd` en lugar de `npm`** en los comandos siguientes. No es necesario cambiar globalmente la política de ejecución de Windows.

## 3. Descargar el repositorio

Abrir PowerShell en una carpeta de trabajo propia, por ejemplo `C:\proyectos`, y ejecutar:

```powershell
git clone https://github.com/ImaMartinez/Truco-online.git
cd Truco-online
```

Si GitHub solicita autenticación, usar una cuenta con acceso al repositorio. `Repository not found` puede significar falta de acceso; pedirlo al titular, sin compartir contraseñas ni tokens.

Alternativa: abrir [el repositorio](https://github.com/ImaMartinez/Truco-online), elegir **Code → Download ZIP**, extraerlo y abrir PowerShell dentro de la carpeta extraída. Descargarlo completo: se necesitan `frontend/`, `backend/`, `shared/`, `database/` y `scripts/`. Con ZIP, las próximas actualizaciones también deberán descargarse manualmente.

Todos los comandos de esta guía se ejecutan **desde la raíz**, donde están `package.json` y `package-lock.json`, salvo que se indique otra cosa. Comprobar:

```powershell
Get-Location
Test-Path package.json
```

El segundo comando debe devolver `True`. Para entrar a una ruta con espacios, usar comillas: `cd "C:\mi carpeta\Truco-online"`.

## 4. Instalar dependencias del proyecto

Desde la raíz:

```powershell
npm ci
```

Esperar a que termine sin errores. Requiere internet y prepara **frontend y backend** mediante los workspaces. No ejecutar otro npm install por separado dentro de cada carpeta.

`npm ci` respeta el `package-lock.json`, sin actualizar sus versiones. Si informa que el lockfile no coincide con `package.json`, comprobar que se descargó una versión completa del repositorio; no eliminar el lockfile para ocultar el problema. [Referencia npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci).

## 5. Iniciar XAMPP

1. Abrir **XAMPP Control Panel**.
2. Pulsar **Start** junto a **MySQL**. Debe quedar en verde. Aunque el botón diga MySQL, XAMPP incorpora MariaDB.
3. Iniciar también **Apache** si se quiere usar phpMyAdmin.
4. Abrir http://localhost/phpmyadmin para comprobar versión y puerto SQL. La configuración predeterminada de esta guía es `127.0.0.1:3306`.

No hacen falta FileZilla, Mercury ni Tomcat. Si MySQL no arranca, revisar su log o un conflicto de puerto antes de continuar; no borrar carpetas `data` para forzar su inicio.

Si MariaDB está en otro puerto, por ejemplo **3307**, definirlo en esta terminal **antes de instalar**:

```powershell
$env:DB_PORT = '3307'
```

El instalador guardará ese puerto en la configuración del backend. El puerto 3306/3307 es de SQL, no la dirección que se abre para jugar.

## 6. Instalar la base y configurar la conexión

Con MariaDB iniciado, ejecutar desde la raíz:

```powershell
npm run db:install
```

Por defecto utiliza la cuenta administradora `root` local **sin contraseña**. No cambia su contraseña. Si tu instalación tiene contraseña, usar el bloque siguiente en lugar del comando anterior.

### Administrador con contraseña

En PowerShell, introducirla sin dejarla escrita en el comando:

```powershell
$claveLocal = Read-Host 'Contraseña del administrador MariaDB local' -AsSecureString
$env:DB_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $claveLocal).Password
npm run db:install
Remove-Item Env:DB_ADMIN_PASSWORD
Remove-Variable claveLocal
```

Si el administrador no se llama root, definir también `$env:DB_ADMIN_USER = 'nombre_del_administrador'` antes de instalar. Debe poder crear bases, tablas, rutinas, triggers, usuarios y permisos locales. **No usar root como cuenta de Express**.

### Resultado esperado

El instalador realiza estos pasos:

1. Prepara **`truco_arena_dev`** con 13 tablas, restricciones, vista y rutinas de los archivos 01–05 y 08–10 de `database/mariadb`.
2. Carga las **40 cartas originales**, perfiles demo, mazos de 12/20 y datos académicos de ejemplo.
3. Crea **`truco_arena_app`@`127.0.0.1`** con contraseña aleatoria local, SELECT y EXECUTE de ocho procedimientos públicos, sin DML directo sobre tablas.
4. Genera **`backend/.env.mariadb`**, ignorado por Git.
5. Termina con `Instalación provisional lista: ...; solo truco_arena_dev`.

El archivo generado incluye las variables siguientes. Este bloque es explicativo, **no debe pegarse sobre el archivo generado**:

```dotenv
ARENA_STORAGE=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=truco_arena_dev
DB_USER=truco_arena_app
DB_PASSWORD=<contraseña-generada-localmente>
```

No hace falta copiar `.env.mariadb.example`, traer el `.env` de otra computadora ni pedir claves de Supabase. Conservar el archivo generado; no poner secretos en `VITE_`, Git o el frontend.

Si la cuenta app ya existe sin su archivo local, el instalador se detiene para no cambiar credenciales ajenas. Recuperar el archivo original o revisar la cuenta con el administrador; no inventar una contraseña ni borrar usuarios como solución.

No se borran bases, pero **sí se crean/actualizan objetos y se agregan ejemplos en `truco_arena_dev`**. Si ya contiene trabajo importante, respaldarla y revisar su versión antes de instalar. El DDL de MariaDB tiene commits implícitos: una instalación interrumpida puede dejar objetos parciales y debe revisarse. No es un migrador para cualquier esquema antiguo.

## 7. Levantar los dos entornos

Desde la raíz:

```powershell
npm run dev:sql
```

Carga `backend/.env.mariadb` e inicia **backend y frontend juntos**. Mantener abierta la terminal y no arrancar otra copia en los mismos puertos.

Abrir **http://127.0.0.1:5173/**. No abrir `index.html` con doble clic ni `localhost/Truco-online`.

### Confirmar la conexión real

Abrir estas dos direcciones:

- http://127.0.0.1:4000/api/health — backend directo.
- http://127.0.0.1:5173/api/health — misma API a través del proxy del frontend.

Ambas deben responder con estos datos, posiblemente junto a otros campos:

```json
{
  "status": "ok",
  "mode": "persistent",
  "storage": "mariadb",
  "database": "connected",
  "agreements": "pending"
}
```

`agreements: pending` indica acuerdos académicos pendientes, no una falla SQL. Si `storage` dice **`memory`**, se inició la demo, probablemente con `npm run dev`. Detenerla y ejecutar **`npm run dev:sql`**.

## 8. Jugar una primera partida

1. Entrar en **Jugar** y elegir **Contra la computadora**.
2. En **Jugador 1**, elegir **Ana demo SQL**.
3. Elegir **Mazo 20 · Ana (20 cartas)** y dificultad **Fácil**.
4. En **Perfil del rival PC**, elegir **Bruno demo SQL**, distinto del humano.
5. Pulsar **Jugar contra la PC**. La computadora crea su propio mazo; si comienza ella, esperar su turno automático.
6. Seleccionar/arrastrar una carta, invocarla cuando alcance la energía y finalizar el turno. Recargar el tablero para comprobar que sigue guardado en SQL.

Para **Dos personas · mismo dispositivo**, elegir un mazo de cada perfil con el mismo tamaño: 12 o 20. Las manos se ocultan durante el cambio de jugador. Contra PC se requiere un mazo humano de **20**.

Para inspeccionar la persistencia: phpMyAdmin → `truco_arena_dev` → `partida`, `participante_partida`, `copia_carta_partida`, `turno` y `jugada`. Una partida de 20 tiene **40 copias**; una de 12 tiene **24**. No editar manualmente vida, energía ni resultados durante el juego.

Si los perfiles ya tienen una partida activa, continuarla desde Jugar o elegir **Empezar de cero** y confirmar. El reinicio local conserva el historial con motivo `REINICIO`; no es el abandono online de Supabase.

## 9. Detener y ejecutar otro día

1. Pulsar **Ctrl+C** en la terminal de `dev:sql` para detener ambos procesos.
2. Detener MySQL y Apache desde XAMPP si ya no se necesitan.
3. Otro día: iniciar MySQL, abrir PowerShell en el proyecto y ejecutar **`npm run dev:sql`**.

No reinstalar la base ni dependencias cada vez. Los datos permanecen en MariaDB; conservar `.env.mariadb`. La CPU local actúa mientras está abierta la pantalla de partida, no como un worker independiente del navegador.

## 10. Ejecutar por separado o usar otros puertos

En lugar del comando conjunto, abrir dos terminales **desde la raíz**:

```powershell
# Terminal 1: backend, con su configuración MariaDB
node --env-file=backend/.env.mariadb node_modules/tsx/dist/cli.mjs watch backend/src/server.ts
```

```powershell
# Terminal 2: frontend
npm run dev:frontend
```

`npm run dev:backend` solo no carga el archivo MariaDB. Detener cada terminal con Ctrl+C.

Si están ocupados 4000/5173, por ejemplo usar **4100/5273**:

```powershell
# Terminal 1
$env:PORT = '4100'
node --env-file=backend/.env.mariadb node_modules/tsx/dist/cli.mjs watch backend/src/server.ts
```

```powershell
# Terminal 2: se invoca el workspace directamente para reenviar el puerto a Vite
$env:API_PROXY_TARGET = 'http://127.0.0.1:4100'
npm run dev --workspace frontend -- --port 5273
```

Abrir http://127.0.0.1:5273 y comprobar su `/api/health`. `API_PROXY_TARGET` apunta a **Express**, no a MariaDB. Las variables `$env:` duran solo en esa terminal; abrir otra restablece los valores predeterminados.

## 11. Solución de problemas

| Problema | Solución o comprobación |
|---|---|
| `git`, `node` o `npm` no se reconocen | Instalar la herramienta, cerrar y reabrir la terminal y revisar su PATH. |
| PowerShell bloquea `npm.ps1` | Utilizar `npm.cmd` en lugar de `npm`. |
| `ENOENT ... package.json` | Volver a la raíz del proyecto. |
| `EBADENGINE` | Usar Node `>=24.16.0 <25`, según `package.json`. |
| `ECONNREFUSED` al instalar | MySQL no está iniciado o `DB_PORT` no coincide con XAMPP. |
| `Access denied for user root` | Indicar la contraseña/usuario administrador correctos antes de instalar. |
| Falta `backend/.env.mariadb` | El instalador no terminó. Revisar su primer error antes de arrancar. |
| `DB_USER ... nunca root` / `Falta DB_PASSWORD` | Utilizar la cuenta limitada y el archivo generado, no las credenciales root. |
| `DB_NAME debe ser exactamente truco_arena_dev` | Se está usando la base de inspección u otro nombre; seguir el instalador de esta guía. |
| Cuenta app existente sin configuración | Recuperar el archivo original o revisar la cuenta con el administrador, sin sobrescribirla. |
| `EADDRINUSE` / `Port 5173 is already in use` | Detener la instancia propia anterior o utilizar otros puertos; no cerrar procesos ajenos al azar. |
| «No se pudo conectar con el servidor» o proxy `ECONNREFUSED` | Comprobar health primero en Express y después en Vite. Ambos deben estar abiertos. |
| Health informa `memory` | Detener la demo y ejecutar `dev:sql`; comprobar que no quedó otra API en 4000. |
| Aparece el login de Supabase | Revisar URL, proveedor, comando y `API_PROXY_TARGET`; ese login no corresponde al modo MariaDB. |
| Botón de PC deshabilitado | Elegir dos perfiles distintos y un mazo humano completo de 20 cartas. |
| Hay tablas en phpMyAdmin pero no abre la web | phpMyAdmin no ejecuta Node ni Vite: iniciar `dev:sql` y abrir 127.0.0.1:5173. |
| Error importando SQL PostgreSQL | Es otro dialecto. Para ejecutar esta app con XAMPP, usar `db:install`. |

## 12. Actualizar una instalación

Con los procesos de Node detenidos y tus cambios propios revisados:

```powershell
git pull --ff-only origin master
npm ci
```

Conservar `.env.mariadb`, que no se versiona. Leer las notas del cambio antes de actualizar SQL. En una base compatible con esta implementación, `npm run db:install` conserva datos/reutiliza credenciales y aplica las rutinas vigentes; requiere MariaDB y permisos de administrador nuevamente. Respaldar una base con datos importantes. No borrar bases ni ejecutar el instalador PostgreSQL como actualización.

## 13. Compilación y pruebas opcionales

```powershell
npm run build
npm test
npm run test:build
```

Para las suites MariaDB existentes:

```powershell
npm run db:seed:check
npm run test:sql
npm run test:e2e:sql
```

Las pruebas SQL **crean perfiles/partidas y pueden instalar triggers temporales de fallo en `truco_arena_dev`**. Usar una instalación de desarrollo sin una partida en uso y leer [README-PERSISTENCIA.md](docs/tecnica/mariadb.md) antes de ejecutarlas. Si el administrador SQL tiene contraseña, definir nuevamente `DB_ADMIN_USER`/`DB_ADMIN_PASSWORD` como en el paso 6 durante esas pruebas y retirar la contraseña de la terminal al terminar: el instalador no la guarda en el archivo de la app. No son necesarias para jugar. Las E2E usan Chrome/Edge cuando están instalados; si hace falta el navegador de pruebas, ejecutar `npx playwright install chromium`.

Para revisar el build local después de compilar: backend con `node --env-file=backend/.env.mariadb backend/dist/backend/src/server.js`, y en otra terminal `npm run preview --workspace frontend`. Mantener entorno de desarrollo: `NODE_ENV=production` exige el stack Supabase/CPU de la publicación y no corresponde a esta instalación XAMPP.

## 14. Diferencias con la versión publicada

| Modo | Comando | Persistencia y alcance |
|---|---|---|
| MariaDB/XAMPP | `npm run dev:sql` | SQL local; perfiles seleccionables sin Auth; CPU desde la pantalla y dos personas en el mismo dispositivo. |
| Memoria | `npm run dev` | Datos temporales que se pierden al reiniciar el backend; demostración. |
| Supabase | `npm run dev:supabase`, con configuración específica | Auth/sesiones, recuperación, estado privado, worker persistente, salas online y plazos según la configuración del proyecto. |

**El modo MariaDB no incluye** Auth/códigos de recuperación, salas online, Cron/temporizador ni worker CPU autónomo. No es un backend público multijugador: selecciona perfiles de confianza y su DTO puede contener ambas manos. Estas diferencias no se solucionan importando el SQL PostgreSQL.

La web publicada sigue en [TrucoOnline](https://truco-online-beta.vercel.app). Esta guía no necesita modificar Supabase, Railway ni Vercel. B1–B4 y la revisión académica humana del MER/MR siguen pendientes.

## 15. Estructura y referencias

```text
frontend/                  React, Vite, TypeScript y componentes
backend/                   Express, adaptadores y configuración
shared/                    Contratos API y reglas compartidas
database/mariadb/          Esquema, rutinas, seed y ampliaciones locales
database/mariadb/install/  SQL autocontenido para inspección con XAMPP
database/postgres/install/ SQL para PostgreSQL nuevo
supabase/migrations/       Migraciones operativas PostgreSQL
scripts/                   Instalación y ejecución
tests/                     Integración y navegador
docs/                      Hitos, MER/MR, evidencias y bitácora de IA
```

- [Evidencia de verificación de esta guía](docs/pruebas.md#instalación-xampp).
- [Persistencia: contratos y pruebas históricas](docs/tecnica/mariadb.md).
- [Instalar solamente la base XAMPP](database/mariadb/install/LEEME.md).
- [Demo en memoria](docs/pruebas.md#modo-en-memoria).
- [Documentación académica](docs/hito-1/README.md) y [bitácora de IA](docs/bitacora-ia.md).
