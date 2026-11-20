import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Landlord,
  Property,
  Tenant,
  Lease,
  Payment,
} from '../types/gimmo.ts';

const REQUIRED_TABLES = [
  'users',
  'landlords',
  'properties',
  'tenants',
  'leases',
  'payments',
  'app_settings',
] as const;

let cachedAdminClient: SupabaseClient | null = null;
let cachedConfigSignature = '';

export function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  const jwksUrl = (
    process.env.SUPABASE_JWKS_URL ||
    (url ? `${url.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json` : '')
  ).trim();

  return {
    url,
    publishableKey,
    secretKey,
    jwksUrl,
    isConfigured: Boolean(url && secretKey),
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const { url, secretKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return null;
  }

  const signature = `${url}|${secretKey.slice(0, 12)}`;
  if (!cachedAdminClient || cachedConfigSignature !== signature) {
    cachedAdminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    cachedConfigSignature = signature;
  }

  return cachedAdminClient;
}

export function requireSupabaseAdmin(): SupabaseClient {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error(
      'Supabase non configuré : définissez SUPABASE_URL et SUPABASE_SECRET_KEY.'
    );
  }
  return client;
}

export async function verifySupabaseAuthPassword(
  email: string,
  password: string
): Promise<{ id: string; email: string; fullName: string } | null> {
  const { url, publishableKey, secretKey } = getSupabaseConfig();
  const apiKey = publishableKey || secretKey;
  if (!url || !apiKey || !email || !password) {
    return null;
  }
  try {
    const authClient = createClient(url, apiKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.user) {
      return null;
    }
    const meta = (data.user.user_metadata || {}) as Record<string, any>;
    const fullName =
      String(meta.full_name || meta.name || '').trim() ||
      email.split('@')[0];
    return {
      id: data.user.id,
      email: (data.user.email || email).trim().toLowerCase(),
      fullName,
    };
  } catch {
    return null;
  }
}

export function mapLandlordRow(row: any): Landlord {
  return {
    id: Number(row.id),
    userId: String(row.user_id || 'global_demo'),
    fullName: String(row.full_name || ''),
    companyName: row.company_name ?? null,
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    address: String(row.address || ''),
    taxId: row.tax_id ?? null,
    iban: row.iban ?? null,
    commissionRate: Number(row.commission_rate ?? 8),
    contractHeaderNote: row.contract_header_note ?? null,
    portalUsername: row.portal_username ?? null,
    portalPassword: row.portal_password ?? null,
    portalEnabled: row.portal_enabled !== false,
    portalLastLoginAt: row.portal_last_login_at
      ? String(row.portal_last_login_at)
      : null,
    createdAt: row.created_at
      ? String(row.created_at)
      : new Date().toISOString(),
  };
}

export function mapPropertyRow(row: any): Property {
  return {
    id: Number(row.id),
    userId: String(row.user_id || 'global_demo'),
    landlordId: Number(row.landlord_id),
    reference: String(row.reference || ''),
    title: String(row.title || ''),
    propertyType: String(row.property_type || 'Appartement'),
    address: String(row.address || ''),
    city: String(row.city || ''),
    neighborhood: String(row.neighborhood || ''),
    surfaceArea: Number(row.surface_area ?? 0),
    roomsCount: Number(row.rooms_count ?? 1),
    monthlyRent: String(row.monthly_rent ?? '0'),
    chargesAmount: String(row.charges_amount ?? '0'),
    currency: String(row.currency || 'FCFA'),
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    postgisWkt: String(row.postgis_wkt || ''),
    status: (row.status || 'occupied') as Property['status'],
    createdAt: row.created_at
      ? String(row.created_at)
      : new Date().toISOString(),
  };
}

export function mapTenantRow(row: any): Tenant {
  return {
    id: Number(row.id),
    userId: String(row.user_id || 'global_demo'),
    firstName: String(row.first_name || ''),
    lastName: String(row.last_name || ''),
    email: String(row.email || ''),
    phoneWhatsapp: String(row.phone_whatsapp || ''),
    nationalIdNumber: String(row.national_id_number || ''),
    profession: row.profession ?? null,
    employer: row.employer ?? null,
    monthlyIncome:
      row.monthly_income !== null && row.monthly_income !== undefined
        ? String(row.monthly_income)
        : null,
    guarantorName: row.guarantor_name ?? null,
    guarantorPhone: row.guarantor_phone ?? null,
    dossierStatus: String(row.dossier_status || 'approved'),
    createdAt: row.created_at
      ? String(row.created_at)
      : new Date().toISOString(),
  };
}

