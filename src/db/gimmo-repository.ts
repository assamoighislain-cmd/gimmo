import {
  requireSupabaseAdmin,
  mapLandlordRow,
  mapPropertyRow,
  mapTenantRow,
  mapLeaseRow,
  mapPaymentRow,
} from './supabase.ts';
import {
  deriveDefaultLandlordUsername,
  generateLandlordPortalPassword,
} from '../lib/landlord-portal.ts';

export async function ensureInitialData(_userId: string = 'global_demo') {
  // Base Supabase laissée propre sans injection forcée de données fictives
  return;
}

export async function getAllDashboardData() {
  try {
    const sb = requireSupabaseAdmin();
    const [landlordsRes, propertiesRes, tenantsRes, leasesRes, paymentsRes] =
      await Promise.all([
        sb.from('landlords').select('*').order('id', { ascending: false }),
        sb.from('properties').select('*').order('id', { ascending: false }),
        sb.from('tenants').select('*').order('id', { ascending: false }),
        sb.from('leases').select('*').order('id', { ascending: false }),
        sb.from('payments').select('*').order('id', { ascending: false }),
      ]);

    if (landlordsRes.error) throw landlordsRes.error;
    if (propertiesRes.error) throw propertiesRes.error;
    if (tenantsRes.error) throw tenantsRes.error;
    if (leasesRes.error) throw leasesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    return {
      landlords: (landlordsRes.data || []).map(mapLandlordRow),
      properties: (propertiesRes.data || []).map(mapPropertyRow),
      tenants: (tenantsRes.data || []).map(mapTenantRow),
      leases: (leasesRes.data || []).map(mapLeaseRow),
      payments: (paymentsRes.data || []).map(mapPaymentRow),
    };
  } catch (error) {
    console.error('Supabase query failed in getAllDashboardData:', error);
    throw new Error('Failed to fetch Gimmo data from Supabase.', {
      cause: error,
    });
  }
}

export async function getPaymentFullDetailsByToken(shareToken: string) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: paymentRow, error } = await sb
      .from('payments')
      .select('*')
      .eq('share_token', shareToken)
      .maybeSingle();
    if (error) throw error;
    if (!paymentRow) return null;

    const payment = mapPaymentRow(paymentRow);
    const [landlordRes, propertyRes, tenantRes, leaseRes] = await Promise.all([
      sb.from('landlords').select('*').eq('id', payment.landlordId).maybeSingle(),
      sb.from('properties').select('*').eq('id', payment.propertyId).maybeSingle(),
      sb.from('tenants').select('*').eq('id', payment.tenantId).maybeSingle(),
      sb.from('leases').select('*').eq('id', payment.leaseId).maybeSingle(),
    ]);

    if (!landlordRes.data || !propertyRes.data || !tenantRes.data || !leaseRes.data) {
      return null;
    }

    return {
      payment,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data),
      lease: mapLeaseRow(leaseRes.data),
    };
  } catch (error) {
    console.error('Supabase query failed in getPaymentFullDetailsByToken:', error);
    throw new Error('Failed to load receipt details.', { cause: error });
  }
}

export async function getPaymentFullDetailsById(paymentId: number) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: paymentRow, error } = await sb
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!paymentRow) return null;

    const payment = mapPaymentRow(paymentRow);
    const [landlordRes, propertyRes, tenantRes, leaseRes] = await Promise.all([
      sb.from('landlords').select('*').eq('id', payment.landlordId).maybeSingle(),
      sb.from('properties').select('*').eq('id', payment.propertyId).maybeSingle(),
      sb.from('tenants').select('*').eq('id', payment.tenantId).maybeSingle(),
      sb.from('leases').select('*').eq('id', payment.leaseId).maybeSingle(),
    ]);

    if (!landlordRes.data || !propertyRes.data || !tenantRes.data || !leaseRes.data) {
      return null;
    }

    return {
      payment,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data),
      lease: mapLeaseRow(leaseRes.data),
    };
  } catch (error) {
    console.error('Supabase query failed in getPaymentFullDetailsById:', error);
    throw new Error('Failed to load payment details.', { cause: error });
  }
}

