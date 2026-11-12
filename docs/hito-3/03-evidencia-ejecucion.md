# Evidencia real de ejecución

2026-11-03T17:31:01.516Z. MariaDB 10.4.32-MariaDB; instancia temporal propia en puerto 62384, sin modificar otras bases de XAMPP. Instalación desde ausencia de truco_arena_dev; carga y recarga idempotente comprobadas. B1–B4 y 3FN pendientes de revisión humana.

## Datos iniciales

| tabla | filas |
|---|---|
| jugador | 20 |
| carta | 40 |
| coleccion_jugador | 800 |
| mazo | 20 |
| mazo_carta | 120 |
| partida | 19 |
| participante_partida | 38 |
| copia_carta_partida | 456 |
| turno | 533 |
| solicitud_operacion | 730 |
| jugada | 191 |
| invocacion | 76 |
| ataque | 115 |

Vista v_coleccion_jugador: 800 filas. La pantalla Colección usa /api/players/:id/collection y el repositorio consulta esta vista.

## Transacción y rollback

Partida de fixture 19, copia 446. Se ejecutó BEGIN → CALL ta_invocar → SIGNAL controlado después de la invocación → ROLLBACK. El CALL terminó correctamente y se observaron sus cambios dentro de la transacción; el estado posterior al rollback coincide exactamente con el anterior. Esta prueba muestra el rollback externo sobre una operación real, además de la limpieza local SAVEPOINT que ya poseen las rutinas.

Antes:

| version | energia_disponible | id_copia | zona | vida_actual |
|---|---|---|---|---|
| 27 | 5 | 445 | DESCARTE | 0 |
| 27 | 5 | 446 | MANO | NULL |
| 27 | 5 | 447 | MANO | NULL |
| 27 | 5 | 448 | MANO | NULL |
| 27 | 5 | 449 | MANO | NULL |
| 27 | 5 | 450 | CAMPO | 1 |
| 27 | 5 | 451 | MANO | NULL |
| 27 | 5 | 452 | MANO | NULL |
| 27 | 5 | 453 | MANO | NULL |
| 27 | 5 | 454 | CAMPO | 2 |
| 27 | 5 | 455 | MANO | NULL |
| 27 | 5 | 456 | MANO | NULL |

Dentro de la transacción:

| version | energia_disponible | id_copia | zona | vida_actual |
|---|---|---|---|---|
| 28 | 4 | 445 | DESCARTE | 0 |
| 28 | 4 | 446 | CAMPO | 1 |
| 28 | 4 | 447 | MANO | NULL |
| 28 | 4 | 448 | MANO | NULL |
| 28 | 4 | 449 | MANO | NULL |
| 28 | 4 | 450 | CAMPO | 1 |
| 28 | 4 | 451 | MANO | NULL |
| 28 | 4 | 452 | MANO | NULL |
| 28 | 4 | 453 | MANO | NULL |
| 28 | 4 | 454 | CAMPO | 2 |
| 28 | 4 | 455 | MANO | NULL |
| 28 | 4 | 456 | MANO | NULL |

Después del ROLLBACK:

| version | energia_disponible | id_copia | zona | vida_actual |
|---|---|---|---|---|
| 27 | 5 | 445 | DESCARTE | 0 |
| 27 | 5 | 446 | MANO | NULL |
| 27 | 5 | 447 | MANO | NULL |
| 27 | 5 | 448 | MANO | NULL |
| 27 | 5 | 449 | MANO | NULL |
| 27 | 5 | 450 | CAMPO | 1 |
| 27 | 5 | 451 | MANO | NULL |
| 27 | 5 | 452 | MANO | NULL |
| 27 | 5 | 453 | MANO | NULL |
| 27 | 5 | 454 | CAMPO | 2 |
| 27 | 5 | 455 | MANO | NULL |
| 27 | 5 | 456 | MANO | NULL |

