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
  BookOpen,
  Clock,
  Volume2,
  MessageCircle,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  type SaaSTenantAgency,
  type SaaSUserAccount,
  type LandlordPortalSession,
  ROLE_PERMISSIONS,
} from '../types/gimmo.ts';
import {
  type DocumentTemplatesStore,
  resolveSaaSTenants,
  resolveSaaSUsers,
} from '../lib/document-templates.ts';
import {
  executeMutation,
  getOfflineQueue,
  clearOfflineQueue,
} from '../lib/offline-manager.ts';
import {
  playAgencyCreatedSound,
  buildAgencyCreatedWhatsAppDetails,
  validateWhatsAppPhone,
  WHATSAPP_COUNTRY_RULES,
  type AgencyWhatsAppNotification,
} from '../lib/agency-notifications.ts';
import { authenticateOrRefreshLandlordPortalClient } from '../lib/landlord-portal.ts';

interface AuthAccountModalProps {
  templatesStore: DocumentTemplatesStore;
  activeAccount: SaaSUserAccount | null;
  onLoginSuccess: (
    account: SaaSUserAccount,
    agency: SaaSTenantAgency,
    freshTemplates?: DocumentTemplatesStore
  ) => Promise<void>;
  onAgencyRegistered?: (updatedTemplates?: DocumentTemplatesStore) => Promise<void>;
  onLandlordPortalLoginSuccess?: (
    session: LandlordPortalSession,
    passwordUsed: string
  ) => void;
  onLogout: () => Promise<void>;
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
  onLandlordPortalLoginSuccess,
  onLogout,
  onClose,
  fullScreenPage = false,
}) => {
  const tenants = resolveSaaSTenants(templatesStore);
  const users = resolveSaaSUsers(templatesStore);

  const [tab, setTab] = useState<'login' | 'register' | 'landlord_portal'>(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('portal') === 'bailleur'
    ) {
      return 'landlord_portal';
    }
    return 'login';
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // État connexion Portail Bailleur
  const [landlordIdentifier, setLandlordIdentifier] = useState('');
  const [landlordPassword, setLandlordPassword] = useState('');
  const [showLandlordPassword, setShowLandlordPassword] = useState(false);

  // État création de compte utilisateur (Rôle par défaut : Directeur d'Agence, sans menu déroulant Fonction)
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
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
  const emailInputRef = useRef<HTMLInputElement | null>(null);

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
          id: linkedAgency.id,
          companyName: linkedAgency.companyName,
          isCurrentTenant: true,
          activateOnly: true,
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

    const cleanInput = (v: string) =>
      v.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();

    const rawIdentifier = cleanInput(loginEmail);
    const normalizedEmail = rawIdentifier.toLowerCase();
    const typedPassword = cleanInput(loginPassword);
    if (!normalizedEmail) {
      setErrorMsg('Veuillez saisir votre adresse email professionnelle ou votre numéro WhatsApp.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Authentification directe côté serveur (lecture fraîche dans Supabase)
      if (typeof navigator === 'undefined' || navigator.onLine) {
        // Si des créations (agence/utilisateur) étaient en file d'attente locale, les pousser d'abord vers Supabase
        const queued = getOfflineQueue();
        if (queued.length > 0) {
          try {
            const syncRes = await fetch('/api/gimmo/sync-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mutations: queued }),
            });
            if (syncRes.ok) {
              clearOfflineQueue();
            }
          } catch {
            // Poursuit la tentative de connexion même si le sync échoue
          }
        }

        try {
          const response = await fetch('/api/saas/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: rawIdentifier,
              password: typedPassword,
            }),
          });

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const payload = await response.json();

            if (response.ok && payload.ok && payload.user) {
              await onLoginSuccess(
                payload.user,
                payload.agency ||
                  tenants.find((t) => t.id === payload.user.tenantId) ||
                  tenants[0],
                payload.templates
              );
              onClose?.();
              return;
            }

            if (payload.code === 'PENDING_APPROVAL') {
              setApprovalPendingNotice(
                payload.error ||
                  'Votre agence immobilière est actuellement en attente d’approbation par le Super Admin (assamoighislain@gmail.com).'
              );
              return;
            }

            // Si un propriétaire bailleur saisit ses accès WhatsApp sur l'onglet principal, ouvrir directement son Portail Bailleur
            if (
              payload.code === 'USER_NOT_FOUND' &&
              typedPassword &&
              onLandlordPortalLoginSuccess
            ) {
              try {
                const landlordSession =
                  await authenticateOrRefreshLandlordPortalClient({
                    identifier: rawIdentifier,
                    password: typedPassword,
                  });
                onLandlordPortalLoginSuccess(landlordSession, typedPassword);
                onClose?.();
                return;
              } catch {
                // Pas un compte bailleur valide : afficher le message principal
              }
            }

            setErrorMsg(
              payload.error ||
                'Identifiants invalides ou compte introuvable.'
            );
            return;
          }
        } catch {
          // Bascule sur le cache local uniquement en cas d'indisponibilité réseau
        }
      }

      // 2. Mode hors-ligne uniquement : vérification sur le snapshot local
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
        if (
          foundUser.status === 'suspended' &&
          normalizedEmail !== 'assamoighislain@gmail.com'
        ) {
          setErrorMsg(
            'Ce compte utilisateur est suspendu par l’Administrateur ou le Directeur d’Agence.'
          );
          return;
        }

        const storedPassword = (foundUser.password || '').trim();
        if (storedPassword) {
          if (!typedPassword) {
            setErrorMsg('Veuillez saisir votre mot de passe.');
            return;
          }
          const isPasswordMatch =
            typedPassword === storedPassword ||
            (storedPassword.toUpperCase().startsWith('GIM-') &&
              typedPassword.toUpperCase() === storedPassword.toUpperCase());
          if (!isPasswordMatch) {
            setErrorMsg('Mot de passe incorrect pour ce compte utilisateur.');
            return;
          }
        }

        const syncedUser: SaaSUserAccount = {
          ...foundUser,
          lastLoginAt: new Date().toISOString(),
        };
        await executeMutation('/api/saas/users', 'POST', {
          ...syncedUser,
          isLoginSync: true,
        }).catch(() => {});

        await activateAccountAndAgency(syncedUser);
        return;
      }

      if (normalizedEmail === 'assamoighislain@gmail.com') {
        const chosenAgency =
          tenants.find((t) => t.isCurrentTenant) || tenants[0];
        const nowIso = new Date().toISOString();
        const superAdminAccount: SaaSUserAccount = {
          id: 'user_super_admin_main',
          fullName: 'Ghislain Assamoi',
          email: normalizedEmail,
          role: 'super_admin',
          tenantId: chosenAgency.id,
          tenantName: chosenAgency.companyName,
          status: 'active',
          lastLoginAt: nowIso,
          createdAt: nowIso.split('T')[0],
        };
        await executeMutation('/api/saas/users', 'POST', {
          ...superAdminAccount,
          isLoginSync: true,
        }).catch(() => {});
        await activateAccountAndAgency(superAdminAccount);
        return;
      }

      setErrorMsg(
        'Aucun compte trouvé pour cette adresse email. Seul l’Administrateur ou le Directeur de l’Agence peut créer les comptes des autres utilisateurs et leur affecter un rôle. Pour enregistrer une nouvelle agence immobilière, utilisez l’onglet « Créer une agence ».'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de connecter ce compte.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLandlordPortalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setApprovalPendingNotice(null);

    if (!landlordIdentifier.trim() || !landlordPassword.trim()) {
      setErrorMsg(
        'Veuillez saisir votre compte bailleur et le mot de passe reçu par WhatsApp.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const session = await authenticateOrRefreshLandlordPortalClient({
        identifier: landlordIdentifier.trim(),
        password: landlordPassword.trim(),
      });

      onLandlordPortalLoginSuccess?.(session, landlordPassword.trim());
      onClose?.();
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Impossible de se connecter au Portail Bailleur.'
      );
    } finally {
      setSubmitting(false);
    }
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
        password: regPassword.trim(),
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
        {
          ...newUserAccount,
          isInitialAgencyRegistration: true,
        },
        `Création compte Directeur d'Agence ${newUserAccount.fullName}`
      );
      if (!userRes.ok) {
        throw new Error(
          userRes.error ||
            'Impossible de créer le compte initial du Directeur d’Agence.'
        );
      }

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

      const wasSavedOfflineOnly = Boolean(
        tenantRes.queuedOffline || userRes.queuedOffline
      );

      setTab('login');
      setLoginEmail(normalizedEmail);
      setApprovalPendingNotice(
        wasSavedOfflineOnly
          ? `Attention : L’agence « ${newAgencyPayload.companyName} » a été enregistrée uniquement dans la mémoire locale de ce navigateur car le serveur Supabase (/api/saas/tenants) n’est pas joignable sur cette adresse ou connexion. Pour qu’elle soit visible et approuvée par le Super Admin (assamoighislain@gmail.com) sur tous les appareils, ouvrez l’adresse officielle connectée à Supabase ou cliquez sur le bouton « Sync » dès le retour de la connexion.`
          : isSuperAdminEmail
          ? `Agence « ${newAgencyPayload.companyName} » créée et activée immédiatement par le Super Admin (WhatsApp : ${cleanWhatsapp}). Une notification sonore a été émise et le message WhatsApp est prêt ci-dessous.`
          : `Agence « ${newAgencyPayload.companyName} » enregistrée dans Supabase avec succès (Rôle par défaut : Directeur d’Agence · WhatsApp : ${cleanWhatsapp}). Elle est immédiatement visible en attente d’approbation dans la console du Super Admin (assamoighislain@gmail.com).`
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
              {tab === 'landlord_portal'
                ? 'Portail Bailleur — Espace Propriétaire'
                : 'Connexion à votre Compte Agence'}
            </h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              {tab === 'landlord_portal'
                ? 'Connectez-vous avec les accès reçus par WhatsApp pour suivre vos biens immobiliers.'
                : 'Identifiez-vous pour accéder à votre espace de gestion locative.'}
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

      {/* Onglets Connexion Agence / Créer un Compte / Portail Bailleur */}
      <div className="px-4 sm:px-5 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => {
            setTab('login');
            setErrorMsg(null);
          }}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            tab === 'login'
              ? 'bg-white text-indigo-950 border-indigo-700'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          Se connecter
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register');
            setErrorMsg(null);
            setApprovalPendingNotice(null);
          }}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            tab === 'register'
              ? 'bg-white text-indigo-950 border-indigo-700'
              : 'text-slate-600 border-transparent hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Créer une agence
        </button>
        {onLandlordPortalLoginSuccess && (
          <button
            type="button"
            onClick={() => {
              setTab('landlord_portal');
              setErrorMsg(null);
              setApprovalPendingNotice(null);
            }}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              tab === 'landlord_portal'
                ? 'bg-white text-emerald-900 border-emerald-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
            Portail Bailleur
          </button>
        )}
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
            {/* Connexion par Email ou WhatsApp & Mot de passe */}
            <form noValidate onSubmit={handleEmailLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Professionnel ou Téléphone WhatsApp *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    ref={emailInputRef}
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="votre.email@agence.ci ou +225 07..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700"
                    title={
                      showLoginPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
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

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Accès collaborateurs :</strong>{' '}
              Seul l’<strong>Administrateur</strong> ou le{' '}
              <strong>Directeur de l’Agence</strong> peut créer les comptes des autres utilisateurs et leur affecter un rôle.
            </div>
          </div>
        ) : tab === 'landlord_portal' ? (
          /* Connexion dédiée au Portail Bailleur (Propriétaires Mandants) */
          <form onSubmit={handleLandlordPortalSubmit} className="space-y-4">
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-md text-xs text-emerald-950">
              Saisissez le <strong>compte</strong> et le{' '}
              <strong>mot de passe</strong> qui vous ont été transmis sur{' '}
              <strong>WhatsApp</strong> par votre agence immobilière afin de suivre vos biens, vos baux, vos quittances et vos reversements.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Compte Bailleur (Email, Identifiant ou Téléphone WhatsApp) *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={landlordIdentifier}
                  onChange={(e) => setLandlordIdentifier(e.target.value)}
                  placeholder="Ex: proprietaire@domaine.ci ou +225 07 00 00 00 00"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:border-emerald-600 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mot de passe Portail reçu sur WhatsApp *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showLandlordPassword ? 'text' : 'password'}
                  required
                  value={landlordPassword}
                  onChange={(e) => setLandlordPassword(e.target.value)}
                  placeholder="Ex: GIM-4829-KP"
                  className="w-full pl-9 pr-10 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-emerald-600 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowLandlordPassword((prev) => !prev)}
                  className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700"
                  title={
                    showLandlordPassword
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                >
                  {showLandlordPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              {submitting
                ? 'Ouverture de votre portail...'
                : 'Accéder à mon Portail Bailleur'}
            </button>
          </form>
        ) : (
          /* Formulaire de création de compte : sans menu déroulant Fonction, rôle Directeur d'Agence par défaut, nom de l'agence clé unique, et numéro WhatsApp obligatoire */
          <form noValidate onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-md text-xs text-indigo-950 space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>Rôle attribué au fondateur de l’agence :</span>
                <span className="px-2 py-0.5 bg-indigo-950 text-white rounded-sm text-[11px] font-bold">
                  Directeur d’Agence
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Ce formulaire enregistre une nouvelle agence immobilière (approuvée par le Super Admin). Seul l’Administrateur ou le Directeur de l’Agence peut ensuite créer les comptes des autres utilisateurs et leur affecter des rôles.
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
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 pr-9 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-700"
                    title={
                      showRegPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
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
