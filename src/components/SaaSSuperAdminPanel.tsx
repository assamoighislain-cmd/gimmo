import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  Crown,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Layers,
  TrendingUp,
  UserPlus,
  Check,
  X,
  Sparkles,
  Volume2,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  type SaaSTenantAgency,
  type SaaSUserAccount,
  ROLE_PERMISSIONS,
} from '../types/gimmo';
import {
  type DocumentTemplatesStore,
  resolveSaaSTenants,
  resolveSaaSUsers,
  resolveManagementCompany,
} from '../lib/document-templates';
import { executeMutation } from '../lib/offline-manager';
import {
  WHATSAPP_COUNTRY_RULES,
  validateWhatsAppPhone,
  playAgencyCreatedSound,
  buildAgencyCreatedWhatsAppDetails,
  buildAgencyApprovedWhatsAppDetails,
} from '../lib/agency-notifications';
import { generateLandlordPortalPassword } from '../lib/landlord-portal';

interface SaaSSuperAdminPanelProps {
  templatesStore?: DocumentTemplatesStore;
  activeAccount?: SaaSUserAccount | null;
  totalPropertiesCount: number;
  totalLandlordsCount: number;
  onSuccess: () => void;
}

const PLAN_DETAILS: Record<
  SaaSTenantAgency['plan'],
  { label: string; badgeClass: string; defaultFee: number; maxProps: number; maxLandlords: number }
> = {
  starter: {
    label: 'Starter (Essentiel)',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    defaultFee: 35000,
    maxProps: 30,
    maxLandlords: 10,
  },
  pro: {
    label: 'Pro Agence',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultFee: 75000,
    maxProps: 150,
    maxLandlords: 35,
  },
  enterprise: {
    label: 'Enterprise Multi-Agences',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    defaultFee: 150000,
    maxProps: 500,
    maxLandlords: 100,
  },
};

const ROLE_LABELS: Record<
  SaaSUserAccount['role'],
  { label: string; badge: string }