Error controlado: ERROR_CONTROLADO_DESPUES_DE_INVOCAR.

## Diez consultas

@jugador_id=5 (Academia TA v1 Jugador 01). Resultados completos de la instancia limpia; IDs/fechas/sorteos pueden variar en otra instalación. Código y explicaciones en [consultas](02-consultas-academicas.md).


La misma invocación fue repetida después con BEGIN/CALL/COMMIT: el estado confirmado coincide con el observado dentro de la transacción exitosa. Los conteos y consultas anteriores corresponden a la carga inicial, antes de esta demostración.

Estado confirmado:

| version | energia_disponible | id_copia | zona | vida_actual |
|---|---|---|---|---|
| 28 | 4 | 445 | DESCARTE | 0 |
| 28 | 4 | 446 | CAMPO | 1 |
| 28 | 4 | 447 | MANO | NULL |
| 28 | 4 | 448 | MANO | NULL |
| 28 | 4 | 449 | MANO | NULL |
| 28 | 4 | 450 | CAMPO | 1 |
| 28 | 4 | 451 | MANO | NULL |
| 28 | 4 | 452 | MANO | NULL |
| 28 | 4 | 453 | MANO | NULL |
| 28 | 4 | 454 | CAMPO | 2 |
| 28 | 4 | 455 | MANO | NULL |
| 28 | 4 | 456 | MANO | NULL |

<a id="q01"></a>

### Q01 — Jugadores con más victorias en partidas finalizadas.

6 filas.

| id_jugador | alias | victorias |
|---|---|---|
| 5 | Academia TA v1 Jugador 01 | 2 |
| 7 | Academia TA v1 Jugador 03 | 2 |
| 9 | Academia TA v1 Jugador 05 | 2 |
| 11 | Academia TA v1 Jugador 07 | 2 |
| 13 | Academia TA v1 Jugador 09 | 2 |
| 15 | Academia TA v1 Jugador 11 | 2 |

<a id="q02"></a>

### Q02 — Cartas más utilizadas: invocaciones exitosas, no simples inclusiones en mazos.

5 filas.

| id_carta | nombre | palo | invocaciones | partidas_con_invocacion |
|---|---|---|---|---|
| ESP-02 | Dos de espadas | espadas | 20 | 10 |
| BAS-04 | Cuatro de bastos | bastos | 19 | 19 |
| ORO-02 | Dos de oros | oros | 18 | 9 |
| BAS-02 | Dos de bastos | bastos | 10 | 10 |
| COP-02 | Dos de copas | copas | 9 | 9 |

<a id="q03"></a>

### Q03 — Rendimiento de mazos con al menos tres partidas finalizadas; incluye empates en el denominador.

12 filas.

| id_mazo | nombre | id_jugador | alias | partidas_finalizadas | victorias | empates | derrotas | porcentaje_victorias |
|---|---|---|---|---|---|---|---|---|
| 5 | Academia TA v1 Mazo 01 | 5 | Academia TA v1 Jugador 01 | 3 | 2 | 1 | 0 | 66.67 |
| 7 | Academia TA v1 Mazo 03 | 7 | Academia TA v1 Jugador 03 | 3 | 2 | 1 | 0 | 66.67 |
| 9 | Academia TA v1 Mazo 05 | 9 | Academia TA v1 Jugador 05 | 3 | 2 | 1 | 0 | 66.67 |
| 11 | Academia TA v1 Mazo 07 | 11 | Academia TA v1 Jugador 07 | 3 | 2 | 1 | 0 | 66.67 |
| 13 | Academia TA v1 Mazo 09 | 13 | Academia TA v1 Jugador 09 | 3 | 2 | 1 | 0 | 66.67 |
| 15 | Academia TA v1 Mazo 11 | 15 | Academia TA v1 Jugador 11 | 3 | 2 | 1 | 0 | 66.67 |
| 6 | Academia TA v1 Mazo 02 | 6 | Academia TA v1 Jugador 02 | 3 | 0 | 1 | 2 | 0.00 |
| 8 | Academia TA v1 Mazo 04 | 8 | Academia TA v1 Jugador 04 | 3 | 0 | 1 | 2 | 0.00 |
| 10 | Academia TA v1 Mazo 06 | 10 | Academia TA v1 Jugador 06 | 3 | 0 | 1 | 2 | 0.00 |
| 12 | Academia TA v1 Mazo 08 | 12 | Academia TA v1 Jugador 08 | 3 | 0 | 1 | 2 | 0.00 |
| 14 | Academia TA v1 Mazo 10 | 14 | Academia TA v1 Jugador 10 | 3 | 0 | 1 | 2 | 0.00 |
| 16 | Academia TA v1 Mazo 12 | 16 | Academia TA v1 Jugador 12 | 3 | 0 | 1 | 2 | 0.00 |

