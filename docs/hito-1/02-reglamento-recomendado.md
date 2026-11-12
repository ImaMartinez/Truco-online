# Reglamento recomendado 0.2

Propuesta consolidada para discutir y adoptar en el Hito 1. «Recomendado» no significa aprobado por el grupo. Mantiene las mecánicas y las 40 estadísticas de Etapa 0; las precisiones nuevas se justifican en [la revisión](03-revision-etapa-0.md).

## Reglas numeradas

1. **Catálogo.** Existen cuarenta tipos: cuatro palos y números 1, 2, 3, 4, 5, 6, 7, 10, 11 y 12. Ataque, vida base, energía y jerarquía provienen de la base. La jerarquía no modifica el combate; los palos no tienen habilidades.
2. **Propiedad.** Cada jugador tiene cantidades por tipo en su colección. Utilizar una carta no reduce esa cantidad y puede incluirse en varios mazos. La colección no se altera durante una partida; en el MVP no hay compra, intercambio ni bajas de copias.
3. **Construcción.** Un mazo pertenece a un jugador. Puede guardarse con 0–12 cartas, sin renglones de cantidad cero. Cada tipo tiene una o dos copias y no supera la cantidad poseída. Comenzar requiere exactamente doce.
4. **Conservación.** Composición, nombre y propietario de un mazo usado quedan inmutables; editar significa duplicarlo en un mazo nuevo. Se permite archivarlo sin alterar el historial. Los perfiles archivados no inician nuevas partidas; sus datos históricos permanecen. El catálogo se congela en esta versión.
5. **Participantes.** Intervienen exactamente dos jugadores distintos, cada uno con un mazo propio habilitado y veinte de vida. Un jugador solo puede tener una partida activa. La asignación inicial sortea quién ocupa la posición 1 (comienza) y quién la 2; luego no cambia.
6. **Inicio único y atómico.** Validar ambos mazos y jugadores; crear partida, dos participaciones, doce copias por participación y el primer turno. Cada conjunto de doce recibe posiciones aleatorias únicas 1–12. Las posiciones 1–3 comienzan en mano y 4–12 en mazo. Se conserva ese orden original y la composición. Si falla algo, nada del inicio queda confirmado.
7. **Identidad.** Cada copia mantiene identidad y dueño durante toda la partida. No se juega por el identificador del tipo del catálogo. Solo puede estar en una zona: MAZO, MANO, CAMPO o DESCARTE. Nunca se roba o invoca desde descarte ni se reutiliza otra copia para completar un comando.
8. **Alternancia.** Los turnos globales van del 1 al 30. La posición 1 juega impares y la 2 pares. El turno propio del actor es `floor((numero_global + 1) / 2)`. En una partida activa hay exactamente un turno abierto; en una finalizada, ninguno.
9. **Apertura de turno.** Abrir un turno repone energía a `min(5, turno_propio)` y, desde el segundo turno propio, roba la copia de menor posición que siga en MAZO. En el primer turno propio de ambos no se roba. Apertura, energía y robo son una sola operación; confirmar la pantalla de transición no vuelve a ejecutarlos.
10. **Energía.** La energía disponible nunca es negativa ni supera el máximo del turno. Invocar descuenta el costo completo; no se recupera por muerte de cartas. Los ataques cuestan cero energía. La energía sobrante no se traslada al próximo turno propio.
11. **Acciones y orden.** El actor puede invocar, atacar y finalizar en el orden que prefiera, intercalando acciones. No existe una fase obligatoria de combate. La energía cero no obliga a finalizar si hay ataques posibles. Finalizar siempre es legal mientras la partida y su turno estén activos.
12. **Invocación.** Debe elegirse una copia propia en MANO, tener energía suficiente y menos de tres copias propias en CAMPO. La copia pasa a CAMPO con vida base y se registra una invocación. No hay carriles, posiciones tácticas, sacrificio voluntario ni reemplazo automático de una carta para abrir espacio.
13. **Preparación.** Una carta recién invocada no ataca en ese turno. Podrá hacerlo en el siguiente turno propio si permanece viva. Sí puede recibir ataques y devolver daño al defender desde el momento de su invocación. No es necesario «desagotarla» mediante una acción separada.
14. **Atacante.** Debe ser una copia propia viva en CAMPO, invocada en un turno anterior y sin ataque registrado en el turno actual. Cada ataque consume la posibilidad de atacar de esa copia en ese turno, aunque muera. Defender no consume su ataque ni está limitado a una defensa por turno.
15. **Objetivo.** Debe elegirse exactamente una copia enemiga viva en CAMPO o el héroe rival. El héroe solo es legal si el campo enemigo está vacío al ejecutar el ataque. No se ataca a aliados, a uno mismo, a cartas fuera del campo ni a participantes/copias de otra partida.
16. **Intercambio simultáneo.** Contra una carta, se toman los dos ataques y las dos vidas previas. Ambos reciben el ataque contrario, aunque uno o ambos mueran. Vida resultante = `max(0, vida_previa − ataque_recibido)`. El daño no se transfiere al héroe ni a otra carta. Contra un héroe solo se modifica su vida; el héroe no contraataca.
17. **Daño y descarte.** El daño persiste entre turnos. No hay curación, armadura, resurrección ni ataque automático. Cada copia con vida resultante cero pasa a DESCARTE en el mismo ataque. Si ambas mueren, se descartan ambas. El espacio queda disponible inmediatamente para una invocación posterior del actor.
18. **Ataque posterior al despeje.** Si un ataque elimina la última carta enemiga, otra copia propia preparada que todavía no atacó puede atacar al héroe en ese mismo turno. El atacante anterior no vuelve a atacar.
19. **Fin voluntario.** Finalizar cierra el turno actual. Si su número es menor que 30 y la partida sigue, abre el siguiente y aplica la regla 9, todo atómicamente. La interfaz oculta ambas manos hasta la confirmación presencial del nuevo actor. Los datos ya confirmados no se revierten por cancelar esa pantalla o recargar.
20. **Victoria inmediata y prioridad.** Después de cada ataque se comprueba la vida del héroe afectado. Si llegó a cero, gana el otro participante y, en la misma transacción, se registra el ataque, se cierra el turno abierto y se finaliza la partida. No se espera un botón de finalizar, no se abre otro turno y no hay robo adicional. Esta condición tiene prioridad también durante el turno 30.
21. **Cierre por límite.** Si no hubo victoria inmediata, al finalizar el turno global 30 se comparan las vidas de héroe: gana la mayor; si son iguales, empate. No se evalúan cartas, energía, jerarquía ni daño previo para desempatar. No se crea el turno 31. El turno 29, por sí solo, no activa este cierre.
22. **Mazo vacío.** Si no hay copia en MAZO, no se roba y no ocurre penalización. Agotar mano/campo/mazo no provoca derrota ni cierre anticipado. Se sigue actuando o pasando hasta victoria o límite. Sin robo adicional, las nueve copias restantes se terminan de robar al abrir el turno propio 10.
23. **Errores e interrupciones.** Fuera del turno, objetivos inválidos, acciones sobre partida finalizada o recursos insuficientes se rechazan sin efecto ni jugada exitosa. Los comandos confirmados repetidos no duplican efectos. Recargar o cerrar una pestaña no constituye abandono: se reanuda el último estado confirmado, con transición. No hay temporizador de inactividad ni derrota por desconexión en este MVP.
24. **Resultado e historial.** Una partida finalizada conserva dos participantes, todas sus copias, turnos cerrados y acciones exitosas. El ganador es uno de esos participantes o ninguno en empate; el motivo es VIDA_CERO o LIMITE_TURNOS. El resultado se obtiene de estado, motivo y ganador, sin otro resultado contradictorio. No se admite empate por ambos héroes a cero porque ninguna acción actual puede dañarlos simultáneamente.

