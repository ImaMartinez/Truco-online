# Fase 7 — Publicación de Preview

Supabase exclusivo: **TrucoOnline `gjcpcbrkdjymrwktshfr`**, región us-west-2. Sin migraciones, db reset/push, modificaciones del catálogo/reglamento ni commits. B1–B4 pendientes. Resultados y archivos en [evidencia](13-evidencia-publicacion.json).

## Servicios

| Componente | URL | Estado |
|---|---|---|
| Juego Preview | https://truco-online-o8iyhhp4o-ima-7bec.vercel.app | READY; pruebas públicas aprobadas |
| Express + CPU | https://truco-arena-api-preview.up.railway.app | Health 200, Supabase conectado, CPU ready |
| Production provisoria | https://truco-online-beta.vercel.app | Solo página de preparación, sin API ni juego |

Despliegues ejecutados con las CLI autenticadas Vercel 65.14.0 y Railway 5.71.0: las integraciones todavía no exponían sus herramientas durante la preparación. En la comprobación final ya estuvo disponible Railway MCP y confirmó una réplica online, cero incidencias y ningún cambio pendiente. Vercel MCP devolvió 404 para el deployment/equipo correctos y la CLI pasó a exigir login en la nueva sesión; no se cambió de proyecto ni se pidió nueva autorización para usar la Preview. Las URLs públicas siguen respondiendo 200 y no requieren acceso administrativo Vercel. Para futuros despliegues habrá que restablecer esa sesión administrativa.

- Vercel: equipo Ima / `ima-7bec`, proyecto nuevo `truco-online`, ID `prj_0pXPak6IHEJwrXAe4NP8VeodVD4r`, Hobby, Node 24.x, Vite, raíz del repositorio.
- Railway: workspace `92507fba-2b4f-4183-86fc-dba760bd35bc`, proyecto nuevo TrucoOnline `0ceb2799-958c-4881-965a-5266897c51ca`, entorno preview `32a6b309-8dd9-4267-a177-24e98f49b663`, servicio único truco-arena-api `e8a5f8ea-b35b-49b7-91fc-1cb34385a67b`. Sin bases, Redis, volúmenes ni otro motor CPU.
- Una réplica en US West / us-west2, SFO=0, IPv6 saliente, sin suspensión. Health `/api/health`, plazo 120 s; reinicio ON_FAILURE hasta 10 veces; drenaje 25 s.

Vercel exigió la primera publicación en Production. Se detuvo ese paso y el titular autorizó **solamente una página provisoria** sin juego, API o secretos, ubicada en `infrastructure/vercel-bootstrap`. `/api/health` en ese dominio devuelve 404. **El juego no fue promovido a Production.**

Solo el hostname Preview indicado se hizo público mediante una excepción explícita. La protección global sigue activa. El bypass de automatización creado por `vercel curl` en el diagnóstico fue revocado. El visitante no necesita cuenta Vercel.

## Runtime y seguridad

Dockerfile raíz: compila backend/shared, poda dependencias de desarrollo, incluye CA pública y ejecuta `node backend/dist/backend/src/server.js` como usuario `node`. NODE_ENV=production, PORT del proveedor, escucha 0.0.0.0. Build y arranque Linux reales aprobados. No usa watch, rutas Windows ni migraciones al arrancar. SIGTERM/SIGINT cierran HTTP, esperan CPU y cierran pools; timeout de proceso 20 s.

El worker existente arranca una sola vez y consulta pendientes. Pool máximo 3, LOGIN `ta_cpu_node` con límite SQL 5, SET LOCAL ROLE `ta_cpu_worker`. Conexión directa a `db.gjcpcbrkdjymrwktshfr.supabase.co:5432`, TLS con CA y rejectUnauthorized=true. IPv6 evita comprar IPv4 o utilizar credenciales administrativas. Health devuelve 503 si CPU falta, falla o no tiene barrido exitoso en 15 s.

Frontend siempre consume `/api/...` del mismo origen. `vercel.ts` usa configuración nativa: proxy HTTPS Railway antes de archivos y fallback React; instalación solo del workspace frontend, build `npm run catalog:check && npm run build --workspace frontend`, salida `frontend/dist`.