<a id="q04"></a>

### Q04 — Costo energético promedio ponderado por copias; subconsultas escalares correlacionadas.

20 filas.

| id_mazo | nombre | alias | copias | energia_promedio |
|---|---|---|---|---|
| 1 | Mazo inicial 1 | Ana demo SQL | 12 | 2.333 |
| 2 | Mazo inicial 2 | Bruno demo SQL | 12 | 3.333 |
| 3 | Mazo inicial 3 | Carla demo SQL | 12 | 1.833 |
| 4 | Mazo inicial 4 | Diego demo SQL | 12 | 2.667 |
| 5 | Academia TA v1 Mazo 01 | Academia TA v1 Jugador 01 | 12 | 1.167 |
| 6 | Academia TA v1 Mazo 02 | Academia TA v1 Jugador 02 | 12 | 1.167 |
| 7 | Academia TA v1 Mazo 03 | Academia TA v1 Jugador 03 | 12 | 1.167 |
| 8 | Academia TA v1 Mazo 04 | Academia TA v1 Jugador 04 | 12 | 1.167 |
| 9 | Academia TA v1 Mazo 05 | Academia TA v1 Jugador 05 | 12 | 1.167 |
| 10 | Academia TA v1 Mazo 06 | Academia TA v1 Jugador 06 | 12 | 1.167 |
| 11 | Academia TA v1 Mazo 07 | Academia TA v1 Jugador 07 | 12 | 1.167 |
| 12 | Academia TA v1 Mazo 08 | Academia TA v1 Jugador 08 | 12 | 1.167 |
| 13 | Academia TA v1 Mazo 09 | Academia TA v1 Jugador 09 | 12 | 1.167 |
| 14 | Academia TA v1 Mazo 10 | Academia TA v1 Jugador 10 | 12 | 1.167 |
| 15 | Academia TA v1 Mazo 11 | Academia TA v1 Jugador 11 | 12 | 1.167 |
| 16 | Academia TA v1 Mazo 12 | Academia TA v1 Jugador 12 | 12 | 1.167 |
| 17 | Academia TA v1 Mazo 13 | Academia TA v1 Jugador 13 | 12 | 1.167 |
| 18 | Academia TA v1 Mazo 14 | Academia TA v1 Jugador 14 | 12 | 1.167 |
| 19 | Academia TA v1 Mazo 15 | Academia TA v1 Jugador 15 | 12 | 1.167 |
| 20 | Academia TA v1 Mazo 16 | Academia TA v1 Jugador 16 | 12 | 1.167 |

<a id="q05"></a>

### Q05 — Cartas nunca invocadas en ninguna partida; anti-join LEFT JOIN / IS NULL.

35 filas.

