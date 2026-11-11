# Truco Arena — Sprites versión 3 (estilo original)

Revisión del paquete original `truco_arena_sprites_40(1).zip`, usando los cuatro sietes PNG proporcionados como **fuente del estilo**. No se utilizaron ilustraciones de otros estilos para el paquete final.

## Cambios visuales

Corrección puntual posterior (2026-11-04): `ORO-05` contiene ahora cinco monedas centrales en quincunce (dos arriba, una central y dos abajo). Se actualizaron sus archivos individuales PNG/WebP y la celda correspondiente de ambos atlas; el marco y los números originales se conservaron. Las vistas de control JPG/PNG previas son históricas; la captura vigente está en `artifacts/oro05-correction/`. No se modificaron las otras 39 cartas individuales.

Solo se reorganizó el arte central de:

- `BAS-07`: 3 bastos arriba, 1 horizontal central, 3 abajo.
- `ESP-07`: 3 espadas arriba, 1 horizontal central, 3 abajo.
- `COP-07`: 2 copas arriba, 1 central, 2 debajo y 2 inferiores.
- `ORO-07`: 2 oros arriba, 1 central, 2 debajo y 2 inferiores.

Los elementos de cada carta provienen del **mismo naipe original proporcionado** y mantienen su paleta, delineado y proporción del marco. Las **otras 36 cartas no fueron modificadas**.

## Estructura

- `cards/*.png`: 40 recortes PNG de 240 × 360 px.
- `cards/*.webp`: sus equivalentes WebP, 240 × 360 px.
- `truco_arena_sprite_40.png` / `.webp`: atlas 10 columnas × 4 filas, 2400 × 1440 px.
- `sprites.json`: mapa de posiciones y códigos exactos.
- `vista_40_cartas.jpg`: vista de control de las 40.
- `vista_sietes_corregidos.png`: vista de los cuatro cambios.
- `PROMPT_PARA_CODEX.md`: instrucciones de integración.

**No se embeben estadísticas** en los gráficos; seguir mostrando energía, ataque y vida desde los componentes React y los datos SQL.

El arte sigue siendo raster de 240 × 360 px por carta, no un SVG editable. Evitar zooms excesivos; escalar conservando `aspect-ratio: 2/3`.
