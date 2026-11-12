# Diez consultas académicas sobre la implementación real

03/11/2026. Referencia de estudio y revisión del grupo; **B1–B4 y el MER/MR no están aprobados**. Se usa el esquema de trece tablas implementado, sin agregar columnas para producir estadísticas. El [diccionario preliminar](../hito-2/01-modelo-relacional-preliminar.md) conserva los nombres y atributos; la auditoría del modelo registra sus límites.

El código ejecutable tiene una única fuente: [06-consultas-academicas.sql](../../database/mariadb/06-consultas-academicas.sql), separado en marcadores `Q01`–`Q10`. Cada apartado siguiente identifica su bloque, tablas, funcionamiento y cumplimiento de la consigna. Los resultados reales, entorno y parámetros están en [la evidencia de ejecución](03-evidencia-ejecucion.md), con un apartado por consulta. No se sustituyen resultados reales por los ejemplos de tablas del MR ni por números calculados a mano.

## Convenciones comunes

- «Utilizada» significa **invocada exitosamente**, no incluida en un mazo o simplemente repartida. Q02 y Q05 usan la misma definición. Si el grupo decide medir presencia en el mazo inicial, debe cambiar ambos enunciados y fuentes de manera consistente; no confundir las dos métricas.
- Q01/Q03 cuentan únicamente partidas finalizadas. Q02/Q07/Q09/Q10 incluyen acciones confirmadas de partidas activas y finalizadas. Q08 distingue sus estados.
- Se conserva el historial de perfiles/mazos archivados: no hay filtros de archivo que hagan desaparecer victorias anteriores. El dueño se obtiene por `Participante_Partida → Mazo → Jugador`, conforme a B1 provisional.
- Las estadísticas provienen de las tablas existentes. Promedios, porcentajes, conteos y vidas posteriores no se almacenan. Se presupone el catálogo congelado y el historial válido creado por las rutinas autorizadas.
- Ejecutar sobre la base de desarrollo con una conexión que tenga `SELECT`. Para Q08 asignar antes `SET @jugador_id = <ID real>;` en esa misma conexión; el ID concreto utilizado debe aparecer en la evidencia. Sin asignarlo, la consulta devuelve cero filas porque la variable es NULL. El archivo de consultas no cambia de base ni contiene DML.

## Q01 — Jugadores con más victorias

**Enunciado:** listar jugadores que ganaron al menos una partida finalizada, ordenados por cantidad de victorias y, ante igualdad, por identificador.

**Código:** bloque `Q01` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `jugador`, `mazo`, `participante_partida`, `partida`.

Cada participación utiliza un mazo con dueño inmutable. Se eligen las participaciones cuya posición coincide con `ganador_posicion` de una partida finalizada, se agrupan por jugador y se cuentan. Una victoria genera una fila de participación ganadora, no dos. El orden secundario establece una presentación determinista, no una regla de desempate del juego.

