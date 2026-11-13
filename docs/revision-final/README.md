# Limpieza del repositorio: revisión y publicación Git autorizada

13/11/2026. La limpieza se preparó y verificó primero en local, sin publicar. Tras recibir las listas, resultados y limitaciones, el titular autorizó el commit y push a GitHub. Esta actualización registra esa autorización antes de ejecutarla; el commit que la contiene identifica la entrega. No se modificaron reglas, estadísticas, contratos de aplicación, tablas o datos del Supabase publicado.

## Listas completas

- [114 archivos propuestos para eliminar, con motivo](eliminar.txt).
- [Archivos que se conservarán y su función](conservar.txt).
- [Manifiesto estructurado: rutas, movimientos, hashes originales y motivos](manifest.json).
- [Resultados compactos de verificación](resultados.json).

Las eliminaciones se aplicaron solo en local para poder ejecutar los tests del estado propuesto. Una copia de los **458 archivos fuente originales**, incluidos cambios locales previos, está en `tmp/cleanup-review-original-20261113`, ignorada por Git. No contiene dependencias instaladas, archivos privados .env ni datos de bases. Los archivos ya versionados también son recuperables desde el commit `a4143e5a389b7d69d26b560b6557ffec24dc7d65`.

## Qué se retira y por qué

| Grupo | Decisión y comprobación |
|---|---|
| 80 copias de cartas en `truco_arena_sprites/cards/` | Idénticas SHA-256 a `frontend/public/cards/v3/`. Se conserva una sola fuente de imágenes y se ajusta la regresión a 80 hashes fijados; no se debilita a comprobar solo existencia. |
| Dos atlas y dos vistas de control | No los importan frontend/backend ni las suites. La interfaz usa archivos individuales; las pruebas confirman códigos, dimensiones, fallback y renderizado. |
| CSS de ejemplo y prompt de sprites | Instrucciones de integración ya completadas; procedencia y asistencia IA permanecen documentadas. |
| `infrastructure/vercel-bootstrap/` | Página provisoria del primer despliegue, sin consumidores del build/configuración actual. Se conserva `infrastructure/vercel-config.mjs`. |
| READMEs demo, validación y planes iniciales repetidos | Se consolidan en README principal, instalación, arquitectura y pruebas. Los materiales académicos sustantivos no se eliminan. |
| Salidas QA JSON e informes de depuración repetidos | No son entradas de build/tests. Se sustituyen por historial con alcance y fechas, conservando suites regenerables. |

**Excepciones importantes conservadas:** la fuente documental del catálogo participa en `catalog:check`; la antigua evidencia de esquema es una fixture usada por PostgreSQL y se mueve a `tests/postgres/schema-baseline.json`; la evidencia de Hito 3 se conserva por su finalidad académica. No se usa el nombre «demo», «QA» o «técnico» como único criterio para borrar.

## Qué se conserva o reubica

- Todo `backend/src/`, `frontend/src/`, `shared/`, 80 assets finales, favicon y certificado CA público.
- Todas las suites fuente, scripts npm/generadores/instaladores, SQL académico, fuentes PostgreSQL y migraciones. Las rutas de la fixture PostgreSQL se actualizan en sus dos consumidores sin cambiar su contenido.
- Dockerfile, filtros de contexto, configuración Vercel, manifiestos/lockfile y templates de entorno.
- MER editable, MR/diccionario, reglas, consultas, evidencia académica, materiales de los hitos y bitácora real de IA.
- Las decisiones de fases Supabase pasan a `docs/archivo/supabase/`; no se pierde su contenido técnico. El contrato MariaDB se agrupa en `docs/tecnica/mariadb.md`.
- Los directorios locales ignorados (`tmp`, `artifacts`, `.env`, bases XAMPP, metadatos de sesión) no se vacían: se mantienen fuera del contenido Git/distribuible.

## Estructura final propuesta

```text
README.md                         Entrada al proyecto, tecnologías y ejecución
backend/                          API, motores/adaptadores, CPU, CA y tests
frontend/                         UI, assets canónicos y tests
shared/                           Contratos y reglas compartidas
truco_arena_sprites/               Manifiesto, hashes y procedencia (sin imágenes duplicadas)
database/
  mariadb/                        SQL académico, consultas e instalador autocontenido
  postgres/                       Instalador, fuentes y guía PostgreSQL
supabase/migrations/               Historial SQL operativo intacto
infrastructure/vercel-config.mjs   Rewrite y configuración Vercel vigente
scripts/                          Instalación, generación y auditoría
tests/                            Regresiones locales, SQL, navegador y despliegue
docs/
  README.md                       Índice único
  arquitectura.md                 Arquitectura y seguridad actuales
  despliegue.md                   Configuración y límites operativos
  pruebas.md                      Suites, comandos y efectos
  historial-validaciones.md        Resumen real de evidencias anteriores
  bitacora-ia.md                   Registro real de asistencia
  entrega/                        Índice académico y pendientes
  diagramas/, etapa-0/, hito-*/     Material académico conservado
  tecnica/                        Contratos de persistencia
  archivo/supabase/                Decisiones técnicas históricas
  revision-final/                 Esta propuesta y sus listas
Dockerfile, vercel.ts              Entradas de despliegue
.gitignore, .dockerignore,
.vercelignore, .gitattributes      Exclusión y reproducibilidad
package*.json, playwright*.ts      Workspaces, lockfile y tests
```

