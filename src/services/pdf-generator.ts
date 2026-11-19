import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import fs from 'fs';
import path from 'path';
import type {
  AccountingMonth,
  PropertyTypeItem,
  ManagementCompanyProfile,
  SaaSTenantAgency,
  SaaSUserAccount,
} from '../types/gimmo.ts';
import {
  type DocumentTemplatesStore,
  type LeaseTemplateConfig,
  type ReceiptTemplateConfig,
  DEFAULT_ACCOUNTING_MONTHS,
  DEFAULT_PROPERTY_TYPES,
  DEFAULT_MANAGEMENT_COMPANY,
  DEFAULT_SAAS_TENANTS,
  DEFAULT_SAAS_USERS,
  createInitialTemplatesStore,
  resolveLeaseTemplate,
  resolveReceiptTemplate,
  resolveAccountingMonths,
  resolvePropertyTypes,
  resolveManagementCompany,
  resolveSaaSTenants,
  resolveSaaSUsers,
  interpolateTemplateVariables,
} from '../lib/document-templates.ts';
import { validateWhatsAppPhone } from '../lib/agency-notifications.ts';
import {
  loadAppSettingsFromSupabase,
  saveAppSettingsToSupabase,
  verifySupabaseAuthPassword,
} from '../db/supabase.ts';
import { getAllUsers, upsertUserRecord } from '../db/users.ts';

const SAAS_SETTINGS_ROW_ID = 'gimmo_saas_store';
const TEMPLATES_FILE_PATH = path.resolve(
  process.cwd(),
  '.gimmo-document-templates.json'
);

let memoryTemplatesStore: DocumentTemplatesStore | null = null;

function normalizeLoadedStore(parsed: DocumentTemplatesStore): DocumentTemplatesStore {
  if (!parsed.accountingMonths || parsed.accountingMonths.length === 0) {
    parsed.accountingMonths = [...DEFAULT_ACCOUNTING_MONTHS];
  }
  if (!parsed.propertyTypes || parsed.propertyTypes.length === 0) {
    parsed.propertyTypes = [...DEFAULT_PROPERTY_TYPES];
  }
  if (!parsed.managementCompany || !parsed.managementCompany.companyName) {
    parsed.managementCompany = { ...DEFAULT_MANAGEMENT_COMPANY };
  }
  if (!parsed.saasTenants || parsed.saasTenants.length === 0) {
    parsed.saasTenants = [...DEFAULT_SAAS_TENANTS];
  }
  if (!parsed.saasUsers || parsed.saasUsers.length === 0) {
    parsed.saasUsers = [...DEFAULT_SAAS_USERS];
  }
  return parsed;
}

export async function initTemplatesStoreFromDb(): Promise<DocumentTemplatesStore> {
  try {
    const supabaseJson = await loadAppSettingsFromSupabase(SAAS_SETTINGS_ROW_ID);
    if (supabaseJson) {
      const parsed = JSON.parse(supabaseJson) as DocumentTemplatesStore;
      if (parsed && parsed.leases && parsed.receipts) {
        memoryTemplatesStore = normalizeLoadedStore(parsed);
        return memoryTemplatesStore;
      }
    }
  } catch (err) {
    console.warn('Could not load SaaS store from Supabase app_settings:', err);
  }

  return getDocumentTemplatesStore();
}

async function persistTemplatesStore(
  next: DocumentTemplatesStore
): Promise<DocumentTemplatesStore> {
  memoryTemplatesStore = next;
  const serialized = JSON.stringify(next, null, 2);
  try {
    fs.writeFileSync(TEMPLATES_FILE_PATH, serialized, 'utf-8');
  } catch (err) {
    console.warn('Could not persist .gimmo-document-templates.json:', err);
  }
  // Persistance directe dans Supabase (table public.app_settings)
  try {
    await saveAppSettingsToSupabase(SAAS_SETTINGS_ROW_ID, serialized);
  } catch (err) {
    console.warn('Could not persist SaaS store to Supabase app_settings:', err);
  }
  return next;
}

export function getDocumentTemplatesStore(): DocumentTemplatesStore {
  if (memoryTemplatesStore) {
    return memoryTemplatesStore;
  }
  try {
    if (fs.existsSync(TEMPLATES_FILE_PATH)) {
      const raw = fs.readFileSync(TEMPLATES_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as DocumentTemplatesStore;
      if (parsed && parsed.leases && parsed.receipts) {
        memoryTemplatesStore = normalizeLoadedStore(parsed);
        return memoryTemplatesStore;
      }
    }
  } catch (err) {
    console.warn('Could not read .gimmo-document-templates.json:', err);
  }
  memoryTemplatesStore = createInitialTemplatesStore();
  return memoryTemplatesStore;
}

export async function saveDocumentTemplateEntry(payload: {
  scopeKey: string; // 'default' or 'landlord_<id>'
  kind: 'lease' | 'receipt';
  config: LeaseTemplateConfig | ReceiptTemplateConfig;
}): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: new Date().toISOString(),
  };

  if (payload.kind === 'lease') {
    next.leases[payload.scopeKey] = payload.config as LeaseTemplateConfig;
  } else {
    next.receipts[payload.scopeKey] = payload.config as ReceiptTemplateConfig;
  }

  return await persistTemplatesStore(next);
}

