Botón en píldora para la acción de una pantalla: `primary` en `verde` para la acción principal, `secondary` con borde para la alternativa y `ghost` para acciones de bajo peso.

- Markup: `<button class="pasto-btn pasto-btn--primary">Pedir ahora</button>`; agregá `pasto-btn--sm` para la versión chica. Funciona igual sobre `<a>`.
- El consumidor provee el texto (verbo en infinitivo o imperativo corto, en sentence case) y el handler.
- Un solo `primary` por vista. No hay botón terracota: el texto sobre terracota no llega a 4.5:1.
- Foco: `focus-ring` sólido de 2px, separado 2px.
