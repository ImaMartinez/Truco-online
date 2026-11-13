# Pruebas reproducibles

Las pruebas fuente se conservan: eliminarlas por contener datos demo rompería la verificación del proyecto. Los resultados generados viven en `artifacts/`, `tmp/`, `test-results/` o `playwright-report/`, todos excluidos de Git.

## Verificaciones esenciales sin base remota

Desde la raíz con Node `>=24.16.0 <25`:

```powershell
npm install
npm run build
npm test
npm run test:build
npm run test:deployment
npm run test:e2e
npm run test:cards
npm run test:deployment:build
```

`npm install` en una copia limpia verifica la instalación solicitada. Para instalaciones repetibles con el lockfile se recomienda `npm ci`. El build comprueba catálogo, TypeScript y Vite; `npm test` ejecuta backend HTTP y frontend. `test:build` inicia artefactos compilados y verifica el proxy. `test:deployment` verifica Vercel, filtros de subida y contrato Docker. La última suite reconstruye workspaces por separado, poda dependencias y comprueba imports de producción y ausencia de un secreto canario en assets públicos; **no ejecuta Docker**.

Las E2E usan Chrome/Edge instalado o Chromium de Playwright (`npx playwright install chromium`). No requieren Supabase. Los fixtures visuales prueban interfaz; no se presentan como una nueva validación de Auth o SQL reales.

## Clasificación de tests

| Ruta | Uso y efecto |
|---|---|
| `backend/test/`, `frontend/test/` | Regresiones del código, contratos, seguridad HTTP y renderizado. Los tests SQL del backend se invocan explícitamente aparte. |
| `tests/e2e/`, `tests/card-art/`, `tests/combat-effects.ts` | Navegador y helpers visuales locales, con evidencia regenerable. |
| `tests/sql-e2e/` | API y MariaDB reales; genera registros de pruebas. |
| `tests/postgres/` | Motor, perfiles, CPU, salas y plazos en PostgreSQL aislado; también arneses HTTP/remotos manuales. |
| `tests/deployment/` | Configuración, builds, recorridos públicos y recuperación. Los arneses públicos crean perfiles QA; no ejecutarlos sin autorización. `railway-preview.mjs` incluye pruebas de interrupción y no pertenece a la suite esencial. |
| `tests/mariadb/` | Importación del SQL entregable en un proceso MariaDB efímero. |

`tests/postgres/schema-baseline.json` es una **fixture de entrada** de las suites PostgreSQL: contiene los datos del catálogo/esquema auditado, no un log de salida. Se conserva aunque su archivo anterior se llamara «evidencia».

## SQL y pruebas con efectos persistentes

Los comandos `db:install`, `db:audit`, `test:sql`, `test:e2e:sql`, `test:postgres*`, `test:profiles`, `test:cpu`, `test:online`, `test:deadlines` y los tests de instalación ejecutan SQL. Seguir sus guías y utilizar bases locales/aisladas. Algunos tests de MariaDB instalan triggers temporales para verificar rollback. **No forman parte de la ejecución de esta limpieza:** el titular prohibió migraciones y cambios de datos.

Los generadores con `--check` sí pueden compararse sin ejecutar SQL:

```powershell
node scripts/build-postgres-install.mjs --check
node scripts/build-xampp-install.mjs --check
npm run db:seed:check
```

## Instalación XAMPP

La [guía local](../README-INSTALACION-XAMPP.md) fue verificada el 13/11/2026 antes de esta limpieza con npm ci desde una copia sin dependencias/credenciales, MariaDB 10.4.32 aislada, instalación repetida, backend/Vite, Chrome real, inicio de CPU Fácil, recarga y 40 copias persistidas. Se verificó también el comando conjunto en 4000/5173. No se automatizaron los instaladores gráficos o el login GitHub. Ese ensayo histórico no se atribuye a esta revisión, que no ejecuta SQL.

## Modo en memoria

```powershell
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173`. Sin `ARENA_STORAGE` persistente, el backend usa `DemoRepository`: catálogo real, datos de demostración y partidas efímeras. Sus procesos se detienen con Ctrl+C. Para MariaDB usar `dev:sql`; para Supabase hacen falta configuración y autorización específicas. La demo en memoria permanece porque la utilizan los tests y es un modo explícito del producto.

## Resultado de esta revisión

Ver [auditoría final](revision-final/README.md) y su evidencia compacta. No publicar logs completos, estados de navegador, cookies, secretos o capturas de depuración. El [historial consolidado](historial-validaciones.md) conserva resultados anteriores con su alcance real.
