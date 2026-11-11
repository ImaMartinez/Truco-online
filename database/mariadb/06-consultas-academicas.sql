-- Consultas académicas de Truco Arena, MariaDB 10.4.32.
-- Solo SELECT. Elegir la base de desarrollo en la conexión antes de ejecutarlas.
-- El historial requiere @jugador_id: asignarlo al ID real que se quiere consultar.
-- B1-B4 y MER/MR continúan pendientes de revisión humana.

-- Q01: Jugadores con más victorias en partidas finalizadas.
SELECT j.id_jugador, j.alias, COUNT(*) AS victorias
FROM jugador AS j
JOIN mazo AS m ON m.id_jugador = j.id_jugador
JOIN participante_partida AS pp ON pp.id_mazo = m.id_mazo
JOIN partida AS p ON p.id_partida = pp.id_partida
WHERE p.fecha_fin IS NOT NULL AND p.ganador_posicion = pp.posicion
GROUP BY j.id_jugador, j.alias
HAVING COUNT(*) >= 1
ORDER BY victorias DESC, j.id_jugador;

-- Q02: Cartas más utilizadas: invocaciones exitosas, no simples inclusiones en mazos.
SELECT c.id_carta, c.nombre, c.palo, COUNT(*) AS invocaciones,
       COUNT(DISTINCT pp.id_partida) AS partidas_con_invocacion
FROM carta AS c
JOIN copia_carta_partida AS cc ON cc.id_carta = c.id_carta
JOIN invocacion AS i ON i.id_copia = cc.id_copia
JOIN participante_partida AS pp ON pp.id_participante = cc.id_participante
GROUP BY c.id_carta, c.nombre, c.palo
ORDER BY invocaciones DESC, c.id_carta;

-- Q03: Rendimiento de mazos con al menos tres partidas finalizadas; incluye empates en el denominador.
SELECT m.id_mazo, m.nombre, j.id_jugador, j.alias,
       COUNT(*) AS partidas_finalizadas,
       SUM(CASE WHEN p.ganador_posicion = pp.posicion THEN 1 ELSE 0 END) AS victorias,
       SUM(p.ganador_posicion IS NULL) AS empates,
       SUM(p.ganador_posicion IS NOT NULL AND p.ganador_posicion <> pp.posicion) AS derrotas,
       ROUND(100.0 * SUM(CASE WHEN p.ganador_posicion = pp.posicion THEN 1 ELSE 0 END) / COUNT(*), 2) AS porcentaje_victorias
FROM mazo AS m
JOIN jugador AS j ON j.id_jugador = m.id_jugador
JOIN participante_partida AS pp ON pp.id_mazo = m.id_mazo
JOIN partida AS p ON p.id_partida = pp.id_partida
WHERE p.fecha_fin IS NOT NULL
GROUP BY m.id_mazo, m.nombre, j.id_jugador, j.alias
HAVING COUNT(*) >= 3
ORDER BY porcentaje_victorias DESC, victorias DESC, partidas_finalizadas DESC, m.id_mazo;

-- Q04: Costo energético promedio ponderado por copias; subconsultas escalares correlacionadas.
SELECT m.id_mazo, m.nombre, j.alias,
       COALESCE((SELECT SUM(mc.cantidad) FROM mazo_carta AS mc WHERE mc.id_mazo = m.id_mazo), 0) AS copias,
       (SELECT ROUND(SUM(mc.cantidad * c.costo_energia) / NULLIF(SUM(mc.cantidad), 0), 3)
        FROM mazo_carta AS mc
        JOIN carta AS c ON c.id_carta = mc.id_carta
        WHERE mc.id_mazo = m.id_mazo) AS energia_promedio
FROM mazo AS m
JOIN jugador AS j ON j.id_jugador = m.id_jugador
ORDER BY m.id_mazo;