## Aperturas de referencia

La energía indicada es la disponible **justo después de abrir**, antes de invocaciones.

| Global | Actor | Propio | Energía | Robo de apertura |
|---:|---|---:|---:|---|
| 1 | Posición 1 | 1 | 1 | No |
| 2 | Posición 2 | 1 | 1 | No |
| 3 | Posición 1 | 2 | 2 | Una, si queda |
| 4 | Posición 2 | 2 | 2 | Una, si queda |
| 9 | Posición 1 | 5 | 5 | Una, si queda |
| 10 | Posición 2 | 5 | 5 | Una, si queda |
| 19 | Posición 1 | 10 | 5 | Novena y última del mazo inicial |
| 20 | Posición 2 | 10 | 5 | Novena y última del mazo inicial |
| 29 | Posición 1 | 15 | 5 | Sin copia disponible |
| 30 | Posición 2 | 15 | 5 | Sin copia disponible |

## Invariantes de zonas propuestos

| Zona de copia | Vida temporal | Invocación previa | Salida permitida |
|---|---|---|---|
| MAZO | No aplica: NULL | No | MANO al robar |
| MANO | No aplica: NULL | No | CAMPO al invocar |
| CAMPO | Entre 1 y vida base | Exactamente una | DESCARTE si muere |
| DESCARTE | 0 | Exactamente una | Ninguna |

La asignación inicial a MANO es parte del inicio; no requiere fingir tres robos de turno ni crear jugadas de invocación. La vida temporal no se inicializa para cartas que todavía no están en campo. No se almacenan negativos ni se permite una carta de vida cero en campo al terminar una operación.

## Fin alcanzable y límite temporal

Pasar los treinta turnos sin invocar es una secuencia válida y termina 20–20 en empate. La victoria también es alcanzable con las cartas actuales; se presenta una secuencia legal en [los escenarios](06-revision-del-grupo-y-escenarios.md).

El límite asegura cierre por cantidad de turnos si se continúa jugando. No asegura duración máxima en minutos si alguien no actúa. No se agregan cierre automático por falta de recursos, compensación de iniciativa ni reglas especiales para el turno final sin revisión del grupo.
