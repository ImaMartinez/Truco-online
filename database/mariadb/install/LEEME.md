# TrucoOnline para XAMPP / MariaDB

Archivo para compartir: **TrucoOnline-XAMPP.sql**. Es autocontenido; no requiere Node ni los archivos del repositorio para instalar y revisar esta base.

El SQL `TrucoOnline-completo.sql` anterior está escrito para PostgreSQL 17/Supabase y no se puede importar directamente en MariaDB. XAMPP incluye MariaDB aunque el panel diga «MySQL» ([referencia oficial](https://www.apachefriends.org/faq_windows)).

## Qué instala

En una base **nueva** llamada `truco_online_xampp`:

- Las 13 tablas académicas del motor MariaDB, con 20 relaciones FK y restricciones InnoDB.
- Las 40 cartas con sus nombres y estadísticas originales.
- Nueve procedimientos, cinco triggers y una vista de colección.
- Cuatro jugadores **ficticios**: Ana, Bruno, Carla y Diego demo SQL. Cada uno tiene una colección y dos mazos de ejemplo, uno de 12 y otro de 20 cartas. No incluye partidas ni usuarios reales.
- Creación de jugadores/colecciones, administración de mazos, partida con dos participantes, reparto, energía, turnos, invocaciones, combate, descarte, resultados, recibos de idempotencia e historial SQL; reinicio administrativo con conservación del historial.

Las tablas son `jugador`, `carta`, `coleccion_jugador`, `mazo`, `mazo_carta`, `partida`, `participante_partida`, `copia_carta_partida`, `turno`, `solicitud_operacion`, `jugada`, `invocacion` y `ataque`.

**Alcance:** se empaqueta la implementación MariaDB existente, con sus ampliaciones de mazos y reinicio. No es una conversión completa de las 16 tablas y servicios de la versión publicada en Supabase. No incluye vinculación con Supabase Auth, sesiones anónimas/JWT, código de recuperación, salas online, Cron/temporizador, worker CPU autónomo ni el cierre por abandono/sustitución CPU-online agregado posteriormente en PostgreSQL. La web publicada sigue usando Supabase; importar este SQL no cambia su conexión.

## Importar desde phpMyAdmin

1. Iniciar **Apache** y **MySQL** en el panel de XAMPP. Requisito: MariaDB 10.4.32 o posterior; no MySQL de Oracle ni PostgreSQL.
2. Abrir `http://localhost/phpmyadmin` con una cuenta local que pueda crear bases, tablas, vistas, rutinas y triggers.
3. Ir al **Inicio del servidor**, sin seleccionar otra base. No crear previamente `truco_online_xampp`: el archivo la crea.
4. Elegir **Importar**, seleccionar `TrucoOnline-XAMPP.sql`, formato **SQL**, codificación **utf-8** y ejecutar. No habilitar «continuar ante errores».
5. Debe aparecer «Importación ejecutada exitosamente». Abrir `truco_online_xampp`: deben existir 40 cartas, 4 jugadores ficticios y 8 mazos. phpMyAdmin puede omitir la tabla del SELECT final; el cliente CMD muestra `INSTALACION_COMPLETA_XAMPP`.
6. Opcional: importar `Verificar-instalacion.sql` para obtener conteos y composición de mazos mediante consultas de solo lectura.

Los nombres de algunas opciones pueden variar con la versión de phpMyAdmin. Se probó la pantalla real de importación de phpMyAdmin 5.2.1, PHP 8.2.12 y MariaDB 10.4.32, además del cliente CMD.

### Si el archivo anterior falló con «#2014 — Commands out of sync»

El instalador anterior llamaba a `ta_guardar_mazo` para cargar cuatro mazos de ejemplo. phpMyAdmin dejaba resultados pendientes de esas llamadas y luego fallaba con `SET FOREIGN_KEY_CHECKS = ON`, una consulta que agrega el propio importador. La versión corregida carga esos ejemplos con INSERT, manteniendo los procedimientos, triggers y claves foráneas. No es necesario desactivar las restricciones.

Si ya existe `truco_online_xampp`, **no borrar la base ni reimportar el instalador completo**:

1. Recargar phpMyAdmin para salir de la solicitud fallida y seleccionar `truco_online_xampp` en la izquierda.
2. En **Importar**, elegir **Completar-instalacion.sql** y ejecutar sin continuar ante errores.
3. Importar `Verificar-instalacion.sql`: debe mostrar 13 tablas, 20 FK, 9 procedimientos, 5 triggers, 40 cartas, 160 entradas de colección y 8 mazos (cuatro de 12 y cuatro de 20).

El archivo de finalización solo agrega ejemplos faltantes y puede repetirse sin duplicarlos. No reemplaza rutinas ni actualiza filas existentes. Está restringido a una instalación inicial con los cuatro jugadores ficticios y sin partidas: si detecta otra estructura, usuarios adicionales o partidas, se detiene para revisión. No sirve como migración de una base ya utilizada.

## Alternativa con el cliente de XAMPP

En **Símbolo del sistema (CMD)**, suponiendo que se descargó en Descargas:

```bat
C:\xampp\mysql\bin\mysql.exe -u root -p --default-character-set=utf8mb4 < "%USERPROFILE%\Downloads\TrucoOnline-XAMPP.sql"
```

Introducir la contraseña local cuando la solicite. Si esa cuenta no tiene contraseña, pulsar Enter. Cambiar la ruta de XAMPP o el usuario cuando corresponda. La redirección `<` de este ejemplo es de CMD, no de PowerShell. No utilizar `--force`.

## Instalación nueva y permisos

El archivo se detiene con el error «database exists» si ya existe la base; no intenta reemplazarla ni actualizarla. No contiene DROP DATABASE/TABLE, cuentas, contraseñas ni credenciales cloud. Los cuerpos definitivos de las rutinas se crean una sola vez, sin ejecutar los DROP/ALTER históricos del proyecto.

MariaDB confirma DDL implícitamente: **una importación fallida puede dejar una base parcial**, no hay rollback global como en el instalador PostgreSQL. Ante un error, detenerse y guardar el mensaje; revisar la base parcial antes de resolverlo. No volver a ejecutar forzando que continúe ni borrar bases con datos para solucionar un error.

Las rutinas conservan `SQL SECURITY DEFINER` y el definidor será la cuenta que importe el archivo. Esta entrega está pensada para instalación/inspección local, no para exponer un servidor al público. No crea el usuario del backend ni le concede acceso. El coordinador debe abrir y confirmar cada transacción (`START TRANSACTION` / `COMMIT`); ante errores debe ejecutar `ROLLBACK`. Invocar estas rutinas no reemplaza la validación de identidad del backend.

## Fuentes, pruebas y diferencias

Generación reproducible desde el proyecto:

```text
node scripts/build-xampp-install.mjs
node scripts/build-xampp-install.mjs --check
node tests/mariadb/install-xampp.mjs
node tests/mariadb/install-xampp.mjs --phpmyadmin
```

El generador utiliza los archivos 01–05 y 08–10 de `database/mariadb`. Los archivos 06 (consultas académicas) y 07 (demostración transaccional) no se ejecutan durante la instalación. Se conservan en el repositorio original. `fuentes.json` documenta hashes y transformaciones. Las posiciones de 1 a 20 y el cierre REINICIO ya figuran en el esquema final original; no se cambian reglas ni estadísticas al empaquetarlo.

**Validación (14/11/2026): 16 grupos aprobados.** La suite verifica importación con `mysql.exe`, rechazo de reimportación, estructura, catálogo exacto, ejemplos, propiedad de mazos, creación de partidas 12/20, reparto, invocación/energía/idempotencia, rechazo de ataque prematuro, turnos/ataque al héroe, rollback DML, reinicio con historial y recuperación tras reiniciar MariaDB. La opción `--phpmyadmin` prueba además la importación mediante navegador, reproduce el error anterior, recupera la base parcial, repite la finalización y comprueba el rechazo de una base con usuarios adicionales. Usa directorio de datos, puertos, sesiones y configuración phpMyAdmin aislados; requiere PHP/phpMyAdmin de XAMPP y Chrome/Edge o Chromium de Playwright. No utiliza las bases habituales del equipo ni Supabase. Los resultados y capturas quedan en `artifacts/xampp-install/`, excluido de Git.

No se afirma haber probado de nuevo todos los escenarios históricos de combate simultáneo/victoria/concurrencia de la implementación MariaDB ni la web completa en esta entrega. B1–B4 académicos siguen pendientes. No se han modificado bases remotas ni publicado cambios del proyecto.
