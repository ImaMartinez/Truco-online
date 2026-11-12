# Supabase: auditoría y orden de implementación

11/11/2026. Primera entrega, fase 0 completada. **Migración funcional pendiente.** Único destino: **TrucoOnline / gjcpcbrkdjymrwktshfr**, PostgreSQL 17.11.0.018, esquema privado `truco_arena_der`. No se consultó ni modificó el proyecto anterior Truco.

Se conserva el [MER/MR académico](../hito-2/01-modelo-relacional-preliminar.md), reglamento 0.2, catálogo y demo. B1–B4 continúan pendientes de ratificación grupal. El pedido actual autoriza la ampliación técnica, no certifica su aprobación académica.

## Evidencia y diagnóstico

Inspección real mediante MCP: proyecto ACTIVE_HEALTHY; 15 tablas con RLS, 27 restricciones FK, 40 cartas y cero jugadores/partidas. Se compararon por código **los ocho atributos** del catálogo remoto contra `backend/src/demo/catalog.json`: igualdad completa.

Migraciones existentes, **no volver a ejecutar**:
- `20261111144422_truco_online_der_13_tablas`.
- `20261111144529_truco_online_ampliacion_15_tablas`.
- `20261111144559_truco_online_compatibilidad_mazos_20_y_reinicio`.

En el esquema de juego hay **cero rutinas y cero triggers**, cero políticas y cero grants de tablas a PUBLIC/anon/authenticated. RLS sin políticas es coherente con acceso privado; no habilitar políticas generales para resolver la conexión. Advisor: 15 avisos informativos por ausencia de políticas; no demuestra que la futura API sea segura. No se verificó todavía la configuración de Anonymous sign-ins, lista de schemas expuestos de Data API ni credenciales del futuro rol SQL.

Metadatos, columnas, PK, FK y CHECK obtenidos por consultas de solo lectura: [evidencia JSON](01-evidencia-esquema.json). No se aplicó DDL/DML, no se ejecutaron instalaciones, no se crearon usuarios de prueba remotos.

## Repositorio y diferencias concretas

| Fuente inspeccionada | Estado / adaptación necesaria |
|---|---|
| `backend/src/config.ts`, `repositories/arena-repository.ts` | Proveedores memory/mariadb. Añadir supabase con fallo explícito, sin fallback a memoria. No reemplazar MariaDB. |
| `backend/src/app.ts` | Sin autenticación. IDs owner/actor/jugadores llegan del cliente. No publicar estas rutas actuales como API online. Crear contexto autenticado obligatorio para el proveedor remoto. |
| `repositories/mariadb-repository.ts` | mysql2, transacción sobre una conexión, RC para comandos y RR para snapshots; reintentos acotados. Reutilizar interfaz, errores y pruebas, no su sintaxis SQL. |
| `shared/contracts.ts` | DuelState incluye ambas manos; StorageProvider solo memory/mariadb; motivos solo VIDA_CERO/LIMITE_TURNOS/REINICIO. Necesita DTO privado por espectador y modalidades/plazos/nuevos cierres. |
| `frontend/src/api.ts` | API relativa /api, sin gestión Auth. Mantener frontera HTTP; agregar sesiones/recuperación y peticiones autenticadas. |
| `pages/Play.tsx`, `App.tsx` | Seleccionan perfiles y guardan el mazo CPU desde el cliente. En remoto solo perfil propio y selección de mazo/dificultad; el servidor crea CPU/mazo. |
| `frontend/src/computer.ts`, `pages/Battlefield.tsx` | Política CPU y coordinación en navegador, modalidad/dificultad en localStorage. Trasladar política a módulo puro compartido y ejecución al servidor; persistir modalidad/dificultad existentes. |
| Dependencias / lockfile | React/Vite/Express/TypeScript/mysql2; no hay adaptador pg ni SDK Auth Supabase instalado. Incorporar versiones verificadas/fijadas y lockfile al implementar. |
| `xampp/new/*` | Documentación histórica apunta al proyecto anterior; **no es instrucción operativa**. No ejecutar sus SQL contra TrucoOnline. |
| `database/postgres/README.md` anterior | Dice adaptación futura/no proyecto creado. Se añade enlace al estado actual sin alterar antecedentes académicos. |

