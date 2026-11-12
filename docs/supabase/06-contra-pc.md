# Fase 4 — CPU sobre el motor PostgreSQL

Estado: modo CPU implementado y verificado en PostgreSQL aislado y Supabase TrucoOnline el 11/11/2026. No implica aprobación de B1–B4 ni del modelo académico.

## Impacto y recuperación (antes de aplicar)

Migración nueva: `20261111160453_arena_cpu_engine.sql`. No reproduce migraciones anteriores, no agrega tablas, no cambia estadísticas ni reglas de combate. Agrega funciones privadas de inicio/worker y el RPC invocador `public.ta_start_cpu`; `public.ta_web` delega en un envoltorio que incorpora metadatos CPU e historial. El motor `ta_actuar` y sus controles permanecen intactos.

Cada partida crea un jugador `CPU` sin identidad Auth y un mazo aleatorio independiente, de igual tamaño que el humano (12/20), respetando dos copias por tipo. Esas filas se conservan para el historial y no aparecen en los mazos propios. No se agregan a la colección del humano.

Recuperación: detener el worker y deshabilitar el inicio CPU en Express. Restaurar únicamente el cuerpo invocador de `public.ta_web` para delegar en `truco_arena_der.ta_web_interno`, preservando sus permisos anteriores; revocar ejecución del nuevo inicio y del rol worker. Conservar partidas, participantes, mazos, copias e historial; no borrar filas ni reiniciar el esquema. Los cambios de funciones se aplican transaccionalmente, con `lock_timeout=5s`. Ante un fallo, la migración completa se revierte. No ejecutar `db reset` ni `db push` sobre este proyecto: los timestamps locales y remotos históricos difieren.

## Arquitectura y seguridad

- React solicita inicio con mazo propio, dificultad y UUID; nunca identifica al actor. El backend valida el token Supabase y el RPC vuelve a obtener el humano desde `jugador_auth`.
- Un UUID repetido recupera la misma partida. Otra dificultad/mazo con esa clave se rechaza. El reinicio confirmado cierra la partida CPU previa como `REINICIO`, sin adjudicar victoria.
- Node ejecuta un worker con LOGIN `ta_cpu_node`, NOINHERIT/NOBYPASSRLS, miembro exclusivamente de `ta_cpu_worker`. Usa TLS verificado, consultas parametrizadas y `SET LOCAL ROLE` dentro de una transacción. Sin lecturas/escrituras directas de tablas, sin `ta_engine_server`, sin claves administrativas.
- El worker consulta turnos CPU abiertos persistidos. Cada barrido avanza como máximo una acción por partida y reintenta errores temporales. Al reiniciar Node reconstruye pendientes desde PostgreSQL; no requiere una pestaña abierta.
- `ta_cpu_state` construye la misma proyección privada del motor: mano propia y campo/descarte público humano. Nunca entrega la mano humana al algoritmo. `ta_cpu_step` obtiene la CPU activa desde SQL, sin aceptar actor, y llama al motor con UUID determinista por partida/versión. Dos workers compiten con bloqueo de partida y reintento seguro.
- `ta_cpu_start` y el envoltorio conservan propietario NOLOGIN del motor, search_path fijo y permisos explícitos. Los helpers del worker no son ejecutables por anon/authenticated. Tablas privadas/RLS conservadas.

## Dificultades

`backend/src/cpu/policy.ts`: Fácil elige acciones legales al azar y puede pasar; Normal evalúa un movimiento por eficiencia/material y daño; Difícil busca secuencias de hasta cuatro movimientos mediante beam search (ocho posiciones por nivel) y prioriza daño letal. La aleatoriedad se deriva de partida/versión para que los reintentos sean reproducibles. La predicción es heurística para elegir; solo SQL confirma energía, daño, zonas y resultados. No es una CPU infalible ni utiliza información oculta del rival.

## Web

Jugar permite elegir mazo/dificultad e iniciar o continuar. Guarda solo el comando pendiente/UUID en el navegador para reintentar respuestas inciertas. La arena mantiene perspectiva humana fija y consulta estado confirmado; no ejecuta el algoritmo CPU anterior del modo memory. El indicador de pensamiento y la dificultad aparecen en el tablero. Los ataques confirmados se animan antes de aplicar el snapshot; si un sondeo agrupa varios movimientos, reproduce las embestidas y el impacto final contra el estado real, sin inventar estados de vida intermedios. El sondeo se suspende al desmontar y recupera fallos temporales. Historial distingue victoria, derrota, empate y reinicio.

## Configuración

`backend/.env.supabase.example` documenta las variables públicas y las de conexión limitada CPU, solo backend. La contraseña del LOGIN se provisiona fuera del repositorio y no se imprime ni se envía a React. Inicio: `npm run dev:supabase`; web `http://127.0.0.1:5173/`, backend `http://127.0.0.1:4200/api/health`. Requiere acceso TCP/TLS a PostgreSQL del proyecto y conexión a Auth/PostgREST.

