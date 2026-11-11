# Resultados del primer corte ejecutable

Fecha del contexto del usuario: 02/11/2026, America/Buenos_Aires. Trabajo autorizado: demo local con React/Vite/TypeScript y Express/TypeScript, sin bases reales y sin aprobación implícita de B1–B4.

## Entorno y dependencias comprobadas

Windows, Node 24.16.0, npm 11.13.0. Instalación ejecutada con `npm install`, con lockfile generado: 110 paquetes agregados y auditoría de esa instalación sin vulnerabilidades reportadas. `npm ls --depth=0` resolvió las dependencias sin errores.

Dependencias principales: React/React DOM 19.3.1, Vite 8.3.5, Express 5.3.0, TypeScript 7.0.2, tsx 4.23.15 y Playwright 1.64.1. Navegador E2E: Google Chrome instalado, versión comprobada 156.0.8078.76. No se descargó un navegador adicional ni se instaló un driver SQL.

## Validación final ejecutada

`npm run check` terminó con código 0 después de corregir los defectos encontrados. Ejecuta las comprobaciones en orden y se detiene si alguna falla.

| Comando/comprobación | Resultado real |
|---|---|
| `npm run catalog:check` | 40 cartas idénticas al documento fuente, con referencia/hash; sin modificar estadísticas |
| `npm run build` | TypeScript de ambos proyectos correcto; bundle Vite generado (26 módulos) |
| Pruebas backend, dentro de `npm test` | **14/14 pasan** |
| Pruebas frontend, dentro de `npm test` | **3/3 pasan** |
| `npm run test:build` | Backend compilado, frontend `dist`, HTML/bundle y proxy de API con 40 cartas comprobados en puertos efímeros; procesos detenidos por el test |
| `npm run test:e2e` | **8/8 pasan** en Chrome; última ejecución 11,3 s |
| Preservación | Los 32 archivos preexistentes conservaron su SHA-256; incluye documentación académica, README y .gitignore |

No se ejecutaron comandos ni pruebas sobre MariaDB o Supabase. Las pruebas de memoria no demuestran FK, CHECK, triggers, permisos, bloqueos, atomicidad ni ROLLBACK de una base real.

### Cobertura comprobada

Las pruebas HTTP usan servidores efímeros e independientes: salud sin secretos, catálogo exacto, guardar/editar/rechazar mazos, manos/robo/instancias, invocación y consumo, campo completo/energía insuficiente sin mutación, preparación/ataque único, protección del héroe, daño simultáneo/doble muerte, conflictos de versión, victoria por vida, empate al global 30 y JSON inválido/excesivo/rutas inexistentes. También se verificó la carga opcional de `.env` con otro puerto en un proceso real.

Las tres pruebas de componentes comprueban presentación de datos HTTP y vida actual, escape de contenido y los cuatro palos originales sin imágenes externas.

Los ocho recorridos de navegador comprueban salud/catálogo por proxy; inicio y colección con filtros/orden/detalle; crear un borrador y rechazar inicio incompleto; invocar/atacar/cambiar turno y volver sin revelar mano; cuatro pantallas a 375 px sin desborde horizontal al estabilizarse; error de conexión y reintento; treinta turnos hasta resultado/reinicio; y capturas reales.

En las primeras comprobaciones se corrigieron el retorno del foco al cerrar el detalle y la contención del abanico decorativo en móvil. La revisión de código también corrigió la transición al volver a Arena, el estado residual al reiniciar, la edición durante guardado y el enlace de salto al contenido. La comprobación final usa semántica de región para la transición, que permite navegar fuera de ella y no finge ser un modal global.

## Evidencia visual

- [Inicio](artifacts/demo/inicio.png), escritorio 1440 px.
- [Tablero](artifacts/demo/tablero.png), escritorio 1440 px.
- [Tablero móvil](artifacts/demo/tablero-movil.png), ancho 375 px.

Se inspeccionaron capturas reales de escritorio/móvil. No son mockups generados ni acreditan pruebas en todos los navegadores/dispositivos. Los diagnósticos de Playwright pueden quedar en `tmp/playwright-results/` y `.playwright-mcp/`; no forman parte del runtime de la aplicación.

## Archivos agregados y límites

El corte agrega paquetes/configuración de frontend/backend, `shared/contracts.ts`, extractor y catálogo JSON de demostración, componentes/pantallas/estilos/SVG, adaptador en memoria, API/validación/errores, pruebas, lockfile, configuración Playwright y scripts raíz. Guía actual de ejecución: [README-DEMO.md](README-DEMO.md). Los README académicos originales se preservaron aunque describan la etapa anterior sin aplicación.

La navegación, los componentes y la comunicación HTTP son reales. Colección, mazos, duelos, acciones y registro son simulación efímera. No hay autenticación, bot, juego remoto, historial persistente ni reanudación automática después de recargar la página. La API de demo devuelve ambas manos y la interfaz aplica ocultación presencial, no seguridad adversarial. El iniciador es fijo en esta demo; el escenario preparado no reconstruye una historia completa. Los detalles y límites de memoria están en README-DEMO.

La lógica reemplazable vive exclusivamente en `backend/src/demo/`; el frontend solicita comandos y muestra snapshots. El repositorio admite operaciones asíncronas para poder incorporar después rutinas MariaDB sin rehacer las pantallas. El simulador no deberá autorizar operaciones de una partida SQL ni considerarse regla definitiva.

## Bitácora de IA de este corte

El usuario autorizó expresamente el inicio de implementación, manteniendo los documentos y decisiones académicas pendientes. La IA implementó el código de demo, extrajo los datos documentados y ejecutó las validaciones indicadas; agentes paralelos trabajaron frontend, backend y revisión independiente, con integración y pruebas finales en el mismo repositorio. Este registro nuevo preserva la bitácora anterior sin atribuir aprobaciones o trabajo manual al grupo.

No se realizaron commits, pushes ni despliegues. Próximo corte, después de aprobar MER/MR: rutinas y repositorio MariaDB para iniciar una partida, invocar, pasar turno y consultar el estado persistido; luego combate e historial SQL.