La cortina que oculta manos en modo presencial es solo visual: la respuesta HTTP conserva ambas. También los replays y errores deben proyectarse desde la identidad autenticada. No basta ocultar cartas en React, filtrar nombres TEST/PC ni tener RLS activado.

## Inventario MariaDB: qué portar y qué conservar

Se revisaron los diez archivos numerados entre 01 y 10 (incluye 06 y 07 auxiliares), sin ejecutarlos:

| Archivo | Tratamiento PostgreSQL |
|---|---|
| 01-schema | Comparación con las 15 tablas remotas; no recrear las 13 originales. PK/FK/CHECK ya presentes. |
| 02-routines | Crear jugador + 2 copias/tipo; guardar/validar mazos; iniciar; finalizar turno; exclusividad de subtipos e inmutabilidad de eventos. |
| 03-seed | Catálogo ya coincide: no reinsertar. No trasladar perfiles demo, academia ni fixtures. |
| 04-combat | Invocación, gasto, preparación, ataque único, daño simultáneo, descarte, héroe protegido y victoria inmediata en una transacción. |
| 05-vistas | v_coleccion_jugador: recrear equivalente solo si lo usa el adaptador, con acceso privado/seguridad de invocador. No es requisito añadir una vista. |
| 06-consultas-academicas | Referencia de consultas/historial; adaptar booleanos agregados y variables @. Excluir REINICIO del conteo de empates competitivos. |
| 07-demostracion-transaccion | Prueba de rollback; no rutina de producción ni seed remoto. |
| 08-deck-removal | Eliminar mazos nunca usados; archivar usados preservando historia y propiedad. |
| 09-decks-20 | **Versión funcional vigente** sobre 02: borradores 0..20; inicio exacto 12 o 20, tamaños iguales, máximo 2/tipo, composición exacta de 24/40 copias. |
| 10-restart-game | Cierre administrativo REINICIO + inicio nuevo atómico; replay nunca cierra la partida recién creada. En ONLINE no reiniciar unilateralmente la partida del rival: usar abandono. |

Cambios SQL: LAST_INSERT_ID → INSERT RETURNING; JSON → jsonb; INSERT IGNORE → ON CONFLICT con objetivo explícito; IF/IFNULL/<=> → CASE/COALESCE/IS NOT DISTINCT FROM; RAND → random para barajar, **no para códigos privados**. UUID nativo; bigint como string en JSON. No SUM(boolean), usar FILTER o CASE. UTC explícito para timestamps sin zona existentes; no convertirlos suponiendo horario argentino.

PL/pgSQL: funciones transaccionales sin COMMIT interno; excepción revierte sentencia y el repositorio revierte transacción. Nada de copiar SAVEPOINT/@@in_transaction/handlers literalmente. FOR UPDATE solo sobre filas, no agregados. Bloquear partida antes de energía/copias/eventos; inicio bloquea identidades/mazos en orden estable. Unicidad UUID y bloqueo asesor transaccional por clave para serializar inicios incluso antes de existir partida; huella canónica incluye identidad, modalidad, parámetros y operación. Verificar replay autorizado antes de versión obsoleta; reintentar 40001/40P01 de forma acotada conservando UUID.

## Integridad remota aún incompleta

