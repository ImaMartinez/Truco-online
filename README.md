# Truco Arena — Batalla de Naipes

> Actualización 03/11/2026: la demo y la persistencia provisional ya tienen implementación. Ver [ejecución con MariaDB](README-PERSISTENCIA.md) y [demo en memoria](README-DEMO.md). El texto siguiente conserva el estado histórico de Etapa 0; B1–B4 y la revisión académica continúan pendientes.

Proyecto integrador universitario de Bases de Datos. Dos jugadores se enfrentan con naipes españoles, energía y combate por turnos. La versión académica principal utilizará MariaDB de XAMPP.

**Estado: Etapa 0 documentada y borrador preliminar del Hito 1 preparado; revisión del grupo pendiente.** No hay aplicación, esquema SQL aprobado, dependencias instaladas ni pruebas funcionales ejecutadas. El MER y el modelo relacional deben ser construidos, comprendidos y validados por el grupo.

La preparación del Hito 1 está en [su índice de documentos](docs/hito-1/README.md): descripción académica, reglamento recomendado 0.2, revisión crítica, candidatos con atributos/cardinalidades, factibilidad MariaDB y escenarios para discutir. Conserva el catálogo 0.1 y registra las aclaraciones sin modificar los originales de Etapa 0.

## Lectura recomendada

1. [Idea, alcance y reglas propuestas](docs/etapa-0/01-idea-y-reglas.md).
2. [Las 40 cartas y su equilibrio inicial](docs/etapa-0/02-cartas-y-equilibrio.md).
3. [Entidades y relaciones candidatas](docs/etapa-0/03-modelo-candidato.md).
4. [Arquitectura, integridad SQL y dos motores](docs/etapa-0/04-arquitectura-y-sql.md).
5. [Hitos, consultas y verificaciones previstas](docs/etapa-0/05-plan-y-validacion.md).
6. [Decisiones pendientes y riesgos](docs/etapa-0/06-decisiones-y-riesgos.md).
7. [Entorno comprobado y fuentes técnicas](docs/entorno-y-fuentes.md).
8. [Bitácora de utilización de IA](docs/bitacora-ia.md).

## Propuesta central

- Dos personas en un mismo dispositivo; pantalla de transición entre turnos.
- 20 de vida, mazos de 12 cartas, hasta dos copias y hasta tres cartas en campo.
- Energía de 1 a 5; combate simultáneo entre cartas y ataque al héroe solo con campo enemigo vacío.
- Victoria inmediata por vida; cierre por comparación de vida al terminar el turno global 30.
- Copias de partida identificadas individualmente y persistidas en SQL.
- Reglas críticas impuestas por la base, además de los controles de interfaz.
- Especialización candidata `Jugada → Invocacion / Ataque` como estructura avanzada con utilidad real.

## Organización inicial

```text
frontend/                 React + Vite + TypeScript, pendiente
backend/                  Node + Express + TypeScript, pendiente
database/
  mariadb/                Scripts académicos futuros
  postgres/               Adaptación futura, condicionada al docente
docs/
  etapa-0/                Propuestas de esta entrega
  hito-1/                 Borrador académico; MER del grupo pendiente
  hito-2/                 Modelo relacional, 3FN y diccionario
  hito-3/                 SQL, datos, consultas y evidencia
  hito-4/                 Aplicación, pruebas e informe
```

## Entorno y ejecución

El 02/11/2026 se comprobó Node **24.16.0**, npm **11.13.0** y conexión al servidor **MariaDB 10.4.32**, con InnoDB disponible como motor predeterminado. PostgreSQL no se comprobó. Detalles y limitaciones en [entorno](docs/entorno-y-fuentes.md).

En esta etapa no existen comandos `npm install`, `npm run dev` ni scripts SQL propios para ejecutar. La guía ejecutable se incorporará a medida que se construyan y verifiquen los hitos. Los destinos previstos son:

| Componente | Destino |
|---|---|
| Frontend | `http://localhost:5173` |
| API REST | `http://localhost:4000` |
| Base principal | MariaDB de XAMPP; administración mediante phpMyAdmin |
| Alternativa complementaria | PostgreSQL en Supabase + backend Node en hosting compatible |

No se almacenarán credenciales en Git. El navegador accederá exclusivamente a la API; las variables `VITE_` solo contendrán configuración pública.

## Próximo paso

Revisión del grupo de D01–D10 y de las precisiones H01–H12 del borrador del Hito 1, seguida de la construcción del MER. Estas propuestas no constituyen una entrega conceptual aprobada. La implementación SQL comienza después de validar el modelo relacional del Hito 2. No se realizaron commits ni despliegues.
