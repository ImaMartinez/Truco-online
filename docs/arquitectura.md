# Arquitectura y alcance actual

TrucoOnline es un juego de combate por turnos con 40 tipos de naipes españoles. React presenta el estado y solicita acciones; Express valida contratos y acceso; SQL impone las reglas persistentes. Energía, vida, daño y resultados no se confirman desde React. Se conservan reglas, estadísticas y motores existentes.

## Componentes

| Ruta | Responsabilidad |
|---|---|
| `frontend/src/EntryApp.tsx` | Consulta `/api/health` y selecciona la interfaz del proveedor real. |
| `frontend/src/SupabaseWebApp.tsx` | Sesión individual, navegación y partida remota privada. |
| `frontend/src/App.tsx` | Proveedores locales MariaDB/memoria y CPU vinculada a la pantalla. |
| `frontend/src/components/`, `pages/` | Cartas, tablero, formularios, confirmaciones y avisos popup. |
| `shared/` | Contratos TypeScript y tamaños de mazo compartidos, necesarios en ambos builds. |
| `backend/src/server.ts` | Arranque, proveedor, worker CPU remoto y cierre ordenado. |
| `backend/src/supabase-app.ts` | BFF de sesiones y despacho autorizado para Supabase. |
| `backend/src/repositories/` | Adaptadores MariaDB/PostgreSQL y su contrato. |
| `backend/src/cpu/` | Worker persistente y política de dificultad del modo Supabase. |
| `backend/src/demo/` | Motor en memoria y catálogo de desarrollo; no es material QA descartable. |

## Modalidades y datos

| Proveedor | Uso e identidad | CPU y online |
|---|---|---|
| MariaDB/XAMPP | Base local `truco_arena_dev`; 13 tablas académicas, perfiles elegidos en un equipo de confianza. | CPU desde el navegador abierto y dos jugadores en el mismo dispositivo. Sin Auth, recuperación ni salas online. |
| Memoria | Demo local/pruebas sin SQL; datos efímeros. | Simulación de interacción; no acredita persistencia ni seguridad remota. |
| Supabase | Proyecto definitivo TrucoOnline; esquema privado `truco_arena_der`, Auth y 16 tablas operativas. | Worker CPU en Railway, salas privadas online y plazos gestionados en SQL/Cron. |

El modelo académico tiene 13 tablas: jugador, carta, colección, mazo, composición, partida, participante, copia, turno, solicitud, jugada, invocación y ataque. PostgreSQL incorpora además `jugador_auth`, `sala` e `intento_recuperacion`, junto con ampliaciones operativas documentadas en su instalador. No confundir el MER simplificado con un DER físico exhaustivo.

Los mazos persistentes admiten los formatos 12/20 bajo las validaciones existentes. Las operaciones usan transacciones, bloqueos, versión esperada, clave idempotente y recibos; los ataques aplican el daño de las rutinas, sin un segundo motor en React. Reinicio, abandono y sustitución CPU-online tienen contratos distintos según el proveedor; no se equiparan artificialmente.

## Seguridad de la versión pública

- Auth anónimo de Supabase, alias y perfil persistente. El BFF valida la identidad; no usa el ID enviado por el navegador como autorización.
- Sesiones cifradas en cookies HttpOnly, Secure en HTTPS y SameSite=Lax. `SESSION_ENCRYPTION_KEY` permanece estable entre despliegues.
- Recuperación mediante código secreto mostrado una vez y representación criptográfica guardada; rotación y control de intentos. No autorizar por alias, IP o localStorage.
- Escrituras de juego por gateways/rutinas que validan participante, propiedad, turno y versión. Manos remotas privadas; el DTO local de confianza no proporciona esa garantía remota.
- Supabase privado con RLS y permisos mínimos. El worker utiliza su rol SQL limitado y TLS con el certificado público versionado.
- Navegador → `/api` del mismo origen → rewrite Vercel → Express Railway. Proxy autenticado, Origin exacto y respuestas privadas no almacenables en caché compartida.

## Assets y catálogo

Los 80 archivos finales PNG/WebP viven **solo en `frontend/public/cards/v3/`**. `truco_arena_sprites/sprites.json` sigue siendo un import del frontend; `checksums.json` conserva los hashes comprobados contra las copias originales antes de retirarlas. El fallback PNG sigue disponible. Ninguna imagen, estadística o contrato de juego se cambia durante la limpieza.

El build ejecuta `catalog:check`: `scripts/extract-catalog.mjs` lee `docs/etapa-0/02-cartas-y-equilibrio.md` y verifica el catálogo en `backend/src/demo/catalog.json`. Se conservan los dos archivos y su hash de procedencia. Los generadores SQL también consumen el catálogo y sus fuentes versionadas.

La [bitácora de IA](bitacora-ia.md) y el [archivo técnico de fases](README.md#archivo-técnico) documentan la asistencia utilizada y sus límites. La aplicación funcional no equivale a validación docente del MER/MR ni de B1–B4.
