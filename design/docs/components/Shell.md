Estructura de página de la tienda (`PublicShell`) y del backoffice (`AdminShell`).

- Implementación: `app/src/components/layout/`. Clases: `v-header`, `pasto-nav`, `pasto-footer`, `pasto-admin`, `pasto-side`, `pasto-sidenav`.
- `PublicShell`: cabecera con el logo, la navegación (Inicio, Meal prep, Burritos, Carrito, Mi cuenta) y el botón de tema; contenido centrado de hasta 1120px; pie en `verde`. El logo es verde sobre Arena y arena sobre Carbón.
- `AdminShell`: barra lateral de 232px con el logo, el menú según el rol y el botón de tema. En pantallas de menos de 900px el menú pasa arriba, en fila.
- El ítem actual se marca con `aria-current="page"` y fondo `verde`.
- Menú por rol: Administración ve todo; Cocina solo ve Producción. Ocultar un enlace no protege la ruta: la autorización se valida en el servidor.
