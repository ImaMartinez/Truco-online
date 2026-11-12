# Preparación de entrega, sin aprobación académica

La consigna original aportada exige ocho tablas como mínimo, N:M con atributos, estructura avanzada, claves/restricciones, 3FN, tres reglas SQL, transacciones/rollback, vista usada por una pantalla, diez consultas con JOIN de tres tablas o subconsulta y datos suficientes. No se dispone aquí de una rúbrica docente independiente que sustituya esa especificación.

Ya existían trece tablas, motor SQL completo, dos N:M con cantidad, especialización, restricciones, transacciones, permisos y pruebas de partida/reinicio. Faltaban consultas ejecutables, vista consumida por pantalla, datos académicos reproducibles y evidencia de instalación limpia. Se añadieron sin cambiar estadísticas, procedimientos del motor, reglas ni presentación.

## Archivos de entrega

- Estructura, rutinas, datos mínimos y combate: `database/mariadb/01-schema.sql` a `04-combat.sql`, conservados.
- Vista: `05-vistas.sql`; `v_coleccion_jugador` une Jugador/Coleccion/Carta. La API existente de colección la consulta; ningún contrato ni pantalla nueva.
- Consultas: `06-consultas-academicas.sql`, [enunciados y explicación](02-consultas-academicas.md), [resultados completos reales](03-evidencia-ejecucion.md).
- Datos ampliados: `scripts/lib/academic-fixtures.mjs`, ejecutado por `npm run db:install`. Crea 16 perfiles/mazos propios, 19 partidas (12 victorias, seis empates y una activa) usando exclusivamente rutinas del juego. Se reanuda y repite sin duplicar registros. Con los mínimos: 20 perfiles, 20 mazos, 40 cartas, 800 asociaciones de colección y 456 copias de partida. No usa las partidas de pruebas anteriores como sustituto del seed.
- Transacción: `scripts/academic-audit.mjs`; registra antes, cambios tras CALL real, error SIGNAL posterior, ROLLBACK e igualdad anterior/posterior; después confirma la misma invocación y verifica COMMIT. No duplica las reglas de invocación.
- Versión cliente SQL: `database/mariadb/07-demostracion-transaccion.sql`, también ejecutada en MariaDB: MANO/NULL/energía5/versión26 → CAMPO/vida1/energía4/versión27 → ROLLBACK → estado inicial. Usa el fixture reservado y elimina su helper; no altera procedimientos del motor. Los IDs/versiones dependen del fixture.
- Diccionario: [T01–T13 del MR existente](../hito-2/01-modelo-relacional-preliminar.md). [Auditoría, DF y guía manual](../hito-2/02-auditoria-implementacion.md). No se duplica el diccionario ni se genera un MER para presentarlo como humano.

## Ejecución

Desde la raíz con MariaDB XAMPP iniciado:

```powershell
npm install
npm run db:install
npm run build --workspace backend
npm run db:audit
npm run check
npm run test:sql
npm run test:e2e:sql
npm run dev:sql
```

`db:audit` inicializa un datadir nuevo bajo `tmp/academic-mariadb-*` con mysql_install_db.exe, inicia una instancia propia en puerto libre, instala desde cero, comprueba recarga idempotente, ejecuta las diez consultas y demuestra transacción/rollback. No vacía la base de desarrollo ni registra servicios Windows. Detiene su servidor en finally; conserva datos temporales ignorados para inspección. Los resultados JSON/Markdown se regeneran con evidencia real. El archivo .env aislado no reemplaza backend/.env.mariadb. No publicar credenciales ni tmp.

En phpMyAdmin, elegir `truco_arena_dev`, importar 06 y asignar antes `SET @jugador_id=ID_REAL;` para Q08. La evidencia contiene el ID utilizado. Los resultados de una base de desarrollo con partidas adicionales naturalmente difieren de los de instalación limpia. Las consultas son descriptivas, no prueban equilibrio ni causalidad del palo.

## Pendientes del grupo

No hay aprobación de B1–B4, MER, MR ni 3FN. La aclaración posterior del usuario establece costo independiente por tipo: jerarquía→costo no es DF del dominio. El dictamen técnico de3FN y las claves candidatas están actualizados en la auditoría del Hito2; la coincidencia de40filas no obliga a descomponer. Falta ratificación grupal del modelo completo. Revisar la aceptación docente de la especialización y explicar la garantía por rutinas/permisos frente al acceso administrativo. Dibujar/revisar manualmente MER y MR, justificar las DF y registrar revisores/decisiones reales. No hay cambios de esquema propuestos ejecutados.
