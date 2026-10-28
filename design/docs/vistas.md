# Vistas de la app

Pantallas de la tienda y del backoffice de PASTO armadas solo con los tokens y componentes de este sistema (`pasto-btn`, `pasto-tag`, `pasto-card`), en los dos temas, Arena y Carbón. Los precios, nombres y pedidos son datos de ejemplo. Se abren desde `views/index.html`.

## Tienda

| Vista | Ruta | Qué muestra |
| --- | --- | --- |
| `views/landing.html` | `/` | Portada verde, tres packs, cómo funciona y enlace a Pasto Cocina |
| `views/meal-prep.html` | `/meal-prep` | Plan Esencial o Proteico, tamaños 5, 10 y 20, contadores y macros en vivo |
| `views/burritos.html` | `/burritos` | Packs de 6 y 12 con contadores |
| `views/cart.html` | `/cart` | Packs, complementos, aviso de planes incompatibles y de complemento sin pack |
| `views/checkout.html` | `/checkout` | Envío o retiro, día con horario de corte, datos y mensaje de WhatsApp |
| `views/evaluacion.html` | `/evaluacion/:token` | Encuesta privada por plato, con guardado parcial |
| `views/mi-cuenta.html` | `/mi-cuenta` | Pedidos anteriores, evaluaciones y Repetir pedido |

## Backoffice

| Vista | Ruta | Qué muestra |
| --- | --- | --- |
| `views/admin-login.html` | `/api/auth/login` | Ingreso de administración y cocina |
| `views/admin-dashboard.html` | `/admin/dashboard` | Ventas confirmadas, pendientes, cierre y seguimientos |
| `views/admin-pedidos.html` | `/admin/pedidos` | Grilla filtrable y acciones de estado y pago |
| `views/admin-produccion.html` | `/admin/produccion` | Unidades por receta de pedidos confirmados, sin importes |
| `views/admin-agenda.html` | `/admin/agenda` | Viernes opcional, franjas y costo de envío |
| `views/admin-crm.html` | `/admin/crm` | Tareas de seguimiento a los 5 y 12 días con WhatsApp |
| `views/admin-encuestas.html` | `/admin/encuestas` | Promedios por plato y versión de receta |

## Reglas que las vistas ya muestran

- Un pack solo se agrega cuando la suma de unidades es igual al tamaño del pack.
- Esencial y Proteico no se mezclan en el carrito: se abre un aviso para mantener o reemplazar, nunca se pisa en silencio.
- Los complementos no se compran solos: sin pack principal se avisa y se bloquea el checkout.
- El miércoles cierra el lunes a las 12:00. El viernes solo aparece si está activo en la agenda.
- Producción cuenta solo pedidos confirmados o en producción, y no muestra importes.
- El estado se marca con punto y rótulo, nunca solo con color.

## Cómo se construyen

- Colores, tipografía, espacios y radios salen de `tokens.json`. Los rótulos usan `label` y los titulares `display`, con la onda terracota como subrayado.
- El logo se usa siempre desde los archivos de `Logos`: verde sobre arena y arena sobre carbón.
- Los titulares display evitan ñ, í e Í, que la fuente no tiene.
