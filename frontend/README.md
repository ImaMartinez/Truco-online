# Frontend previsto

React, Vite, TypeScript y CSS responsive. Sin implementación ni dependencias en Etapa 0.

Pantallas previstas: inicio, perfiles locales, colección, editor de mazos, preparación/reanudación de partida, transición privada, tablero y resultado/historial/estadísticas.

Componentes compartidos: carta, reverso, indicador de vida/energía, filtros, mensajes de error y diálogo de confirmación. SVG originales para los naipes; navegación por teclado, texto además de color y respeto de movimiento reducido.

La API entrega catálogo y atributos. La interfaz no replica el catálogo ni decide si una acción es válida. Solo solicita acciones, muestra respuestas y permite anticipar restricciones para ayudar al usuario.

El único dato de entorno inicialmente previsto es la URL pública de API (`VITE_API_URL`). Nunca incluir contraseñas SQL, URL de conexión ni claves administrativas. Ver [arquitectura](../docs/etapa-0/04-arquitectura-y-sql.md).
