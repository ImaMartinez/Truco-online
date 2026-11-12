# Propuesta de las 40 cartas

Estado: balance inicial 0.1, pendiente de partidas de prueba y revisión del grupo. No es un catálogo SQL ni una constante para copiar al frontend. Una vez aprobado, el catálogo se cargará en la base y se consultará desde la API.

## Criterio

Jerarquía **1 = más fuerte en el Truco tradicional**, 14 = más débil. Es un atributo de identidad y consulta; no desempata ni modifica el combate. Los valores 8 y 9 no existen en esta baraja.

Como punto de partida, todas las cartas satisfacen `ataque + vida = 2 × energía + 1`. Es una heurística de presupuesto, no una regla SQL ni una demostración de balance: ataque y vida no son intercambiables en todos los enfrentamientos. Los palos cambian perfiles ofensivos/defensivos sin efectos adicionales. Hay cartas con estadísticas idénticas; se acepta esa equivalencia para mantener un MVP simple.

Los anchos especiales cuestan 5 y tienen más vida que los ejemplos originales: 6/5 y 5/6. Se busca que sobrevivan a algunos intercambios después de invertir un turno completo de energía. Los reyes pueden tener alto ataque o alta vida; así la jerarquía no impone una progresión única. Los cuatro y cinco cuestan 1 y permiten disputar el campo desde el inicio.

## Catálogo propuesto completo

| Código documental | Nombre | Palo | Número | Ataque | Vida | Energía | Jerarquía |
|---|---|---|---:|---:|---:|---:|---:|
| ESP-01 | Ancho de espadas | Espadas | 1 | 6 | 5 | 5 | 1 |
| ESP-02 | Dos de espadas | Espadas | 2 | 3 | 2 | 2 | 6 |
| ESP-03 | Tres de espadas | Espadas | 3 | 4 | 3 | 3 | 5 |
| ESP-04 | Cuatro de espadas | Espadas | 4 | 1 | 2 | 1 | 14 |
| ESP-05 | Cinco de espadas | Espadas | 5 | 2 | 1 | 1 | 13 |
| ESP-06 | Seis de espadas | Espadas | 6 | 2 | 3 | 2 | 12 |
| ESP-07 | Siete de espadas | Espadas | 7 | 5 | 4 | 4 | 3 |
| ESP-10 | Diez de espadas | Espadas | 10 | 4 | 1 | 2 | 10 |
| ESP-11 | Once de espadas | Espadas | 11 | 5 | 2 | 3 | 9 |
| ESP-12 | Doce de espadas | Espadas | 12 | 6 | 3 | 4 | 8 |
| BAS-01 | Ancho de bastos | Bastos | 1 | 5 | 6 | 5 | 2 |
| BAS-02 | Dos de bastos | Bastos | 2 | 2 | 3 | 2 | 6 |
| BAS-03 | Tres de bastos | Bastos | 3 | 3 | 4 | 3 | 5 |
| BAS-04 | Cuatro de bastos | Bastos | 4 | 2 | 1 | 1 | 14 |
| BAS-05 | Cinco de bastos | Bastos | 5 | 1 | 2 | 1 | 13 |
| BAS-06 | Seis de bastos | Bastos | 6 | 1 | 4 | 2 | 12 |
| BAS-07 | Siete de bastos | Bastos | 7 | 2 | 3 | 2 | 11 |
| BAS-10 | Diez de bastos | Bastos | 10 | 1 | 4 | 2 | 10 |
| BAS-11 | Once de bastos | Bastos | 11 | 2 | 5 | 3 | 9 |
| BAS-12 | Doce de bastos | Bastos | 12 | 3 | 6 | 4 | 8 |
| ORO-01 | Ancho de oros | Oros | 1 | 4 | 3 | 3 | 7 |
| ORO-02 | Dos de oros | Oros | 2 | 3 | 2 | 2 | 6 |
| ORO-03 | Tres de oros | Oros | 3 | 4 | 3 | 3 | 5 |
| ORO-04 | Cuatro de oros | Oros | 4 | 1 | 2 | 1 | 14 |
| ORO-05 | Cinco de oros | Oros | 5 | 2 | 1 | 1 | 13 |
| ORO-06 | Seis de oros | Oros | 6 | 3 | 2 | 2 | 12 |
| ORO-07 | Siete de oros | Oros | 7 | 4 | 5 | 4 | 4 |
| ORO-10 | Diez de oros | Oros | 10 | 3 | 2 | 2 | 10 |
| ORO-11 | Once de oros | Oros | 11 | 4 | 3 | 3 | 9 |
| ORO-12 | Doce de oros | Oros | 12 | 5 | 4 | 4 | 8 |
| COP-01 | Ancho de copas | Copas | 1 | 3 | 4 | 3 | 7 |
| COP-02 | Dos de copas | Copas | 2 | 2 | 3 | 2 | 6 |
| COP-03 | Tres de copas | Copas | 3 | 3 | 4 | 3 | 5 |
| COP-04 | Cuatro de copas | Copas | 4 | 2 | 1 | 1 | 14 |
| COP-05 | Cinco de copas | Copas | 5 | 1 | 2 | 1 | 13 |
| COP-06 | Seis de copas | Copas | 6 | 2 | 3 | 2 | 12 |
| COP-07 | Siete de copas | Copas | 7 | 1 | 4 | 2 | 11 |
| COP-10 | Diez de copas | Copas | 10 | 2 | 3 | 2 | 10 |
| COP-11 | Once de copas | Copas | 11 | 3 | 4 | 3 | 9 |
| COP-12 | Doce de copas | Copas | 12 | 4 | 5 | 4 | 8 |

