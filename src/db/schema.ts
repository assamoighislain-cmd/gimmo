import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  numeric,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

// 1. Utilisateurs de la plateforme (Gestionnaires / Agences) liés à Firebase Auth
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('agency_admin').notNull(), // 'agency_admin' | 'landlord_portal'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Bailleurs (Landlords / Propriétaires) - Architecture Multi-Bailleurs
export const landlords = pgTable(
  'landlords',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(), // Propriétaire du compte SaaS (uid ou 'global_demo')
    fullName: text('full_name').notNull(),
    companyName: text('company_name'),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    address: text('address').notNull(),
    taxId: text('tax_id'), // RCCM / NIF / SIRET
    iban: text('iban'), // Coordonnées bancaires / Mobile Money
    commissionRate: doublePrecision('commission_rate').default(8.0).notNull(), // % honoraires agence
    contractHeaderNote: text('contract_header_note'), // Clause / en-tête personnalisée bailleur
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_landlords_user').on(table.userId)]
);

// 3. Biens Immobiliers (Properties) avec Géolocalisation GPS & PostGIS WKT
export const properties = pgTable(
  'properties',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    landlordId: integer('landlord_id')
      .references(() => landlords.id, { onDelete: 'cascade' })
      .notNull(),
    reference: text('reference').notNull(), // ex: GIM-ABJ-001
    title: text('title').notNull(),
    propertyType: text('property_type').notNull(), // 'Appartement' | 'Villa' | 'Bureau' | 'Local Commercial' | 'Studio'
    address: text('address').notNull(),
    city: text('city').notNull(),
    neighborhood: text('neighborhood').notNull(),
    surfaceArea: integer('surface_area').notNull(), // m²
    roomsCount: integer('rooms_count').notNull(),
    monthlyRent: numeric('monthly_rent', { precision: 12, scale: 2 }).notNull(),
    chargesAmount: numeric('charges_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    currency: text('currency').default('FCFA').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    postgisWkt: text('postgis_wkt').notNull(), // Format PostGIS: SRID=4326;POINT(lng lat)
    status: text('status').default('occupied').notNull(), // 'occupied' | 'vacant' | 'maintenance'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_properties_landlord').on(table.landlordId),
    index('idx_properties_coords').on(table.latitude, table.longitude),
  ]
);

// 4. Locataires (Tenants) & Dossiers
export const tenants = pgTable(
  'tenants',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phoneWhatsapp: text('phone_whatsapp').notNull(), // Format E.164 ex: +2250708091011
    nationalIdNumber: text('national_id_number').notNull(), // CNI / Passeport
    profession: text('profession'),
    employer: text('employer'),
    monthlyIncome: numeric('monthly_income', { precision: 12, scale: 2 }),
    guarantorName: text('guarantor_name'),
    guarantorPhone: text('guarantor_phone'),
    dossierStatus: text('dossier_status').default('approved').notNull(), // 'approved' | 'pending' | 'incomplete'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_tenants_user').on(table.userId)]
);

// 5. Contrats de Bail (Leases) personnalisés par Bailleur
export const leases = pgTable(
  'leases',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    contractNumber: text('contract_number').notNull().unique(), // ex: BAIL-2026-0042
    landlordId: integer('landlord_id')
      .references(() => landlords.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: integer('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: integer('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    endDate: text('end_date'), // YYYY-MM-DD
    rentAmount: numeric('rent_amount', { precision: 12, scale: 2 }).notNull(),
    chargesAmount: numeric('charges_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    securityDeposit: numeric('security_deposit', { precision: 12, scale: 2 }).notNull(),
    paymentDueDay: integer('payment_due_day').default(5).notNull(), // Jour limite du mois (ex: le 5)
    customClauses: text('custom_clauses'), // Clauses spécifiques au bailleur
    status: text('status').default('active').notNull(), // 'active' | 'terminated' | 'expired'
    shareToken: text('share_token').notNull().unique(), // Jeton sécurisé pour lien PDF WhatsApp
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_leases_landlord').on(table.landlordId),
    index('idx_leases_property').on(table.propertyId),
    index('idx_leases_tenant').on(table.tenantId),
  ]
);

// 6. Paiements, Facturation & Quittances de Loyer (Payments & Receipts)
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    receiptNumber: text('receipt_number').notNull().unique(), // ex: QUIT-202611-001
    leaseId: integer('lease_id')
      .references(() => leases.id, { onDelete: 'cascade' })
      .notNull(),
    landlordId: integer('landlord_id')
      .references(() => landlords.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: integer('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: integer('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    periodMonth: text('period_month').notNull(), // Format 'YYYY-MM' ex: '2026-11'
    periodLabel: text('period_label').notNull(), // ex: 'Novembre 2026'
    amountDue: numeric('amount_due', { precision: 12, scale: 2 }).notNull(),
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0').notNull(),
    dueDate: text('due_date').notNull(), // YYYY-MM-DD
    paymentDate: text('payment_date'), // YYYY-MM-DD (null si impayé)
    paymentMethod: text('payment_method'), // 'Virement' | 'Mobile Money' | 'Espèces' | 'Chèque'
    status: text('status').default('pending').notNull(), // 'paid' | 'overdue' | 'partial' | 'pending'
    daysLate: integer('days_late').default(0).notNull(),
    whatsappSent: boolean('whatsapp_sent').default(false).notNull(),
    shareToken: text('share_token').notNull().unique(), // Jeton sécurisé pour téléchargement PDF Quittance
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payments_landlord').on(table.landlordId),
    index('idx_payments_period').on(table.periodMonth),
    index('idx_payments_status').on(table.status),
  ]
);

// Relations Drizzle ORM
export const landlordsRelations = relations(landlords, ({ many }) => ({
  properties: many(properties),
  leases: many(leases),
  payments: many(payments),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  landlord: one(landlords, {
    fields: [properties.landlordId],
    references: [landlords.id],
  }),
  leases: many(leases),
  payments: many(payments),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  leases: many(leases),
  payments: many(payments),
}));

export const leasesRelations = relations(leases, ({ one, many }) => ({
  landlord: one(landlords, {
    fields: [leases.landlordId],
    references: [landlords.id],
  }),
  property: one(properties, {
    fields: [leases.propertyId],
    references: [properties.id],
  }),
  tenant: one(tenants, {
    fields: [leases.tenantId],
    references: [tenants.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  lease: one(leases, {
    fields: [payments.leaseId],
    references: [leases.id],
  }),
  landlord: one(landlords, {
    fields: [payments.landlordId],
    references: [landlords.id],
  }),
  property: one(properties, {
    fields: [payments.propertyId],
    references: [properties.id],
  }),
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
}));