-- Q05: Cartas nunca invocadas en ninguna partida; anti-join LEFT JOIN / IS NULL.
SELECT c.id_carta, c.nombre, c.palo
FROM carta AS c
LEFT JOIN (
  SELECT DISTINCT cc.id_carta
  FROM invocacion AS i
  JOIN copia_carta_partida AS cc ON cc.id_copia = i.id_copia
) AS utilizadas ON utilizadas.id_carta = c.id_carta
WHERE utilizadas.id_carta IS NULL
ORDER BY c.id_carta;

-- Q06: Jugadores sin ninguna victoria; incluye a quienes nunca jugaron.
SELECT j.id_jugador, j.alias
FROM jugador AS j
LEFT JOIN (
  SELECT DISTINCT m.id_jugador
  FROM mazo AS m
  JOIN participante_partida AS pp ON pp.id_mazo = m.id_mazo
  JOIN partida AS p ON p.id_partida = pp.id_partida
  WHERE p.fecha_fin IS NOT NULL AND p.ganador_posicion = pp.posicion
) AS ganadores ON ganadores.id_jugador = j.id_jugador
WHERE ganadores.id_jugador IS NULL
ORDER BY j.id_jugador;

-- Q07: Tipos de carta con más eliminaciones enemigas, incluido el daño al defender.
-- La comparación usa las dos vidas previas del evento y el catálogo congelado.
-- No cuenta héroes ni atribuye la muerte a todos los ataques que recibió una copia.
SELECT c.id_carta, c.nombre, c.palo,
       COUNT(*) AS eliminaciones_enemigas,
       SUM(b.origen = 'ATAQUE') AS eliminaciones_al_atacar,
       SUM(b.origen = 'DEFENSA') AS eliminaciones_al_defender
FROM carta AS c
JOIN (
  SELECT atacante.id_carta, 'ATAQUE' AS origen
  FROM ataque AS a
  JOIN copia_carta_partida AS atacante ON atacante.id_copia = a.id_copia_atacante
  JOIN carta AS ca ON ca.id_carta = atacante.id_carta
  JOIN copia_carta_partida AS objetivo ON objetivo.id_copia = a.id_copia_objetivo
  WHERE a.vida_previa_objetivo <= ca.ataque_base
  UNION ALL
  SELECT objetivo.id_carta, 'DEFENSA' AS origen
  FROM ataque AS a
  JOIN copia_carta_partida AS objetivo ON objetivo.id_copia = a.id_copia_objetivo
  JOIN carta AS cd ON cd.id_carta = objetivo.id_carta
  JOIN copia_carta_partida AS atacante ON atacante.id_copia = a.id_copia_atacante
  WHERE a.vida_previa_atacante <= cd.ataque_base
) AS b ON b.id_carta = c.id_carta
GROUP BY c.id_carta, c.nombre, c.palo
ORDER BY eliminaciones_enemigas DESC, c.id_carta;

-- Q08: Historial por jugador. @jugador_id debe asignarse en la misma conexión.
SELECT p.id_partida, p.fecha_inicio, p.fecha_fin, p.motivo_cierre,
       m.id_mazo, m.nombre AS mazo_utilizado, propio.posicion,
       rival_j.alias AS rival, propio.vida_heroe AS vida_propia, rival.vida_heroe AS vida_rival,
       CASE WHEN p.fecha_fin IS NULL THEN 'ACTIVA'
            WHEN p.ganador_posicion IS NULL THEN 'EMPATE'
            WHEN p.ganador_posicion = propio.posicion THEN 'VICTORIA'
            ELSE 'DERROTA' END AS resultado,
       (SELECT MAX(t.numero_global) FROM turno AS t WHERE t.id_partida = p.id_partida) AS ultimo_turno_global
FROM participante_partida AS propio
JOIN mazo AS m ON m.id_mazo = propio.id_mazo
JOIN partida AS p ON p.id_partida = propio.id_partida
JOIN participante_partida AS rival ON rival.id_partida = p.id_partida AND rival.id_participante <> propio.id_participante
JOIN mazo AS rival_m ON rival_m.id_mazo = rival.id_mazo
JOIN jugador AS rival_j ON rival_j.id_jugador = rival_m.id_jugador
WHERE m.id_jugador = @jugador_id
ORDER BY p.fecha_inicio DESC, p.id_partida DESC;