Los códigos son referencias de esta documentación; la elección de claves del modelo corresponde al Hito 2.

## Curva y dos mazos de referencia

El catálogo tiene 8 cartas de costo 1, 14 de costo 2, 10 de costo 3, 6 de costo 4 y 2 de costo 5. Un mazo inicial sugerido contiene 4/4/2/2/0 copias por costo: promedio ponderado 26/12 = 2,17. Permite empezar con cartas baratas y no obliga a usar los anchos especiales.

| Mazo propuesto | Composición (dos copias de cada código) |
|---|---|
| Mesa de espadas | ESP-04, ESP-05, ESP-02, ESP-06, ESP-03, ESP-07 |
| Ronda de copas | COP-04, COP-05, COP-02, COP-06, COP-03, COP-12 |

Cada uno suma 12 cartas y cumple el máximo de dos. No se exige una curva concreta al usuario: es una recomendación de construcción, no una restricción.

Con cuatro cartas de costo 1 en un mazo de doce, la probabilidad de no recibir ninguna en una mano de tres es `C(8,3)/C(12,3) = 56/220 ≈ 25,45 %`. Sin mulligan se acepta que algunos primeros turnos sean de paso; si resulta frustrante, discutir otro reparto o más cartas baratas antes de añadir habilidades.

## Riesgos de equilibrio y validación posterior

- El primer jugador tiene iniciativa para desplegar y atacar antes. Alternar quién comienza con los mismos mazos y registrar victorias por posición inicial.
- Como cualquier carta protege al héroe, las de vida alta pueden alargar las partidas. Medir finales por límite y turnos sin ataques; no declarar balanceado el sistema solo por el presupuesto numérico.
- Tres espacios hacen valiosas las cartas fuertes al final, pero los costos 1–2 permiten actuar antes y combinar invocaciones. Comparar curvas rápidas y pesadas, no solo mazos simétricos.
- Las estadísticas repetidas reducen diferenciación. La variedad del MVP proviene de la curva y los objetivos; habilidades por palo solo se considerarían después.
- Plan inicial de playtesting: al menos 20 partidas completas, alternando inicio y mazos, con vida final, causa de cierre, cartas invocadas, ataques, turnos sin acción y comentarios. Es exploratorio, no una muestra estadística suficiente para demostrar equidad.

No se jugaron ni simularon partidas en esta etapa. Solo se verifica la coherencia del catálogo y las cuentas documentales.
