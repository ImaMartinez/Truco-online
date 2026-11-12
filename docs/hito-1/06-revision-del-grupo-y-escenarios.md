# Revisión del grupo, escenarios y defensa

Fecha: 02/11/2026. Preparación documental del Hito 1 realizada; construcción y aprobación del MER pendientes. No se registran revisores humanos ni firmas que no hayan sido aportados.

## Criterios conservados

Se mantiene el MVP de dos jugadores en un dispositivo, baraja de cuarenta cartas sin habilidades, MariaDB/XAMPP como versión principal, consultas SQL explícitas y reglas críticas en la base. El modelo y el código deben ser defendibles por todos los integrantes. PostgreSQL/Supabase queda para después y condicionado al docente.

La propuesta consolida 20 de vida, mazos 12/2, tres espacios, energía 1–5, tres cartas iniciales, robo desde el segundo turno propio, daño simultáneo persistente y cierre al finalizar el global 30. Consolidar la recomendación no equivale a registrar su aprobación por el grupo.

## D01–D10: decisiones que siguen pendientes

| ID original | Recomendación que se conserva | Impacto y aprobación requerida |
|---|---|---|
| D01 — Colección | Perfiles demo con dos copias de cada tipo; consulta y construcción, sin altas/bajas durante el MVP | Confirmar con grupo/docente si «administrar» exige adquisición o eliminación. Si cambia, revisar integridad de mazos |
| D02 — Cierre | Global 30, ambos con 15 turnos propios salvo victoria previa | Grupo acepta casos de empate y asimetría de última respuesta |
| D03 — Robo/preparación | Sin robo en primer turno propio de ambos; carta invocada espera para atacar y defiende inmediatamente | Grupo explica aperturas 1/2/3/4 y combate de carta nueva |
| D04 — Balance | Conservar estadísticas 0.1 y sorteo sin compensación | Aceptar equivalencias de perfiles e hipótesis de balance; pruebas posteriores |
| D05 — Estructura avanzada | Jugada especializada total/disjunta en Invocacion y Ataque | Docente valida que cumple la consigna; grupo dibuja y justifica |
| D06 — Historia estable | Mazo usado y dueño inmutables, copia para editar, catálogo congelado | Grupo acepta flujo y política de cambios futuros |
| D07 — Modo local | Sin autenticación, una activa por jugador, reanudación sin derrota automática | Grupo confirma restricción entre partidas activas y archivo de perfiles |
| D08 — SQL | Procedimientos y permisos limitados; transacción coordinada desde backend | Grupo debe explicar atomicidad, errores y bloqueos sin depender solo de JavaScript |
| D09 — Otro motor | Adaptación posterior con SQL y pruebas propios | Aprobación docente; ninguna cuenta remota necesaria ahora |
| D10 — Nombres | Unicidad con política explícita por definir | Resolver alias/nombres de mazos, mayúsculas, acentos y archivo antes de claves definitivas |

## Precisiones nuevas a aceptar expresamente

| Referencia de revisión | Propuesta | Qué debe decidir el grupo |
|---|---|---|
| H01–H03 | Cerrar turno al matar héroe; ataques sin energía; vida NULL antes de invocar | Adoptar como interpretación explícita del reglamento |
| H04–H06 | Jugador/actor/preparación obtenidos por sus fuentes, sin columnas duplicadas por comodidad | Validar vínculos derivados al dibujar el MER y no reintroducir redundancia en el MR |
| H07 | Guardar solo dos vidas previas como observaciones históricas de Ataque, con datos posteriores derivados | Aceptar justificación de auditoría o acordar reconstrucción completa |
| H08 | Jugada solo invocación/ataque; inicio/cierre en Partida/Turno | Confirmar terminología y totalización/disyunción |
| H09 | Transacción activa, error propagado, lectura actual bajo bloqueo | Adoptar como contrato técnico para Hitos 2/3 |
| H10 | Recorrer Participante → Mazo → Jugador en estadísticas | Ajustar consultas al modelo que finalmente se apruebe |
| H11 | Conservar turno 30 y medir su asimetría | No añadir reglas finales o compensación sin pruebas y nueva revisión |
| H12 | Nombre editorial en Carta consultado de SQL | Reconocer el requisito original y revisar su dependencia respecto de la identidad del catálogo |

