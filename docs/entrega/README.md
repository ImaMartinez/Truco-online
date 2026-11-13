# Material para la entrega académica

Este índice identifica los materiales existentes del Trabajo Práctico Integrador de Informática II. No declara aprobaciones del grupo o del docente que no estén registradas.

| Material | Fuente conservada |
|---|---|
| Descripción y reglamento | [Hito 1](../hito-1/README.md); catálogo original en [Etapa 0](../etapa-0/02-cartas-y-equilibrio.md). |
| MER conceptual editable | [Guía y límites](../diagramas/LEEME-MER-simple.md), [draw.io](../diagramas/TrucoOnline-MER-simple.drawio) y mapeo de relaciones en la misma carpeta. |
| MR, claves, atributos y normalización | [Modelo relacional](../hito-2/01-modelo-relacional-preliminar.md) y [auditoría de implementación](../hito-2/02-auditoria-implementacion.md). |
| SQL académico MariaDB | [Archivos 01–10](../../database/mariadb/README.md), consultas, vista y demostración transaccional. |
| SQL autocontenido para revisar MariaDB | [Instalador XAMPP y guía](../../database/mariadb/install/LEEME.md). Crea `truco_online_xampp`; para ejecutar la app usar el instalador `db:install`. |
| SQL PostgreSQL operativo | [Instalador PostgreSQL](../../database/postgres/install/LEEME.md) y [migraciones](../../supabase/migrations/). No ejecutar en una base existente ni como parte de una limpieza. |
| Datos y consultas académicas | [Hito 3](../hito-3/README.md), diez consultas y evidencia académica real conservada. |
| Informe y aplicación | [Estado del Hito 4](../hito-4/README.md), [arquitectura técnica](../arquitectura.md), [instalación](../../README-INSTALACION-XAMPP.md) y [pruebas](../pruebas.md). |
| Uso real de IA | [Bitácora](../bitacora-ia.md); conserva tareas, verificaciones, errores y límites, sin atribuir trabajo humano inexistente. |

**Pendiente detectado:** el informe académico final de 2–3 páginas y la ratificación humana del MER/MR/B1–B4 siguen señalados como pendientes en el material del grupo. Se conservan sus antecedentes y documentación técnica; no se inventa un informe aprobado ni autores/revisores. Antes de entregar, contrastar la consigna oficial con estos documentos, completar el informe y registrar las revisiones reales.

La implementación MariaDB permite reproducir el modo local sin servicios cloud. El PostgreSQL completo refleja la ampliación operativa de 16 tablas; no es intercambiable con el dialecto MariaDB. Las salas, Auth y worker persistente de la web pública no se reproducen importando solamente el SQL académico.
