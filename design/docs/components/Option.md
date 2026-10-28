Opción en tarjeta (`ChoiceOption`) e interruptor (`Switch`) para elecciones sí/no o de una entre pocas con detalle.

- Implementación: `app/src/components/ui/Choice.tsx`. Clases: `pasto-option`, `pasto-switch`.
- `ChoiceOption`: radio o casilla dentro de una tarjeta con título y descripción (ej. "Miércoles 04/11 · Pedí hasta el lunes a las 12:00"). La elegida cambia el borde a `surface-brand`. Una opción no disponible va deshabilitada y explica por qué.
- `Switch`: interruptor con `role="switch"`, para consentimientos y para abrir o cerrar un día en la agenda. El texto dice qué pasa al activarlo.
- Foco visible con anillo de 2px en ambos.
