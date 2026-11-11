# Formato jugable de 20 cartas — provisional

Motivo del cambio solicitado: con 12 cartas el mazo se agotaba antes del límite de 30 turnos. Los mazos nuevos y la selección aleatoria de la UI apuntan a 20 cartas, conservando el máximo de dos copias por tipo y la validación contra la colección. No se cambian catálogo, estadísticas, robo inicial, energía, combate ni condiciones de victoria.

Se conservan los mazos de 12 como formato clásico para compatibilidad con partidas, fixtures y documentación académica anteriores. Una partida exige dos mazos del mismo tamaño: 20 contra 20 genera 40 copias; 12 contra 12 genera 24. Se permiten borradores de hasta 20 cartas; los tamaños intermedios no pueden iniciar partidas.

Actualización de una instalación existente: detener el backend y ejecutar `npm run db:update:deck-size`. El script aplica `09-decks-20.sql` solamente en `truco_arena_dev`, amplía `ck_copia_posicion` a 1–20, actualiza tres procedimientos y conserva sus permisos. Agrega un mazo de 20 para cada perfil demo si falta, sin editar los mazos anteriores ni reactivar los eliminados. Verifica por SHA-256 que tablas de partidas, participantes, copias, turnos, jugadas, subtipos y solicitudes no cambiaron durante la migración. La instalación desde cero también aplica esta actualización.

No se incorpora una columna redundante de tamaño: la composición inmutable del mazo utilizado determina las copias de partida. El inicio comprueba cada cantidad y el total exacto, dentro de la transacción existente. No se agregan tablas. Los documentos académicos y B1–B4 no se marcan aprobados; el grupo deberá revisar la variante de 20 si decide incorporarla al reglamento académico.

Verificación ejecutable: `npm run test:sql` incluye el formato 20, cuarenta copias, posiciones 1–20, rechazo de tamaño desigual y de más de veinte, idempotencia y rollback. Se mantienen las pruebas de compatibilidad clásica y de persistencia al reiniciar Node.js.
