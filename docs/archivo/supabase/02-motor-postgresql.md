# Motor PostgreSQL — fase de implementación

> Archivo histórico de desarrollo. Para el estado vigente ver [arquitectura](../../arquitectura.md) y [despliegue](../../despliegue.md). Los JSON/capturas QA mencionados se consolidaron en el [historial de validaciones](../../historial-validaciones.md); las afirmaciones de esta fase conservan su fecha y alcance.

Destino exclusivo: TrucoOnline `gjcpcbrkdjymrwktshfr`. Este documento registra el impacto **antes** de aplicar la migración remota. No sustituye MER/MR ni aprueba B1–B4.

## Impacto y recuperación

Migración incremental: `supabase/migrations/20261111145947_arena_engine_v1.sql`, creada mediante CLI 3.1.0 `migration new`. No crea tablas, no toca catálogo ni registros, no instala Auth/salas/timers. Las 15 tablas existentes son requisito. `jugador_auth` y `sala` siguen reservadas para fases posteriores.

Agrega funciones privadas, rol propietario NOLOGIN/NOBYPASSRLS `ta_engine_owner`, rol servidor NOLOGIN `ta_engine_server`, políticas internas solo para propietario, permisos de secuencias, triggers de historial/subtipos, índice parcial de turno abierto y reemplaza el CHECK de turno para rechazar NULL al cerrarse. El CHECK de partida ya exige motivo; el defecto auditado estaba en turno, no se altera el CHECK de partida innecesariamente.

Se prueba primero contra PostgreSQL 17.6 real aislado, con las 15 tablas reconstruidas desde los metadatos auditados (incluidos tamaños de columnas), catálogo idéntico y stub local de `auth.users`. **Ese bootstrap solo vive en tests**, nunca se aplica a Supabase.

Aplicación remota transaccional: comprobar proyecto, conteo de datos y migraciones inmediatamente antes. Si falla, rollback del DDL de esta migración; no tocar las tres migraciones anteriores. No ejecutar `db push/reset` sobre el proyecto con un historial local incompleto. La migración se registra mediante MCP del proyecto definitivo tras pruebas.

Recuperación posterior: cerrar acceso del rol servidor y dejar de invocar el motor nuevo; la web MariaDB permanece sin cambios. No borrar tablas ni historial para revertir. Si se necesita reemplazar funciones, conservar firmas/estado y aplicar corrección incremental tras reproducir fallo. No deshacer el CHECK a su versión defectuosa. Obtener backup operativo antes de cualquier futura migración con datos; esta entrega no presume que el backup automático esté habilitado.

## Frontera de seguridad

Ningún permiso de tablas ni ejecución para navegador anon/authenticated. El runtime solo puede ejecutar seis entradas; no SELECT ni DML de tablas. Funciones SECURITY DEFINER con propietario dedicado no superusuario, RLS explícita para ese propietario, search_path fijo sin public ni pg_temp y autorización explícita por contexto servidor. Helpers no concedidos. No se crean credenciales LOGIN ni claves frontend.

`SET LOCAL ta.player_id` es **contexto de confianza del futuro BFF**, no autenticación implementada. Solo un backend que haya validado identidad podrá usar el rol servidor. No montar estas funciones en una RPC pública que acepte libremente el actor. El alta queda reservada al servidor; vincular Auth se implementará después. El inicio recibe rival/mazos por coordinación servidor, no como autorización del cliente. No se anuncia seguridad de usuarios online antes de implementar Auth.

`ta_estado_privado` exige participante, devuelve mano propia y contador rival, campos/descartes/historial público; nunca incluye cartas por robar ni orden del mazo. Vista específica nueva, deliberadamente distinta del DTO local que mostraba ambas manos. No rompe demo ni API MariaDB.

## Reglas y diferencias justificadas

- Mantiene 12 y 20 cartas, cantidades 1–2 y colección. Formato 12 genera 24 copias; formato 20 genera 40. No retrocede las ampliaciones vigentes a solo 12.
- Inicio sortea posiciones como MariaDB; sin implementación ONLINE en esta fase. Modalidad PC/NORMAL como valor técnico del corte; elección de dificultad y CPU servidor pendientes.
- Tres cartas iniciales, sin robo en los dos primeros globales; energía min(5, floor((global+1)/2)); robo único si quedan cartas; mazo vacío no genera derrota/fatiga.
- Preparación hasta siguiente turno propio, máximo tres en campo, un ataque por carta/turno. Daño simultáneo con vidas previas; héroe no contraataca y requiere campo rival vacío.
- Vida cero cierra inmediatamente, incluso global 30. Al finalizar global 30 compara vidas y permite empate; no abre 31.
- UUID de solicitud y huella SHA256 calculada dentro de SQL; advisory lock transaccional por clave antes de existir partida; partida como mutex para comandos y snapshot; lectura autorizada antes del replay. VersionResult identifica comando original, snapshot consulta estado actual.
- Funciones sin COMMIT interno: excepción revierte sentencia; adaptador servidor hace BEGIN/COMMIT/ROLLBACK en una conexión. Reintentos de deadlock/serialización conservan UUID.
- Totalidad y disyunción de subtipos con constraint triggers diferibles al commit (más fuerte que el camino de escritura MariaDB). Eventos/recibos inmutables. No se borra historial al archivar mazos.
- Reinicio PC atómico opcional en inicio; replay no cierra la nueva partida. Reinicio ONLINE rechazado; abandono futuro.

## Ejecución y evidencias

