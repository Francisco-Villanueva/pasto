Aviso dentro de la página para explicar una regla o bloquear una acción.

- Implementación: `app/src/components/ui/Feedback.tsx`. Clases: `pasto-notice`.
- `tone="neutral"`: información (ej. los planes Esencial y Proteico no se mezclan). Fondo `surface-raised` con borde.
- `tone="brand"`: algo que bloquea (ej. complemento sin pack). Fondo `verde` con texto `on-brand`; usalo con `role="alert"`.
- Lleva un ícono de Lucide y siempre texto. Para confirmaciones breves usá un toast, no un aviso.