| id_carta | nombre | palo |
|---|---|---|
| BAS-01 | Ancho de bastos | bastos |
| BAS-03 | Tres de bastos | bastos |
| BAS-05 | Cinco de bastos | bastos |
| BAS-06 | Seis de bastos | bastos |
| BAS-07 | Siete de bastos | bastos |
| BAS-10 | Diez de bastos | bastos |
| BAS-11 | Once de bastos | bastos |
| BAS-12 | Doce de bastos | bastos |
| COP-01 | Ancho de copas | copas |
| COP-03 | Tres de copas | copas |
| COP-04 | Cuatro de copas | copas |
| COP-05 | Cinco de copas | copas |
| COP-06 | Seis de copas | copas |
| COP-07 | Siete de copas | copas |
| COP-10 | Diez de copas | copas |
| COP-11 | Once de copas | copas |
| COP-12 | Doce de copas | copas |
| ESP-01 | Ancho de espadas | espadas |
| ESP-03 | Tres de espadas | espadas |
| ESP-04 | Cuatro de espadas | espadas |
| ESP-05 | Cinco de espadas | espadas |
| ESP-06 | Seis de espadas | espadas |
| ESP-07 | Siete de espadas | espadas |
| ESP-10 | Diez de espadas | espadas |
| ESP-11 | Once de espadas | espadas |
| ESP-12 | Doce de espadas | espadas |
| ORO-01 | Ancho de oros | oros |
| ORO-03 | Tres de oros | oros |
| ORO-04 | Cuatro de oros | oros |
| ORO-05 | Cinco de oros | oros |
| ORO-06 | Seis de oros | oros |
| ORO-07 | Siete de oros | oros |
| ORO-10 | Diez de oros | oros |
| ORO-11 | Once de oros | oros |
| ORO-12 | Doce de oros | oros |

<a id="q06"></a>

### Q06 — Jugadores sin ninguna victoria; incluye a quienes nunca jugaron.

14 filas.

| id_jugador | alias |
|---|---|
| 1 | Ana demo SQL |
| 2 | Bruno demo SQL |
| 3 | Carla demo SQL |
| 4 | Diego demo SQL |
| 6 | Academia TA v1 Jugador 02 |
| 8 | Academia TA v1 Jugador 04 |
| 10 | Academia TA v1 Jugador 06 |
| 12 | Academia TA v1 Jugador 08 |
| 14 | Academia TA v1 Jugador 10 |
| 16 | Academia TA v1 Jugador 12 |
| 17 | Academia TA v1 Jugador 13 |
| 18 | Academia TA v1 Jugador 14 |
| 19 | Academia TA v1 Jugador 15 |
| 20 | Academia TA v1 Jugador 16 |

<a id="q07"></a>

### Q07 — Tipos de carta con más eliminaciones enemigas, incluido el daño al defender.

4 filas.

| id_carta | nombre | palo | eliminaciones_enemigas | eliminaciones_al_atacar | eliminaciones_al_defender |
|---|---|---|---|---|---|
| BAS-02 | Dos de bastos | bastos | 10 | 0 | 10 |
| ESP-02 | Dos de espadas | espadas | 10 | 10 | 0 |
| COP-02 | Dos de copas | copas | 9 | 0 | 9 |
| ORO-02 | Dos de oros | oros | 9 | 9 | 0 |

<a id="q08"></a>

### Q08 — Historial por jugador. @jugador_id debe asignarse en la misma conexión.

3 filas.

| id_partida | fecha_inicio | fecha_fin | motivo_cierre | id_mazo | mazo_utilizado | posicion | rival | vida_propia | vida_rival | resultado | ultimo_turno_global |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | LIMITE_TURNOS | 5 | Academia TA v1 Mazo 01 | 1 | Academia TA v1 Jugador 02 | 20 | 20 | EMPATE | 30 |
| 2 | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | VIDA_CERO | 5 | Academia TA v1 Mazo 01 | 1 | Academia TA v1 Jugador 02 | 20 | 0 | VICTORIA | 27 |
| 1 | Tue Nov 03 2026 17:30:57 GMT-0300 (hora estándar de Argentina) | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | VIDA_CERO | 5 | Academia TA v1 Mazo 01 | 2 | Academia TA v1 Jugador 02 | 20 | 0 | VICTORIA | 28 |

