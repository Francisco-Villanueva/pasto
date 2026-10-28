Diálogo modal para decisiones que el cliente o el admin tienen que tomar: plan incompatible en el carrito, cancelar un pedido con motivo, nuevo usuario.

- Implementación: `app/src/components/ui/Modal.tsx`. Clases: `pasto-modal`.
- Props: `open`, `onClose` (se llama al cerrar con Esc), `title` y el contenido.
- Usa `<dialog>` nativo: el navegador atrapa el foco, lo devuelve al botón que lo abrió y cierra con Esc. Tiene título accesible.
- Fondo `surface`, esquinas `radius-lg`, ancho máximo de 460px. El fondo se oscurece con `carbon` al 62%.
- Las acciones van en un `row`: la principal en `primary` y la alternativa en `secondary`. Nunca se pisa algo sin que el modal lo diga.