## Pruebas ejecutadas sobre una copia limpia

| Verificación | Resultado |
|---|---|
| `npm install` sin node_modules ni secretos | Correcto, 153 paquetes instalados; auditoría npm: 0 vulnerabilidades. Lockfile semánticamente idéntico; npm solo normalizó serialización en la copia temporal. |
| `npm run build` | Backend TypeScript y frontend Vite correctos, catálogo original validado. |
| `npm test` | **47 aprobadas**: 24 backend y 23 frontend. |
| `npm run test:build` | Smoke del build correcto. |
| `npm run test:deployment` | **2 aprobadas**: rewrite/seguridad Vercel y filtros/Dockerfile. |
| `npm run test:e2e` | **41 aprobadas**, sin SQL ni servicios remotos. |
| `npm run test:cards` | **5 aprobadas**: 40 imágenes cargadas, layout, móvil, fallback PNG y corrección ORO-05. |
| `npm run test:deployment:build` | Backend limpio con build/poda/imports y frontend aislado con secreto canario ausente. |
| Contratos/sprites/enlaces/secretos/fuentes SQL | Detalle en `resultados.json`, generado al cerrar la auditoría. |
| `docker build` | **Pendiente: Docker/Podman y daemon no disponibles en este equipo.** No se declara construido el contenedor. |

La corrida final se realizó **fuera del checkout**, sin posibilidad de resolver dependencias desde el node_modules del proyecto original. Se utilizaron servidores exclusivos (CI=1). El JavaScript y CSS de producción resultantes coinciden byte por byte con el build anterior: la depuración de archivos no cambia el bundle del juego.

Se corrigieron dos incidencias del arnés: un NODE_ENV=development aplicado indebidamente al build, y la reutilización de servidores de otra corrida E2E que se cerraron durante la verificación adicional. Tras retirar ese override y exigir exclusividad, se repitieron las verificaciones y todas aprobaron. Los fallos del arnés no se ocultan como éxitos del producto.

Logs completos en `artifacts/cleanup-review/`, ignorados. No se ejecutaron tests que instalen migraciones, scripts SQL, pruebas públicas o reinicios Railway. La auditoría estática no sustituye esas pruebas.

## Riesgos y pendientes conservados

1. **Contenedor real:** ejecutar `docker build -f Dockerfile -t trucoonline-review .` en un equipo/CI con Docker. Pasaron los mismos pasos de workspace y poda, pero falta la comprobación Linux/container.
2. **Informe académico final:** Hito 4 aún indica pendiente el informe de 2–3 páginas. No hay un informe humano aprobado que pueda conservarse como terminado; se mantiene el material técnico y el índice académico.
3. **Revisión docente:** B1–B4, MER/MR y criterios de la consigna deben ratificarse por el equipo. No se presentó la consigna oficial completa en esta auditoría; no se inventa cumplimiento académico.
4. **Modos no equivalentes:** SQL académico/MariaDB reproduce el modo local, no Auth/salas/Cron de Supabase. La configuración de proveedores y sus secretos sigue siendo externa y privada.
5. **Pruebas SQL no repetidas:** por la prohibición de migraciones/datos se revisaron fuentes, consumidores y hashes. Las verificaciones SQL previas se conservan como históricas, no como nuevas ejecuciones.
6. **Historial Git:** eliminar una copia del working tree no reduce el historial de descargas ya existente. No se reescribe Git ni se hace force-push para compactarlo.
7. **Higiene local:** los `.env` y metadatos existentes quedan privados e intactos; sus nombres nunca deben añadirse con `git add -f`. `.gitignore` ahora es una lista clara sin excepciones contradictorias.

La revisión inicial no incluyó commit ni push. El titular autorizó posteriormente publicar estos cambios en GitHub, conservando la limitación explícita de Docker. Se verificó que Vercel no tiene enlace Git y que el servicio Railway no tiene repositorio fuente vinculado; publicar en Git no requiere desplegar los servicios. La autorización no incluye despliegues, migraciones o cambios de datos.

## Consolidación posterior del README

13/11/2026: el titular pidió una única entrada en la raíz. La guía XAMPP se integró completa en README.md y se retiró su archivo separado, actualizando enlaces. Las listas de esta revisión describen la instantánea de limpieza publicada en f5b41fb; el inventario vigente se obtiene con scripts/repository-audit.mjs. No se modificó el juego ni se repitieron pruebas de gameplay para este ajuste documental.