**Consigna:** JOIN de cuatro tablas, agregación y `GROUP BY … HAVING`. **Resultado real:** apartado Q01 de [evidencia](03-evidencia-ejecucion.md#q01).

## Q02 — Cartas más utilizadas

**Enunciado:** contar las invocaciones exitosas por tipo de carta y en cuántas partidas distintas ocurrieron; mostrar primero los tipos más invocados.

**Código:** bloque `Q02` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `carta`, `copia_carta_partida`, `invocacion`, `participante_partida`.

`invocacion` referencia la copia individual; esta permite recuperar el tipo y la participación/partida. `COUNT(*)` mide invocaciones y `COUNT(DISTINCT id_partida)` mide alcance por partida. Invocar dos copias del mismo tipo en una partida incrementa el primer número en dos y el segundo en uno. Que una carta figure en `mazo_carta` no cuenta como haber sido jugada.

**Consigna:** JOIN de cuatro tablas y agregaciones. **Resultado real:** apartado Q02 de [evidencia](03-evidencia-ejecucion.md#q02).

## Q03 — Mazos con mejor rendimiento

**Enunciado:** comparar mazos con **al menos tres partidas finalizadas**, mostrando victorias, empates, derrotas y porcentaje de victorias.

**Código:** bloque `Q03` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `mazo`, `jugador`, `participante_partida`, `partida`.

Se agrupa por mazo y propietario; `HAVING COUNT(*) >= 3` excluye muestras menores. El porcentaje es `100 × victorias / partidas_finalizadas`, incluyendo empates en el denominador. Por lo tanto, cero victorias en tres empates produce 0%, no NULL. La suma de victorias, empates y derrotas debe ser igual a las partidas finalizadas. Las partidas activas no se cuentan como derrotas. Una tasa alta describe esa muestra: no demuestra equilibrio ni superioridad causal del mazo.

**Consigna:** JOIN de cuatro tablas, agregaciones y `GROUP BY … HAVING` con umbral significativo. **Resultado real:** apartado Q03 de [evidencia](03-evidencia-ejecucion.md#q03).

## Q04 — Promedio de energía de los mazos

**Enunciado:** obtener el total de copias y el promedio de costo energético de cada mazo, ponderado por la cantidad de copias de cada tipo.

**Código:** bloque `Q04` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `mazo`, `jugador`; en las subconsultas, `mazo_carta` y `carta`.

La subconsulta escalar correlacionada calcula `SUM(cantidad × costo_energia) / SUM(cantidad)` para el mazo de la fila externa. No se usa el promedio simple por tipos porque ignoraría cantidades diferentes. Las funciones de agregación sin GROUP BY producen un solo valor por mazo; `NULLIF` evita dividir por cero. Un borrador vacío tiene cero copias y promedio NULL, que significa «sin composición», no costo cero.

**Consigna:** **subconsulta escalar** correlacionada y agregación. Aunque la consulta externa solo une dos tablas, cumple expresamente la alternativa de subconsulta de la consigna. **Resultado real:** apartado Q04 de [evidencia](03-evidencia-ejecucion.md#q04).

## Q05 — Cartas nunca utilizadas en partidas

**Enunciado:** listar tipos del catálogo que no registran ninguna invocación exitosa en el historial consultado.

**Código:** bloque `Q05` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `carta`, `invocacion`, `copia_carta_partida`.

La tabla derivada reúne códigos distintos de cartas invocadas. Se hace `LEFT JOIN` desde el catálogo y se eligen los códigos sin coincidencia mediante `IS NULL`: ese es el anti-join. No basta unir todas las copias a invocación y filtrar una invocación nula: una carta podría tener una copia sin invocar y otra efectivamente jugada, y aparecería erróneamente como «nunca utilizada».

**Consigna:** **anti-join `LEFT JOIN … IS NULL`** y subconsulta de tabla derivada. **Resultado real:** apartado Q05 de [evidencia](03-evidencia-ejecucion.md#q05).

## Q06 — Jugadores que todavía no ganaron

**Enunciado:** mostrar todos los jugadores sin victorias registradas, incluyendo quienes aún no disputaron partidas.

**Código:** bloque `Q06` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `jugador`, `mazo`, `participante_partida`, `partida`.

La tabla derivada identifica ganadores distintos de partidas finalizadas. El LEFT JOIN se hace desde todos los perfiles, y `IS NULL` conserva quienes no aparecen entre los ganadores. No hay un INNER JOIN exterior a participaciones que excluya accidentalmente a jugadores sin historia. «Nunca ganó» no significa necesariamente «perdió»: puede no haber jugado, tener solo empates o tener una partida activa.

**Consigna:** anti-join y subconsulta con JOIN de tres tablas. **Resultado real:** apartado Q06 de [evidencia](03-evidencia-ejecucion.md#q06).

## Q07 — Cartas que más enemigos eliminaron

**Enunciado:** contar, por tipo de carta, eliminaciones de cartas enemigas, distinguiendo las causadas al atacar de las causadas al defender.

**Código:** bloque `Q07` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `carta`, `ataque`, `copia_carta_partida`, con roles diferentes para atacante y objetivo.

Primer tramo: si la vida previa del objetivo era menor o igual al ataque base del atacante, se acredita una eliminación al tipo atacante. Segundo tramo: si la vida previa del atacante era menor o igual al ataque base del defensor, se acredita una eliminación al tipo defensor. `UNION ALL` conserva las dos acreditaciones cuando ambos mueren. El INNER JOIN a la copia objetivo excluye ataques a héroes. Comparar vidas previas del evento evita atribuir una muerte posterior a cada ataque que había recibido la carta.

En el ejemplo del reglamento, 3/2 contra 2/3 acredita una eliminación a cada tipo: una al atacar y otra al defender. No se usan la vida actual ni la zona actual para reconstruir ese hecho histórico. El cálculo depende de que el catálogo continúe congelado.

**Consigna:** subconsulta con `UNION ALL`, relaciones entre múltiples tablas y agregación. **Resultado real:** apartado Q07 de [evidencia](03-evidencia-ejecucion.md#q07).

## Q08 — Historial de partidas por jugador

**Enunciado:** para el jugador indicado en `@jugador_id`, mostrar cada partida con rival, mazo utilizado, posición, vidas, fechas, motivo, último turno y resultado desde su perspectiva.

**Código:** bloque `Q08` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `participante_partida`, `mazo`, `partida`, `jugador`, `turno`; las tres primeras aparecen también con roles del rival.

La participación propia se obtiene mediante el dueño de su mazo. La participación rival comparte partida y tiene otro ID; sus nombres se recuperan a través de su mazo. El CASE diferencia ACTIVA/EMPATE/VICTORIA/DERROTA usando fecha de cierre y posición ganadora. Una subconsulta escalar devuelve el mayor número de turno guardado. No hay una columna `estado` ni un resultado duplicado almacenado.

**Consigna:** JOIN de varias tablas y subconsulta escalar. **Resultado real:** apartado Q08 de [evidencia](03-evidencia-ejecucion.md#q08), con el ID de jugador realmente usado.

## Q09 — Rendimiento por palo

**Enunciado:** mostrar, para cada palo, invocaciones, ataques iniciados, ataques a héroes, daño efectivo a héroes y eliminaciones de cartas enemigas.

**Código:** bloque `Q09` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `carta`, `invocacion`, `ataque`, `copia_carta_partida`.

Las CTE agregan primero cada métrica por tipo de carta. El SELECT exterior une esas filas ya resumidas al catálogo y agrupa por palo, conservando los cuatro aunque no tengan uso. Así se evita unir directamente múltiples invocaciones con múltiples ataques y multiplicar sus conteos. Las eliminaciones incluyen la defensa con la misma definición de Q07. El daño efectivo a héroes es `LEAST(vida_previa_objetivo, ataque_base)`: no contabiliza sobre-daño por debajo de cero.

«Rendimiento» se define aquí como actividad y producción de combate observadas. No se atribuye una victoria a un único palo ni se afirma que los palos tengan habilidades o ventajas. La CTE usa sintaxis disponible en MariaDB 10.4; su funcionamiento concreto se acredita al ejecutar el archivo en esa versión.

**Consigna:** subconsultas/CTE, agregaciones, LEFT JOIN de resultados derivados y GROUP BY. **Resultado real:** apartado Q09 de [evidencia](03-evidencia-ejecucion.md#q09).

## Q10 — Invocaciones y ataques por partida

**Enunciado:** listar todas las partidas con cantidad de turnos, jugadas, invocaciones y ataques, incluso si todavía no tienen acciones.

**Código:** bloque `Q10` del [script SQL](../../database/mariadb/06-consultas-academicas.sql). **Tablas:** `partida`, `turno`, `jugada`, `invocacion`, `ataque`.

El recorrido parte de Partida con LEFT JOIN a turnos, jugadas y subtipos. Cada hijo comparte la PK de Jugada: esos JOIN son 0..1 por padre y no forman un producto N×M de listas de ataques e invocaciones. `COUNT` de IDs de cada subtipo ignora los NULL; `COUNT(DISTINCT id_turno)` evita contar un turno varias veces cuando tiene varias jugadas. Con la especialización total/disjunta válida, `jugadas_registradas = invocaciones + ataques`; finalizar turno no agrega Jugada.

**Consigna:** JOIN de cinco tablas y agregación. **Resultado real:** apartado Q10 de [evidencia](03-evidencia-ejecucion.md#q10).

## Lista de comprobación para la defensa

| Exigencia | Consultas que la muestran |
|---|---|
| Cada consulta tiene JOIN de al menos tres tablas o una subconsulta | Q01/Q02/Q03/Q08/Q10 usan varias tablas; Q04/Q05/Q06/Q07/Q09 contienen subconsultas |
| LEFT JOIN e IS NULL como anti-join | Q05 y Q06 |
| Subconsulta escalar | Q04 y Q08 |
| GROUP BY con HAVING | Q01 y Q03; Q03 exige al menos tres finalizadas |
| Agregaciones sin multiplicación de eventos | Q02, Q03, Q07, Q09, Q10 |
| Atributo propio de N:M observable | Q04 pondera por `mazo_carta.cantidad` |
| Especialización con utilidad observable | Q02, Q07 y Q10 consultan invocaciones/ataques reales |

Antes de entregar, el grupo debe poder explicar cada fila y comparar los totales con el conjunto reproducible de pruebas. El SQL no incorpora límites TOP/LIMIT que oculten resultados al corregir. La evidencia debe conservar el resultado completo o un archivo de salida enlazado, indicando explícitamente cualquier resumen de presentación. Ejecutar una consulta sin error acredita compatibilidad; los casos de prueba son los que comprueban también su significado.
