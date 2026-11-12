# Publicación versionada y revisión del tablero

## Alcance y estado

Revisión del 12/11/2026. Continúa la publicación solicitada después de validar los ajustes visuales. B1–B4 siguen pendientes; esta publicación no constituye aprobación académica. El historial de las ocho migraciones se incorpora a Git, sin ejecutarlas de nuevo. No se modifican cartas, reglas, motor SQL ni datos de usuarios reales. Las pruebas públicas utilizan perfiles nuevos con prefijo QA.

## Correcciones de interfaz

| Problema | Causa | Corrección |
| --- | --- | --- |
| Ataque directo dirigido al panel de vidas | Referencia DOM del contador de vida | Anclas estables en las manos de ambos participantes; el desplazamiento llega a su centro. Los ataques a cartas conservan su destino y los tiempos previos. |
| Controles móviles compiten con vidas/energía | Recursos y acciones compartían un contenedor inferior limitado | Vidas y energía primero, acciones en fila independiente, estadísticas secundarias en una región horizontal identificada. Invocar tiene menor protagonismo. |
| Scroll en cada estadística de escritorio | Filas y contenedores laterales con alturas limitadas | Tarjetas con altura natural; solo la bitácora extensa conserva scroll. En horizontal muy bajo se desplaza una única región de recursos. |
| Teléfono 360×740 demasiado pequeño | Intentar comprimir todo en una sola altura | Desplazamiento corto de página, conservando espacios de combate utilizables y evitando solapamientos. |

Archivos de interfaz: `frontend/src/combatAnimation.ts`, `frontend/src/pages/Battlefield.tsx`, `frontend/src/components/ArenaIndicators.tsx`, `frontend/src/components/battlefield.css`. El daño continúa viniendo del servidor. No se calcula un segundo resultado en React.

Capturas reales comparativas locales, excluidas de Git: `artifacts/arena-review/before/` y `artifacts/arena-review/after/`, con nombres `1920x1080.png`, `1366x768.png`, `1280x720.png`, `390x844.png`, `844x390.png`, `360x740.png`. Mediciones en `measurements.json`. La captura `844x390-actions.png` muestra el acceso a los controles en horizontal. Se inspeccionaron visualmente las seis resoluciones, además de medir geometría; los escenarios son fixtures de presentación en memoria, no datos de Supabase.

Pruebas: `tests/e2e/arena-review.spec.ts` verifica las seis resoluciones, selección, no solapamiento y anclas; también comprueba las coordenadas finales de ataques directos en ambas perspectivas. Las regresiones existentes cubren ataques a cartas, daño/eliminación, mouse/touch, turnos, resultados y movimiento reducido. Se actualizaron expectativas anteriores de altura fija para reflejar la distribución natural y la excepción del teléfono pequeño.

## Seguridad y preparación de la publicación

- `APP_ORIGINS` es una lista JSON validada de exactamente la Preview vigente y Production. Sin comodines ni autorización de otros subdominios Vercel. `APP_ORIGIN` se conserva y la clave de sesión no rota.
- Production recibe únicamente `API_BACKEND_ORIGIN` y `API_PROXY_SECRET` administrado. La clave de ingreso coincide con Railway, sin entrar al bundle. `/api` mantiene proxy del mismo origen, cookies HttpOnly/Secure/SameSite Lax y respuestas privadas sin caché compartida.
- El primer build Production se crea con `--prod --skip-domain`. Se prueba antes de promover ese mismo build. No hay integración Git automática; la asignación automática de dominios está desactivada durante la preparación.
- El arnés permite un `TEST_API_ORIGIN` explícito para probar el hostname canario con el Origin autorizado de Production. Es una adaptación exclusiva del test: no amplía la lista del servidor. Tras promover se prueba el dominio real sin esa adaptación.
- No se ejecuta `railway-preview.mjs`: detiene deliberadamente el servicio. La independencia de Cron ya fue comprobada en la fase anterior; ahora se consulta su estado y se ensaya inactividad con el servicio activo.

## Validaciones y comandos

```powershell
npm test
npm run build
npm run test:build
npm run test:deployment
npx playwright test --config playwright.arena.config.ts
node scripts/audit-release.mjs
git diff --check
```

