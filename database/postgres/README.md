# PostgreSQL / Supabase

El motor operativo está implementado para el proyecto TrucoOnline. Ver [arquitectura](../../docs/arquitectura.md), [despliegue](../../docs/despliegue.md) y [archivo técnico](../../docs/archivo/supabase/02-motor-postgresql.md).

Para instalar y revisar una base **nueva** con PostgreSQL 17: [SQL autocontenido y guía](install/LEEME.md). El modo local contiene compatibilidad SQL mínima de Auth, no un servicio de autenticación/JWT. El instalador no exporta datos reales ni credenciales de producción.

Los archivos de [migraciones](../../supabase/migrations/) y baseline-source.json se conservan como fuentes reproducibles. No volver a aplicar migraciones, db push/reset o el instalador completo sobre el proyecto publicado. Un dump MariaDB no es SQL PostgreSQL.

Las pruebas aisladas y sus efectos se explican en [pruebas](../../docs/pruebas.md). La revisión de limpieza del repositorio no ejecutó SQL ni modificó el modelo, tablas o estadísticas.
