# MariaDB — implementación académica principal

Destino: MariaDB 10.4.32 de XAMPP, InnoDB. Implementación provisional en `truco_arena_dev`; B1–B4 siguen pendientes, sin aprobación de Hito 3.

Orden: `01-schema.sql` (13 tablas), `02-routines.sql` (rutinas y triggers), `03-seed.sql` (40 cartas y perfiles/mazos de desarrollo), `04-combat.sql` (invocación, daño simultáneo, descarte y victoria). `npm run db:install` aplica los archivos y configura SELECT + EXECUTE de las seis rutinas públicas con credencial local ignorada por Git. No borra bases ni registros existentes ni cambia las 65 columnas del esquema.

Instalación, contratos, pruebas reales, límites y diferencias con el MR en [README-PERSISTENCIA](../../docs/tecnica/mariadb.md). El DDL se instala separado de las pruebas DML/rollback.

Referencia: [arquitectura e integridad](../../docs/etapa-0/04-arquitectura-y-sql.md).
