Estado vacío o de error: dice qué pasó y ofrece una sola acción.

- Implementación: `app/src/components/ui/Feedback.tsx`. Clases: `pasto-empty`. Se usa en `not-found.tsx` y `error.tsx` de la app.
- Props: `icon`, `title`, texto explicativo y `action` (etiqueta y enlace).
- Bloque `surface-raised` con `radius-lg`. Sin detalles técnicos para el cliente.
- Casos cubiertos: carrito vacío, sin días de entrega abiertos, dirección fuera de zona, sin resultados en el backoffice, página no encontrada y error inesperado. Ver `docs/pantallas-app.md`.