`API_PROXY_SECRET` dedicada autentica Vercel → Node mediante `x-arena-proxy-key`, sobrescrita por routing con variable del deployment, comparada en tiempo constante. No va en React. Solo después se acepta `x-vercel-forwarded-for` como IP de limitación, nunca de autorización. `trust proxy` permanece false. Acceso privado directo en Railway devuelve 403; health es público.

APP_ORIGIN es la URL HTTPS Preview exacta; sin comodines ni reflexión de Origin. Cookies `__Host-ta_session`, Secure, HttpOnly, SameSite=Lax, Path=/, **sin Domain**: pertenecen a Vercel. Se reutilizó la clave de cifrado local existente, estable entre releases. Auth verifica JWT por servidor y SQL deriva el jugador; nunca se devuelven ambas manos.

Respuestas privadas y errores: Cache-Control private/no-store, CDN-Cache-Control no-store, Vercel-CDN-Cache-Control no-store, Vary Cookie. El ensayo rechaza HIT de caché compartida. JSON malformado 400 y cuerpo excesivo 413; logs sin cookies, cuerpos o secretos.

Presencia y deduplicación de refresh son por proceso: mantener una réplica. Presencia desconocida no causa derrota. Perfiles/sesiones limitados a 30 solicitudes/IP/10 min (NAT comparte cupo); recuperación y salas conservan límites SQL.

## Variables configuradas — solo nombres

| Entorno | Variables |
|---|---|
| Vercel Preview Config | `API_BACKEND_ORIGIN` |
| Vercel Preview Secret de routing | `API_PROXY_SECRET` |
| Railway Preview | `NODE_ENV`, `ARENA_STORAGE`, `BIND_HOST`, `PORT`, `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SESSION_ENCRYPTION_KEY`, `API_PROXY_SECRET`, `CPU_DB_HOST`, `CPU_DB_USER`, `CPU_DB_PASSWORD` |

CPU_DB_CA_FILE es opcional; usa el certificado incluido. Valores transferidos por stdin, omitidos de documentación/logs. No hay variables VITE privilegiadas ni secretos SQL/sesión en Vercel. No subir `.env.supabase`; el ejemplo de producción solo tiene placeholders. Rotar el secreto de ingreso de forma coordinada en ambos proveedores; conservar estable la clave de sesión.

## Validación

Previas: 45 unitarias (22 backend/23 frontend), 2 grupos de configuración, paquetes limpios/podados con canary ausente, build/smoke, 8 E2E memoria, 14 grupos motor PostgreSQL aislado, perfiles, 7 CPU, 7 salas y 14 plazos. npm audit: cero vulnerabilidades de aplicación. Ensayo HTTPS local con Supabase real: 8 grupos, tres dificultades completas, cookies, reinicio, salas, privacidad, móvil, abandono, recuperación, límites y Cron sin backend. Evidencia local no se presenta como cloud.

**Resultado público final: 8 grupos aprobados**, cero filtraciones de manos, errores JS o 5xx inesperados en el recorrido. Tres dificultades completas: Fácil QA 58 hasta turno 30; Normal QA 60 hasta turno 18; Difícil QA 61 hasta turno 17. Partida QA 63: INACTIVIDAD, turno 5, versión 6, ganador posición 2, 40 copias y cinco recibos de vencimiento. Se confirmó directamente en SQL con Railway detenido y cero conexiones CPU; Cron tenía 591 ejecuciones exitosas y ninguna fallida en diez minutos. Después se reinició el servicio y se recuperaron perfiles, partida e historiales.

Además, **Chrome y Edge en procesos distintos** aprobaron perfiles independientes, navegación, colecciones, sala, manos privadas, resultado en vivo e historial de ambos (QA 59). Se inspeccionaron capturas de escritorio 1440×900 y móvil 390×844. Los JS/CSS públicos y logs Railway no contienen los valores reales de ingreso, cifrado de sesión o contraseña SQL. Se comprobó que la clave de sesión remota coincide con la local original. No había servidores del juego escuchando en 4200/5173/4320/5443 durante el ensayo público.

