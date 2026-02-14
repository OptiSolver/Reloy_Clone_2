import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * OWNERS
 * Cuenta que paga el sistema (tenant raíz)
 */
export const owners = pgTable("owners", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  authUserId: uuid("auth_user_id").unique(),

  firstName: text("first_name"),
  lastName: text("last_name"),

  accountType: text("account_type").default("owner"),
  status: text("status").default("active"),
});

/**
 * MERCHANTS
 * Comercio / marca dentro de un owner
 */
export const merchants = pgTable("merchants", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * BRANCHES
 * Sucursales de un comercio
 */
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id")
    .notNull()
    .references(() => merchants.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * STAFF
 * Personas que operan el sistema en sucursal
 */
export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // ej: admin, cashier, manager
  authUserId: uuid("auth_user_id"),
  pinHash: text("pin_hash"), // PIN numérico hasheado (opcional por ahora)
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * CUSTOMERS
 * Cliente global (existe una sola vez en el sistema).
 * Luego se relaciona con cada comercio vía memberships (wallet por merchant).
 */
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * CUSTOMER_IDENTIFIERS
 * Múltiples formas de identificar a un cliente.
 * Ejemplos:
 * - type: phone | email | qr | code | document | external
 * - valueNormalized: valor normalizado para búsquedas/uniques (lowercase, sin espacios, etc.)
 */
export const customerIdentifiers = pgTable(
  "customer_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    type: text("type").notNull(), // phone | email | qr | code | document | external
    valueRaw: text("value_raw").notNull(),
    valueNormalized: text("value_normalized").notNull(),

    isPrimary: boolean("is_primary").default(false).notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Un mismo identificador no puede repetirse en el sistema (por tipo + valor normalizado)
    uniqTypeValue: uniqueIndex("uq_customer_identifier_type_value").on(
      t.type,
      t.valueNormalized
    ),

    // Índice para búsquedas rápidas por (type, valueNormalized)
    idxTypeValue: index("idx_customer_identifier_type_value").on(
      t.type,
      t.valueNormalized
    ),

    // Índice para listar identificadores de un customer
    idxCustomerId: index("idx_customer_identifier_customer_id").on(t.customerId),
  })
);

/**
 * MEMBERSHIPS (wallet por comercio)
 * Relación customer ↔ merchant.
 * Acá guardamos snapshots útiles (puntos, estado), pero la verdad histórica vive en events.
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    pointsBalance: integer("points_balance").default(0).notNull(), // snapshot
    status: text("status").default("new").notNull(), // new | active | risk | lost (derivado)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Un customer solo puede tener una wallet por merchant
    uniqMerchantCustomer: uniqueIndex("uq_memberships_merchant_customer").on(
      t.merchantId,
      t.customerId
    ),
    idxMerchant: index("idx_memberships_merchant_id").on(t.merchantId),
    idxCustomer: index("idx_memberships_customer_id").on(t.customerId),
  })
);

/**
 * EVENTS (append-only)
 * Cada acción importante genera un evento. Nunca se edita ni se borra.
 * type ejemplos: visit, checkin, checkout, redeem, review, mission_completed, points_adjustment, etc.
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    branchId: uuid("branch_id").references(() => branches.id),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    staffId: uuid("staff_id").references(() => staff.id),

    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),

    // Datos adicionales del evento (flexible por rubro)
    payload: jsonb("payload").notNull().default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxMerchantOccurred: index("idx_events_merchant_occurred_at").on(
      t.merchantId,
      t.occurredAt
    ),
    idxCustomerOccurred: index("idx_events_customer_occurred_at").on(
      t.customerId,
      t.occurredAt
    ),
    idxType: index("idx_events_type").on(t.type),
  })
);


/**
 * MERCHANT_SETTINGS
 * Parametrización por comercio/rubro.
 * Acá definimos “cómo opera” el loyalty según el rubro (visita única vs check-in/out, etc.).
 */
export const merchantSettings = pgTable(
  "merchant_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    industry: text("industry").notNull(), // ej: gym, cafe, barber, retail, etc.

    // Modo operativo: "single" (visita única) o "in_out" (check-in/out)
    visitMode: text("visit_mode").default("single").notNull(),

    // Config flexible por rubro/comercio (reglas, thresholds, etc.)
    config: jsonb("config").notNull().default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqMerchant: uniqueIndex("uq_merchant_settings_merchant").on(t.merchantId),
    idxIndustry: index("idx_merchant_settings_industry").on(t.industry),
  })
);

/**
 * REWARDS
 * Catálogo de recompensas por comercio.
 */
export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    title: text("title").notNull(),
    description: text("description"),
    pointsCost: integer("points_cost").notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    meta: jsonb("meta").notNull().default({}), // flex: stock, tags, restricciones, etc.

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxMerchant: index("idx_rewards_merchant_id").on(t.merchantId),
    idxActive: index("idx_rewards_active").on(t.isActive),
  })
);

/**
 * REWARD_REDEMPTIONS
 * Registro de canjes. (Además, el canje también debería generar un event tipo "redeem")
 */
export const rewardRedemptions = pgTable(
  "reward_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    staffId: uuid("staff_id").references(() => staff.id),
    branchId: uuid("branch_id").references(() => branches.id),

    pointsSpent: integer("points_spent").notNull(),
    status: text("status").default("approved").notNull(), // approved | cancelled | reversed

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxMerchant: index("idx_redemptions_merchant_id").on(t.merchantId),
    idxCustomer: index("idx_redemptions_customer_id").on(t.customerId),
    idxReward: index("idx_redemptions_reward_id").on(t.rewardId),
  })
);

/**
 * MISSIONS
 * Catálogo de misiones por comercio.
 */
export const missions = pgTable(
  "missions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    title: text("title").notNull(),
    description: text("description"),

    // Definición flexible de reglas (por rubro)
    rule: jsonb("rule").notNull().default({}), // ej: {type:"visits", count:5, windowDays:30}

    pointsReward: integer("points_reward").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxMerchant: index("idx_missions_merchant_id").on(t.merchantId),
    idxActive: index("idx_missions_active").on(t.isActive),
  })
);

/**
 * MISSION_PROGRESS
 * Progreso de misiones por cliente (por comercio).
 * (Además, completar misión debería generar event tipo "mission_completed")
 */
export const missionProgress = pgTable(
  "mission_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    progress: integer("progress").default(0).notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqMissionCustomer: uniqueIndex("uq_mission_progress_unique").on(
      t.merchantId,
      t.missionId,
      t.customerId
    ),
    idxCustomer: index("idx_mission_progress_customer_id").on(t.customerId),
  })
);

/**
 * POINTS_LEDGER
 * Historial transaccional de puntos (doble entrada / auditoría).
 * Fuente de verdad para recálculos y seguridad.
 */
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    delta: integer("delta").notNull(), // + para award, - para redeem

    // Evento que originó este movimiento (idempotencia)
    sourceEventId: uuid("source_event_id")
      .notNull()
      .references(() => events.id),

    reason: text("reason").notNull(), // tracking: "visit", "redeem", "manual", etc.

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Un evento solo puede generar UN movimiento en el ledger (idempotencia fuerte)
    uniqSourceEvent: uniqueIndex("uq_points_ledger_source_event").on(t.sourceEventId),

    idxMerchant: index("idx_points_ledger_merchant").on(t.merchantId),
    idxCustomer: index("idx_points_ledger_customer").on(t.customerId),
  })
);