export async function getLeaseFullDetailsByToken(shareToken: string) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error } = await sb
      .from('leases')
      .select('*')
      .eq('share_token', shareToken)
      .maybeSingle();
    if (error) throw error;
    if (!leaseRow) return null;

    const lease = mapLeaseRow(leaseRow);
    const [landlordRes, propertyRes, tenantRes] = await Promise.all([
      sb.from('landlords').select('*').eq('id', lease.landlordId).maybeSingle(),
      sb.from('properties').select('*').eq('id', lease.propertyId).maybeSingle(),
      sb.from('tenants').select('*').eq('id', lease.tenantId).maybeSingle(),
    ]);

    if (!landlordRes.data || !propertyRes.data || !tenantRes.data) {
      return null;
    }

    return {
      lease,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data),
    };
  } catch (error) {
    console.error('Supabase query failed in getLeaseFullDetailsByToken:', error);
    throw new Error('Failed to load lease contract details.', { cause: error });
  }
}

export async function getLeaseFullDetailsById(leaseId: number) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error } = await sb
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .maybeSingle();
    if (error) throw error;
    if (!leaseRow) return null;

    const lease = mapLeaseRow(leaseRow);
    const [landlordRes, propertyRes, tenantRes] = await Promise.all([
      sb.from('landlords').select('*').eq('id', lease.landlordId).maybeSingle(),
      sb.from('properties').select('*').eq('id', lease.propertyId).maybeSingle(),
      sb.from('tenants').select('*').eq('id', lease.tenantId).maybeSingle(),
    ]);

    if (!landlordRes.data || !propertyRes.data || !tenantRes.data) {
      return null;
    }

    return {
      lease,
      landlord: mapLandlordRow(landlordRes.data),
      property: mapPropertyRow(propertyRes.data),
      tenant: mapTenantRow(tenantRes.data),
    };
  } catch (error) {
    console.error('Supabase query failed in getLeaseFullDetailsById:', error);
    throw new Error('Failed to load lease details.', { cause: error });
  }
}

export async function markPaymentAsPaid(
  paymentId: number,
  paymentMethod: string = 'Mobile Money'
) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: existing, error: fetchErr } = await sb
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) {
      throw new Error('Payment record not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: updated, error: updateErr } = await sb
      .from('payments')
      .update({
        amount_paid: existing.amount_due,
        payment_date: today,
        payment_method: paymentMethod,
        status: 'paid',
        days_late: 0,
      })
      .eq('id', paymentId)
      .select('*')
      .single();
    if (updateErr) throw updateErr;

    return mapPaymentRow(updated);
  } catch (error) {
    console.error('Supabase query failed in markPaymentAsPaid:', error);
    throw new Error('Failed to record payment.', { cause: error });
  }
}

export async function markWhatsappSent(paymentId: number) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: updated, error } = await sb
      .from('payments')
      .update({ whatsapp_sent: true })
      .eq('id', paymentId)
      .select('*')
      .single();
    if (error) throw error;
    return mapPaymentRow(updated);
  } catch (error) {
    console.error('Supabase query failed in markWhatsappSent:', error);
    throw new Error('Failed to update WhatsApp status.', { cause: error });
  }
}

