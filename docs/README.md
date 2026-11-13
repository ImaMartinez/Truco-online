# Documentación de TrucoOnline

La entrada principal es el [README del proyecto](../README.md). Este índice separa las instrucciones vigentes de los antecedentes académicos y del desarrollo.

## Guías vigentes

- [Instalación y ejecución local con XAMPP](../README-INSTALACION-XAMPP.md).
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
