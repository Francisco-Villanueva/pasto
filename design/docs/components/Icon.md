Íconos de la app. **Incorporación al sistema**: el manual no define íconos.

- Implementación: `app/src/components/ui/Icon.tsx`, sobre la librería Lucide.
- Trazo redondeado de 2px, grosor parejo, `currentColor` (tomando `ink` u `on-brand` del contexto) y tamaño de 18px por defecto (28px en estados vacíos).
- Siempre acompañan a un texto: van ocultos para lectores de pantalla (`aria-hidden`). Nunca un botón solo con ícono.
- Usos: imprimir, descargar CSV, copiar mensaje, WhatsApp, editar, avisos y estados vacíos.