Certificado público incluido en `backend/certs/supabase-prod-ca-2021.crt`, obtenido por HTTPS de `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. SHA-256: `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`. Se puede indicar otro archivo con `CPU_DB_CA_FILE`. Se probó el worker tanto desde TypeScript como desde la compilación. La verificación TLS y del hostname permanece habilitada. Referencia: [conexión PostgreSQL y certificado](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl).

LOGIN limitado ya provisionado en este entorno. En otro entorno, un administrador debe crear `ta_cpu_node LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5`, asignar un secreto criptográfico nuevo por canal privado y conceder exclusivamente `ta_cpu_worker`; establecer `statement_timeout=10s` e `idle_in_transaction_session_timeout=15s`. No conceder el rol propietario ni `ta_engine_server`. Mantener el secreto en el archivo ignorado de entorno. La bitácora remota del aprovisionamiento no conserva la contraseña original.

Migración local `20261111160453_arena_cpu_engine.sql` aplicada remotamente como `20261111161637_arena_cpu_engine`. Aprovisionamiento de LOGIN registrado separadamente como `20261111161649_arena_cpu_runtime_login`, sin credenciales en archivos versionados. No reaplicar ninguno de esos cambios en TrucoOnline.

## Validación

| Ejecución | Resultado observado |
|---|---|
| `npm run build` | TypeScript/backend/frontend y catálogo original de 40 cartas correctos. |
| `npm test` | 36 pruebas locales: 15 backend y 21 frontend. |
| `npm run test:postgres` | 14 grupos del motor PostgreSQL 17.6 real, incluida concurrencia, rollback, victoria y empate. |
| `npm run test:profiles` | Asociación Auth, recuperación simultánea de un solo uso, rotación, límites y ACL correctos. |
| `npm run test:cpu` | 7 grupos en PostgreSQL real: inicio 12/20, composición exacta contra mazo, CPU distintas sin Auth, concurrencia/replay, rollback tras crear/reiniciar parcialmente, permisos, partidas completas, victoria CPU y empate controlado 30. |
| `node --env-file=backend/.env.supabase --import tsx tests/postgres/remote-cpu.mjs` | Tres usuarios simultáneos y tres partidas completas en Supabase: #6 Fácil VIDA_CERO turno 26, #7 Normal VIDA_CERO turno 22, #5 Difícil VIDA_CERO turno 22. En las tres ganó la política de prueba que actuaba por el humano. Recuperación posterior desde otra sesión conserva el resultado. |
| `node --env-file=backend/.env.supabase --import tsx tests/postgres/remote-restart.mjs` | Con el backend normal detenido y un único worker: turno CPU estable sin worker; al reiniciar realmente el proceso Node avanzó desde SQL y conservó la sesión HttpOnly. |
| `node --env-file=backend/.env.supabase tests/postgres/web-auth.mjs` | Cuatro grupos E2E con cuatro contextos, Auth real, mazo por UI, inicio CPU desde Jugar, perfil recuperado en otro navegador, mano CPU oculta, rechazo de tercero, recarga e historial. Captura `artifacts/profiles/cpu-arena.png`. |
| `node --env-file=backend/.env.supabase tests/postgres/web-security.mjs` | Refresh simultáneo real, sesión/cookie, CSRF, RPC anónimo denegado, IDs falsos, esquema privado y límites de recuperación. |
| Playwright memory: computer, deck-tools, arena-viewport con `tmp/playwright.draw.config.ts` | 8 pruebas: escritorio/mobile, arrastre, CPU previa, mazos, confirmaciones y modal con fuegos artificiales. |
| Permisos remotos | 16 tablas, 28 FK y 40 cartas. LOGIN sin SELECT de copias ni UPDATE de vida ni rol humano; authenticated sin ejecución de pasos CPU; anon sin inicio CPU. Advisor sin hallazgos nuevos; persiste aviso previo de protección de contraseñas filtradas, flujo no utilizado aquí. |

Escenario reproducible de dificultad: CPU con ORO-01 y BAS-05, rival con BAS-04 y 4 de vida. Normal utiliza ORO-01 para un intercambio favorable; Difícil sacrifica BAS-05 y conserva ORO-01 para el ataque letal siguiente. Fácil, con 100 semillas fijas, tanto pasa como elige ambos atacantes. Alterar una mano humana ficticia no altera la decisión. La victoria CPU se prueba contra humano que pasa; el empate se fuerza legalmente haciendo pasar a ambos hasta 30. No se atribuyen esos escenarios controlados a partidas competitivas reales.

Evidencia generada: `artifacts/postgres/cpu-results.json`, `remote-cpu-results.json`, `cpu-restart-results.json` y `artifacts/profiles/web-results.json`. Esos artefactos ignorados no contienen sesiones ni códigos de recuperación. Los datos QA remotos se identifican por alias y se conservan separados por perfil; no son aprobaciones humanas.

## Archivos y límites

SQL: migración CPU. Backend: `src/cpu/policy.ts`, `src/cpu/worker.ts`, `src/supabase-app.ts`, `src/server.ts`, certificado y ejemplo de entorno. Frontend: `pages/PlayCpu.tsx`, `SupabaseWebApp.tsx`, `pages/Battlefield.tsx`, `remoteCpuAnimation.ts`, `combatAnimation.ts`, `components/GameHelpDialog.tsx`; contrato CPU opcional en `shared/contracts.ts`. Pruebas: scripts CPU aislados/remotos y actualización del E2E de perfiles para iniciar por UI sin fixture administrativo manual. Script `test:cpu` en package.json.

El worker requiere un proceso Node activo. Al detenerlo, el turno queda pendiente y continúa al arrancar; no hay un servicio autónomo desplegado ni scheduler externo. Una futura publicación serverless deberá resolver dónde ejecutar ese worker. Los sondeos pueden agrupar movimientos confirmados; se animan sin reconstruir vida intermedia. La dificultad es heurística, sin garantía de ganar; no se modifica energía ni reglas para favorecerla. No se verificaron salas, temporizador ni plataforma desplegada porque están fuera de esta fase.

Pendientes fuera de alcance: salas/multijugador, temporizador online y despliegue. No hay commits ni cambios del reglamento.