export async function saveManagementCompanyEntry(
  payload: Partial<ManagementCompanyProfile>
): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existing = resolveManagementCompany(current);
  const nowIso = new Date().toISOString();

  const updatedProfile: ManagementCompanyProfile = {
    ...existing,
    companyName: (payload.companyName ?? existing.companyName).trim(),
    tradeName: (payload.tradeName ?? existing.tradeName).trim(),
    legalForm: (payload.legalForm ?? existing.legalForm).trim(),
    rccm: (payload.rccm ?? existing.rccm).trim(),
    taxId: (payload.taxId ?? existing.taxId).trim(),
    licenseNumber: (payload.licenseNumber ?? existing.licenseNumber).trim(),
    managerName: (payload.managerName ?? existing.managerName).trim(),
    managerTitle: (payload.managerTitle ?? existing.managerTitle).trim(),
    address: (payload.address ?? existing.address).trim(),
    city: (payload.city ?? existing.city).trim(),
    phone: (payload.phone ?? existing.phone).trim(),
    email: (payload.email ?? existing.email).trim(),
    website: (payload.website ?? existing.website).trim(),
    bankInfo: (payload.bankInfo ?? existing.bankInfo).trim(),
    headerSlogan: (payload.headerSlogan ?? existing.headerSlogan).trim(),
    updatedAt: nowIso,
  };

  // Synchronise également l'agence courante dans la liste SaaS si existante
  const currentTenants = resolveSaaSTenants(current).map((t) =>
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

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: updatedProfile,
    saasTenants: currentTenants,
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

export async function upsertSaaSTenantEntry(
  payload: Partial<SaaSTenantAgency> & {
    companyName: string;
    activateOnly?: boolean;
  }
): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSTenants(current);
  const nowIso = new Date().toISOString();

  const normalizedName = payload.companyName.trim().toLowerCase();
  const targetId = payload.id || '';
  const existingIdx = existingList.findIndex(
    (t) =>
      (targetId && t.id === targetId) ||
      (t.companyName.trim().toLowerCase() === normalizedName)
  );

  // En cas de simple activation d'en-tête lors de la connexion d'un compte existant,
  // ne jamais recréer ni écraser la liste des agences créées entre-temps
  if (payload.activateOnly) {
    if (existingIdx < 0) {
      return current;
    }
    const targetTenant = existingList[existingIdx];
    const updatedOnlyActive = existingList.map((item, idx) => ({
      ...item,
      isCurrentTenant: idx === existingIdx,
    }));
    const currentMgmt = resolveManagementCompany(current);
    const nextStore: DocumentTemplatesStore = {
      leases: { ...current.leases },
      receipts: { ...current.receipts },
      accountingMonths: resolveAccountingMonths(current),
      propertyTypes: resolvePropertyTypes(current),
      managementCompany: {
        ...currentMgmt,
        companyName: targetTenant.companyName,
        tradeName: targetTenant.tradeName,
        legalForm: targetTenant.legalForm,
        rccm: targetTenant.rccm,
        taxId: targetTenant.taxId,
        licenseNumber: targetTenant.licenseNumber,
        managerName: targetTenant.managerName,
        address: targetTenant.address,
        city: targetTenant.city,
        phone: targetTenant.phone,
        email: targetTenant.ownerEmail,
        updatedAt: nowIso,
      },
      saasTenants: updatedOnlyActive,
      saasUsers: resolveSaaSUsers(current),
      updatedAt: nowIso,
    };
    return await persistTemplatesStore(nextStore);
  }

  // Vérifie que le nom de l'agence immobilière est une clé unique
  const duplicateOther = existingList.find(
    (t, idx) =>
      idx !== existingIdx &&
      t.companyName.trim().toLowerCase() === normalizedName
  );
  if (duplicateOther) {
    throw new Error(
      `Le nom d'agence « ${payload.companyName.trim()} » existe déjà. Le nom de l'agence immobilière est une clé unique.`
    );
  }

  const makeCurrent = Boolean(payload.isCurrentTenant);

  let updatedList: SaaSTenantAgency[];
  if (existingIdx >= 0) {
    updatedList = existingList.map((item, idx) => {
      if (idx !== existingIdx) {
        return makeCurrent ? { ...item, isCurrentTenant: false } : item;
      }

      const currentStoredPhone = (item.whatsappPhone || item.phone || '').trim();
      const incomingRawPhone = (
        payload.whatsappPhone ??
        payload.phone ??
        currentStoredPhone
      ).trim();
      const phoneWasChanged =
        (payload.whatsappPhone !== undefined || payload.phone !== undefined) &&
        incomingRawPhone !== currentStoredPhone;

      const waCheck = validateWhatsAppPhone(incomingRawPhone);
      if (phoneWasChanged && !waCheck.isValid) {
        throw new Error(
          waCheck.error ||
            'Le numéro WhatsApp saisi pour l’agence immobilière n’est pas conforme.'
        );
      }
      const normalizedPhone = waCheck.isValid
        ? waCheck.formattedDisplay
        : incomingRawPhone;

      return {
        ...item,
        companyName: payload.companyName.trim(),
        tradeName: (payload.tradeName ?? item.tradeName).trim(),
        legalForm: (payload.legalForm ?? item.legalForm).trim(),
        rccm: (payload.rccm ?? item.rccm).trim(),
        taxId: (payload.taxId ?? item.taxId).trim(),
        licenseNumber: (payload.licenseNumber ?? item.licenseNumber).trim(),
        managerName: (payload.managerName ?? item.managerName).trim(),
        ownerEmail: (payload.ownerEmail ?? item.ownerEmail).trim(),
        phone: normalizedPhone,
        whatsappPhone: normalizedPhone,
        address: (payload.address ?? item.address).trim(),
        city: (payload.city ?? item.city).trim(),
        plan: payload.plan || item.plan,
        status: payload.status || item.status,
        monthlyFeeFcfa: Number(payload.monthlyFeeFcfa ?? item.monthlyFeeFcfa ?? 75000),
        maxProperties: Number(payload.maxProperties ?? item.maxProperties ?? 100),
        maxLandlords: Number(payload.maxLandlords ?? item.maxLandlords ?? 25),
        subscriptionEndsAt: payload.subscriptionEndsAt || item.subscriptionEndsAt,
        isCurrentTenant: makeCurrent ? true : item.isCurrentTenant,
      };
    });
  } else {
    const rawCandidatePhone = (payload.whatsappPhone || payload.phone || '').trim();
    const waCheck = validateWhatsAppPhone(rawCandidatePhone);
    if (!waCheck.isValid) {
      throw new Error(
        waCheck.error ||
          'Le numéro WhatsApp saisi pour l’agence immobilière n’est pas conforme.'
      );
    }
    const resolvedPhone = waCheck.formattedDisplay;

    const newItem: SaaSTenantAgency = {
      id: targetId || `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      companyName: payload.companyName.trim(),
      tradeName: (payload.tradeName || payload.companyName).trim(),
      legalForm: (payload.legalForm || 'SARL au capital de 5 000 000 FCFA').trim(),
      rccm: (payload.rccm || 'CI-ABJ-03-2026-B12-00100').trim(),
      taxId: (payload.taxId || 'CC 2600100 A').trim(),
      licenseNumber: (payload.licenseNumber || 'Agrément MCLU N° 2026/AG').trim(),
      managerName: (payload.managerName || 'Gérant Mandataire').trim(),
      ownerEmail: (payload.ownerEmail || 'direction@agence.ci').trim(),
      phone: resolvedPhone,
      whatsappPhone: resolvedPhone,
      address: (payload.address || 'Abidjan Cocody').trim(),
      city: (payload.city || 'Abidjan').trim(),
      plan: payload.plan || 'pro',
      status: payload.status || 'pending_approval',
      monthlyFeeFcfa: Number(payload.monthlyFeeFcfa ?? 75000),
      maxProperties: Number(payload.maxProperties ?? 150),
      maxLandlords: Number(payload.maxLandlords ?? 35),
      subscriptionEndsAt: payload.subscriptionEndsAt || '2027-12-31',
      isCurrentTenant: makeCurrent,
      createdAt: nowIso,
    };
    updatedList = [
      ...(makeCurrent
        ? existingList.map((t) => ({ ...t, isCurrentTenant: false }))
        : existingList),
      newItem,
    ];
  }

  let nextManagementCompany = resolveManagementCompany(current);
  const activeTenant = updatedList.find((t) => t.isCurrentTenant);
  if (makeCurrent && activeTenant) {
    nextManagementCompany = {
      ...nextManagementCompany,
      companyName: activeTenant.companyName,
      tradeName: activeTenant.tradeName,
      legalForm: activeTenant.legalForm,
      rccm: activeTenant.rccm,
      taxId: activeTenant.taxId,
      licenseNumber: activeTenant.licenseNumber,
      managerName: activeTenant.managerName,
      address: activeTenant.address,
      city: activeTenant.city,
      phone: activeTenant.phone,
      email: activeTenant.ownerEmail,
      updatedAt: nowIso,
    };
  }

  // Garantir que le propriétaire (ownerEmail) d'une agence créée dispose d'un compte Directeur d'Agence
  let nextUsers = resolveSaaSUsers(current);
  const savedTenant = updatedList.find(
    (t) =>
      (targetId && t.id === targetId) ||
      t.companyName.trim().toLowerCase() === normalizedName
  );
  const ownerMail = (savedTenant?.ownerEmail || '').trim().toLowerCase();
  if (
    savedTenant &&
    ownerMail &&
    ownerMail.includes('@') &&
    ownerMail !== 'direction@agence.ci' &&
    !nextUsers.some((u) => u.email.trim().toLowerCase() === ownerMail)
  ) {
    nextUsers = [
      ...nextUsers,
      {
        id: `user_owner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fullName: savedTenant.managerName || ownerMail.split('@')[0],
        email: ownerMail,
        whatsappPhone: savedTenant.whatsappPhone || savedTenant.phone,
        role:
          ownerMail === 'assamoighislain@gmail.com'
            ? 'super_admin'
            : 'agency_admin',
        tenantId: savedTenant.id,
        tenantName: savedTenant.companyName,
        status: 'active',
        createdAt: nowIso,
      },
    ];
  }

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: nextManagementCompany,
    saasTenants: updatedList,
    saasUsers: nextUsers,
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

export async function deleteSaaSTenantEntry(
  id: string
): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSTenants(current);
  const existingUsers = resolveSaaSUsers(current);
  const nowIso = new Date().toISOString();

  let updatedList = existingList.filter((item) => item.id !== id);
  if (updatedList.length === 0) {
    updatedList = [...DEFAULT_SAAS_TENANTS];
  } else if (!updatedList.some((t) => t.isCurrentTenant)) {
    updatedList[0] = { ...updatedList[0], isCurrentTenant: true };
  }

  const fallbackTenant = updatedList.find((t) => t.isCurrentTenant) || updatedList[0];
  const updatedUsers = existingUsers
    .filter(
      (u) =>
        u.tenantId !== id ||
        u.role === 'super_admin' ||
        u.email.trim().toLowerCase() === 'assamoighislain@gmail.com'
    )
    .map((u) =>
      u.tenantId === id
        ? {
            ...u,
            tenantId: fallbackTenant.id,
            tenantName: fallbackTenant.companyName,
          }
        : u
    );

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: updatedList,
    saasUsers: updatedUsers,
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

