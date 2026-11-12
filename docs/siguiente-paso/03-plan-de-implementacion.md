# Truco Arena — hoja de ruta para llegar al producto final

**Regla general:** mantener el orden académico de validación MER → MR/3FN → SQL → juego integrado, pero **trabajar en paralelo** en la experiencia visual con datos de demostración. Esto evita seguir creando documentos sin tener nada ejecutable.

## Decisión de alcance del MVP

- Duelo **local**, dos jugadores en el mismo navegador y dispositivo.
- 40 tipos de cartas españolas ya definidos en Etapa 0, sin habilidades extras.
- Colecciones precargadas, editor de mazos, partida por turnos y ranking/historial.
- Héroes con 20 de vida; mazos con 12 cartas, máximo dos del mismo tipo.
- Energía de 1 a 5, tres plazas en el campo; ataque simultáneo entre cartas, objetivo héroe solo con campo enemigo vacío.
- Victoria inmediata por héroe a cero o cierre al terminar el global 30.
- XAMPP/MariaDB como implementación evaluable. React/Vite/TypeScript + Node/Express/TypeScript.
- **No es parte de esta primera versión:** chat, economía, sobres, adquisición/intercambio, IA rival, PvP remoto, animaciones complejas, cuentas con contraseñas, autenticación Supabase.

## Entrega 1 — Algo visible y ejecutable (ya se puede empezar)

**Objetivo:** tener una aplicación que inicie y muestre el juego, **todavía con mock**.

Acciones de Codex:

1. Inspeccionar el repositorio y conservar los archivos existentes.
2. Crear `frontend/` con React/Vite/TypeScript, pantalla inicial y un tablero responsive.
3. Mostrar las cartas del catálogo leyendo los datos de Etapa 0 si hay una fuente estructurada verificable; si no la hay, usar un conjunto de ejemplo marcado como MOCK y no inventar estadísticas definitivas.
4. Crear `backend/` con Node/Express/TypeScript y `GET /api/health`.
5. Configurar proxy `/api` desde Vite; preparar `.env.example` y `.gitignore`.
6. Agregar scripts de desarrollo, compilación y pruebas básicas.
7. Mostrar que frontend y API se ejecutan **sin afirmar que están conectados a SQL**.

**Criterio de listo:** la UI se abre en localhost, se ven cartas o demostraciones claramente señaladas y `GET /api/health` responde. Sin modelo SQL final ni cambios a la BD.

## Entrega 2 — Hito 1 aprobado y Hito 2 documentado

Acciones del equipo:

1. Adoptar/revisar B1–B4; confirmar con docente estructura avanzada y alcance de la colección.
2. Dibujar MER usando la guía. Revisar escenarios sobre el dibujo.
3. Transformar MER aprobado en modelo relacional, PK/FK, dependencias funcionales y 3FN.
4. Escribir diccionario de datos por tabla (nombre, tipo SQL, nulabilidad, reglas, significado, índices).
5. Registrar cambios y justificación entre MER y MR.

**Criterio de listo:** el grupo explica el MER y MR, el docente acepta el modelo y no quedan entidades/relaciones contradictorias. **No dar esto por aprobado solo porque Codex pueda generar tablas.**

## Entrega 3 — MariaDB realmente funcional (Hito 3)

Implementar y comprobar en XAMPP:

1. `database/mariadb/01-schema.sql`: DDL completo, InnoDB, PK/FK/UQ/CHECK.
2. `database/mariadb/02-seed.sql`: catálogo 40 cartas, jugadores de prueba, colección y al menos dos mazos válidos; datos extra para consultas.
3. `database/mariadb/03-rutinas.sql`: operaciones del juego y permisos de rol de aplicación.
4. `database/mariadb/04-consultas.sql`: las 10 consultas requeridas con enunciado, incluyendo anti-join, subconsulta escalar, GROUP BY/HAVING y JOIN de tres tablas o subconsulta por cada consulta.
5. `database/mariadb/05-vistas.sql`: vista real utilizada por la web.
6. `database/mariadb/06-pruebas.sql`: casos válidos, rechazo, un ROLLBACK real y pruebas de concurrencia en dos conexiones (si se automatizan, incluir instrucciones).
7. Un `database/mariadb/instalar.sql` o script de instalación documentado que ejecute lo necesario sobre una BD vacía en el **orden correcto**, cumpliendo el requisito académico de un único punto de entrada reproducible.