Los resultados efectivamente obtenidos y limitaciones se completan al terminar las pruebas. Instalación aislada: `npm run test:postgres`. No usar credenciales MariaDB ni importar scripts de diagramación. Las pruebas levantan un cluster temporal en loopback/puerto libre y lo detienen sin borrar directorios ajenos.

Documentación verificada: [funciones y privilegios PostgreSQL 17](https://www.postgresql.org/docs/17/sql-createfunction.html), [transacciones PL/pgSQL](https://www.postgresql.org/docs/17/plpgsql-transactions.html), [locks](https://www.postgresql.org/docs/17/explicit-locking.html), [changelog Supabase](https://supabase.com/changelog). Sin migración automática de SDK o despliegue.

## Resultado real — 11/11/2026

**Motor aplicado y probado en TrucoOnline, PostgreSQL 17.11.** Se mantienen 15 tablas, 27 FK y 40 cartas; no quedaron jugadores/partidas de prueba. Funciones instaladas: ta_contexto, ta_crear_jugador, ta_validar_mazo, ta_guardar_mazo, ta_eliminar_mazo, ta_iniciar_partida, ta_actuar, ta_estado_privado, ta_evento_inmutable y ta_subtipo_total. Solo seis entradas tienen EXECUTE para el rol servidor; helpers/triggers no.

El primer intento remoto falló por la restricción de SET ROLE del administrador gestionado y se revirtió por completo (0 funciones/roles/partidas verificado). Se corrigió con membresía temporal y CREATE temporal para transferir propiedad, retirados al finalizar. Metadatos remotos conservan dos membresías ADMIN del creador postgres, ambas **INHERIT=false y SET=false**; no son acceso de navegador ni membresía ejecutable del runtime. El propietario no es superusuario ni tiene BYPASSRLS.

Registro MCP aplicado: **20261111150834_arena_engine_v1**. Corresponde al archivo local **20261111145947_arena_engine_v1.sql**; MCP asignó su timestamp al aplicar. No son dos migraciones distintas y **no se debe volver a aplicar el archivo local con db push**. Antes de usar CLI como migrador hay que importar/reconciliar el historial remoto completo, incluidas las tres migraciones iniciales; no marcar nada aplicado sin comparar contenido.

Pruebas efectivamente ejecutadas:

| Prueba | Resultado |
|---|---|
| `npm run test:postgres` | 14 grupos aprobados en PostgreSQL 17.6 real aislado: mazos 12/20, 24/40 copias, reparto, privacidad, invocaciones, daño simultáneo, doble descarte, rechazo de héroe protegido/preparación/ataque repetido, energía/campo/turno, victoria letal, empate 30, replay, rollback, concurrencia real de dos conexiones, especialización, ACL y persistencia tras reiniciar PostgreSQL. |
| `tests/postgres/remote-smoke.sql` vía MCP | Aprobado en PostgreSQL 17.11 TrucoOnline: dos partidas legales, reparto 3+9 privado, replay de inicio/ataque, turnos, empate al 30 y victoria por vida cero. Toda la transacción de fixtures/membresía se revierte; secuencias pueden conservar huecos normales. El primer fixture excedió el largo del alias y fue corregido a <=40, sin dejar registros. |
| `npm run test:sql` | 27 pruebas sobre MariaDB 10.4.32 aprobadas, sin cambiar su motor; incluye combate, integridad, concurrencia, rollback, reinicio y persistencia. |
| `npm test` | 36 pruebas locales aprobadas (15 backend + 21 frontend). |
| `npm run build` | TypeScript/backend y frontend aprobados; catálogo documental y sprites conservados. |
| Advisors seguridad Supabase | Sin avisos tras instalar las políticas internas; no equivale a aprobación de Auth/online. |

Evidencia local: `artifacts/postgres/results.json`. Evidencia remota y ledger: [03-evidencia-motor-remoto.json](../../historial-validaciones.md). Pruebas de concurrencia se realizaron contra conexiones independientes del PostgreSQL aislado; **no se afirma concurrencia remota probada por MCP**.

## Interfaz servidor y próximo paso

`backend/src/repositories/postgres-engine.ts` exporta PostgresEngine: createPlayer, saveDeck, deleteDeck, start, act y snapshot. Cada operación toma una conexión del pool, inicia transacción, usa SET LOCAL ROLE y contexto local, confirma o revierte; reintenta solo 40001/40P01 con el mismo UUID. El ID del proyecto debe coincidir exactamente con TrucoOnline. No contiene secretos ni crea rutas públicas.

El despliegue deberá provisionar un LOGIN SQL limitado miembro de ta_engine_server y conexión TLS/pooler, no usar postgres ni ta_engine_owner como runtime. La auditoría ejecuta pruebas con administrador y SET LOCAL ROLE para comprobar los permisos reales de ese rol; no provisiona credenciales productivas. No reutilizar la conexión del CLI/MCP como credencial de aplicación. Nunca pasar TrustedPlayerContext desde req.body; deberá construirse después de validar Auth en la siguiente fase.

La API Express actual y la demo **siguen con sus proveedores anteriores**, deliberadamente: no se conectó el motor nuevo a rutas sin autenticación. Tampoco se agregaron Auth, salas, temporizador, UI online ni Vercel. Pendiente inmediato: identidad validada en servidor, acceso a perfil/colección/mazos propios y adaptación del frontend a PrivateGame. Después vendrán ejecución CPU servidor y multijugador. B1–B4 y aprobación académica continúan pendientes.
