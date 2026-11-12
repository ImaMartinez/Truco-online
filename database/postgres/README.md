# PostgreSQL — adaptación complementaria propuesta

Paquete completo para instalar y revisar la base en otra máquina: [SQL único](install/TrucoOnline-completo.sql) y [guía de instalación](install/LEEME.md). Incluye estructura inicial, catálogo y rutinas actuales; se probó en PostgreSQL 17 aislado. Es una instalación desde cero, no una actualización para el proyecto ya publicado. El modo PostgreSQL local incluye compatibilidad SQL de Auth, no un servicio de login.

Motor PostgreSQL implementado 11/11/2026 en TrucoOnline: [migración, permisos, pruebas, diferencias y límites](../../docs/supabase/02-motor-postgresql.md). Ejecución aislada: `npm run test:postgres`. Las rutas web remotas requieren Auth posterior; no ejecutar de nuevo la migración aplicada ni los scripts de diagramación.

Actualización 11/11/2026: el destino autorizado es **TrucoOnline (`gjcpcbrkdjymrwktshfr`)**. Las 15 tablas y 27 FK ya existen; no reinstalar estructura ni ejecutar los SQL de diagramación. Estado real, diferencias y fases en [auditoría Supabase](../../docs/supabase/00-auditoria-y-fases.md). El texto siguiente se conserva como antecedente; la migración funcional sigue pendiente.

Pendiente de aprobación docente y de comprobar la versión del servidor de destino. No se creó ni modificó un proyecto Supabase.

Se conservará el modelo lógico aprobado y se escribirán scripts PostgreSQL propios, datos equivalentes y pruebas de contrato compartidas con MariaDB. Un dump de MariaDB no es un script PostgreSQL.

El acceso será por el backend con `pg`, TLS y rol SQL limitado. Se preferirá un esquema de juego no expuesto por la Data API. Si se exponen objetos, habrá revisión explícita de permisos, RLS, vistas y funciones antes de publicar.

Referencia: [compatibilidad entre motores](../../docs/etapa-0/04-arquitectura-y-sql.md).
