# Configuración de despliegue existente

Esta guía identifica lo que necesita la publicación actual. **No autoriza un despliegue, una migración ni cambios de secretos.** La limpieza del repositorio se revisa primero en local.

| Servicio | Responsabilidad |
|---|---|
| Vercel | Frontend Vite y rewrite `/api` del mismo origen. URL pública: https://truco-online-beta.vercel.app |
| Railway | Un servicio Node persistente: Express y worker CPU, una réplica inicial. |
| Supabase | PostgreSQL privado, Auth anónimo, motor, salas y Cron. Proyecto `gjcpcbrkdjymrwktshfr`. |

## Archivos indispensables

- `Dockerfile`, `.dockerignore`: build backend con workspace, TypeScript compartido, dependencias podadas y usuario sin privilegios.
- `backend/certs/supabase-prod-ca-2021.crt`: certificado público CA usado para verificar TLS; no es una clave privada y no debe excluirse.
- `backend/src/server.ts`, `runtime-config.ts`, `cpu/`, `repositories/`: proceso persistente, puerto del proveedor, worker y cierre ordenado.
- `vercel.ts`, `infrastructure/vercel-config.mjs`, `.vercelignore`: configuración nativa Vercel, contexto mínimo y rewrite seguro.
- `package.json`, `package-lock.json`, manifiestos de ambos workspaces y `shared/`: necesarios incluso cuando un proveedor compila solo uno de los entornos.
- `supabase/migrations/*.sql`: historial de cambios existente; no se vuelve a aplicar a una base ya configurada.

No hay un `railway.toml`, `railway.json` o `supabase/config.toml` versionado en este checkout. Parte de la configuración del servicio Railway y de Supabase vive en sus paneles. No se crea un sustituto especulativo durante la limpieza; se conserva el contrato del Dockerfile y del código actual.

## Railway

Raíz del build: repositorio completo. Dockerfile construye el backend y los contratos compartidos; el contenedor inicia `node backend/dist/backend/src/server.js`. `NODE_ENV=production`, `ARENA_STORAGE=supabase`, bind `0.0.0.0` y `process.env.PORT`. Healthcheck `/api/health`; worker único dentro del mismo proceso, sin suspensión que impida ejecutarlo. El cierre del servidor atiende SIGTERM y cierra pools/worker.

El servicio publicado existente es `truco-arena-api`; no hace falta otra base Railway. Las opciones de región, réplica, reinicio y health del servicio se mantienen en el proveedor. No confundir su entorno históricamente llamado `preview` con el destino público del frontend: comparten el backend persistente.

Variables de servidor: consultar **`backend/.env.production.example`** para los nombres/formatos completos. Incluyen `APP_ORIGIN`, `APP_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SESSION_ENCRYPTION_KEY`, `API_PROXY_SECRET` y `CPU_DB_*`. No registrar sus valores privados en documentación o Git. La clave de sesión no se regenera para publicar una revisión del frontend.

## Vercel

Configuración en `vercel.ts`, con `makeVercelConfig`:

```text
Framework: Vite
Install: npm ci --workspace frontend --include-workspace-root=false
Build: npm run catalog:check && npm run build --workspace frontend
Output: frontend/dist
```

Variables del proveedor: **`API_BACKEND_ORIGIN`** (origen HTTPS exacto del backend) y **`API_PROXY_SECRET`** (secreto de ingreso, nunca parte del bundle). Las rutas de API preceden al filesystem y al fallback SPA. Se conserva el path/query y se inyecta el encabezado del proxy en servidor. No desplegar Express como una segunda app Vercel.

El contexto `.vercelignore` incluye la fuente documental del catálogo y el manifiesto de sprites importado, además del código y assets públicos. Quitarlos rompe el build aun si no parecen archivos de aplicación.

## Sesiones y verificación

Permitir únicamente orígenes HTTPS autorizados; no añadir comodines `*.vercel.app` para evitar errores CSRF. Cookies sin Domain que las ate a Railway: las peticiones del navegador y Set-Cookie deben funcionar en el origen Vercel. Perfil, sesión, manos, historial y partidas conservan `private/no-store`.

La compilación local y los tests de configuración se explican en [pruebas](pruebas.md). Una imagen Docker solo puede considerarse verificada después de `docker build` con un daemon disponible. Los pasos equivalentes de workspace y poda ayudan a detectar dependencias, pero no prueban el contenedor Linux.

Antes de cualquier publicación futura, revisar el manifiesto y resultados de [la limpieza](revision-final/README.md). Esta entrega no incluye promoción, push, acceso administrativo remoto ni ejecución de SQL.

## Actualización pública del 14/11/2026

Frontend publicado desde `b3ae316394bfbc114f8eed59ce10888994b5af97`: deployment Vercel `dpl_6mc3fuoRuYTSDX89vh8DAQP5RhXn`, READY, promovido al dominio https://truco-online-beta.vercel.app después de verificar el mismo build sin dominio. Reemplaza `dpl_5pXVHSWb11LxvC7azCEL691HAsX8`; Railway y Supabase no se desplegaron ni migraron. Vercel sigue sin integración Git: el push por sí solo no actualiza la web.

Se comprobó el bundle real en escritorio 1366×900 y móvil 390×844, antes y después de la promoción: ayuda sin aviso B1–B4/PostgreSQL, reglas conservadas y perfil Prueba visible en los selectores de Mazos/Colección. La prueba visual usó respuestas de sesión/partida simuladas y cero escrituras remotas; no acredita una nueva suite de Auth/SQL. Health real: base conectada y CPU ready. JS/CSS públicos idénticos a los compilados localmente, sin el texto antiguo. El acceso temporal de automatización se revocó y se verificaron cero bypasses residuales. Evidencia regenerable local en `artifacts/published-ui-copy/`, ignorada por Git.
