# PostgreSQL — adaptación complementaria propuesta

Pendiente de aprobación docente y de comprobar la versión del servidor de destino. No se creó ni modificó un proyecto Supabase.

Se conservará el modelo lógico aprobado y se escribirán scripts PostgreSQL propios, datos equivalentes y pruebas de contrato compartidas con MariaDB. Un dump de MariaDB no es un script PostgreSQL.

El acceso será por el backend con `pg`, TLS y rol SQL limitado. Se preferirá un esquema de juego no expuesto por la Data API. Si se exponen objetos, habrá revisión explícita de permisos, RLS, vistas y funciones antes de publicar.

Referencia: [compatibilidad entre motores](../../docs/etapa-0/04-arquitectura-y-sql.md).
