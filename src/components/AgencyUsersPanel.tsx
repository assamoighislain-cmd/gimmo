import React, { useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit3,
  Trash2,
  MessageCircle,
  RefreshCw,
  Search,
  Lock,
  X,
} from 'lucide-react';
import {
  type SaaSUserAccount,
  type SaaSTenantAgency,
  ROLE_PERMISSIONS,
} from '../types/gimmo.ts';
import {
  type DocumentTemplatesStore,
  resolveSaaSTenants,
  resolveSaaSUsers,
} from '../lib/document-templates.ts';
import { executeMutation } from '../lib/offline-manager.ts';
import { sanitizeWhatsAppNumber } from '../lib/agency-notifications.ts';
import { generateLandlordPortalPassword } from '../lib/landlord-portal.ts';

interface AgencyUsersPanelProps {
  templatesStore?: DocumentTemplatesStore;
  activeAccount: SaaSUserAccount | null;
  onSuccess: () => Promise<void> | void;
}

const ASSIGNABLE_ROLE_LABELS: Record<SaaSUserAccount['role'], string> = {
  super_admin: 'Administrateur (Super Admin)',
  agency_admin: 'Directeur d’Agence',
  manager: 'Gestionnaire Locatif',
  agent: 'Agent Immobilier',
};

function buildCollaboratorWhatsAppUrl(params: {
  user: SaaSUserAccount;
  password: string;
  agencyName: string;
}): string {
  const rawPhone = (params.user.whatsappPhone || '').split('/')[0].trim();
  const digits = sanitizeWhatsAppNumber(rawPhone, '225');
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const roleLabel =
    ASSIGNABLE_ROLE_LABELS[params.user.role] || params.user.role;

  const message = [
    `*COMPTE COLLABORATEUR — ${params.agencyName.toUpperCase()}*`,
    ``,
    `Bonjour *${params.user.fullName}*,`,
    `Votre compte utilisateur a été créé et configuré par la direction.`,
    ``,
    `🔗 *Lien de connexion* : ${origin}`,
    `👤 *Email (Identifiant)* : ${params.user.email}`,
    `🔑 *Mot de passe* : ${params.password}`,
    `🛡️ *Rôle attribué* : ${roleLabel}`,
    ``,
    `Cordialement,`,
    `*${params.agencyName}*`,
  ].join('\n');

  if (!digits || digits.length < 8) {
    return '';
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const AgencyUsersPanel: React.FC<AgencyUsersPanelProps> = ({
  templatesStore,
  activeAccount,
  onSuccess,
}) => {
  const allTenants = resolveSaaSTenants(templatesStore);
  const allUsers = resolveSaaSUsers(templatesStore);

  const isSuperAdmin = Boolean(
    activeAccount &&
      (activeAccount.role === 'super_admin' ||
        activeAccount.email.trim().toLowerCase() ===
          'assamoighislain@gmail.com')
  );
  const isAgencyDirector = activeAccount?.role === 'agency_admin';
  const canManageUsers = isSuperAdmin || isAgencyDirector;

  const currentAgency: SaaSTenantAgency | undefined = useMemo(() => {
    if (!activeAccount) return allTenants[0];
    return (
      allTenants.find((t) => t.id === activeAccount.tenantId) ||
      allTenants.find(
        (t) =>
          t.companyName.trim().toLowerCase() ===
          activeAccount.tenantName.trim().toLowerCase()
      ) ||
      allTenants.find((t) => t.isCurrentTenant) ||
      allTenants[0]
    );
  }, [activeAccount, allTenants]);

  // Liste filtrée selon le périmètre de l'utilisateur connecté
  const scopedUsers = useMemo(() => {
    if (!canManageUsers || !activeAccount) return [];
    if (isSuperAdmin) {
      return allUsers;
    }
    return allUsers.filter(
      (u) =>
        u.role !== 'super_admin' &&
        u.email.trim().toLowerCase() !== 'assamoighislain@gmail.com' &&
        (u.tenantId === activeAccount.tenantId ||
          u.tenantName.trim().toLowerCase() ===
            activeAccount.tenantName.trim().toLowerCase())
    );
  }, [allUsers, canManageUsers, isSuperAdmin, activeAccount]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() =>
    generateLandlordPortalPassword()
  );
  const [showFormPassword, setShowFormPassword] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('+225 ');
  const [role, setRole] = useState<SaaSUserAccount['role']>('manager');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    () => currentAgency?.id || allTenants[0]?.id || 'tenant_gimmo_prestige'
  );
  const [status, setStatus] = useState<SaaSUserAccount['status']>('active');

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<
    'all' | 'agency_admin' | 'manager' | 'agent'
  >('all');
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<
    Record<string, boolean>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    whatsappUrl?: string;
    collaboratorLabel?: string;
  } | null>(null);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return scopedUsers.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.tenantName.toLowerCase().includes(q)
      );
    });
  }, [scopedUsers, searchTerm, roleFilter]);

  if (!canManageUsers) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
        <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700">
          <p className="font-bold text-slate-900">
            Gestion des Comptes Utilisateurs & Affectation des Rôles (Accès Restreint)
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Seul l’<strong>Administrateur</strong> ou le{' '}
            <strong>Directeur de l’Agence</strong> est habilité à créer les comptes des autres utilisateurs et à leur affecter des rôles.
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setEmail('');
    setPassword(generateLandlordPortalPassword());
    setWhatsappPhone('+225 ');
    setRole('manager');
    setSelectedTenantId(
      currentAgency?.id || allTenants[0]?.id || 'tenant_gimmo_prestige'
    );
    setStatus('active');
  };

  const handleStartEdit = (user: SaaSUserAccount) => {
    setEditingId(user.id);
    setFullName(user.fullName);
    setEmail(user.email);
    setPassword(user.password || generateLandlordPortalPassword());
    setWhatsappPhone(user.whatsappPhone || '+225 ');
    setRole(
      !isSuperAdmin && user.role === 'super_admin' ? 'agency_admin' : user.role
    );
    setSelectedTenantId(user.tenantId);
    setStatus(user.status);
    setFeedback(null);
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    setFeedback(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanWhatsapp = whatsappPhone.trim();

    if (!cleanName || !cleanEmail) {
      setFeedback({
        type: 'error',
        message:
          'Veuillez renseigner le nom complet et l’adresse email professionnelle de l’utilisateur.',
      });
      return;
    }

    if (!cleanPassword || cleanPassword.length < 4) {
      setFeedback({
        type: 'error',
        message:
          'Veuillez définir un mot de passe d’au moins 4 caractères pour ce compte utilisateur.',
      });
      return;
    }

    if (!isSuperAdmin && role === 'super_admin') {
      setFeedback({
        type: 'error',
        message:
          'Un Directeur d’Agence ne peut affecter que les rôles Directeur d’Agence, Gestionnaire Locatif ou Agent Immobilier.',
      });
      return;
    }

    const duplicate = allUsers.find(
      (u) =>
        u.id !== editingId && u.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicate) {
      setFeedback({
        type: 'error',
        message: `Un compte utilisateur existe déjà avec l’adresse email « ${cleanEmail} ».`,
      });
      return;
    }

    const targetAgency = isSuperAdmin
      ? allTenants.find((t) => t.id === selectedTenantId) || currentAgency
      : currentAgency;

    setSubmitting(true);
    try {
      const payload = {
        id: editingId || undefined,
        fullName: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        whatsappPhone:
          cleanWhatsapp && cleanWhatsapp !== '+225' ? cleanWhatsapp : undefined,
        role,
        tenantId: targetAgency?.id || activeAccount.tenantId,
        tenantName: targetAgency?.companyName || activeAccount.tenantName,
        status,
        createdByEmail: activeAccount.email,
        actorRole: activeAccount.role,
        actorEmail: activeAccount.email,
        actorTenantId: activeAccount.tenantId,
      };

      const res = await executeMutation(
        '/api/saas/users',
        'POST',
        payload,
        editingId
          ? `Modification compte ${cleanName} (${ASSIGNABLE_ROLE_LABELS[role]})`
          : `Création compte ${cleanName} (${ASSIGNABLE_ROLE_LABELS[role]})`
      );

      if (!res.ok) {
        setFeedback({
          type: 'error',
          message:
            res.error || 'Impossible d’enregistrer ce compte utilisateur.',
        });
        return;
      }

      const previewUser: SaaSUserAccount = {
        id: editingId || 'new',
        fullName: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        whatsappPhone: payload.whatsappPhone,
        role,
        tenantId: payload.tenantId,
        tenantName: payload.tenantName,
        status,
        createdAt: new Date().toISOString(),
      };

      const waUrl = buildCollaboratorWhatsAppUrl({
        user: previewUser,
        password: cleanPassword,
        agencyName: payload.tenantName,
      });

      setFeedback({
        type: 'success',
        message: editingId
          ? `Compte de « ${cleanName} » mis à jour avec le rôle « ${ASSIGNABLE_ROLE_LABELS[role]} ».`
          : `Compte créé pour « ${cleanName} » avec le rôle « ${ASSIGNABLE_ROLE_LABELS[role]} ».`,
        whatsappUrl: waUrl || undefined,
        collaboratorLabel: cleanName,
      });

      resetForm();
      await onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickRoleChange = async (
    targetUser: SaaSUserAccount,
    nextRole: SaaSUserAccount['role']
  ) => {
    if (!activeAccount || targetUser.role === nextRole) return;
    setFeedback(null);
    setBusyUserId(targetUser.id);
    try {
      const res = await executeMutation(
        '/api/saas/users',
        'POST',
        {
          ...targetUser,
          role: nextRole,
          actorRole: activeAccount.role,
          actorEmail: activeAccount.email,
          actorTenantId: activeAccount.tenantId,
        },
        `Affectation du rôle ${ASSIGNABLE_ROLE_LABELS[nextRole]} à ${targetUser.fullName}`
      );
      if (!res.ok) {
        setFeedback({
          type: 'error',
          message: res.error || 'Impossible de modifier le rôle.',
        });
        return;
      }
      setFeedback({
        type: 'success',
        message: `Rôle de « ${targetUser.fullName} » mis à jour : ${ASSIGNABLE_ROLE_LABELS[nextRole]}.`,
      });
      await onSuccess();
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleStatus = async (targetUser: SaaSUserAccount) => {
    if (!activeAccount) return;
    const nextStatus: SaaSUserAccount['status'] =
      targetUser.status === 'active' ? 'suspended' : 'active';
    setFeedback(null);
    setBusyUserId(targetUser.id);
    try {
      const res = await executeMutation(
        '/api/saas/users',
        'POST',
        {
          ...targetUser,
          status: nextStatus,
          actorRole: activeAccount.role,
          actorEmail: activeAccount.email,
          actorTenantId: activeAccount.tenantId,
        },
        `${nextStatus === 'active' ? 'Activation' : 'Suspension'} du compte ${targetUser.fullName}`
      );
      if (!res.ok) {
        setFeedback({
          type: 'error',
          message: res.error || 'Impossible de modifier le statut du compte.',
        });
        return;
      }
      setFeedback({
        type: 'success',
        message: `Compte de « ${targetUser.fullName} » ${nextStatus === 'active' ? 'réactivé' : 'suspendu'}.`,
      });
      await onSuccess();
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetUserPassword = async (targetUser: SaaSUserAccount) => {
    if (!activeAccount) return;
    const nextPass = generateLandlordPortalPassword();
    setFeedback(null);
    setBusyUserId(targetUser.id);
    try {
      const res = await executeMutation(
        '/api/saas/users',
        'POST',
        {
          ...targetUser,
          password: nextPass,
          actorRole: activeAccount.role,
          actorEmail: activeAccount.email,
          actorTenantId: activeAccount.tenantId,
        },
        `Réinitialisation du mot de passe de ${targetUser.fullName}`
      );
      if (!res.ok) {
        setFeedback({
          type: 'error',
          message:
            res.error || 'Impossible de réinitialiser le mot de passe.',
        });
        return;
      }
      setVisiblePasswords((prev) => ({ ...prev, [targetUser.id]: true }));
      const waUrl = buildCollaboratorWhatsAppUrl({
        user: { ...targetUser, password: nextPass },
        password: nextPass,
        agencyName: targetUser.tenantName,
      });
      setFeedback({
        type: 'success',
        message: `Nouveau mot de passe généré (${nextPass}) pour « ${targetUser.fullName} ».`,
        whatsappUrl: waUrl || undefined,
        collaboratorLabel: targetUser.fullName,
      });
      await onSuccess();
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (targetUser: SaaSUserAccount) => {
    if (!activeAccount) return;
    setFeedback(null);
    setBusyUserId(targetUser.id);
    try {
      const res = await executeMutation(
        `/api/saas/users/${encodeURIComponent(targetUser.id)}`,
        'DELETE',
        {
          actorRole: activeAccount.role,
          actorEmail: activeAccount.email,
          actorTenantId: activeAccount.tenantId,
        },
        `Suppression du compte utilisateur ${targetUser.fullName}`
      );
      if (!res.ok) {
        setFeedback({
          type: 'error',
          message: res.error || 'Impossible de supprimer ce compte.',
        });
        return;
      }
      setConfirmDeleteId(null);
      if (editingId === targetUser.id) {
        resetForm();
      }
      setFeedback({
        type: 'success',
        message: `Compte utilisateur « ${targetUser.fullName} » supprimé.`,
      });
      await onSuccess();
    } finally {
      setBusyUserId(null);
    }
  };

  const selectedRolePerm = ROLE_PERMISSIONS[role];

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* En-tête de gouvernance des utilisateurs */}
      <div className="bg-indigo-950 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900">
        <div>
          <h3 className="text-base sm:text-lg font-bold tracking-tight">
            Gestion des Comptes Utilisateurs & Affectation des Rôles
          </h3>
          <p className="text-xs text-indigo-200 mt-0.5">
            Réservé exclusivement à l’Administrateur et au Directeur de l’Agence ·{' '}
            {isSuperAdmin
              ? 'Périmètre : Toutes les agences'
              : `Agence : ${currentAgency?.companyName || activeAccount?.tenantName}`}
          </p>
        </div>

        <div className="text-xs text-indigo-100 font-mono tabular-nums shrink-0">
          {scopedUsers.length} compte{scopedUsers.length > 1 ? 's' : ''} actif
          {scopedUsers.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {feedback && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span className="font-semibold">{feedback.message}</span>
            <div className="flex items-center gap-2 shrink-0">
              {feedback.whatsappUrl && (
                <a
                  href={feedback.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>
                    Envoyer Accès WhatsApp ({feedback.collaboratorLabel})
                  </span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-1 rounded hover:bg-black/5 text-current"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Formulaire de création / modification de compte collaborateur & affectation de rôle */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-700 shrink-0" />
              <h4 className="text-sm font-bold text-slate-900">
                {editingId
                  ? 'Modifier le compte utilisateur et son rôle'
                  : 'Créer un compte collaborateur et lui affecter un rôle'}
              </h4>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                Annuler la modification
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Nom & Prénom de l’utilisateur *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Konan Aya Marie"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Email professionnel (Identifiant) *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: a.konan@agence.ci"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Mot de passe de connexion *
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword((prev) => !prev)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                    title={
                      showFormPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {showFormPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPassword(generateLandlordPortalPassword())}
                  className="px-2.5 py-2 font-semibold text-indigo-800 bg-white border border-slate-300 rounded-lg hover:bg-indigo-50 whitespace-nowrap shrink-0"
                >
                  Générer
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Rôle à affecter *
              </label>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as SaaSUserAccount['role'])
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-indigo-950 focus:outline-none focus:border-indigo-600"
              >
                <option value="manager">Gestionnaire Locatif</option>
                <option value="agent">Agent Immobilier</option>
                <option value="agency_admin">Directeur d’Agence</option>
                {isSuperAdmin && (
                  <option value="super_admin">
                    Administrateur (Super Admin)
                  </option>
                )}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Téléphone WhatsApp (Envoi des accès)
              </label>
              <input
                type="tel"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="Ex: +225 07 00 00 00 00"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            {isSuperAdmin ? (
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Agence de rattachement *
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  {allTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.companyName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Agence de rattachement (Verrouillée)
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentAgency?.companyName || activeAccount?.tenantName || ''}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-600 cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Aperçu sobre des droits du rôle sélectionné */}
          <div className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-900">
                Droits du rôle « {selectedRolePerm.label} » :
              </span>{' '}
              <span>
                Biens, Baux & Quittances
                {selectedRolePerm.canAccessRecovery ? ' · Recouvrement' : ''}
                {selectedRolePerm.canAccessSettings ? ' · Paramétrage' : ''}
                {selectedRolePerm.canManageAgencyUsers
                  ? ' · Création d’utilisateurs & Rôles'
                  : ' · Sans création d’utilisateurs'}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[40px] px-4 py-2 bg-indigo-950 hover:bg-indigo-900 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {submitting
                  ? 'Enregistrement...'
                  : editingId
                    ? 'Enregistrer le compte & le rôle'
                    : 'Créer le compte & affecter le rôle'}
              </span>
            </button>
          </div>
        </form>

        {/* Barre de recherche et filtre par rôle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un collaborateur ou email..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Tous' },
                { id: 'agency_admin', label: 'Directeurs' },
                { id: 'manager', label: 'Gestionnaires' },
                { id: 'agent', label: 'Agents' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoleFilter(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  roleFilter === item.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau des comptes utilisateurs et affectation directe des rôles */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="py-3 px-4">Collaborateur</th>
                  {isSuperAdmin && <th className="py-3 px-4">Agence</th>}
                  <th className="py-3 px-4">Rôle affecté</th>
                  <th className="py-3 px-4">Identifiants de connexion</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSuperAdmin ? 6 : 5}
                      className="py-8 text-center text-slate-500 font-medium"
                    >
                      Aucun compte collaborateur trouvé pour ce filtre. Utilisez le formulaire ci-dessus pour créer un utilisateur et lui affecter un rôle.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isProtectedSuperAdmin =
                      u.email.trim().toLowerCase() ===
                      'assamoighislain@gmail.com';
                    const isSelf =
                      activeAccount?.email.trim().toLowerCase() ===
                      u.email.trim().toLowerCase();
                    const isPassShown = Boolean(visiblePasswords[u.id]);
                    const waUrl = u.password
                      ? buildCollaboratorWhatsAppUrl({
                          user: u,
                          password: u.password,
                          agencyName: u.tenantName,
                        })
                      : '';

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4 align-top">
                          <div className="font-bold text-slate-900 text-sm">
                            {u.fullName}
                            {isSelf ? (
                              <span className="ml-1.5 text-xs font-normal text-indigo-700">
                                · Vous
                              </span>
                            ) : null}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            {u.email}
                            {u.whatsappPhone ? ` · ${u.whatsappPhone}` : ''}
                          </div>
                        </td>

                        {isSuperAdmin && (
                          <td className="py-3 px-4 align-top font-semibold text-slate-800">
                            {u.tenantName}
                          </td>
                        )}

                        <td className="py-3 px-4 align-top">
                          {isProtectedSuperAdmin || isSelf ? (
                            <span className="font-bold text-indigo-950">
                              {ASSIGNABLE_ROLE_LABELS[u.role]}
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              disabled={busyUserId === u.id}
                              onChange={(e) =>
                                handleQuickRoleChange(
                                  u,
                                  e.target.value as SaaSUserAccount['role']
                                )
                              }
                              aria-label={`Rôle de ${u.fullName}`}
                              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                            >
                              <option value="manager">
                                Gestionnaire Locatif
                              </option>
                              <option value="agent">Agent Immobilier</option>
                              <option value="agency_admin">
                                Directeur d’Agence
                              </option>
                              {isSuperAdmin && (
                                <option value="super_admin">
                                  Administrateur (Super Admin)
                                </option>
                              )}
                            </select>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top font-mono">
                          {u.password ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">MDP :</span>
                              <strong className="text-slate-900">
                                {isPassShown ? u.password : '••••••••'}
                              </strong>
                              <button
                                type="button"
                                onClick={() =>
                                  setVisiblePasswords((prev) => ({
                                    ...prev,
                                    [u.id]: !prev[u.id],
                                  }))
                                }
                                className="p-1 text-slate-500 hover:text-slate-900 rounded"
                                title={
                                  isPassShown
                                    ? 'Masquer le mot de passe'
                                    : 'Afficher le mot de passe'
                                }
                              >
                                {isPassShown ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(
                                    `usr_${u.id}`,
                                    `Email : ${u.email}\nMot de passe : ${u.password}\nRôle : ${ASSIGNABLE_ROLE_LABELS[u.role]}`
                                  )
                                }
                                className="p-1 text-slate-500 hover:text-indigo-700 rounded"
                                title="Copier les identifiants"
                              >
                                {copiedKey === `usr_${u.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={busyUserId === u.id}
                              onClick={() => handleResetUserPassword(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md font-sans font-semibold whitespace-nowrap"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Générer MDP</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top">
                          <span
                            className={`font-semibold ${
                              u.status === 'active'
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {u.status === 'active' ? 'Actif' : 'Suspendu'}
                          </span>
                        </td>

                        <td className="py-3 px-4 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold transition-colors whitespace-nowrap"
                                title="Envoyer le compte, le mot de passe et le rôle par WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            {!isProtectedSuperAdmin && (
                              <button
                                type="button"
                                disabled={busyUserId === u.id}
                                onClick={() => handleResetUserPassword(u)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors whitespace-nowrap"
                                title="Générer un nouveau mot de passe"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    busyUserId === u.id ? 'animate-spin' : ''
                                  }`}
                                />
                                <span>Nouveau MDP</span>
                              </button>
                            )}

                            {!isProtectedSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md font-semibold transition-colors whitespace-nowrap"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Modifier</span>
                              </button>
                            )}

                            {!isProtectedSuperAdmin && !isSelf && (
                              <button
                                type="button"
                                disabled={busyUserId === u.id}
                                onClick={() => handleToggleStatus(u)}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md font-semibold transition-colors whitespace-nowrap"
                              >
                                {u.status === 'active'
                                  ? 'Suspendre'
                                  : 'Réactiver'}
                              </button>
                            )}

                            {!isProtectedSuperAdmin && !isSelf && (
                              <>
                                {confirmDeleteId === u.id ? (
                                  <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-md px-2 py-1">
                                    <button
                                      type="button"
                                      disabled={busyUserId === u.id}
                                      onClick={() => handleDelete(u)}
                                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded whitespace-nowrap"
                                    >
                                      Confirmer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 font-semibold rounded whitespace-nowrap"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(u.id)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                    title="Supprimer ce compte utilisateur"
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
