import React, { useState, useRef } from 'react';
import {
  X,
  LogIn,
  LogOut,
  Building2,
  UserCheck,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Lock,
  ShieldCheck,
  BookOpen,
  Clock,
  Volume2,
  MessageCircle,
} from 'lucide-react';
import {
  type SaaSTenantAgency,
  type SaaSUserAccount,
  ROLE_PERMISSIONS,
} from '../types/gimmo.ts';
import {
  type DocumentTemplatesStore,
  resolveSaaSTenants,
  resolveSaaSUsers,
} from '../lib/document-templates.ts';
import { executeMutation } from '../lib/offline-manager.ts';
import {
  playAgencyCreatedSound,
  buildAgencyCreatedWhatsAppDetails,
  validateWhatsAppPhone,
  WHATSAPP_COUNTRY_RULES,
  type AgencyWhatsAppNotification,
} from '../lib/agency-notifications.ts';

interface AuthAccountModalProps {
  templatesStore: DocumentTemplatesStore;
  activeAccount: SaaSUserAccount | null;
  onLoginSuccess: (account: SaaSUserAccount, agency: SaaSTenantAgency) => Promise<void>;
  onAgencyRegistered?: (updatedTemplates?: DocumentTemplatesStore) => Promise<void>;
  onLogout: () => Promise<void>;
  onGoogleLogin: (targetTenantId: string) => Promise<void>;
  onClose?: () => void;
  fullScreenPage?: boolean;
}

const ROLE_LABELS: Record<SaaSUserAccount['role'], string> = {
  super_admin: 'Super Admin SaaS',
  agency_admin: 'Directeur d’Agence',
  manager: 'Gestionnaire Locatif',
  agent: 'Agent Immobilier',
};

