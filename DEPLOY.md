# Deploy de PASTO

Next.js en **Vercel**, base de datos en **Neon** (proyecto `withered-snow-70557255`).

## 1. Vercel

1. Importá el repositorio de GitHub. La raíz del repo ya es la app: **Root Directory = `./`**, framework Next.js, Node 22.
2. Cargá las variables de entorno de la tabla de abajo en **Production** (y en **Preview** si querés probar ramas con otra base).
3. **`DATABASE_URL` tiene que estar disponible también en el build.** Las páginas de la tienda se generan con el catálogo de la base; sin la variable se generan con el catálogo de ejemplo.
4. Deploy. Cada push a `main` publica; cada rama o PR genera una vista previa.

## 2. Variables de entorno

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión **con pooler** de Neon (host con `-pooler`). La usa la app. |
| `DATABASE_URL_UNPOOLED` | Para migrar | Conexión **directa** de Neon. La usa `drizzle-kit` en tu máquina; no hace falta en Vercel. |
| `APP_URL` | Sí | URL pública, ej. `https://pasto.vercel.app`. |
| `TURNSTILE_SECRET_KEY` | **Sí en producción** | Sin ella el servidor rechaza todos los pedidos (a propósito). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Sí en producción | Clave pública del captcha. |
| `GOOGLE_MAPS_SERVER_KEY` | Recomendada | Autocompletado y distancia por calle (Places y Routes). Sin ella el envío queda "a confirmar". |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Fase 5 y 7 | Sesiones del staff y Google para clientes. |
| `STORAGE_*` | Fase 7 | Fotos de platos (almacenamiento compatible con S3). |
| `CRON_SECRET` | Fase 5 | Protege la tarea que cancela pedidos abandonados. |

Nunca subas `.env.local`: está en `.gitignore`. Las claves se cargan en Vercel, no en el repo.

## Ramas de Neon

| Rama | Contenido | Se usa en |
| --- | --- | --- |
| `production` | Solo el esquema. Sin catálogo ni ajustes hasta cargar los datos reales. | Vercel **Production** |
| `staging` | Esquema, catálogo de ejemplo, agenda y un WhatsApp **falso** (`+5490000000000`). | Vercel **Preview** y pruebas |

Las cadenas de conexión de `staging` están en `.env.staging.local` (ignorado por Git). La agenda de ejemplo cubre unas 6 semanas desde la carga; después hay que generar más días (lo hará el backoffice en la Fase 5).

## 3. Base de datos (Neon)

Desde tu máquina, con `DATABASE_URL_UNPOOLED` y `DATABASE_URL` en `.env.local`:

```bash
npm run db:migrate
```

Crea las tablas (migraciones de `drizzle/`). Después, los **ajustes** que habilitan la tienda. Sin `pasto_whatsapp` el checkout queda deshabilitado:

```sql
INSERT INTO settings (key, value) VALUES
  ('pasto_whatsapp', '"+549XXXXXXXXXX"'),
  ('store_address', '"Calle 123, Ciudad"'),
  ('store_location', '{"lat": -38.7183, "lng": -62.2663}'),
  ('fudo_url', '"https://..."')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

`npm run db:seed` carga el catálogo, los precios, los tramos de envío y la agenda **de ejemplo**. Sirve para una base de prueba (staging); para producción, cargá los platos y precios reales.

## 4. Antes de abrir al público

- [ ] Platos, precios, tramos de envío y franjas reales cargados.
- [ ] `pasto_whatsapp`, dirección y coordenadas del local en `settings`.
- [ ] Turnstile y Google Maps configurados.
- [ ] Textos legales (`/terminos`, `/privacidad`) reemplazados por los definitivos.
- [ ] Hacer un pedido de prueba de punta a punta y confirmar que llega a WhatsApp.