export async function createPropertyRecord(data: {
  userId: string;
  landlordId: number;
  reference: string;
  title: string;
  propertyType: string;
  address: string;
  city: string;
  neighborhood: string;
  surfaceArea: number;
  roomsCount: number;
  monthlyRent: string;
  chargesAmount: string;
  latitude: number;
  longitude: number;
  status: string;
}) {
  try {
    const sb = requireSupabaseAdmin();
    const postgisWkt = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
    const { data: inserted, error } = await sb
      .from('properties')
      .insert({
        user_id: data.userId,
        landlord_id: data.landlordId,
        reference: data.reference,
        title: data.title,
        property_type: data.propertyType,
        address: data.address,
        city: data.city,
        neighborhood: data.neighborhood,
        surface_area: Number(data.surfaceArea),
        rooms_count: Number(data.roomsCount),
        monthly_rent: Number(data.monthlyRent),
        charges_amount: Number(data.chargesAmount || 0),
        currency: 'FCFA',
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        postgis_wkt: postgisWkt,
        status: data.status || 'vacant',
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapPropertyRow(inserted);
  } catch (error) {
    console.error('Supabase query failed in createPropertyRecord:', error);
    throw new Error('Failed to create property.', { cause: error });
  }
}

export async function createLandlordRecord(data: {
  userId: string;
  fullName: string;
  companyName?: string;
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  iban?: string;
  commissionRate: number;
  contractHeaderNote?: string;
  portalUsername?: string;
  portalPassword?: string;
  portalEnabled?: boolean;
}) {
  try {
    const sb = requireSupabaseAdmin();
    const portalUsername =
      (data.portalUsername || '').trim() ||
      deriveDefaultLandlordUsername({
        email: data.email,
        phone: data.phone,
        fullName: data.fullName,
      });
    const portalPassword =
      (data.portalPassword || '').trim() || generateLandlordPortalPassword();
    const portalEnabled = data.portalEnabled !== false;

    const { data: inserted, error } = await sb
      .from('landlords')
      .insert({
        user_id: data.userId,
        full_name: data.fullName,
        company_name: data.companyName || null,
        email: data.email,
        phone: data.phone,
        address: data.address,
        tax_id: data.taxId || null,
        iban: data.iban || null,
        commission_rate: Number(data.commissionRate ?? 8),
        contract_header_note: data.contractHeaderNote || null,
        portal_username: portalUsername,
        portal_password: portalPassword,
        portal_enabled: portalEnabled,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapLandlordRow(inserted);
  } catch (error) {
    console.error('Supabase query failed in createLandlordRecord:', error);
    throw new Error('Failed to create landlord.', { cause: error });
  }
}

export async function createTenantAndLeaseRecord(data: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneWhatsapp: string;
  nationalIdNumber: string;
  profession?: string;
  monthlyIncome?: string;
  propertyId: number;
  startDate: string;
  endDate: string;
  customClauses?: string;
}) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: propRow, error: propErr } = await sb
      .from('properties')
      .select('*')
      .eq('id', data.propertyId)
      .maybeSingle();
    if (propErr) throw propErr;
    if (!propRow) throw new Error('Bien introuvable');
    const property = mapPropertyRow(propRow);

    const { data: insertedTenantRow, error: tenantErr } = await sb
      .from('tenants')
      .insert({
        user_id: data.userId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone_whatsapp: data.phoneWhatsapp,
        national_id_number: data.nationalIdNumber,
        profession: data.profession || 'Cadre',
        monthly_income: Number(data.monthlyIncome || 1500000),
        dossier_status: 'approved',
      })
      .select('*')
      .single();
    if (tenantErr) throw tenantErr;
    const tenant = mapTenantRow(insertedTenantRow);

    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const contractNumber = `BAIL-2026-${randSuffix}`;
    const shareToken = `tok-lease-${Date.now()}-${randSuffix}`;

    const rentNum = Number(property.monthlyRent);
    const chargesNum = Number(property.chargesAmount);
    const totalDue = rentNum + chargesNum;

    const { data: insertedLeaseRow, error: leaseErr } = await sb
      .from('leases')
      .insert({
        user_id: data.userId,
        contract_number: contractNumber,
        landlord_id: property.landlordId,
        property_id: property.id,
        tenant_id: tenant.id,
        start_date: data.startDate,
        end_date: data.endDate,
        rent_amount: rentNum,
        charges_amount: chargesNum,
        security_deposit: rentNum * 2,
        payment_due_day: 5,
        custom_clauses:
          data.customClauses ||
          'Le preneur s’engage à régler le loyer au plus tard le 5 de chaque mois.',
        status: 'active',
        share_token: shareToken,
      })
      .select('*')
      .single();
    if (leaseErr) throw leaseErr;
    const lease = mapLeaseRow(insertedLeaseRow);

    await sb
      .from('properties')
      .update({ status: 'occupied' })
      .eq('id', property.id);

    const { error: payErr } = await sb.from('payments').insert({
      user_id: data.userId,
      receipt_number: `QUIT-202611-${randSuffix}`,
      lease_id: lease.id,
      landlord_id: property.landlordId,
      property_id: property.id,
      tenant_id: tenant.id,
      period_month: '2026-11',
      period_label: 'Novembre 2026',
      amount_due: totalDue,
      amount_paid: totalDue,
      due_date: '2026-11-05',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Mobile Money',
      status: 'paid',
      days_late: 0,
      whatsapp_sent: false,
      share_token: `tok-quit-${Date.now()}-${randSuffix}`,
    });
    if (payErr) throw payErr;

    return { tenant, lease };
  } catch (error) {
    console.error('Supabase query failed in createTenantAndLeaseRecord:', error);
    throw new Error('Failed to create tenant and lease.', { cause: error });
  }
}

