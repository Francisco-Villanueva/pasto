Tabla de datos del backoffice (`Table`) y línea de tiempo para historiales (`Timeline`).

- Implementación: `app/src/components/ui/Table.tsx`. Clases: `pasto-table-wrap`, `pasto-table`, `pasto-timeline`.
- `Table` recibe `label` (nombre para lectores de pantalla) y los `thead` y `tbody`. La región se puede enfocar con el teclado para desplazarla en pantallas chicas; el ancho mínimo es 640px.
- Encabezados en `label` con `th scope="col"`; celdas numéricas con la clase `is-num` (alineadas a la derecha, cifras tabulares). Una columna de acciones lleva un `sr-only` como título.
- `Timeline` muestra quién, cuándo y qué cambió (historial de un pedido), de lo más nuevo a lo más viejo.