1. Las FK no garantizan dos participantes, composición exacta, colección, turno o energía cruzando tablas: faltan funciones y permisos de escritura restringidos.
2. Jugada/Invocacion/Ataque tienen PK/FK; todavía no garantizan totalidad/disyunción entre hermanos. Propuesta: constraint triggers diferibles al COMMIT, comprobación de exactamente un hijo y restricción de escritura; historial inmutable.
3. `turno.motivo_cierre` CHECK permite UNKNOWN: con fecha_cierre no nula y motivo NULL la expresión devuelve NULL y CHECK acepta. **Verificado por SELECT de la expresión**, sin insertar. La fase de integridad debe exigir explícitamente motivo IS NOT NULL en el cierre y probar todos los pares fecha/motivo.
4. No hay garantía de un único turno abierto por partida: añadir índice parcial único luego de comprobar datos y funciones.
5. `jugador_auth` tiene PK auth_user_id y FK a auth.users, sin UNIQUE id_jugador: permite varios navegadores por perfil. No crear otra tabla de sesiones para duplicar Auth.
6. CPU compartida + regla “una activa por jugador” bloquearía todas las partidas PC concurrentes. Usar **identidad técnica CPU por partida**, no perfil humano seleccionable; sin vínculo Auth ni código de recuperación. Conservar sus mazos históricos, fuera de Mis mazos por tipo/propiedad real.
7. Sala tiene código único global, más estricto que único entre activas; conservarlo y reintentar colisiones. FKs compuestas ya validan dueño del mazo. Aún faltan bloqueo de unión, expiración y correspondencia participantes/sala.
8. dificultad_pc admite NULL en PC: al iniciar remotamente exigir dificultad válida y guardar la elegida; no alterar silenciosamente las filas antiguas.
9. Fechas del núcleo sin zona y fechas de sala/Auth con zona: emitir ISO UTC y serverNow; calcular vencimiento con reloj SQL tras adquirir el lock, no con now() fijado al inicio de una transacción que esperó bloqueada.
10. No hay pg_cron instalado; pgcrypto sí. No hay procesador remoto de vencimientos.

## Arquitectura elegida para implementar

**React → /api (Express/BFF) → PostgreSQL privado + Supabase Auth.** Conservar Express, sprites y UI. Proveedor supabase nuevo, consultas pg parametrizadas y conexión TLS/pooler; todas las sentencias de una transacción en el mismo cliente. No usar una sucesión de llamadas REST independientes como transacción.

Sesiones: Supabase Auth anónimo, sin correo/contraseña, gestionado por el BFF para conservar cookies HttpOnly, Secure en HTTPS y SameSite; excepción Secure solo en localhost HTTP. Validar usuario con Auth en servidor, renovación coordinada, origen/CSRF para mutaciones y rate limits. No confiar en user_metadata, ownerId, actorId ni un JWT simplemente decodificado. Contexto SQL de identidad mediante SET LOCAL ligado al usuario verificado, sin persistir entre conexiones del pool; las funciones vuelven a validar vínculo y autorización.

React conoce únicamente VITE_SUPABASE_URL del proyecto definitivo y VITE_SUPABASE_PUBLISHABLE_KEY; no accede a tablas. El BFF usa SUPABASE_URL/clave publicable para Auth y conexión SQL de rol limitado. No hace falta service_role en el camino normal; si luego se necesita para revocar sesiones, permanecerá solo en servidor. Cookies/token Auth no se guardan como código de recuperación en localStorage. Verificar el flujo de refresh con la versión SDK instalada antes de implementarlo.

Acceso SQL: rol de conexión sin DML libre, privilegios explícitos mínimos y funciones privadas con search_path fijado; preferir SECURITY INVOKER. Si una función precisa DEFINER, justificar propietario no superusuario, EXECUTE revocado a PUBLIC/anon/authenticated, validación de identidad dentro de la función y pruebas de suplantación. No desactivar RLS ni usar bypassrls para resolver errores. Crear solo políticas del rol servidor que necesite el acceso controlado. Credenciales de migración distintas del runtime.

Recuperación: CSPRNG 32 bytes (256 bits), mostrar una vez; almacenar HMAC-SHA256 de 64 hex con secreto servidor separado. No registrar cuerpo/token, URL con código ni localStorage. En nueva sesión Auth anónima, comprobar código con límite de intentos y transacción de bloqueo sobre perfil; asociar nueva auth_user_id al mismo perfil. Rotar código tras uso y regeneración, invalidar anterior; dejar claro que invalida el código, no automáticamente todos los dispositivos ya vinculados. Alias único; alta concurrente atómica con colección y vínculo. No reasignar por alias ni apropiarse de usuarios demo existentes.