export function mapLeaseRow(row: any): Lease {
  return {
    id: Number(row.id),
    userId: String(row.user_id || 'global_demo'),
    contractNumber: String(row.contract_number || ''),
    landlordId: Number(row.landlord_id),
    propertyId: Number(row.property_id),
    tenantId: Number(row.tenant_id),
    startDate: String(row.start_date || ''),
    endDate: row.end_date ?? null,
    rentAmount: String(row.rent_amount ?? '0'),
    chargesAmount: String(row.charges_amount ?? '0'),
    securityDeposit: String(row.security_deposit ?? '0'),
    paymentDueDay: Number(row.payment_due_day ?? 5),
    customClauses: row.custom_clauses ?? null,
    status: String(row.status || 'active'),
    shareToken: String(row.share_token || ''),
    createdAt: row.created_at
      ? String(row.created_at)
      : new Date().toISOString(),
  };
}

export function mapPaymentRow(row: any): Payment {
  return {
    id: Number(row.id),
    userId: String(row.user_id || 'global_demo'),
    receiptNumber: String(row.receipt_number || ''),
    leaseId: Number(row.lease_id),
    landlordId: Number(row.landlord_id),
    propertyId: Number(row.property_id),
    tenantId: Number(row.tenant_id),
    periodMonth: String(row.period_month || ''),
    periodLabel: String(row.period_label || ''),
    amountDue: String(row.amount_due ?? '0'),
    amountPaid: String(row.amount_paid ?? '0'),
    dueDate: String(row.due_date || ''),
    paymentDate: row.payment_date ?? null,
    paymentMethod: row.payment_method ?? null,
    status: (row.status || 'pending') as Payment['status'],
    daysLate: Number(row.days_late ?? 0),
    whatsappSent: Boolean(row.whatsapp_sent),
    shareToken: String(row.share_token || ''),
    createdAt: row.created_at
      ? String(row.created_at)
      : new Date().toISOString(),
  };
}

export async function checkSupabaseTablesStatus() {
  const { url, publishableKey, jwksUrl, isConfigured } = getSupabaseConfig();
  let projectHost = '';
  try {
    if (url) {
      projectHost = new URL(url).host;
    }
  } catch {
    projectHost = '';
  }

  const client = getSupabaseAdmin();
  if (!client || !isConfigured) {
    return {
      configured: false,
      mode: 'direct_supabase',
      projectHost,
      hasPublishableKey: Boolean(publishableKey),
      jwksConfigured: Boolean(jwksUrl),
      tablesReady: false,
      existingTables: [] as string[],
      missingTables: [...REQUIRED_TABLES],
      permissionDeniedTables: [] as string[],
    };
  }

  const existingTables: string[] = [];
  const missingTables: string[] = [];
  const permissionDeniedTables: string[] = [];

  await Promise.all(
    REQUIRED_TABLES.map(async (tableName) => {
      const { error } = await client.from(tableName).select('*').limit(1);
      if (!error) {
        existingTables.push(tableName);
      } else if (error.code === '42501') {
        existingTables.push(tableName);
        permissionDeniedTables.push(tableName);
      } else {
        missingTables.push(tableName);
      }
    })
  );

  return {
    configured: true,
    mode: 'direct_supabase',
    projectHost,
    hasPublishableKey: Boolean(publishableKey),
    jwksConfigured: Boolean(jwksUrl),
    tablesReady:
      missingTables.length === 0 && permissionDeniedTables.length === 0,
    existingTables: existingTables.sort(),
    missingTables: missingTables.sort(),
    permissionDeniedTables: permissionDeniedTables.sort(),
  };
}

export async function loadAppSettingsFromSupabase(
  rowId: string
): Promise<string | null> {
  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from('app_settings')
    .select('store_json')
    .eq('id', rowId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase app_settings read failed: ${error.message}`);
  }
  return data?.store_json ? String(data.store_json) : null;
}

export async function saveAppSettingsToSupabase(
  rowId: string,
  storeJson: string
): Promise<void> {
  const client = requireSupabaseAdmin();
  const { error } = await client.from('app_settings').upsert(
    {
      id: rowId,
      store_json: storeJson,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(`Supabase app_settings write failed: ${error.message}`);
  }
}
