PASTO es una marca cálida y artesanal: un logotipo trazado a mano, una paleta de verde, bordó, mostaza, celeste y crema, y el sello Meal Prep que la acompaña. Todo lo que se construya con este sistema tiene que sentirse hecho a mano y tranquilo, no tecnológico.

## Contenido

- Escribí el nombre siempre como **PASTO**, en mayúsculas, en texto corrido; la línea de producto es **Meal Prep**. En gráfica nunca lo compongas con la tipografía: usá el logo (ver Logo).
- El manual está en español rioplatense neutro; los rótulos van en MAYÚSCULAS con tracking amplio (estilo `label`), por ejemplo "PALETA PRINCIPAL CORPORATIVA", "TIPOGRAFIAS", "MAQUETAS".
- Las notas son breves y descriptivas, en minúscula y con comillas tipográficas: “PASTO” en su tipografía sin modificaciones.
- Sin emojis.

## Logo

El logo es **PASTO | Meal Prep**: el wordmark manuscrito de PASTO, un filete vertical y el sello "Meal Prep" en `bordo`. Es un dibujo, no texto: usá siempre los archivos de `assets/logos` (ver `docs/logos.md`), nunca lo reconstruyas con la fuente.

- Cuatro versiones (plano, sello con línea, sello en mayúsculas, sello sin línea), cada una con su variante oscura.
- Sobre `crema`: versión clara. Sobre `noche-900`, `verde` o `bordo`: versión `-oscuro`.
- Los dos nombres pesan igual: no uses PASTO sin Meal Prep dentro de la web, salvo en los íconos de la app.
- No lo deformes, no le agregues sombras ni contornos, no cambies sus colores fuera de estas tintas.

## Color

**Paleta principal:** `bordo` #572121 · `mostaza` #E3B605 · `celeste` #B7D9FF · `crema` #F3EEE3 · `verde` #2D5E49. Más `tinta` #272B29, el color del wordmark, para texto.
**Derivados (propuesta):** `verde-800` #234A39 (hover del botón primario), `noche-900` #1B2822 y `noche-800` #243630 (fondos del tema oscuro, sacados del verde), `tinta-suave` #5E564A (texto secundario sobre crema).

- Dos temas: **claro** (por defecto, fondo `crema`) y **oscuro** (fondo `noche-900`). Los ids `arena` y `carbon` de `data-theme` se conservan por compatibilidad. Usá los tokens semánticos (`surface`, `ink`, `ink-muted`, `accent`, `accent-ink`…) y no los crudos, así una pieza funciona en ambos.
- `verde` es la firma de PASTO: bloques de marca (`surface-brand`) con texto `on-brand` (crema, 6.46:1) y el botón primario.
- `bordo` es el color de Meal Prep y el texto sobre `mostaza` y `celeste` (6.66:1 y 8.74:1). También es el borde y el ícono de acento en el tema claro (`accent-ink`).
- `mostaza` es el acento: rellenos, badges, globos y puntos, con `on-accent` (bordo) encima. No es color de texto sobre crema (1.66:1). En el tema oscuro sí funciona como texto y borde (`accent-ink`, 7.98:1).
- `celeste` significa frío, freezer y conservación: usalo para avisos y etiquetas de viandas congeladas (`Tag tone="frio"`, `--cold`).
- `crema` es la base: fondo claro y relleno del sello.
- Combinaciones de texto verificadas: `ink` sobre `surface` 12.4:1 (claro) y 13.2:1 (oscuro); `ink-muted` ≥6.1:1; `on-brand` sobre `verde` 6.46:1.

## Tipografía

- **Gabriel Weiss' Font** (`--font-display`), Regular, **interletrado 0**. Solo para titulares: `display-xl`, `display-lg`, `display-md`. Nunca por debajo de 32px ni en párrafos.
- La fuente display no tiene **ñ, í, Í ni Ñ**: esas letras caen a Hanken Grotesk y se notan. Evitá titulares con esas letras o pasalos a `heading`.
- **Hanken Grotesk** (`--font-sans`) para todo lo demás: es la versión abierta de HK Grotesk, la familia que usa el manual para sus rótulos y notas. Texto corrido en `body` (Medium 500); rótulos en `label` (Bold, MAYÚSCULAS, tracking 0.3em).
- Escala: `display-xl` 72 · `display-lg` 48 · `display-md` 32 · `heading` 24 · `title` 18 · `body` 16 · `body-sm` 14 · `caption` 12 / `label` 12.

## Forma, espacio y motivo

- Esquinas muy redondeadas, como los swatches del manual: `radius-lg` (28px) en bloques de color grandes, `radius-md` (16px) en tarjetas e imágenes, `radius-pill` en botones y etiquetas. Nada en ángulo recto.
- Espaciado en base 4px: `space-4` dentro de tarjetas, `space-6` de padding, `space-8` entre tarjetas, `space-12` en márgenes de sección.
- **La onda**: el trazo ondulado como subrayado decorativo bajo titulares display, en `accent` u `on-brand`, de 3 a 4 crestas, trazo grueso con puntas redondeadas. Se inspira en el borde ondulado del sello de PASTO.
- Sin sombras ni degradés: la profundidad viene de los bloques planos de color.
- Foco: anillo sólido `focus-ring` de 2px con 2px de separación.

## Imágenes

- Fotografía de producto y aplicaciones reales sobre fondos neutros cálidos (crema, beige, gris piedra), luz suave natural y sombras largas y blandas. Ver `assets/imagery/pasto-maquetas.jpg`.
- Las aplicaciones de marca son textiles y objetos en `verde` con el logo claro (delantal, gorra, tote, botella) y packaging crema con el logo PASTO | Meal Prep (bolsa, caja). Las fotos actuales de `assets/imagery` muestran la marca anterior y hay que reemplazarlas.
- La portada usa una textura de tela verde oscura (`pasto-portada-textura.jpg`; el logo bordado es de la marca anterior).

## Iconografía

El manual no define un set de íconos. Si hace falta, usá íconos de trazo redondeado y grosor uniforme en `ink` u `on-brand`, siempre acompañados de texto, y avisalo como incorporación.

## Componentes

Componentes base en CSS puro (`components/bundle.css`), con prefijo `pasto-`: `Button`, `Tag` y `Card`. No son parte del manual: son una propuesta para llevar la marca a pantalla.
