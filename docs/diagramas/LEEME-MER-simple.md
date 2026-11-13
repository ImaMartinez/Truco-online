# TrucoOnline — MER conceptual simple

Archivo para importar: **TrucoOnline-MER-simple.xml**. La versión **TrucoOnline-MER-simple.drawio** contiene el mismo XML y puede abrirse directamente con draw.io/diagrams.net. Las formas, textos, relaciones y cardinalidades son editables; no es una imagen incrustada.

En diagrams.net: **Archivo → Importar desde → Dispositivo**, seleccionar el XML. También puede usarse Archivo → Abrir desde → Dispositivo con el `.drawio`.

Incluye siete entidades principales: Jugador, Mazo, Carta, Sala, Partida, Turno y Jugada. Notación Chen: rectángulos para entidades, rombos para acciones y óvalos para atributos de relaciones. Los intervalos mínimo/máximo junto a cada entidad cuentan sus participaciones, no usan la convención de cardinalidad del extremo opuesto propia de otras notaciones.

| Lectura conceptual | Cardinalidad por instancia | Origen en el SQL |
|---|---|---|
| Jugador crea Mazo | Jugador 0..N; Mazo 1 | `mazo.id_jugador` |
| Jugador colecciona Carta | Jugador 0..40 tipos; Carta 0..N jugadores | `coleccion_jugador`, cantidad como atributo del rombo |
| Mazo contiene Carta | Mazo 0..N tipos; Carta 0..N mazos | `mazo_carta`, cantidad como atributo del rombo; límites en la nota del diagrama |
| Jugador participa en Partida | Jugador 0..N; Partida exactamente 2 | `participante_partida` más propietario del mazo; posición y vida en la relación |
| Partida usa Mazo | Partida exactamente 2; Mazo 0..N | `participante_partida.id_mazo` |
| Jugador crea Sala | Jugador 0..N; Sala exactamente 1 anfitrión | `sala.id_anfitrion` |
| Jugador se une a Sala | Jugador 0..N; Sala 0..1 invitado | `sala.id_invitado` |
| Sala origina Partida | Sala 0..1; Partida 0..1 | `sala.id_partida`; CPU no necesita sala |
| Partida contiene Turno | Partida 1..30; Turno exactamente 1 partida | `turno.id_partida` |
| Turno registra Jugada | Turno 0..N; Jugada exactamente 1 turno | `jugada.id_turno` |

Las tablas asociativas no se presentan como cajas: sus hechos se expresan mediante relaciones. La propiedad del mazo y la obligación de elegir un mazo propio por participante siguen siendo reglas del dominio; las dos relaciones binarias no sustituyen esa restricción.

Es una proyección conceptual simplificada de la implementación vigente: no pretende dibujar las 28 FK físicas. Se omiten Auth, intentos de recuperación, recibos idempotentes, reservas de mazos en sala y el detalle de instancias/subtipos de combate. `Carta` representa el tipo del catálogo; dos copias del mismo tipo no se confunden en el SQL real, aunque aquí no se desplieguen. La especialización física Invocación/Ataque se resume en Jugada. No se modifica el SQL ni el MER académico anterior, y no se atribuye aprobación docente o grupal.

Fuentes: `database/postgres/install/TrucoOnline-completo.sql`, metadatos de `tests/postgres/schema-baseline.json`, rutinas de salas y reglamento vigente de mazos 12/20. La correspondencia exacta de lo incluido se conserva en `TrucoOnline-MER-simple-mapeo.json`.

Generación: `node scripts/build-mer-simple.mjs`. Se validó la sintaxis XML, IDs únicos, referencias de conectores y renderizado mediante GraphViewer oficial de diagrams.net, sin errores de página. Captura: `artifacts/mer-simple/TrucoOnline-MER-simple.png`, excluida de Git. Se inspeccionó la captura para comprobar textos, márgenes y conectores.

Referencia del formato: [edición del XML oficial de draw.io](https://www.drawio.com/docs/manual/advanced/diagram-source-edit/).
