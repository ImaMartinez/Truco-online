# Decisiones pendientes y riesgos

Todas las siguientes recomendaciones están pendientes de revisión por el grupo. No se registran como aprobadas por la creación de estos documentos.

## Registro de decisiones

| ID | Decisión | Recomendación inicial | Validación necesaria |
|---|---|---|---|
| D01 | Alcance de colección | Dos copias de las 40 cartas en perfiles demo; consulta y uso en mazos, sin adquisición/intercambio | Grupo/docente: si se exige gestión de altas/bajas, definirla y sus restricciones antes del MER |
| D02 | Regla de cierre | Turno global 30; ambos completan 15 turnos salvo victoria previa | Grupo: escenarios 29/30, empate y campo agotado |
| D03 | Robo y preparación | Sin robo en primer turno propio de ambos; sin ataque al invocar; defensa inmediata | Grupo: ejemplos en papel |
| D04 | Balance y ventaja inicial | Catálogo 0.1, sorteo sin compensación especial | Grupo: aceptar como punto de prueba; medir al tener prototipo |
| D05 | Estructura avanzada | Especialización total/disjunta Jugada–Invocacion/Ataque | Grupo/docente: aceptación conceptual y forma de representarla |
| D06 | Historial estable | Mazos usados inmutables y duplicables; catálogo congelado por versión MVP | Grupo: flujo de editor e impacto de futuros rebalanceos |
| D07 | Modo local y reanudación | Perfiles sin autenticación; una partida activa por jugador; sin derrota por desconexión | Grupo: confirmar alcance local, pausa y selección de partida |
| D08 | Integridad y permisos | Rutinas SQL + rol de aplicación limitado, transacción coordinada por backend | Grupo: comprender y defender bloqueos, atomicidad y privilegios |
| D09 | PostgreSQL/Supabase | Complemento posterior con scripts y pruebas propios | Docente: aprobación de alternativa; verificar servidor antes de elegir sintaxis |
| D10 | Política de nombres | Alias único según clave normalizada y política explícita de acentos/mayúsculas; nombres de mazos únicos por dueño bajo política acordada | Grupo: definir ejemplos («Ana»/«ana», «José»/«Jose») y probar ambas bases |

Para aprobar una decisión, agregar responsable, fecha, motivo y referencia a la versión revisada. Un cambio no debe sobrescribir silenciosamente el modelo aprobado. Si D01, D05 o D06 cambian, volver a revisar las entidades antes del Hito 2.

## Riesgos y medidas

| Riesgo | Consecuencia | Medida propuesta |
|---|---|---|
| Alcance demasiado grande | Cuatro hitos incompletos | Priorizar MariaDB y hot-seat; PostgreSQL complementario; sin tiempo real |
| MER generado sin comprensión | Incumplimiento académico y defensa débil | Grupo construye/valida; bitácora y ejemplos por relación |
| Especialización no aceptada | Falta estructura avanzada reconocida | Validar D05 antes de aprobar el MER; no inventar ventaja artificial |
| Mezclar atributos base/temporales | Daño compartido entre cartas iguales | Identidad por copia y una zona única por instancia |
| Controles solo en JavaScript | Escrituras inválidas desde otra ruta | Rutinas, constraints, permisos y tests SQL directos |
| Conteos sin bloqueo estable | Cuarta carta, doble ataque, mazo excedido | Mutex de partida/mazo, orden de bloqueo y dos sesiones reales |
| Creer que CHECK hace todo | Límites agregados sin garantía | Diferenciar restricción de fila de operación transaccional |
| Diferencias entre motores | Scripts que fallan o resultados distintos | SQL propio, tipos/collation explícitos y pruebas de contrato |
| Servidor sin modo estricto | Conversiones/truncamientos inesperados | Configurar sesiones de aplicación y verificarlo sin cambiar ahora XAMPP |
| Barajado distinto en cada base | Pruebas de equivalencia no reproducibles | Orden generado una vez y fixtures deterministas compartidos |
| Control defensivo dominante | Muchas partidas llegan al límite | Medir resultados y ajustar catálogo con versión y revisión |
| Primer turno ventajoso | Sesgo de victorias | Sorteo, pruebas alternadas y datos por posición inicial |
| Rebalancear cartas con historial | Reconstrucción y estadísticas ambiguas | Catálogo congelado; diseñar versionado antes de publicar cambios |
| Pantalla compartida confundida con seguridad | Exposición de manos en una publicación prematura | Transición local y proyecciones; autenticación/autorización antes de modo remoto |
| Exposición por Data API o vistas | Lectura/escritura fuera del backend | Esquema no expuesto, permisos mínimos; RLS explícita si hay exposición |
| Respuesta perdida tras COMMIT | Acción aplicada dos veces | Clave idempotente y consulta del estado confirmado |
| Seeds irreales | Estadísticas engañosas e invariantes rotas | Generar historial consistente y distinguir pruebas inválidas revertidas |
| Confundir planes con resultados | Informe sin evidencia verificable | Etiquetar pendiente/ejecutado y guardar resultados reales |

## Próxima etapa recomendada

Realizar una revisión del grupo de D01–D10 y construir el MER del Hito 1. Priorizar D01 (colección), D05 (especialización) y D06 (historial) por su impacto conceptual. Después acordar claves, dependencias y diccionario del Hito 2. Esta entrega no autoriza implícitamente a implementar los cuatro hitos de una vez.
