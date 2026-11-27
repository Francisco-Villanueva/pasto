# Design system PASTO

Esta carpeta es la fuente de verdad visual de la app. Antes de construir o cambiar cualquier pantalla, leé `docs/brand-book.md` y `docs/vistas.md`.

## Cómo se usa
- Importá una sola vez `design/tokens/pasto.css` en la raíz de la app (tokens, fuentes y componentes base).
- Usá variables CSS (`var(--surface)`, `var(--ink)`, `var(--accent)`, `var(--space-4)`, `var(--radius-md)`) y nunca colores, radios ni espacios sueltos.
- Preferí los tokens semánticos (`surface`, `surface-raised`, `ink`, `ink-muted`, `accent`, `border`) a los crudos (`verde`, `mostaza`), así cada pieza funciona en los temas claro y oscuro.
- Los componentes base están en `design/react/` (Button, Tag, Card, Wave) sobre las clases `pasto-*`. Si falta uno, creá uno nuevo con los mismos tokens y documentalo en `docs/components/`.
- Las pantallas de referencia están en `design/views/` (abrilas en el navegador). Las reglas de negocio están en `especifaciones.md`.

## Reglas visuales
- Escribí PASTO en mayúsculas en texto corrido; la línea de producto es Meal Prep. El logo PASTO | Meal Prep se usa siempre desde `design/assets/logos/`, nunca armado con la fuente.
- Versión clara sobre crema; versión `-oscuro` sobre `noche-900`, `verde` o `bordo`.
- Fuente display (Obviously Narrow, `--font-display`) solo en titulares de 32px o más, en Black (900) con interletrado 0. Tiene ñ y tildes. Medium (500) y Super (950) también están cargadas.
- Todo lo demás en Hanken Grotesk. Rótulos en MAYÚSCULAS con tracking amplio (`label`).
- Mostaza es un acento de relleno, no un color de texto sobre crema. Para bordes, íconos y texto de acento usá `accent-ink`. Texto sobre mostaza y celeste en `on-accent` / `on-cold` (bordó).
- Celeste significa frío y conservación (freezer).
- Un solo botón `primary` por vista. No hay botón mostaza.
- Esquinas redondeadas (`radius-md`, `radius-lg`, `radius-pill`), nada en ángulo recto.
- Sin sombras ni degradés: la profundidad viene de bloques planos de color. Única excepción: en el celular, el video de la portada se funde con la tela con una máscara degradada.
- Obviously Narrow ya está integrada para titulares. Sofia Pro Narrow todavía no: el texto sigue en Hanken Grotesk hasta tener la licencia.
- Sin emojis. Textos en español rioplatense.
- Foco visible: anillo de 2px con `var(--focus-ring)`.
- El estado de un pedido se marca con punto y rótulo, nunca solo con color.

## Si algo no está definido
El manual no define íconos ni sombras. Si hace falta un ícono, usá trazo redondeado y grosor parejo, siempre con texto, y avisalo como incorporación.