export async function upsertSaaSUserEntry(
  payload: Partial<SaaSUserAccount> & {
    fullName: string;
    email: string;
    actorRole?: SaaSUserAccount['role'];
    actorEmail?: string;
    actorTenantId?: string;
    isInitialAgencyRegistration?: boolean;
    isLoginSync?: boolean;
  }
): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSUsers(current);
  const tenants = resolveSaaSTenants(current);
  const nowIso = new Date().toISOString();

  const normalizedTargetEmail = payload.email.trim().toLowerCase();
  const isMainSuperAdmin =
    normalizedTargetEmail === 'assamoighislain@gmail.com';

  const targetId = payload.id || '';
  const existingIdx = existingList.findIndex(
    (u) =>
      (targetId && u.id === targetId) ||
      u.email.trim().toLowerCase() === normalizedTargetEmail
  );
  const existingUser = existingIdx >= 0 ? existingList[existingIdx] : null;

  // 1. Synchronisation de connexion d'un compte déjà existant (sans changement de rôle)
  if (payload.isLoginSync) {
    if (!existingUser && !isMainSuperAdmin) {
      throw new Error(
        'Accès refusé : Aucun compte utilisateur existant. Seul l’Administrateur ou le Directeur de l’Agence peut créer un compte et lui affecter un rôle.'
      );
    }
  } else if (payload.isInitialAgencyRegistration) {
    // 2. Création initiale d'une nouvelle agence immobilière : rôle forcé à Directeur d'Agence
    if (existingUser && !isMainSuperAdmin) {
      throw new Error(
        `Un compte utilisateur existe déjà avec l’adresse email « ${payload.email.trim()} ». Veuillez vous connecter ou utiliser une autre adresse email.`
      );
    }
  } else {
    // 3. Création de compte collaborateur ou affectation/modification de rôle :
    //    strictement réservé à l'Administrateur (super_admin) ou au Directeur d'Agence (agency_admin)
    const normalizedActorEmail = (payload.actorEmail || '').trim().toLowerCase();
    const actorRecord = normalizedActorEmail
      ? existingList.find(
          (u) => u.email.trim().toLowerCase() === normalizedActorEmail
        )
      : undefined;

    const effectiveActorRole: SaaSUserAccount['role'] | undefined =
      normalizedActorEmail === 'assamoighislain@gmail.com'
        ? 'super_admin'
        : actorRecord?.role || payload.actorRole;

    const effectiveActorTenantId =
      actorRecord?.tenantId || payload.actorTenantId || '';

    if (
      effectiveActorRole !== 'super_admin' &&
      effectiveActorRole !== 'agency_admin'
    ) {
      throw new Error(
        'Accès refusé : Seul l’Administrateur ou le Directeur de l’Agence peut créer les comptes des autres utilisateurs et affecter des rôles.'
      );
    }

    if (effectiveActorRole === 'agency_admin') {
      if (isMainSuperAdmin || existingUser?.role === 'super_admin') {
        throw new Error(
          'Accès refusé : Un Directeur d’Agence ne peut pas modifier un compte Administrateur.'
        );
      }
      if (payload.role === 'super_admin') {
        throw new Error(
          'Accès refusé : Un Directeur d’Agence ne peut affecter que les rôles Directeur d’Agence, Gestionnaire Locatif ou Agent Immobilier.'
        );
      }
      if (
        existingUser &&
        effectiveActorTenantId &&
        existingUser.tenantId !== effectiveActorTenantId
      ) {
        throw new Error(
          'Accès refusé : Vous ne pouvez gérer que les utilisateurs rattachés à votre propre agence.'
        );
      }
      if (
        payload.tenantId &&
        effectiveActorTenantId &&
        payload.tenantId !== effectiveActorTenantId
      ) {
        throw new Error(
          'Accès refusé : Vous ne pouvez rattacher des comptes qu’à votre propre agence.'
        );
      }
    }
  }

  const matchedTenant =
    tenants.find((t) => t.id === payload.tenantId) ||
    (existingUser
      ? tenants.find((t) => t.id === existingUser.tenantId)
      : undefined) ||
    tenants.find((t) => t.isCurrentTenant) ||
    tenants[0];

  const resolvedRole: SaaSUserAccount['role'] = isMainSuperAdmin
    ? 'super_admin'
    : payload.isInitialAgencyRegistration
      ? 'agency_admin'
      : payload.isLoginSync && existingUser
        ? existingUser.role
        : payload.role || existingUser?.role || 'agent';

  let updatedList: SaaSUserAccount[];
  if (existingIdx >= 0 && existingUser) {
    updatedList = existingList.map((item, idx) => {
      if (idx !== existingIdx) return item;
      const nextPassword =
        payload.password !== undefined && String(payload.password).trim() !== ''
          ? String(payload.password).trim()
          : item.password;
      return {
        ...item,
        fullName: payload.fullName.trim() || item.fullName,
        email: payload.email.trim(),
        password: nextPassword,
        whatsappPhone: payload.whatsappPhone ?? item.whatsappPhone,
        role: resolvedRole,
        tenantId: payload.isLoginSync
          ? item.tenantId
          : matchedTenant?.id || item.tenantId,
        tenantName: payload.isLoginSync
          ? item.tenantName
          : matchedTenant?.companyName || item.tenantName,
        status: payload.isLoginSync
          ? item.status
          : payload.status || item.status,
        createdByEmail: payload.createdByEmail || item.createdByEmail,
        lastLoginAt: payload.isLoginSync ? nowIso : item.lastLoginAt,
      };
    });
  } else {
    const newItem: SaaSUserAccount = {
      id:
        targetId ||
        `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      password:
        payload.password !== undefined && String(payload.password).trim() !== ''
          ? String(payload.password).trim()
          : undefined,
      whatsappPhone: payload.whatsappPhone,
      role: resolvedRole,
      tenantId: matchedTenant?.id || 'tenant_gimmo_prestige',
      tenantName:
        matchedTenant?.companyName || 'GIMMO PRESTIGE IMMOBILIER SARL',
      status: payload.status || 'active',
      createdByEmail: payload.createdByEmail || payload.actorEmail,
      lastLoginAt: payload.isInitialAgencyRegistration ? nowIso : undefined,
      createdAt: nowIso,
    };
    updatedList = [...existingList, newItem];
  }

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: tenants,
    saasUsers: updatedList,
    updatedAt: nowIso,
  };

  const savedStore = await persistTemplatesStore(next);

  // Synchronisation best-effort vers la table public.users de Supabase
  const mappedDbRole: 'administrateur' | 'gerant' | 'commercial' =
    resolvedRole === 'super_admin' || resolvedRole === 'agency_admin'
      ? 'administrateur'
      : resolvedRole === 'manager'
        ? 'gerant'
        : 'commercial';
  upsertUserRecord({
    email: payload.email.trim().toLowerCase(),
    name: payload.fullName.trim(),
    role: mappedDbRole,
  }).catch((err) => {
    console.warn('Best-effort sync to public.users failed:', err?.message || err);
  });

  return savedStore;
}

export interface SaaSLoginResult {
  ok: boolean;
  status: number;
  code?:
    | 'INVALID_INPUT'
    | 'USER_NOT_FOUND'
    | 'USER_SUSPENDED'
    | 'PASSWORD_REQUIRED'
    | 'INVALID_PASSWORD'
    | 'PENDING_APPROVAL'
    | 'AGENCY_SUSPENDED';
  error?: string;
  user?: SaaSUserAccount;
  agency?: SaaSTenantAgency;
  templates?: DocumentTemplatesStore;
}

export async function authenticateSaaSUserEntry(
  email: string,
  password: string
): Promise<SaaSLoginResult> {
  const stripInvisible = (value: string) =>
    String(value || '')
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
      .trim();

  const rawIdentifier = stripInvisible(email);
  const normalizedEmail = rawIdentifier.toLowerCase();
  const identifierDigits = rawIdentifier.replace(/\D+/g, '');
  const typedPassword = stripInvisible(password);

  if (!normalizedEmail) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      error: 'Veuillez saisir votre adresse email professionnelle ou numéro WhatsApp.',
    };
  }

  const current = await initTemplatesStoreFromDb();
  const tenants = resolveSaaSTenants(current);
  const users = resolveSaaSUsers(current);
  const nowIso = new Date().toISOString();

  const isMainSuperAdmin = normalizedEmail === 'assamoighislain@gmail.com';

  const matchesPhone = (phone?: string) => {
    if (identifierDigits.length < 8 || !phone) return false;
    const targetDigits = phone.replace(/\D+/g, '');
    if (targetDigits.length < 8) return false;
    return (
      targetDigits === identifierDigits ||
      targetDigits.endsWith(identifierDigits) ||
      identifierDigits.endsWith(targetDigits)
    );
  };

  let foundUser: SaaSUserAccount | undefined = isMainSuperAdmin
    ? users.find(
        (u) =>
          u.email.trim().toLowerCase() === normalizedEmail &&
          u.role === 'super_admin'
      ) || users.find((u) => u.email.trim().toLowerCase() === normalizedEmail)
    : [...users]
        .reverse()
        .find((u) => u.email.trim().toLowerCase() === normalizedEmail) ||
      (identifierDigits.length >= 8
        ? [...users].reverse().find((u) => matchesPhone(u.whatsappPhone))
        : undefined);

  // Fallback 1 : propriétaire déclaré sur une agence (ownerEmail ou whatsappPhone)
  if (!foundUser && !isMainSuperAdmin) {
    const matchedOwnerTenant = tenants.find(
      (t) =>
        (t.ownerEmail &&
          t.ownerEmail.trim().toLowerCase() === normalizedEmail) ||
        matchesPhone(t.whatsappPhone || t.phone)
    );
    if (matchedOwnerTenant) {
      foundUser = {
        id: `user_owner_${matchedOwnerTenant.id}`,
        fullName:
          matchedOwnerTenant.managerName ||
          matchedOwnerTenant.ownerEmail.split('@')[0],
        email: matchedOwnerTenant.ownerEmail.trim().toLowerCase(),
        whatsappPhone:
          matchedOwnerTenant.whatsappPhone || matchedOwnerTenant.phone,
        role: 'agency_admin',
        tenantId: matchedOwnerTenant.id,
        tenantName: matchedOwnerTenant.companyName,
        status: 'active',
        createdAt: matchedOwnerTenant.createdAt || nowIso,
      };
    }
  }

  // Fallback 2 : utilisateur existant dans la table public.users de Supabase
  if (!foundUser && !isMainSuperAdmin && normalizedEmail.includes('@')) {
    const dbUsers = await getAllUsers().catch(() => []);
    const matchedDbUser = dbUsers.find(
      (u) => u.email.trim().toLowerCase() === normalizedEmail
    );
    if (matchedDbUser) {
      const defaultAgency =
        tenants.find((t) => t.isCurrentTenant && t.status === 'active') ||
        tenants.find((t) => t.status === 'active') ||
        tenants[0];
      const mappedRole: SaaSUserAccount['role'] =
        matchedDbUser.role === 'administrateur'
          ? 'agency_admin'
          : matchedDbUser.role === 'gerant'
            ? 'manager'
            : 'agent';
      foundUser = {
        id: `user_db_${matchedDbUser.id}`,
        fullName: matchedDbUser.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        role: mappedRole,
        tenantId: defaultAgency?.id || 'tenant_gimmo_prestige',
        tenantName:
          defaultAgency?.companyName || 'GIMMO PRESTIGE IMMOBILIER SARL',
        status: 'active',
        createdAt: matchedDbUser.createdAt || nowIso,
      };
    }
  }

  // Fallback 3 : compte créé directement dans Supabase Authentication (auth.users)
  if (
    !foundUser &&
    !isMainSuperAdmin &&
    normalizedEmail.includes('@') &&
    typedPassword
  ) {
    const sbAuthUser = await verifySupabaseAuthPassword(
      normalizedEmail,
      typedPassword
    );
    if (sbAuthUser) {
      const defaultAgency =
        tenants.find((t) => t.isCurrentTenant && t.status === 'active') ||
        tenants.find((t) => t.status === 'active') ||
        tenants[0];
      foundUser = {
        id: `user_sb_${sbAuthUser.id}`,
        fullName: sbAuthUser.fullName,
        email: sbAuthUser.email,
        password: typedPassword,
        role: 'agent',
        tenantId: defaultAgency?.id || 'tenant_gimmo_prestige',
        tenantName:
          defaultAgency?.companyName || 'GIMMO PRESTIGE IMMOBILIER SARL',
        status: 'active',
        createdAt: nowIso,
      };
    }
  }

  // Fallback 4 : Super Admin principal
  if (!foundUser && isMainSuperAdmin) {
    const chosenAgency =
      tenants.find((t) => t.isCurrentTenant) || tenants[0];
    foundUser = {
      id: 'user_super_admin_main',
      fullName: 'Ghislain Assamoi',
      email: normalizedEmail,
      role: 'super_admin',
      tenantId: chosenAgency?.id || 'tenant_gimmo_prestige',
      tenantName:
        chosenAgency?.companyName || 'GIMMO PRESTIGE IMMOBILIER SARL',
      status: 'active',
      createdAt: nowIso.split('T')[0],
    };
  }

  if (!foundUser) {
    return {
      ok: false,
      status: 404,
      code: 'USER_NOT_FOUND',
      error:
        'Aucun compte trouvé pour cet identifiant. Seul l’Administrateur ou le Directeur de l’Agence peut créer les comptes des autres utilisateurs et leur affecter un rôle. Pour enregistrer une nouvelle agence immobilière, utilisez l’onglet « Créer une agence ».',
    };
  }

  const effectiveEmail = foundUser.email.trim().toLowerCase();
  const isSuperAdmin =
    isMainSuperAdmin ||
    effectiveEmail === 'assamoighislain@gmail.com' ||
    foundUser.role === 'super_admin';

  if (!isSuperAdmin && foundUser.status === 'suspended') {
    return {
      ok: false,
      status: 403,
      code: 'USER_SUSPENDED',
      error:
        'Ce compte utilisateur est suspendu par l’Administrateur ou le Directeur d’Agence.',
    };
  }

  const storedPassword = stripInvisible(foundUser.password || '');
  if (storedPassword) {
    if (!typedPassword) {
      return {
        ok: false,
        status: 401,
        code: 'PASSWORD_REQUIRED',
        error: 'Veuillez saisir votre mot de passe.',
      };
    }
    const isPasswordMatch =
      typedPassword === storedPassword ||
      (storedPassword.toUpperCase().startsWith('GIM-') &&
        typedPassword.toUpperCase() === storedPassword.toUpperCase());
    if (!isPasswordMatch) {
      return {
        ok: false,
        status: 401,
        code: 'INVALID_PASSWORD',
        error: 'Mot de passe incorrect pour ce compte utilisateur.',
      };
    }
  }

  const linkedAgency =
    tenants.find((t) => t.id === foundUser!.tenantId) ||
    tenants.find(
      (t) =>
        t.companyName.trim().toLowerCase() ===
        foundUser!.tenantName.trim().toLowerCase()
    ) ||
    tenants.find((t) => t.isCurrentTenant) ||
    tenants[0];

  if (!isSuperAdmin && linkedAgency?.status === 'pending_approval') {
    return {
      ok: false,
      status: 403,
      code: 'PENDING_APPROVAL',
      error: `L’agence immobilière « ${linkedAgency.companyName} » est actuellement en attente d’approbation. Seul le Super Admin (assamoighislain@gmail.com) a le droit d’approuver une agence immobilière.`,
    };
  }

  if (!isSuperAdmin && linkedAgency?.status === 'suspended') {
    return {
      ok: false,
      status: 403,
      code: 'AGENCY_SUSPENDED',
      error: `L’agence immobilière « ${linkedAgency.companyName} » est suspendue par le Super Admin.`,
    };
  }

  const authenticatedUser: SaaSUserAccount = {
    ...foundUser,
    role: isMainSuperAdmin ? 'super_admin' : foundUser.role,
    tenantId: linkedAgency?.id || foundUser.tenantId,
    tenantName: linkedAgency?.companyName || foundUser.tenantName,
    lastLoginAt: nowIso,
  };

  const existingUserIdx = users.findIndex(
    (u) =>
      u.id === authenticatedUser.id ||
      u.email.trim().toLowerCase() === effectiveEmail
  );

  const updatedUsers =
    existingUserIdx >= 0
      ? users.map((u, idx) =>
          idx === existingUserIdx ? { ...u, ...authenticatedUser } : u
        )
      : [...users, authenticatedUser];

  const updatedTenants = linkedAgency
    ? tenants.map((t) => ({
        ...t,
        isCurrentTenant: t.id === linkedAgency.id,
      }))
    : tenants;

  let nextManagementCompany = resolveManagementCompany(current);
  const activeTenant = updatedTenants.find((t) => t.isCurrentTenant);
  if (activeTenant) {
    nextManagementCompany = {
      ...nextManagementCompany,
      companyName: activeTenant.companyName,
      tradeName: activeTenant.tradeName,
      legalForm: activeTenant.legalForm,
      rccm: activeTenant.rccm,
      taxId: activeTenant.taxId,
      licenseNumber: activeTenant.licenseNumber,
      managerName: activeTenant.managerName,
      address: activeTenant.address,
      city: activeTenant.city,
      phone: activeTenant.phone,
      email: activeTenant.ownerEmail,
      updatedAt: nowIso,
    };
  }

  const nextStore: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: nextManagementCompany,
    saasTenants: updatedTenants,
    saasUsers: updatedUsers,
    updatedAt: nowIso,
  };

  const persisted = await persistTemplatesStore(nextStore);

  return {
    ok: true,
    status: 200,
    user: authenticatedUser,
    agency: activeTenant || linkedAgency,
    templates: persisted,
  };
}

export async function deleteSaaSUserEntry(
  id: string,
  actor?: {
    actorRole?: string;
    actorEmail?: string;
    actorTenantId?: string;
  }
): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveSaaSUsers(current);
  const nowIso = new Date().toISOString();

  const targetUser = existingList.find((u) => u.id === id);
  if (
    targetUser &&
    targetUser.email.trim().toLowerCase() === 'assamoighislain@gmail.com'
  ) {
    throw new Error(
      'Le compte Administrateur principal est protégé et ne peut pas être supprimé.'
    );
  }

  if (actor) {
    const normalizedActorEmail = (actor.actorEmail || '').trim().toLowerCase();
    const actorRecord = normalizedActorEmail
      ? existingList.find(
          (u) => u.email.trim().toLowerCase() === normalizedActorEmail
        )
      : undefined;
    const effectiveRole =
      normalizedActorEmail === 'assamoighislain@gmail.com'
        ? 'super_admin'
        : actorRecord?.role || actor.actorRole;
    const effectiveTenantId =
      actorRecord?.tenantId || actor.actorTenantId || '';

    if (effectiveRole !== 'super_admin' && effectiveRole !== 'agency_admin') {
      throw new Error(
        'Accès refusé : Seul l’Administrateur ou le Directeur de l’Agence peut supprimer un compte utilisateur.'
      );
    }

    if (effectiveRole === 'agency_admin' && targetUser) {
      if (targetUser.role === 'super_admin') {
        throw new Error(
          'Accès refusé : Impossible de supprimer un compte Administrateur.'
        );
      }
      if (effectiveTenantId && targetUser.tenantId !== effectiveTenantId) {
        throw new Error(
          'Accès refusé : Vous ne pouvez supprimer que les comptes de votre propre agence.'
        );
      }
    }
  }

  const updatedList = existingList.filter(
    (u) =>
      u.id !== id ||
      (u.email.toLowerCase() === 'assamoighislain@gmail.com' &&
        u.role === 'super_admin')
  );

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: updatedList.length > 0 ? updatedList : [...DEFAULT_SAAS_USERS],
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

export async function upsertAccountingMonthEntry(payload: {
  periodMonth: string;
  periodLabel: string;
  defaultDueDay?: number;
  status?: 'open' | 'closed';
  isCurrent?: boolean;
}): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveAccountingMonths(current);
  const nowIso = new Date().toISOString();

  const existingIdx = existingList.findIndex(
    (m) => m.periodMonth === payload.periodMonth
  );

  let updatedList: AccountingMonth[];
  if (existingIdx >= 0) {
    updatedList = existingList.map((m, idx) => {
      const isTarget = idx === existingIdx;
      const nextIsCurrent =
        payload.isCurrent !== undefined
          ? isTarget
            ? Boolean(payload.isCurrent)
            : payload.isCurrent
              ? false
              : m.isCurrent
          : m.isCurrent;
      if (!isTarget) {
        return { ...m, isCurrent: nextIsCurrent };
      }
      return {
        ...m,
        periodLabel: payload.periodLabel || m.periodLabel,
        defaultDueDay: Number(payload.defaultDueDay ?? m.defaultDueDay ?? 5),
        status: payload.status || m.status,
        isCurrent: nextIsCurrent,
      };
    });
  } else {
    const makeCurrent = Boolean(payload.isCurrent);
    const newEntry: AccountingMonth = {
      periodMonth: payload.periodMonth,
      periodLabel: payload.periodLabel,
      defaultDueDay: Number(payload.defaultDueDay || 5),
      status: payload.status || 'open',
      isCurrent: makeCurrent,
      createdAt: nowIso,
    };
    updatedList = [
      newEntry,
      ...existingList.map((m) => ({
        ...m,
        isCurrent: makeCurrent ? false : m.isCurrent,
      })),
    ].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));
  }

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: updatedList,
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

export async function deleteAccountingMonthEntry(
  periodMonth: string
): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolveAccountingMonths(current);
  const nowIso = new Date().toISOString();

  let updatedList = existingList.filter((m) => m.periodMonth !== periodMonth);
  if (updatedList.length > 0 && !updatedList.some((m) => m.isCurrent)) {
    updatedList[0] = { ...updatedList[0], isCurrent: true };
  }

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: updatedList,
    propertyTypes: resolvePropertyTypes(current),
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

export async function upsertPropertyTypeEntry(payload: {
  id?: string;
  name: string;
  code?: string;
  category?: PropertyTypeItem['category'];
  defaultCharges?: string;
  description?: string;
}): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolvePropertyTypes(current);
  const nowIso = new Date().toISOString();

  const targetId = payload.id || '';
  const existingIdx = existingList.findIndex(
    (item) =>
      (targetId && item.id === targetId) ||
      (!targetId && item.name.toLowerCase() === payload.name.trim().toLowerCase())
  );

  let updatedList: PropertyTypeItem[];
  if (existingIdx >= 0) {
    updatedList = existingList.map((item, idx) => {
      if (idx !== existingIdx) return item;
      return {
        ...item,
        name: payload.name.trim(),
        code: (payload.code || item.code || payload.name.slice(0, 4)).toUpperCase(),
        category: payload.category || item.category || 'habitation',
        defaultCharges: String(payload.defaultCharges ?? item.defaultCharges ?? '0'),
        description: payload.description ?? item.description ?? '',
      };
    });
  } else {
    const newItem: PropertyTypeItem = {
      id:
        targetId ||
        `type_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: payload.name.trim(),
      code: (payload.code || payload.name.slice(0, 4)).toUpperCase(),
      category: payload.category || 'habitation',
      defaultCharges: String(payload.defaultCharges || '35000'),
      description:
        payload.description ||
        'Type de bien immobilier configuré dans le paramétrage Gimmo',
      createdAt: nowIso,
    };
    updatedList = [...existingList, newItem];
  }

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes: updatedList,
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