Resultado local previo a publicar: 46 unitarias, 31 E2E, build y smoke compilado, dos pruebas de configuración correctos. Se repitieron unitarias/build/smoke/configuración desde un archivo Git limpio con instalación nueva: 153 paquetes, cero vulnerabilidades notificadas. La auditoría busca secretos locales y patrones de credenciales en todos los archivos candidatos; una comprobación adicional compara los secretos administrados de ingreso/sesión/worker sin imprimirlos. Los artefactos y estados de navegador no se versionan. El filtro anterior ignoraba fuentes `docs`, `tests`, pruebas de workspace y configuraciones Playwright; se corrige para que un checkout limpio pueda ejecutar las verificaciones.

La instalación limpia detectó conversión CRLF por la configuración Git de Windows: alteraba la huella documental sin cambiar ninguna carta. `.gitattributes` fija LF y las comprobaciones se repitieron correctamente; no se regeneró ni modificó el catálogo.

El hostname canario conserva Deployment Protection. El acceso autenticado de automatización se obtiene temporalmente, solo en memoria, y se revoca al finalizar. No se habilitan otros orígenes de la aplicación. Una prueba fallida por petición en curso al cerrar el navegador volcó cabeceras de una sesión QA y de ese acceso temporal en la salida de herramienta: se revocó el acceso, se corrigió la espera/cancelación de rutas y se suprimieron detalles privados de errores del arnés antes de repetirlo. No se expusieron claves SQL, clave de sesión ni datos de usuarios reales. El primer ensayo de Origin mediante navegación fue rechazado correctamente; el adaptador canario utiliza peticiones del arnés, mientras que la validación posterior a promover usa el navegador ordinario sin adaptador.

## Recuperación operativa

Si falla la promoción: volver al deployment Production previo mediante `vercel rollback <deployment>`, sin recrear Supabase ni ejecutar migraciones. Para Railway, redeploy de la imagen previa manteniendo claves y lista de orígenes. Preview conserva su URL y el mismo backend. No usar pruebas de apagado con usuarios conectados. No se contrata ningún plan ni se cambia visibilidad del repositorio.

## Resultado de la publicación

Juego público: **https://truco-online-beta.vercel.app**. Preview conservada: https://truco-online-o8iyhhp4o-ima-7bec.vercel.app. Backend existente: https://truco-arena-api-preview.up.railway.app. Los tres `/api/health` devuelven 200, Supabase conectado y CPU `ready`.

El deployment Vercel `dpl_5fQW9fVjvEChoHdoaBeBmQEyC2Mq` se creó con `--prod --skip-domain`, pasó ocho grupos canarios y se promovió sin reconstruir. Después pasó otros ocho grupos desde el dominio público, con Origin nativo y sin acceso especial de Vercel. Chrome y Edge en procesos separados también aprobaron navegación, colecciones, sala, privacidad y resultados/historial. Todos los accesos temporales de automatización fueron revocados; Deployment Protection se conserva. La URL canaria protegida no se confunde con la URL pública definitiva.

Aplicación desplegada desde `7393a1296b4a420dc73e25da4cbec50b74d2de68`, rama `master`, remoto `https://github.com/ImaMartinez/Truco-online.git`. Push normal realizado desde `9e264ca`, sin commits remotos pendientes ni force. Los commits agrupan historial SQL, aplicación/infraestructura, documentación y corrección LF. El commit final agrega solo arnés de verificación y evidencia/documentación; no cambia el runtime publicado. En total se incorporan/actualizan **169 archivos** frente al commit inicial, incluidos los que estaban ocultos por filtros demasiado amplios. `.env` reales, credenciales, estados de navegador, `node_modules`, compilados, metadatos cloud, temporales y artefactos quedan excluidos. El repositorio conserva su visibilidad y no tiene despliegue Git automático.

Railway: deployment `6f062181-3934-4aed-aa99-073c5d6297e3`, `SUCCESS`, una réplica persistente US West, Express y CPU juntos. La consulta SQL de solo lectura observó 16 tablas, 28 FK, RLS en las 16, 40 cartas y una conexión CPU con TLS. Ambos jobs Cron siguen activos. La partida QA 84 terminó por `INACTIVIDAD` en turno 5/versión 6 con navegadores cerrados. En esta entrega no se apagó ni reinició deliberadamente Railway; la prueba de independencia con backend detenido y recuperación tras reinicio permanece documentada en la fase anterior.

