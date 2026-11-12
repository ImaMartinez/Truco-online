# Truco Arena — Descripción académica preliminar

Texto de aproximadamente una página al maquetarlo; borrador de IA para que el grupo revise y adapte. No representa la aprobación del MER.

Truco Arena — Batalla de Naipes es un juego web de cartas por turnos para un proyecto integrador de Bases de Datos. Dos jugadores utilizan naipes españoles para invocar combatientes, controlar la mesa y reducir la vida del héroe contrario. Sus cuarenta cartas conservan la identidad del Truco argentino, pero no sus reglas. La jerarquía tradicional es información del catálogo y no determina el combate.

El objetivo lúdico consiste en administrar energía y elegir cuándo desarrollar el campo, atacar cartas o dañar al héroe rival. El objetivo académico es representar esas decisiones con un modelo relacional comprensible, operaciones atómicas y reglas verificables desde SQL. El grupo deberá explicar sus entidades y relaciones y cómo la base evita estados inválidos ante solicitudes repetidas o concurrentes.

Cada jugador posee una colección y varios mazos. Un mazo puede guardarse incompleto, pero requiere doce cartas para jugar, con hasta dos copias por tipo y sin superar las cantidades poseídas. Las cartas no se consumen al jugar. Se proponen perfiles de demostración con dos copias de cada tipo, sin adquisición, venta o intercambio, sujeto a revisión del grupo. Los mazos utilizados quedan inmutables y pueden duplicarse para editar otras composiciones.

La partida enfrenta a dos jugadores distintos, con veinte de vida y tres cartas iniciales cada uno. Se sortea quién comienza y los turnos se alternan. La energía comienza en uno, aumenta en cada turno propio hasta cinco y se repone al abrirlo. Desde el segundo turno propio se roba una carta si quedan copias en el mazo. Cada instancia tiene identidad propia y una única zona: mazo, mano, campo o descarte.

Pueden mantenerse tres cartas en campo. Invocar paga energía y coloca una carta con su vida base, que espera hasta el siguiente turno propio para atacar. Las cartas intercambian daño simultáneamente, conservan el daño y pasan al descarte al llegar a cero. Solo se ataca al héroe con campo rival vacío. Cada copia ataca una vez por turno; defender no consume ese ataque y atacar no gasta energía.

Gana inmediatamente quien reduzca a cero la vida rival. Si nadie lo consigue, al cerrar el turno global treinta ambos completaron quince turnos propios: gana quien conserve más vida; igual vida es empate. Agotar el mazo no provoca derrota ni daño. Siempre puede finalizarse un turno activo, permitiendo avanzar hasta el límite aun sin acciones disponibles.

La primera versión será local para dos personas en un dispositivo, con una transición que oculta las manos y reanudación del último estado confirmado. Se utilizarán React/Vite/TypeScript, una API Node/Express y MariaDB 10.4.32 de XAMPP con consultas explícitas. Las reglas críticas se validarán mediante restricciones, procedimientos y transacciones. El historial y las estadísticas mostrarán los datos persistidos. El juego remoto y la adaptación PostgreSQL/Supabase se evaluarán después; la construcción y validación final del MER corresponden al grupo.
