# Fase 3 — sesiones, perfiles y web

> Archivo histórico de desarrollo. Para el estado vigente ver [arquitectura](../../arquitectura.md) y [despliegue](../../despliegue.md). Los JSON/capturas QA mencionados se consolidaron en el [historial de validaciones](../../historial-validaciones.md); las afirmaciones de esta fase conservan su fecha y alcance.

Destino exclusivo: TrucoOnline `gjcpcbrkdjymrwktshfr`. Motor de fase 2 intacto; no repetir su migración.

## Cambio de arquitectura e impacto (previo a aplicar)

Se conserva Express como BFF y se agrega transporte RPC con JWT de usuario hacia las funciones del motor existente. No se dispone de un LOGIN PostgreSQL runtime limitado provisionado; no se utiliza postgres/service_role para servir HTTP. El adaptador pg de fase 2 sigue disponible y probado; el transporte web nuevo usa `public.ta_web`, una función pequeña de autorización/despacho que deriva el jugador de `auth.uid()` y `jugador_auth`, fija el contexto privado del motor y lo invoca. No acepta actor ni dueño como autoridad. El navegador no recibe tokens Auth: se conservan en cookie cifrada AES-256-GCM, HttpOnly y Secure en HTTPS, SameSite=Lax y ruta /. POST requiere JSON y Origin exacto. La clave de cifrado es solo servidor y debe conservarse para recuperar sesiones tras reiniciar.

Migración nueva `20261111151817_arena_profiles_web.sql`: sin cambios en cartas, estadísticas ni rutinas del motor. Reutiliza `jugador_auth`, que ya tiene FK a auth.users y a jugador; **no agregar auth_user_id redundante a jugador**. Permite varios navegadores vinculados al mismo perfil histórico.

Agrega una tabla técnica `intento_recuperacion`: una fila por identidad Auth, ventana e intentos, FK a auth.users. Justificación: el límite de cinco intentos/15 minutos debe persistir y aplicarse también si se invoca RPC directamente, sin depender de RAM/IP. El esquema pasa de 15 a **16 tablas**, sin alterar las 13 académicas. RLS habilitado, sin grants a anon/authenticated; política interna solo para ta_engine_owner. Las recuperaciones inválidas devuelven error de dominio como JSON para confirmar el incremento de intentos en vez de revertirlo con una excepción.

Único objeto de Data API nuevo: `public.ta_web(text,jsonb)`, EXECUTE solo authenticated, nunca PUBLIC/anon. SECURITY DEFINER limitado al mismo propietario no superusuario/sin BYPASSRLS del motor, search_path fijo y auth.uid obligatorio. Solo registro/recuperación/me antes de vincular perfil; los demás métodos requieren perfil. No publica tablas ni funciones privadas. El alta atómica crea jugador, colección, hash y vínculo. Recuperación bloquea perfil y rota código antes de confirmar; dos sesiones no consumen el mismo código. Rotación invalida código anterior, no desvincula sesiones ya autorizadas.

Código: dos UUID v4 CSPRNG sin guiones (244 bits efectivos), 64 caracteres hex, mostrado una sola vez. Solo SHA-256 permanece en jugador.codigo_recuperacion_hash. Ni código, JWT ni refresh token en localStorage/URL/logs del servidor. Alias/IP no autorizan acceso. IP solo limita abuso del BFF; Auth aplica además sus límites de altas y SQL limita recuperación por identidad. No es protección contra DDoS distribuido; configurar límites/CAPTCHA de Auth antes de publicar, sin resolver CAPTCHA automáticamente.

Antes de aplicar: perfiles concurrentes/rotación/RLS probados en PostgreSQL aislado. DDL remoto transaccional, solo proyecto definitivo. Si falla, rollback íntegro. Reversión operativa: detener proveedor Supabase web y volver a los proveedores locales; preservar perfiles, vínculos y hashes, no borrar datos ni reejecutar motor. No desplegar. Historial local de migraciones aún debe reconciliar timestamps MCP antes de usar CLI db push.

## Alcance web

Inicio, Jugar, Colección, Mis mazos, Historial, Mi perfil. Reutiliza Home, Collection, Decks, Battlefield, sprites v3 y badges. Jugar presenta dos opciones futuras deshabilitadas: no inventa CPU/salas/temporizador. Recupera partidas existentes por historial/URL, con perspectiva fija del usuario; mano rival siempre vacía en JSON y handCount separado. Cada acción usa motor, UUID y versión. No hay un segundo motor en React.

