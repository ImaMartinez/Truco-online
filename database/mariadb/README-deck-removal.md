# Eliminación provisional de mazos

Base existente: ejecutar `npm run db:update:decks` desde la raíz, con MariaDB/XAMPP iniciado. Aplica únicamente `08-deck-removal.sql` en `truco_arena_dev` y otorga EXECUTE sobre `ta_eliminar_mazo` a la cuenta local de la aplicación. La instalación desde cero mediante `npm run db:install` también incluye esta rutina.

La API expone `DELETE /api/decks/:id?ownerId=...`; en MariaDB el propietario es obligatorio. El procedimiento requiere una transacción, bloquea jugador y mazo, valida propiedad y decide en SQL: borra composición y mazo si nunca fue usado; de lo contrario marca `fecha_archivo`, preservando composición, participantes y partidas. No se modifica el esquema ni se agrega permiso DELETE/UPDATE directo a la cuenta de Express. Las bajas de mazos no modifican colecciones.

Los nombres de mazos usados archivados permanecen reservados por `uq_mazo_dueno_nombre`; se informa antes de confirmar. No se cambia esa decisión del esquema preliminar. La baja no impide recuperar y continuar partidas que ya usaron ese mazo, pero impide seleccionarlo para otra partida.

Validación automatizada: cancelación y confirmación en móvil; propietario ajeno rechazado; nombre de mazo no usado reutilizable; archivo de mazo usado, partida conservada y finalizable, rechazo de un nuevo inicio con el mazo archivado; baja conservada al recargar. Las pruebas se encuentran en `tests/e2e/deck-tools.spec.ts`, `tests/sql-e2e/deck-removal.spec.ts` y `backend/test/api.test.ts`. B1–B4 siguen pendientes; sin commits ni despliegues.
