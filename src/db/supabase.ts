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
  const url = (process.env.SUPABASE_URL || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const jwksUrl = (process.env.SUPABASE_JWKS_URL || '').trim();

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
      projectHost,
      hasPublishableKey: Boolean(publishableKey),
      jwksConfigured: Boolean(jwksUrl),
      tablesReady: false,
      existingTables: [] as string[],
      missingTables: [...REQUIRED_TABLES],
    };
  }

  const existingTables: string[] = [];
  const missingTables: string[] = [];
  const permissionDeniedTables: string[] = [];

  await Promise.all(
    REQUIRED_TABLES.map(async (tableName) => {
      const { error } = await client
        .from(tableName)
        .select('*')
        .limit(1);
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
    projectHost,
    hasPublishableKey: Boolean(publishableKey),
    jwksConfigured: Boolean(jwksUrl),
    tablesReady: missingTables.length === 0 && permissionDeniedTables.length === 0,
    existingTables: existingTables.sort(),
    missingTables: missingTables.sort(),
    permissionDeniedTables: permissionDeniedTables.sort(),
  };
}

export async function loadAppSettingsFromSupabase(
  rowId: string
): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('app_settings')
      .select('store_json')
      .eq('id', rowId)
      .maybeSingle();

    if (error || !data?.store_json) {
      return null;
    }
    return String(data.store_json);
  } catch {
    return null;
  }
}

export async function syncAppSettingsToSupabase(
  rowId: string,
  storeJson: string
): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client) return false;

  try {
    const { error } = await client.from('app_settings').upsert(
      {
        id: rowId,
        store_json: storeJson,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function syncFullDatasetToSupabase(dataset: {
  landlords: Landlord[];
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  payments: Payment[];
  storeJson?: string;
}): Promise<{
  synced: boolean;
  reason?: string;
  counts?: Record<string, number>;
}> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { synced: false, reason: 'Supabase non configuré' };
  }

  const status = await checkSupabaseTablesStatus();
  if (!status.tablesReady) {
    return {
      synced: false,
      reason: `Tables manquantes dans Supabase : ${status.missingTables.join(', ')}`,
    };
  }

  try {
    if (dataset.landlords.length > 0) {
      const { error } = await client.from('landlords').upsert(
        dataset.landlords.map((l) => ({
          id: l.id,
          user_id: l.userId || 'global_demo',
          full_name: l.fullName,
          company_name: l.companyName ?? null,
          email: l.email,
          phone: l.phone,
          address: l.address,
          tax_id: l.taxId ?? null,
          iban: l.iban ?? null,
          commission_rate: Number(l.commissionRate ?? 8),
          contract_header_note: l.contractHeaderNote ?? null,
          portal_username: l.portalUsername ?? null,
          portal_password: l.portalPassword ?? null,
          portal_enabled: l.portalEnabled ?? true,
          portal_last_login_at: l.portalLastLoginAt ?? null,
          created_at: l.createdAt || new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );
      if (error) throw new Error(`landlords: ${error.message}`);
    }

    if (dataset.properties.length > 0) {
      const { error } = await client.from('properties').upsert(
        dataset.properties.map((p) => ({
          id: p.id,
          user_id: p.userId || 'global_demo',
          landlord_id: p.landlordId,
          reference: p.reference,
          title: p.title,
          property_type: p.propertyType,
          address: p.address,
          city: p.city,
          neighborhood: p.neighborhood,
          surface_area: Number(p.surfaceArea),
          rooms_count: Number(p.roomsCount),
          monthly_rent: Number(p.monthlyRent),
          charges_amount: Number(p.chargesAmount ?? 0),
          currency: p.currency || 'FCFA',
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          postgis_wkt: p.postgisWkt,
          status: p.status || 'occupied',
          created_at: p.createdAt || new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );
      if (error) throw new Error(`properties: ${error.message}`);
    }

    if (dataset.tenants.length > 0) {
      const { error } = await client.from('tenants').upsert(
        dataset.tenants.map((t) => ({
          id: t.id,
          user_id: t.userId || 'global_demo',
          first_name: t.firstName,
          last_name: t.lastName,
          email: t.email,
          phone_whatsapp: t.phoneWhatsapp,
          national_id_number: t.nationalIdNumber,
          profession: t.profession ?? null,
          employer: t.employer ?? null,
          monthly_income:
            t.monthlyIncome !== undefined && t.monthlyIncome !== null
              ? Number(t.monthlyIncome)
              : null,
          guarantor_name: t.guarantorName ?? null,
          guarantor_phone: t.guarantorPhone ?? null,
          dossier_status: t.dossierStatus || 'approved',
          created_at: t.createdAt || new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );
      if (error) throw new Error(`tenants: ${error.message}`);
    }

    if (dataset.leases.length > 0) {
      const { error } = await client.from('leases').upsert(
        dataset.leases.map((le) => ({
          id: le.id,
          user_id: le.userId || 'global_demo',
          contract_number: le.contractNumber,
          landlord_id: le.landlordId,
          property_id: le.propertyId,
          tenant_id: le.tenantId,
          start_date: le.startDate,
          end_date: le.endDate ?? null,
          rent_amount: Number(le.rentAmount),
          charges_amount: Number(le.chargesAmount ?? 0),
          security_deposit: Number(le.securityDeposit),
          payment_due_day: Number(le.paymentDueDay ?? 5),
          custom_clauses: le.customClauses ?? null,
          status: le.status || 'active',
          share_token: le.shareToken,
          created_at: le.createdAt || new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );
      if (error) throw new Error(`leases: ${error.message}`);
    }

    if (dataset.payments.length > 0) {
      const { error } = await client.from('payments').upsert(
        dataset.payments.map((pay) => ({
          id: pay.id,
          user_id: pay.userId || 'global_demo',
          receipt_number: pay.receiptNumber,
          lease_id: pay.leaseId,
          landlord_id: pay.landlordId,
          property_id: pay.propertyId,
          tenant_id: pay.tenantId,
          period_month: pay.periodMonth,
          period_label: pay.periodLabel,
          amount_due: Number(pay.amountDue),
          amount_paid: Number(pay.amountPaid ?? 0),
          due_date: pay.dueDate,
          payment_date: pay.paymentDate ?? null,
          payment_method: pay.paymentMethod ?? null,
          status: pay.status || 'pending',
          days_late: Number(pay.daysLate ?? 0),
          whatsapp_sent: Boolean(pay.whatsappSent),
          share_token: pay.shareToken,
          created_at: pay.createdAt || new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );
      if (error) throw new Error(`payments: ${error.message}`);
    }

    if (dataset.storeJson) {
      await syncAppSettingsToSupabase('gimmo_saas_store', dataset.storeJson);
    }

    return {
      synced: true,
      counts: {
        landlords: dataset.landlords.length,
        properties: dataset.properties.length,
        tenants: dataset.tenants.length,
        leases: dataset.leases.length,
        payments: dataset.payments.length,
      },
    };
  } catch (err: any) {
    return {
      synced: false,
      reason: err?.message || 'Erreur synchronisation Supabase',
    };
  }
}
