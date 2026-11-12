# Truco Arena — paquete para pasar del Hito 1 al producto jugable

**Estado:** propuesta de trabajo para revisión del equipo, 02/11/2026. No representa un MER, MR ni esquema SQL aprobado.

## Contenido

1. [`01-guia-de-tablas.md`](01-guia-de-tablas.md): 13 tablas candidatas con campos, PK/FK, asociaciones, restricciones y riesgos.
2. [`02-guia-para-dibujar-mer.md`](02-guia-para-dibujar-mer.md): instrucciones concretas para dibujar y revisar el MER con el equipo.
3. [`03-plan-de-implementacion.md`](03-plan-de-implementacion.md): secuencia de entregas ejecutables, pruebas y alcance del MVP.
4. [`04-prompt-codex-arranque-real.md`](04-prompt-codex-arranque-real.md): instrucciones para que Codex comience a generar una base de aplicación sin anticipar SQL definitivo.

## Qué material se tomó como referencia

- Reglamento recomendado 0.2 (24 reglas).
- Modelo conceptual candidato del Hito 1.
- Matriz de decisiones B1–B4, D01–D10, H01–H12.
- Factibilidad MariaDB 10.4.32 en XAMPP.
- Consigna general de «Una base de datos que se juega».

Se preserva el alcance de un **duelo de 2 jugadores en un mismo dispositivo**, con 40 tipos de naipes, mazos de 12 cartas, 20 de vida por héroe, máximo 3 cartas en campo, energía 1–5, victoria inmediata o final al turno global 30.

## Qué hacer con estos archivos

Copiar estos documentos a `docs/siguiente-paso/` del repositorio, revisarlos en grupo y ejecutar el prompt 04 con Codex en la carpeta del proyecto. El MER conceptual debe dibujarlo y validarlo el grupo. En paralelo se puede desarrollar un frontend con datos simulados: **no debe mostrarse como conexión real a SQL hasta tenerla**.

## Decisiones todavía pendientes

- **B1:** colección estática de prueba, mazos usados inmutables e historial.
- **B2:** especialización total/disjunta `Jugada → Invocacion | Ataque`, por validar con el docente.
- **B3:** distinción de estado operativo, valores derivados e instantáneas históricas.
- **B4:** reglamento 0.2 y límite de 30 turnos globales.

El modelo principal para la materia es **MariaDB/XAMPP**. Supabase usa PostgreSQL, por lo que su uso como motor alternativo debe ser aprobado por el docente y requiere scripts SQL separados.