Snapshot remoto: viewerPlayerId propio fijo, mano propia completa, rival solo handCount (sin IDs, códigos, orden ni futuras cartas); campo/descartes/historial públicos. La vista interna CPU queda solo en servidor. Separar DTO de presentación del estado interno para no inventar cartas ocultas. GET y replay verifican pertenencia. Retirar selectores de otros humanos en modo remoto; /me reemplaza directorio global.

Sincronización inicial: **polling autenticado cada 1 s** de sala/partida, con backoff y pausa al ocultar pestaña; no requiere publicar tablas a Realtime. Usar version para ignorar respuestas viejas y volver a consultar ante conflicto. Conexión indica “sin conexión” por errores/antigüedad local, sin fingir presencia precisa del rival. Eventual presencia con heartbeat sería ampliación explícita. Recuperar sala/partida activa desde /me al recargar.

Sala: código CSPRNG con alfabeto [A-HJ-NP-Z2-9], XXXX-XXXX; TTL propuesto 15 minutos pendiente de ratificación. Solo sala mientras espera. Unión toma FOR UPDATE de sala, valida tiempo/identidades/mazos y crea partida completa + cambia sala en la misma transacción. Orden global de locks documentado y probado con uniones/cancelación/inicio concurrentes. Invitado repetido recupera la misma partida; un tercero recibe sala no disponible, sin detalle privado.

Temporizador: solo ONLINE, 15 s por turno completo desde fecha_apertura UTC. No se renueva por invocar/atacar ni al reconectar. SQL valida límite tras lock antes de actuar; empate de hora exacta resuelto a favor del vencimiento (ahora >= límite). UUID determinista por partida/turno/vencimiento, revalidación de turno y versión en SQL. Dos workers o un click al vencer no cierran dos veces.
- Al expirar: TIEMPO_AGOTADO y siguiente turno, salvo regla de inactividad o global 30.
- Tres turnos propios seguidos **sin jugada válida y cerrados automáticamente**: INACTIVIDAD y victoria rival. Jugada o cierre MANUAL corta racha; se deriva de turnos/jugadas, sin contador redundante.
- Victoria por vida cero ya confirmada prevalece; si tercer timeout ocurre en global 30, propuesta de precedencia INACTIVIDAD antes de comparación de vidas, pendiente de ratificar.
- Desconexión no equivale a abandono: reloj sigue; reconexión recupera plazo. Abandono explícito y autorizado cierra con ganador rival, historial y turno FIN_PARTIDA.
- Proceso servidor permanente para CPU/vencimientos; despertar/reanudar desde SQL y locks de trabajo, sin confiar en la pestaña. Para procesar aunque no haya servidor/cliente conectado, función privada de vencimientos con Supabase Cron cada segundo como opción. Instalación/activación se hará en su fase, después de pruebas; no se promete puntualidad absoluta del scheduler. SQL rechaza fuera de plazo aunque el worker llegue tarde. No usar setTimeout de React o cron por minuto como garantía de 15 s.

Publicación: Vercel sirve frontend/dist, build npm run build --workspace frontend e install del monorepo; rewrite /api hacia backend HTTPS definido por entorno. Express necesita alojamiento Node con worker persistente (destino pendiente), no depender de memoria/setInterval de funciones efímeras. Mismo origen para cookies mediante rewrite, caché privada no-store y ningún secreto VITE_. No hay despliegue autorizado por este documento.

## Cambios de reglas y decisiones acotadas

