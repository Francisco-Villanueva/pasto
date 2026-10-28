# Design system PASTO

Esta carpeta es la fuente de verdad visual de la app. Antes de construir o cambiar cualquier pantalla, leé `docs/brand-book.md` y `docs/vistas.md`.

## Cómo se usa
- Importá una sola vez `design/tokens/pasto.css` en la raíz de la app (tokens, fuentes y componentes base).
- Usá variables CSS (`var(--surface)`, `var(--ink)`, `var(--accent)`, `var(--space-4)`, `var(--radius-md)`) y nunca colores, radios ni espacios sueltos.
- Preferí los tokens semánticos (`surface`, `surface-raised`, `ink`, `ink-muted`, `accent`, `border`) a los crudos (`verde`, `terracota`), así cada pieza funciona en los temas Arena y Carbón.
- Los componentes base están en `design/react/` (Button, Tag, Card, Wave) sobre las clases `pasto-*`. Si falta uno, creá uno nuevo con los mismos tokens y documentalo en `docs/components/`.
- Las pantallas de referencia están en `design/views/` (abrilas en el navegador). Las reglas de negocio están en `especifaciones.md`.

## Reglas visuales
- Escribí PASTO en mayúsculas en texto corrido. El logo se usa siempre desde `design/assets/logos/`, nunca armado con la fuente.
- Logo verde o carbón sobre arena, logo arena o terracota sobre carbón, logo terracota sobre verde.
- Fuente display (Gabriel Weiss) solo en titulares de 32px o más, con interletrado 0. No tiene ñ, í, Í ni Ñ: para esos textos usá `heading`.
- Todo lo demás en Hanken Grotesk. Rótulos en MAYÚSCULAS con tracking amplio (`label`).
- Terracota es un acento, no un color de texto sobre arena. Texto sobre arena en `ink` o `verde`.
- Un solo botón `primary` por vista. No hay botón terracota.
- Esquinas redondeadas (`radius-md`, `radius-lg`, `radius-pill`), nada en ángulo recto.
- Sin sombras ni degradés: la profundidad viene de bloques planos de color.
- Sin emojis. Textos en español rioplatense.
- Foco visible: anillo de 2px con `var(--focus-ring)`.
- El estado de un pedido se marca con punto y rótulo, nunca solo con color.

## Si algo no está definido
El manual no define íconos ni sombras. Si hace falta un ícono, usá trazo redondeado y grosor parejo, siempre con texto, y avisalo como incorporación.