export async function updatePropertyRecord(
  propertyId: number,
  data: {
    landlordId: number;
    reference: string;
    title: string;
    propertyType: string;
    address: string;
    city: string;
    neighborhood: string;
    surfaceArea: number;
    roomsCount: number;
    monthlyRent: string;
    chargesAmount: string;
    latitude: number;
    longitude: number;
    status: string;
  }
) {
  try {
    const sb = requireSupabaseAdmin();
    const postgisWkt = `SRID=4326;POINT(${data.longitude} ${data.latitude})`;
    const { data: updated, error } = await sb
      .from('properties')
      .update({
        landlord_id: data.landlordId,
        reference: data.reference,
        title: data.title,
        property_type: data.propertyType,
        address: data.address,
        city: data.city,
        neighborhood: data.neighborhood,
        surface_area: Number(data.surfaceArea),
        rooms_count: Number(data.roomsCount),
        monthly_rent: Number(data.monthlyRent),
        charges_amount: Number(data.chargesAmount || 0),
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        postgis_wkt: postgisWkt,
        status: data.status,
      })
      .eq('id', propertyId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      throw new Error('Bien immobilier introuvable');
    }
    return mapPropertyRow(updated);
  } catch (error) {
    console.error('Supabase query failed in updatePropertyRecord:', error);
    throw new Error('Impossible de modifier le bien immobilier.', {
      cause: error,
    });
  }
}

export async function updateLandlordRecord(
  landlordId: number,
  data: {
    fullName: string;
    companyName?: string;
    email: string;
    phone: string;
    address: string;
    taxId?: string;
    iban?: string;
    commissionRate: number;
    contractHeaderNote?: string;
    portalUsername?: string;
    portalPassword?: string;
    portalEnabled?: boolean;
  }
) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: currentRow, error: findErr } = await sb
      .from('landlords')
      .select('*')
      .eq('id', landlordId)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!currentRow) {
      if (data.fullName && data.fullName.trim()) {
        return await createLandlordRecord({
          userId: 'global_demo',
          ...data,
        });
      }
      throw new Error('Bailleur introuvable');
    }
    const existing = mapLandlordRow(currentRow);

    const resolvedUsername =
      data.portalUsername !== undefined && data.portalUsername.trim() !== ''
        ? data.portalUsername.trim()
        : existing.portalUsername ||
          deriveDefaultLandlordUsername({
            email: data.email,
            phone: data.phone,
            fullName: data.fullName,
          });

    const resolvedPassword =
      data.portalPassword !== undefined && data.portalPassword.trim() !== ''
        ? data.portalPassword.trim()
        : existing.portalPassword || generateLandlordPortalPassword();

    const resolvedEnabled =
      data.portalEnabled !== undefined
        ? Boolean(data.portalEnabled)
        : existing.portalEnabled ?? true;

    const { data: updated, error: updateErr } = await sb
      .from('landlords')
      .update({
        full_name: data.fullName,
        company_name: data.companyName || null,
        email: data.email,
        phone: data.phone,
        address: data.address,
        tax_id: data.taxId || null,
        iban: data.iban || null,
        commission_rate: Number(data.commissionRate ?? 8),
        contract_header_note: data.contractHeaderNote || null,
        portal_username: resolvedUsername,
        portal_password: resolvedPassword,
        portal_enabled: resolvedEnabled,
      })
      .eq('id', landlordId)
      .select('*')
      .single();

    if (updateErr) throw updateErr;
    return mapLandlordRow(updated);
  } catch (error) {
    console.error('Supabase query failed in updateLandlordRecord:', error);
    throw new Error('Impossible de modifier le bailleur.', { cause: error });
  }
}

