# Truco Arena — demo ejecutable local

Este es el punto de entrada para ejecutar el corte de demostración. Los README y documentos académicos anteriores se conservan como antecedentes sin modificaciones. B1–B4 siguen pendientes; este corte no aprueba MER, MR, reglas ni tablas.

## Arranque en Windows

Requisitos: Node.js 24.16 o superior y npm. **No hace falta iniciar XAMPP**: la demo no abre ninguna conexión SQL.

Desde PowerShell:

```powershell
Set-Location 'C:\Users\Imaam\OneDrive\Documentos\ChatGPT\Truco online'
npm ci
npm run dev
```

Abrir [Truco Arena](http://localhost:5173). La API escucha en [localhost:4000](http://localhost:4000/api/health). Ambos procesos se inician con un solo comando; Ctrl+C los detiene. El servidor queda limitado a loopback. Los puertos son estrictos: si están ocupados, cerrar el otro proceso o configurar otro puerto y destino del proxy.

También pueden iniciarse por separado, desde la raíz del proyecto en dos terminales:

```powershell
# Terminal 1
npm run dev:backend
```

```powershell
# Terminal 2
npm run dev:frontend
```

No se necesitan variables de entorno para los valores predeterminados. Los archivos `backend/.env.example` y `frontend/.env.example` describen la configuración opcional de puerto y proxy; sus copias `.env` están ignoradas por Git. Ninguno contiene credenciales SQL. No poner secretos en variables `VITE_`, que se exponen al navegador.

## Qué se puede usar

- Inicio con navegación a colección, mazos, Jugar y arena.
- Catálogo completo de cuarenta cartas con sprites V3, ataque, vida, energía y filtros/ordenamiento.
- Editor de mazos con selección de copias, nombre, contador y guardado **en memoria del servidor**.
- Jugar permite elegir mazos y rival automático con tres dificultades. El modo presencial para dos personas continúa como opción; su mesa preparada permite experimentar enseguida.
- Arrastrar cartas con mouse o táctil a cualquiera de los tres espacios libres, o seleccionarlas e invocarlas con botones. Seleccionar atacante y objetivo para combatir. Frente a la PC, finalizar turno conserva la perspectiva humana y activa sus decisiones automáticas con pausas visuales.
- Indicadores de vida/energía/campo y registro del duelo; resultado por vida o límite del simulador.
- Mensajes de carga/error y recuperación de un estado actualizado ante conflicto de versión.

El controlador de la PC elige comandos que el backend debe validar. Fácil selecciona acciones disponibles al azar; Normal prioriza ataques; Difícil puntúa intercambios y daño, priorizando ataques letales. Ningún nivel usa la mano humana ni recibe ventajas de estadísticas o energía. El modo memoria de este documento conserva su simulador; para persistencia real en MariaDB consultar README-PERSISTENCIA.md. No se incorpora autenticación remota.

## Real frente a simulado

| Parte | Comportamiento |
|---|---|
| Frontend/API | React + Vite + TypeScript y Node + Express + TypeScript realmente ejecutándose y comunicándose por HTTP |
| Catálogo | Cuarenta estadísticas extraídas de la documentación existente, sin cambiarlas; referencia y SHA-256 en JSON |
| Colección | Dos copias de cada tipo como disponibilidad de demostración, sin inventario SQL |
| Mazos/duelos | Datos efímeros en memoria del backend; se pierden al reiniciar; no hay localStorage de juego ni base alternativa |
| Acciones | Simulador acotado en `backend/src/demo/`; ayuda a probar interacción, no es fuente definitiva de reglas |
| Salud | Estado del proceso y modo demo; informa explícitamente `database: not-connected` |
| SQL, estadísticas académicas, autenticación y remoto | Pendientes; no se crean ni modifican bases reales |

Los cambios de composición no reconstruyen duelos ya iniciados. El editor permite experimentar con mazos en memoria; las políticas de propiedad, inmutabilidad histórica, participantes y persistencia definitivas se implementarán después del MER/MR aprobado. El simulador utiliza versiones para rechazar acciones sobre snapshots viejos; eso **no prueba** aislamiento, bloqueos o ROLLBACK SQL, ni ofrece idempotencia SQL de producción.

Límites concretos de esta demo: inicia siempre el jugador 1, aunque se barajan los mazos en el escenario desde cero; la mesa preparada es un fixture visual sin historia completa. Se conservan como máximo treinta mazos y cincuenta mesas (se descarta la mesa más antigua al superar el límite) y sesenta líneas de registro por duelo. La respuesta HTTP contiene ambas manos para el modo presencial de confianza; la UI muestra solo la del actor y las desmonta durante la transición. Esto no es seguridad para multijugador remoto. Recargar toda la página pierde la referencia visual al duelo; no hay reanudación automática ni historial persistente, aunque el proceso conserve esa mesa hasta su reinicio/expulsión.

## Arquitectura y siguiente integración

```text
frontend/src/             Pantallas, componentes SVG y cliente HTTP
shared/contracts.ts       DTO de la API, no entidades SQL aprobadas
backend/src/app.ts        API, validación y traducción de errores
backend/src/repositories/ Frontera para reemplazar la fuente de datos
backend/src/demo/         Fixtures y comportamiento efímero reemplazable
scripts/extract-catalog.mjs  Extracción comprobable del catálogo Markdown
tests/e2e/                Recorridos reales de navegador
```

Las pantallas solicitan acciones y muestran el estado devuelto; no calculan daño definitivo ni guardan partidas. El contrato de repositorio admite operaciones asíncronas. Después de aprobar MER/MR, crear scripts/rutinas MariaDB, implementar el repositorio SQL y configurar la selección del proveedor en el backend. El simulador se conserva únicamente para demostración/pruebas o se retira; no se llama en paralelo para autorizar operaciones reales.

El próximo corte vertical recomendado es: seleccionar jugadores/mazos desde MariaDB → iniciar partida persistente → invocar mediante rutina SQL → pasar turno → consultar estado tras recargar. Luego combate, resultado e historial reales. PostgreSQL continúa como adaptación posterior sujeta al docente.

## Validaciones y compilación

```powershell
npm run catalog:check
npm run build
npm test
npm run test:build
npm run test:e2e
```

`catalog:check` compara las cuarenta filas y el hash con el Markdown fuente. No editar a mano las estadísticas del JSON. Solo cuando se cambie justificadamente la fuente, regenerar con `npm run catalog:extract` y revisar el cambio.

`build` compila backend y frontend con TypeScript y genera el bundle Vite. `npm test` ejecuta pruebas HTTP de backend y representación de componentes. `test:e2e` recorre la aplicación real y necesita navegador. En Windows se reutiliza Chrome o Edge instalado si está disponible; de lo contrario ejecutar `npx playwright install chromium`. Para elegir otro canal, establecer `PLAYWRIGHT_CHANNEL`. El runner inicia los servidores si no están activos y guarda diagnósticos en `tmp/playwright-results`.

`test:build` inicia los artefactos compilados en puertos efímeros, comprueba HTML/bundle y catálogo a través del proxy, y detiene esos procesos. `npm run check` ejecuta build, pruebas, smoke del build y navegador en orden. Las capturas verificables quedan en `artifacts/demo/`.

Para comprobar también los artefactos compilados, después de `npm run build`, usar dos terminales:

```powershell
npm run start --workspace backend
```

```powershell
npm run preview --workspace frontend
```

Estos comandos sirven para verificación local del build; no realizan despliegue. Resultados concretos de las comprobaciones de este corte en [DEMO-VALIDACION.md](DEMO-VALIDACION.md).

## Colección y selección de perfiles

Los selectores agrupan alfabéticamente jugadores y perfiles de demostración. La interfaz oculta nombres con prefijos TEST, pruebas, testing o e2e, los nombres automáticos conocidos de las suites UI/Retry/Combate con sufijo hexadecimal, `combate-UUID` y los perfiles `Academia TA v1 Jugador NN` de las pruebas académicas existentes. También oculta sus mazos y los mazos nombrados explícitamente como pruebas. Es un criterio de presentación por nombre para los datos existentes: no elimina registros ni constituye autenticación o control de acceso.

En Colección, “Armar mazo aleatorio de 20 cartas” abre un nuevo borrador en Mis mazos. Toma cartas de toda la colección del jugador seleccionado, con hasta dos copias por tipo y sin superar sus cantidades disponibles; los filtros de búsqueda/palo no restringen el sorteo. Permite revisar, editar, nombrar y guardar mediante la API existente. El editor también permite volver a sortear la composición de un mazo editable; los mazos usados conservan su bloqueo. Si faltan cartas, muestra un aviso sin crear un mazo incompleto. En MariaDB la validación final continúa en SQL.

El botón para volver a sortear está dentro del panel “Tu composición”. Al guardar se consulta la lista actual del propietario: un nombre nuevo crea un mazo, aunque antes se haya seleccionado otro; un nombre coincidente solicita confirmación antes de reemplazar su composición. Cancelar no escribe cambios. La comparación recorta espacios externos e ignora mayúsculas y acentos; se conserva la grafía del nombre existente. Un mazo usado sigue siendo inmutable y requiere otro nombre. Distintos jugadores pueden usar el mismo nombre y reutilizar cartas entre sus propios mazos, respetando los límites de cada composición.

Las confirmaciones de reemplazo y eliminación usan una ventana del juego con Cancelar, confirmación explícita y cierre con Escape. Cada mazo tiene una cruz independiente de su botón de selección. Eliminar no consume cartas: los mazos SQL nunca usados se borran junto con su composición; los usados se archivan, desaparecen de los selectores y conservan las referencias de sus partidas. El nombre de un mazo archivado usado queda reservado por la restricción única existente. La demo en memoria elimina su registro y conserva los estados de las partidas ya iniciadas.

## Jugar contra la PC y arrastre

La preparación se realiza en `#/jugar`, accesible desde el menú lateral y desde Mis mazos. Allí se eligen perfil humano, su mazo, perfil/mazo del rival y dificultad; las partidas nuevas de la UI comienzan contra la PC por defecto. En SQL, el sorteo inicial permanece a cargo de MariaDB: la perspectiva humana se fija al perfil elegido, aunque comience la PC. Las partidas antiguas sin configuración local usan como humano al primer participante registrado.

Las acciones de la PC usan los mismos endpoints, control de versión y claves de reintento que las humanas. No se agregó una segunda resolución de combate ni se modificaron SQL, backend, catálogo o reglamento. Las pausas de 650–1300 ms entre decisiones y la animación de llegada son presentación. El modo presencial opcional conserva la transición privada anterior.

La dificultad y el perfil humano de cada partida, junto con las ubicaciones visuales de cartas en los tres espacios, se conservan en localStorage de este navegador. El servidor conserva la zona y estado reglamentarios; la ubicación visual no agrega reglas de combate. La PC actúa mientras la pantalla de arena está abierta y puede continuar al recuperarla. Una acción con resultado incierto conserva la misma solicitud y muestra el reintento existente; no se generan comandos adicionales hasta confirmarla. Tras recargar una partida SQL se conserva la elección de rival en el mismo navegador; estas preferencias aún no se sincronizan entre dispositivos.

Verificación específica: `frontend/test/computer.test.tsx` cubre decisiones válidas, protección del héroe, energía, agotamiento, ausencia de lectura de mano humana y partidas completas por API para los tres niveles. `tests/e2e/computer.spec.ts` prueba el flujo Jugar y arrastre real con mouse y táctil; `tests/sql-e2e/computer.spec.ts` verifica los tres niveles, invocaciones/ataques SQL, perspectiva y recarga durante el turno automático. Capturas en `artifacts/computer/`.

Los ataques confirmados reproducen avance de la carta, impacto y números de vida perdida en ambos objetivos del intercambio, incluido el héroe. Las cartas derrotadas se desvanecen y salen del campo antes de actualizar el descarte. Los valores se toman de los estados devueltos por la API: no se calcula daño ni se modifica el resultado desde la animación. Los replays y refrescos no reproducen impactos antiguos; al cambiar de pantalla se cancelan y limpian los efectos. Se respeta `prefers-reduced-motion`. Pruebas en `tests/e2e/combat-animation.spec.ts` y `tests/sql-e2e/combat.spec.ts`; captura en `artifacts/combat-effects/impacto.png`.

Si el campo rival está vacío, tocar una carta propia lista para atacar envía directamente el ataque al héroe; no requiere tocar su nombre. Si hay defensores, primero se elige el atacante y después una carta enemiga. Se mantienen el bloqueo de cartas recién invocadas, una acción de ataque por carta y turno, y las validaciones SQL existentes.

El formato recomendado para mazos nuevos es ahora de **20 cartas**. Editor y armado aleatorio usan ese tamaño; Jugar prioriza los mazos de 20 y exige que ambos rivales tengan igual cantidad. Los clásicos de 12 permanecen compatibles y las partidas iniciadas conservan sus copias originales. Hay un mazo de 20 adicional por perfil demo. Para actualizar una instalación anterior: `npm run db:update:deck-size`; detalles en [la nota de migración](database/mariadb/README-decks-20.md). El cambio de la versión jugable no registra aprobación académica del reglamento.

Si los perfiles elegidos ya tienen partidas activas, Jugar muestra enlaces para continuarlas y un botón **Empezar de cero**. La confirmación identifica las partidas que se cerrarán. MariaDB conserva su historial y las marca con motivo administrativo `REINICIO`, sin victoria ni empate; crea la nueva partida en la misma transacción. Cancelar no cambia nada y un fallo del nuevo inicio restaura las anteriores.
