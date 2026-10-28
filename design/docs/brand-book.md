PASTO es una marca cálida y artesanal: un logotipo trazado a mano, una paleta de verdes profundos, terracota y arena, y aplicaciones sobre textiles, packaging y vajilla. Todo lo que se construya con este sistema tiene que sentirse hecho a mano y tranquilo, no tecnológico.

## Contenido

- Escribí el nombre siempre como **PASTO**, en mayúsculas, en texto corrido. En gráfica nunca lo compongas con la tipografía: usá el logo (ver Logo).
- El manual está en español rioplatense neutro; los rótulos van en MAYÚSCULAS con tracking amplio (estilo `label`), por ejemplo "PALETA PRINCIPAL CORPORATIVA", "TIPOGRAFIAS", "MAQUETAS".
- Las notas son breves y descriptivas, en minúscula y con comillas tipográficas: “PASTO” en su tipografía sin modificaciones.
- Sin emojis.

## Logo

El logotipo es "PASTO" en Gabriel Weiss' Font, con las letras **“AST” modificadas e ilustradas**: el trazo de la A sale en un lazo que envuelve la palabra y cierra en la T. Es un dibujo, no texto: usá siempre los archivos de `assets/logos`, nunca lo reconstruyas con la fuente.

Cuatro variables, positivo y negativo, tal como el manual:

| Fondo | Logo |
| --- | --- |
| `carbon` (negativo) | `pasto-logo-arena.png` o `pasto-logo-terracota.png` |
| `arena` (positivo) | `pasto-logo-carbon.png` o `pasto-logo-verde.png` |
| `verde` (textiles, botella, tote) | `pasto-logo-terracota.png` |
| blanco / arena en packaging (bolsa, caja) | `pasto-logo-terracota.png` |

- `pasto-logo-bordado.png` es la versión con textura de bordado: solo para portadas, mockups de textil o piezas que imiten la aplicación real, nunca en UI.
- El logo puede ir girado 90° cuando la pieza es vertical (tote, etiqueta del bowl).
- No lo deformes, no le agregues sombras ni contornos, no cambies sus colores fuera de estas cuatro tintas.

## Color

**Paleta principal:** `carbon` #272B29 · `verde` #2C5E4A · `terracota` #BC7139 · `arena` #D6D2C8.
**Paleta complementaria:** `cafe` #755741 · `cobre` #996439 · `terracota` · `arena` (cálidos) y `carbon` · `bosque-900` #323F3A · `bosque-800` #344C43 · `verde` (fríos).

- El sistema tiene dos temas: **Arena** (positivo, fondo `arena`) y **Carbón** (negativo, fondo `carbon`). Usá los tokens semánticos (`surface`, `ink`, `ink-muted`, `accent`…) en lugar de los crudos, así una pieza funciona en ambos.
- `verde` es el color que identifica la marca: usalo a sangre en bloques grandes (`surface-brand`) con texto `on-brand`.
- `terracota` es el color del logo y la onda. Es un acento, no un color de texto: sobre `arena` da 2.5:1, así que el texto sobre arena va en `ink` o `verde`. Como titular display ≥24px sobre `carbon` sí funciona (3.8:1).
- Los cálidos complementarios (`cafe`, `cobre`) son para detalles y fills, como las correas de cuero de las maquetas; no para texto chico.
- Combinaciones de texto verificadas: `ink` sobre `surface`/`surface-raised` ≥9.5:1 en ambos temas; `ink-muted` ≥4.6:1; `on-brand` sobre `verde` 4.96:1; `on-accent` sobre `terracota` 3.8:1 (solo ≥19px bold).
- El logo terracota sobre arena (caja de las maquetas) queda en 2.5:1. Es una decisión del manual y se mantiene; reservalo para piezas grandes.

## Tipografía

- **Gabriel Weiss' Font** (`--font-display`), Regular, **interletrado 0**. Solo para titulares: `display-xl`, `display-lg`, `display-md`. Nunca por debajo de 32px ni en párrafos.
- La fuente display no tiene **ñ, í, Í ni Ñ**: esas letras caen a Hanken Grotesk y se notan. Evitá titulares con esas letras o pasalos a `heading`.
- **Hanken Grotesk** (`--font-sans`) para todo lo demás: es la versión abierta de HK Grotesk, la familia que usa el manual para sus rótulos y notas. Texto corrido en `body` (Medium 500); rótulos en `label` (Bold, MAYÚSCULAS, tracking 0.3em).
- Escala: `display-xl` 72 · `display-lg` 48 · `display-md` 32 · `heading` 24 · `title` 18 · `body` 16 · `body-sm` 14 · `caption` 12 / `label` 12.

## Forma, espacio y motivo

- Esquinas muy redondeadas, como los swatches del manual: `radius-lg` (28px) en bloques de color grandes, `radius-md` (16px) en tarjetas e imágenes, `radius-pill` en botones y etiquetas. Nada en ángulo recto.
- Espaciado en base 4px: `space-4` dentro de tarjetas, `space-6` de padding, `space-8` entre tarjetas, `space-12` en márgenes de sección.
- **La onda**: el trazo ondulado terracota que acompaña la tipografía en el manual. Usalo como subrayado decorativo bajo titulares display o como patrón sobre bloques `verde`, en `accent` u `on-brand`, de 3 a 4 crestas, trazo grueso con puntas redondeadas.
- Sin sombras ni degradés: la profundidad viene de las texturas reales (bordado, tela, papel) y de los bloques planos de color.
- Foco: anillo sólido `focus-ring` de 2px con 2px de separación.

## Imágenes

- Fotografía de producto y aplicaciones reales sobre fondos neutros cálidos (arena, beige, gris piedra), luz suave natural y sombras largas y blandas. Ver `assets/imagery/pasto-maquetas.jpg`.
- Las aplicaciones de marca son textiles y objetos en `verde` con logo `terracota` (delantal, gorra, tote, botella) y packaging blanco o arena con logo `terracota` (bolsa, caja).
- La portada usa una textura de tela verde oscura con el logo bordado (`pasto-portada-textura.jpg`).

## Iconografía

El manual no define un set de íconos. Si hace falta, usá íconos de trazo redondeado y grosor uniforme en `ink` u `on-brand`, siempre acompañados de texto, y avisalo como incorporación.

## Componentes

Componentes base en CSS puro (`components/bundle.css`), con prefijo `pasto-`: `Button`, `Tag` y `Card`. No son parte del manual: son una propuesta para llevar la marca a pantalla.