<a id="q09"></a>

### Q09 — Rendimiento descriptivo por palo: uso, ataques, daño a héroes y eliminaciones.

4 filas.

| palo | invocaciones | ataques_iniciados | ataques_a_heroes | dano_a_heroes | eliminaciones_enemigas |
|---|---|---|---|---|---|
| bastos | 29 | 48 | 48 | 96 | 10 |
| copas | 9 | 0 | 0 | 0 | 9 |
| espadas | 20 | 34 | 24 | 72 | 10 |
| oros | 18 | 33 | 24 | 72 | 9 |

<a id="q10"></a>

### Q10 — Invocaciones y ataques por partida, incluidas las partidas sin jugadas.

19 filas.

| id_partida | fecha_fin | turnos_registrados | jugadas_registradas | invocaciones | ataques |
|---|---|---|---|---|---|
| 1 | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | 28 | 13 | 4 | 9 |
| 2 | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | 27 | 13 | 4 | 9 |
| 3 | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | 30 | 5 | 4 | 1 |
| 4 | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | 28 | 13 | 4 | 9 |
| 5 | Tue Nov 03 2026 17:30:58 GMT-0300 (hora estándar de Argentina) | 28 | 13 | 4 | 9 |
| 6 | Tue Nov 03 2026 17:30:59 GMT-0300 (hora estándar de Argentina) | 30 | 5 | 4 | 1 |
| 7 | Tue Nov 03 2026 17:30:59 GMT-0300 (hora estándar de Argentina) | 28 | 13 | 4 | 9 |
| 8 | Tue Nov 03 2026 17:30:59 GMT-0300 (hora estándar de Argentina) | 28 | 13 | 4 | 9 |
| 9 | Tue Nov 03 2026 17:30:59 GMT-0300 (hora estándar de Argentina) | 30 | 5 | 4 | 1 |
| 10 | Tue Nov 03 2026 17:30:59 GMT-0300 (hora estándar de Argentina) | 27 | 13 | 4 | 9 |
| 11 | Tue Nov 03 2026 17:30:59 GMT-0300 (hora estándar de Argentina) | 27 | 13 | 4 | 9 |
| 12 | Tue Nov 03 2026 17:31:00 GMT-0300 (hora estándar de Argentina) | 30 | 5 | 4 | 1 |
| 13 | Tue Nov 03 2026 17:31:00 GMT-0300 (hora estándar de Argentina) | 27 | 13 | 4 | 9 |
| 14 | Tue Nov 03 2026 17:31:00 GMT-0300 (hora estándar de Argentina) | 28 | 13 | 4 | 9 |
| 15 | Tue Nov 03 2026 17:31:00 GMT-0300 (hora estándar de Argentina) | 30 | 5 | 4 | 1 |
| 16 | Tue Nov 03 2026 17:31:00 GMT-0300 (hora estándar de Argentina) | 28 | 13 | 4 | 9 |
| 17 | Tue Nov 03 2026 17:31:00 GMT-0300 (hora estándar de Argentina) | 27 | 13 | 4 | 9 |
| 18 | Tue Nov 03 2026 17:31:01 GMT-0300 (hora estándar de Argentina) | 30 | 5 | 4 | 1 |
| 19 | NULL | 22 | 5 | 4 | 1 |

## Reproducción

Desde la raíz: `npm run build --workspace backend` y `npm run db:audit`. El proceso usa los binarios XAMPP en C:/xampp/mysql/bin (configurable con MYSQL_BIN_DIR), crea su propio datadir ignorado en tmp, no registra servicios y detiene su servidor al finalizar. Conserva el datadir para inspección; no contiene credenciales de producción. Detalles completos y snapshots en evidencia-ejecucion.json.