export async function deletePropertyTypeEntry(
  id: string
): Promise<DocumentTemplatesStore> {
  const current = await initTemplatesStoreFromDb();
  const existingList = resolvePropertyTypes(current);
  const nowIso = new Date().toISOString();

  const updatedList = existingList.filter((item) => item.id !== id);

  const next: DocumentTemplatesStore = {
    leases: { ...current.leases },
    receipts: { ...current.receipts },
    accountingMonths: resolveAccountingMonths(current),
    propertyTypes:
      updatedList.length > 0 ? updatedList : [...DEFAULT_PROPERTY_TYPES],
    managementCompany: resolveManagementCompany(current),
    saasTenants: resolveSaaSTenants(current),
    saasUsers: resolveSaaSUsers(current),
    updatedAt: nowIso,
  };

  return await persistTemplatesStore(next);
}

function formatCurrency(amount: string | number, currency = 'FCFA'): string {
  const num = Number(amount) || 0;
  return `${num.toLocaleString('fr-FR')} ${currency}`;
}

export function buildDocumentVariables(details: {
  landlord?: any;
  property?: any;
  tenant?: any;
  lease?: any;
  payment?: any;
  managementCompany?: ManagementCompanyProfile;
}): Record<string, string> {
  const { landlord, property, tenant, lease, payment } = details;
  const store = getDocumentTemplatesStore();
  const company = details.managementCompany || resolveManagementCompany(store);

  const currency = property?.currency || 'FCFA';
  const rentVal = Number(lease?.rentAmount || property?.monthlyRent || 0);
  const chargesVal = Number(lease?.chargesAmount || property?.chargesAmount || 0);
  const totalMensuel = rentVal + chargesVal;
  const totalDueVal = Number(payment?.amountDue || totalMensuel);
  const paidVal = Number(payment?.amountPaid || 0);
  const balanceVal = Math.max(0, totalDueVal - paidVal);

  return {
    nom_societe_gestion: company.companyName,
    enseigne_societe_gestion: company.tradeName || company.companyName,
    forme_juridique_societe_gestion: company.legalForm,
    rccm_societe_gestion: company.rccm,
    id_fiscal_societe_gestion: company.taxId,
    agrement_societe_gestion: company.licenseNumber,
    gerant_societe_gestion: `${company.managerName} (${company.managerTitle})`,
    adresse_societe_gestion: `${company.address}, ${company.city}`,
    telephone_societe_gestion: company.phone,
    email_societe_gestion: company.email,
    site_societe_gestion: company.website,
    banque_societe_gestion: company.bankInfo,
    nom_bailleur: landlord?.companyName
      ? `${landlord.companyName} (représentée par ${landlord.fullName})`
      : landlord?.fullName || 'Bailleur',
    id_fiscal_bailleur: landlord?.taxId || 'N/A',
    adresse_bailleur: landlord?.address || '',
    telephone_bailleur: landlord?.phone || '',
    email_bailleur: landlord?.email || '',
    note_bailleur:
      landlord?.contractHeaderNote ||
      'Le Preneur s’engage à jouir des lieux en bon père de famille et à souscrire une police d’assurance multirisque.',
    nom_locataire: tenant
      ? `${tenant.firstName} ${tenant.lastName}`
      : 'Locataire',
    cni_locataire: tenant?.nationalIdNumber || 'N/A',
    whatsapp_locataire: tenant?.phoneWhatsapp || '',
    email_locataire: tenant?.email || '',
    profession_locataire: tenant?.profession || 'Non renseignée',
    employeur_locataire: tenant?.employer || 'Indépendant',
    titre_bien: property?.title || '',
    reference_bien: property?.reference || '',
    type_bien: property?.propertyType || '',
    adresse_bien: property?.address || '',
    quartier_bien: property?.neighborhood || '',
    ville_bien: property?.city || 'Abidjan',
    surface_bien: String(property?.surfaceArea || 0),
    pieces_bien: String(property?.roomsCount || 1),
    numero_contrat: lease?.contractNumber || 'BAIL-2026',
    loyer_mensuel: formatCurrency(rentVal, currency),
    charges: formatCurrency(chargesVal, currency),
    total_mensuel: formatCurrency(totalMensuel, currency),
    caution: formatCurrency(lease?.securityDeposit || rentVal * 2, currency),
    date_debut: lease?.startDate || '',
    date_fin: lease?.endDate || 'Reconduction tacite annuelle',
    jour_echeance: String(lease?.paymentDueDay || 5),
    clauses_contrat:
      lease?.customClauses || 'Aucune clause particulière supplémentaire.',
    numero_quittance: payment?.receiptNumber || 'QUIT-2026',
    periode: payment?.periodLabel || 'Novembre 2026',
    montant_appele: formatCurrency(totalDueVal, currency),
    montant_paye: formatCurrency(paidVal, currency),
    reste_a_payer: formatCurrency(balanceVal, currency),
    mode_paiement: payment?.paymentMethod || 'En attente',
    date_paiement: payment?.paymentDate || 'Non soldé',
    jeton_partage: payment?.shareToken || lease?.shareToken || '',
  };
}