Pruebas públicas: perfiles `qa-preview-*`, sin modificar jugadores existentes. La suite comprueba tres dificultades hasta terminar, idempotencia, versión, privacidad, cookies, sincronización, móvil, abandono, historial y vencimientos. El wrapper Railway además reinicia el servicio y detiene su despliegue mediante la API durante Cron; comprueba stopped=true y health no disponible y lo restaura con Restart. Conserva la configuración de una réplica. No ejecutar el wrapper con otros usuarios probando.

```powershell
npm test
npm run build
npm run test:build
npm run test:deployment
npm run test:deployment:build
npm run test:deployment:local
$env:WEB_BASE='https://truco-online-o8iyhhp4o-ima-7bec.vercel.app'
node --import tsx tests/deployment/preview.mjs
# Incluye reinicio y detención deliberada del servicio Preview:
node --import tsx tests/deployment/railway-preview.mjs
node --import tsx tests/deployment/two-browsers.mjs
```

Supabase conserva 16 tablas, 40 cartas y dos jobs propios activos: deadlines ONLINE cada segundo y retención de logs. Temporizador 15 s y derrota al tercer turno propio inactivo viven en SQL/Cron; no dependen de Node ni del navegador. Los procesos locales 4200/5173 fueron apagados antes de probar la Preview.

## Costos y límites

Railway informó plan HOBBY **en trial**, USD 5 de crédito, 30 días restantes al inspeccionar, sin tarjeta y sin suscripción de consumo. No se activó plan, tarjeta, add-on ni consumo pago. Rechazó límites de gasto inferiores a USD 10; no se aplicó un límite superior al crédito. Trial puede detenerse al agotar crédito o plazo.

Límite real: 2 vCPU, 1.000.000.000 bytes RAM, 1000 procesos. Muestra final de veinte minutos: RAM ~80 MB media, ~70 MB actual, máximo ~93 MB; CPU media ~0,0064 vCPU, máximo ~0,0594. Incluye reinicios y apagados de prueba: no es un benchmark ni garantiza gasto mensual. Consumo reportado USD 0,000434 y crédito restante ~USD 4,999566 (pueden tener retraso de medición). Extrapolar mecánicamente RAM/CPU de esa muestra da ~USD 0,93/mes solo de recursos, sin red, crecimiento ni mínimo del plan; no es una cotización. El Hobby pago tendría mínimo de USD 5/mes, no activado. Métricas completas en evidencia.

Precios publicados: RAM USD 10/GB-mes, CPU USD 20/vCPU-mes, salida USD 0,05/GB. Hobby pago parte de USD 5/mes aplicados al consumo; no fue contratado. Vercel Hobby es para esta demo personal/educativa, sujeto a sus límites. No hay promesa de gratuidad indefinida ni SLA. [Precios Railway](https://docs.railway.com/pricing), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

## Incidentes y recuperación

- Primera publicación Vercel requirió autorización separada de página provisoria; el juego sigue en Preview.
- Negaciones de carpetas terminadas en `/` en `.vercelignore` omitieron subcarpetas. Se corrigieron y verificaron build/manifiesto remoto de 144 archivos, sin `.env`, backend de ejecución, SQL ni artefactos.
- El arnés suponía humano inicial en PC. La partida QA mostró CPU en posición 1: se espera el turno humano y se usa versión fresca. No se cambió el motor.
- Railway conservaba la región inicial al escalar; se quitó SFO y quedó US West=1.
- El ensayo de apagado por escala cero no apagaba el contenedor activo: el arnés lo detectó y restauró el servicio. Se reemplazó por Stop/Restart explícito del deployment y se comprobó el apagado real antes de repetir el recorrido.

Rollback: redeploy de imagen Railway previa conservando claves/origen y esperar health CPU ready; volver a Preview verificada y ajustar APP_ORIGIN si cambia. Datos persisten en Supabase. No duplicar ni revertir Cron al revertir frontend/backend. Production del juego requiere revisión posterior de pruebas/costos y autorización expresa; la aprobación de la página provisoria no la autoriza ni aprueba MER/MR académico.
