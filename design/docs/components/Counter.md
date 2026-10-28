Contador de unidades con botones redondos para quitar y sumar, usado al armar un pack y al ajustar complementos.

- Implementación: `app/src/components/ui/Counter.tsx`. Clases: `pasto-counter`.
- Props: `label` (qué se cuenta; arma los textos "Quitar uno de…" y "Sumar uno de…" para lectores de pantalla), `value`, `onChange`, `min` (0 por defecto) y `max`.
- Con el valor en `min` se deshabilita quitar; en `max`, sumar. Al completar un pack se deshabilita sumar en todos los platos.
- El número se anuncia con `aria-live="polite"`.
- Usá el `max` para que el cliente no pueda pasarse del tamaño del pack: el servidor igual valida que la suma sea exacta.
