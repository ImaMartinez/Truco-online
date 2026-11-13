# Entrega de base para XAMPP

> Archivo histórico de desarrollo. Para el estado vigente ver [arquitectura](../../arquitectura.md) y [despliegue](../../despliegue.md). Los JSON/capturas QA mencionados se consolidaron en el [historial de validaciones](../../historial-validaciones.md); las afirmaciones de esta fase conservan su fecha y alcance.

13/11/2026. Pedido del titular: comprobar compatibilidad del SQL PostgreSQL entregado e instalar/revisar la base con XAMPP. PostgreSQL y MariaDB requieren scripts diferentes; XAMPP incorpora MariaDB.

Se entrega `database/mariadb/install/TrucoOnline-XAMPP.sql`, generado por `scripts/build-xampp-install.mjs`, con guía, verificación y manifiesto de fuentes. Se seleccionan los cuerpos definitivos de las rutinas de la implementación MariaDB existente, sin ejecutar las sustituciones históricas DROP/ALTER. Se utiliza una base nueva distinta de `truco_arena_dev`: `truco_online_xampp`, con CREATE DATABASE sin IF NOT EXISTS para rechazar una importación repetida en los clientes normales, sin --force.

Incluye 13 tablas académicas/20 FK, 40 cartas originales, nueve procedimientos, cinco triggers, una vista y cuatro perfiles ficticios con ocho mazos 12/20. No es paridad con las 16 tablas/servicios PostgreSQL de Production: Auth, recuperación, salas, timer/Cron, worker autónomo y cierre/sustitución CPU-online recientes siguen exclusivamente en Supabase. Esa diferencia está indicada en el encabezado SQL y en la guía, sin presentar el motor anterior como la versión publicada.

`node tests/mariadb/install-xampp.mjs` aprobó 13 grupos sobre MariaDB 10.4.32 real, inicializado con binarios de XAMPP en directorio/puerto efímeros. Se probó el archivo exacto con el cliente mysql, estructura y catálogo completos, ejemplos, creación de jugadores/mazos/partidas, reparto 12/20, turnos/energía, invocación/reintento, rechazo de ataque prematuro, ataque directo, rollback de DML, reinicio con historial, persistencia y rechazo de reimportación. No se simuló rollback global de DDL: MariaDB tiene commits implícitos, documentados como diferencia del instalador PostgreSQL. phpMyAdmin no se automatizó; se probó su alternativa CLI.

Se dejan los archivos para compartir en Descargas y un ZIP con documentación/resultados. No se importó nada en la instancia XAMPP habitual, no hubo operaciones remotas ni cambios de la web publicada, no se hizo commit/push/despliegue. Se conserva intacto el SQL PostgreSQL anterior. No se alteran acuerdos B1–B4 ni se atribuyen aprobaciones académicas.