export async function updateTenantAndLeaseRecord(
  leaseId: number,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneWhatsapp: string;
    nationalIdNumber: string;
    profession?: string;
    employer?: string;
    guarantorName?: string;
    guarantorPhone?: string;
    propertyId: number;
    startDate: string;
    endDate: string;
    rentAmount: string;
    chargesAmount: string;
    securityDeposit: string;
    paymentDueDay: number;
    customClauses?: string;
    status: string;
  }
) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error: leaseFindErr } = await sb
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .maybeSingle();
    if (leaseFindErr) throw leaseFindErr;
    if (!leaseRow) throw new Error('Contrat de bail introuvable');
    const currentLease = mapLeaseRow(leaseRow);

    const { data: propRow, error: propFindErr } = await sb
      .from('properties')
      .select('*')
      .eq('id', data.propertyId)
      .maybeSingle();
    if (propFindErr) throw propFindErr;
    if (!propRow) throw new Error('Bien immobilier introuvable');
    const property = mapPropertyRow(propRow);

    const { data: updatedTenant, error: tenantErr } = await sb
      .from('tenants')
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone_whatsapp: data.phoneWhatsapp,
        national_id_number: data.nationalIdNumber,
        profession: data.profession || null,
        employer: data.employer || null,
        guarantor_name: data.guarantorName || null,
        guarantor_phone: data.guarantorPhone || null,
      })
      .eq('id', currentLease.tenantId)
      .select('*')
      .single();
    if (tenantErr) throw tenantErr;

    const { data: updatedLease, error: leaseUpdErr } = await sb
      .from('leases')
      .update({
        landlord_id: property.landlordId,
        property_id: property.id,
        start_date: data.startDate,
        end_date: data.endDate,
        rent_amount: Number(data.rentAmount),
        charges_amount: Number(data.chargesAmount || 0),
        security_deposit: Number(data.securityDeposit),
        payment_due_day: Number(data.paymentDueDay),
        custom_clauses: data.customClauses || null,
        status: data.status,
      })
      .eq('id', leaseId)
      .select('*')
      .single();
    if (leaseUpdErr) throw leaseUpdErr;

    return {
      tenant: mapTenantRow(updatedTenant),
      lease: mapLeaseRow(updatedLease),
    };
  } catch (error) {
    console.error('Supabase query failed in updateTenantAndLeaseRecord:', error);
    throw new Error('Impossible de modifier le dossier locataire et bail.', {
      cause: error,
    });
  }
}

export async function updatePaymentRecord(
  paymentId: number,
  data: {
    periodLabel: string;
    amountDue: string;
    amountPaid: string;
    dueDate: string;
    paymentDate: string | null;
    paymentMethod: string | null;
    status: string;
    daysLate: number;
  }
) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: updated, error } = await sb
      .from('payments')
      .update({
        period_label: data.periodLabel,
        amount_due: Number(data.amountDue),
        amount_paid: Number(data.amountPaid || 0),
        due_date: data.dueDate,
        payment_date: data.paymentDate || null,
        payment_method: data.paymentMethod || null,
        status: data.status,
        days_late: Number(data.daysLate || 0),
      })
      .eq('id', paymentId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      throw new Error('Quittance introuvable');
    }
    return mapPaymentRow(updated);
  } catch (error) {
    console.error('Supabase query failed in updatePaymentRecord:', error);
    throw new Error('Impossible de modifier la quittance.', { cause: error });
  }
}

export async function createPaymentRecord(data: {
  userId: string;
  leaseId: number;
  periodMonth: string;
  periodLabel: string;
  amountDue: string;
  amountPaid: string;
  dueDate: string;
  paymentDate: string | null;
  paymentMethod: string | null;
  status: string;
  daysLate: number;
}) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: leaseRow, error: leaseErr } = await sb
      .from('leases')
      .select('*')
      .eq('id', data.leaseId)
      .maybeSingle();
    if (leaseErr) throw leaseErr;
    if (!leaseRow) {
      throw new Error('Contrat de bail introuvable pour cette quittance');
    }
    const lease = mapLeaseRow(leaseRow);

    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const cleanPeriod = (data.periodMonth || '2026-11').replace('-', '');
    const receiptNumber = `QUIT-${cleanPeriod}-${randSuffix}`;
    const shareToken = `tok-quit-${Date.now()}-${randSuffix}`;

    const { data: inserted, error: insertErr } = await sb
      .from('payments')
      .insert({
        user_id: data.userId,
        receipt_number: receiptNumber,
        lease_id: lease.id,
        landlord_id: lease.landlordId,
        property_id: lease.propertyId,
        tenant_id: lease.tenantId,
        period_month: data.periodMonth || '2026-11',
        period_label: data.periodLabel,
        amount_due: Number(data.amountDue),
        amount_paid: Number(data.amountPaid || 0),
        due_date: data.dueDate,
        payment_date: data.paymentDate || null,
        payment_method: data.paymentMethod || null,
        status: data.status,
        days_late: Number(data.daysLate || 0),
        whatsapp_sent: false,
        share_token: shareToken,
      })
      .select('*')
      .single();
    if (insertErr) throw insertErr;

    return mapPaymentRow(inserted);
  } catch (error) {
    console.error('Supabase query failed in createPaymentRecord:', error);
    throw new Error('Impossible de créer la quittance.', { cause: error });
  }
}