## Escenarios de mesa: resultados razonados

Estos casos se resolvieron aplicando el reglamento a mano durante la revisión. No son tests ejecutados contra MariaDB ni partidas jugadas con personas; los resultados observados del software siguen pendientes.

| Caso | Situación/acción | Resultado esperado por reglas |
|---|---|---|
| E01 | Iniciar con dos mazos válidos | Dos participantes, 24 copias; cada uno con 3 en mano y 9 en mazo; global 1 abierto con energía 1 |
| E02 | Pasar global 1 y abrir 2 | Segundo jugador con energía 1 y las mismas 3 de mano inicial; sin robo |
| E03 | Pasar global 2 y abrir 3 | Primero con energía 2; pasa una copia de posición 4 a mano, una sola vez |
| E04 | Global 3: energía 2, invocar carta costo 3 | Rechazo completo; no baja energía ni cambia zona ni aparece jugada exitosa |
| E05 | Invocar carta costo 1 con energía 2 y dos en campo | Energía 1 y tres en campo; nueva carta todavía no ataca |
| E06 | Con tres propias en campo, intentar invocar otra | Rechazo; después de morir una en ataque propio sí habrá lugar para invocar |
| E07 | Carta nueva recibe ataque enemigo | Defiende con su ataque base; no necesita haber tenido un turno propio posterior |
| E08 | ESP-02 (3/2) ataca BAS-02 (2/3), ambas intactas | Ambas quedan en cero y van a descarte; una Jugada/Ataque; una eliminación atribuida a cada una |
| E09 | BAS-02 (2/3) ataca BAS-06 (1/4), intactas | Vidas 2 y 2; daño persiste; atacante no repite ataque en ese turno |
| E10 | Atacar al héroe con una enemiga en campo | Rechazo, aunque el héroe tenga menos vida que el ataque; hay que despejar primero |
| E11 | Matar última enemiga, luego atacar héroe con otra preparada | Segunda acción legal si esa otra copia no atacó; no hay transferencia del primer daño |
| E12 | Abrir turno propio 10 y luego 11 | En 10 roba la novena restante si todas las anteriores aperturas ocurrieron; en 11 no roba ni recibe penalización |
| E13 | Global 29 termina con vidas 9–8 | Se abre 30; todavía no hay ganador por límite |
| E14 | Global 30 termina 8–8 sin ataque letal | Empate, ambos turnos propios 15 completos, todos los turnos cerrados; sin 31 |
| E15 | Global 30: atacante 3 contra héroe de vida 2, campo vacío | Vida 0; victoria inmediata VIDA_CERO, cierra 30 sin requerir finalizar ni comparar por límite |
| E16 | Cerrar y recargar antes de confirmar la transición | Partida conserva siguiente turno ya abierto; mostrar transición no vuelve a robar |
| E17 | Repetir misma solicitud confirmada | Sin segundo descuento, ataque ni robo; reutilizar la clave con otro contenido se rechaza |
| E18 | Interrupción después del primer cambio de un combate | En la implementación, cualquier fallo debe causar ROLLBACK de toda la acción; aún no comprobado contra SQL |

### Ejemplo de victoria alcanzable

Posición 1 utiliza Mesa de espadas, con orden permitido de sus doce copias: ESP-05a, ESP-05b, ESP-02a, ESP-02b, ESP-04a, ESP-04b, ESP-06a, ESP-06b, ESP-03a, ESP-03b, ESP-07a, ESP-07b. Los sufijos distinguen instancias del mismo tipo y no son nuevas cartas del catálogo. Posición 2 tiene un mazo válido y pasa todos sus turnos, sin invocar: es legal aunque tenga acciones disponibles.

| Global de posición 1 | Energía al abrir y robo | Acciones propias | Vida del héroe rival al cerrar/resolver |
|---:|---|---|---:|
| 1 | 1; sin robo | Invoca ESP-05a por 1; no ataca | 20 |
| 3 | 2; roba ESP-02b | Invoca ESP-05b por 1; ESP-05a ataca por 2 | 18 |
| 5 | 3; roba ESP-04a | Invoca ESP-02a por 2; los dos ESP-05 atacan por 2 cada uno | 14 |
| 7 | 4; roba ESP-04b | Las tres preparadas atacan por 2+2+3 | 7 |
| 9 | 5; roba ESP-06a | Ataques por 2, 2 y 3; el último llega a cero | 0: victoria inmediata |

