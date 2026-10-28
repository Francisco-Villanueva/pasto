Carrito de `/cart`: packs, complementos y resumen, con las reglas del pedido a la vista.

- Implementación: `app/src/components/store/CartView.tsx` y `CartNavLink.tsx` (contador del encabezado, clase `pasto-count`).
- Packs: cada uno en un `Panel` con su precio, los platos con cantidades y "Quitar pack". Un pack con platos que dejaron de existir o que no suma sus unidades lleva un `Notice` `brand` con `role="alert"` y bloquea el checkout.
- Complementos: un `Counter` por complemento activo. Sin ningún pack en el carrito no se pueden sumar: un toast responde al clic y el aviso fijo explica la regla. Los complementos que quedaron sin pack se conservan, nunca se borran solos.
- Aviso "Falta un pack principal": `Notice` `brand` con `role="alert"`; el botón "Continuar al checkout" queda con `aria-disabled` y no navega hasta que se agregue un pack o se quiten los complementos.
- Resumen: subtotal sumando cada pack a su precio (dos packs de 10 no pasan a precio de pack de 20) y el envío se calcula en el checkout.
- Carrito vacío: `EmptyState` con una sola acción. Mientras se lee el carrito guardado se muestra "Cargando tu carrito…" para no mostrar un carrito vacío por error.
- El carrito vive en el navegador (`pasto-cart`). Si lo guardado está dañado o tiene otro formato, se descarta.
