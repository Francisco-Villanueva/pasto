# Design system PASTO

Todo lo necesario para construir la app de PASTO con su identidad: tokens, fuentes, logos, componentes base en React, documentación y las pantallas de referencia.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `tokens/` | `tokens.json` (fuente de verdad), `tokens.css` (generado) y `pasto.css` (el único import que necesita la app) |
| `fonts/` | Gabriel Weiss (titulares) y Hanken Grotesk (todo lo demás) |
| `assets/logos/` | Las cinco versiones del logo |
| `assets/imagery/` | Imágenes del manual de marca |
| `components/` | `bundle.css`, los estilos de Button, Tag y Card |
| `react/` | Button, Tag, Card y Wave en TSX |
| `docs/` | Manual de marca, guías de cada componente, logos, imágenes y las vistas |
| `views/` | Las 14 pantallas de la tienda y del backoffice, para abrir en el navegador (empezá por `views/index.html`) |
| `CLAUDE.md` | Reglas para que Claude Code respete el sistema |

## Usarlo en React

1. Importá los estilos una vez, en la entrada de la app:
   ```ts
   import "../design/tokens/pasto.css";
   ```
   Si tu bundler no resuelve `@import` relativos desde otra carpeta, copiá `design/fonts` a `public/fonts` y ajustá las rutas de `@font-face` en `tokens.css`.
2. Usá los componentes:
   ```tsx
   import { Button, Tag, Card, Wave } from "../design/react";

   <Button>Armar mi pack</Button>
   <Tag tone="brand">Nuevo</Tag>
   ```
3. Para cambiar de tema a mano: `document.documentElement.dataset.theme = "carbon"` (o `"arena"`). Sin eso sigue el tema del sistema.
4. Para el logo: `<img src="/logos/pasto-logo-verde.png" alt="PASTO" />` copiando `assets/logos` a `public/logos`.

## Usarlo con Claude Code

- Abrí Claude Code en la carpeta `pasto` y agregá esta línea a un `CLAUDE.md` en la raíz:
  ```
  @design/CLAUDE.md
  ```
  Así Claude lee las reglas visuales en cada sesión.
- Pedile las pantallas citando la vista de referencia, por ejemplo: "armá `/meal-prep` como `design/views/meal-prep.html`, con las reglas de `especifaciones.md`".

## Cambiar tokens

Editá `tokens/tokens.json` y regenerá `tokens.css` (o pedile a Claude que lo haga). No edites `tokens.css` a mano.

## Pendientes conocidos

- Los precios y platos de `views/` son de ejemplo.
- Los componentes de React son un punto de partida: faltan los propios de la app (contador de pack, selector, tabla, modal). Las vistas ya los resuelven en HTML y CSS.
- El manual no define íconos ni sombras.