En 2, 4, 6 y 8 el rival pasa y no roba en su primer turno propio. Ningún atacante recibe daño al atacar al héroe; no hay cartas rivales que lo protejan. Nunca se exceden tres espacios ni se ataca con una recién invocada. Este ejemplo demuestra posibilidad de victoria bajo una secuencia legal, no equilibrio ni una estrategia óptima.

### Ejemplo de empate alcanzable

Con dos mazos válidos, ambos jugadores pasan desde el global 1 hasta el 30 sin invocar. Cada uno termina con doce copias en mano, cero en campo/descarte y cero en mazo después del turno propio 10. Los héroes siguen en 20. Cerrar el global 30 registra empate por LIMITE_TURNOS, no requiere inventar fatiga o muerte por mazo vacío.

## Revisión y defensa del MER por el grupo

Antes de dibujar, cada integrante debería poder responder con un ejemplo:

1. ¿Por qué Carta, Mazo_Carta y Copia_Carta_Partida no representan el mismo hecho?
2. ¿De qué par depende la cantidad en cada relación N:M? ¿Por qué no se suma entre mazos?
3. ¿Por qué se propone derivar el jugador desde el mazo y cómo evita una dependencia transitiva?
4. ¿Cómo se determina el actor sin dos fuentes contradictorias? ¿Qué pasa al matar al héroe?
5. ¿Qué significa especialización total/disjunta y por qué una FK no la garantiza completa?
6. ¿Cómo se distingue empate de partida activa si ambos tienen ganador vacío?
7. ¿Qué se bloquea cuando el campo está vacío? ¿Qué revierte un fallo a mitad del ataque?
8. ¿Por qué las vidas previas son observaciones históricas y el ataque base proviene del catálogo?

El grupo debe dibujar su MER con notación elegida, atributos, roles y mínimos/máximos; rotular relaciones derivadas y condiciones que no caben en una línea. Revisar el diagrama con el docente, corregirlo y registrar su versión. No pasar al MR definitivo del Hito 2 mientras esas decisiones sigan sin revisión.

## Registro de aprobación humana

| Fecha | Integrantes/revisor | Decisiones y documento revisados | Cambios solicitados/acordados | Versión aprobada |
|---|---|---|---|---|
| Pendiente | Pendiente | D01–D10; H01–H12; reglas 0.2; candidatos | Pendiente | Ninguna |

Actualizar también [la bitácora de IA](../bitacora-ia.md). No completar este registro con nombres o resultados supuestos.

## Evidencia de esta preparación

Se ejecutaron lectura integral de Etapa 0, inspección de versión/configuración MariaDB y análisis estático de las cuarenta estadísticas (incluidos sus dieciséis perfiles). La comprobación documental final valida enlaces locales, numeración y preservación de los antecedentes. Los escenarios son razonamientos de reglas; las pruebas de aplicación, permisos, rollback y concurrencia están pendientes hasta Hitos 3/4.

Comprobaciones adicionales ejecutadas sobre la documentación y sus cuentas:

- Reglas numeradas consecutivamente del 1 al 24; diez reglas SQL identificadas por separado.
- Catálogo: códigos únicos, números/palos y jerarquías válidas, estadísticas positivas y presupuesto consistente en las cuarenta filas.
- Aritmética del escenario de victoria: vida rival 20 → 18 → 14 → 7 → 0 en globales 1/3/5/7/9, sin energía negativa ni más de tres cartas.
- Aritmética de los treinta turnos: quince propios y nueve robos posteriores al reparto por cada participante.
- Enlaces locales sin destinos inexistentes y seis originales de Etapa 0 preservados, contrastados por SHA-256.

La verificación aritmética usa datos del escenario; no es un motor de juego implementado ni demuestra ejecución de SQL. La comparación de archivos distingue seis documentos nuevos y tres modificados: índices raíz/Hito 1 y bitácora. No se creó código ni se realizó commit.