/**
 * Dessine l'en-tête officiel épuré (2 lignes) de l'Agence Immobilière / Société de Gestion
 * en haut des documents PDF, sans surcharge visuelle.
 */
function drawManagementCompanyPdfBanner(
  doc: PDFKit.PDFDocument,
  company: ManagementCompanyProfile,
  accentColor: string,
  topY = 34
): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(accentColor)
    .text(company.companyName.toUpperCase(), 50, topY, { width: 495 });

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#475569')
    .text(
      `RCCM : ${company.rccm} · ID Fiscal : ${company.taxId} · ${company.address}, ${company.city} · Tél : ${company.phone}`,
      50,
      topY + 14,
      { width: 495 }
    );

  const lineY = topY + 29;
  doc
    .moveTo(50, lineY)
    .lineTo(545, lineY)
    .strokeColor('#E2E8F0')
    .lineWidth(0.75)
    .stroke();

  return lineY + 10;
}

/**
 * Génère et stream en direct le PDF d'une Quittance de Loyer officielle Gimmo
 * avec un en-tête épuré sur un seul bandeau horizontal (Agence à gauche, Titre & Réf à droite).
 */
export function streamReceiptPdf(
  res: Response,
  details: {
    payment: any;
    landlord: any;
    property: any;
    tenant: any;
    lease: any;
  },
  inline = true
) {
  const { payment, landlord, property, tenant, lease } = details;
  const filename = `Quittance_${payment.receiptNumber}.pdf`;

  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);
  const tpl = resolveReceiptTemplate(store, landlord?.id);
  const vars = buildDocumentVariables({ ...details, managementCompany: company });
  const accent = tpl.accentColor || '#0F172A';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
  );

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // En-tête unique épuré : Agence Immobilière à gauche | Titre & Référence Quittance à droite
  const headerTopY = 38;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(accent)
    .text(company.companyName.toUpperCase(), 50, headerTopY, { width: 275 });

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#475569')
    .text(
      `RCCM : ${company.rccm} · ID Fiscal : ${company.taxId}`,
      50,
      headerTopY + 15,
      { width: 275 }
    )
    .text(
      `${company.address}, ${company.city} · Tél : ${company.phone}`,
      50,
      headerTopY + 27,
      { width: 275 }
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(accent)
    .text(
      interpolateTemplateVariables(tpl.documentTitle, vars),
      330,
      headerTopY,
      { align: 'right', width: 215 }
    );
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#334155')
    .text(`Réf : ${payment.receiptNumber}`, 330, headerTopY + 16, {
      align: 'right',
      width: 215,
    })
    .text(`Période : ${payment.periodLabel}`, 330, headerTopY + 28, {
      align: 'right',
      width: 215,
    });

  const dividerY = headerTopY + 46;
  doc
    .moveTo(50, dividerY)
    .lineTo(545, dividerY)
    .strokeColor('#CBD5E1')
    .lineWidth(1.2)
    .stroke();

  // Bloc Bailleur & Locataire
  const partiesY = dividerY + 12;
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(accent)
    .text('BAILLEUR / PROPRIÉTAIRE MANDANT', 50, partiesY);
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#334155')
    .text(landlord.companyName || landlord.fullName, 50, partiesY + 15)
    .text(`Représenté par : ${landlord.fullName}`, 50, partiesY + 29)
    .text(landlord.address, 50, partiesY + 43, { width: 225 })
    .text(`Tél : ${landlord.phone}`, 50, partiesY + 69)
    .text(`ID Fiscal : ${landlord.taxId || 'N/A'}`, 50, partiesY + 83);

  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(accent)
    .text('LOCATAIRE / PRENEUR', 310, partiesY);
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#334155')
    .text(`${tenant.firstName} ${tenant.lastName}`, 310, partiesY + 15)
    .text(`Pièce d'identité : ${tenant.nationalIdNumber}`, 310, partiesY + 29)
    .text(`Tél WhatsApp : ${tenant.phoneWhatsapp}`, 310, partiesY + 43)
    .text(`Email : ${tenant.email}`, 310, partiesY + 57)
    .text(`Contrat : ${lease.contractNumber}`, 310, partiesY + 71);

  // Bien Immobilier concerné
  const propBoxY = partiesY + 104;
  doc.rect(50, propBoxY, 495, 58).fillAndStroke('#F8FAFC', '#E2E8F0');

  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(accent)
    .text(`BIEN LOUÉ : ${property.title} (${property.reference})`, 65, propBoxY + 10);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#334155')
    .text(
      `Adresse : ${property.address}, ${property.neighborhood}, ${property.city}`,
      65,
      propBoxY + 25
    )
    .text(
      `Type : ${property.propertyType} · ${property.surfaceArea} m² · ${property.roomsCount} pièces | GPS PostGIS : ${property.postgisWkt}`,
      65,
      propBoxY + 40
    );

  // Tableau du détail financier
  const tableTop = propBoxY + 72;
  doc.rect(50, tableTop, 495, 24).fill(accent);

  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#FFFFFF')
    .text('DÉSIGNATION DES SOMMES', 65, tableTop + 7)
    .text('MONTANT', 400, tableTop + 7, { width: 130, align: 'right' });

  const rentVal = Number(lease.rentAmount) || 0;
  const chargesVal = Number(lease.chargesAmount) || 0;
  const totalDueVal = Number(payment.amountDue) || rentVal + chargesVal;
  const paidVal = Number(payment.amountPaid) || 0;
  const balanceVal = Math.max(0, totalDueVal - paidVal);

  const row1Y = tableTop + 32;
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#1E293B')
    .text(interpolateTemplateVariables(tpl.rentRowLabel, vars), 65, row1Y, {
      width: 325,
    })
    .text(formatCurrency(rentVal, property.currency), 400, row1Y, {
      width: 130,
      align: 'right',
    });

  const row2Y = row1Y + 22;
  doc
    .text(interpolateTemplateVariables(tpl.chargesRowLabel, vars), 65, row2Y, {
      width: 325,
    })
    .text(formatCurrency(chargesVal, property.currency), 400, row2Y, {
      width: 130,
      align: 'right',
    });

  doc
    .moveTo(50, row2Y + 18)
    .lineTo(545, row2Y + 18)
    .strokeColor('#CBD5E1')
    .lineWidth(1)
    .stroke();

  const row3Y = row2Y + 26;
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor(accent)
    .text('TOTAL APPELÉ POUR LA PÉRIODE', 65, row3Y)
    .text(formatCurrency(totalDueVal, property.currency), 400, row3Y, {
      width: 130,
      align: 'right',
    });

  const row4Y = row3Y + 22;
  doc
    .fillColor(payment.status === 'paid' ? '#15803D' : '#B45309')
    .text('MONTANT RÉGLÉ PAR LE LOCATAIRE', 65, row4Y)
    .text(formatCurrency(paidVal, property.currency), 400, row4Y, {
      width: 130,
      align: 'right',
    });

  const row5Y = row4Y + 22;
  doc
    .fillColor(balanceVal > 0 ? '#DC2626' : '#0F172A')
    .text('RESTE À PAYER (SOLDE)', 65, row5Y)
    .text(formatCurrency(balanceVal, property.currency), 400, row5Y, {
      width: 130,
      align: 'right',
    });

  // Attestation légale personnalisée
  const certY = row5Y + 32;
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#334155')
    .text(interpolateTemplateVariables(tpl.attestationBody, vars), 50, certY, {
      width: 495,
      align: 'justify',
      lineGap: 2,
    });

  const afterCertY = Math.max(certY + 55, doc.y + 10);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#1E293B')
    .text(
      `Mode de règlement : ${payment.paymentMethod || 'En attente'} | Date de règlement : ${payment.paymentDate || 'Non soldé'}`,
      50,
      afterCertY
    );

  // Signature & Cachet
  const sigY = afterCertY + 26;
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(accent)
    .text(
      `Fait à ${property.city}, le ${new Date().toISOString().split('T')[0]}`,
      260,
      sigY,
      { align: 'right', width: 285 }
    )
    .text(interpolateTemplateVariables(tpl.signatureLabel, vars), 200, sigY + 14, {
      align: 'right',
      width: 345,
    });

  // Pied de page
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94A3B8')
    .text(interpolateTemplateVariables(tpl.footerNote, vars), 50, 765, {
      align: 'center',
      width: 495,
    });

  doc.end();
}

