@design/CLAUDE.md
@AGENTS.md

# PASTO — WebApp y CRM

Tienda de packs de meal prep y burritos con traspaso a WhatsApp, backoffice y CRM liviano.

## Estructura

Este repositorio es la aplicación (Next.js). La raíz del repo es la carpeta `app/` de la carpeta de trabajo local.

- `src/`, `drizzle/`, `e2e/`, `public/`: la app. `package.json` y `node_modules` están acá.
- `design/`: design system de PASTO (tokens, fuentes, logos, componentes base y vistas de referencia). Se importa con el alias `@design/*`.
- `.github/workflows/ci.yml`: CI. `DEPLOY.md`: guía de deploy y variables de entorno.
- Los documentos de producto (`especifaciones.md`, `PLAN.md`) viven en la carpeta de trabajo, fuera del repo.

## Stack

Next.js (App Router) + TypeScript, PostgreSQL en Neon con Drizzle, Zod, Auth.js, Vitest y Playwright. Hosting en Vercel. Next.js tiene cambios respecto de versiones anteriores: leé `node_modules/next/dist/docs/` antes de usar una API que no conozcas.

## Comandos

Desde la raíz del repo:

- `npm run dev` · `npm run build`
- `npm run lint` · `npm run typecheck` · `npm run format:check`
- `npm test` (Vitest, reglas de dominio) · `npm run e2e` (Playwright)
- `npm run db:generate` · `npm run db:migrate` · `npm run db:seed` (catálogo de ejemplo)

## Dominio y base de datos

- `src/domain/`: reglas de negocio puras (packs, carrito, precios, agenda y cortes, envío, estados, CRM, producción, WhatsApp, repetir pedido). Sin UI ni base de datos; todo con tests. Es la única fuente de las reglas: el cliente y el servidor llaman a las mismas funciones.
- `src/db/schema.ts`: esquema Drizzle. Migraciones en `drizzle/` (se generan con `npm run db:generate`, no se editan a mano).
- `src/db/schema.test.ts` aplica las migraciones sobre Postgres en memoria (PGlite) para probar restricciones y semillas sin necesitar Neon.
- `domain/sample-catalog.ts` tiene el catálogo de EJEMPLO (de `design/views`); se reemplaza por los datos reales.
- Ajustes sin configurar (`pasto_whatsapp`, `fudo_url`, `store_address`, `store_location`) no se siembran: si falta la clave, el checkout no se habilita. Se leen con `parseStoreSettings` (`domain/settings.ts`).
- Conexión: `src/db/index.ts` (`getDb()`). Con `DATABASE_URL` usa Neon por WebSocket (con transacciones); **sin ella, en `npm run dev`, usa una base en memoria (PGlite)** con migraciones y catálogo de ejemplo en cada arranque, WhatsApp de PASTO falso y direcciones simuladas (`placeId` `dev:<metros>`). Nunca en producción: sin `DATABASE_URL` en producción lanza error.
- `src/server/`: servicios del servidor (`orders.ts` crea el pedido en una transacción, `maps.ts`, `turnstile.ts`, `rate-limit.ts`, `checkout-data.ts`, `order-view.ts`). `src/app/api/`: `orders/preliminary`, `address/suggest`, `address/quote`.
- El pedido se arma en `domain/order-draft.ts`: el navegador **nunca** manda precios ni envío; el servidor recalcula todo (catálogo, tramos, agenda, corte). El esquema compartido está en `src/lib/checkout-schema.ts`.
- La página del pedido (`/pedido/:token`) se abre con `orders.access_token`, no con el número de pedido (adivinable).

## Interfaz

- `src/components/ui/`: componentes de la app (Counter, Segmented, campos, Modal, Toast, Notice, Table, estados…) con el CSS en `src/styles/ui.css`, clases `pasto-*`. Los de `design/react` (Button, Tag, Card, Wave) se siguen usando tal cual.
- `src/components/layout/`: `PublicShell` (tienda) y `AdminShell` (backoffice, menú por rol).
- Si falta un componente, crealo con los mismos tokens y documentalo en `design/docs/components/`.
- `/sistema` es el catálogo de componentes y `/sistema/pantallas` las pantallas de referencia (no indexadas); sirven para verificar cambios visuales en los dos temas. Documentadas en `design/docs/pantallas-app.md`.
- `src/components/store/`: constructor de packs (`PackBuilder`), carrito (`CartView`) y detalle de plato. El carrito vive en `src/lib/cart-store.ts` (Zustand con persistencia en `localStorage`, hidratación con `useCartReady`); las reglas siguen en `domain/`.
- El catálogo de la tienda sale de `src/db/catalog.ts` (`loadStoreCatalog`): lee de la base si hay `DATABASE_URL` y, si no, usa el catálogo de ejemplo. Las páginas se refrescan cada 60 s (`revalidate`).
- Los alérgenos e ingredientes vacíos o en "A completar" no se muestran como datos reales (`hasProductInfo`).
- Íconos: Lucide a través de `Icon`, siempre con texto.

## Convenciones

- Estilos solo con variables de `design/tokens` (importadas en `src/app/layout.tsx`). El alias `@design/*` apunta a `design/`, dentro del repo.
- Temas con `data-theme="arena"` o `"carbon"`.
- Las reglas de negocio viven en un módulo de dominio sin dependencias de UI ni de base de datos, y el servidor siempre revalida.
- Importes en centavos (enteros) dentro del código. Fechas en UTC; cortes calculados en `America/Argentina/Buenos_Aires`.
- Variables de entorno: copiar `.env.example` a `.env.local`.
