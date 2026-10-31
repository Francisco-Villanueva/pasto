import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Importes: NUMERIC(10,2) en la base; en el código se pasan a centavos (domain/money.ts).
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---- Enums ----

export const userRole = pgEnum("user_role", ["ADMIN", "COCINA"]);
export const productCategory = pgEnum("product_category", [
  "ESENCIAL",
  "PROTEICO",
  "BURRITO",
  "COMPLEMENTO",
]);
export const deliveryType = pgEnum("delivery_type", ["DELIVERY", "RETIRO"]);
export const deliveryFeeStatus = pgEnum("delivery_fee_status", [
  "NO_APLICA",
  "CALCULADO",
  "A_CONFIRMAR",
]);
export const orderOrigin = pgEnum("order_origin", ["WEB", "MANUAL"]);
export const orderStatus = pgEnum("order_status", [
  "PRELIMINAR",
  "PENDIENTE_CONFIRMACION",
  "CONFIRMADO",
  "EN_PRODUCCION",
  "LISTO",
  "ENTREGADO",
  "CANCELADO",
]);
export const paymentMethod = pgEnum("payment_method", ["EFECTIVO", "TRANSFERENCIA", "PENDIENTE"]);
export const paymentStatus = pgEnum("payment_status", ["PENDIENTE", "PAGADO"]);
export const orderItemType = pgEnum("order_item_type", ["PACK", "BURRITO_PACK", "COMPLEMENTO"]);
export const crmTaskType = pgEnum("crm_task_type", ["D5_CHECKIN", "D12_SURVEY"]);
export const crmTaskStatus = pgEnum("crm_task_status", ["PENDIENTE", "COMPLETADA", "OMITIDA"]);
export const portionSize = pgEnum("portion_size", ["MUY_CHICA", "ADECUADA", "MUY_GRANDE"]);
export const orderChangeKind = pgEnum("order_change_kind", ["ESTADO", "EDICION", "PAGO"]);

// ---- Staff y clientes ----

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRole("role").notNull(),
  fullName: varchar("full_name", { length: 120 }),
  isActive: boolean("is_active").notNull().default(true),
  /** Intentos fallidos seguidos. Al llegar al límite la cuenta se bloquea un rato (`locked_until`). */
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/**
 * Sesiones del staff. En la base va solo el hash del token (el token real vive en la cookie), así que
 * una filtración de la tabla no permite entrar. Se pueden revocar: desactivar a un usuario las invalida.
 */
export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("staff_sessions_user_idx").on(t.userId)],
);

/**
 * Cuenta de cliente con Google. El email llega verificado por Google: con él se reconocen los
 * pedidos hechos como invitado. No tiene contraseña ni teléfono (el teléfono se pide en cada pedido).
 */
export const customerAccounts = pgTable("customer_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Identificador estable de la persona en Google (`sub`); el email puede cambiar. */
  googleSub: varchar("google_sub", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  createdAt: createdAt(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

/** Sesiones de clientes. Igual que las del staff: en la base va solo el hash del token. */
export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("customer_sessions_account_idx").on(t.accountId)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleId: varchar("google_id", { length: 255 }).unique(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    /** E.164 normalizado. */
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }),
    /** Casilla opcional para promociones. El seguimiento posventa no depende de esto. */
    consentCommercial: boolean("consent_commercial").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("customers_phone_idx").on(t.phone), index("customers_email_idx").on(t.email)],
);

// ---- Catálogo y precios ----

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: varchar("sku", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    category: productCategory("category").notNull(),
    description: text("description").notNull().default(""),
    ingredients: text("ingredients").notNull().default(""),
    allergens: text("allergens").notNull().default(""),
    netWeightG: integer("net_weight_g"),
    macros: jsonb("macros").$type<{
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    }>(),
    imageUrl: varchar("image_url", { length: 1024 }),
    /** Precio de un pack de complemento. Solo se usa si category = COMPLEMENTO. */
    price: money("price"),
    isActive: boolean("is_active").notNull().default(true),
    recipeVersion: varchar("recipe_version", { length: 32 }).notNull().default("v1.0"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    check(
      "products_complement_has_price",
      sql`${t.category} <> 'COMPLEMENTO' OR ${t.price} IS NOT NULL`,
    ),
    check("products_price_non_negative", sql`${t.price} IS NULL OR ${t.price} >= 0`),
  ],
);

