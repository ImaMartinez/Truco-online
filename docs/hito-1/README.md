# Hito 1 — Borrador académico para revisión

Cierre documental 03/11/2026: descripción y24reglas ya disponibles; para el dibujo usar [guía manual actualizada](08-guia-manual-mer-drawio.md), [inventario conceptual](04-modelo-conceptual-candidato.md) y [auditoría del SQL/normalización](../hito-2/02-auditoria-implementacion.md). No se generó un MER definitivo. La revisión y firma del grupo siguen pendientes.

Fecha: 02/11/2026. Versión propuesta: **0.2** del reglamento; se conserva el catálogo **0.1** de 40 cartas.

La preparación documental está realizada. El Hito 1 **todavía no está aprobado**: faltan la revisión humana y el MER construido, comprendido y validado por el grupo. La autorización para avanzar a este borrador no aprueba automáticamente las decisiones D01–D10.

## Documentos

| Archivo | Contenido |
|---|---|
| [01-descripcion-academica.md](01-descripcion-academica.md) | Descripción de aproximadamente una página, objetivo, mecánica y victoria |
| [02-reglamento-recomendado.md](02-reglamento-recomendado.md) | Reglas precisas, ciclo de turno, estados y prioridades de cierre |
| [03-revision-etapa-0.md](03-revision-etapa-0.md) | Revisión de los seis documentos, problemas, balance y propuestas justificadas |
| [04-modelo-conceptual-candidato.md](04-modelo-conceptual-candidato.md) | Entidades, atributos, cardinalidades y especialización para construir el MER |
| [05-factibilidad-mariadb.md](05-factibilidad-mariadb.md) | Entorno comprobado, restricciones, procedimientos, transacciones y límites de la validación |
| [06-revision-del-grupo-y-escenarios.md](06-revision-del-grupo-y-escenarios.md) | Decisiones pendientes, escenarios razonados y guía de defensa/validación |

## Trazabilidad y uso académico

Se leyeron todos los archivos de [Etapa 0](../etapa-0/01-idea-y-reglas.md). Sus seis originales se preservan sin cambios; las aclaraciones y simplificaciones propuestas se registran aquí, sin reemplazar silenciosamente un antecedente. No hay aprobaciones humanas documentadas hasta esta entrega.

La IA propone y critica. El grupo debe dibujar su MER, discutir los roles y cardinalidades, justificar la especialización y registrar sus decisiones en [la revisión](06-revision-del-grupo-y-escenarios.md) y en [la bitácora](../bitacora-ia.md). Esta carpeta no contiene un diagrama definitivo listo para entregar ni un modelo relacional certificado en 3FN.

Se mantuvieron los límites de alcance: documentación Markdown y consultas técnicas de solo lectura; sin SQL de implementación, frontend, backend, commits ni cambios de configuración del servidor. PostgreSQL/Supabase sigue siendo una adaptación posterior sujeta al docente.
