# Prompt para Codex — Truco Arena: primer corte ejecutable

Actuá como desarrollador full stack senior, respetando estrictamente la consigna universitaria de Truco Arena y el trabajo existente en el repositorio.

## Contexto y fuente de verdad

- Antes de hacer cambios, inspeccioná `README.md`, `docs/etapa-0/`, `docs/hito-1/` y `docs/siguiente-paso/` si existe.
- El reglamento de referencia es el **0.2**, todavía sujeto a validación del equipo. No cambies sus reglas sin documentar una propuesta separada.
- El MER definitivo lo debe dibujar, comprender y validar el equipo. No presentes un modelo IA como aprobado.
- El motor académico principal es MariaDB 10.4.32 en XAMPP. Supabase/PostgreSQL queda como adaptación posterior sujeta a aprobación docente.
- Existe un catálogo de 40 cartas en la documentación de Etapa 0: **reutilizá sus estadísticas; no las reescribas de memoria**.

## Objetivo de esta ejecución

Quiero que **dejemos de producir solo documentos** y obtengamos un **primer corte ejecutable en localhost**, sin crear todavía las tablas definitivas.

Entregables:

1. `frontend/` funcionando en React + Vite + TypeScript.
2. `backend/` funcionando en Node.js + Express + TypeScript.
3. Inicio de Truco Arena, catálogo visual de cartas y tablero de duelo en modo **demostración**.
4. API `GET /api/health` que devuelva estado básico verificable, sin exponer secretos.
5. Configuración Vite para comunicarse con `/api` del backend local.
6. Scripts `dev`, `build`, `test` o equivalentes justificadamente mínimos; `.env.example`, `.gitignore` y README de ejecución.
7. Una muestra visual del sistema 20 vidas / energía 1–5 / tres espacios de campo; señalar claramente lo que aún es MOCK.
8. Pruebas básicas de compilación, respuesta de salud y representación del catálogo.

## Qué implementar ahora

- Componentes reutilizables `Card`, `PlayerPanel`, `Battlefield`, `EnergyCounter`, `GameHeader` o nombres equivalentes.
- Diseño responsive inspirado en naipes españoles y mesa de Truco (estética original, sin copiar recursos de terceros).
- Una pantalla inicial y otra de tablero de ejemplo navegable.
- Cargar el catálogo real desde una fuente estructurada ya existente **si está disponible**; si no, usar datos demo mínimos, marcados como simulación, y dejar preparada la conexión a una futura API de catálogo.
- Separar claramente representación de UI, datos de demostración y futura integración SQL.
- Agregar instrucciones simples para levantar ambos procesos en Windows.

## Qué NO implementar todavía

- No crear `CREATE TABLE`, migraciones, procedimientos, triggers ni ejecutar escrituras sobre MariaDB.
- No modificar los 24 documentos anteriores ni dar por aprobados B1–B4.
- No simular que un botón está conectado a SQL cuando no lo está.
- No implementar autenticación, multijugador remoto, IA rival, sobres, economía ni intercambios.
- No conectar secretos de Supabase ni publicar en internet.
- No realizar commits, pushes ni despliegues.

## Arquitectura esperada

- API REST entre React y Node.
- TypeScript en ambos proyectos.
- Componentes y archivos pequeños, fáciles de entender.
- Ningún dato crítico de juego guardado como si fuera persistencia real en el frontend.
- La futura lógica SQL debe poder imponerse desde MariaDB; no construir una lógica de combate definitiva paralela en JavaScript.
- No instalar dependencias masivas innecesarias.

## Validación y respuesta final

Ejecutá los comandos de instalación, compilación y pruebas disponibles; no inventes resultados. Mostrá las rutas/capturas o salidas que realmente puedas comprobar. Documentá exactamente qué funcionalidades son reales, cuáles son mock y qué falta para integrar MariaDB.

Al finalizar, respondé con:

1. Archivos creados o modificados.
2. Comandos para arrancar frontend y backend.
3. Pruebas ejecutadas y resultados (o limitaciones).
4. Funcionalidades navegables.
5. Riesgos o decisiones pendientes.
6. Próximo corte vertical recomendado después del MER/MR aprobado.

Quiero una primera versión que **se pueda abrir y ver**, no otro plan de 20 documentos. Conservá los archivos existentes y priorizá ejecución, claridad y capacidad de prueba.