| Tema | Propuesta / estado |
|---|---|
| Inicio ONLINE | Anfitrión posición 1 y comienza, **pedido explícito nuevo** frente al sorteo MariaDB. Registrar como ampliación online, conservar sorteo PC salvo nuevo pedido. |
| Formato | PC siempre 20; ONLINE admite 12/12 o 20/20, nunca mixto. Ya coincide con validación vigente. |
| Inactividad/abandono | Nuevas reglas solicitadas, no aprobaciones académicas inventadas. Documentar precedencia global 30 antes de pruebas de aceptación. |
| Recuperación | Múltiples vínculos Auth al mismo perfil; rotación del código no expulsa por sí sola sesiones vinculadas. Propuesta de seguridad explícita. |
| Sala / alojamiento | Ratificar TTL y proveedor backend/worker al preparar despliegue; no bloquea portar el motor local. |
| MER original | B1–B4 pendientes; mantener documentos y diagrama del grupo separados del DER operativo extendido. |

## Fases y puertas de verificación

| Fase | Implementación siguiente | Condición para continuar |
|---|---|---|
| 0 — esta entrega | Auditoría remota/local, delta, evidencia y arquitectura | Proyecto correcto, catálogo coincidente, estructura inventariada, build y pruebas base. Cumplida. |
| 1 — motor PostgreSQL | Migraciones incrementales SOLO de rutinas/índices/checks faltantes; no base ni seed repetidos; adaptador pg | Motor contra BD real: alta/colección, guardar/archivar, tamaños/cantidades, exactitud 24/40, turnos, combate, victoria, replay, rollback y concurrencia. |
| 2 — identidad y privacidad | Auth anónimo, /me, recuperación, cookies, contexto autorizado, DTO privado | Dos sesiones aisladas; recarga/refresh/recuperación/rotación; IDs falsos, no participante, token inválido y lectura adversaria rechazados. Verificar Anonymous sign-ins habilitado. |
| 3 — PC persistente | CPU técnica, mazo aleatorio y política servidor, settings SQL, recuperación | Tres dificultades, dos humanos contra CPU simultáneamente, reinicio de Node, ningún cliente puede actuar por CPU; mismas estadísticas/reglas. |
| 4 — ONLINE | Crear/unirse/cancelar/expirar sala, anfitrión primero, polling | Dos contextos/navegadores Auth diferentes, versión sincronizada, mano privada en cuerpos HTTP; dos invitados simultáneos crean una sola partida; retry devuelve la misma. |
| 5 — reloj/fin/reconexión | Vencimiento SQL, worker y abandono | Reloj inyectable servidor para pruebas 14.999/15 s, tres timeouts, actividad que corta racha, timeout vs ataque, múltiples workers, cero clientes y recarga sin renovar plazo. Reloj de prueba nunca controlable por endpoint público. |
| 6 — publicación preparada | Variables, Vercel/rewrite, HTTPS, documentación y advisors | Build público sin secretos, ejecución real PC/ONLINE, revisión humana y evidencia. Despliegue posterior separado. |

La fase 1 es el próximo trabajo autorizado, **no se presenta como ya implementada**. No ejecutar suites MariaDB con credenciales Supabase. Para pruebas PG usar transacciones/fixtures exclusivos de prueba y limpiar solo recursos propios; no ampliar tablas para “cumplir cantidad”. Antes de DDL comparar esquema/migration ledger de nuevo y crear archivo mediante CLI migration new con versión/flags verificados, sin reejecutar migraciones existentes.

## Verificaciones ejecutadas en esta entrega