export const AuthAccountModal: React.FC<AuthAccountModalProps> = ({
  templatesStore,
  activeAccount,
  onLoginSuccess,
  onAgencyRegistered,
  onLogout,
  onGoogleLogin,
  onClose,
  fullScreenPage = false,
}) => {
  const tenants = resolveSaaSTenants(templatesStore);
  const users = resolveSaaSUsers(templatesStore);

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // État création de compte utilisateur (Rôle par défaut : Directeur d'Agence, sans menu déroulant Fonction)
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [whatsappCountryCode, setWhatsappCountryCode] = useState('225');
  const [newAgencyWhatsapp, setNewAgencyWhatsapp] = useState('');
  const [newAgencyName, setNewAgencyName] = useState('');
  const [newAgencyRccm, setNewAgencyRccm] = useState('');
  const [newAgencyTaxId, setNewAgencyTaxId] = useState('');
  const [newAgencyLocation, setNewAgencyLocation] = useState('Cocody Riviera, Abidjan');
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  const selectedCountryRule =
    WHATSAPP_COUNTRY_RULES.find((r) => r.code === whatsappCountryCode) ||
    WHATSAPP_COUNTRY_RULES[0];
  const liveWhatsappValidation = newAgencyWhatsapp.trim()
    ? validateWhatsAppPhone(newAgencyWhatsapp, whatsappCountryCode)
    : null;

  const typedAgencyCandidate = newAgencyName.trim().toUpperCase();
  const isDuplicateAgencyName = typedAgencyCandidate
    ? tenants.some((t) => t.companyName.trim().toUpperCase() === typedAgencyCandidate)
    : false;

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [approvalPendingNotice, setApprovalPendingNotice] = useState<string | null>(
    null
  );
  const [createdNotification, setCreatedNotification] =
    useState<AgencyWhatsAppNotification | null>(null);

  const defaultTenantId =
    activeAccount?.tenantId ||
    tenants.find((t) => t.isCurrentTenant)?.id ||
    tenants[0]?.id ||
    'tenant-gimmo-hq';

  const activateAccountAndAgency = async (user: SaaSUserAccount) => {
    setSubmitting(true);
    setErrorMsg(null);
    setApprovalPendingNotice(null);
    try {
      const linkedAgency =
        tenants.find((t) => t.id === user.tenantId) ||
        tenants.find(
          (t) =>
            t.companyName.trim().toLowerCase() ===
            user.tenantName.trim().toLowerCase()
        ) ||
        tenants.find((t) => t.isCurrentTenant) ||
        tenants[0];

      const isSuperAdmin =
        user.role === 'super_admin' ||
        user.email.trim().toLowerCase() === 'assamoighislain@gmail.com';

      // Vérifie si l'agence a été approuvée par le Super Admin
      if (!isSuperAdmin && linkedAgency?.status === 'pending_approval') {
        setApprovalPendingNotice(
          `L’agence immobilière « ${linkedAgency.companyName} » est actuellement en attente d’approbation. Seul le Super Admin (assamoighislain@gmail.com) a le droit d’approuver une agence immobilière.`
        );
        return;
      }

      if (!isSuperAdmin && linkedAgency?.status === 'suspended') {
        setErrorMsg(
          `L’agence immobilière « ${linkedAgency.companyName} » est suspendue par le Super Admin.`
        );
        return;
      }

      if (linkedAgency) {
        await executeMutation('/api/saas/tenants', 'POST', {
          ...linkedAgency,
          isCurrentTenant: true,
        });
      }

      await onLoginSuccess(user, linkedAgency);
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de connecter ce compte');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setApprovalPendingNotice(null);

    const normalizedEmail = loginEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMsg('Veuillez saisir votre adresse email professionnelle.');
      return;
    }

    const foundUser =
      normalizedEmail === 'assamoighislain@gmail.com'
        ? users.find(
            (u) =>
              u.email.trim().toLowerCase() === normalizedEmail &&
              u.role === 'super_admin'
          ) ||
          users.find((u) => u.email.trim().toLowerCase() === normalizedEmail)
        : [...users]
            .reverse()
            .find((u) => u.email.trim().toLowerCase() === normalizedEmail);

    if (foundUser) {
      if (foundUser.status === 'suspended') {
        setErrorMsg('Ce compte utilisateur est suspendu par l’administrateur.');
        return;
      }
      await activateAccountAndAgency(foundUser);
      return;
    }

    // Si c'est le Super Admin principal
    if (normalizedEmail === 'assamoighislain@gmail.com') {
      const chosenAgency =
        tenants.find((t) => t.isCurrentTenant) || tenants[0];
      const nowIso = new Date().toISOString();
      const superAdminAccount: SaaSUserAccount = {
        id: 'usr-super-admin-ghislain',
        fullName: 'Ghislain Assamoi',
        email: normalizedEmail,
        role: 'super_admin',
        tenantId: chosenAgency.id,
        tenantName: chosenAgency.companyName,
        status: 'active',
        lastLoginAt: nowIso,
        createdAt: nowIso.split('T')[0],
      };
      await executeMutation('/api/saas/users', 'POST', superAdminAccount).catch(
        () => {}
      );
      await activateAccountAndAgency(superAdminAccount);
      return;
    }

    setErrorMsg(
      'Aucun compte trouvé pour cette adresse email. Veuillez créer votre compte et enregistrer votre agence dans l’onglet « Créer un compte ».'
    );
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setApprovalPendingNotice(null);
    setCreatedNotification(null);

    if (!regFullName.trim()) {
      setErrorMsg('Veuillez saisir le nom et prénom du Directeur d’Agence.');
      return;
    }

    const waValidation = validateWhatsAppPhone(
      newAgencyWhatsapp,
      whatsappCountryCode
    );
    if (!waValidation.isValid) {
      setErrorMsg(
        waValidation.error ||
          'Le numéro WhatsApp saisi n’est pas conforme au format international WhatsApp.'
      );
      return;
    }

    const normalizedEmail = regEmail.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMsg(
        'Veuillez saisir une adresse email professionnelle valide (ex: direction@agence.ci).'
      );
      return;
    }

    if (!regPassword.trim()) {
      setErrorMsg('Veuillez saisir un mot de passe pour le compte de l’agence.');
      return;
    }

    if (!newAgencyName.trim()) {
      setErrorMsg('Veuillez saisir le nom unique de l’agence immobilière.');
      return;
    }

    // Clé unique : seul le nom de l'agence immobilière est une clé unique
    const typedAgencyUpper = newAgencyName.trim().toUpperCase();
    const duplicateAgency = tenants.find(
      (t) => t.companyName.trim().toUpperCase() === typedAgencyUpper
    );

    if (duplicateAgency) {
      setErrorMsg(
        `Le nom d’agence « ${typedAgencyUpper} » est déjà utilisé. Le nom de l’agence immobilière est une clé unique : veuillez saisir un autre nom d’agence.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const isSuperAdminEmail = normalizedEmail === 'assamoighislain@gmail.com';
      // Lorsque l'agence immobilière est créée pour la première fois, le rôle par défaut est Directeur d'Agence ('agency_admin')
      const assignedRole: SaaSUserAccount['role'] = isSuperAdminEmail
        ? 'super_admin'
        : 'agency_admin';

      // Seul le Super Admin a le droit d'approuver une agence : statut initial 'pending_approval'
      const initialAgencyStatus: SaaSTenantAgency['status'] = isSuperAdminEmail
        ? 'active'
        : 'pending_approval';

      const createdTenantId = `tenant-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const cleanWhatsapp = waValidation.formattedDisplay;

      const locParts = newAgencyLocation.split(',');
      const parsedAddress = locParts[0]?.trim() || 'Cocody Riviera';
      const parsedCity = locParts.slice(1).join(',').trim() || 'Abidjan';

      const newAgencyPayload: SaaSTenantAgency = {
        id: createdTenantId,
        companyName: typedAgencyUpper,
        tradeName: typedAgencyUpper,
        legalForm: 'SARL au capital de 5 000 000 FCFA',
        rccm: newAgencyRccm.trim() || 'CI-ABJ-2026-B-001',
        taxId: newAgencyTaxId.trim() || '2600001 A',
        licenseNumber: 'Agrément Ministériel N° 0188/MCLU/DGLCV',
        managerName: regFullName.trim(),
        ownerEmail: normalizedEmail,
        phone: cleanWhatsapp,
        whatsappPhone: cleanWhatsapp,
        address: parsedAddress,
        city: parsedCity,
        plan: 'pro',
        status: initialAgencyStatus,
        maxProperties: 100,
        maxLandlords: 25,
        monthlyFeeFcfa: 75000,
        subscriptionEndsAt: '2027-12-31',
        isCurrentTenant: isSuperAdminEmail,
        createdAt: nowIso.split('T')[0],
      };

      const tenantRes = await executeMutation(
        '/api/saas/tenants',
        'POST',
        newAgencyPayload,
        `Création agence ${newAgencyPayload.companyName}`
      );
      if (!tenantRes.ok) {
        throw new Error(
          tenantRes.error ||
            'Impossible d’enregistrer cette agence immobilière.'
        );
      }

      const newUserAccount: SaaSUserAccount = {
        id: `usr-${Date.now()}`,
        fullName: regFullName.trim(),
        email: normalizedEmail,
        whatsappPhone: cleanWhatsapp,
        role: assignedRole,
        tenantId: newAgencyPayload.id,
        tenantName: newAgencyPayload.companyName,
        status: 'active',
        lastLoginAt: nowIso,
        createdAt: nowIso.split('T')[0],
      };

      const userRes = await executeMutation(
        '/api/saas/users',
        'POST',
        newUserAccount,
        `Création compte Directeur d'Agence ${newUserAccount.fullName}`
      );

      const latestTemplates =
        (userRes.data?.templates as DocumentTemplatesStore | undefined) ||
        (tenantRes.data?.templates as DocumentTemplatesStore | undefined);

      await onAgencyRegistered?.(latestTemplates);

      // 1. Déclenchement immédiat de la notification sonore à la création de l'agence immobilière
      playAgencyCreatedSound();

      // 2. Préparation du message WhatsApp de notification avec le numéro saisi
      const whatsappNotification =
        buildAgencyCreatedWhatsAppDetails(newAgencyPayload);
      setCreatedNotification(whatsappNotification);

      // Réinitialise les champs du formulaire après création réussie
      setNewAgencyName('');
      setRegPassword('');

      setTab('login');
      setLoginEmail(normalizedEmail);
      setApprovalPendingNotice(
        isSuperAdminEmail
          ? `Agence « ${newAgencyPayload.companyName} » créée et activée immédiatement par le Super Admin (WhatsApp : ${cleanWhatsapp}). Une notification sonore a été émise et le message WhatsApp est prêt ci-dessous.`
          : `Agence « ${newAgencyPayload.companyName} » enregistrée avec succès (Rôle par défaut : Directeur d’Agence · WhatsApp : ${cleanWhatsapp}). Une notification sonore a été émise et le message WhatsApp est prêt ci-dessous. Seul le Super Admin (assamoighislain@gmail.com) a le droit d’approuver votre agence.`
      );
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création du compte.');
    } finally {
      setSubmitting(false);
    }
  };

  const authCardContent = (
    <div className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full overflow-hidden flex flex-col">
      {/* En-tête de la carte de connexion */}
      <div className="px-5 py-4 bg-indigo-950 text-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              Connexion à votre Compte Agence
            </h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              Identifiez-vous pour accéder à votre espace de gestion locative.
            </p>
          </div>
        </div>

        {!fullScreenPage && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-900 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bandeau de session active si connecté */}
      {activeAccount && (
        <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-emerald-950">
                Connecté : {activeAccount.fullName} ({activeAccount.email})
              </span>
              <span className="text-emerald-800 ml-2">
                · {ROLE_LABELS[activeAccount.role]} · Agence :{' '}
                <strong>{activeAccount.tenantName}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await onLogout();
              onClose?.();
            }}
            className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      )}

      {/* Onglets Connexion / Créer un Compte */}
      <div className="px-5 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setTab('login');
            setErrorMsg(null);
          }}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'login'
              ? 'bg-white text-indigo-950 border-indigo-700'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          <LogIn className="w-4 h-4" />
          Se connecter
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register');
            setErrorMsg(null);
            setApprovalPendingNotice(null);
          }}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'register'
              ? 'bg-white text-indigo-950 border-indigo-700'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Créer un compte
        </button>
      </div>

      {/* Corps */}
      <div ref={bodyScrollRef} className="p-6 overflow-y-auto space-y-5 flex-1">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {approvalPendingNotice && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-md text-xs font-semibold text-amber-950 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                Approbation du Super Admin requise
              </div>
              <p className="font-normal text-amber-900 leading-relaxed">
                {approvalPendingNotice}
              </p>
            </div>
          </div>
        )}

        {/* Carte Notification Sonore & Message WhatsApp dès qu'une Agence Immobilière est créée */}
        {createdNotification && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-lg space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Volume2 className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-extrabold text-emerald-950">
                    Notification Sonore & Message WhatsApp Générés
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Agence : <strong>{createdNotification.agencyName}</strong> · WhatsApp :{' '}
                    <strong>{createdNotification.whatsappPhone}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => playAgencyCreatedSound()}
                className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md inline-flex items-center gap-1 transition-colors"
                title="Réécouter la notification sonore"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                Réécouter le son
              </button>
            </div>

            <div className="p-2.5 bg-white border border-emerald-200 rounded-md text-[11px] font-mono text-slate-800 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
              {createdNotification.messageText}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-semibold text-emerald-900">
                Cliquez pour transmettre la notification sur WhatsApp :
              </span>
              <a
                href={createdNotification.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playAgencyCreatedSound()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md inline-flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Envoyer le Message WhatsApp ({createdNotification.whatsappPhone})
              </a>
            </div>
          </div>
        )}

        {tab === 'login' ? (
          <div className="space-y-5">
            {/* Connexion par Email & Mot de passe */}
            <form onSubmit={handleEmailLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Adresse Email Professionnelle *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="votre.email@agence.ci"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mot de passe *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-indigo-950 hover:bg-indigo-900 text-white text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                {submitting ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </form>

            {/* Séparateur */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-xs font-semibold text-slate-400 uppercase">
                ou
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            {/* Connexion Google Auth */}
            <button
              type="button"
              onClick={async () => {
                await onGoogleLogin(defaultTenantId);
                onClose?.();
              }}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-indigo-950 border border-slate-300 rounded-md text-xs font-bold shadow-2xs flex items-center justify-center gap-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
              Continuer avec Google
            </button>
          </div>
        ) : (
          /* Formulaire de création de compte : sans menu déroulant Fonction, rôle Directeur d'Agence par défaut, nom de l'agence clé unique, et numéro WhatsApp obligatoire */
          <form noValidate onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-md text-xs text-indigo-950 space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>Rôle attribué par défaut à la création :</span>
                <span className="px-2 py-0.5 bg-indigo-950 text-white rounded-sm text-[11px] font-bold">
                  Directeur d’Agence
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Une notification sonore et un message WhatsApp sont déclenchés dès la création de l’agence. Seul le Super Admin a le droit d’approuver une nouvelle agence immobilière.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom & Prénom du Directeur d’Agence *
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Ex: Marc-Arthur Kouadio"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Numéro WhatsApp Officiel (Format International Conforme) *
                </label>
                <div className="flex items-stretch gap-2">
                  <select
                    value={whatsappCountryCode}
                    onChange={(e) => setWhatsappCountryCode(e.target.value)}
                    aria-label="Indicatif pays WhatsApp"
                    className="w-[150px] sm:w-[190px] shrink-0 px-2.5 py-2 text-xs bg-white border border-emerald-400 rounded-md focus:outline-none focus:border-emerald-600 font-bold text-slate-900"
                  >
                    {WHATSAPP_COUNTRY_RULES.map((rule) => (
                      <option key={rule.code} value={rule.code}>
                        {rule.iso} · +{rule.code} ({rule.label.split(' (')[0]})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={newAgencyWhatsapp}
                    onChange={(e) => {
                      const sanitizedInput = e.target.value.replace(
                        /[^0-9+.\s()-]/g,
                        ''
                      );
                      setNewAgencyWhatsapp(sanitizedInput);
                    }}
                    placeholder={`Ex: ${selectedCountryRule.placeholder}`}
                    className={`flex-1 px-3 py-2 text-xs rounded-md focus:outline-none font-mono font-bold text-slate-900 border ${
                      liveWhatsappValidation
                        ? liveWhatsappValidation.isValid
                          ? 'bg-emerald-50/60 border-emerald-500 focus:border-emerald-700'
                          : 'bg-rose-50/50 border-rose-400 focus:border-rose-600'
                        : 'bg-emerald-50/40 border-emerald-400 focus:border-emerald-600'
                    }`}
                  />
                </div>
                {liveWhatsappValidation ? (
                  liveWhatsappValidation.isValid ? (
                    <p className="mt-1 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Numéro WhatsApp conforme :{' '}
                        <strong className="font-mono">
                          {liveWhatsappValidation.formattedDisplay}
                        </strong>
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] font-semibold text-rose-700">
                      {liveWhatsappValidation.error}
                    </p>
                  )
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Format attendu pour {selectedCountryRule.label} :{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {selectedCountryRule.exampleFormatted}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Professionnel *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Ex: m.kouadio@agence.ci"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mot de passe *
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                />
              </div>
            </div>

            {/* Saisie directe du nom unique de l'agence immobilière */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-700" />
                    Nom de l’Agence Immobilière (Clé Unique) *
                  </label>
                  <span className="text-[10px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-sm border border-indigo-200">
                    Clé unique
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                  placeholder="Saisissez le nom unique de votre agence immobilière"
                  className={`w-full px-3 py-2 text-xs bg-white border rounded-md focus:outline-none font-bold text-slate-900 ${
                    isDuplicateAgencyName
                      ? 'border-rose-400 focus:border-rose-600'
                      : 'border-slate-300 focus:border-indigo-600'
                  }`}
                />
                {typedAgencyCandidate && (
                  <p
                    className={`mt-1 text-[11px] font-semibold flex items-center gap-1 ${
                      isDuplicateAgencyName ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {isDuplicateAgencyName ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Ce nom d’agence (« {typedAgencyCandidate} ») existe déjà. Veuillez choisir un autre nom unique.
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Nom d’agence disponible : {typedAgencyCandidate}</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° RCCM
                  </label>
                  <input
                    type="text"
                    value={newAgencyRccm}
                    onChange={(e) => setNewAgencyRccm(e.target.value)}
                    placeholder="Ex: CI-ABJ-2026-B-88400"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Fiscal (NCC)
                  </label>
                  <input
                    type="text"
                    value={newAgencyTaxId}
                    onChange={(e) => setNewAgencyTaxId(e.target.value)}
                    placeholder="Ex: 2699100 A"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adresse & Ville
                  </label>
                  <input
                    type="text"
                    value={newAgencyLocation}
                    onChange={(e) => setNewAgencyLocation(e.target.value)}
                    placeholder="Ex: Cocody Riviera, Abidjan"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTab('login')}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {submitting
                  ? 'Enregistrement...'
                  : 'Créer l’agence (Directeur d’Agence)'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (fullScreenPage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
        {/* En-tête sobre */}
        <header className="border-b border-indigo-900/80 bg-indigo-950/90 px-6 py-4">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-black text-base">
                G
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Gimmo
              </span>
            </div>

            <a
              href="/api/public/user-guide/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-100 bg-indigo-900 hover:bg-indigo-800 border border-indigo-700 rounded-md transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              Guide d’Utilisation PDF
            </a>
          </div>
        </header>

        {/* Contenu centré et épuré : Formulaire de connexion uniquement */}
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg">{authCardContent}</div>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-xs text-slate-500 text-center">
          Gimmo — Plateforme de Gestion Immobilière & Cartographie PostGIS
        </footer>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col">
        {authCardContent}
      </div>
    </div>
  );
};
