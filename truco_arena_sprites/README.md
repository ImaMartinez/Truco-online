# Assets v3 de las cartas

Los archivos canónicos son los 80 PNG/WebP de 240 × 360 de frontend/public/cards/v3/. La interfaz utiliza WebP y conserva fallback PNG. El arte procede del paquete aportado durante el desarrollo; la reorganización asistida de los sietes y la corrección posterior ORO-05 constan en la bitácora de IA. No se generan dibujos nuevos durante la limpieza.

- sprites.json: manifiesto original importado por SpriteCardArt; conserva códigos, palos, valores y metadatos de procedencia. Los campos png/webp y coordenadas pertenecen al paquete original; el componente construye la URL pública /cards/v3/CODIGO.webp y su fallback PNG.
- checksums.json: 80 hashes SHA-256 fijados tras comparar cada copia original con el archivo servido. Las pruebas comprueban integridad, códigos y dimensiones sin almacenar otra copia de las imágenes.

Se retiraron la carpeta cards duplicada, los dos atlas no utilizados, vistas de control históricas, CSS de ejemplo y prompt de integración. No tenían consumidores de ejecución. Se conserva una copia de revisión local y la lista exacta en docs/revision-final/manifest.json; las fuentes siguen recuperables de Git.

Las estadísticas no están embebidas como reglas en el arte: energía, ataque y vida llegan de la API. El manifiesto y el catálogo conservan su contenido anterior.
