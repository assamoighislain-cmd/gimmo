import {
  Landlord,
  Property,
  Tenant,
  Lease,
  Payment,
  AppUser,
} from '../types/gimmo.ts';
import {
  DocumentTemplatesStore,
  createInitialTemplatesStore,
} from './document-templates.ts';
import { normalizeUserRole } from './rbac.ts';

const OFFLINE_CACHE_KEY = 'gimmo_offline_cache_v1';
const OFFLINE_QUEUE_KEY = 'gimmo_offline_queue_v1';

export interface GimmoOverviewSnapshot {
  landlords: Landlord[];
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  payments: Payment[];
  users?: AppUser[];
  templates?: DocumentTemplatesStore;
  lastSyncedAt: string;
}

export interface QueuedOfflineMutation {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: Record<string, any>;
  description: string;
  createdAt: string;
}

export function saveOfflineSnapshot(data: {
  landlords: Landlord[];
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  payments: Payment[];
  users?: AppUser[];
  templates?: DocumentTemplatesStore;
}): GimmoOverviewSnapshot {
  const existing = loadOfflineSnapshot();
  const snapshot: GimmoOverviewSnapshot = {
    ...data,
    users: data.users || existing?.users || [],
    templates:
      data.templates || existing?.templates || createInitialTemplatesStore(),
    lastSyncedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('Unable to save offline snapshot to localStorage:', err);
  }
  return snapshot;
}

export function loadOfflineSnapshot(): GimmoOverviewSnapshot | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GimmoOverviewSnapshot;
  } catch (err) {
    console.warn('Unable to read offline snapshot from localStorage:', err);
    return null;
  }
}

export function getOfflineQueue(): QueuedOfflineMutation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedOfflineMutation[];
  } catch {
    return [];
  }
}

export function enqueueOfflineMutation(
  mutation: Omit<QueuedOfflineMutation, 'id' | 'createdAt'>
): QueuedOfflineMutation[] {
  const current = getOfflineQueue();
  const next: QueuedOfflineMutation[] = [
    ...current,
    {
      ...mutation,
      id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    },
  ];
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Unable to enqueue offline mutation:', err);
  }
  return next;
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Applique de façon optimiste une création/modification en cache local
 * pour que l'utilisateur puisse continuer à travailler immédiatement hors-ligne.
 */