/**
 * Génère et stream en direct le PDF d'un Contrat de Bail avec l'en-tête officiel de la Société de Gestion
 */
export function streamLeaseContractPdf(
  res: Response,
  details: {
    lease: any;
    landlord: any;
    property: any;
    tenant: any;
  },
  inline = true
) {
  const { lease, landlord, property } = details;
  const filename = `Contrat_Bail_${lease.contractNumber}.pdf`;

  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);
  const tpl = resolveLeaseTemplate(store, landlord?.id);
  const vars = buildDocumentVariables({ ...details, managementCompany: company });
  const accent = tpl.accentColor || '#1E1B4B';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
  );

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // 1. En-tête officiel de la Société de Gestion (Mandataire)
  const afterBannerY = drawManagementCompanyPdfBanner(doc, company, accent, 26);

  // 2. En-tête Contrat Personnalisé
  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor(accent)
    .text(
      interpolateTemplateVariables(tpl.documentTitle, vars),
      50,
      afterBannerY + 2,
      { align: 'center' }
    );
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#475569')
    .text(
      interpolateTemplateVariables(tpl.documentSubtitle, vars),
      50,
      afterBannerY + 22,
      { align: 'center' }
    );

  const lineY = afterBannerY + 40;
  doc
    .moveTo(50, lineY)
    .lineTo(545, lineY)
    .strokeColor(accent)
    .lineWidth(1.5)
    .stroke();

  let y = lineY + 10;

  const renderArticle = (title: string, body: string, extraLine?: string) => {
    if (!title && !body) return;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(accent)
      .text(interpolateTemplateVariables(title, vars), 50, y);
    y = doc.y + 3;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#1E293B')
      .text(interpolateTemplateVariables(body, vars), 50, y, {
        width: 495,
        lineGap: 1.5,
      });
    y = doc.y + 3;
    if (extraLine) {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#475569')
        .text(extraLine, 50, y, { width: 495 });
      y = doc.y + 3;
    }
    y += 7;
  };

  renderArticle(tpl.article1Title, tpl.article1Body);
  renderArticle(
    tpl.article2Title,
    tpl.article2Body,
    tpl.showPostgisCoords
      ? `Coordonnées GPS certifiées (PostGIS WGS84) : Latitude ${property.latitude}, Longitude ${property.longitude} (${property.postgisWkt}).`
      : undefined
  );
  renderArticle(tpl.article3Title, tpl.article3Body);
  renderArticle(tpl.article4Title, tpl.article4Body);
  renderArticle(tpl.article5Title, tpl.article5Body);
  renderArticle(tpl.article6Title, tpl.article6Body);

  // Signatures
  const sigY = Math.min(715, Math.max(y + 8, 675));
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(accent)
    .text(interpolateTemplateVariables(tpl.landlordSignatureLabel, vars), 50, sigY, {
      width: 240,
    })
    .text(interpolateTemplateVariables(tpl.tenantSignatureLabel, vars), 340, sigY, {
      width: 205,
    });

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748B')
    .text(interpolateTemplateVariables(tpl.signatureSubtext, vars), 50, sigY + 14)
    .text(
      interpolateTemplateVariables(tpl.signatureSubtext, vars),
      340,
      sigY + 14
    );

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94A3B8')
    .text(interpolateTemplateVariables(tpl.footerText, vars), 50, 765, {
      align: 'center',
      width: 495,
    });

  doc.end();
}

/**
 * Génère et stream en direct le PDF du Rapport Financier & État des Impayés
 * avec l'identification de la Société de Gestion en en-tête.
 */
export function streamFinancialReportPdf(
  res: Response,
  params: {
    granularity: 'daily' | 'monthly' | 'annual';
    landlordId: number | 'all';
    landlords: any[];
    properties: any[];
    tenants: any[];
    payments: any[];
  },
  inline = true
) {
  const { granularity, landlordId, landlords, properties, tenants, payments } =
    params;

  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);

  const periodTitle =
    granularity === 'daily'
      ? 'Point Journalier (09 Novembre 2026)'
      : granularity === 'monthly'
        ? 'Point Mensuel (Novembre 2026)'
        : 'Exercice Annuel Consolidé (2026)';

  const filename = `Rapport_Financier_Gimmo_${granularity}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
  );

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  // Bandeau d'en-tête épuré de l'Agence Immobilière
  doc.rect(0, 0, 595.28, 76).fill('#1E1B4B');
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#FCD34D')
    .text(company.companyName.toUpperCase(), 40, 16, { width: 515 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#E0E7FF')
    .text(
      `RCCM : ${company.rccm} · ${company.address}, ${company.city} · Tél : ${company.phone}`,
      40,
      33,
      { width: 515 }
    );
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#FFFFFF')
    .text(
      `RAPPORT FINANCIER & REDDITION DES COMPTES — ${periodTitle}`,
      40,
      51
    );

  const landlordById: Record<number, any> = {};
  for (const l of landlords) landlordById[l.id] = l;

  const propertyById: Record<number, any> = {};
  for (const p of properties) propertyById[p.id] = p;

  const tenantById: Record<number, any> = {};
  for (const t of tenants) tenantById[t.id] = t;

  const scopedLandlords = landlords.filter((l) =>
    landlordId === 'all' ? true : l.id === landlordId
  );
  const scopedPayments = payments.filter((p) =>
    landlordId === 'all' ? true : p.landlordId === landlordId
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const filterByGranularity = (p: any) => {
    if (granularity === 'daily') {
      return p.paymentDate === '2026-11-09' || p.paymentDate === todayStr;
    }
    if (granularity === 'monthly') {
      return p.periodMonth === '2026-11';
    }
    return String(p.periodMonth).startsWith('2026');
  };

  const periodPayments = scopedPayments.filter(filterByGranularity);
  const overduePayments = scopedPayments.filter((p) => p.status === 'overdue');

  const totalExpected = periodPayments.reduce(
    (s, p) => s + Number(p.amountDue),
    0
  );
  const totalCollected = periodPayments.reduce(
    (s, p) => s + Number(p.amountPaid),
    0
  );
  const totalArrears = overduePayments.reduce(
    (s, p) => s + (Number(p.amountDue) - Number(p.amountPaid)),
    0
  );

  // Cartes de synthèse financière
  let y = 108;
  doc.rect(40, y, 165, 58).fillAndStroke('#EEF2FF', '#C7D2FE');
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#3730A3')
    .text('TOTAL APPELÉ (PÉRIODE)', 50, y + 12);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#1E1B4B')
    .text(formatCurrency(totalExpected), 50, y + 30);

  doc.rect(215, y, 165, 58).fillAndStroke('#ECFDF5', '#A7F3D0');
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#065F46')
    .text('TOTAL ENCAISSÉ', 225, y + 12);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#047857')
    .text(formatCurrency(totalCollected), 225, y + 30);

  doc.rect(390, y, 165, 58).fillAndStroke('#FFF1F2', '#FECDD3');
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#9F1239')
    .text('ARRIÉRÉS / IMPAYÉS', 400, y + 12);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#BE123C')
    .text(formatCurrency(totalArrears), 400, y + 30);

  // Section 1 : Tableau des Encaissements par Bailleur
  y += 80;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#1E1B4B')
    .text('1. SYNTHÈSE DES ENCAISSEMENTS ET REVERSEMENTS PAR BAILLEUR', 40, y);

  y += 20;
  doc.rect(40, y, 515, 24).fill('#312E81');
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#FFFFFF')
    .text('BAILLEUR / SOCIÉTÉ', 48, y + 7)
    .text('APPELÉ', 225, y + 7, { width: 75, align: 'right' })
    .text('ENCAISSÉ', 305, y + 7, { width: 75, align: 'right' })
    .text('HONORAIRES', 385, y + 7, { width: 75, align: 'right' })
    .text('NET BAILLEUR', 465, y + 7, { width: 82, align: 'right' });

  y += 28;
  for (const landlord of scopedLandlords) {
    const lPay = payments
      .filter((p) => p.landlordId === landlord.id)
      .filter(filterByGranularity);
    const expected = lPay.reduce((s, p) => s + Number(p.amountDue), 0);
    const collected = lPay.reduce((s, p) => s + Number(p.amountPaid), 0);
    const fee = (collected * Number(landlord.commissionRate || 8)) / 100;
    const net = collected - fee;

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0F172A')
      .text(
        `${landlord.companyName || landlord.fullName} (${landlord.commissionRate}%)`,
        48,
        y,
        { width: 175 }
      );
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#334155')
      .text(formatCurrency(expected), 225, y, { width: 75, align: 'right' })
      .fillColor('#047857')
      .text(formatCurrency(collected), 305, y, { width: 75, align: 'right' })
      .fillColor('#475569')
      .text(formatCurrency(fee), 385, y, { width: 75, align: 'right' })
      .font('Helvetica-Bold')
      .fillColor('#1E1B4B')
      .text(formatCurrency(net), 465, y, { width: 82, align: 'right' });

    y += 22;
    doc
      .moveTo(40, y - 4)
      .lineTo(555, y - 4)
      .strokeColor('#E2E8F0')
      .stroke();
  }

  // Section 2 : État des Locataires en situation d'impayé (Retards)
  y += 20;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#9F1239')
    .text(
      `2. ÉTAT DES LOCATAIRES EN SITUATION D'IMPAYÉ (${overduePayments.length} DOSSIER(S))`,
      40,
      y
    );

  y += 20;
  doc.rect(40, y, 515, 24).fill('#881337');
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#FFFFFF')
    .text('LOCATAIRE & TÉLÉPHONE', 48, y + 7)
    .text('BIEN IMMOBILIER', 195, y + 7)
    .text('PÉRIODE', 345, y + 7)
    .text('RETARD', 415, y + 7, { width: 50, align: 'right' })
    .text('SOLDE DÛ', 470, y + 7, { width: 78, align: 'right' });

  y += 28;
  if (overduePayments.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#047857')
      .text('Aucun locataire en situation d’impayé sur ce périmètre.', 48, y);
  } else {
    for (const p of overduePayments) {
      const tenant = tenantById[p.tenantId];
      const prop = propertyById[p.propertyId];
      const balance = Number(p.amountDue) - Number(p.amountPaid);

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#0F172A')
        .text(
          `${tenant?.firstName || ''} ${tenant?.lastName || ''} (${tenant?.phoneWhatsapp || ''})`,
          48,
          y,
          { width: 140 }
        );
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#334155')
        .text(prop?.title || 'Bien', 195, y, { width: 145 })
        .text(p.periodLabel, 345, y, { width: 65 })
        .fillColor('#BE123C')
        .text(`+${p.daysLate} j`, 415, y, { width: 50, align: 'right' })
        .font('Helvetica-Bold')
        .text(formatCurrency(balance), 470, y, { width: 78, align: 'right' });

      y += 24;
      doc
        .moveTo(40, y - 5)
        .lineTo(555, y - 5)
        .strokeColor('#FFE4E6')
        .stroke();
    }
  }

  // Pied de page
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748B')
    .text(
      `${company.companyName} (RCCM ${company.rccm}) · Rapport officiel généré le ${todayStr} — Prêt pour impression et archivage comptable.`,
      40,
      770,
      { align: 'center', width: 515 }
    );

  doc.end();
}

