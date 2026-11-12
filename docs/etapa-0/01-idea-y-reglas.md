# Etapa 0 — Idea y reglas propuestas

Fecha: 02/11/2026. Estado: borrador para discusión del grupo, sin validación académica final.

## Idea propuesta

Truco Arena es un duelo de control de campo con las 40 cartas españolas del Truco argentino. La identidad proviene de sus palos, números, nombres y jerarquía tradicional; los resultados dependen del ataque, la vida, la energía y las decisiones. No reproduce las reglas del Truco tradicional.

El objetivo académico es demostrar un modelo relacional coherente, restricciones SQL, operaciones atómicas y consultas útiles a través de una partida que pueda comenzar, persistirse y terminar.

## Alcance del MVP

Incluye perfiles locales sin contraseña, colección consultable, varios mazos por jugador, edición/duplicación, selección de dos jugadores distintos, partida en un dispositivo, transición que oculta manos, reanudación local, resultado, historial y estadísticas. La vista de ranking será utilizada por la pantalla de estadísticas.

Para probar se entregarán dos copias de cada carta a cada perfil de demostración. No hay compra, intercambio, sobres, economía ni consumo permanente de cartas. Una colección limitada se probará con fixtures específicos.

Se posponen multijugador remoto, cuentas públicas, códigos de sala, ranking competitivo entre dispositivos, bot, hechizos, habilidades, bonificaciones entre palos, mulligan y temporizadores. La colección se administra seleccionando y consultando sus cartas para construir mazos; la adquisición o baja de copias no forma parte del MVP propuesto. El grupo debe confirmar esta interpretación.

## Ambigüedades resueltas mediante esta propuesta

| Problema | Recomendación y motivo |
|---|---|
| ¿Turno 15 de quién? | Límite al cerrar el turno global 30; ambos reciben 15 turnos propios. |
| Robo al comenzar | Ninguno roba en su primer turno propio; ya recibió tres cartas. Desde el segundo turno propio roba una. |
| Ventaja de comenzar | Sorteo 50/50; misma mano y energía, sin compensación especial inicial. Medir la ventaja antes de añadir reglas. |
| Campo de tres sin aclarar posiciones | Espacios visuales sin adyacencia, carriles ni orden táctico. Puede elegirse cualquier enemigo en campo. |
| Vida después de un combate | El daño persiste; no hay curación automática entre turnos. |
| Mano llena o mazo vacío | No hay límite adicional de mano; con 12 copias totales nunca supera 12. Mazo vacío no causa daño. |
| Ambas cartas mueren | Intercambio simultáneo y ambos descartes en una transacción. |
| Cartas iguales en mano | Cada copia tiene identidad propia; no se actúa por identificador del catálogo. |
| Relación reflexiva con ventajas | Introduciría una habilidad nueva. Preferir especialización real de jugadas. |
| Modificar un mazo utilizado | Composición y nombre quedan inmutables al usarse por primera vez; editar mediante una copia nueva. |
| Desconexión | Conservar estado confirmado y reanudar; no inventar una derrota por cierre de pestaña. |

## Reglamento numerado recomendado, versión propuesta 0.1

