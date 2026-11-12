# Entorno inspeccionado y fuentes

Inspección: **02/11/2026**, contexto del usuario America/Buenos_Aires. Operaciones de solo lectura sobre el entorno y el servidor existente; no se creó una base ni se modificó configuración.

## Repositorio

Carpeta de trabajo: `C:\Users\Imaam\OneDrive\Documentos\ChatGPT\Truco online`.

Al comenzar contenía únicamente `.git`. `rg --files --hidden` excluyendo `.git` no encontró archivos de proyecto. Git informó rama `master` sin commits. No había código, dependencias, esquema ni modelo aprobado que preservar. No se encontraron archivos AGENTS.md adicionales en la carpeta ni en los directorios antecesores comprobados; se siguió la instrucción aportada de leer `C:\Users\Imaam\.codex\RTK.md`.

El adjunto del usuario fue leído como especificación. No se copió a un entregable académico para evitar confundir el pedido con una entrega revisada.

## Versiones y conexión

| Elemento | Comprobación | Resultado observado |
|---|---|---|
| Node | `node --version` | v24.16.0 |
| npm | `npm --version` | 11.13.0 |
| Binario servidor XAMPP | `C:\xampp\mysql\bin\mysqld.exe --version` | 10.4.32-MariaDB, Win64 |
| Cliente XAMPP | `C:\xampp\mysql\bin\mysql.exe --version` | Cliente 15.1, distribución 10.4.32-MariaDB |
| Servidor real | `SELECT VERSION(), @@version_comment, @@sql_mode` por cliente local | 10.4.32-MariaDB; mariadb.org binary distribution |
| Motores | `SHOW ENGINES` | InnoDB DEFAULT; transacciones, XA y savepoints disponibles |
| Modo SQL observado | Variable del servidor/conexión de inspección | NO_ZERO_IN_DATE, NO_ZERO_DATE, NO_ENGINE_SUBSTITUTION |
| PostgreSQL/psql | Búsqueda de comando disponible | psql no encontrado en PATH; no prueba que no exista en otro lugar |
| PostgreSQL remoto | Sin conexión a proyecto | Versión, permisos y paridad no comprobados |
| React/Vite/Express/mysql2/pg | Repositorio sin package.json ni node_modules | No instalados en este proyecto; versiones aún no seleccionadas |
| phpMyAdmin | No se abrió su interfaz | Disponibilidad/versión no comprobadas |

La conexión local de inspección utilizó la cuenta administrativa disponible de XAMPP, sin escribir credenciales en archivos ni leer datos de otras bases. Esto no propone reutilizar esa cuenta para la aplicación.

El modo observado no incluye STRICT_TRANS_TABLES ni ONLY_FULL_GROUP_BY. En el Hito 3 se definirá y verificará el modo de **las sesiones de aplicación** (incluido modo estricto), con restricciones explícitas; no se alteró el modo global del servidor. También se deberá comprobar que no estén desactivados los controles CHECK/FK en las sesiones de instalación/pruebas.

Se comprobó que MariaDB tiene InnoDB y una versión que contempla los mecanismos necesarios como base de trabajo. La compatibilidad de scripts, triggers y controladores solo podrá afirmarse después de implementarlos y ejecutarlos contra esta versión. No se hicieron DDL de ensayo en Etapa 0.

Node 24.16.0 satisface el requisito de Node publicado por Vite consultado (20.19+/22.12+ en las ramas indicadas). Esto no equivale a haber probado una instalación React/Vite; las versiones se fijarán con lockfiles al comenzar el código y se volverán a contrastar sus requisitos.

## Fuentes primarias consultadas

Se consultó documentación oficial y Context7 sobre las fuentes de mysql2, pg y Vite. Las fuentes describen capacidades; no sustituyen pruebas en las versiones del proyecto.

| Fuente | Decisión que ayuda a fundamentar |
|---|---|
| [MariaDB: constraints](https://mariadb.com/docs/server/reference/sql-statements/data-definition/constraint) | PK, FK, UNIQUE, CHECK y su combinación con rutinas |
| [MariaDB: FOR UPDATE](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update) | Lecturas bloqueantes dentro de una transacción InnoDB |
| [MariaDB: commits implícitos](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit) | Separar DDL de demostraciones de ROLLBACK |
| [PostgreSQL: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) | CHECK no debe validar datos de otras filas/tablas |
| [mysql2: documentación](https://sidorares.github.io/node-mysql2/docs) | Promesas, pool y execute con parámetros |
| [pg: transacciones](https://node-postgres.com/features/transactions) | BEGIN/COMMIT/ROLLBACK con el mismo cliente, no pool.query entre sentencias |
| [Vite: guía](https://vite.dev/guide/) | Requisito de Node que debe contrastarse al instalar |
| [Vite: entorno](https://vite.dev/guide/env-and-mode) | Variables VITE_ expuestas en cliente |
| [Supabase: conexión PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres) | Elegir conexión/pooler según red y duración del backend |
| [Supabase: seguridad Data API](https://supabase.com/docs/guides/api/securing-your-api) | Diferenciar permisos de objeto y políticas de filas; controlar esquemas |
| [Supabase: changelog](https://supabase.com/changelog) | Revisar cambios antes de implementar la adaptación |

Se leyó el índice de cambios de Supabase (`changelog.md`) y se siguieron los avisos recientes de [actualización PostgreSQL](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) y [cifrados TLS HTTP](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). El plan no utiliza las extensiones/operadores afectados por el primer aviso; el segundo excluye conexiones directas PostgreSQL/pooler. No se deduce de esos avisos una versión instalada en un proyecto del usuario. Revisar nuevamente al implementar.

## Límite de lo verificado

La ejecución exitosa de SELECT y SHOW ENGINES acredita versión y disponibilidad de conexión, no reglas del juego, CHECK propios, permisos de aplicación, rollback de negocio ni equivalencia entre motores. No se instaló software, conectó una cuenta Supabase, inició un servidor nuevo, realizó un commit ni publicó contenido.

## Verificación documental ejecutada

Se ejecutó una comprobación PowerShell sobre los archivos generados, con estos resultados observados:

- 40 filas de cartas con 40 códigos únicos; diez números válidos por cada uno de los cuatro palos.
- Jerarquías contrastadas con las excepciones de anchos y sietes y con el resto del orden solicitado.
- Ataque/vida positivos y costos 1–5; las 40 filas cumplen el presupuesto propuesto.
- Distribución por costo comprobada: 8, 14, 10, 6 y 2 cartas, respectivamente.
- Ambos mazos de referencia contienen seis tipos existentes por dos copias: 12 cartas, costo total 26 y promedio 2,1666…
- Cálculo de la mano sin cartas de costo 1: 56/220 = 25,4545… %.
- Todos los enlaces Markdown locales resuelven a archivos existentes en los 17 documentos creados.
- Inventario final: 17 archivos Markdown y .gitignore; sin archivos SQL, código de aplicación ni dependencias. Git conserva todos los archivos nuevos sin commit.

Estas comprobaciones verifican consistencia documental. No prueban balance de juego ni ejecución de las reglas propuestas. El test de enlaces comprueba destinos locales, no disponibilidad futura de URLs externas.
