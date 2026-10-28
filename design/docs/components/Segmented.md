Selector de una opción entre pocas, en píldora: plan, tamaño del pack, tipo de entrega, filtros.

- Implementación: `app/src/components/ui/Segmented.tsx`. Clases: `pasto-seg`.
- Props: `label` (nombre del grupo), `options` (`value`, `label`, `disabled`), `value`, `onChange`.
- Cada opción es un botón con `aria-pressed`; la elegida va en `verde` con texto `on-brand`.
- Hasta 5 opciones cortas. Si hay más, o los textos son largos, usá un `select`.