export async function generateRentCallsForMonthRecord(data: {
  userId: string;
  periodMonth: string;
  periodLabel: string;
  defaultDueDay: number;
  initialStatus?: 'pending' | 'paid' | 'overdue';
}) {
  try {
    const sb = requireSupabaseAdmin();
    const [leasesRes, paymentsRes] = await Promise.all([
      sb.from('leases').select('*'),
      sb.from('payments').select('*').eq('period_month', data.periodMonth),
    ]);
    if (leasesRes.error) throw leasesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const allLeases = (leasesRes.data || []).map(mapLeaseRow);
    const existingPayments = (paymentsRes.data || []).map(mapPaymentRow);

    const activeLeases = allLeases.filter((l) => l.status === 'active');
    const existingLeaseIds = new Set(existingPayments.map((p) => p.leaseId));
    const missingLeases = activeLeases.filter(
      (l) => !existingLeaseIds.has(l.id)
    );

    if (missingLeases.length === 0) {
      return [];
    }

    const cleanPeriod = (data.periodMonth || '2026-12').replace('-', '');
    const dayStr = String(data.defaultDueDay || 5).padStart(2, '0');
    const dueDate = `${data.periodMonth}-${dayStr}`;
    const status = data.initialStatus || 'pending';
    const todayStr = new Date().toISOString().split('T')[0];

    const valuesToInsert = missingLeases.map((lease, idx) => {
      const randSuffix = Math.floor(1000 + Math.random() * 9000) + idx;
      const totalDue =
        Number(lease.rentAmount || 0) + Number(lease.chargesAmount || 0);
      return {
        user_id: data.userId,
        receipt_number: `QUIT-${cleanPeriod}-${randSuffix}`,
        lease_id: lease.id,
        landlord_id: lease.landlordId,
        property_id: lease.propertyId,
        tenant_id: lease.tenantId,
        period_month: data.periodMonth,
        period_label: data.periodLabel,
        amount_due: totalDue,
        amount_paid: status === 'paid' ? totalDue : 0,
        due_date: dueDate,
        payment_date: status === 'paid' ? todayStr : null,
        payment_method: status === 'paid' ? 'Mobile Money' : null,
        status,
        days_late: 0,
        whatsapp_sent: false,
        share_token: `tok-quit-${Date.now()}-${randSuffix}`,
      };
    });

    const { data: inserted, error: insertErr } = await sb
      .from('payments')
      .insert(valuesToInsert)
      .select('*');
    if (insertErr) throw insertErr;

    return (inserted || []).map(mapPaymentRow);
  } catch (error) {
    console.error(
      'Supabase query failed in generateRentCallsForMonthRecord:',
      error
    );
    throw new Error('Impossible de générer les appels de loyer du mois.', {
      cause: error,
    });
  }
}

export async function deletePaymentRecord(paymentId: number) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: deleted, error } = await sb
      .from('payments')
      .delete()
      .eq('id', paymentId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return deleted ? mapPaymentRow(deleted) : null;
  } catch (error) {
    console.error('Supabase query failed in deletePaymentRecord:', error);
    throw new Error('Impossible de supprimer la quittance.', { cause: error });
  }
}

