# Backend previsto

Node.js, Express y TypeScript, con API REST en el puerto 4000. Sin implementación ni dependencias en Etapa 0.

Organización prevista por módulos de jugadores, colección, mazos, partidas y estadísticas. Cada módulo separará rutas/controladores, servicio y repositorio cuando corresponda. La configuración, los pools y la traducción de errores de motor serán compartidos.

Se proponen `mysql2/promise` para MariaDB y `pg` para PostgreSQL. Los repositorios expondrán las mismas operaciones de dominio y tendrán SQL explícito por motor. No se utilizará un ORM ni un traductor automático de SQL.

Las operaciones críticas invocarán rutinas SQL y se ejecutarán con una única conexión y una única transacción por acción. La aplicación usará un rol limitado; el rol de instalación será independiente.

La selección del motor, las credenciales y TLS se configurarán exclusivamente mediante variables del backend. Los nombres definitivos y los archivos de ejemplo se definirán cuando existan conexiones comprobadas. Ver [arquitectura](../docs/etapa-0/04-arquitectura-y-sql.md).
