# TrucoOnline — Truco Arena: Batalla de Naipes

Trabajo Práctico Integrador de **Informática II**. Juego de combate por turnos con naipes españoles, energía, mazos y persistencia SQL.

**[Jugar la versión publicada](https://truco-online-beta.vercel.app)** · [Instalar en local con XAMPP](README-INSTALACION-XAMPP.md) · [Material académico](docs/entrega/README.md) · [Revisión previa a la entrega](docs/revision-final/README.md)

## El juego

- Catálogo de 40 cartas con estadísticas dinámicas de energía, ataque y vida.
- Editor de mazos, colección, tablero responsive, historial y confirmaciones dentro del juego.
- Versión pública: perfiles recuperables, CPU con tres dificultades y salas online privadas.
- Versión local MariaDB: CPU desde el navegador y dos personas en un mismo dispositivo. La guía explica las diferencias con Supabase.

## Tecnologías y organización

| Parte | Implementación |
|---|---|
| Frontend | React, TypeScript, Vite y assets PNG/WebP v3. |
| Backend | Node.js 24, Express, contratos compartidos y adaptadores SQL. |
| Base académica/local | MariaDB de XAMPP, InnoDB, rutinas, restricciones y transacciones. |
| Versión pública | Vercel (frontend), Railway (Express + worker CPU) y Supabase (PostgreSQL/Auth/Cron). |
| Verificación | Node test runner, Playwright, pruebas de API, motores SQL y configuración de despliegue. |

[Arquitectura y seguridad](docs/arquitectura.md) · [Estructura y documentación](docs/README.md).

## Instalación local

Requisitos: Git, **Node >=24.16.0 <25**, npm y XAMPP con MariaDB iniciado. Desde una carpeta de trabajo:

~~~powershell
git clone https://github.com/ImaMartinez/Truco-online.git
cd Truco-online
npm ci
npm run db:install
npm run dev:sql
~~~

Abrir **http://127.0.0.1:5173/**. API: **http://127.0.0.1:4000/api/health**, con storage mariadb y database connected. Mantener abierta la terminal; Ctrl+C detiene ambos procesos.

Si el administrador SQL tiene contraseña, otro usuario o puerto, configurarlos **antes** de db:install como explica el [instructivo completo](README-INSTALACION-XAMPP.md). El instalador crea la base **truco_arena_dev**, una cuenta limitada y **backend/.env.mariadb**, que no se versiona. No usar root desde Express ni copiar secretos al frontend. No hace falta colocar el proyecto en htdocs.

El SQL autocontenido [TrucoOnline-XAMPP.sql](database/mariadb/install/TrucoOnline-XAMPP.sql) sirve para inspeccionar otra base, **truco_online_xampp**; no sustituye la instalación de la app. El [SQL PostgreSQL](database/postgres/install/LEEME.md) es de otro dialecto y solo se usa en una base nueva siguiendo su guía.

## Configuración y otros modos

- **MariaDB local:** archivo generado backend/.env.mariadb; guía de [instalación, primera partida y diagnóstico](README-INSTALACION-XAMPP.md).
- **Memoria:** npm run dev; demo explícita y soporte de las pruebas. Los datos se pierden al reiniciar el backend.
- **Supabase:** npm run dev:supabase requiere configuración privada propia a partir de backend/.env.supabase.example. No incluye credenciales de la web publicada. Ver [arquitectura](docs/arquitectura.md) y [despliegue](docs/despliegue.md).

No importar migraciones o instaladores completos sobre el Supabase publicado para ejecutar la aplicación local.

## Compilación y pruebas esenciales

~~~powershell
npm run build
npm test
npm run test:build
npm run test:deployment
npm run test:e2e
~~~

Las [pruebas](docs/pruebas.md) distinguen suites locales sin SQL, instalaciones aisladas y arneses con efectos persistentes. Las pruebas remotas no se ejecutan como parte de una compilación normal. Los reportes, logs y capturas se regeneran en directorios ignorados.

## Entrega académica y uso de IA

Se conservan el [MER editable](docs/diagramas/LEEME-MER-simple.md), [MR/diccionario](docs/hito-2/01-modelo-relacional-preliminar.md), [SQL y consultas](docs/hito-3/README.md) y el [índice de materiales](docs/entrega/README.md).

**El proyecto utilizó asistencia de IA.** La [bitácora real](docs/bitacora-ia.md) identifica tareas asistidas, pruebas efectivamente ejecutadas y limitaciones; no presenta el trabajo como realizado sin IA ni inventa contribuciones/aprobaciones humanas.

B1–B4, la ratificación humana del MER/MR y el informe académico final señalado en Hito 4 siguen pendientes. La documentación técnica y la aplicación funcional no sustituyen esas revisiones. Los antecedentes se agrupan en docs/archivo; el [historial consolidado](docs/historial-validaciones.md) explica las evidencias conservadas y las salidas QA retiradas.

Las decisiones de organización, conservación y validación del repositorio están documentadas en la revisión de entrega. No se incluyen secretos en Git.