export async function deleteLeaseRecord(leaseId: number) {
  try {
    const sb = requireSupabaseAdmin();
    const { data: targetRow } = await sb
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .maybeSingle();
    const targetLease = targetRow ? mapLeaseRow(targetRow) : null;

    await sb.from('payments').delete().eq('lease_id', leaseId);
    const { data: deleted, error } = await sb
      .from('leases')
      .delete()
      .eq('id', leaseId)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    if (targetLease) {
      const { data: remainingForProp } = await sb
        .from('leases')
        .select('id')
        .eq('property_id', targetLease.propertyId);
      if (!remainingForProp || remainingForProp.length === 0) {
        await sb
          .from('properties')
          .update({ status: 'vacant' })
          .eq('id', targetLease.propertyId);
      }

      const { data: remainingForTenant } = await sb
        .from('leases')
        .select('id')
        .eq('tenant_id', targetLease.tenantId);
      if (!remainingForTenant || remainingForTenant.length === 0) {
        await sb.from('tenants').delete().eq('id', targetLease.tenantId);
      }
    }

    return deleted ? mapLeaseRow(deleted) : null;
  } catch (error) {
    console.error('Supabase query failed in deleteLeaseRecord:', error);
    throw new Error('Impossible de supprimer le contrat de bail.', {
      cause: error,
    });
  }
}

export async function deletePropertyRecord(propertyId: number) {
  try {
    const sb = requireSupabaseAdmin();
    await sb.from('payments').delete().eq('property_id', propertyId);
    await sb.from('leases').delete().eq('property_id', propertyId);
    const { data: deleted, error } = await sb
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return deleted ? mapPropertyRow(deleted) : null;
  } catch (error) {
    console.error('Supabase query failed in deletePropertyRecord:', error);
    throw new Error('Impossible de supprimer le bien immobilier.', {
      cause: error,
    });
  }
}