**Criterio de listo:** se instala limpiamente en MariaDB 10.4.32, el rol de aplicación no puede eludir reglas, la transacción de combate revierte toda la acción al fallar, y la vista/consultas devuelven resultados verificables.

## Entrega 4 — Primer corte vertical conectado (Hito 4)

Primera secuencia completa:

1. UI consulta jugadores y mazos disponibles desde API real.
2. Selecciona dos jugadores y sus mazos, crea una partida en SQL.
3. Backend devuelve estado de partida con solo la mano del actor visible en la UI.
4. Un jugador invoca una carta usando un endpoint que llama a la rutina SQL.
5. Ambos pueden finalizar turno; se actualiza energía y robo sin duplicaciones.
6. Se ejecuta un ataque a carta y luego un ataque a héroe en un escenario permitido.
7. Se termina la partida, aparece ganador/empate y se puede consultar historial.

**Criterio de listo:** puede completarse una partida real en XAMPP, sin reglas críticas implementadas solamente en React/Node. Todos los cambios quedan persistidos y sobreviven a recargar la página.

## Entrega 5 — Calidad y publicación

1. Probar 30 turnos, empate, victoria temprana, doble invocación, ataque duplicado, idempotencia, mano oculta, recarga y mazo agotado.
2. README para instalación desde cero, arquitectura, explicación de restricciones, capturas, bitácora IA, informe final de 2–3 páginas.
3. Repositorio GitHub compartido.
4. **Solo tras consultar al docente:** preparar adaptación PostgreSQL para Supabase con SQL y pruebas propias; desplegar Node.js en un host compatible y el frontend web.
5. Tener siempre un modo evaluable totalmente local con XAMPP.

## Orden mínimo sugerido de pantallas y endpoints

| Pantalla | API prevista | Cuándo |
|---|---|---|
| Inicio / Estado del servidor | `GET /api/health` | Entrega 1 |
| Colección | `GET /api/jugadores/:id/coleccion` | Entrega 4 |
| Editor de mazos | `GET /api/jugadores/:id/mazos`; `POST /api/mazos` | Entrega 4 |
| Partida | `POST /api/partidas`; `GET /api/partidas/:id` | Entrega 4 |
| Invocar | `POST /api/partidas/:id/invocaciones` | Entrega 4 |
| Atacar | `POST /api/partidas/:id/ataques` | Entrega 4 |
| Finalizar turno | `POST /api/partidas/:id/finalizar-turno` | Entrega 4 |
| Estadísticas | `GET /api/ranking`, `GET /api/partidas/:id/historial` | Entregas 4–5 |

En producción, **no enviar en la respuesta de estado los datos de la mano del rival** si en el futuro se habilita multijugador remoto. En el MVP local la ocultación entre turnos es una convención de UI para jugar físicamente alternando el dispositivo, no seguridad adversarial.

## Pruebas que el grupo debe poder mostrar

- Mazo con 13 cartas rechazado; mazo con tres copias del mismo tipo rechazado.
- No se puede jugar una carta que el jugador no posee.
- Energía insuficiente y campo con 3 cartas: invocación rechazada sin alterar nada.
- Carta invocada en este turno: no ataca.
- Repetir ataque de la misma copia en el turno: rechazado.
- Ataque carta vs carta: ambos reciben daño calculado con vidas previas.
- Atacar héroe con campo enemigo no vacío: rechazado.
- Ataque que termina el duelo: cierra turno y partida en una transacción.
- Turno global 30: victoria por mayor vida o empate.
- Repetir solicitud tras pérdida de respuesta: no aplica el efecto dos veces.
- Forzar error tras un cambio de datos de combate: ROLLBACK completo.

## Actividades concretas para el equipo

- Integrante que dibuja MER: expone las cardinalidades y cada N:M.
- Integrante que revisa reglas: comprueba 24 reglas contra el MER y escenarios.
- Integrante que estudia normalización: identifica dependencias y potenciales redundancias.
- Integrante que prueba SQL/frontend: prepara casos de aceptación y reproduce errores.

Estos roles son **rotativos**. Todos deben comprender el MER, una regla SQL y una consulta para la defensa individual.