export const packPricingTiers = pgTable(
  "pack_pricing_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: productCategory("category").notNull(),
    size: integer("size").notNull(),
    price: money("price").notNull(),
  },
  (t) => [
    unique("pack_pricing_tiers_category_size").on(t.category, t.size),
    check("pack_pricing_tiers_is_pack", sql`${t.category} <> 'COMPLEMENTO'`),
    check("pack_pricing_tiers_size_positive", sql`${t.size} > 0`),
    check("pack_pricing_tiers_price_non_negative", sql`${t.price} >= 0`),
  ],
);

// ---- Agenda y envío ----

/** Ajustes globales (clave/valor): teléfono de WhatsApp, URL de FUDO, radio máximo, plazo de abandono. */
export const settings = pgTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Un día de entrega concreto (miércoles, o viernes si el admin lo abre). */
export const deliveryDays = pgTable("delivery_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date", { mode: "string" }).notNull().unique(),
  isOpen: boolean("is_open").notNull().default(false),
  cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),
  slots: jsonb("slots")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
});

/** Tramos de envío por distancia por calle: hasta `up_to_m` metros cuesta `fee`. */
export const shippingTiers = pgTable(
  "shipping_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    upToM: integer("up_to_m").notNull().unique(),
    fee: money("fee").notNull(),
  },
  (t) => [
    check("shipping_tiers_distance_positive", sql`${t.upToM} > 0`),
    check("shipping_tiers_fee_non_negative", sql`${t.fee} >= 0`),
  ],
);

// ---- Pedidos ----

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 101 });

export type DeliveryAddress = {
  street: string;
  number: string;
  floorApt?: string;
  neighborhood: string;
  notes?: string;
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: varchar("order_number", { length: 16 })
      .notNull()
      .unique()
      .default(sql`'PAS-' || lpad(nextval('order_number_seq')::text, 6, '0')`),
    origin: orderOrigin("origin").notNull().default("WEB"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }),
    deliveryType: deliveryType("delivery_type").notNull(),
    deliveryAddress: jsonb("delivery_address").$type<DeliveryAddress>(),
    /** Distancia por calle al local, en metros. Nulo en retiro o si no se pudo ubicar. */
    deliveryDistanceM: integer("delivery_distance_m"),
    deliveryFeeStatus: deliveryFeeStatus("delivery_fee_status").notNull().default("NO_APLICA"),
    scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
    scheduledTimeSlot: varchar("scheduled_time_slot", { length: 64 }).notNull(),
    subtotal: money("subtotal").notNull(),
    /** Nulo mientras el envío está "a confirmar". */
    deliveryFee: money("delivery_fee"),
    total: money("total").notNull(),
    status: orderStatus("status").notNull().default("PRELIMINAR"),
    paymentMethod: paymentMethod("payment_method").notNull().default("PENDIENTE"),
    paymentStatus: paymentStatus("payment_status").notNull().default("PENDIENTE"),
    cancellationReason: text("cancellation_reason"),
    surveyToken: uuid("survey_token").notNull().unique().defaultRandom(),
    /** Enlace privado a la página del pedido (`/pedido/:token`). El número de pedido es adivinable; este no. */
    accessToken: uuid("access_token").notNull().unique().defaultRandom(),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_scheduled_date_idx").on(t.scheduledDate),
    index("orders_customer_idx").on(t.customerId),
    index("orders_customer_email_idx").on(t.customerEmail),
    check(
      "orders_cancelled_has_reason",
      sql`${t.status} <> 'CANCELADO' OR ${t.cancellationReason} IS NOT NULL`,
    ),
    check(
      "orders_pickup_has_no_fee_status",
      sql`${t.deliveryType} <> 'RETIRO' OR ${t.deliveryFeeStatus} = 'NO_APLICA'`,
    ),
    check("orders_amounts_non_negative", sql`${t.subtotal} >= 0 AND ${t.total} >= 0`),
  ],
);

