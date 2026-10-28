Estado marcado con punto y rótulo: `Status`, `OrderStatusBadge`, `PaymentBadge` y `StatusDot`.

- Implementación: `app/src/components/ui/Status.tsx`. Clases: `pasto-dot`, `pasto-status`.
- El estado nunca se marca solo con color: siempre hay punto y rótulo.
- Estados de pedido: Preliminar (punto hueco), Pendiente de confirmación (terracota), Confirmado (verde), En producción (cobre), Listo (verde), Entregado (carbón) y Cancelado (hueco). El rótulo usa `Tag`: `brand` para los confirmados, `neutral` para el pendiente y `outline` para el resto.
- Pago: `Pagado` en `brand` y `Pago pendiente` en `outline`.
- Usá `orderStatusLabel` cuando necesites solo el texto (filtros, mensajes).