Las seis partidas completas de dificultad en canario/Production cubrieron `LIMITE_TURNOS` y `VIDA_CERO`. También pasaron perfiles y rotación de recuperación, cookies seguras y restauración, mazos persistentes, idempotencia/versiones, CPU sin ventana, salas, sincronización, privacidad, abandono, historiales y throttling 429. Sin errores de consola, filtraciones de mano rival ni respuestas 500 inesperadas en ambos recorridos completos. Solo se usaron perfiles QA nuevos; no se tocaron partidas de usuarios reales. El catálogo original y las rutinas SQL no cambiaron. Los puertos locales del juego estaban cerrados.

Variables administradas (solo nombres): Railway `API_PROXY_SECRET`, `APP_ORIGIN`, `APP_ORIGINS`, `ARENA_STORAGE`, `BIND_HOST`, `CPU_DB_HOST`, `CPU_DB_PASSWORD`, `CPU_DB_USER`, `NODE_ENV`, `PORT`, `SESSION_ENCRYPTION_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`. Vercel Production: `API_BACKEND_ORIGIN`, `API_PROXY_SECRET`. Se verificó que la clave de sesión conserva el valor previo y que los assets publicados no contienen los secretos administrados.

Railway informó HOBBY **en trial**, sin tarjeta ni suscripción paga activa: crédito restante USD **4,99086**, consumo registrado USD **0,00914**, 30 días restantes al inspeccionar. Muestra de una hora con pruebas: RAM media 110 MB (máxima 131 MB, límite ~1 GB), CPU media 0,0117 vCPU (máxima 0,0439, límite 2). La extrapolación mecánica de RAM/CPU a las tarifas publicadas da aproximadamente USD 1,33/mes solo de recursos: excluye red, crecimiento y mínimo de plan; no es una cotización. Hobby pago tiene mínimo USD 5/mes; no fue activado. El trial puede detenerse al agotar crédito o plazo. No hubo carga masiva ni se promete SLA o gratuidad permanente. [Tarifas consultadas](https://docs.railway.com/pricing/plans).

Resultados, IDs, métricas, parámetros de prueba y mediciones responsive en [evidencia final](15-evidencia-produccion.json). Capturas locales comparativas: [antes 1280×720](../../artifacts/arena-review/before/1280x720.png), [después 1280×720](../../artifacts/arena-review/after/1280x720.png), [antes 390×844](../../artifacts/arena-review/before/390x844.png), [después 390×844](../../artifacts/arena-review/after/390x844.png). Son artefactos locales excluidos de Git; las seis resoluciones están disponibles en las carpetas indicadas más arriba.

## Ampliación: identidad sin contadores duplicados

Pedido adicional del 12/11/2026: las dos tarjetas izquierdas muestran únicamente avatar, alias y, para el adversario, tipo `Computadora` o `Jugador online`. Se retiran mazo/mano/descartes y el bloque `TU MANO`; los datos del DTO siguen disponibles en los indicadores existentes. La columna izquierda tiene filas naturales para identidad y concede el espacio liberado a la bitácora. Las zonas de cartas y las reglas mantienen sus tamaños y comportamiento anteriores.

Archivos de producto: `PlayerPanel.tsx`, `Battlefield.tsx` y `battlefield.css`. Se mantienen el ancla de ataque en ambas manos, recursos sin scroll individual en desktop, acciones separadas de las vidas/energía y acceso móvil a los recursos junto a la mano, sin abrir la bitácora. Las estadísticas secundarias conservan su bloque compacto desplazable en móvil; en horizontal corto hay una sola región de recursos.

Validación local: 46 unitarias, 31 E2E, build, smoke compilado y dos comprobaciones de despliegue aprobadas. Las pruebas comprueban la ausencia de contadores izquierdos, preservación de valores derechos, identidad CPU/online, altura compacta y acceso móvil a cada recurso. Incluyen regresiones de ataques a cartas/héroes, animación, arrastre mouse/touch, turnos, resultados y reloj. Capturas antes/después inspeccionadas en los seis tamaños del pedido: `artifacts/arena-identity/before/` y `after/`.

El ensayo del bundle desplegado utiliza respuestas de presentación interceptadas exclusivamente en el navegador y un health real de solo lectura. No crea perfiles, mazos ni partidas en Supabase; bloquea escrituras y distingue esta prueba visual de la integración funcional completa de la publicación anterior. No se modifica backend, reglas, catálogo, SQL, variables ni Railway. La promoción del build de frontend se realiza después de verificar el canario.

Publicado el cuarto ajuste en https://truco-online-beta.vercel.app desde `f4b177d1adf10dd41b3d555510502d49feeb935c`: deployment `dpl_GXzVLxKCcREytBhNUhmrw2qeKgbE`, creado sin dominio y promovido tras aprobar seis tamaños canarios. Los seis tamaños se repitieron en Production, con bundle idéntico al build local, sin errores de consola ni escrituras remotas. Health 200/CPU ready en Production, Preview y backend; accesos temporales de Vercel revocados. La sonda se ajustó para utilizar Chrome instalado, sin instalar otro navegador. Evidencia específica en [identidad del tablero](16-evidencia-identidad-tablero.json). Rollback de frontend: `vercel rollback dpl_5fQW9fVjvEChoHdoaBeBmQEyC2Mq --scope ima-7bec`; no requiere cambios de base ni de Railway. Capturas de este ajuste: [antes desktop](../../artifacts/arena-identity/before/1366x768.png), [después desktop](../../artifacts/arena-identity/after/1366x768.png) y [móvil publicado](../../artifacts/arena-identity/production/390x844.png), disponibles localmente y excluidas de Git.

Ajuste puntual posterior: en móvil (vertical y horizontal corto) Mazo restante muestra solo etiquetas y cantidades; se oculta la pila decorativa, sin reservar espacio. Se conserva su geometría invisible para que el robo animado siga funcionando; el icono permanece en escritorio. Cuatro pruebas focalizadas aprobaron seis resoluciones, contadores, robo animado móvil, ataque al héroe y movimiento reducido; build TypeScript/Vite correcto. Se corrigió un desborde del ancla detectado en el primer ensayo, antes de publicar. Captura local: artifacts/arena-mobile-pile/after/390x844.png. Sin cambios de lógica, backend ni base.

El ajuste del icono móvil fue publicado después de probar seis tamaños canarios y repetirlos en Production, sin escrituras remotas. Build `dpl_3izgweF7iPXtVyeDUJokk8PMMYPu`, fuente `bfe57890b2de6754cfc1738b31df817777d5974c`; acceso temporal revocado. Captura publicada: artifacts/arena-identity/mobile-pile-production/390x844.png. Se conservan los números, la pila de escritorio y la animación de robo.

## Recomposición móvil de la partida

Pedido del 12/11/2026: se agruparon reglas responsive de teléfono en arenaMobile.css; header con estado/turno/modo y acciones secundarias en otra fila, área rival, combate, mano con altura reservada, resumen de cinco indicadores y acciones principales al final. En teléfono hay un único desplazamiento vertical de página cuando el contenido lo requiere: se priorizan cartas legibles y botones de 46 px; no hay carrusel horizontal de estadísticas ni scroll por tarjeta. Selección con elevación de 6 px, escala 1,04 y glow contenidos dentro de la mano, sin mover el resumen o los botones. La energía reserva su leyenda y los avisos reservan espacio para evitar saltos. Mazo/Mano/Descartes forman tres columnas; se retiró Por robar porque repetía el mismo deckCount. Se mantienen las identidades sin contadores, los iconos de mazo ocultos en móvil y el destino de ataques al héroe en las manos, no en HP.

Validación local: 46 unitarias, 32 E2E, build/smoke y dos comprobaciones de despliegue. Incluye CPU y Online, con/sin selección, primera/última carta seleccionada y campo parcialmente ocupado en 360×800, 375×812, 390×844 y 412×915; desktop con bitácora, ataque al héroe en ambas perspectivas, drag mouse/touch, turnos, resultados y robo. Capturas comparativas y mediciones: artifacts/arena-mobile-composition/before y after. Los tests detectaron un desborde de dos píxeles del ancla invisible del mazo y se corrigió antes de publicar. No se cambió el motor, el reglamento, las cartas ni SQL. La sonda remota usa fixtures de presentación y health de solo lectura; no equivale a repetir pruebas de Auth/SQL reales.