- npm run build: aprobado, TypeScript backend/frontend y 40 cartas documentales.
- npm test: aprobado, **15 backend + 21 frontend**. Incluye simulación de las tres dificultades y sprites originales.
- SELECT de metadatos, constraints, catálogo y check con NULL sobre TrucoOnline: aprobado; sin mutaciones.
- Supabase advisors security: 15 INFO por RLS sin políticas, esperables en esquema privado. [Explicación oficial](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Comparación programática de 40 cartas remotas contra catálogo local: aprobada.
- **No ejecutado en esta entrega:** suites funcionales PostgreSQL, sesiones Auth, pruebas online de dos navegadores, SQL MariaDB de regresión, despliegue. No existe aún juego remoto verificable.

Documentación oficial consultada: [Auth anónimo](https://supabase.com/docs/guides/auth/auth-anonymous), [conexiones PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [Cron](https://supabase.com/docs/guides/cron), [changelog](https://supabase.com/changelog). El changelog informa CLI v3 con cambios de comandos/destino y TLS antiguo retirado; no se usó CLI ni cifrados heredados en esta auditoría. Verificar help/versión antes de generar migraciones.

## DER operativo observado (sin reemplazar MER)

Inventario del **esquema real**, no un nuevo modelo aprobado. Las dos relaciones añadidas como entidades son jugador_auth y sala. Una identidad Auth se vincula a un perfil; un perfil admite 0..N identidades. Un jugador tiene 0..N salas como anfitrión/invitado; una sala esperando tiene 1 anfitrión, 0 invitado y 0 partida; al iniciar tiene 1 invitado y 1 partida. Cada partida tiene 0..1 sala; PC no la requiere. Las 13 tablas originales conservan su propósito.

| Tabla | Columnas observadas | PK |
|---|---|---|
| jugador | `id_jugador`, `alias`, `fecha_alta`, `fecha_archivo`, `tipo_jugador`, `codigo_recuperacion_hash` | id_jugador |
| carta | `id_carta`, `nombre`, `palo`, `numero`, `ataque_base`, `vida_base`, `costo_energia`, `jerarquia_truco` | id_carta |
| coleccion_jugador | `id_jugador`, `id_carta`, `cantidad` | id_jugador, id_carta |
| mazo | `id_mazo`, `id_jugador`, `nombre`, `descripcion`, `fecha_creacion`, `fecha_archivo` | id_mazo |
| mazo_carta | `id_mazo`, `id_carta`, `cantidad` | id_mazo, id_carta |
| partida | `id_partida`, `fecha_inicio`, `fecha_fin`, `motivo_cierre`, `ganador_posicion`, `version`, `modalidad`, `dificultad_pc` | id_partida |
| participante_partida | `id_participante`, `id_partida`, `posicion`, `id_mazo`, `vida_heroe` | id_participante |
| copia_carta_partida | `id_copia`, `id_participante`, `id_carta`, `posicion_original`, `zona`, `vida_actual` | id_copia |
| turno | `id_turno`, `id_partida`, `numero_global`, `energia_disponible`, `fecha_apertura`, `fecha_cierre`, `motivo_cierre` | id_turno |
| solicitud_operacion | `clave_reintento`, `id_partida`, `tipo_operacion`, `hash_parametros`, `version_resultante`, `fecha_registro` | clave_reintento |
| jugada | `id_jugada`, `id_turno`, `orden_en_turno`, `clave_reintento` | id_jugada |
| invocacion | `id_jugada`, `id_copia` | id_jugada |
| ataque | `id_jugada`, `id_copia_atacante`, `id_copia_objetivo`, `id_participante_objetivo`, `vida_previa_atacante`, `vida_previa_objetivo` | id_jugada |
| jugador_auth | `auth_user_id`, `id_jugador`, `fecha_vinculacion` | auth_user_id |
| sala | `id_sala`, `codigo`, `id_anfitrion`, `id_mazo_anfitrion`, `id_invitado`, `id_mazo_invitado`, `id_partida`, `estado`, `fecha_creacion`, `fecha_expiracion`, `fecha_union` | id_sala |

Las cardinalidades exactas 2 participantes y 12/20 copias por participante dependen todavía de rutinas, no del dibujo ni solo de las FK. Relación N:M con cantidades: coleccion_jugador y mazo_carta. Jugada → Invocacion/Ataque sigue como especialización a reforzar.

Las **27 FK** siguientes son restricciones completas, no conteo de columnas (hay FK compuestas). Incluye la referencia externa a auth.users:

| Restricción | Origen | Relación SQL observada |
|---|---|---|
| fk_participante_partida | participante_partida | FOREIGN KEY (id_partida) REFERENCES truco_arena_der.partida(id_partida) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_coleccion_jugador | coleccion_jugador | FOREIGN KEY (id_jugador) REFERENCES truco_arena_der.jugador(id_jugador) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_coleccion_carta | coleccion_jugador | FOREIGN KEY (id_carta) REFERENCES truco_arena_der.carta(id_carta) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_mazo_jugador | mazo | FOREIGN KEY (id_jugador) REFERENCES truco_arena_der.jugador(id_jugador) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_participante_mazo | participante_partida | FOREIGN KEY (id_mazo) REFERENCES truco_arena_der.mazo(id_mazo) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_partida_ganador | partida | FOREIGN KEY (id_partida, ganador_posicion) REFERENCES truco_arena_der.participante_partida(id_partida, posicion) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_mazo_carta_mazo | mazo_carta | FOREIGN KEY (id_mazo) REFERENCES truco_arena_der.mazo(id_mazo) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_mazo_carta_carta | mazo_carta | FOREIGN KEY (id_carta) REFERENCES truco_arena_der.carta(id_carta) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_copia_participante | copia_carta_partida | FOREIGN KEY (id_participante) REFERENCES truco_arena_der.participante_partida(id_participante) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_copia_carta | copia_carta_partida | FOREIGN KEY (id_carta) REFERENCES truco_arena_der.carta(id_carta) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_turno_partida | turno | FOREIGN KEY (id_partida) REFERENCES truco_arena_der.partida(id_partida) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_solicitud_partida | solicitud_operacion | FOREIGN KEY (id_partida) REFERENCES truco_arena_der.partida(id_partida) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_jugada_turno | jugada | FOREIGN KEY (id_turno) REFERENCES truco_arena_der.turno(id_turno) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_jugada_solicitud | jugada | FOREIGN KEY (clave_reintento) REFERENCES truco_arena_der.solicitud_operacion(clave_reintento) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_invocacion_jugada | invocacion | FOREIGN KEY (id_jugada) REFERENCES truco_arena_der.jugada(id_jugada) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_invocacion_copia | invocacion | FOREIGN KEY (id_copia) REFERENCES truco_arena_der.copia_carta_partida(id_copia) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_ataque_jugada | ataque | FOREIGN KEY (id_jugada) REFERENCES truco_arena_der.jugada(id_jugada) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_ataque_atacante | ataque | FOREIGN KEY (id_copia_atacante) REFERENCES truco_arena_der.copia_carta_partida(id_copia) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_ataque_objetivo_carta | ataque | FOREIGN KEY (id_copia_objetivo) REFERENCES truco_arena_der.copia_carta_partida(id_copia) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_ataque_objetivo_heroe | ataque | FOREIGN KEY (id_participante_objetivo) REFERENCES truco_arena_der.participante_partida(id_participante) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_jugador_auth_usuario | jugador_auth | FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE CASCADE |
| fk_jugador_auth_jugador | jugador_auth | FOREIGN KEY (id_jugador) REFERENCES truco_arena_der.jugador(id_jugador) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_sala_anfitrion | sala | FOREIGN KEY (id_anfitrion) REFERENCES truco_arena_der.jugador(id_jugador) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_sala_mazo_anfitrion | sala | FOREIGN KEY (id_anfitrion, id_mazo_anfitrion) REFERENCES truco_arena_der.mazo(id_jugador, id_mazo) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_sala_invitado | sala | FOREIGN KEY (id_invitado) REFERENCES truco_arena_der.jugador(id_jugador) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_sala_mazo_invitado | sala | FOREIGN KEY (id_invitado, id_mazo_invitado) REFERENCES truco_arena_der.mazo(id_jugador, id_mazo) ON UPDATE RESTRICT ON DELETE RESTRICT |
| fk_sala_partida | sala | FOREIGN KEY (id_partida) REFERENCES truco_arena_der.partida(id_partida) ON UPDATE RESTRICT ON DELETE RESTRICT |
