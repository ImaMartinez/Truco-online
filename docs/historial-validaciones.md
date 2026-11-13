# Historial consolidado de validaciones

Este documento reemplaza salidas QA repetidas, no crea nuevas pruebas ni altera la bitácora. Los comandos y suites fuente están en [pruebas](pruebas.md). La evidencia académica de Hito 3 y la fixture de entrada de esquema PostgreSQL se conservan separadamente por su uso real.

## Hechos verificados anteriores a la limpieza

- Desarrollo MariaDB: motor académico de 13 tablas, catálogo original, rutinas transaccionales y suites de combate/rollback/concurrencia, documentados en Hito 3 y la bitácora.
- Fases Supabase: motor, perfiles y recuperación, CPU, salas y reloj/inactividad. Las decisiones detalladas se conservan en archivo/supabase; los tests SQL/HTTP siguen disponibles y no se ejecutaron durante esta limpieza.
- Publicación del 12/11/2026: aplicación c1974328c0d3495e97e270dce22ed84438ff419f, frontend Vercel dpl_5pXVHSWb11LxvC7azCEL691HAsX8 y backend Railway 696f040b-01c3-4ad1-bd11-ac9b5372f278. Pasaron seis grupos públicos canarios y seis de Production, con Chrome/Edge, perfiles QA nuevos, cierre/sustitución CPU-online y popup estable. Es evidencia histórica, no una comprobación de estado actual de proveedores.
- Entrega de base PostgreSQL: 14 grupos sobre PostgreSQL 17 aislado, con límites de Auth/pg_cron explícitos en la guía del instalador. SQL y fuentes intactos; no se reutiliza una salida QA como migración.
- Entrega de base XAMPP: 13 grupos sobre MariaDB 10.4.32, importación real CLI y prueba de persistencia; no paridad con Auth/salas de Supabase.
- Guía local del 13/11/2026: instalación sin dependencias/secretos, db:install repetido, Chrome real, CPU Fácil, recarga y 40 copias; también dev:sql en 4000/5173. No se automatizó el login de GitHub ni los instaladores gráficos.

La [bitácora de IA](bitacora-ia.md) conserva números y alcance de cada intervención. El [archivo técnico](README.md#archivo-técnico) contiene las limitaciones originales de las fases. No se atribuyen aprobaciones humanas ni se presentan fixtures visuales como SQL/Auth reales.

## Salidas retiradas de la versión final

Los siguientes archivos eran resultados históricos, no entradas de compilación/ejecución. Las versiones antes de la limpieza son recuperables del historial Git y de la copia local de revisión (para archivos aún no versionados); sus hashes y la lista completa figuran en el manifiesto de revisión.

| Archivo anterior | Fecha declarada |
|---|---|
| database/postgres/install/RESULTADOS.json | 2026-11-12T22:48:32.544Z |
| docs/supabase/03-evidencia-motor-remoto.json | 2026-11-11 |
| docs/supabase/05-evidencia-perfiles.json | 2026-11-11 |
| docs/supabase/07-evidencia-cpu.json | 2026-11-11T16:31:27.918Z |
| docs/supabase/09-evidencia-online.json | 2026-11-11T17:14:54.832Z |
| docs/supabase/11-evidencia-temporizador.json | 2026-11-11T20:37:18.541Z |
| docs/supabase/13-evidencia-publicacion.json | 2026-11-11T22:28:52.986Z |
| docs/supabase/15-evidencia-produccion.json | 2026-11-12T03:25:00.314Z |
| docs/supabase/16-evidencia-identidad-tablero.json | 2026-11-12T03:38:46.807Z |
| docs/supabase/17-evidencia-composicion-mobile.json | 2026-11-12T13:36:33.831Z |
| docs/supabase/20-evidencia-cierre-local.json | 2026-11-12T22:15:29.437Z |
| docs/supabase/22-evidencia-avisos-local.json | 2026-11-12T22:26:46.089Z |
| docs/supabase/24-evidencia-publicacion-cierre.json | 2026-11-12T22:59:01.448Z |
| database/mariadb/install/Resultados-pruebas.json | 2026-11-13T14:47:43.405Z |
| docs/instalacion-local-xampp-evidencia.json | 2026-11-13T14:58:31.064Z |

Los logs/capturas locales de artifacts y tmp ya estaban ignorados: no se borraron credenciales ni bases del equipo. Solo se excluyen del contenido distribuible; las herramientas generan nueva evidencia cuando se ejecutan con autorización.

## Revisión actual

El resultado de la limpieza se informa en [revisión final](revision-final/README.md). Es una ejecución distinta; no sustituye la ratificación académica del MER/MR ni el informe pendiente.
