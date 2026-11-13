# Documentación de TrucoOnline

La entrada principal es el [README del proyecto](../README.md). Este índice separa las instrucciones vigentes de los antecedentes académicos y del desarrollo.

## README activos y ubicación

`README.md` en la raíz es la única entrada del proyecto e incluye la guía completa de instalación XAMPP. El archivo raíz `README-INSTALACION-XAMPP.md` se integró allí y ya no existe por separado.

Estos 15 README/LEEME complementarios permanecen dentro de sus carpetas:

| Documento | Función |
|---|---|
| `docs/README.md` | Este índice de documentación. |
| [Entrega](entrega/README.md) | MER, MR, SQL, informe y pendientes académicos. |
| [Hito 1](hito-1/README.md) | Descripción y reglamento académico. |
| [Hito 2](hito-2/README.md) | Modelo relacional y normalización. |
| [Hito 3](hito-3/README.md) | SQL, consultas y evidencia académica. |
| [Hito 4](hito-4/README.md) | Aplicación e informe pendiente. |
| [Revisión final](revision-final/README.md) | Limpieza y validaciones del repositorio. |
| [MER](diagramas/LEEME-MER-simple.md) | Uso del diagrama editable y sus límites. |
| [MariaDB](../database/mariadb/README.md) | Scripts del motor local. |
| [Eliminación de mazos](../database/mariadb/README-deck-removal.md) | Contrato de baja y conservación del historial. |
| [Formato de 20 cartas](../database/mariadb/README-decks-20.md) | Compatibilidad y actualización del formato. |
| [Instalador MariaDB](../database/mariadb/install/LEEME.md) | Instalación de la base para inspección. |
| [PostgreSQL](../database/postgres/README.md) | Motor operativo y fuentes PostgreSQL. |
| [Instalador PostgreSQL](../database/postgres/install/LEEME.md) | Instalación en una base nueva y límites. |
| [Assets](../truco_arena_sprites/README.md) | Arte canónico, manifiesto y hashes. |

## Guías vigentes

- [Instalación y ejecución local con XAMPP](../README.md#instalación-local-con-xampp).
- [Arquitectura, modalidades y límites de seguridad](arquitectura.md).
- [Configuración de Railway, Vercel y Supabase](despliegue.md).
- [Pruebas y reproducción de verificaciones](pruebas.md).
- [Motor local: contratos y transacciones MariaDB](tecnica/mariadb.md).
- [Historial consolidado de validaciones reales](historial-validaciones.md).
- [Auditoría y propuesta de limpieza para revisión](revision-final/README.md).

## Material académico

- [Índice para la entrega](entrega/README.md): MER, MR, SQL, consultas, informe y pendientes.
- [Modelo relacional y diccionario](hito-2/01-modelo-relacional-preliminar.md).
- [MER conceptual editable y sus límites](diagramas/LEEME-MER-simple.md).
- [SQL, consultas y evidencia académica](hito-3/README.md).
- [Bitácora real de uso de IA](bitacora-ia.md).

Las propuestas de [Etapa 0](etapa-0/01-idea-y-reglas.md), [Hito 1](hito-1/README.md) y las auditorías de [Hito 2](hito-2/README.md) se conservan para explicar decisiones, reglas y evolución. El catálogo fuente `etapa-0/02-cartas-y-equilibrio.md` **también participa del build**: no es documentación descartable.

## Archivo técnico

`archivo/supabase/` conserva las decisiones y verificaciones de las fases de implementación. Tiene valor de trazabilidad; las afirmaciones «pendiente» o «solo local» corresponden a la fecha de cada fase. Para operar hoy, utilizar las guías vigentes de arriba. Los logs, capturas de depuración y JSON QA reproducibles no forman parte de la versión final.