export async function deleteLandlordRecord(landlordId: number) {
  try {
    const sb = requireSupabaseAdmin();
    await sb.from('payments').delete().eq('landlord_id', landlordId);
    await sb.from('leases').delete().eq('landlord_id', landlordId);
    await sb.from('properties').delete().eq('landlord_id', landlordId);
    const { data: deleted, error } = await sb
      .from('landlords')
      .delete()
      .eq('id', landlordId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return deleted ? mapLandlordRow(deleted) : null;
  } catch (error) {
    console.error('Supabase query failed in deleteLandlordRecord:', error);
    throw new Error('Impossible de supprimer le bailleur.', { cause: error });
  }
}

export async function renamePropertyTypeInRecords(
  oldTypeName: string,
  newTypeName: string
) {
  try {
    if (!oldTypeName || !newTypeName || oldTypeName === newTypeName) {
      return [];
    }
    const sb = requireSupabaseAdmin();
    const { data: updated, error } = await sb
      .from('properties')
      .update({ property_type: newTypeName })
      .eq('property_type', oldTypeName)
      .select('*');
    if (error) throw error;
    return (updated || []).map(mapPropertyRow);
  } catch (error) {
    console.error(
      'Supabase query failed in renamePropertyTypeInRecords:',
      error
    );
    throw new Error(
      'Impossible de renommer le type de bien sur les lots existants.',
      { cause: error }
    );
  }
}

export async function upsertLandlordPortalCredentialsRecord(
  landlordId: number,
  options: {
    portalUsername?: string;
    portalPassword?: string;
    portalEnabled?: boolean;
    regeneratePassword?: boolean;
  }
) {
  const sb = requireSupabaseAdmin();
  const { data: existingRow, error: fetchErr } = await sb
    .from('landlords')
    .select('*')
    .eq('id', landlordId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existingRow) {
    throw new Error('Bailleur introuvable.');
  }
  const existing = mapLandlordRow(existingRow);

  const nextUsername =
    options.portalUsername && options.portalUsername.trim()
      ? options.portalUsername.trim()
      : existing.portalUsername ||
        deriveDefaultLandlordUsername({
          email: existing.email,
          phone: existing.phone,
          fullName: existing.fullName,
        });

  const nextPassword = options.regeneratePassword
    ? generateLandlordPortalPassword()
    : options.portalPassword && options.portalPassword.trim()
      ? options.portalPassword.trim()
      : existing.portalPassword || generateLandlordPortalPassword();

  const nextEnabled =
    options.portalEnabled !== undefined
      ? Boolean(options.portalEnabled)
      : existing.portalEnabled ?? true;

  const { data: updated, error: updateErr } = await sb
    .from('landlords')
    .update({
      portal_username: nextUsername,
      portal_password: nextPassword,
      portal_enabled: nextEnabled,
    })
    .eq('id', landlordId)
    .select('*')
    .single();
  if (updateErr) throw updateErr;

  return mapLandlordRow(updated);
}

export async function authenticateLandlordPortalRecord(
  identifier: string,
  password: string,
  explicitLandlordId?: number
) {
  const cleanId = (identifier || '').trim().toLowerCase();
  const idDigits = (identifier || '').replace(/\D+/g, '');
  const cleanPass = (password || '').trim();

  if ((!cleanId && !explicitLandlordId) || !cleanPass) {
    throw new Error(
      'Veuillez saisir votre compte (identifiant, email ou téléphone) et votre mot de passe.'
    );
  }

  const sb = requireSupabaseAdmin();
  const query = explicitLandlordId
    ? sb.from('landlords').select('*').eq('id', explicitLandlordId)
    : sb.from('landlords').select('*');
  const { data: rows, error: listErr } = await query;
  if (listErr) throw listErr;

  const allLandlords = (rows || []).map(mapLandlordRow);

  const candidates = allLandlords.filter((l) => {
    if (explicitLandlordId && l.id === explicitLandlordId) {
      return true;
    }
    const uName = (l.portalUsername || '').trim().toLowerCase();
    const uMail = (l.email || '').trim().toLowerCase();
    const lDigits = (l.phone || '').replace(/\D+/g, '');
    const phoneMatch =
      idDigits.length >= 8 &&
      lDigits.length >= 8 &&
      (lDigits === idDigits ||
        lDigits.endsWith(idDigits) ||
        idDigits.endsWith(lDigits));

    return (
      (uName && uName === cleanId) ||
      (uMail && uMail === cleanId) ||
      phoneMatch
    );
  });

  if (candidates.length === 0) {
    throw new Error(
      'Aucun compte bailleur trouvé pour cet identifiant. Vérifiez les accès reçus par WhatsApp.'
    );
  }

  const enabledCandidates = candidates.filter((c) => c.portalEnabled !== false);
  if (enabledCandidates.length === 0) {
    throw new Error(
      'L’accès au Portail Bailleur pour ce compte est actuellement désactivé par votre agence.'
    );
  }

  const withPasswordCandidates = enabledCandidates.filter((c) =>
    Boolean((c.portalPassword || '').trim())
  );
  if (withPasswordCandidates.length === 0) {
    throw new Error(
      'Aucun mot de passe portail n’a encore été activé pour ce compte. Demandez vos accès WhatsApp à votre agence.'
    );
  }

  const matched = withPasswordCandidates.find((c) => {
    const storedPass = (c.portalPassword || '').trim();
    const isGeneratedCode = storedPass.toUpperCase().startsWith('GIM-');
    return isGeneratedCode
      ? storedPass.toUpperCase() === cleanPass.toUpperCase()
      : storedPass === cleanPass;
  });

  if (!matched) {
    throw new Error(
      'Mot de passe incorrect. Veuillez vérifier le code reçu sur WhatsApp.'
    );
  }

  const [updatedRes, propsRes, leasesRes, paysRes] = await Promise.all([
    sb
      .from('landlords')
      .update({ portal_last_login_at: new Date().toISOString() })
      .eq('id', matched.id)
      .select('*')
      .maybeSingle(),
    sb
      .from('properties')
      .select('*')
      .eq('landlord_id', matched.id)
      .order('id', { ascending: false }),
    sb
      .from('leases')
      .select('*')
      .eq('landlord_id', matched.id)
      .order('id', { ascending: false }),
    sb
      .from('payments')
      .select('*')
      .eq('landlord_id', matched.id)
      .order('id', { ascending: false }),
  ]);

  const landlordProperties = (propsRes.data || []).map(mapPropertyRow);
  const landlordLeases = (leasesRes.data || []).map(mapLeaseRow);
  const landlordPayments = (paysRes.data || []).map(mapPaymentRow);

  const tenantIds = Array.from(
    new Set([
      ...landlordLeases.map((l) => l.tenantId),
      ...landlordPayments.map((p) => p.tenantId),
    ])
  );

  let landlordTenants: ReturnType<typeof mapTenantRow>[] = [];
  if (tenantIds.length > 0) {
    const { data: tRows } = await sb
      .from('tenants')
      .select('*')
      .in('id', tenantIds);
    landlordTenants = (tRows || []).map(mapTenantRow);
  }

  return {
    landlord: updatedRes.data ? mapLandlordRow(updatedRes.data) : matched,
    properties: landlordProperties,
    leases: landlordLeases,
    tenants: landlordTenants,
    payments: landlordPayments,
  };
}
