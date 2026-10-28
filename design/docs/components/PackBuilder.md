Constructor de packs de `/meal-prep` y `/burritos`: elegir plan y tamaño, repartir unidades entre los platos y agregar el pack al carrito.

- Implementación: `app/src/components/store/PackBuilder.tsx`. Clases: `pasto-meal`, `pasto-macros`, `pasto-macro-grid`, `pasto-panel`.
- Composición: `Segmented` para plan y tamaño, una fila por plato (`Plate`, nombre, macros por unidad, alérgenos, `Counter`) y un panel fijo con el avance, el precio, las macros totales y el botón.
- El botón "Agregar al carrito" es el único `primary` de la vista y está deshabilitado hasta que la suma de unidades da justo el tamaño. Cada `Counter` limita su máximo para no pasarse.
- Cambiar plan o tamaño reinicia las unidades. Burritos no muestra selector de plan.
- Los alérgenos se muestran en la fila del plato cuando están cargados. "Ver ingredientes y alérgenos" abre un `Modal` con el detalle; si la información no está cargada, dice que hay que consultar por WhatsApp antes de pedir en vez de mostrar un dato vacío.
- Plan incompatible: si el carrito tiene el otro plan, se abre un `Modal` que lista qué se quita y qué entra. "Mantener mi carrito" es la acción principal; "Reemplazar el pack …" quita solo los packs del plan en conflicto y conserva burritos y complementos. Nunca se pisa nada en silencio.
- Los macros del panel son el total del pack (unidades por macros de cada plato); en cada fila son por unidad.