/**
 * Génère et stream en direct le PDF complet du Guide d'Utilisation du logiciel Gimmo SaaS
 */
export function streamUserGuidePdf(res: Response, inline = true) {
  const filename = 'Guide_Utilisation_Gimmo_SaaS.pdf';
  const todayStr = new Date().toISOString().split('T')[0];
  const store = getDocumentTemplatesStore();
  const company = resolveManagementCompany(store);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
  );

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  const drawPageHeader = (pageTitle: string, pageNum: number) => {
    doc.rect(0, 0, 595.28, 72).fill('#1E1B4B');
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#FCD34D')
      .text(company.companyName.toUpperCase(), 40, 14, { width: 430 });
    doc
      .font('Helvetica-Bold')
      .fontSize(13.5)
      .fillColor('#FFFFFF')
      .text("GUIDE D'UTILISATION OFFICIEL — GIMMO SAAS", 40, 30);
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#A5B4FC')
      .text(pageTitle, 40, 49);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#FCD34D')
      .text(`Page ${pageNum} / 3`, 480, 24, { width: 75, align: 'right' });
  };

  const drawPageFooter = (pageNum: number) => {
    doc
      .moveTo(40, 760)
      .lineTo(555, 760)
      .strokeColor('#CBD5E1')
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748B')
      .text(
        `${company.companyName} (${company.phone}) — Manuel Utilisateur Gimmo SaaS (Édition ${todayStr}) · Page ${pageNum}/3`,
        40,
        768,
        { align: 'center', width: 515 }
      );
  };

  const drawChapterBox = (
    yPos: number,
    badge: string,
    title: string,
    accentHex: string,
    bgHex: string,
    bullets: { heading: string; desc: string }[]
  ): number => {
    let curY = yPos;
    doc.rect(40, curY, 515, 24).fill(accentHex);
    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor('#FFFFFF')
      .text(`${badge}  ${title}`, 50, curY + 6);
    curY += 28;

    for (const item of bullets) {
      const descHeight = doc.heightOfString(item.desc, { width: 485 });
      const blockHeight = Math.max(28, descHeight + 18);
      doc
        .rect(40, curY, 515, blockHeight)
        .fillAndStroke(bgHex, '#E2E8F0');
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#0F172A')
        .text(`• ${item.heading}`, 50, curY + 5, { width: 495 });
      doc
        .font('Helvetica')
        .fontSize(8.8)
        .fillColor('#334155')
        .text(item.desc, 60, curY + 18, { width: 485 });
      curY += blockHeight + 4;
    }

    return curY + 8;
  };

  // =========================================================================
  // PAGE 1 : PRÉSENTATION, MULTI-BAILLEURS, PATRIMOINE GPS & BAUX
  // =========================================================================
  drawPageHeader(
    'Chapitres 1 à 3 : Navigation, Gestion Multi-Bailleurs, Cartographie GPS & Contrats de Bail',
    1
  );

  let y = 92;

  // Encadré d'introduction
  doc.rect(40, y, 515, 52).fillAndStroke('#EEF2FF', '#C7D2FE');
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#1E1B4B')
    .text('Bienvenue dans Gimmo — Solution SaaS de Gestion Immobilière Multi-Bailleurs', 50, y + 8);
  doc
    .font('Helvetica')
    .fontSize(8.8)
    .fillColor('#3730A3')
    .text(
      "Ce guide pratique détaille toutes les fonctionnalités du logiciel : gestion des propriétaires mandants (bailleurs), cartographie GPS PostGIS des biens, contrats de bail, quittances WhatsApp, recouvrement des impayés, paramétrage et mode hors-ligne.",
      50,
      y + 22,
      { width: 495 }
    );
  y += 64;

  y = drawChapterBox(
    y,
    'CHAPITRE 1',
    'NAVIGATION & GESTION DES BAILLEURS (PROPRIÉTAIRES MANDANTS)',
    '#312E81',
    '#F8FAFC',
    [
      {
        heading: 'Menu Principal (Ordinateur & Smartphone)',
        desc: "Accédez aux 5 modules depuis la barre supérieure : Biens & Carte, Locataires & Baux, Quittances, Recouvrement et Paramétrage. Sur smartphone, appuyez sur le bouton « Menu : ... (Déplier) » pour ouvrir le menu vertical déroulant.",
      },
      {
        heading: 'Sélection et Filtrage par Bailleur',
        desc: "En haut de l'écran, la liste déroulante « Bailleur » permet d'afficher soit tous les propriétaires, soit le portefeuille exclusif d'un bailleur donné (biens gérés, loyers encaissés, dossiers en retard).",
      },
      {
        heading: 'Créer, Modifier et Supprimer un Bailleur',
        desc: "Sélectionnez un bailleur dans le menu déroulant pour faire apparaître les boutons « Modifier » et « Supprimer » (avec confirmation « Confirmer ? / Annuler »). Vous pouvez aussi cliquer sur « Gérer les Bailleurs » ou aller dans « Paramétrage » pour ajouter, éditer ou supprimer n'importe quel bailleur (nom, SCI, téléphone, email, RCCM, IBAN, taux de commission %).",
      },
    ]
  );

  y = drawChapterBox(
    y,
    'CHAPITRE 2',
    'PATRIMOINE IMMOBILIER & CARTOGRAPHIE GPS (POSTGIS)',
    '#047857',
    '#F0FDF4',
    [
      {
        heading: 'Carte Interactive Google Maps & Code Couleur des Lots',
        desc: "Dans « Biens & Carte », chaque bien est positionné par ses coordonnées GPS WGS84 (SRID 4326). Les marqueurs affichent le loyer et changent de couleur : Indigo = Occupé à jour, Ambre = Vacant disponible, Rouge = Impayé signalé.",
      },
      {
        heading: 'Ajouter un Bien avec Géolocalisation GPS Automatique',
        desc: "Cliquez sur « + Ajouter un bien GPS ». Le logiciel acquiert automatiquement la position GPS de votre téléphone ou ordinateur. Vous pouvez aussi cliquer sur « Récupérer ma position GPS actuelle », choisir le type de bien (qui pré-remplit les charges par défaut) et enregistrer.",
      },
      {
        heading: 'Modifier ou Supprimer un Bien Immobilier',
        desc: "Dans la colonne de gauche ou sur l'infobulle de la carte, cliquez sur « Modifier » pour mettre à jour un bien (loyer, statut, coordonnées GPS) ou sur « Supprimer » puis « Confirmer ? » pour le retirer.",
      },
    ]
  );

  y = drawChapterBox(
    y,
    'CHAPITRE 3',
    'DOSSIERS LOCATAIRES & CONTRATS DE BAIL PDF',
    '#4338CA',
    '#EEF2FF',
    [
      {
        heading: 'Création d’un Locataire & Génération Automatique du Bail',
        desc: "Dans « Locataires & Baux », cliquez sur « + Nouveau Locataire & Bail ». Renseignez l'état civil, le numéro WhatsApp, la pièce d'identité, le bien loué et les dates. Le contrat de bail et la 1ère quittance sont créés automatiquement.",
      },
      {
        heading: 'Impression PDF, Partage WhatsApp & Suppression',
        desc: "Utilisez les boutons « Contrat PDF » pour imprimer/télécharger le bail officiel, « WhatsApp » pour l'envoyer au locataire, « Modifier » pour éditer les clauses ou le loyer, et « Supprimer » pour clôturer et libérer le bien.",
      },
    ]
  );

  drawPageFooter(1);

  // =========================================================================
  // PAGE 2 : QUITTANCES, WHATSAPP, RECOUVREMENT & PARAMÉTRAGE
  // =========================================================================
  doc.addPage({ margin: 40, size: 'A4' });
  drawPageHeader(
    'Chapitres 4 à 6 : Quittances WhatsApp, Recouvrement des Impayés & Paramétrage',
    2
  );

  y = 92;

  y = drawChapterBox(
    y,
    'CHAPITRE 4',
    'QUITTANCES DE LOYER, ENCAISSEMENT & ENVOI WHATSAPP',
    '#0F766E',
    '#F0FDFA',
    [
      {
        heading: 'Créer et Filtrer les Quittances par Mois Comptable',
        desc: "Dans « Quittances », filtrez par mois comptable (ex: Novembre 2026) ou par statut (Toutes, Payées, Impayés / Retards). Cliquez sur « + Créer une Quittance » pour émettre manuellement un appel de loyer ou une quittance.",
      },
      {
        heading: 'Encaisser un Loyer en 1 Clic',
        desc: "Sur une quittance en attente ou en retard, cliquez sur « Encaisser (Mobile Money) » ou « Modifier » pour enregistrer le règlement (Virement, Mobile Money, Espèces, Chèque). Le statut passe immédiatement à « Payé ».",
      },
      {
        heading: 'Aperçu PDF, Téléchargement & Envoi WhatsApp Direct',
        desc: "Chaque quittance dispose d'un bouton « Aperçu / PDF » (ouverture et téléchargement du PDF officiel) et d'un bouton « Envoyer Quittance WhatsApp » qui génère un message pré-rempli avec le lien PDF sécurisé prêt à être envoyé au locataire.",
      },
    ]
  );

  y = drawChapterBox(
    y,
    'CHAPITRE 5',
    'SUIVI FINANCIER, RECOUVREMENT DES IMPAYÉS & REDDITION BAILLEURS',
    '#BE123C',
    '#FFF1F2',
    [
      {
        heading: 'Tableau Automatique des Locataires en Retard (Impayés)',
        desc: "Dans « Recouvrement », la section 01 liste automatiquement tous les locataires ayant dépassé la date d'exigibilité du mois, avec le nombre de jours de retard (+X jours) et le solde impayé exact.",
      },
      {
        heading: 'Relance WhatsApp en 1 Clic & Régularisation',
        desc: "Cliquez sur « Relance WhatsApp » pour envoyer un rappel courtois chiffré au locataire, ou sur « Régulariser & Quittancer » dès réception des fonds.",
      },
      {
        heading: 'Rapport Financier par Période & Calcul du Net à Reverser',
        desc: "Basculez entre « Journalier », « Mensuel » et « Annuel ». Le tableau calcule automatiquement pour chaque bailleur : Total Appelé, Total Encaissé, Impayés, Honoraires Agence (%) et Net à Reverser. Cliquez sur « Imprimer le Rapport PDF » ou « Télécharger PDF » pour exporter l'état comptable.",
      },
    ]
  );

  y = drawChapterBox(
    y,
    'CHAPITRE 6',
    'PARAMÉTRAGE : TYPES DE BIENS, MOIS COMPTABLES & MODÈLES PDF',
    '#6D28D9',
    '#F5F3FF',
    [
      {
        heading: 'Création et Modification des Types de Biens Immobiliers',
        desc: "Dans « Paramétrage », ajoutez vos propres types de biens (ex: Duplex, Entrepôt, Magasin) avec leur code court, catégorie d'usage et charges par défaut. Si vous renommez un type existant via « Modifier », tous les biens rattachés sont mis à jour automatiquement.",
      },
      {
        heading: 'Ouverture des Mois Comptables & Appels de Loyers Automatiques',
        desc: "Créez un nouveau mois comptable (ex: Décembre 2026), définissez-le comme « Mois Actif par défaut » et cochez la génération automatique pour créer en un clic les quittances de tous les baux actifs.",
      },
      {
        heading: 'Personnalisation des Modèles de Contrat de Bail & Quittance',
        desc: "Cliquez sur « Modèles Bail & Quittance » pour personnaliser les titres, articles, clauses, couleurs et variables dynamiques ({{nom_locataire}}, {{montant_loyer_ttc}}, {{nom_bailleur}}) pour toute l'agence ou par bailleur.",
      },
    ]
  );

  drawPageFooter(2);

  // =========================================================================
  // PAGE 3 : MODE HORS-LIGNE, SYNCHRO TEMPS RÉEL, PWA & BONNES PRATIQUES
  // =========================================================================
  doc.addPage({ margin: 40, size: 'A4' });
  drawPageHeader(
    'Chapitre 7 & Récapitulatif : Mode Hors-Ligne, Synchro Temps Réel & Application Mobile PWA',
    3
  );

  y = 92;

  y = drawChapterBox(
    y,
    'CHAPITRE 7',
    'MODE HORS-LIGNE (OFFLINE), SYNCHRO TEMPS RÉEL & APPLICATION MOBILE',
    '#B45309',
    '#FFFBEB',
    [
      {
        heading: 'Continuité de Service en Mode Hors-Ligne (Sans Internet)',
        desc: "Gimmo sauvegarde en permanence un instantané local de votre portefeuille. En cas de coupure Internet (ou en cliquant sur le bouton « Synchro Temps Réel Active » pour passer en « Mode Hors-Ligne Actif »), vous pouvez continuer à créer, modifier ou supprimer des biens, bailleurs, baux et quittances sur le terrain.",
      },
      {
        heading: 'Synchronisation Automatique & Temps Réel Multi-Appareils',
        desc: "Dès le retour de la connexion, cliquez sur « Synchroniser (X) » ou repassez en ligne : toutes les opérations enregistrées hors-ligne sont envoyées au serveur PostgreSQL et diffusées en temps réel (WebSocket / SSE) à tous vos collaborateurs connectés.",
      },
      {
        heading: 'Installation sur Smartphone Android, iPhone (iOS) & Ordinateur (PWA)',
        desc: "Dans « Paramétrage », cliquez sur le bouton « Application Mobile / PWA » (« Installer l'application ») pour ajouter l'icône Gimmo directement sur l'écran d'accueil de votre téléphone ou sur le bureau de votre PC.",
      },
    ]
  );

  // Tableau récapitulatif des raccourcis et actions rapides
  y += 6;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1E1B4B')
    .text('AIDE-MÉMOIRE DES ACTIONS RAPIDES DANS GIMMO', 40, y);

  y += 18;
  doc.rect(40, y, 515, 22).fill('#1E1B4B');
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#FFFFFF')
    .text('OBJECTIF / OPÉRATION', 48, y + 6)
    .text('RUBRIQUE / EMPLACEMENT', 235, y + 6)
    .text('BOUTON D’ACTION À UTILISER', 385, y + 6);

  const quickActions = [
    [
      'Modifier ou supprimer un bailleur',
      'Barre supérieure ou Paramétrage',
      'Sélectionner le bailleur -> « Modifier » / « Supprimer »',
    ],
    [
      'Ajouter un bien avec position GPS',
      'Biens & Carte',
      '« + Ajouter un bien GPS » (acquisition auto WGS84)',
    ],
    [
      'Créer ou modifier un type de bien',
      'Paramétrage -> Types de Biens',
      'Formulaire d’ajout ou bouton « Modifier » sur la ligne',
    ],
    [
      'Ouvrir un nouveau mois comptable',
      'Paramétrage -> Mois Comptables',
      '« Créer un Mois Comptable » (+ génération quittances)',
    ],
    [
      'Émettre ou encaisser une quittance',
      'Quittances',
      '« + Créer une Quittance » ou « Encaisser »',
    ],
    [
      'Relancer un impayé sur WhatsApp',
      'Recouvrement (Section 01)',
      '« Relance WhatsApp » puis « Régulariser & Quittancer »',
    ],
    [
      'Exporter le rapport financier PDF',
      'Recouvrement (Haut de page)',
      '« Imprimer le Rapport PDF » / « Télécharger PDF »',
    ],
    [
      'Adapter les clauses Bail / Quittance',
      'Paramétrage',
      '« Modèles Bail & Quittance »',
    ],
  ];

  y += 24;
  for (let i = 0; i < quickActions.length; i++) {
    const [goal, loc, action] = quickActions[i];
    const rowBg = i % 2 === 0 ? '#F8FAFC' : '#EEF2FF';
    doc.rect(40, y, 515, 22).fillAndStroke(rowBg, '#E2E8F0');
    doc
      .font('Helvetica-Bold')
      .fontSize(8.3)
      .fillColor('#0F172A')
      .text(goal, 48, y + 6, { width: 180 });
    doc
      .font('Helvetica')
      .fontSize(8.3)
      .fillColor('#334155')
      .text(loc, 235, y + 6, { width: 145 });
    doc
      .font('Helvetica-Bold')
      .fontSize(8.3)
      .fillColor('#3730A3')
      .text(action, 385, y + 6, { width: 165 });
    y += 22;
  }

  drawPageFooter(3);
  doc.end();
}