/** Un pack o complemento dentro del pedido. Los precios son foto del momento de la compra. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemType: orderItemType("item_type").notNull(),
    /** Tamaño del pack (5, 10, 20 o 6, 12). Nulo en complementos. */
    tierSize: integer("tier_size"),
    category: productCategory("category").notNull(),
    unitPrice: money("unit_price").notNull(),
    totalPrice: money("total_price").notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check(
      "order_items_pack_has_size",
      sql`${t.itemType} = 'COMPLEMENTO' OR ${t.tierSize} IS NOT NULL`,
    ),
  ],
);

/** Desglose por plato. Los complementos también tienen su detalle (producto y cantidad). */
export const orderItemDetails = pgTable(
  "order_item_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    productName: varchar("product_name", { length: 255 }).notNull(),
    recipeVersion: varchar("recipe_version", { length: 32 }).notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    index("order_item_details_item_idx").on(t.orderItemId),
    index("order_item_details_product_idx").on(t.productId),
    check("order_item_details_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/** Historial de cambios del pedido: quién, cuándo y qué cambió. */
export const orderChanges = pgTable(
  "order_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Nulo cuando el cambio lo hace el sistema (por ejemplo, la cancelación por abandono). */
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    kind: orderChangeKind("kind").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    note: text("note"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_changes_order_idx").on(t.orderId, t.changedAt)],
);

// ---- CRM y encuestas ----

export const crmTasks = pgTable(
  "crm_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Nulo si el pedido fue de invitado. */
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    type: crmTaskType("type").notNull(),
    scheduledFor: date("scheduled_for", { mode: "string" }).notNull(),
    status: crmTaskStatus("status").notNull().default("PENDIENTE"),
    resultNotes: text("result_notes"),
    operatorId: uuid("operator_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    // Repetir el cambio a ENTREGADO no duplica las tareas.
    unique("crm_tasks_order_type").on(t.orderId, t.type),
    index("crm_tasks_due_idx").on(t.scheduledFor, t.status),
  ],
);

const rating = (name: string) => integer(name);

export const productReviews = pgTable(
  "product_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    recipeVersion: varchar("recipe_version", { length: 32 }).notNull(),
    ratingOverall: rating("rating_overall"),
    ratingFlavor: rating("rating_flavor"),
    ratingTexture: rating("rating_texture"),
    portionSize: portionSize("portion_size"),
    comments: text("comments"),
    notTestedYet: boolean("not_tested_yet").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // El guardado parcial de la encuesta es un upsert sobre esta clave.
    unique("product_reviews_order_product").on(t.orderId, t.productId),
    index("product_reviews_product_idx").on(t.productId, t.recipeVersion),
    check(
      "product_reviews_ratings_range",
      sql`(${t.ratingOverall} IS NULL OR ${t.ratingOverall} BETWEEN 1 AND 5)
        AND (${t.ratingFlavor} IS NULL OR ${t.ratingFlavor} BETWEEN 1 AND 5)
        AND (${t.ratingTexture} IS NULL OR ${t.ratingTexture} BETWEEN 1 AND 5)`,
    ),
    check(
      "product_reviews_not_tested_has_no_ratings",
      sql`NOT ${t.notTestedYet} OR (${t.ratingOverall} IS NULL AND ${t.ratingFlavor} IS NULL
        AND ${t.ratingTexture} IS NULL AND ${t.portionSize} IS NULL)`,
    ),
  ],
);
