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

Capturas reales comparativas locales, excluidas de Git: `artifacts/arena-review/before/` y `artifacts/arena-review/after/`, con nombres `1920x1080.png`, `1366x768.png`, `1280x720.png`, `390x844.png`, `844x390.png`, `360x740.png`. Mediciones en `measurements.json`. La captura `landscape-actions.png` muestra el acceso a los controles en horizontal. Se inspeccionaron visualmente las seis resoluciones, además de medir geometría; los escenarios son fixtures de presentación en memoria, no datos de Supabase.

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

Resultado local previo a publicar: 46 unitarias, build y smoke compilado, dos pruebas de configuración correctos. La auditoría busca secretos locales y patrones de credenciales en todos los archivos candidatos; una comprobación adicional compara los secretos administrados de ingreso/sesión/worker sin imprimirlos. Los artefactos y estados de navegador no se versionan. El filtro anterior ignoraba fuentes `docs`, `tests`, pruebas de workspace y configuraciones Playwright; se corrige para que un checkout limpio pueda ejecutar las verificaciones.

## Recuperación operativa

Si falla la promoción: volver al deployment Production previo mediante `vercel rollback <deployment>`, sin recrear Supabase ni ejecutar migraciones. Para Railway, redeploy de la imagen previa manteniendo claves y lista de orígenes. Preview conserva su URL y el mismo backend. No usar pruebas de apagado con usuarios conectados. No se contrata ningún plan ni se cambia visibilidad del repositorio.

La evidencia final de Git, despliegues, pruebas públicas y costos se agrega después de ejecutarlas; los pasos pendientes no se presentan como resultados.
