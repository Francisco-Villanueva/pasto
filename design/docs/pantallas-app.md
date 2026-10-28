# Pantallas de la app que no están en `views/`

Las vistas de `design/views/` cubren la tienda y el backoffice del PRD original. Estas pantallas salen de las decisiones del plan y se resolvieron con los mismos tokens y los componentes de `docs/components/`. Viven en la app como referencia navegable, con datos de ejemplo, en `/sistema/pantallas` (no se indexan).

| Pantalla | Ruta real | Qué resuelve |
| --- | --- | --- |
| Pedido enviado | `/pedido/:numero` | Después del checkout: número de pedido, qué sigue, botón principal para abrir WhatsApp y otro para copiar el mensaje. Avisa que el pedido todavía no está confirmado ni cobrado. |
| Estados vacíos y de error | 404, error, carrito vacío, sin días, fuera de zona, sin resultados | Qué pasó y una sola acción. La 404 y el error ya son reales (`not-found.tsx`, `error.tsx`). |
| Editor de pedido | `/admin/pedidos/:id` | Edición completa hasta confirmar: cliente, packs con contadores, complementos, entrega (envío o retiro, día, franja) y pago. Recalcula el resumen con las reglas del dominio, bloquea el guardado si un pack no suma su tamaño y muestra el historial de cambios. Cancelar pide motivo. |
| Catálogo | `/admin/catalogo` | Lista de platos y complementos con filtro por categoría, estado y precio. |
| Formulario de plato | `/admin/catalogo/:id` | Datos, ingredientes, alérgenos, macros, versión de receta, imagen opcional, precio (solo complementos) y activo/inactivo. |
| Usuarios del staff | `/admin/usuarios` | Alta con enlace para crear contraseña, cambio de contraseña, activar y desactivar. No se desactiva al último administrador ni a uno mismo. |

## Reglas que estas pantallas muestran

- Un solo botón `primary` por vista; en un modal, la acción principal del modal.
- El error de un campo se escribe con "Revisá:"; nunca solo con color.
- Cocina solo ve Producción en el menú, y nunca importes.
- Un plato desactivado se conserva en pedidos y encuestas anteriores.

## Cambios pendientes en las vistas existentes

- `views/checkout.html` dice "El costo es fijo": con el envío por distancia pasa a "El costo depende de la distancia" y muestra el tramo.
- `views/admin-agenda.html` necesita sumar los tramos de envío, el radio máximo y el plazo de abandono de pedidos preliminares.
- Dos titulares display usan letras que la fuente no tiene: "Dí…" en `admin-agenda.html` y "recibí" en `landing.html`. Se resuelven al construir esas pantallas, pasándolos a `heading` o reformulando.