Rutas Supabase separadas de la API local sin autenticación. Los proveedores memory/mariadb siguen intactos. Creación de partidas por HTTP remota queda bloqueada hasta las modalidades de fase siguiente; pruebas administrativas pueden preparar fixtures usando el motor existente para validar recuperación y acciones.

## Configuración

Desde la raíz, copiar `backend/.env.supabase.example` a `backend/.env.supabase`, completar clave **publicable** y generar SESSION_ENCRYPTION_KEY de 32 bytes hex criptográficos. Archivo ignorado por Git. No usar variables VITE_ para secretos. Supabase Auth → Anonymous sign-ins debe estar activado (verificado tras confirmación del usuario).

Backend: `node --env-file=backend/.env.supabase node_modules/tsx/dist/cli.mjs backend/src/server.ts`.

Frontend (PowerShell): `$env:API_PROXY_TARGET='http://127.0.0.1:4200'; npm run dev:frontend`.

Web `http://127.0.0.1:5173/`, APP_ORIGIN debe coincidir exactamente. Para HTTPS: cookies Secure y prefijo __Host-; fuera de localhost no se permite HTTP. Mantener backend/.env.supabase fuera de Git. El frontend usa /api, sin credenciales SQL ni service_role. Un futuro rewrite HTTPS conserva el mismo origen.

## Resultados

Implementado y probado en TrucoOnline, 11/11/2026. Estado final: 16 tablas, 28 FK, RLS en todas, catálogo original de 40 cartas. No se reejecutó ni modificó el motor de fase 2.

### Correcciones incrementales y permisos finales

La prueba Auth real detectó `permission denied for schema auth`: en Supabase gestionado el administrador no pudo conceder USAGE de auth al propietario privado. No se amplió la membresía del rol ni se modificó auth. La migración `20261111153232_arena_profiles_claim_subject.sql` sustituye auth.uid por su semántica equivalente: `sub` de `request.jwt.claims`/`request.jwt.claim.sub`, establecido por **PostgREST después de validar el JWT**, nunca user_metadata ni p_data. El BFF verifica además el token con Auth getUser.

Advisor advirtió sobre SECURITY DEFINER en un esquema expuesto. Corrección `20261111153756_arena_web_private_gateway.sql`: el objeto público final es **SECURITY INVOKER**, delega a `truco_arena_der.ta_web_interno` (**SECURITY DEFINER**, propietario no superusuario/sin BYPASSRLS), con todas las comprobaciones de sujeto/perfil. authenticated recibe solo USAGE del esquema y EXECUTE de esa entrada privada; **ningún SELECT/DML de tablas ni EXECUTE del motor interno**. USAGE no expone el esquema por REST: su encabezado Accept-Profile se probó rechazado. anon no ejecuta ninguna entrada. El esquema de negocio permanece fuera de los schemas permitidos por Data API.

Timestamps remotos MCP: `20261111152852_arena_profiles_web`, `20261111153249_arena_profiles_claim_subject`, `20261111153836_arena_web_private_gateway`. Sus archivos locales son, respectivamente, `20261111151817`, `20261111153232`, `20261111153756`. Ya están aplicados: **no volver a ejecutar ni db push sin reconciliar el historial**.

### Pruebas efectivamente ejecutadas

