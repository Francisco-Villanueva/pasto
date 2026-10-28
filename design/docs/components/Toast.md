Confirmación breve que aparece al pie y desaparece sola ("Pack agregado al carrito", "Cambios guardados").

- Implementación: `app/src/components/ui/Toast.tsx`. Clases: `pasto-toast`.
- Se usa con `useToast()` y un `ToastProvider` en la raíz de la app. Dura unos 3 segundos y se anuncia con `aria-live="polite"`.
- Fondo `verde`, texto `on-brand`, forma de píldora.
- Solo para confirmar algo que salió bien. Los errores y bloqueos van en un `Notice` o junto al campo, porque un toast desaparece.