> = {
  super_admin: {
    label: 'Super Admin SaaS',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  agency_admin: {
    label: 'Directeur d’Agence',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  },
  manager: {
    label: 'Gestionnaire Locatif',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  agent: {
    label: 'Agent Immobilier Terrain',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
  },
};

export const SaaSSuperAdminPanel: React.FC<SaaSSuperAdminPanelProps> = ({
  templatesStore,
  activeAccount,
  totalPropertiesCount,
  totalLandlordsCount,
  onSuccess,
}) => {
  const tenants = resolveSaaSTenants(templatesStore);
  const users = resolveSaaSUsers(templatesStore);
  const activeCompany = resolveManagementCompany(templatesStore);

  const currentRole = activeAccount?.role || 'agent';
  const rolePermissions = ROLE_PERMISSIONS[currentRole];
  const isSuperAdmin = Boolean(
    activeAccount &&
      rolePermissions.canViewSaaSConsole &&
      (currentRole === 'super_admin' ||
        activeAccount.email.trim().toLowerCase() === 'assamoighislain@gmail.com')
  );

  const [activeSubTab, setActiveSubTab] = useState<'tenants' | 'users' | 'plans'>('tenants');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Formulaire Agence SaaS (Tenant)
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [confirmDeleteTenantId, setConfirmDeleteTenantId] = useState<string | null>(null);
  const [tenantPhoneCountry, setTenantPhoneCountry] = useState<string>('225');
  const [tenantForm, setTenantForm] = useState({
    companyName: '',
    tradeName: '',
    legalForm: 'SARL au capital de 10 000 000 FCFA',
    rccm: '',
    taxId: '',
    licenseNumber: '',
    managerName: '',
    ownerEmail: '',
    phone: '',
    address: '',
    city: 'Abidjan',
    plan: 'pro' as SaaSTenantAgency['plan'],
    status: 'active' as SaaSTenantAgency['status'],
    monthlyFeeFcfa: 75000,
    maxProperties: 150,
    maxLandlords: 35,
    subscriptionEndsAt: '2027-12-31',
    isCurrentTenant: false,
  });

  // Formulaire Utilisateur SaaS (RBAC)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'agency_admin' as SaaSUserAccount['role'],
    tenantId: tenants[0]?.id || 'tenant_gimmo_prestige',
    status: 'active' as SaaSUserAccount['status'],
  });

  // Seul l'administrateur (Super Admin) a le droit de voir "Système SaaS Multi-Agences & Console Super Administrateur"
  if (!isSuperAdmin) {
    return null;
  }

  // Calculs KPIs SaaS
  const mrrFcfa = tenants
    .filter((t) => t.status === 'active')
    .reduce((sum, t) => sum + Number(t.monthlyFeeFcfa || 0), 0);
  const arrFcfa = mrrFcfa * 12;
  const activeTenantsCount = tenants.filter((t) => t.status === 'active').length;
  const superAdminsCount = users.filter((u) => u.role === 'super_admin').length;

  const openNewTenantForm = () => {
    setEditingTenantId(null);
    setTenantPhoneCountry('225');
    setTenantForm({
      companyName: '',
      tradeName: '',
      legalForm: 'SARL au capital de 10 000 000 FCFA',
      rccm: 'CI-ABJ-03-2026-B12-00500',
      taxId: 'CC 2600500 M',
      licenseNumber: 'Agrément MCLU N° 0250/MCLU/AG',
      managerName: '',
      ownerEmail: '',
      phone: '',
      address: 'Cocody Riviera',
      city: 'Abidjan',
      plan: 'pro',
      status: 'active',
      monthlyFeeFcfa: 75000,
      maxProperties: 150,
      maxLandlords: 35,
      subscriptionEndsAt: '2027-12-31',
      isCurrentTenant: false,
    });
    setShowTenantForm(true);
  };

  const openEditTenantForm = (tenant: SaaSTenantAgency) => {
    const rawPhone = tenant.whatsappPhone || tenant.phone || '';
    const check = validateWhatsAppPhone(rawPhone, '225');
    setEditingTenantId(tenant.id);
    setTenantPhoneCountry(check.countryCode || '225');
    setTenantForm({
      companyName: tenant.companyName,
      tradeName: tenant.tradeName,
      legalForm: tenant.legalForm,
      rccm: tenant.rccm,
      taxId: tenant.taxId,
      licenseNumber: tenant.licenseNumber,
      managerName: tenant.managerName,
      ownerEmail: tenant.ownerEmail,
      phone: rawPhone,
      address: tenant.address,
      city: tenant.city,
      plan: tenant.plan,
      status: tenant.status,
      monthlyFeeFcfa: tenant.monthlyFeeFcfa,
      maxProperties: tenant.maxProperties,
      maxLandlords: tenant.maxLandlords,
      subscriptionEndsAt: tenant.subscriptionEndsAt,
      isCurrentTenant: tenant.isCurrentTenant,
    });
    setShowTenantForm(true);
  };

  const handlePlanSelect = (plan: SaaSTenantAgency['plan']) => {
    const info = PLAN_DETAILS[plan];
    setTenantForm((prev) => ({
      ...prev,
      plan,
      monthlyFeeFcfa: info.defaultFee,
      maxProperties: info.maxProps,
      maxLandlords: info.maxLandlords,
    }));
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isSuperAdmin) {
      setFeedback({
        type: 'error',
        message:
          'Restriction de rôle : Seul le Super Admin (assamoighislain@gmail.com) a le droit de créer, modifier ou approuver une agence immobilière.',
      });
      return;
    }

    if (!tenantForm.companyName.trim()) {
      setFeedback({ type: 'error', message: 'La raison sociale de l’agence est requise.' });
      return;
    }

    const normalizedName = tenantForm.companyName.trim().toLowerCase();
    const duplicate = tenants.find(
      (t) =>
        t.id !== editingTenantId &&
        t.companyName.trim().toLowerCase() === normalizedName
    );
    if (duplicate) {
      setFeedback({
        type: 'error',
        message: `Le nom d’agence « ${tenantForm.companyName.trim()} » existe déjà. Le nom de l’agence immobilière est une clé unique.`,
      });
      return;
    }

    const waCheck = validateWhatsAppPhone(tenantForm.phone, tenantPhoneCountry);
    if (!waCheck.isValid) {
      setFeedback({
        type: 'error',
        message:
          waCheck.error ||
          'Le numéro WhatsApp de l’agence immobilière n’est pas conforme.',
      });
      return;
    }

    const res = await executeMutation('/api/saas/tenants', 'POST', {
      id: editingTenantId || undefined,
      ...tenantForm,
      phone: waCheck.formattedDisplay,
      whatsappPhone: waCheck.formattedDisplay,
      companyName: tenantForm.companyName.trim().toUpperCase(),
    });

    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error || 'Erreur sauvegarde agence SaaS' });
      return;
    }

    if (!editingTenantId) {
      playAgencyCreatedSound();
    }

    setFeedback({
      type: 'success',
      message: editingTenantId
        ? `Agence SaaS "${tenantForm.companyName}" mise à jour avec succès.`
        : `Nouvelle agence SaaS "${tenantForm.companyName}" créée avec succès (Notification sonore émise & message WhatsApp disponible).`,
    });
    setShowTenantForm(false);
    setEditingTenantId(null);
    onSuccess();
  };

  const handleApproveTenant = async (tenant: SaaSTenantAgency) => {
    setFeedback(null);
    if (!isSuperAdmin) {
      setFeedback({
        type: 'error',
        message:
          'Restriction : Seul le Super Admin (assamoighislain@gmail.com) a le droit d’approuver une agence immobilière.',
      });
      return;
    }

    const res = await executeMutation('/api/saas/tenants', 'POST', {
      ...tenant,
      status: 'active',
    });

    if (!res.ok) {
      setFeedback({
        type: 'error',
        message: res.error || 'Impossible d’approuver cette agence immobilière',
      });
      return;
    }

    playAgencyCreatedSound();

    setFeedback({
      type: 'success',
      message: `L’agence immobilière « ${tenant.companyName} » a été approuvée par le Super Admin. Vous pouvez lui envoyer la notification WhatsApp en 1 clic dans le tableau ci-dessous.`,
    });
    onSuccess();
  };

  const handleActivateTenantHeader = async (tenant: SaaSTenantAgency) => {
    setFeedback(null);
    if (tenant.status === 'pending_approval' && !isSuperAdmin) {
      setFeedback({
        type: 'error',
        message:
          'Cette agence est en attente d’approbation par le Super Admin.',
      });
      return;
    }

    const res = await executeMutation('/api/saas/tenants', 'POST', {
      ...tenant,
      status: tenant.status === 'pending_approval' && isSuperAdmin ? 'active' : tenant.status,
      isCurrentTenant: true,
    });

    if (!res.ok) {
      setFeedback({
        type: 'error',
        message: res.error || 'Impossible d’activer cette société de gestion',
      });
      return;
    }

    setFeedback({
      type: 'success',
      message: `La société "${tenant.companyName}" est désormais active et apparaît à l'en-tête de tous les documents PDF (Quittances, Baux, Rapports).`,
    });
    onSuccess();
  };

  const handleDeleteTenant = async (id: string) => {
    setFeedback(null);
    if (!isSuperAdmin) {
      setFeedback({
        type: 'error',
        message:
          'Restriction : Seul le Super Admin a le droit de supprimer une agence immobilière.',
      });
      return;
    }
    const res = await executeMutation(`/api/saas/tenants/${encodeURIComponent(id)}`, 'DELETE', {});
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error || 'Erreur suppression agence' });
      return;
    }
    setConfirmDeleteTenantId(null);
    setFeedback({ type: 'success', message: 'Agence cliente retirée du système SaaS.' });
    onSuccess();
  };

  const openNewUserForm = () => {
    setEditingUserId(null);
    setUserForm({
      fullName: '',
      email: '',
      password: generateLandlordPortalPassword(),
      role: 'agency_admin',
      tenantId: tenants.find((t) => t.isCurrentTenant)?.id || tenants[0]?.id || '',
      status: 'active',
    });
    setShowUserForm(true);
  };

  const openEditUserForm = (u: SaaSUserAccount) => {
    setEditingUserId(u.id);
    setUserForm({
      fullName: u.fullName,
      email: u.email,
      password: u.password || '',
      role: u.role,
      tenantId: u.tenantId,
      status: u.status,
    });
    setShowUserForm(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!userForm.fullName.trim() || !userForm.email.trim()) {
      setFeedback({ type: 'error', message: 'Nom complet et email sont requis.' });
      return;
    }

    const res = await executeMutation('/api/saas/users', 'POST', {
      id: editingUserId || undefined,
      ...userForm,
      password: userForm.password.trim() || undefined,
      actorRole: activeAccount?.role,
      actorEmail: activeAccount?.email,
      actorTenantId: activeAccount?.tenantId,
    });

    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error || 'Erreur sauvegarde utilisateur SaaS' });
      return;
    }

    setFeedback({
      type: 'success',
      message: `Compte utilisateur "${userForm.fullName}" (${ROLE_LABELS[userForm.role].label}) enregistré.`,
    });
    setShowUserForm(false);
    setEditingUserId(null);
    onSuccess();
  };

  const handleDeleteUser = async (u: SaaSUserAccount) => {
    if (u.email.toLowerCase() === 'assamoighislain@gmail.com') {
      setFeedback({
        type: 'error',
        message: 'Le compte Super Admin principal (assamoighislain@gmail.com) est protégé et ne peut pas être supprimé.',
      });
      return;
    }

    const res = await executeMutation(
      `/api/saas/users/${encodeURIComponent(u.id)}`,
      'DELETE',
      {
        actorRole: activeAccount?.role,
        actorEmail: activeAccount?.email,
        actorTenantId: activeAccount?.tenantId,
      }
    );
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error || 'Erreur suppression utilisateur' });
      return;
    }
    setConfirmDeleteUserId(null);
    setFeedback({ type: 'success', message: `Compte ${u.email} supprimé.` });
    onSuccess();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-xs overflow-hidden">
      {/* Bandeau Super Admin SaaS */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-md bg-amber-400 text-indigo-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold tracking-tight">
                Système SaaS Multi-Agences & Console Super Administrateur
              </h3>
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-400 text-indigo-950 rounded-sm">
                SUPER ADMIN : assamoighislain@gmail.com
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5">
              Pilotage global des sociétés de gestion abonnées (Tenants SaaS), des licences, des quotas de biens et des accès multi-rôles RBAC.
            </p>
          </div>
        </div>

        <div className="bg-indigo-900/70 border border-indigo-700/80 rounded-sm px-3.5 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">
            Société Active sur les En-têtes PDF
          </p>
          <p className="text-xs font-bold text-amber-300 truncate max-w-[260px]">
            {activeCompany.companyName}
          </p>
        </div>
      </div>

      {/* Cartes KPI SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
        <div className="bg-white border border-slate-200 rounded-sm p-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>REVENU MENSUEL SAAS (MRR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">
            {mrrFcfa.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            ARR Annuel : {arrFcfa.toLocaleString('fr-FR')} FCFA / an
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>SOCIÉTÉS DE GESTION (TENANTS)</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">
            {tenants.length} Agence(s)
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {activeTenantsCount} abonnement(s) actif(s) · {tenants.length - activeTenantsCount} en essai
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>COMPTES & RÔLES RBAC</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">
            {users.length} Utilisateur(s)
          </p>
          <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
            Dont {superAdminsCount} Super Admin (assamoighislain@gmail.com)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>QUOTAS INSTANCE ACTIVE</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">
            {totalPropertiesCount} Biens · {totalLandlordsCount} Bailleurs
          </p>
          <p className="text-[11px] text-indigo-700 font-semibold mt-0.5">
            Plan Enterprise Actif (Jusqu’à 500 biens)
          </p>
        </div>
      </div>

      {/* Sous-navigation SaaS */}
      <div className="px-5 pt-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('tenants')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'tenants'
                ? 'border-indigo-950 text-indigo-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            1. Sociétés de Gestion Clientes ({tenants.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'users'
                ? 'border-indigo-950 text-indigo-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            2. Comptes Utilisateurs & Super Admin ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('plans')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'plans'
                ? 'border-indigo-950 text-indigo-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            3. Rôles, Restrictions RBAC & Offres SaaS
          </button>
        </div>

        <div className="pb-2">
          {activeSubTab === 'tenants' && isSuperAdmin && (
            <button
              type="button"
              onClick={openNewTenantForm}
              className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              Ajouter une Société / Agence SaaS
            </button>
          )}
          {activeSubTab === 'users' && rolePermissions.canManageAgencyUsers && (
            <button
              type="button"
              onClick={openNewUserForm}
              className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              Créer un Compte Utilisateur
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {!isSuperAdmin && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-950 flex items-center justify-between gap-2">
            <div>
              <strong>Restriction active ({rolePermissions.label}) :</strong> Seul le Super Admin (<span className="font-mono">assamoighislain@gmail.com</span>) a le droit d’approuver, modifier ou supprimer une agence immobilière.
            </div>
          </div>
        )}

        {/* Bandeau de notification sonore & message WhatsApp pour les agences nouvellement créées */}
        {tenants.some((t) => t.status === 'pending_approval') && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-950">
                <Volume2 className="w-4 h-4 text-emerald-700" />
                <span>
                  Nouvelle(s) Agence(s) Immobilière(s) Créée(s) — En attente d’approbation du Super Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => playAgencyCreatedSound()}
                className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-sm text-[11px] font-bold inline-flex items-center gap-1"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                Tester la Notification Sonore
              </button>
            </div>
            <div className="space-y-2">
              {tenants
                .filter((t) => t.status === 'pending_approval')
                .map((pendingTenant) => {
                  const createdWa = buildAgencyCreatedWhatsAppDetails(pendingTenant);
                  return (
                    <div
                      key={pendingTenant.id}
                      className="p-2.5 bg-white border border-emerald-200 rounded-sm flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div>
                          <span className="font-extrabold text-indigo-950">
                            {pendingTenant.companyName}
                          </span>{' '}
                          <span className="text-slate-600">
                            · Directeur d’Agence : <strong>{pendingTenant.managerName}</strong> · WhatsApp :{' '}
                            <strong
                              className={
                                createdWa.isCompliant ? 'text-emerald-800' : 'text-rose-700'
                              }
                            >
                              {createdWa.whatsappPhone ||
                                pendingTenant.whatsappPhone ||
                                pendingTenant.phone}
                            </strong>
                          </span>
                        </div>
                        {!createdWa.isCompliant && (
                          <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {createdWa.validationError ||
                                'Numéro WhatsApp non conforme — cliquez sur Corriger N° WhatsApp.'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {createdWa.isCompliant ? (
                          <a
                            href={createdWa.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => playAgencyCreatedSound()}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Message WhatsApp Création
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditTenantForm(pendingTenant)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-sm text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Corriger N° WhatsApp
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleApproveTenant(pendingTenant)}
                            className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-white rounded-sm text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Approuver l’Agence
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`p-3 rounded-sm border text-xs font-medium flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ONGLET 1 : AGENCES CLIENTES SAAS (TENANTS) */}
        {activeSubTab === 'tenants' && (
          <div className="space-y-4">
            {showTenantForm && (
              <form
                onSubmit={handleSaveTenant}
                className="bg-slate-50 border border-indigo-200 rounded-sm p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                    {editingTenantId
                      ? 'Modifier la Société de Gestion (Tenant SaaS)'
                      : 'Enregistrer une Nouvelle Société de Gestion Cliente'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTenantForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Fermer
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Raison Sociale de la Société *
                    </label>
                    <input
                      type="text"
                      required
                      value={tenantForm.companyName}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, companyName: e.target.value })
                      }
                      placeholder="Ex: IVOIRE GESTION IMMOBILIÈRE SARL"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Enseigne Commerciale
                    </label>
                    <input
                      type="text"
                      value={tenantForm.tradeName}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, tradeName: e.target.value })
                      }
                      placeholder="Ex: IVOIRE GESTION"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Forme Juridique & Capital
                    </label>
                    <input
                      type="text"
                      value={tenantForm.legalForm}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, legalForm: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      N° RCCM
                    </label>
                    <input
                      type="text"
                      value={tenantForm.rccm}
                      onChange={(e) => setTenantForm({ ...tenantForm, rccm: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ID Fiscal / Compte Contribuable
                    </label>
                    <input
                      type="text"
                      value={tenantForm.taxId}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, taxId: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Agrément Ministériel
                    </label>
                    <input
                      type="text"
                      value={tenantForm.licenseNumber}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, licenseNumber: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nom du Gérant / Administrateur
                    </label>
                    <input
                      type="text"
                      value={tenantForm.managerName}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, managerName: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Email Administrateur Agence
                    </label>
                    <input
                      type="email"
                      value={tenantForm.ownerEmail}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, ownerEmail: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Numéro WhatsApp Conforme (E.164) *
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={tenantPhoneCountry}
                        onChange={(e) => setTenantPhoneCountry(e.target.value)}
                        className="w-36 shrink-0 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-semibold"
                      >
                        {WHATSAPP_COUNTRY_RULES.map((rule) => (
                          <option key={rule.code} value={rule.code}>
                            {rule.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        required
                        value={tenantForm.phone}
                        onChange={(e) =>
                          setTenantForm({ ...tenantForm, phone: e.target.value })
                        }
                        placeholder={
                          WHATSAPP_COUNTRY_RULES.find((r) => r.code === tenantPhoneCountry)
                            ?.placeholder || '07 08 09 10 11'
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-mono"
                      />
                    </div>
                    {tenantForm.phone.trim().length > 0 && (() => {
                      const check = validateWhatsAppPhone(
                        tenantForm.phone,
                        tenantPhoneCountry
                      );
                      return check.isValid ? (
                        <div className="mt-1 text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Conforme WhatsApp : {check.formattedDisplay}</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] font-semibold text-rose-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{check.error}</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Plan d’Abonnement SaaS
                    </label>
                    <select
                      value={tenantForm.plan}
                      onChange={(e) =>
                        handlePlanSelect(e.target.value as SaaSTenantAgency['plan'])
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-semibold"
                    >
                      <option value="starter">Starter (35 000 FCFA / mois)</option>
                      <option value="pro">Pro Agence (75 000 FCFA / mois)</option>
                      <option value="enterprise">Enterprise (150 000 FCFA / mois)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Redevance Mensuelle (FCFA)
                    </label>
                    <input
                      type="number"
                      value={tenantForm.monthlyFeeFcfa}
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          monthlyFeeFcfa: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Statut de Licence SaaS
                    </label>
                    <select
                      value={tenantForm.status}
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          status: e.target.value as SaaSTenantAgency['status'],
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-semibold"
                    >
                      <option value="active">Actif (Approuvée par Super Admin)</option>
                      <option value="pending_approval">En attente d’approbation</option>
                      <option value="trial">Période d’essai</option>
                      <option value="suspended">Suspendu</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-indigo-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tenantForm.isCurrentTenant}
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          isCurrentTenant: e.target.checked,
                        })
                      }
                      className="rounded-xs border-slate-300"
                    />
                    Définir immédiatement comme Société de Gestion active à l’en-tête de tous les documents PDF
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTenantForm(false)}
                      className="px-3 py-1.5 border border-slate-300 rounded-sm text-xs font-semibold text-slate-700 bg-white"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-950 text-white rounded-sm text-xs font-bold"
                    >
                      Enregistrer l’Agence SaaS
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3">Nom Unique de l’Agence</th>
                    <th className="py-2.5 px-3">Identifiants Légaux</th>
                    <th className="py-2.5 px-3">Directeur d’Agence</th>
                    <th className="py-2.5 px-3">Statut d’Approbation</th>
                    <th className="py-2.5 px-3">En-tête Documents</th>
                    <th className="py-2.5 px-3 text-right">Approbation & Actions Super Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {tenants.map((tenant) => {
                    const planInfo = PLAN_DETAILS[tenant.plan] || PLAN_DETAILS.pro;
                    const isHeaderActive =
                      activeCompany.companyName.toLowerCase() ===
                      tenant.companyName.toLowerCase();
                    const isPending = tenant.status === 'pending_approval';

                    return (
                      <tr
                        key={tenant.id}
                        className={
                          isPending
                            ? 'bg-amber-50/60'
                            : isHeaderActive
                              ? 'bg-indigo-50/40'
                              : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {tenant.companyName}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-sm text-slate-600">
                              Clé unique
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {tenant.legalForm} · {tenant.city}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                          <div>RCCM : {tenant.rccm}</div>
                          <div>ID Fiscal : {tenant.taxId}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">
                            {tenant.managerName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {tenant.ownerEmail}
                          </div>
                          {(() => {
                            const waDetails = isPending
                              ? buildAgencyCreatedWhatsAppDetails(tenant)
                              : buildAgencyApprovedWhatsAppDetails(tenant);
                            return waDetails.isCompliant ? (
                              <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                                <MessageCircle className="w-3 h-3 shrink-0" />
                                <span>WhatsApp : {waDetails.whatsappPhone}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>
                                  WhatsApp non conforme ({tenant.whatsappPhone || tenant.phone || 'vide'})
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-3">
                          {isPending ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm border bg-amber-100 text-amber-900 border-amber-300">
                              En attente d’approbation Super Admin
                            </span>
                          ) : tenant.status === 'suspended' ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm border bg-rose-100 text-rose-900 border-rose-300">
                              Suspendu
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm border bg-emerald-100 text-emerald-900 border-emerald-300">
                              Agence Approuvée ({planInfo.label})
                            </span>
                          )}
                          <div className="text-[11px] font-mono font-bold text-slate-800 mt-1">
                            {Number(tenant.monthlyFeeFcfa).toLocaleString('fr-FR')} FCFA/mois
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {isHeaderActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-sm text-[11px] font-bold">
                              <Check className="w-3.5 h-3.5" />
                              En-tête PDF Actif
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending && !isSuperAdmin}
                              onClick={() => handleActivateTenantHeader(tenant)}
                              className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-300 rounded-sm text-[11px] font-semibold transition-colors disabled:opacity-40"
                            >
                              Activer en En-tête PDF
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isSuperAdmin ? (
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                              {(() => {
                                const waDetails = isPending
                                  ? buildAgencyCreatedWhatsAppDetails(tenant)
                                  : buildAgencyApprovedWhatsAppDetails(tenant);
                                return waDetails.isCompliant ? (
                                  <a
                                    href={waDetails.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => playAgencyCreatedSound()}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-[11px] font-bold flex items-center gap-1"
                                    title="Envoyer la notification WhatsApp à cette agence"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    WhatsApp
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openEditTenantForm(tenant)}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-sm text-[11px] font-bold flex items-center gap-1"
                                    title={
                                      waDetails.validationError ||
                                      'Corriger le numéro WhatsApp non conforme'
                                    }
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    Corriger WhatsApp
                                  </button>
                                );
                              })()}
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveTenant(tenant)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-[11px] font-bold flex items-center gap-1 shadow-2xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Approuver l’Agence
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditTenantForm(tenant)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm text-[11px] font-semibold flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                Modifier
                              </button>
                              {confirmDeleteTenantId === tenant.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTenant(tenant.id)}
                                    className="px-2 py-1 bg-rose-600 text-white rounded-sm text-[11px] font-bold"
                                  >
                                    Confirmer ?
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteTenantId(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-700 rounded-sm text-[11px]"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTenantId(tenant.id)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-sm"
                                  title="Supprimer cette agence"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">
                              Réservé au Super Admin
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ONGLET 2 : UTILISATEURS & COMPTE SUPER ADMIN */}
        {activeSubTab === 'users' && (
          <div className="space-y-4">
            {showUserForm && (
              <form
                onSubmit={handleSaveUser}
                className="bg-slate-50 border border-indigo-200 rounded-sm p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                    {editingUserId
                      ? 'Modifier les Droits du Compte Utilisateur'
                      : 'Créer un Nouveau Compte Utilisateur SaaS'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowUserForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Fermer
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nom & Prénoms *
                    </label>
                    <input
                      type="text"
                      required
                      value={userForm.fullName}
                      onChange={(e) =>
                        setUserForm({ ...userForm, fullName: e.target.value })
                      }
                      placeholder="Ex: Kouadio Marc"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Adresse Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) =>
                        setUserForm({ ...userForm, email: e.target.value })
                      }
                      placeholder="Ex: collaborateur@agence.ci"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Mot de passe de connexion
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={userForm.password}
                        onChange={(e) =>
                          setUserForm({ ...userForm, password: e.target.value })
                        }
                        placeholder="Ex: GIM-4829-KP"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setUserForm((prev) => ({
                            ...prev,
                            password: generateLandlordPortalPassword(),
                          }))
                        }
                        className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold shrink-0"
                        title="Générer un mot de passe"
                      >
                        Générer
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Rôle & Niveau d’Accès RBAC
                    </label>
                    <select
                      value={userForm.role}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          role: e.target.value as SaaSUserAccount['role'],
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm font-semibold"
                    >
                      <option value="super_admin">Administrateur (Super Admin)</option>
                      <option value="agency_admin">Directeur d’Agence</option>
                      <option value="manager">Gestionnaire Locatif</option>
                      <option value="agent">Agent Immobilier</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Société de Gestion Rattachée
                    </label>
                    <select
                      value={userForm.tenantId}
                      onChange={(e) =>
                        setUserForm({ ...userForm, tenantId: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-sm"
                    >
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUserForm(false)}
                    className="px-3 py-1.5 border border-slate-300 rounded-sm text-xs font-semibold text-slate-700 bg-white"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-950 text-white rounded-sm text-xs font-bold"
                  >
                    Enregistrer le Compte
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3">Utilisateur</th>
                    <th className="py-2.5 px-3">Email de Connexion</th>
                    <th className="py-2.5 px-3">Rôle SaaS RBAC</th>
                    <th className="py-2.5 px-3">Société de Gestion Rattachée</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {users.map((u) => {
                    const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.manager;
                    const isPrimarySuperAdmin =
                      u.email.toLowerCase() === 'assamoighislain@gmail.com';

                    return (
                      <tr
                        key={u.id}
                        className={
                          isPrimarySuperAdmin ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                          {isPrimarySuperAdmin && (
                            <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span>{u.fullName}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {u.email}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm border ${roleInfo.badge}`}
                          >
                            {roleInfo.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {u.tenantName}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUserForm(u)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Modifier
                            </button>
                            {!isPrimarySuperAdmin && (
                              <>
                                {confirmDeleteUserId === u.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u)}
                                      className="px-2 py-1 bg-rose-600 text-white rounded-sm text-[11px] font-bold"
                                    >
                                      Confirmer ?
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUserId(null)}
                                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded-sm text-[11px]"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUserId(u.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-sm"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ONGLET 3 : MATRICE DES RÔLES & RESTRICTIONS RBAC + OFFRES SAAS */}
        {activeSubTab === 'plans' && (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-sm overflow-hidden">
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                  Matrice des Rôles & Restrictions d’Accès (RBAC)
                </span>
                <span className="text-[11px] font-semibold text-slate-600">
                  Chaque rôle possède ses restrictions propres
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white">
                {Object.values(ROLE_PERMISSIONS).map((spec) => (
                  <div
                    key={spec.role}
                    className="p-3.5 rounded-sm border border-slate-200 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-950">
                        {spec.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-sm border ${
                          spec.canApproveAgency
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {spec.canApproveAgency
                          ? 'Habilité à approuver une agence'
                          : 'Approbation d’agence interdite'}
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {spec.restrictionsSummary.map((line, i) => (
                        <li key={i}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-sm p-4 bg-slate-50">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-200 text-slate-800 rounded-sm">
                  Plan Starter
                </span>
                <h4 className="text-base font-black text-slate-900 mt-2">
                  35 000 FCFA <span className="text-xs font-normal text-slate-500">/ mois</span>
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Idéal pour les gestionnaires indépendants et cabinets en démarrage.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                  <li>• Jusqu’à 30 biens immobiliers géolocalisés</li>
                  <li>• Jusqu’à 10 bailleurs mandants</li>
                  <li>• En-tête personnalisé sur tous les PDF</li>
                  <li>• Quittances & Relances WhatsApp</li>
                </ul>
              </div>

              <div className="border-2 border-indigo-600 rounded-sm p-4 bg-indigo-50/30">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-600 text-white rounded-sm">
                  Plan Pro Agence
                </span>
                <h4 className="text-base font-black text-indigo-950 mt-2">
                  75 000 FCFA <span className="text-xs font-normal text-slate-500">/ mois</span>
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Conçu pour les agences immobilières agréées et administrateurs de biens.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                  <li>• Jusqu’à 150 biens immobiliers GPS PostGIS</li>
                  <li>• Jusqu’à 35 bailleurs mandants</li>
                  <li>• En-tête officiel de l’agence sur tous les PDF</li>
                  <li>• Mode Hors-Ligne & Synchronisation Temps Réel</li>
                </ul>
              </div>

              <div className="border-2 border-amber-400 rounded-sm p-4 bg-amber-50/30">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-400 text-indigo-950 rounded-sm">
                  Plan Enterprise & Super Admin
                </span>
                <h4 className="text-base font-black text-indigo-950 mt-2">
                  150 000 FCFA <span className="text-xs font-normal text-slate-500">/ mois</span>
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Architecture multi-sociétés complète pilotée par le Super Admin.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                  <li>• Jusqu’à 500+ biens & 100+ bailleurs</li>
                  <li>• Gestion multi-agences (Tenants SaaS illimités)</li>
                  <li>• Contrôle Super Admin (assamoighislain@gmail.com)</li>
                  <li>• Rapports financiers consolidés & API WhatsApp</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