| Verificación | Resultado real |
|---|---|
| `npm run test:profiles` | PostgreSQL aislado: vínculo Auth/perfil, hash sin texto plano, recuperación concurrente de un solo uso, rotación, colección, propiedad, persistencia del límite de intentos y tablas privadas; aprobado con las tres migraciones. |
| `npm run test:postgres` | 14 grupos del motor existente aprobados, incluyendo concurrencia y reinicio PostgreSQL. |
| `npm test` | 15 backend + 21 frontend aprobados; catálogo y sprites originales. |
| `npm run build` | Backend y frontend compilan. |
| `node tests/postgres/web-auth.mjs` | Cuatro grupos E2E aprobados con **Supabase Auth real y cuatro contextos de navegador independientes**: alta, recarga, cookie HttpOnly cifrada, mazo aleatorio guardado por UI/edición, aislamiento, recuperación en otro navegador, códigos inválidos/usados, rotación, historial, acción del motor, rechazo de suplantación y partida recuperada por URL. Repetido después de la migración final. |
| `node --env-file=backend/.env.supabase tests/postgres/web-security.mjs` | HTTP real: refresh concurrente de cuatro peticiones (caducidad local de cookie adelantada con la clave de prueba, no modificación del JWT), cookie manipulada rechazada, CSRF rechazado, RPC anon rechazado, IDs falsos rechazados, esquema no expuesto y límite persistido de recuperación; aprobado tras migración final. |
| Reinicio Node | El BFF se reinició durante la espera del fixture del primer E2E; mismos navegadores conservaron perfil/cookie y recuperaron su partida. |
| Responsive | Capturas escritorio y 390×844 revisadas, perfil/navegación sin desbordamiento. |
| Regresión de navegación anterior | 8 E2E aprobados en proveedor memoria aislado (tablero, modal de victoria, PC local, arrastre con mouse/touch, mazos y selectores). No se ejecutaron contra la cuenta del usuario. |

Evidencia: [metadatos/ACL/advisors/ledger](../../historial-validaciones.md), `artifacts/profiles/web-results.json`, `artifacts/profiles/perfil.png`, `artifacts/profiles/movil.png`, `artifacts/profiles/jugar.png`. No contienen códigos ni tokens.

El E2E espera `READY_FOR_GAME_FIXTURE`: crea perfiles/mazos propios y escribe IDs en `tmp/profile-fixture-request.json`. Un administrador prepara **solo la partida QA de esos IDs** mediante ta_iniciar_partida y escribe `tmp/profile-fixture-game.json` con id/suffix; continúa verificando acciones e historial. Ese inicio administrativo es preparación de fixture, no implementación de una modalidad. No se automatiza ni expone un endpoint público para saltar la futura CPU/sala. Las pruebas aisladas sí son completamente automáticas. Los fixtures remotos de QA permanecen separados por identidad; no se borró historial ni usuarios Auth.

### Ejecución y límites restantes

Con puertos libres y archivo local completado: **`npm run dev:supabase`** inicia ambos procesos. Equivale a los dos comandos anteriores; API en 4200 y frontend en 5173. `npm run dev` conserva memoria; `npm run dev:sql` conserva MariaDB. No hay fallback de Supabase a otro proveedor. El indicador health comprueba conectividad RPC (incluido rechazo esperado al rol anon), no inventa un login activo.

Variables del archivo backend local: SUPABASE_URL fija el proyecto definitivo; SUPABASE_PUBLISHABLE_KEY contiene su clave publicable; SESSION_ENCRYPTION_KEY protege cookies y debe ser estable entre reinicios; APP_ORIGIN es el origen exacto permitido; PORT y API_PROXY_TARGET coordinan API/proxy. La clave de sesión se genera con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y se guarda solo en ese archivo/gestor de secretos, nunca en Git ni capturas. No hay necesidad de clave administrativa ni contraseña SQL en este transporte.

La política de cinco intentos/15 minutos persiste en SQL por identidad. El BFF suma 30 peticiones sensibles/10 minutos por conexión/IP como defensa de abuso, **no autorización**. Antes de publicar, evaluar CAPTCHA y limitación distribuida de altas Auth. El caché de refresh concurrente del BFF dura 15 s y es por proceso; verificar coordinación entre réplicas al elegir alojamiento. Una interrupción transitoria de Auth conserva la cookie y permite reintentar.

Queda un aviso de Supabase sobre protección de contraseñas filtradas deshabilitada; esta app no solicita contraseñas. El aviso del gateway privilegiado público quedó resuelto. No se afirma que no existan riesgos de despliegue: HTTPS, orígenes, rotación/custodia de clave de sesión y controles de abuso requieren configuración del alojamiento. La renovación del código no expulsa otros dispositivos vinculados; al cerrar sesión se revoca el refresh de esa sesión y se elimina su cookie. No hay revocación global propia adicional a Supabase.

CPU servidor, salas online, sincronización entre rivales y temporizador **siguen fuera del alcance**. Jugar tiene dos opciones preparadas/deshabilitadas, no una partida simulada presentada como remota. La web ya puede consultar y actuar sobre partidas persistidas existentes con privacidad y turno validado. Sin commits ni despliegue Vercel; B1–B4 permanecen pendientes.
