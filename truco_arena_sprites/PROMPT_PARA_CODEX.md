# Codex — integrar sprites v3 conservando el estilo original

Tenemos un paquete de 40 cartas españolas, actualizado desde el anterior.

## Objetivo

Usar este **ZIP v3 como fuente definitiva para los sprites** de Truco Arena. El atlas y los 40 archivos individuales se actualizaron juntos.

- Mantener el mismo estilo visual tradicional del proyecto y los 36 naipes no modificados.
- Sustituir los cuatro sietes con `BAS-07`, `COP-07`, `ESP-07` y `ORO-07` nuevos. Sus símbolos están reorganizados, no rediseñados de otro estilo.
- Preferir `cards/<CODIGO>.webp` en React, con `<img>` sin recorte; el atlas permite alternativa con `sprites.json`.
- Utilizar en colección, editor, mano, campo y modal. Conservar el aspecto 2:3 y comprobar tamaños móviles y escritorio.
- Seguir superponiendo las insignias de energía/ataque/vida **desde el estado dinámico**, no como parte de la textura de carta.
- No cambiar identificadores ni orden de los 40 códigos del catálogo.

## Condiciones no negociables

No modificar base de datos, SQL, endpoints, estadísticas, reglamento, lógica de turnos, ataque, daño, persistencia ni autenticación. No realizar commits ni despliegues.

## Validación

1. Que existan las 40 imágenes WebP y sus PNG, todas de 240×360.
2. Que los cuatro sietes muestren exactamente siete símbolos centrales del palo, excluyendo miniaturas de esquina.
3. Que la ilustración se vea proporcional y no se recorte en ninguna pantalla ni en el modal.
4. Que la selección, armado de mazos e invocación sigan funcionando.
5. Que el modo MariaDB y la demo de memoria conserven su funcionamiento.
6. Tomar capturas de la colección en escritorio/móvil y de los cuatro sietes.

Informá archivos modificados, pruebas realizadas y cualquier desviación. No vuelvas a generar las ilustraciones con CSS.
