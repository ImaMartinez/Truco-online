# Entrega de SQL completo para integrantes

12/11/2026. Pedido: entregar un archivo completo para que un compañero instale y revise la base en su máquina; el titular confirmó que no necesita ejecutar la web completa.

- SQL autocontenido: `database/postgres/install/TrucoOnline-completo.sql`.
- Guía y consultas: `LEEME.md`, `Verificar-instalacion.sql` en esa carpeta.
- Fuentes de estructura: las tres migraciones iniciales recuperadas mediante consulta de solo lectura del historial autorizado de TrucoOnline. Se preservan en `baseline-source.json`; no se consultó el aprovisionamiento de contraseña CPU.
- Funcionalidad: siete migraciones locales del motor/perfiles/CPU/salas/plazos más el SQL Cron original dentro de una condición de disponibilidad. No se cambian esos archivos históricos ni sus reglas.
- Catálogo: las 40 cartas originales de `backend/src/demo/catalog.json`, comparadas con la evidencia de origen.
- Generación reproducible: `node scripts/build-postgres-install.mjs`; comprobación `--check`. `fuentes.json` registra huellas de las secciones y del artefacto.

El destino predeterminado es una instancia PostgreSQL 17+ de desarrollo, base nueva `truco_arena_local`. Una guarda rechaza instalación existente y roles TrucoOnline compartidos; no se eliminan tablas, bases, esquemas ni datos existentes. Las sustituciones de CHECK y funciones históricas se realizan exclusivamente dentro de la instalación nueva. La transacción global incluye la estructura, seed y permisos. La prueba introduce una división por cero justo antes de la verificación final y comprueba rollback de tablas, esquema Auth local y roles, antes de probar una instalación correcta.

Se crea una compatibilidad mínima `auth.users/auth.uid()` solo en modo PostgreSQL local. No valida JWT ni implementa Supabase Auth. El modo opcional `supabase-new` exige Auth nativo preexistente y no lo sustituye; no se ha certificado aquí un nuevo stack completo Supabase. `ta_cpu_node` se entrega bloqueado, sin contraseña y con rol limitado. No se exportan usuarios, sesiones, partidas ni secretos del sistema publicado.

Validación efectiva: `node --import tsx tests/postgres/install.mjs`, **14 grupos aprobados** sobre PostgreSQL 17 real y efímero. Instalación/rollback/reinstalación; consultas entregadas; 16 tablas con RLS/28 FK/40 cartas exactas; perfiles SQL y recuperación; aislamiento de mazos; CPU Fácil/Normal/Difícil con el worker/política originales y mazos 12/20; salas, privacidad, invocación, turno ajeno, reintento concurrente; inactividad mediante tick manual con rol temporizador; permisos de lectura/DML; estado persistente tras reiniciar PostgreSQL. Los datos de pruebas viven exclusivamente en esa instancia efímera, fuera del SQL distribuido.

Limitaciones verificables: pg_cron no está disponible en el servidor de pruebas embebido; su rama se omite con aviso y no se afirma haber probado nuevos jobs automáticos. Los plazos se probaron invocando ticks de servidor manualmente. Tampoco se probó un servicio Auth/JWT real en esta entrega. El SQL por sí solo no instala Express, React, el proceso worker ni Supabase Auth; no son necesarios para la inspección de la base solicitada.

Paquete para compartir: `artifacts/entrega-sql/TrucoOnline-base-de-datos.zip`, con SQL, guía, consultas, manifiesto de fuentes, resultados de pruebas y sumas SHA-256; artefactos excluidos de Git. No se reejecutaron migraciones, no se hicieron escrituras remotas y no se desplegaron servicios. Las verificaciones y aprobaciones académicas B1–B4 no cambian.
