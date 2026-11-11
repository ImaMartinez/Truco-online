-- Vista real de la pantalla Colección. No agrega datos almacenados ni otra mecánica.
USE truco_arena_dev;
CREATE OR REPLACE ALGORITHM=MERGE SQL SECURITY INVOKER VIEW v_coleccion_jugador AS
SELECT j.id_jugador,j.alias,c.id_carta,c.nombre,c.palo,c.numero,
       c.ataque_base,c.vida_base,c.costo_energia,c.jerarquia_truco,cj.cantidad
FROM jugador j
JOIN coleccion_jugador cj ON cj.id_jugador=j.id_jugador
JOIN carta c ON c.id_carta=cj.id_carta
WHERE j.fecha_archivo IS NULL;
