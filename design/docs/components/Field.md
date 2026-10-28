Campo de formulario con rótulo, ayuda y error: `TextField`, `SelectField` y `TextareaField`.

- Implementación: `app/src/components/ui/Field.tsx`. Clases: `pasto-field`, `pasto-input`, `pasto-select`, `pasto-textarea`.
- Props: `label` (obligatorio, siempre visible), `hint` (ayuda debajo) y `error`; el resto pasa al elemento nativo.
- El rótulo, la ayuda y el error se vinculan solos con `for`, `aria-describedby` y `aria-invalid`.
- El error se escribe con el prefijo "Revisá:" y en `ink`: no se marca solo con color. El borde del campo pasa a `accent` como refuerzo.
- Esquinas `radius-sm`, borde de 2px en `border-strong`. Sin placeholder como reemplazo del rótulo.