1. **Participantes.** Toda partida activa tiene exactamente dos jugadores distintos. Cada uno selecciona un mazo propio y comienza con 20 de vida.
2. **Mazo.** Para guardarlo puede tener entre 0 y 12 cartas. Para jugar debe sumar exactamente 12. Cada tipo aparece una o dos veces y su cantidad no supera la colección del dueño. No se guardan renglones de cantidad cero.
3. **Colección.** Incluir cartas en un mazo no las consume: pueden reutilizarse en otros mazos. Las copias dentro de cada mazo respetan la cantidad poseída. No hay simultaneidad de partidas para un mismo jugador en el MVP propuesto.
4. **Historial estable.** Un mazo utilizado no se modifica ni elimina físicamente; puede duplicarse o archivarse para ocultarlo de la selección. Los perfiles con historial tampoco se borran físicamente. El catálogo se mantiene fijo durante esta versión de reglas.
5. **Inicio atómico.** Validar participantes, propiedad, disponibilidad y mazos; sortear el inicial; crear la partida, dos participantes, 24 copias y el primer turno. Barajar por separado las 12 copias de cada participante en el backend y persistir sus posiciones. Repartir las tres primeras a cada uno; quedan nueve por robar. Cualquier fallo revierte todo.
6. **Numeración.** Los turnos globales van del 1 al 30. Los impares corresponden al jugador inicial; los pares al otro. El turno propio de quien actúa es `floor((turno_global + 1) / 2)`: 1, 1, 2, 2, …, 15, 15. No es una ronda simultánea.
7. **Inicio de turno.** Se determina energía máxima `min(5, turno_propio)` y se repone la energía disponible a ese valor. Desde el segundo turno propio se mueve a la mano la copia de menor posición que siga en el mazo. Si no hay ninguna, continúa sin robo ni fatiga. El último robo posible ocurre en el turno propio 10 si no existen efectos adicionales.
8. **Acciones.** Durante su turno el jugador puede invocar, atacar o finalizar, en el orden que elija. No puede actuar el rival ni modificarse una partida finalizada. No hay respuesta instantánea del adversario ni deshacer una acción confirmada.
9. **Invocación.** Solo puede invocarse una copia propia en mano, pagando toda su energía y si hay menos de tres copias propias en campo. Entra con vida base y su turno de invocación registrado. La energía nunca es negativa; no se acumula para el próximo turno.
10. **Preparación.** Una copia solo puede atacar si permanece viva en campo, pertenece al actor, fue invocada en un turno propio anterior y no atacó en el turno global actual. Pasar de turno no cura ni resucita cartas. Una carta recién invocada sí puede recibir ataques y contraatacar al defender.
11. **Objetivo.** Un ataque elige una copia enemiga viva en campo. Si el enemigo tiene cero copias en campo, puede elegir su héroe. No se permite atacar aliados, a sí mismo, cartas en mano/mazo/descarte ni al héroe protegido por al menos una carta. Después de despejar el campo, otra carta preparada puede atacar al héroe en ese mismo turno.
12. **Daño simultáneo.** Entre cartas se leen ambos ataques y vidas antes del intercambio. Cada una recibe el ataque de la otra, aunque muera. Defender no consume su posibilidad de atacar en su próximo turno. Atacar al héroe no genera contraataque.
13. **Persistencia del daño.** Vida resultante `max(0, vida_anterior − daño)`. No hay excedente de daño al héroe ni negativos almacenados. Una copia con vida cero pasa al descarte en la misma acción y no puede volver a jugarse. El atacante consume su ataque incluso si no sobrevive.
14. **Finalizar turno.** Cierra el turno actual. Si no corresponde terminar la partida, abre y prepara el siguiente, incluida energía y robo, todo atómicamente. La interfaz pasa a una pantalla opaca sin manos antes de que el siguiente jugador confirme que está listo.
15. **Victoria.** Si la vida de un héroe llega a cero, la partida termina inmediatamente, incluso en el turno 29. No se espera a completar la ronda. Se registra el resultado y se rechazan acciones posteriores.
16. **Límite y empate.** Si no hubo victoria, al finalizar el turno global 30 gana quien tenga más vida de héroe. Igual vida implica empate, sin desempatar por cartas, energía o jerarquía. No se abre el turno 31. Un empate por ambos héroes a cero no es alcanzable con estas reglas; si una evolución permite daño simultáneo a héroes deberá definirse entonces.
17. **Campo agotado.** No hay derrota por quedarse sin mano, campo o mazo. Pueden pasarse turnos hasta el límite. Si los dos quedan sin recursos, el mismo criterio del turno 30 resuelve el final; no se añade una terminación anticipada diferente.
18. **Reintentos y errores.** Una acción rechazada no consume energía, ataque ni turno y no registra una jugada exitosa. Las solicitudes duplicadas no aplican dos veces el efecto. Ante respuesta perdida se consulta el estado y el identificador de solicitud antes de repetir.
19. **Interrupción local.** Recargar muestra una transición y permite reanudar el último estado confirmado. No hay reloj de pared ni derrota por desconexión. El límite garantiza fin por cantidad de turnos si se continúa jugando, no un tiempo máximo real cuando alguien deja de actuar.

## Ejemplos verificables

- En su turno propio 1, cada jugador dispone de una energía y no roba. Jugar un cuatro de costo 1 deja energía 0 y una carta que todavía no ataca.
- Un 3/2 que ataca un 2/3 provoca dos muertes: quedan 0 y 0; se registran ambos descartes y un único ataque.
- Un 2/3 que ataca un 1/4 deja las vidas en 2 y 2; ambas conservan ese daño para los próximos turnos.
- Con campo enemigo vacío, un ataque 3 contra un héroe de vida 2 termina inmediatamente la partida con vida almacenada 0.
- Al cerrar el turno 29 no se comparan vidas por límite; al cerrar el 30, 8–8 es empate y 9–8 es victoria del primero.

## Experiencia y presentación

Mesa con paño verde, madera y detalles dorados; cartas españolas SVG originales con número y símbolo reconocibles. Ataque, vida y energía visibles con etiquetas. Los objetivos legales se destacan, los inválidos explican el motivo y el error del servidor preserva el estado anterior en pantalla.

Una invocación requiere selección y confirmación; un ataque requiere seleccionar atacante y objetivo. Confirmar también finalizar con acciones disponibles y archivar un mazo. Contemplar estados de carga, bloqueo mientras se procesa una acción y animaciones cortas solo después de confirmación del backend.

La transición oculta la mano para juego presencial de buena fe. No es una barrera de seguridad contra alguien que controla ese mismo navegador. La futura versión remota requerirá autenticación y autorización por participante antes de publicar partidas privadas.
