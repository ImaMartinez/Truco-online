# Errores en popup sin desplazar el tablero — local

12/11/2026. Pedido del titular: presentar los errores como un popup del estilo de Cómo jugar para preservar las dimensiones del tablero. Se conserva la instrucción de dejar los cambios locales, sin commits, push ni despliegue.

Se añadió `frontend/src/components/PopupNotice.tsx`: diálogo nativo en portal de `document.body`, con la estética de las confirmaciones, rol `alertdialog`, título/descripción accesibles, foco inicial, cierre con Entendido/X/Escape y devolución del foco al control anterior. Tiene ancho y alto limitados al viewport; el contenido puede desplazarse dentro del popup si resulta extenso.

`Notice` utiliza ese popup para los errores; los mensajes normales de éxito/información conservan su presentación. También se adaptaron los errores explícitos de login/perfil, Jugar, salas y cierre de partidas para usarlo. Los errores globales de App/SupabaseWebApp quedan fuera del flujo del tablero. La colección permite descartar su error sin modificar los datos.

Battlefield agrupa error de jugada, fallo de polling y reintentos de acción/abandono en un solo aviso. Los paneles de operación pendiente que antes antecedían al tablero se trasladaron al popup. Cerrarlo no borra la solicitud ni su requestId, no reanuda una acción incierta y no modifica reglas, energía, cartas o turnos.

Si continúa una falla de conexión o una operación pendiente, queda un acceso flotante para volver a consultar el aviso y reintentar. La identidad de la incidencia evita reabrirlo en cada polling mientras persiste el mismo fallo. Una recuperación de conexión retira el aviso. El reloj online y la validación de servidor siguen funcionando; cerrar un popup no pausa una partida online. Los indicadores normales de turno/energía y los avisos propios del reloj no se convierten en errores.

## Verificación

- `npm test`: 47 pruebas aprobadas, catálogo de 40 cartas y sprites originales intactos.
- `npm run build` y `npm run test:build`: aprobados.
- Tres pruebas E2E nuevas: errores de energía repetidos en 1366×768, 390×844 y 360×800; operación incierta con reintento de idéntico payload; polling persistente que no reabre el popup después de descartarlo y reconexión accesible.
- Se comparan X/Y/ancho/alto de tablero, área central, campo, mano, vidas y acciones, antes/durante/después: variación permitida máxima 1 px. Se comprueban foco, Escape, segunda aparición del mismo error tras un nuevo intento, ausencia de escrituras para energía inválida y ausencia de desborde horizontal.
- Ocho pruebas focalizadas (tres nuevas y cinco del cierre/cambio de modalidad previo) aprobaron.
- La ejecución amplia obtuvo 40 de 41 casos correctos; el restante seguía intentando pulsar el botón de reintento situado detrás del nuevo modal. Se actualizó la expectativa para usar `Reintentar conexión` dentro del popup y pasó la repetición focalizada. Así quedaron verificados los 41 casos únicos; no se presenta esa repetición como una segunda ejecución completa.
- Se actualizaron los selectores del arnés Auth para el nuevo `alertdialog` y su descarte antes de continuar. Ese arnés remoto no se ejecutó: no se crearon perfiles ni sesiones QA nuevas en Supabase para este cambio visual.

Capturas inspeccionadas: `artifacts/error-popups/1366x768-energy.png`, `390x844-energy.png`, `360x800-energy.png`; artefactos locales excluidos de Git. Revisión React: componentes de diálogo separados, hooks incondicionales, clave estable de incidencia y sin actualización de estado durante render.

Este ajuste es exclusivamente frontend/pruebas/documentación. No requiere una nueva migración. La migración del pedido anterior de cierre CPU sigue pendiente y no se aplicó remotamente. Se preservan los cambios anteriores del instalador SQL, MER y ciclo de partidas. Los hashes de HEAD y origin/master siguen iguales a `7d2a1652b1f3265ac2eb1b40a0b074b5628d0da6`.