-- Q09: Rendimiento descriptivo por palo: uso, ataques, daño a héroes y eliminaciones.
-- Agregar por tipo ANTES de unir evita multiplicar invocaciones por ataques.
WITH usos AS (
  SELECT cc.id_carta, COUNT(*) AS invocaciones
  FROM invocacion AS i JOIN copia_carta_partida AS cc ON cc.id_copia = i.id_copia
  GROUP BY cc.id_carta
), ataques_tipo AS (
  SELECT cc.id_carta, COUNT(*) AS ataques_iniciados,
         SUM(a.id_participante_objetivo IS NOT NULL) AS ataques_a_heroes,
         SUM(CASE WHEN a.id_participante_objetivo IS NOT NULL
                  THEN LEAST(a.vida_previa_objetivo, c.ataque_base) ELSE 0 END) AS dano_a_heroes
  FROM ataque AS a
  JOIN copia_carta_partida AS cc ON cc.id_copia = a.id_copia_atacante
  JOIN carta AS c ON c.id_carta = cc.id_carta
  GROUP BY cc.id_carta
), bajas AS (
  SELECT atacante.id_carta
  FROM ataque AS a
  JOIN copia_carta_partida AS atacante ON atacante.id_copia = a.id_copia_atacante
  JOIN carta AS ca ON ca.id_carta = atacante.id_carta
  JOIN copia_carta_partida AS objetivo ON objetivo.id_copia = a.id_copia_objetivo
  WHERE a.vida_previa_objetivo <= ca.ataque_base
  UNION ALL
  SELECT objetivo.id_carta
  FROM ataque AS a
  JOIN copia_carta_partida AS objetivo ON objetivo.id_copia = a.id_copia_objetivo
  JOIN carta AS cd ON cd.id_carta = objetivo.id_carta
  JOIN copia_carta_partida AS atacante ON atacante.id_copia = a.id_copia_atacante
  WHERE a.vida_previa_atacante <= cd.ataque_base
), bajas_tipo AS (
  SELECT id_carta, COUNT(*) AS eliminaciones_enemigas FROM bajas GROUP BY id_carta
)
SELECT c.palo,
       COALESCE(SUM(u.invocaciones), 0) AS invocaciones,
       COALESCE(SUM(a.ataques_iniciados), 0) AS ataques_iniciados,
       COALESCE(SUM(a.ataques_a_heroes), 0) AS ataques_a_heroes,
       COALESCE(SUM(a.dano_a_heroes), 0) AS dano_a_heroes,
       COALESCE(SUM(b.eliminaciones_enemigas), 0) AS eliminaciones_enemigas
FROM carta AS c
LEFT JOIN usos AS u ON u.id_carta = c.id_carta
LEFT JOIN ataques_tipo AS a ON a.id_carta = c.id_carta
LEFT JOIN bajas_tipo AS b ON b.id_carta = c.id_carta
GROUP BY c.palo
ORDER BY c.palo;

-- Q10: Invocaciones y ataques por partida, incluidas las partidas sin jugadas.
-- PK compartida hace cada subtipo 0..1 por Jugada: no hay un JOIN N x M de eventos.
SELECT p.id_partida, p.fecha_fin, COUNT(DISTINCT t.id_turno) AS turnos_registrados,
       COUNT(j.id_jugada) AS jugadas_registradas,
       COUNT(i.id_jugada) AS invocaciones, COUNT(a.id_jugada) AS ataques
FROM partida AS p
LEFT JOIN turno AS t ON t.id_partida = p.id_partida
LEFT JOIN jugada AS j ON j.id_turno = t.id_turno
LEFT JOIN invocacion AS i ON i.id_jugada = j.id_jugada
LEFT JOIN ataque AS a ON a.id_jugada = j.id_jugada
GROUP BY p.id_partida, p.fecha_fin
ORDER BY p.id_partida;
