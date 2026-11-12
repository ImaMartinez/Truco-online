# Hito 2 — preparado para revisión humana

Objetivo: modelo relacional, normalización hasta 3FN y diccionario de datos, derivados del MER validado.

No hay MR aprobado por el grupo. La [referencia implementada y diccionario](01-modelo-relacional-preliminar.md) cubre las13tablas/65columnas, con tipos, claves, dominios y significado funcional; no se creó un diccionario duplicado. La [auditoría](02-auditoria-implementacion.md) contiene el dictamen de1FN/2FN/3FN por tabla, claves candidatas, DF, B1–B4 y guía de conciliación con el MER.

Dictamen técnico:3FN bajo las DF de dominio identificadas y la aclaración del usuario de costo independiente. Carta no se afirma enBCNF. Falta revisión/ratificación humana, versión de MER/MR y acta con autores/fecha/evidencia; no una nueva etapa de planificación.

Verificación de cierre: solo lectura de MariaDB10.4.32 y archivos SQL. Se comprobaron65nombres/tipos/nulabilidades contra las fichas existentes,65significados funcionales y34enlaces locales. El SELECT hipotético para jerarquía6 mostró que dos costos distintos no requieren cambiar su jerarquía; no hubo UPDATE de estadísticas. No se repitieron pruebas funcionales por cambios exclusivamente documentales; la evidencia de juego/SQL ya ejecutada permanece en Hito3.

| Entrega | Material único a revisar | Estado de cierre |
|---|---|---|
| Hito1 | Descripción,24reglas y guía/manual delMER en [su índice](../hito-1/README.md) | Documentación preparada; falta dibujo propio del grupo y aprobaciónB1–B4 |
| Hito2 | Este índice, MR/diccionario y auditoría de normalización | Dictamen técnico favorable; falta revisión/firma delMR y justificación comprendida por todos |
| Hito3 | [Scripts, diez consultas, vista y evidencia](../hito-3/README.md) | Implementados y probados; aprobación académica condicionada a revisión del modelo |
| Hito4 | [Aplicación e instalación](../hito-4/README.md) | Juego local verificado; informe final/revisión pendientes, sin despliegue |

Próxima y única revisión importante: el grupo dibuja MER y MR con la guía existente, contrasta sus extremos con el diccionario, justifica Carta y las dos N:M, registra B1–B4 con nombres/fecha/versiones reales y presenta los archivos editables para auditoría. No hay diagrama definitivo generado por IA ni aprobaciones inventadas.