export function applyOptimisticMutationToSnapshot(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: Record<string, any>
): GimmoOverviewSnapshot | null {
  const snapshot = loadOfflineSnapshot();
  if (!snapshot) return null;

  const tempId = Math.floor(Date.now() / 1000);
  const nowIso = new Date().toISOString();

  // 1. Biens Immobiliers (POST /api/properties ou PUT /api/properties/:id)
  if (url === '/api/properties' && method === 'POST') {
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    const newProp: Property = {
      id: tempId,
      userId: 'offline_user',
      landlordId: Number(body.landlordId),
      reference: body.reference || `GIM-OFF-${tempId}`,
      title: body.title,
      propertyType: body.propertyType,
      address: body.address,
      city: body.city,
      neighborhood: body.neighborhood,
      surfaceArea: Number(body.surfaceArea),
      roomsCount: Number(body.roomsCount),
      monthlyRent: String(body.monthlyRent),
      chargesAmount: String(body.chargesAmount),
      currency: 'FCFA',
      latitude: lat,
      longitude: lng,
      postgisWkt: `SRID=4326;POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`,
      status: body.status || 'vacant',
      createdAt: nowIso,
    };
    snapshot.properties = [newProp, ...snapshot.properties];
  } else if (url.startsWith('/api/properties/') && method === 'PUT') {
    const id = Number(url.split('/').pop());
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    snapshot.properties = snapshot.properties.map((p) =>
      p.id === id
        ? {
            ...p,
            landlordId: Number(body.landlordId),
            reference: body.reference,
            title: body.title,
            propertyType: body.propertyType,
            address: body.address,
            city: body.city,
            neighborhood: body.neighborhood,
            surfaceArea: Number(body.surfaceArea),
            roomsCount: Number(body.roomsCount),
            monthlyRent: String(body.monthlyRent),
            chargesAmount: String(body.chargesAmount),
            latitude: lat,
            longitude: lng,
            postgisWkt: `SRID=4326;POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`,
            status: body.status,
          }
        : p
    );
  }

  // 2. Bailleurs (POST /api/landlords ou PUT /api/landlords/:id)
  else if (url === '/api/landlords' && method === 'POST') {
    const newLandlord: Landlord = {
      id: tempId,
      userId: 'offline_user',
      fullName: body.fullName,
      companyName: body.companyName || null,
      email: body.email,
      phone: body.phone,
      address: body.address,
      taxId: body.taxId || null,
      iban: body.taxId || body.iban || null,
      commissionRate: Number(body.commissionRate),
      contractHeaderNote: body.contractHeaderNote || null,
      createdAt: nowIso,
    };
    snapshot.landlords = [...snapshot.landlords, newLandlord];
  } else if (url.startsWith('/api/landlords/') && method === 'PUT') {
    const id = Number(url.split('/').pop());
    snapshot.landlords = snapshot.landlords.map((l) =>
      l.id === id
        ? {
            ...l,
            fullName: body.fullName,
            companyName: body.companyName || null,
            email: body.email,
            phone: body.phone,
            address: body.address,
            taxId: body.taxId || null,
            iban: body.iban || null,
            commissionRate: Number(body.commissionRate),
            contractHeaderNote: body.contractHeaderNote || null,
          }
        : l
    );
  }

  // 3. Dossiers Locataires & Baux (POST /api/tenants-leases ou PUT /api/tenants-leases/:id)
  else if (url === '/api/tenants-leases' && method === 'POST') {
    const newTenantId = tempId;
    const prop = snapshot.properties.find((p) => p.id === Number(body.propertyId));
    const newTenant: Tenant = {
      id: newTenantId,
      userId: 'offline_user',
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phoneWhatsapp: body.phoneWhatsapp,
      nationalIdNumber: body.nationalIdNumber,
      profession: body.profession || null,
      employer: body.employer || null,
      monthlyIncome: '1500000',
      guarantorName: body.guarantorName || null,
      guarantorPhone: body.guarantorPhone || null,
      dossierStatus: 'verified',
      createdAt: nowIso,
    };
    const newLease: Lease = {
      id: tempId + 1,
      userId: 'offline_user',
      contractNumber: `BAIL-2026-OFF-${String(tempId).slice(-3)}`,
      landlordId: prop?.landlordId || snapshot.landlords[0]?.id || 1,
      propertyId: Number(body.propertyId),
      tenantId: newTenantId,
      startDate: body.startDate,
      endDate: body.endDate || null,
      rentAmount: String(body.rentAmount || prop?.monthlyRent || '0'),
      chargesAmount: String(body.chargesAmount || prop?.chargesAmount || '0'),
      securityDeposit: String(body.securityDeposit || '0'),
      paymentDueDay: Number(body.paymentDueDay || 5),
      customClauses: body.customClauses || null,
      status: 'active',
      shareToken: `offline_lease_${tempId}`,
      createdAt: nowIso,
    };
    snapshot.tenants = [...snapshot.tenants, newTenant];
    snapshot.leases = [newLease, ...snapshot.leases];
  } else if (url.startsWith('/api/tenants-leases/') && method === 'PUT') {
    const leaseId = Number(url.split('/').pop());
    const existingLease = snapshot.leases.find((l) => l.id === leaseId);
    const prop = snapshot.properties.find((p) => p.id === Number(body.propertyId));
    if (existingLease) {
      snapshot.tenants = snapshot.tenants.map((t) =>
        t.id === existingLease.tenantId
          ? {
              ...t,
              firstName: body.firstName,
              lastName: body.lastName,
              email: body.email,
              phoneWhatsapp: body.phoneWhatsapp,
              nationalIdNumber: body.nationalIdNumber,
              profession: body.profession || null,
              employer: body.employer || null,
              guarantorName: body.guarantorName || null,
              guarantorPhone: body.guarantorPhone || null,
            }
          : t
      );
      snapshot.leases = snapshot.leases.map((l) =>
        l.id === leaseId
          ? {
              ...l,
              propertyId: Number(body.propertyId),
              landlordId: prop?.landlordId || l.landlordId,
              startDate: body.startDate,
              endDate: body.endDate || null,
              rentAmount: String(body.rentAmount),
              chargesAmount: String(body.chargesAmount || '0'),
              securityDeposit: String(body.securityDeposit),
              paymentDueDay: Number(body.paymentDueDay || 5),
              customClauses: body.customClauses || null,
              status: (body.status || 'active') as Lease['status'],
            }
          : l
      );
    }
  }

  // 4. Quittances & Règlements (POST /api/payments, PUT /api/payments/:id, POST /api/payments/:id/settle)
  else if (url === '/api/payments' && method === 'POST') {
    const lease = snapshot.leases.find((l) => l.id === Number(body.leaseId));
    if (lease) {
      const newPayment: Payment = {
        id: tempId,
        userId: 'offline_user',
        receiptNumber: `QUIT-${(body.periodMonth || '2026-11').replace('-', '')}-OFF${String(tempId).slice(-3)}`,
        leaseId: lease.id,
        landlordId: lease.landlordId,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        periodMonth: body.periodMonth,
        periodLabel: body.periodLabel,
        amountDue: String(body.amountDue),
        amountPaid: String(body.amountPaid),
        dueDate: body.dueDate,
        paymentDate: body.paymentDate || null,
        paymentMethod: body.paymentMethod || null,
        status: (body.status || 'paid') as Payment['status'],
        daysLate: Number(body.daysLate || 0),
        whatsappSent: false,
        shareToken: `offline_quit_${tempId}`,
        createdAt: nowIso,
      };
      snapshot.payments = [newPayment, ...snapshot.payments];
    }
  } else if (url.endsWith('/settle') && method === 'POST') {
    const parts = url.split('/');
    const paymentId = Number(parts[parts.length - 2]);
    const today = new Date().toISOString().split('T')[0];
    snapshot.payments = snapshot.payments.map((p) =>
      p.id === paymentId
        ? {
            ...p,
            amountPaid: p.amountDue,
            paymentDate: today,
            paymentMethod: body.paymentMethod || 'Mobile Money',
            status: 'paid',
            daysLate: 0,
          }
        : p
    );
  } else if (url.startsWith('/api/payments/') && method === 'PUT') {
    const paymentId = Number(url.split('/').pop());
    snapshot.payments = snapshot.payments.map((p) =>
      p.id === paymentId
        ? {
            ...p,
            periodLabel: body.periodLabel,
            amountDue: String(body.amountDue),
            amountPaid: String(body.amountPaid),
            dueDate: body.dueDate,
            paymentDate: body.paymentDate || null,
            paymentMethod: body.paymentMethod || null,
            status: (body.status || p.status) as Payment['status'],
            daysLate: Number(body.daysLate || 0),
          }
        : p
    );
  } else if (url === '/api/templates' && method === 'PUT') {
    const store = snapshot.templates || createInitialTemplatesStore();
    if (body.kind === 'lease' && body.scopeKey && body.config) {
      store.leases = { ...store.leases, [body.scopeKey]: body.config };
    } else if (body.kind === 'receipt' && body.scopeKey && body.config) {
      store.receipts = { ...store.receipts, [body.scopeKey]: body.config };
    }
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url === '/api/accounting-months' && method === 'POST') {
    const store = snapshot.templates || createInitialTemplatesStore();
    const currentMonths = store.accountingMonths || [];
    const existingIdx = currentMonths.findIndex(
      (m) => m.periodMonth === body.periodMonth
    );
    const makeCurrent = Boolean(body.isCurrent);

    if (existingIdx >= 0) {
      store.accountingMonths = currentMonths.map((m, idx) => {
        const isTarget = idx === existingIdx;
        const nextIsCurrent =
          body.isCurrent !== undefined
            ? isTarget
              ? makeCurrent
              : makeCurrent
                ? false
                : m.isCurrent
            : m.isCurrent;
        if (!isTarget) return { ...m, isCurrent: nextIsCurrent };
        return {
          ...m,
          periodLabel: body.periodLabel || m.periodLabel,
          defaultDueDay: Number(body.defaultDueDay ?? m.defaultDueDay ?? 5),
          status: body.status || m.status,
          isCurrent: nextIsCurrent,
        };
      });
    } else {
      store.accountingMonths = [
        {
          periodMonth: body.periodMonth,
          periodLabel: body.periodLabel,
          defaultDueDay: Number(body.defaultDueDay || 5),
          status: body.status || 'open',
          isCurrent: makeCurrent,
          createdAt: nowIso,
        },
        ...currentMonths.map((m) => ({
          ...m,
          isCurrent: makeCurrent ? false : m.isCurrent,
        })),
      ].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));
    }
    store.updatedAt = nowIso;
    snapshot.templates = store;

    if (body.autoGenerateRentCalls) {
      const activeLeases = snapshot.leases.filter((l) => l.status === 'active');
      const existingLeaseIds = new Set(
        snapshot.payments
          .filter((p) => p.periodMonth === body.periodMonth)
          .map((p) => p.leaseId)
      );
      const dayStr = String(body.defaultDueDay || 5).padStart(2, '0');
      const dueDate = `${body.periodMonth}-${dayStr}`;
      const cleanPeriod = (body.periodMonth || '2026-12').replace('-', '');
      const initStatus = (body.initialStatus || 'pending') as Payment['status'];
      const todayStr = nowIso.split('T')[0];

      const newCalls: Payment[] = activeLeases
        .filter((l) => !existingLeaseIds.has(l.id))
        .map((lease, idx) => {
          const totalDue = String(
            Number(lease.rentAmount || 0) + Number(lease.chargesAmount || 0)
          );
          return {
            id: tempId + idx + 10,
            userId: 'offline_user',
            receiptNumber: `QUIT-${cleanPeriod}-OFF${idx + 1}`,
            leaseId: lease.id,
            landlordId: lease.landlordId,
            propertyId: lease.propertyId,
            tenantId: lease.tenantId,
            periodMonth: body.periodMonth,
            periodLabel: body.periodLabel,
            amountDue: totalDue,
            amountPaid: initStatus === 'paid' ? totalDue : '0',
            dueDate,
            paymentDate: initStatus === 'paid' ? todayStr : null,
            paymentMethod: initStatus === 'paid' ? 'Mobile Money' : null,
            status: initStatus,
            daysLate: 0,
            whatsappSent: false,
            shareToken: `offline_quit_${tempId}_${idx}`,
            createdAt: nowIso,
          };
        });
      if (newCalls.length > 0) {
        snapshot.payments = [...newCalls, ...snapshot.payments];
      }
    }
  } else if (url.startsWith('/api/properties/') && method === 'DELETE') {
    const propertyId = Number(url.split('/').pop());
    snapshot.payments = snapshot.payments.filter(
      (p) => p.propertyId !== propertyId
    );
    snapshot.leases = snapshot.leases.filter(
      (l) => l.propertyId !== propertyId
    );
    snapshot.properties = snapshot.properties.filter(
      (p) => p.id !== propertyId
    );
  } else if (url.startsWith('/api/landlords/') && method === 'DELETE') {
    const landlordId = Number(url.split('/').pop());
    snapshot.payments = snapshot.payments.filter(
      (p) => p.landlordId !== landlordId
    );
    snapshot.leases = snapshot.leases.filter(
      (l) => l.landlordId !== landlordId
    );
    snapshot.properties = snapshot.properties.filter(
      (p) => p.landlordId !== landlordId
    );
    snapshot.landlords = snapshot.landlords.filter((l) => l.id !== landlordId);
  } else if (url.startsWith('/api/tenants-leases/') && method === 'DELETE') {
    const leaseId = Number(url.split('/').pop());
    const targetLease = snapshot.leases.find((l) => l.id === leaseId);
    snapshot.payments = snapshot.payments.filter((p) => p.leaseId !== leaseId);
    snapshot.leases = snapshot.leases.filter((l) => l.id !== leaseId);
    if (targetLease) {
      const stillOccupied = snapshot.leases.some(
        (l) => l.propertyId === targetLease.propertyId
      );
      if (!stillOccupied) {
        snapshot.properties = snapshot.properties.map((p) =>
          p.id === targetLease.propertyId ? { ...p, status: 'vacant' } : p
        );
      }
      const tenantHasOtherLeases = snapshot.leases.some(
        (l) => l.tenantId === targetLease.tenantId
      );
      if (!tenantHasOtherLeases) {
        snapshot.tenants = snapshot.tenants.filter(
          (t) => t.id !== targetLease.tenantId
        );
      }
    }
  } else if (url.startsWith('/api/payments/') && method === 'DELETE') {
    const paymentId = Number(url.split('/').pop());
    snapshot.payments = snapshot.payments.filter((p) => p.id !== paymentId);
  } else if (url.startsWith('/api/accounting-months/') && method === 'DELETE') {
    const periodMonth = decodeURIComponent(url.split('/').pop() || '');
    const store = snapshot.templates || createInitialTemplatesStore();
    let updatedList = (store.accountingMonths || []).filter(
      (m) => m.periodMonth !== periodMonth
    );
    if (updatedList.length > 0 && !updatedList.some((m) => m.isCurrent)) {
      updatedList[0] = { ...updatedList[0], isCurrent: true };
    }
    store.accountingMonths = updatedList;
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url === '/api/property-types' && method === 'POST') {
    const store = snapshot.templates || createInitialTemplatesStore();
    const currentList = store.propertyTypes || [];
    const targetId = body.id || '';
    const trimmedName = String(body.name || '').trim();
    const existingIdx = currentList.findIndex(
      (item) =>
        (targetId && item.id === targetId) ||
        (!targetId && item.name.toLowerCase() === trimmedName.toLowerCase())
    );

    if (existingIdx >= 0) {
      store.propertyTypes = currentList.map((item, idx) => {
        if (idx !== existingIdx) return item;
        return {
          ...item,
          name: trimmedName,
          code: (body.code || item.code || trimmedName.slice(0, 4)).toUpperCase(),
          category: body.category || item.category || 'habitation',
          defaultCharges: String(body.defaultCharges ?? item.defaultCharges ?? '0'),
          description: body.description ?? item.description ?? '',
        };
      });
    } else {
      store.propertyTypes = [
        ...currentList,
        {
          id: targetId || `type_off_${tempId}`,
          name: trimmedName,
          code: (body.code || trimmedName.slice(0, 4)).toUpperCase(),
          category: body.category || 'habitation',
          defaultCharges: String(body.defaultCharges || '35000'),
          description:
            body.description ||
            'Type de bien immobilier configuré dans le paramétrage Gimmo',
          createdAt: nowIso,
        },
      ];
    }

    if (body.previousName && body.previousName !== trimmedName) {
      snapshot.properties = snapshot.properties.map((p) =>
        p.propertyType === body.previousName
          ? { ...p, propertyType: trimmedName }
          : p
      );
    }

    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url.startsWith('/api/property-types/') && method === 'DELETE') {
    const id = decodeURIComponent(url.split('/').pop() || '');
    const store = snapshot.templates || createInitialTemplatesStore();
    store.propertyTypes = (store.propertyTypes || []).filter(
      (item) => item.id !== id
    );
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url === '/api/management-company' && method === 'PUT') {
    const store = snapshot.templates || createInitialTemplatesStore();
    const existing = store.managementCompany || createInitialTemplatesStore().managementCompany!;
    const updatedProfile = {
      ...existing,
      ...body,
      updatedAt: nowIso,
    };
    store.managementCompany = updatedProfile;
    if (store.saasTenants) {
      store.saasTenants = store.saasTenants.map((t) =>
        t.isCurrentTenant
          ? {
              ...t,
              companyName: updatedProfile.companyName,
              tradeName: updatedProfile.tradeName,
              legalForm: updatedProfile.legalForm,
              rccm: updatedProfile.rccm,
              taxId: updatedProfile.taxId,
              licenseNumber: updatedProfile.licenseNumber,
              managerName: updatedProfile.managerName,
              phone: updatedProfile.phone,
              address: updatedProfile.address,
              city: updatedProfile.city,
            }
          : t
      );
    }
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url === '/api/saas/tenants' && method === 'POST') {
    const store = snapshot.templates || createInitialTemplatesStore();
    const currentList = store.saasTenants || [];
    const targetId = body.id || '';
    const makeCurrent = Boolean(body.isCurrentTenant);
    const existingIdx = currentList.findIndex((t) => targetId && t.id === targetId);

    if (existingIdx >= 0) {
      store.saasTenants = currentList.map((item, idx) => {
        if (idx !== existingIdx) {
          return makeCurrent ? { ...item, isCurrentTenant: false } : item;
        }
        return {
          ...item,
          ...body,
          isCurrentTenant: makeCurrent ? true : item.isCurrentTenant,
        };
      });
    } else {
      const newTenant = {
        id: targetId || `tenant_off_${tempId}`,
        companyName: body.companyName || 'Nouvelle Agence SaaS',
        tradeName: body.tradeName || body.companyName || 'Agence',
        legalForm: body.legalForm || 'SARL au capital de 5 000 000 FCFA',
        rccm: body.rccm || 'CI-ABJ-03-2026-B12-00100',
        taxId: body.taxId || 'CC 2600100 A',
        licenseNumber: body.licenseNumber || 'Agrément MCLU N° 2026/AG',
        managerName: body.managerName || 'Gérant Mandataire',
        ownerEmail: body.ownerEmail || 'direction@agence.ci',
        phone: body.whatsappPhone || body.phone || '+225 07 00 00 00 00',
        whatsappPhone: body.whatsappPhone || body.phone || '+225 07 00 00 00 00',
        address: body.address || 'Abidjan Cocody',
        city: body.city || 'Abidjan',
        plan: body.plan || 'pro',
        status: body.status || 'pending_approval',
        monthlyFeeFcfa: Number(body.monthlyFeeFcfa ?? 75000),
        maxProperties: Number(body.maxProperties ?? 150),
        maxLandlords: Number(body.maxLandlords ?? 35),
        subscriptionEndsAt: body.subscriptionEndsAt || '2027-12-31',
        isCurrentTenant: makeCurrent,
        createdAt: nowIso,
      };
      store.saasTenants = [
        ...(makeCurrent
          ? currentList.map((t) => ({ ...t, isCurrentTenant: false }))
          : currentList),
        newTenant,
      ];
    }

    if (makeCurrent && store.saasTenants) {
      const active = store.saasTenants.find((t) => t.isCurrentTenant);
      if (active && store.managementCompany) {
        store.managementCompany = {
          ...store.managementCompany,
          companyName: active.companyName,
          tradeName: active.tradeName,
          legalForm: active.legalForm,
          rccm: active.rccm,
          taxId: active.taxId,
          licenseNumber: active.licenseNumber,
          managerName: active.managerName,
          address: active.address,
          city: active.city,
          phone: active.phone,
          email: active.ownerEmail,
          updatedAt: nowIso,
        };
      }
    }
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url.startsWith('/api/saas/tenants/') && method === 'DELETE') {
    const id = decodeURIComponent(url.split('/').pop() || '');
    const store = snapshot.templates || createInitialTemplatesStore();
    store.saasTenants = (store.saasTenants || []).filter((t) => t.id !== id);
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url === '/api/saas/users' && method === 'POST') {
    const store = snapshot.templates || createInitialTemplatesStore();
    const currentList = store.saasUsers || [];
    const tenants = store.saasTenants || [];
    const targetId = body.id || '';
    const existingIdx = currentList.findIndex(
      (u) =>
        (targetId && u.id === targetId) ||
        (!targetId && u.email.toLowerCase() === String(body.email || '').trim().toLowerCase())
    );
    const matchedTenant =
      tenants.find((t) => t.id === body.tenantId) ||
      tenants.find(
        (t) =>
          body.tenantName &&
          t.companyName.trim().toLowerCase() ===
            String(body.tenantName).trim().toLowerCase()
      ) ||
      tenants.find((t) => t.isCurrentTenant) ||
      tenants[0];

    if (existingIdx >= 0) {
      store.saasUsers = currentList.map((u, idx) =>
        idx === existingIdx
          ? {
              ...u,
              ...body,
              tenantId: matchedTenant?.id || body.tenantId || u.tenantId,
              tenantName: matchedTenant?.companyName || body.tenantName || u.tenantName,
            }
          : u
      );
    } else {
      store.saasUsers = [
        ...currentList,
        {
          id: targetId || `saas_user_off_${tempId}`,
          fullName: String(body.fullName || '').trim(),
          email: String(body.email || '').trim(),
          whatsappPhone: body.whatsappPhone ? String(body.whatsappPhone).trim() : undefined,
          role: body.role || 'agency_admin',
          tenantId: matchedTenant?.id || body.tenantId || 'tenant_gimmo_prestige',
          tenantName:
            matchedTenant?.companyName ||
            body.tenantName ||
            'GIMMO PRESTIGE IMMOBILIER SARL',
          status: body.status || 'active',
          lastLoginAt: nowIso,
          createdAt: nowIso,
        },
      ];
    }
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url.startsWith('/api/saas/users/') && method === 'DELETE') {
    const id = decodeURIComponent(url.split('/').pop() || '');
    const store = snapshot.templates || createInitialTemplatesStore();
    store.saasUsers = (store.saasUsers || []).filter(
      (u) =>
        u.id !== id ||
        (u.email.toLowerCase() === 'assamoighislain@gmail.com' &&
          u.role === 'super_admin')
    );
    store.updatedAt = nowIso;
    snapshot.templates = store;
  } else if (url === '/api/users' && method === 'POST') {
    const currentUsers = snapshot.users || [];
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const cleanName = String(body.name || cleanEmail.split('@')[0]).trim();
    const cleanRole = normalizeUserRole(body.role);

    if (body.id) {
      snapshot.users = currentUsers.map((u) =>
        u.id === Number(body.id)
          ? { ...u, email: cleanEmail, name: cleanName, role: cleanRole }
          : u
      );
    } else {
      const existingIdx = currentUsers.findIndex(
        (u) => u.email.toLowerCase() === cleanEmail
      );
      if (existingIdx >= 0) {
        snapshot.users = currentUsers.map((u, idx) =>
          idx === existingIdx
            ? { ...u, name: cleanName, role: cleanRole }
            : u
        );
      } else {
        snapshot.users = [
          ...currentUsers,
          {
            id: tempId,
            uid: `gimmo-${cleanRole}-${tempId}`,
            email: cleanEmail,
            name: cleanName,
            role: cleanRole,
            createdAt: nowIso,
          },
        ];
      }
    }
  } else if (url.startsWith('/api/users/') && method === 'DELETE') {
    const userId = Number(url.split('/').pop());
    snapshot.users = (snapshot.users || []).filter((u) => u.id !== userId);
  }

  return saveOfflineSnapshot(snapshot);
}

export async function executeMutation(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: Record<string, any> = {},
  description = 'Modification Gimmo'
): Promise<{ ok: boolean; queuedOffline?: boolean; data?: any; error?: string }> {
  if (!navigator.onLine) {
    enqueueOfflineMutation({ url, method, body, description });
    applyOptimisticMutationToSnapshot(url, method, body);
    return { ok: true, queuedOffline: true };
  }

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errData.error || `Erreur HTTP ${response.status}`,
      };
    }
    const data = await response.json().catch(() => ({}));
    applyOptimisticMutationToSnapshot(url, method, body);
    return { ok: true, queuedOffline: false, data };
  } catch {
    enqueueOfflineMutation({ url, method, body, description });
    applyOptimisticMutationToSnapshot(url, method, body);
    return { ok: true, queuedOffline: true };
  }
}


