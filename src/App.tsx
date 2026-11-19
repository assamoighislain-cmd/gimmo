/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  auth,
  googleAuthProvider,
  formatFirebaseAuthErrorFr,
  isFirebaseUnauthorizedDomainError,
} from './lib/firebase.ts';
import {
  Landlord,
  Property,
  Tenant,
  Lease,
  Payment,
  AccountingMonth,
  PropertyTypeItem,
  SaaSUserAccount,
  SaaSTenantAgency,
  LandlordPortalSession,
  ROLE_PERMISSIONS,
} from './types/gimmo.ts';
import { PropertyMapView } from './components/PropertyMapView.tsx';
import { BillingAndLeasesView } from './components/BillingAndLeasesView.tsx';
import { FinancialRecoveryView } from './components/FinancialRecoveryView.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { DocumentTemplateModal } from './components/DocumentTemplateModal.tsx';
import { AccountingMonthsPanel } from './components/AccountingMonthsPanel.tsx';
import { PropertyTypesPanel } from './components/PropertyTypesPanel.tsx';
import { LandlordsPanel } from './components/LandlordsPanel.tsx';
import { UserGuideModal } from './components/UserGuideModal.tsx';
import { AgencyProfilePanel } from './components/AgencyProfilePanel.tsx';
import { AgencyUsersPanel } from './components/AgencyUsersPanel.tsx';
import { SaaSSuperAdminPanel } from './components/SaaSSuperAdminPanel.tsx';
import { AuthAccountModal } from './components/AuthAccountModal.tsx';
import { LandlordPortalView } from './components/LandlordPortalView.tsx';
import { useOnlineStatus } from './hooks/usePWAInstall.ts';
import {
  DocumentTemplatesStore,
  createInitialTemplatesStore,
  resolveAccountingMonths,
  resolvePropertyTypes,
  resolveManagementCompany,
  resolveSaaSTenants,
  resolveSaaSUsers,
  DEFAULT_SAAS_USERS,
  formatPeriodMonthToLabelFr,
} from './lib/document-templates.ts';
import {
  saveOfflineSnapshot,
  loadOfflineSnapshot,
  getOfflineQueue,
  enqueueOfflineMutation,
  clearOfflineQueue,
  applyOptimisticMutationToSnapshot,
} from './lib/offline-manager.ts';
import { useRealtimeBackgroundSync } from './lib/realtime-sync.ts';
import {
  Building,
  Building2,
  Users,
  LogOut,
  LogIn,
  Pencil,
  Trash2,
  LocateFixed,
  CheckCircle2,
  AlertTriangle,
  X,
  Menu,
  ChevronDown,
  Wifi,
  WifiOff,
  RefreshCw,
  Sliders,
  CalendarPlus,
  BookOpen,
  Download,
  Crown,
  ShieldCheck,
  Volume2,
  MessageCircle,
  KeyRound,
} from 'lucide-react';
import {
  playAgencyCreatedSound,
  buildAgencyCreatedWhatsAppDetails,
} from './lib/agency-notifications.ts';
import {
  generateLandlordPortalPassword,
  deriveDefaultLandlordUsername,
  buildLandlordPortalWhatsAppDetails,
  parseJsonResponseSafely,
  authenticateOrRefreshLandlordPortalClient,
} from './lib/landlord-portal.ts';

type ActiveSection =
  | 'map_properties'
  | 'tenants_leases'
  | 'billing_receipts'
  | 'financial_recovery'
  | 'settings';

const SECTION_LABELS: Record<ActiveSection, string> = {
  map_properties: 'Biens & Carte',
  tenants_leases: 'Locataires & Baux',
  billing_receipts: 'Quittances',
  financial_recovery: 'Recouvrement',
  settings: 'Paramétrage',
};

export default function App() {
  const [activeSection, setActiveSection] =
    useState<ActiveSection>('map_properties');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedLandlordId, setSelectedLandlordId] = useState<number | 'all'>(
    'all'
  );

  // État quota Google Maps Platform (Tier 1 & Tier 2)
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // État Authentification Firebase
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // État Hors-Ligne (Détection réseau + bascule manuelle Mode Hors-Ligne + file de synchronisation)
  const isBrowserOnline = useOnlineStatus();
  const [manualOfflineMode, setManualOfflineMode] = useState(false);
  const isEffectiveOffline = !isBrowserOnline || manualOfflineMode;
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(
    () => getOfflineQueue().length
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => loadOfflineSnapshot()?.lastSyncedAt || null
  );
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // Données métier PostgreSQL / Cache Local Hors-Ligne + Modèles de Documents
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [templatesStore, setTemplatesStore] = useState<DocumentTemplatesStore>(
    () => loadOfflineSnapshot()?.templates || createInitialTemplatesStore()
  );
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // États des modales de création / modification
  const [propertyModalState, setPropertyModalState] = useState<{
    open: boolean;
    editing: Property | null;
  }>({ open: false, editing: null });

  const [landlordModalState, setLandlordModalState] = useState<{
    open: boolean;
    editing: Landlord | null;
  }>({ open: false, editing: null });

  const [leaseModalState, setLeaseModalState] = useState<{
    open: boolean;
    editingLease: Lease | null;
  }>({ open: false, editingLease: null });

  const [paymentModalState, setPaymentModalState] = useState<{
    open: boolean;
    editingPayment: Payment | null;
  }>({ open: false, editingPayment: null });

  const [templateModalState, setTemplateModalState] = useState<{
    open: boolean;
    kind: 'lease' | 'receipt';
  }>({ open: false, kind: 'lease' });

  const [isAccountingMonthsModalOpen, setIsAccountingMonthsModalOpen] =
    useState(false);
  const [isPropertyTypesModalOpen, setIsPropertyTypesModalOpen] =
    useState(false);
  const [isLandlordsModalOpen, setIsLandlordsModalOpen] = useState(false);
  const [isUserGuideModalOpen, setIsUserGuideModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [confirmDeleteTopLandlord, setConfirmDeleteTopLandlord] =
    useState(false);

  // Restauration sécurisée de la session active (sinon affichage de la Page de Connexion)
  const [activeAccount, setActiveAccount] = useState<SaaSUserAccount | null>(
    () => {
      try {
        const raw = localStorage.getItem('gimmo_active_account_v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<SaaSUserAccount>;
        if (parsed && parsed.id && parsed.email && parsed.role) {
          return parsed as SaaSUserAccount;
        }
      } catch {
        // ignore corrupted storage
      }
      return null;
    }
  );

  // Session dédiée du Portail Bailleur (Espace Propriétaire Mandant)
  const [landlordPortalSession, setLandlordPortalSession] =
    useState<LandlordPortalSession | null>(null);
  const [landlordPortalPassword, setLandlordPortalPassword] =
    useState<string>('');
  const [isRefreshingLandlordPortal, setIsRefreshingLandlordPortal] =
    useState(false);

  // Écouteur Quota Google Maps Platform (Obligatoire Case A Demo Key)
  useEffect(() => {
    const handleQuotaEvent = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaEvent);
    return () =>
      window.removeEventListener('gmp-quota-exceeded', handleQuotaEvent);
  }, []);

  const applySnapshotState = useCallback(
    (snap: {
      landlords: Landlord[];
      properties: Property[];
      tenants: Tenant[];
      leases: Lease[];
      payments: Payment[];
      templates?: DocumentTemplatesStore;
      lastSyncedAt?: string;
    }) => {
      setLandlords(snap.landlords || []);
      setProperties(snap.properties || []);
      setTenants(snap.tenants || []);
      setLeases(snap.leases || []);
      setPayments(snap.payments || []);
      if (snap.templates) {
        setTemplatesStore(snap.templates);
      }
      if (snap.lastSyncedAt) {
        setLastSyncedAt(snap.lastSyncedAt);
      }
    },
    []
  );

  // Chargement des données depuis PostgreSQL avec repli automatique sur le cache Hors-Ligne
  const fetchOverviewData = useCallback(async () => {
    if (!navigator.onLine || manualOfflineMode) {
      const cached = loadOfflineSnapshot();
      if (cached) {
        applySnapshotState(cached);
        setDataError(null);
      }
      setIsLoadingData(false);
      return;
    }

    try {
      setDataError(null);

      // Si des mutations locales (ex: création d'agence hors-ligne) sont en attente, on les pousse d'abord vers Cloud SQL
      const pendingBeforeFetch = getOfflineQueue();
      if (pendingBeforeFetch.length > 0) {
        try {
          const syncRes = await fetch('/api/gimmo/sync-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mutations: pendingBeforeFetch }),
          });
          if (syncRes.ok) {
            clearOfflineQueue();
            setPendingOfflineCount(0);
          }
        } catch {
          // On conserve la file hors-ligne si l'API n'est pas joignable
        }
      }

      const res = await fetch('/api/gimmo/overview', { cache: 'no-store' });
      const parsed = await parseJsonResponseSafely<any>(res);
      if (!res.ok || !parsed.isJson || !parsed.data) {
        throw new Error('Impossible de charger les données PostgreSQL');
      }
      const data = parsed.data;
      const existingSnap = loadOfflineSnapshot();
      const hasPendingQueue = getOfflineQueue().length > 0;
      const incomingLandlords: Landlord[] = data.landlords || [];
      const mergedLandlords =
        hasPendingQueue && existingSnap?.landlords
          ? incomingLandlords.map((rl) => {
              const localMatch = existingSnap.landlords.find(
                (ll) => ll.id === rl.id
              );
              if (!localMatch) return rl;
              return {
                ...rl,
                portalUsername: localMatch.portalUsername || rl.portalUsername,
                portalPassword: localMatch.portalPassword || rl.portalPassword,
                portalEnabled:
                  localMatch.portalEnabled !== undefined
                    ? localMatch.portalEnabled
                    : rl.portalEnabled,
              };
            })
          : incomingLandlords;

      let mergedTemplates: DocumentTemplatesStore | undefined = data.templates;
      if (hasPendingQueue && existingSnap?.templates && data.templates) {
        const remoteTenants = resolveSaaSTenants(data.templates);
        const localTenants = resolveSaaSTenants(existingSnap.templates);
        const missingLocalTenants = localTenants.filter(
          (lt) =>
            !remoteTenants.some(
              (rt) =>
                rt.id === lt.id ||
                rt.companyName.trim().toLowerCase() ===
                  lt.companyName.trim().toLowerCase()
            )
        );

        const remoteUsers = resolveSaaSUsers(data.templates);
        const localUsers = resolveSaaSUsers(existingSnap.templates);
        const missingLocalUsers = localUsers.filter(
          (lu) =>
            !remoteUsers.some(
              (ru) =>
                ru.id === lu.id ||
                ru.email.trim().toLowerCase() === lu.email.trim().toLowerCase()
            )
        );

        mergedTemplates = {
          ...data.templates,
          saasTenants: [...remoteTenants, ...missingLocalTenants],
          saasUsers: [...remoteUsers, ...missingLocalUsers],
        };
      }

      const saved = saveOfflineSnapshot({
        landlords: mergedLandlords,
        properties: data.properties || [],
        tenants: data.tenants || [],
        leases: data.leases || [],
        payments: data.payments || [],
        templates: mergedTemplates,
      });
      applySnapshotState(saved);
    } catch (err: any) {
      console.warn('Repli automatique sur le cache hors-ligne Gimmo :', err);
      const cached = loadOfflineSnapshot();
      if (cached) {
        applySnapshotState(cached);
        setDataError(null);
      } else {
        setDataError(err.message || 'Erreur réseau');
      }
    } finally {
      setIsLoadingData(false);
    }
  }, [manualOfflineMode, applySnapshotState]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Synchronisation en Temps Réel en Arrière-Plan (WebSocket + SSE + Multi-Onglets + Vidage Auto de la File Hors-Ligne)
  const {
    realtimeStatus,
    lastRealtimeAction,
    flushOfflineQueueInBackground,
    broadcastTabUpdate,
  } = useRealtimeBackgroundSync({
    enabled: !isEffectiveOffline,
    onStateReceived: useCallback(
      (data, meta) => {
        applySnapshotState({
          ...data,
          lastSyncedAt: meta.timestamp,
        });
      },
      [applySnapshotState]
    ),
    onQueueSynced: useCallback(() => {
      setPendingOfflineCount(0);
    }, []),
  });

  // Synchronisation des opérations créées/modifiées en mode Hors-Ligne vers PostgreSQL
  const syncOfflineMutations = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0 || !navigator.onLine || manualOfflineMode) return;

    setIsSyncingOffline(true);
    try {
      const flushed = await flushOfflineQueueInBackground();
      if (flushed) {
        setPendingOfflineCount(0);
        await fetchOverviewData();
      } else {
        for (const item of queue) {
          await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body),
          });
        }
        clearOfflineQueue();
        setPendingOfflineCount(0);
        await fetchOverviewData();
      }
    } catch (err) {
      console.error('Erreur lors de la synchronisation hors-ligne :', err);
    } finally {
      setIsSyncingOffline(false);
    }
  }, [manualOfflineMode, flushOfflineQueueInBackground, fetchOverviewData]);

  // Synchronisation automatique en arrière-plan dès le retour de la connexion
  useEffect(() => {
    if (isBrowserOnline && !manualOfflineMode && pendingOfflineCount > 0) {
      syncOfflineMutations();
    }
  }, [
    isBrowserOnline,
    manualOfflineMode,
    pendingOfflineCount,
    syncOfflineMutations,
  ]);

  // Fonction universelle d'enregistrement / suppression (En ligne -> PostgreSQL + Diffusion Temps Réel | Hors-ligne -> Cache local + File d'attente)
  const performMutationWithOfflineSupport = useCallback(
    async (
      url: string,
      method: 'POST' | 'PUT' | 'DELETE',
      body: Record<string, any>,
      description: string
    ) => {
      if (!isEffectiveOffline) {
        try {
          const hasBody = body && Object.keys(body).length > 0;
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'DELETE' && !hasBody ? undefined : JSON.stringify(body),
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            await fetchOverviewData();
            return;
          }
        } catch (err) {
          console.warn(
            'Échec réseau détecté, bascule de l’enregistrement en file d’attente hors-ligne :',
            err
          );
        }
      }

      // Enregistrement hors-ligne immédiat (Optimistic UI + file de synchronisation + synchro inter-onglets)
      const updatedQueue = enqueueOfflineMutation({
        url,
        method,
        body,
        description,
      });
      setPendingOfflineCount(updatedQueue.length);

      const updatedSnap = applyOptimisticMutationToSnapshot(url, method, body);
      if (updatedSnap) {
        applySnapshotState(updatedSnap);
        broadcastTabUpdate(description, updatedSnap);
      }
    },
    [
      isEffectiveOffline,
      fetchOverviewData,
      applySnapshotState,
      broadcastTabUpdate,
    ]
  );

  // Suivi de session Firebase Auth + synchronisation utilisateur dans PostgreSQL
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user && navigator.onLine) {
        try {
          const token = await user.getIdToken();
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (err) {
          console.error('Failed to sync user to Cloud SQL:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAccountLoginSuccess = useCallback(
    async (
      account: SaaSUserAccount,
      _agency: SaaSTenantAgency,
      freshTemplates?: DocumentTemplatesStore
    ) => {
      if (freshTemplates) {
        setTemplatesStore(freshTemplates);
        saveOfflineSnapshot({
          landlords,
          properties,
          tenants,
          leases,
          payments,
          templates: freshTemplates,
        });
      }
      setActiveAccount(account);
      try {
        localStorage.setItem('gimmo_active_account_v1', JSON.stringify(account));
      } catch {
        // ignore
      }
      await fetchOverviewData();
    },
    [fetchOverviewData, landlords, properties, tenants, leases, payments]
  );

  const handleAgencyRegistered = useCallback(
    async (updatedTemplates?: DocumentTemplatesStore) => {
      if (updatedTemplates) {
        setTemplatesStore(updatedTemplates);
        saveOfflineSnapshot({
          landlords,
          properties,
          tenants,
          leases,
          payments,
          templates: updatedTemplates,
        });
      }
      await fetchOverviewData();
    },
    [fetchOverviewData, landlords, properties, tenants, leases, payments]
  );

  const handleGoogleLoginWithAgency = async (targetTenantId: string) => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = cred.user;
      const emailLower = (fbUser.email || '').trim().toLowerCase();
      const saasTenants = resolveSaaSTenants(templatesStore);
      const saasUsers = resolveSaaSUsers(templatesStore);
      const isPrimarySuperAdmin = emailLower === 'assamoighislain@gmail.com';

      const existingAccount = isPrimarySuperAdmin
        ? saasUsers.find(
            (u) =>
              u.email.trim().toLowerCase() === emailLower &&
              u.role === 'super_admin'
          ) || saasUsers.find((u) => u.email.trim().toLowerCase() === emailLower)
        : [...saasUsers]
            .reverse()
            .find((u) => u.email.trim().toLowerCase() === emailLower);

      if (!existingAccount && !isPrimarySuperAdmin) {
        await signOut(auth).catch(() => {});
        throw new Error(
          'Accès refusé : Aucun compte utilisateur n’existe pour cette adresse Google. Seul l’Administrateur ou le Directeur de l’Agence peut créer les comptes des autres utilisateurs et leur affecter un rôle.'
        );
      }

      if (existingAccount?.status === 'suspended' && !isPrimarySuperAdmin) {
        await signOut(auth).catch(() => {});
        throw new Error(
          'Ce compte utilisateur est suspendu par l’Administrateur ou le Directeur de l’Agence.'
        );
      }

      const fallbackAgency =
        saasTenants.find((t) => t.id === targetTenantId) ||
        saasTenants.find((t) => t.isCurrentTenant) ||
        saasTenants[0];

      const linkedAgency = existingAccount
        ? saasTenants.find((t) => t.id === existingAccount.tenantId) ||
          saasTenants.find(
            (t) =>
              t.companyName.trim().toLowerCase() ===
              existingAccount.tenantName.trim().toLowerCase()
          ) ||
          fallbackAgency
        : fallbackAgency;

      const isSuperAdminUser =
        isPrimarySuperAdmin || existingAccount?.role === 'super_admin';

      if (!isSuperAdminUser && linkedAgency?.status === 'pending_approval') {
        await signOut(auth).catch(() => {});
        throw new Error(
          `L’agence immobilière « ${linkedAgency.companyName} » est en attente d’approbation par le Super Admin.`
        );
      }

      if (!isSuperAdminUser && linkedAgency?.status === 'suspended') {
        await signOut(auth).catch(() => {});
        throw new Error(
          `L’agence immobilière « ${linkedAgency.companyName} » est actuellement suspendue.`
        );
      }

      const nowIso = new Date().toISOString();
      const accountToUse: SaaSUserAccount = existingAccount
        ? {
            ...existingAccount,
            role: isPrimarySuperAdmin ? 'super_admin' : existingAccount.role,
            tenantId: linkedAgency?.id || existingAccount.tenantId,
            tenantName: linkedAgency?.companyName || existingAccount.tenantName,
            lastLoginAt: nowIso,
          }
        : {
            id: 'usr-super-admin-ghislain',
            fullName: fbUser.displayName || 'Ghislain Assamoi',
            email: emailLower,
            role: 'super_admin',
            tenantId: linkedAgency.id,
            tenantName: linkedAgency.companyName,
            status: 'active',
            lastLoginAt: nowIso,
            createdAt: nowIso.split('T')[0],
          };

      if (linkedAgency) {
        await performMutationWithOfflineSupport(
          '/api/saas/tenants',
          'POST',
          {
            id: linkedAgency.id,
            companyName: linkedAgency.companyName,
            isCurrentTenant: true,
            activateOnly: true,
          },
          `Activation de l'agence ${linkedAgency.companyName}`
        );
      }
      await performMutationWithOfflineSupport(
        '/api/saas/users',
        'POST',
        { ...accountToUse, isLoginSync: true },
        `Connexion compte ${accountToUse.fullName}`
      );
      await handleAccountLoginSuccess(accountToUse, linkedAgency);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        throw new Error('');
      }
      console.error('Google Sign-In error:', err);
      if (isFirebaseUnauthorizedDomainError(err)) {
        const wrapped: any = new Error(formatFirebaseAuthErrorFr(err));
        wrapped.code = 'auth/unauthorized-domain';
        throw wrapped;
      }
      if (typeof err?.code === 'string' && err.code.startsWith('auth/')) {
        const wrapped: any = new Error(formatFirebaseAuthErrorFr(err));
        wrapped.code = err.code;
        throw wrapped;
      }
      throw err;
    }
  };

  const handleLogout = async () => {
    setActiveAccount(null);
    try {
      localStorage.removeItem('gimmo_active_account_v1');
    } catch {
      // ignore
    }
    try {
      if (currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleLandlordPortalLoginSuccess = useCallback(
    (session: LandlordPortalSession, passwordUsed: string) => {
      setLandlordPortalSession(session);
      setLandlordPortalPassword(passwordUsed);
      setIsAuthModalOpen(false);
    },
    []
  );

  const handleRefreshLandlordPortal = useCallback(async () => {
    if (!landlordPortalSession || !landlordPortalPassword) return;
    setIsRefreshingLandlordPortal(true);
    try {
      const updatedSession = await authenticateOrRefreshLandlordPortalClient({
        explicitLandlordId: landlordPortalSession.landlord.id,
        password: landlordPortalPassword,
      });
      setLandlordPortalSession(updatedSession);
    } catch (err) {
      console.error('Erreur actualisation Portail Bailleur :', err);
    } finally {
      setIsRefreshingLandlordPortal(false);
    }
  }, [landlordPortalSession, landlordPortalPassword]);

  const handleLandlordPortalLogout = useCallback(() => {
    setLandlordPortalSession(null);
    setLandlordPortalPassword('');
  }, []);

  const handleSettlePayment = async (paymentId: number, method: string) => {
    await performMutationWithOfflineSupport(
      `/api/payments/${paymentId}/settle`,
      'POST',
      { paymentMethod: method },
      `Encaissement quittance #${paymentId}`
    );
  };

  const handleDeleteProperty = async (propertyId: number) => {
    await performMutationWithOfflineSupport(
      `/api/properties/${propertyId}`,
      'DELETE',
      {},
      `Suppression bien immobilier #${propertyId}`
    );
  };

  const handleDeleteLandlord = async (landlordId: number) => {
    if (selectedLandlordId === landlordId) {
      setSelectedLandlordId('all');
    }
    setConfirmDeleteTopLandlord(false);
    await performMutationWithOfflineSupport(
      `/api/landlords/${landlordId}`,
      'DELETE',
      {},
      `Suppression bailleur #${landlordId}`
    );
  };

  const handleSaveLandlord = async (
    landlordId: number | null,
    payload: {
      fullName: string;
      companyName: string;
      email: string;
      phone: string;
      address: string;
      taxId: string;
      iban: string;
      commissionRate: number;
      contractHeaderNote: string;
      portalUsername?: string;
      portalPassword?: string;
      portalEnabled?: boolean;
    }
  ) => {
    const isEditing = landlordId !== null;
    const url = isEditing ? `/api/landlords/${landlordId}` : '/api/landlords';
    const method = isEditing ? 'PUT' : 'POST';
    await performMutationWithOfflineSupport(
      url,
      method,
      payload,
      isEditing
        ? `Modification bailleur ${payload.companyName || payload.fullName}`
        : `Ajout bailleur ${payload.companyName || payload.fullName}`
    );
  };

  const handleDeleteLease = async (leaseId: number) => {
    await performMutationWithOfflineSupport(
      `/api/tenants-leases/${leaseId}`,
      'DELETE',
      {},
      `Suppression dossier locataire et bail #${leaseId}`
    );
  };

  const handleDeletePayment = async (paymentId: number) => {
    await performMutationWithOfflineSupport(
      `/api/payments/${paymentId}`,
      'DELETE',
      {},
      `Suppression quittance #${paymentId}`
    );
  };

  const handleDeleteAccountingMonth = async (
    periodMonth: string,
    periodLabel: string
  ) => {
    await performMutationWithOfflineSupport(
      `/api/accounting-months/${encodeURIComponent(periodMonth)}`,
      'DELETE',
      {},
      `Suppression du mois comptable ${periodLabel}`
    );
  };

  const handleDeletePropertyType = async (id: string, name: string) => {
    await performMutationWithOfflineSupport(
      `/api/property-types/${encodeURIComponent(id)}`,
      'DELETE',
      {},
      `Suppression du type de bien "${name}"`
    );
  };

  // Résolution des mois comptables, des types de biens et de la société de gestion configurés dans Paramétrage
  const accountingMonths = resolveAccountingMonths(templatesStore);
  const propertyTypes = resolvePropertyTypes(templatesStore);
  const managementCompany = resolveManagementCompany(templatesStore);
  const currentAccountingMonth =
    accountingMonths.find((m) => m.isCurrent) || accountingMonths[0];

  // Calcul des indicateurs globaux filtrés par Bailleur et mois comptable actif
  const scopedProperties = properties.filter((p) =>
    selectedLandlordId === 'all' ? true : p.landlordId === selectedLandlordId
  );
  const scopedPaymentsCurrent = payments.filter(
    (p) =>
      p.periodMonth === (currentAccountingMonth?.periodMonth || '2026-11') &&
      (selectedLandlordId === 'all' ? true : p.landlordId === selectedLandlordId)
  );
  const totalCollectedNov = scopedPaymentsCurrent.reduce(
    (s, p) => s + Number(p.amountPaid),
    0
  );
  const overdueCount = scopedPaymentsCurrent.filter(
    (p) => p.status === 'overdue'
  ).length;

  const selectedLandlordObj =
    selectedLandlordId !== 'all'
      ? landlords.find((l) => l.id === selectedLandlordId) || null
      : null;

  const currentRolePermissions = activeAccount
    ? ROLE_PERMISSIONS[activeAccount.role] || ROLE_PERMISSIONS.agency_admin
    : ROLE_PERMISSIONS.agency_admin;

  const isSuperAdminAccount = Boolean(
    activeAccount &&
      currentRolePermissions.canViewSaaSConsole &&
      (activeAccount.role === 'super_admin' ||
        activeAccount.email.trim().toLowerCase() === 'assamoighislain@gmail.com')
  );

  const pendingAgencies = resolveSaaSTenants(templatesStore).filter(
    (t) => t.status === 'pending_approval'
  );
  const pendingAgenciesCount = pendingAgencies.length;

  const handleQuickApproveAgency = async (agency: SaaSTenantAgency) => {
    if (!isSuperAdminAccount || !activeAccount) return;
    await performMutationWithOfflineSupport(
      '/api/saas/tenants',
      'POST',
      {
        ...agency,
        status: 'active',
        actorRole: activeAccount.role,
        actorEmail: activeAccount.email,
      },
      `Approbation agence ${agency.companyName}`
    );
    playAgencyCreatedSound();
  };

  useEffect(() => {
    if (isSuperAdminAccount && pendingAgenciesCount > 0) {
      playAgencyCreatedSound();
    }
  }, [isSuperAdminAccount, pendingAgenciesCount]);

  useEffect(() => {
    if (!activeAccount) return;
    if (activeSection === 'settings' && !currentRolePermissions.canAccessSettings) {
      setActiveSection('map_properties');
    } else if (
      activeSection === 'financial_recovery' &&
      !currentRolePermissions.canAccessRecovery
    ) {
      setActiveSection('map_properties');
    }
  }, [activeAccount, activeSection, currentRolePermissions]);

  // Si un bailleur est connecté à son Portail Propriétaire dédié, afficher directement son espace sécurisé
  if (landlordPortalSession) {
    return (
      <LandlordPortalView
        session={landlordPortalSession}
        onRefresh={handleRefreshLandlordPortal}
        onLogout={handleLandlordPortalLogout}
        isRefreshing={isRefreshingLandlordPortal}
      />
    );
  }

  // Si aucun compte utilisateur n'est connecté au lancement, la première page affichée est la Page de Connexion
  if (!activeAccount) {
    return (
      <AuthAccountModal
        fullScreenPage
        templatesStore={templatesStore}
        activeAccount={null}
        onLoginSuccess={handleAccountLoginSuccess}
        onLandlordPortalLoginSuccess={handleLandlordPortalLoginSuccess}
        onLogout={handleLogout}
        onAgencyRegistered={handleAgencyRegistered}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-950">
      {/* Bannière Quota Google Maps Platform (Case A Mandatory Banner) */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-100 border-b-2 border-amber-300 text-amber-950 px-4 py-3 text-sm font-semibold text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold text-indigo-900 hover:text-indigo-700"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Bar Contract : 3 zones strictes séparées par gap-8 (Couleur vive Indigo profond) */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3 sm:py-4 bg-indigo-950 text-white border-b-2 border-indigo-900 shadow-md">
        {/* Zone 1 : Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('map_properties');
            setIsMobileMenuOpen(false);
          }}
          className="text-xl sm:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Gimmo
        </a>

        {/* Zone 2 : 5 liens de navigation concis sur une seule ligne (Desktop) sans sous-menu */}
        <nav className="hidden md:flex items-center gap-6 text-sm lg:text-base font-bold text-indigo-200">
          <button
            type="button"
            onClick={() => setActiveSection('map_properties')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 ${
              activeSection === 'map_properties'
                ? 'text-white font-extrabold border-b-2 border-emerald-400'
                : 'hover:text-white'
            }`}
          >
            Biens & Carte
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('tenants_leases')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 ${
              activeSection === 'tenants_leases'
                ? 'text-white font-extrabold border-b-2 border-emerald-400'
                : 'hover:text-white'
            }`}
          >
            Locataires & Baux
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('billing_receipts')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 ${
              activeSection === 'billing_receipts'
                ? 'text-white font-extrabold border-b-2 border-emerald-400'
                : 'hover:text-white'
            }`}
          >
            Quittances
          </button>
          {currentRolePermissions.canAccessRecovery && (
            <button
              type="button"
              onClick={() => setActiveSection('financial_recovery')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-1 ${
                activeSection === 'financial_recovery'
                  ? 'text-white font-extrabold border-b-2 border-emerald-400'
                  : 'hover:text-white'
              }`}
            >
              Recouvrement
            </button>
          )}
          {currentRolePermissions.canAccessSettings && (
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-1 ${
                activeSection === 'settings'
                  ? 'text-white font-extrabold border-b-2 border-emerald-400'
                  : 'hover:text-white'
              }`}
            >
              Paramétrage
            </button>
          )}
        </nav>

        {/* Zone 3 : Compte utilisateur connecté & Agence liée + Déconnexion */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-900 border border-indigo-700 rounded-lg hover:bg-indigo-800 transition-colors whitespace-nowrap shrink-0"
            title={`Connecté : ${activeAccount.fullName} (${activeAccount.email}) — Agence : ${activeAccount.tenantName}`}
          >
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[170px] sm:max-w-[240px]">
              {activeAccount.fullName} · {activeAccount.tenantName}
            </span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-rose-200 bg-indigo-900/80 border border-indigo-800 rounded-lg hover:bg-rose-900 hover:text-white transition-colors whitespace-nowrap shrink-0"
            title="Se déconnecter et revenir à la page de connexion"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Menu Vertical Déroulant sur Smartphone (md:hidden) */}
      <div className="md:hidden bg-indigo-900 border-b border-indigo-800 relative z-30">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-expanded={isMobileMenuOpen}
          className="w-full min-h-[48px] px-4 py-2.5 flex items-center justify-between text-white font-bold text-sm hover:bg-indigo-800/80 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Menu className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Menu : {SECTION_LABELS[activeSection]}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-200">
            <span>{isMobileMenuOpen ? 'Fermer' : 'Déplier'}</span>
            <ChevronDown
              className={`w-4 h-4 text-emerald-400 transition-transform duration-150 ${
                isMobileMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>

        {isMobileMenuOpen && (
          <nav className="flex flex-col bg-indigo-950 border-t border-indigo-800 divide-y divide-indigo-900/80 shadow-xl">
            {(
              [
                'map_properties',
                'tenants_leases',
                'billing_receipts',
                ...(currentRolePermissions.canAccessRecovery
                  ? (['financial_recovery'] as ActiveSection[])
                  : []),
                ...(currentRolePermissions.canAccessSettings
                  ? (['settings'] as ActiveSection[])
                  : []),
              ] as ActiveSection[]
            ).map((sectionKey) => {
              const isActive = activeSection === sectionKey;
              return (
                <button
                  key={sectionKey}
                  type="button"
                  onClick={() => {
                    setActiveSection(sectionKey);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[48px] px-5 py-3 text-left text-sm font-bold flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-indigo-100 hover:bg-indigo-900'
                  }`}
                >
                  <span>{SECTION_LABELS[sectionKey]}</span>
                  {isActive && (
                    <span className="text-xs font-extrabold tracking-wide text-emerald-100">
                      Actif
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Notification Super Admin quand une nouvelle agence immobilière est créée */}
      {isSuperAdminAccount && pendingAgencies.length > 0 && (
        <div className="bg-emerald-950 text-white border-b border-emerald-800 px-4 sm:px-6 py-2.5">
          <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-slate-950 font-black rounded-sm">
                <Volume2 className="w-3.5 h-3.5" />
                AGENCE(S) À APPROUVER ({pendingAgencies.length})
              </span>
              <span>
                En attente :{' '}
                <strong>
                  {pendingAgencies.map((a) => a.companyName).join(' · ')}
                </strong>{' '}
                (Dernière : Directeur{' '}
                {pendingAgencies[pendingAgencies.length - 1].managerName} · WhatsApp :{' '}
                <strong className="text-emerald-300">
                  {pendingAgencies[pendingAgencies.length - 1].whatsappPhone ||
                    pendingAgencies[pendingAgencies.length - 1].phone}
                </strong>
                )
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => playAgencyCreatedSound()}
                className="px-2.5 py-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 border border-emerald-700 rounded-md font-bold inline-flex items-center gap-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Son
              </button>
              <a
                href={
                  buildAgencyCreatedWhatsAppDetails(
                    pendingAgencies[pendingAgencies.length - 1]
                  ).whatsappUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playAgencyCreatedSound()}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-md font-extrabold inline-flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Message WhatsApp
              </a>
              <button
                type="button"
                onClick={() =>
                  handleQuickApproveAgency(
                    pendingAgencies[pendingAgencies.length - 1]
                  )
                }
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-indigo-950 rounded-md font-extrabold inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-950" />
                Approuver {pendingAgencies[pendingAgencies.length - 1].companyName}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSection('settings');
                  setTimeout(() => {
                    document
                      .getElementById('saas-super-admin-console')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-950 rounded-md font-extrabold inline-flex items-center gap-1"
              >
                <Crown className="w-3.5 h-3.5 text-indigo-900" />
                Console d’Approbation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre de contexte épurée : Agence Immobilière active, Filtre Bailleur & Indicateurs clés */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Gauche : Agence liée au compte + Filtre Bailleur + Synchro */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-950 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors"
              title="Changer de compte utilisateur ou d'agence immobilière"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span>
                Agence :{' '}
                <strong>
                  {managementCompany.tradeName || managementCompany.companyName}
                </strong>
              </span>
              {activeAccount?.role === 'super_admin' && (
                <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
            </button>

            <span
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-md"
              title={`Rôle : ${currentRolePermissions.label} — Restrictions : ${currentRolePermissions.restrictionsSummary.join(' | ')}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span>{currentRolePermissions.label}</span>
            </span>

            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
                Bailleur :
              </label>
              <select
                value={selectedLandlordId}
                onChange={(e) => {
                  setConfirmDeleteTopLandlord(false);
                  setSelectedLandlordId(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  );
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-indigo-600 max-w-[240px]"
              >
                <option value="all">
                  Tous les Bailleurs ({landlords.length})
                </option>
                {landlords.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.companyName ? `${l.companyName} (${l.fullName})` : l.fullName}{' '}
                    ({l.commissionRate}%)
                  </option>
                ))}
              </select>
            </div>

            {selectedLandlordObj && (
              <div className="inline-flex items-center gap-1 flex-wrap">
                {(() => {
                  const waDetails = buildLandlordPortalWhatsAppDetails({
                    landlord: selectedLandlordObj,
                    agencyName:
                      managementCompany.tradeName ||
                      managementCompany.companyName,
                  });
                  return waDetails.whatsappUrl ? (
                    <a
                      href={waDetails.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-white bg-emerald-600 border border-emerald-700 rounded-md hover:bg-emerald-700 transition-colors"
                      title={`Envoyer le compte (${waDetails.portalUsername}) et le mot de passe du Portail Bailleur par WhatsApp`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Accès WhatsApp</span>
                    </a>
                  ) : null;
                })()}
                <button
                  type="button"
                  onClick={() =>
                    setLandlordModalState({
                      open: true,
                      editing: selectedLandlordObj,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                  title="Modifier ce bailleur"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Modifier</span>
                </button>

                {currentRolePermissions.canDeleteLandlord && (
                  <>
                    {confirmDeleteTopLandlord ? (
                      <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-md px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteLandlord(selectedLandlordObj.id)
                          }
                          className="px-2 py-0.5 text-xs font-bold text-white bg-rose-600 rounded-sm hover:bg-rose-700"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTopLandlord(false)}
                          className="px-2 py-0.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-sm"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTopLandlord(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors"
                        title="Supprimer ce bailleur"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsLandlordsModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bailleurs</span>
            </button>

            <button
              type="button"
              onClick={() => setIsUserGuideModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Guide PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setManualOfflineMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                isEffectiveOffline
                  ? 'bg-amber-500 border-amber-600 text-slate-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {isEffectiveOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span>Hors-Ligne</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {realtimeStatus === 'connected' ? 'En ligne' : 'En ligne'}
                  </span>
                </>
              )}
            </button>

            {pendingOfflineCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (manualOfflineMode) setManualOfflineMode(false);
                  setTimeout(() => syncOfflineMutations(), 50);
                }}
                disabled={isSyncingOffline || !isBrowserOnline}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-md hover:bg-rose-700 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isSyncingOffline ? 'animate-spin' : ''
                  }`}
                />
                <span>Sync ({pendingOfflineCount})</span>
              </button>
            )}
          </div>

          {/* Droite : Résumé rapide en ligne (Tabular Numerals) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 font-mono tabular-nums font-semibold shrink-0">
            <span>
              Biens :{' '}
              <strong className="text-indigo-700 font-extrabold">
                {scopedProperties.length}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <span>
              Encaissé ({currentAccountingMonth?.periodLabel || 'Nov 2026'}) :{' '}
              <strong className="text-emerald-600 font-extrabold">
                {totalCollectedNov.toLocaleString('fr-FR')} FCFA
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <span>
              Retards :{' '}
              <strong
                className={
                  overdueCount > 0
                    ? 'text-rose-600 font-extrabold'
                    : 'text-slate-900 font-extrabold'
                }
              >
                {overdueCount}
              </strong>
            </span>
          </div>
        </div>

        {/* Bandeau d'information lorsqu'on travaille en mode Hors-Ligne */}
        {isEffectiveOffline && (
          <div className="max-w-[1400px] mx-auto mt-3 px-3.5 py-2.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-amber-950">
            <div className="flex items-center gap-2 font-semibold">
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Travail Hors-Ligne :</strong> vous consultez et modifiez les données locales en cache
                {lastSyncedAt
                  ? ` (dernière synchro : ${new Date(lastSyncedAt).toLocaleTimeString('fr-FR')})`
                  : ''}
                . Toutes vos créations/modifications (biens, bailleurs, baux, quittances) sont enregistrées sur cet appareil et seront synchronisées dès le retour en ligne.
              </span>
            </div>
            {isBrowserOnline && manualOfflineMode && (
              <button
                type="button"
                onClick={() => setManualOfflineMode(false)}
                className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                Repasser En Ligne & Synchroniser
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contenu principal (1400px workspace container) */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {dataError && (
          <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-200 rounded-xl text-sm font-semibold text-rose-900 flex items-center justify-between">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={fetchOverviewData}
              className="px-4 py-1.5 bg-white border border-rose-300 rounded-lg font-bold hover:bg-rose-100"
            >
              Réessayer
            </button>
          </div>
        )}

        {isLoadingData ? (
          <div className="space-y-4">
            <div className="h-9 w-80 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-[520px] w-full bg-slate-200/80 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {activeSection === 'map_properties' && (
              <PropertyMapView
                properties={properties}
                landlords={landlords}
                payments={payments}
                selectedLandlordId={selectedLandlordId}
                onOpenNewPropertyModal={() =>
                  setPropertyModalState({ open: true, editing: null })
                }
                onEditProperty={(prop) =>
                  setPropertyModalState({ open: true, editing: prop })
                }
                onDeleteProperty={handleDeleteProperty}
              />
            )}

            {activeSection === 'tenants_leases' && (
              <BillingAndLeasesView
                mode="leases"
                landlords={landlords}
                properties={properties}
                tenants={tenants}
                leases={leases}
                payments={payments}
                accountingMonths={accountingMonths}
                selectedLandlordId={selectedLandlordId}
                onSettlePayment={handleSettlePayment}
                onOpenNewLeaseModal={() =>
                  setLeaseModalState({ open: true, editingLease: null })
                }
                onOpenNewPaymentModal={() =>
                  setPaymentModalState({ open: true, editingPayment: null })
                }
                onOpenTemplateEditor={(kind) =>
                  setTemplateModalState({ open: true, kind })
                }
                onEditLease={(lease) =>
                  setLeaseModalState({ open: true, editingLease: lease })
                }
                onEditPayment={(payment) =>
                  setPaymentModalState({ open: true, editingPayment: payment })
                }
                onDeleteLease={handleDeleteLease}
                onDeletePayment={handleDeletePayment}
                onRefresh={fetchOverviewData}
              />
            )}

            {activeSection === 'billing_receipts' && (
              <BillingAndLeasesView
                mode="billing"
                landlords={landlords}
                properties={properties}
                tenants={tenants}
                leases={leases}
                payments={payments}
                accountingMonths={accountingMonths}
                selectedLandlordId={selectedLandlordId}
                onSettlePayment={handleSettlePayment}
                onOpenNewLeaseModal={() =>
                  setLeaseModalState({ open: true, editingLease: null })
                }
                onOpenNewPaymentModal={() =>
                  setPaymentModalState({ open: true, editingPayment: null })
                }
                onOpenTemplateEditor={(kind) =>
                  setTemplateModalState({ open: true, kind })
                }
                onEditLease={(lease) =>
                  setLeaseModalState({ open: true, editingLease: lease })
                }
                onEditPayment={(payment) =>
                  setPaymentModalState({ open: true, editingPayment: payment })
                }
                onDeleteLease={handleDeleteLease}
                onDeletePayment={handleDeletePayment}
                onRefresh={fetchOverviewData}
              />
            )}

            {activeSection === 'financial_recovery' && (
              <FinancialRecoveryView
                landlords={landlords}
                properties={properties}
                tenants={tenants}
                payments={payments}
                selectedLandlordId={selectedLandlordId}
                onSettlePayment={handleSettlePayment}
                onEditLandlord={(landlord) =>
                  setLandlordModalState({ open: true, editing: landlord })
                }
                onEditPayment={(payment) =>
                  setPaymentModalState({ open: true, editingPayment: payment })
                }
                onDeletePayment={handleDeletePayment}
                onDeleteLandlord={handleDeleteLandlord}
              />
            )}

            {activeSection === 'settings' && (
              <div className="space-y-8">
                <div className="border-2 border-indigo-200 bg-white rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-indigo-950">
                      {isSuperAdminAccount
                        ? 'Paramétrage Général — Société de Gestion (En-tête PDF), Système SaaS Super Admin, Types de Biens & Mois Comptables'
                        : 'Paramétrage Général — Société de Gestion (En-tête PDF), Types de Biens & Mois Comptables'}
                    </h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1">
                      {isSuperAdminAccount
                        ? 'Identifiez la société qui gère les biens des bailleurs afin que ses coordonnées légales apparaissent à l’en-tête de tous les documents PDF, pilotez le système SaaS multi-agences avec le compte Super Admin (assamoighislain@gmail.com), et configurez vos types de biens et mois comptables.'
                        : 'Identifiez votre agence immobilière afin que ses coordonnées légales apparaissent à l’en-tête de tous les documents PDF, et configurez vos types de biens, mois comptables et bailleurs.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="p-4 sm:p-5 bg-violet-50/70 border-2 border-violet-200 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-violet-950">
                          Types de Biens Immobiliers
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1">
                          Créez de nouveaux types de biens (Duplex, Entrepôt, Boutique...) ou modifiez les catégories et charges par défaut existantes.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsPropertyTypesModalOpen(true)}
                          className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors shadow-xs"
                        >
                          <Building className="w-4 h-4" />
                          <span>Créer / Modifier les Types</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-emerald-950">
                          Création des Mois Comptables
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1">
                          Ouvrez un nouveau mois comptable, définissez le mois actif par défaut et générez les quittances de tous les baux actifs en un clic.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsAccountingMonthsModalOpen(true)}
                          className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-xs"
                        >
                          <CalendarPlus className="w-4 h-4" />
                          <span>Créer un Mois Comptable</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 bg-indigo-50/60 border-2 border-indigo-200 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-indigo-950">
                          Personnalisation des Modèles PDF
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1">
                          Adaptez les clauses, articles, variables dynamiques et couleurs de vos Contrats de Bail et Quittances de Loyer par bailleur.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setTemplateModalState({ open: true, kind: 'lease' })
                          }
                          className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          <Sliders className="w-4 h-4" />
                          <span>Modèles Bail & Quittance</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 bg-amber-50/60 border-2 border-amber-200 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-amber-950">
                          Installation & Guide Utilisateur PDF
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1">
                          Installez Gimmo sur votre écran d’accueil Android, iOS ou PC et téléchargez le Guide d’Utilisateur officiel en PDF.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <PWAInstallButton />
                        <a
                          href="/api/public/user-guide/pdf?download=1"
                          download="Guide_Utilisateur_Gimmo_SaaS.pdf"
                          className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-700 rounded-xl hover:bg-indigo-800 transition-colors shadow-xs"
                        >
                          <Download className="w-4 h-4" />
                          <span>Exporter Guide PDF</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. Système SaaS Multi-Agences & Console Super Administrateur — Placé en tête pour le Super Admin afin d'approuver immédiatement les nouvelles agences */}
                {isSuperAdminAccount && (
                  <SaaSSuperAdminPanel
                    templatesStore={templatesStore}
                    activeAccount={activeAccount}
                    totalPropertiesCount={properties.length}
                    totalLandlordsCount={landlords.length}
                    onSuccess={fetchOverviewData}
                  />
                )}

                {/* 2. Identification de la Société de Gestion (En-tête officiel de tous les documents PDF) */}
                <AgencyProfilePanel
                  templatesStore={templatesStore}
                  canEdit={currentRolePermissions.canEditAgencyProfile}
                  onSuccess={fetchOverviewData}
                />

                {/* 3. Gestion des Comptes Utilisateurs & Attribution des Rôles (Réservée à l'Administrateur et au Directeur d'Agence) */}
                <AgencyUsersPanel
                  templatesStore={templatesStore}
                  activeAccount={activeAccount}
                  onSuccess={fetchOverviewData}
                />

                {/* 4. Guide d'Utilisateur Officiel avec exportation PDF directe */}
                <UserGuideModal isModal={false} />

                {/* Gestion complète des Bailleurs (Propriétaires Mandants) directement intégrée dans la rubrique Paramétrage */}
                <LandlordsPanel
                  landlords={landlords}
                  properties={properties}
                  agencyName={
                    managementCompany.tradeName || managementCompany.companyName
                  }
                  onRefresh={fetchOverviewData}
                  onSaveLandlord={handleSaveLandlord}
                  onDeleteLandlord={handleDeleteLandlord}
                />

                {/* Gestion complète des Types de Biens Immobiliers directement intégrée dans la rubrique Paramétrage */}
                <PropertyTypesPanel
                  propertyTypes={propertyTypes}
                  properties={properties}
                  onUpsertPropertyType={async ({
                    descriptionLog,
                    ...payload
                  }) => {
                    await performMutationWithOfflineSupport(
                      '/api/property-types',
                      'POST',
                      payload,
                      descriptionLog
                    );
                  }}
                  onDeletePropertyType={handleDeletePropertyType}
                />

                {/* Gestion complète des Mois Comptables directement intégrée dans la rubrique Paramétrage */}
                <AccountingMonthsPanel
                  accountingMonths={accountingMonths}
                  leases={leases}
                  payments={payments}
                  onUpsertAccountingMonth={async ({
                    description,
                    ...payload
                  }) => {
                    await performMutationWithOfflineSupport(
                      '/api/accounting-months',
                      'POST',
                      payload,
                      description
                    );
                  }}
                  onDeleteAccountingMonth={handleDeleteAccountingMonth}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Modale d'ajout ou de modification d'un Bien Immobilier géolocalisé PostGIS */}
      {propertyModalState.open && (
        <PropertyFormModal
          landlords={landlords}
          propertyTypes={propertyTypes}
          initialProperty={propertyModalState.editing}
          onSubmitMutation={performMutationWithOfflineSupport}
          onClose={() => setPropertyModalState({ open: false, editing: null })}
          onSaved={async () => {
            setPropertyModalState({ open: false, editing: null });
          }}
        />
      )}

      {/* Modale d'ajout ou de modification d'un Bailleur */}
      {landlordModalState.open && (
        <LandlordFormModal
          initialLandlord={landlordModalState.editing}
          agencyName={
            managementCompany.tradeName || managementCompany.companyName
          }
          onSubmitMutation={performMutationWithOfflineSupport}
          onDeleteLandlord={handleDeleteLandlord}
          onClose={() => setLandlordModalState({ open: false, editing: null })}
          onSaved={async () => {
            setLandlordModalState({ open: false, editing: null });
          }}
        />
      )}

      {/* Modale de gestion complète des Bailleurs (Modifier / Supprimer / Ajouter) */}
      {isLandlordsModalOpen && (
        <LandlordsPanel
          isModal
          onCloseModal={() => setIsLandlordsModalOpen(false)}
          landlords={landlords}
          properties={properties}
          agencyName={
            managementCompany.tradeName || managementCompany.companyName
          }
          onRefresh={fetchOverviewData}
          onSaveLandlord={handleSaveLandlord}
          onDeleteLandlord={handleDeleteLandlord}
        />
      )}

      {/* Modale du Guide d'Utilisateur Officiel exportable en PDF */}
      {isUserGuideModalOpen && (
        <UserGuideModal
          isModal
          onClose={() => setIsUserGuideModalOpen(false)}
        />
      )}

      {/* Modale d'ajout ou de modification d'un Locataire + Contrat de Bail */}
      {leaseModalState.open && (
        <LeaseFormModal
          properties={properties}
          tenants={tenants}
          initialLease={leaseModalState.editingLease}
          onSubmitMutation={performMutationWithOfflineSupport}
          onClose={() =>
            setLeaseModalState({ open: false, editingLease: null })
          }
          onSaved={async () => {
            setLeaseModalState({ open: false, editingLease: null });
          }}
        />
      )}

      {/* Modale de création OU de modification d'une Quittance de Loyer */}
      {paymentModalState.open && (
        <PaymentFormModal
          initialPayment={paymentModalState.editingPayment}
          leases={leases}
          tenants={tenants}
          properties={properties}
          accountingMonths={accountingMonths}
          onSubmitMutation={performMutationWithOfflineSupport}
          onClose={() =>
            setPaymentModalState({ open: false, editingPayment: null })
          }
          onSaved={async () => {
            setPaymentModalState({ open: false, editingPayment: null });
          }}
        />
      )}

      {/* Modale de création / gestion des Mois Comptables depuis la rubrique Paramétrage */}
      {isAccountingMonthsModalOpen && (
        <AccountingMonthsPanel
          isModal
          onCloseModal={() => setIsAccountingMonthsModalOpen(false)}
          accountingMonths={accountingMonths}
          leases={leases}
          payments={payments}
          onUpsertAccountingMonth={async ({ description, ...payload }) => {
            await performMutationWithOfflineSupport(
              '/api/accounting-months',
              'POST',
              payload,
              description
            );
          }}
          onDeleteAccountingMonth={handleDeleteAccountingMonth}
        />
      )}

      {/* Modale de création / modification des Types de Biens depuis la rubrique Paramétrage */}
      {isPropertyTypesModalOpen && (
        <PropertyTypesPanel
          isModal
          onCloseModal={() => setIsPropertyTypesModalOpen(false)}
          propertyTypes={propertyTypes}
          properties={properties}
          onUpsertPropertyType={async ({ descriptionLog, ...payload }) => {
            await performMutationWithOfflineSupport(
              '/api/property-types',
              'POST',
              payload,
              descriptionLog
            );
          }}
          onDeletePropertyType={handleDeletePropertyType}
        />
      )}

      {/* Modale de Connexion Compte Utilisateur & Rattachement Agence Immobilière */}
      {isAuthModalOpen && (
        <AuthAccountModal
          templatesStore={templatesStore}
          activeAccount={activeAccount}
          onLoginSuccess={handleAccountLoginSuccess}
          onLandlordPortalLoginSuccess={handleLandlordPortalLoginSuccess}
          onLogout={handleLogout}
          onAgencyRegistered={handleAgencyRegistered}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

      {/* Atelier de personnalisation des Modèles de Contrat de Bail & de Quittance */}
      {templateModalState.open && (
        <DocumentTemplateModal
          initialKind={templateModalState.kind}
          initialLandlordId={selectedLandlordId}
          templatesStore={templatesStore}
          landlords={landlords}
          properties={properties}
          tenants={tenants}
          leases={leases}
          payments={payments}
          onSaveTemplate={async ({ scopeKey, kind, config, description }) => {
            await performMutationWithOfflineSupport(
              '/api/templates',
              'PUT',
              { scopeKey, kind, config },
              description
            );
          }}
          onClose={() =>
            setTemplateModalState((prev) => ({ ...prev, open: false }))
          }
        />
      )}

      {/* Pied de page */}
      <footer className="bg-white border-t-2 border-slate-200 px-6 py-4 text-sm font-medium text-slate-600">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-indigo-950">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>
              {managementCompany.companyName} (RCCM {managementCompany.rccm}) — propulsé par Gimmo SaaS
            </span>
          </div>
          <div className="text-slate-600 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {isSuperAdminAccount
                ? 'Super Admin SaaS : assamoighislain@gmail.com · PostgreSQL + PostGIS · PDFKit'
                : 'Gestion Immobilière Sécurisée · PostgreSQL + PostGIS · PDFKit'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================================
 * 1. MODALE : AJOUTER OU MODIFIER UN BIEN IMMOBILIER AVEC GÉOLOCALISATION AUTO
 * Compatible Android / Mobile (Header fixe, Corps scrollable, Footer fixe)
 * ============================================================================ */
function PropertyFormModal({
  landlords,
  propertyTypes,
  initialProperty,
  onSubmitMutation,
  onClose,
  onSaved,
}: {
  landlords: Landlord[];
  propertyTypes: PropertyTypeItem[];
  initialProperty: Property | null;
  onSubmitMutation: (
    url: string,
    method: 'POST' | 'PUT',
    body: Record<string, any>,
    description: string
  ) => Promise<void>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEditing = Boolean(initialProperty);

  const [landlordId, setLandlordId] = useState<number>(
    initialProperty?.landlordId || landlords[0]?.id || 1
  );
  const [reference, setReference] = useState(
    initialProperty?.reference ||
      `GIM-ABJ-00${Math.floor(10 + Math.random() * 89)}`
  );
  const [title, setTitle] = useState(initialProperty?.title || '');
  const [propertyType, setPropertyType] = useState(
    initialProperty?.propertyType || propertyTypes[0]?.name || 'Appartement'
  );
  const [address, setAddress] = useState(initialProperty?.address || '');
  const [neighborhood, setNeighborhood] = useState(
    initialProperty?.neighborhood || 'Cocody Riviera'
  );
  const [city, setCity] = useState(initialProperty?.city || 'Abidjan');
  const [surfaceArea, setSurfaceArea] = useState(
    initialProperty?.surfaceArea || 120
  );
  const [roomsCount, setRoomsCount] = useState(
    initialProperty?.roomsCount || 4
  );
  const [monthlyRent, setMonthlyRent] = useState(
    initialProperty?.monthlyRent || '600000'
  );
  const [chargesAmount, setChargesAmount] = useState(
    initialProperty?.chargesAmount ||
      propertyTypes[0]?.defaultCharges ||
      '40000'
  );
  const [latitude, setLatitude] = useState<number>(
    initialProperty?.latitude ?? 5.3542
  );
  const [longitude, setLongitude] = useState<number>(
    initialProperty?.longitude ?? -3.9712
  );
  const [status, setStatus] = useState<string>(
    initialProperty?.status || 'vacant'
  );

  const [gpsStatus, setGpsStatus] = useState<{
    state: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });

  const [submitting, setSubmitting] = useState(false);

  // Fonction de récupération automatique des coordonnées GPS de l'appareil (Android / Navigateur)
  const fetchCurrentGpsLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus({
        state: 'error',
        message: 'La géolocalisation GPS n’est pas supportée par cet appareil.',
      });
      return;
    }

    setGpsStatus({
      state: 'loading',
      message: 'Acquisition du signal GPS haute précision en cours...',
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const accuracy = Math.round(position.coords.accuracy);
        setLatitude(lat);
        setLongitude(lng);
        setGpsStatus({
          state: 'success',
          message: `Position GPS acquise automatiquement (${lat}, ${lng} · précision ±${accuracy}m)`,
        });
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsStatus({
          state: 'error',
          message:
            'Autorisation GPS refusée ou signal indisponible. Vous pouvez saisir les coordonnées ou réessayer.',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // En mode création ("Ajouter un bien GPS"), récupère automatiquement la position GPS à l'ouverture
  useEffect(() => {
    if (!isEditing) {
      fetchCurrentGpsLocation();
    }
  }, [isEditing, fetchCurrentGpsLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/properties/${initialProperty!.id}`
        : '/api/properties';
      const method = isEditing ? 'PUT' : 'POST';

      await onSubmitMutation(
        url,
        method,
        {
          landlordId: Number(landlordId),
          reference,
          title,
          propertyType,
          address,
          city,
          neighborhood,
          surfaceArea: Number(surfaceArea),
          roomsCount: Number(roomsCount),
          monthlyRent: String(monthlyRent),
          chargesAmount: String(chargesAmount),
          latitude: Number(latitude),
          longitude: Number(longitude),
          status,
        },
        isEditing ? `Modification bien ${reference}` : `Ajout bien ${reference}`
      );
      await onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* En-tête fixe */}
        <div className="flex items-center justify-between border-b-2 border-indigo-100 px-5 py-4 shrink-0 bg-indigo-950 text-white">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              {isEditing
                ? `Modifier le Bien (${initialProperty?.reference})`
                : 'Ajouter un Bien Immobilier GPS (PostGIS)'}
            </h3>
            <p className="text-xs font-medium text-indigo-200 mt-0.5">
              Coordonnées GPS WGS84 (SRID 4326) synchronisées automatiquement
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps scrollable pour que le bouton Enregistrer reste toujours visible en bas sur Android */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {/* Bloc Géolocalisation GPS Automatique */}
          <div className="p-4 bg-indigo-50/80 border-2 border-indigo-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                <LocateFixed className="w-4 h-4 text-indigo-600" />
                Géolocalisation GPS de l’appareil
              </span>
              <button
                type="button"
                onClick={fetchCurrentGpsLocation}
                disabled={gpsStatus.state === 'loading'}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 shadow-xs"
              >
                <LocateFixed className="w-4 h-4" />
                {gpsStatus.state === 'loading'
                  ? 'Localisation...'
                  : 'Récupérer ma position GPS actuelle'}
              </button>
            </div>

            {gpsStatus.state !== 'idle' && (
              <div
                className={`flex items-start gap-1.5 text-xs font-semibold ${
                  gpsStatus.state === 'success'
                    ? 'text-emerald-700'
                    : gpsStatus.state === 'error'
                      ? 'text-amber-800'
                      : 'text-indigo-800'
                }`}
              >
                {gpsStatus.state === 'success' && (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                )}
                {gpsStatus.state === 'error' && (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                )}
                <span>{gpsStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Latitude GPS (WGS84)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-2 border-indigo-200 rounded-lg font-mono font-bold text-slate-950"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Longitude GPS (WGS84)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-2 border-indigo-200 rounded-lg font-mono font-bold text-slate-950"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                Bailleur propriétaire
              </label>
              <select
                value={landlordId}
                onChange={(e) => setLandlordId(Number(e.target.value))}
                className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-lg bg-white font-semibold"
              >
                {landlords.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.companyName || l.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Référence Interne
              </label>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Type de bien
              </label>
              <select
                value={propertyType}
                onChange={(e) => {
                  const selectedName = e.target.value;
                  setPropertyType(selectedName);
                  if (!isEditing) {
                    const matchedType = propertyTypes.find(
                      (pt) => pt.name === selectedName
                    );
                    if (matchedType && matchedType.defaultCharges) {
                      setChargesAmount(matchedType.defaultCharges);
                    }
                  }
                }}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white font-semibold"
              >
                {propertyTypes.map((pt) => (
                  <option key={pt.id} value={pt.name}>
                    {pt.name} ({pt.code})
                  </option>
                ))}
                {initialProperty?.propertyType &&
                  !propertyTypes.some(
                    (pt) => pt.name === initialProperty.propertyType
                  ) && (
                    <option value={initialProperty.propertyType}>
                      {initialProperty.propertyType}
                    </option>
                  )}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                Désignation du bien
              </label>
              <input
                type="text"
                required
                placeholder="ex: Résidence Les Palmiers - Appt B2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Adresse
              </label>
              <input
                type="text"
                required
                placeholder="ex: Rue Ministre, Riviera 3"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Quartier / Commune
              </label>
              <input
                type="text"
                required
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Ville
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Statut d’occupation
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="occupied">Occupé</option>
                <option value="vacant">Vacant · Disponible</option>
                <option value="maintenance">En travaux / Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Loyer mensuel HC (FCFA)
              </label>
              <input
                type="number"
                required
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-indigo-950"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Charges mensuelles (FCFA)
              </label>
              <input
                type="number"
                required
                value={chargesAmount}
                onChange={(e) => setChargesAmount(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-indigo-950"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Surface (m²)
              </label>
              <input
                type="number"
                required
                value={surfaceArea}
                onChange={(e) => setSurfaceArea(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Nombre de pièces
              </label>
              <input
                type="number"
                required
                value={roomsCount}
                onChange={(e) => setRoomsCount(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
        </div>

        {/* Barre d'actions fixe en bas (toujours visible en mode Android) */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t-2 border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            {submitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer les modifications'
                : 'Enregistrer le Bien sur la Carte'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================================
 * 2. MODALE : AJOUTER OU MODIFIER UN BAILLEUR
 * ============================================================================ */
function LandlordFormModal({
  initialLandlord,
  agencyName,
  onSubmitMutation,
  onDeleteLandlord,
  onClose,
  onSaved,
}: {
  initialLandlord: Landlord | null;
  agencyName: string;
  onSubmitMutation: (
    url: string,
    method: 'POST' | 'PUT',
    body: Record<string, any>,
    description: string
  ) => Promise<void>;
  onDeleteLandlord?: (landlordId: number) => Promise<void>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEditing = Boolean(initialLandlord);

  const [fullName, setFullName] = useState(initialLandlord?.fullName || '');
  const [companyName, setCompanyName] = useState(
    initialLandlord?.companyName || ''
  );
  const [email, setEmail] = useState(initialLandlord?.email || '');
  const [phone, setPhone] = useState(
    initialLandlord?.phone || '+225 07 00 00 00 00'
  );
  const [address, setAddress] = useState(
    initialLandlord?.address || 'Cocody Ambassades, Abidjan'
  );
  const [taxId, setTaxId] = useState(
    initialLandlord?.taxId || 'CI-ABJ-2026-B-9900'
  );
  const [iban, setIban] = useState(
    initialLandlord?.iban || 'CI93 CI00 8011 1200 0000 0000 00'
  );
  const [commissionRate, setCommissionRate] = useState(
    initialLandlord?.commissionRate ?? 8
  );
  const [contractHeaderNote, setContractHeaderNote] = useState(
    initialLandlord?.contractHeaderNote ||
      'Contrat de bail soumis aux dispositions légales en vigueur avec révision triennale.'
  );
  const [portalUsername, setPortalUsername] = useState(
    initialLandlord?.portalUsername || ''
  );
  const [portalPassword, setPortalPassword] = useState(
    () => initialLandlord?.portalPassword || generateLandlordPortalPassword()
  );
  const [portalEnabled, setPortalEnabled] = useState<boolean>(
    initialLandlord?.portalEnabled !== false
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resolvedUsername =
    portalUsername.trim() ||
    deriveDefaultLandlordUsername({ email, phone, fullName });

  const waPreview = buildLandlordPortalWhatsAppDetails({
    landlord: {
      id: initialLandlord?.id || 0,
      userId: initialLandlord?.userId || '',
      fullName: fullName || 'Propriétaire',
      companyName: companyName || null,
      email,
      phone,
      address,
      taxId,
      iban,
      commissionRate,
      contractHeaderNote,
      portalUsername: resolvedUsername,
      portalPassword,
      portalEnabled,
      createdAt: initialLandlord?.createdAt || new Date().toISOString(),
    },
    agencyName,
    overrideUsername: resolvedUsername,
    overridePassword: portalPassword,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/landlords/${initialLandlord!.id}`
        : '/api/landlords';
      const method = isEditing ? 'PUT' : 'POST';

      await onSubmitMutation(
        url,
        method,
        {
          fullName,
          companyName,
          email,
          phone,
          address,
          taxId,
          iban,
          commissionRate: Number(commissionRate),
          contractHeaderNote,
          portalUsername: resolvedUsername,
          portalPassword:
            portalPassword.trim() || generateLandlordPortalPassword(),
          portalEnabled,
        },
        isEditing
          ? `Modification bailleur ${companyName || fullName}`
          : `Ajout bailleur ${companyName || fullName}`
      );
      await onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b-2 border-indigo-100 px-5 py-4 shrink-0 bg-indigo-950 text-white">
          <h3 className="text-lg font-extrabold text-white">
            {isEditing
              ? `Modifier le Bailleur (${initialLandlord?.companyName || initialLandlord?.fullName})`
              : 'Nouveau Compte Bailleur (Propriétaire Mandant)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Nom complet du représentant
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ex: Yao Kouadio"
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              SCI / Société (Optionnel)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ex: SCI Horizon Ivoire"
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Téléphone WhatsApp (+225...)
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold"
            />
          </div>

          {/* Bloc Accès Portail Bailleur & Envoi WhatsApp */}
          <div className="sm:col-span-2 p-3.5 bg-emerald-50/70 border-2 border-emerald-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-extrabold text-emerald-950 text-xs uppercase tracking-wider">
                <KeyRound className="w-4 h-4 text-emerald-700" />
                <span>Accès Portail Bailleur (Suivi des Biens)</span>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={portalEnabled}
                  onChange={(e) => setPortalEnabled(e.target.checked)}
                  className="rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
                />
                <span>Portail actif</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Compte / Identifiant Portail
                </label>
                <input
                  type="text"
                  value={portalUsername}
                  onChange={(e) => setPortalUsername(e.target.value)}
                  placeholder={resolvedUsername}
                  className="w-full px-2.5 py-2 bg-white border border-emerald-300 rounded-lg font-mono text-xs font-bold text-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Mot de passe Portail
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-emerald-300 rounded-lg font-mono text-xs font-bold text-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPortalPassword(generateLandlordPortalPassword())
                    }
                    className="px-2.5 py-2 text-xs font-bold text-emerald-900 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 whitespace-nowrap shrink-0"
                  >
                    Générer
                  </button>
                </div>
              </div>
            </div>

            {isEditing && waPreview.whatsappUrl && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200/80">
                <span className="text-xs text-emerald-900 font-medium">
                  Transmettre les identifiants enregistrés au bailleur :
                </span>
                <a
                  href={waPreview.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Envoyer par WhatsApp</span>
                </a>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Identifiant Fiscal / RCCM
            </label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Honoraires de gestion (%)
            </label>
            <input
              type="number"
              step="0.5"
              required
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-indigo-950"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-800 mb-1">
              IBAN / Coordonnées Bancaires
            </label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-800 mb-1">
              Adresse du siège / domicile
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-800 mb-1">
              Clause contractuelle par défaut sur les baux PDF de ce bailleur
            </label>
            <textarea
              rows={3}
              value={contractHeaderNote}
              onChange={(e) => setContractHeaderNote(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t-2 border-slate-200 bg-slate-50 shrink-0">
          <div>
            {isEditing && initialLandlord && onDeleteLandlord && (
              <>
                {confirmDelete ? (
                  <div className="inline-flex items-center gap-1.5 bg-rose-50 border-2 border-rose-300 rounded-xl px-2.5 py-1.5">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={async () => {
                        setDeleting(true);
                        try {
                          await onDeleteLandlord(initialLandlord.id);
                          onClose();
                        } finally {
                          setDeleting(false);
                        }
                      }}
                      className="px-3 py-1 text-xs font-extrabold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
                    >
                      {deleting ? 'Suppression...' : 'Confirmer la suppression ?'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 border-2 border-rose-200 rounded-xl hover:bg-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer ce Bailleur</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
            >
              {submitting
                ? 'Enregistrement...'
                : isEditing
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer le Bailleur'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============================================================================
 * 3. MODALE : AJOUTER OU MODIFIER UN DOSSIER LOCATAIRE & CONTRAT DE BAIL
 * ============================================================================ */
function LeaseFormModal({
  properties,
  tenants,
  initialLease,
  onSubmitMutation,
  onClose,
  onSaved,
}: {
  properties: Property[];
  tenants: Tenant[];
  initialLease: Lease | null;
  onSubmitMutation: (
    url: string,
    method: 'POST' | 'PUT',
    body: Record<string, any>,
    description: string
  ) => Promise<void>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEditing = Boolean(initialLease);
  const existingTenant = initialLease
    ? tenants.find((t) => t.id === initialLease.tenantId) || null
    : null;

  const [firstName, setFirstName] = useState(existingTenant?.firstName || '');
  const [lastName, setLastName] = useState(existingTenant?.lastName || '');
  const [email, setEmail] = useState(existingTenant?.email || '');
  const [phoneWhatsapp, setPhoneWhatsapp] = useState(
    existingTenant?.phoneWhatsapp || '+2250708091011'
  );
  const [nationalIdNumber, setNationalIdNumber] = useState(
    existingTenant?.nationalIdNumber || 'CI0099887766'
  );
  const [profession, setProfession] = useState(
    existingTenant?.profession || 'Consultant Senior'
  );
  const [employer, setEmployer] = useState(
    existingTenant?.employer || 'Cabinet Conseil'
  );
  const [guarantorName, setGuarantorName] = useState(
    existingTenant?.guarantorName || ''
  );
  const [guarantorPhone, setGuarantorPhone] = useState(
    existingTenant?.guarantorPhone || ''
  );

  const [propertyId, setPropertyId] = useState<number>(
    initialLease?.propertyId ||
      properties[properties.length - 1]?.id ||
      properties[0]?.id ||
      1
  );
  const [startDate, setStartDate] = useState(
    initialLease?.startDate || '2026-11-01'
  );
  const [endDate, setEndDate] = useState(
    initialLease?.endDate || '2028-10-31'
  );
  const [rentAmount, setRentAmount] = useState(
    initialLease?.rentAmount || '650000'
  );
  const [chargesAmount, setChargesAmount] = useState(
    initialLease?.chargesAmount || '45000'
  );
  const [securityDeposit, setSecurityDeposit] = useState(
    initialLease?.securityDeposit || '1300000'
  );
  const [paymentDueDay] = useState(initialLease?.paymentDueDay || 5);
  const [status, setStatus] = useState(initialLease?.status || 'active');
  const [customClauses, setCustomClauses] = useState(
    initialLease?.customClauses ||
      'Remise de 2 badges magnétiques et état des lieux contradictoire annexé.'
  );
  const [submitting, setSubmitting] = useState(false);

  const handlePropertyChange = (newPropId: number) => {
    setPropertyId(newPropId);
    const prop = properties.find((p) => p.id === newPropId);
    if (prop && !isEditing) {
      setRentAmount(prop.monthlyRent);
      setChargesAmount(prop.chargesAmount);
      setSecurityDeposit(String(Number(prop.monthlyRent) * 2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/tenants-leases/${initialLease!.id}`
        : '/api/tenants-leases';
      const method = isEditing ? 'PUT' : 'POST';

      await onSubmitMutation(
        url,
        method,
        {
          firstName,
          lastName,
          email,
          phoneWhatsapp,
          nationalIdNumber,
          profession,
          employer,
          guarantorName,
          guarantorPhone,
          propertyId: Number(propertyId),
          startDate,
          endDate,
          rentAmount: String(rentAmount),
          chargesAmount: String(chargesAmount),
          securityDeposit: String(securityDeposit),
          paymentDueDay: Number(paymentDueDay),
          customClauses,
          status,
        },
        isEditing
          ? `Modification bail ${firstName} ${lastName}`
          : `Ajout bail ${firstName} ${lastName}`
      );
      await onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b-2 border-indigo-100 px-5 py-4 shrink-0 bg-indigo-950 text-white">
          <h3 className="text-lg font-extrabold text-white">
            {isEditing
              ? `Modifier le Dossier & Bail (${initialLease?.contractNumber})`
              : 'Nouveau Dossier Locataire & Contrat de Bail'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Prénom du locataire
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Nom de famille
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Numéro WhatsApp (Format +225...)
            </label>
            <input
              type="text"
              required
              value={phoneWhatsapp}
              onChange={(e) => setPhoneWhatsapp(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              N° CNI / Passeport
            </label>
            <input
              type="text"
              required
              value={nationalIdNumber}
              onChange={(e) => setNationalIdNumber(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Profession
            </label>
            <input
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Employeur / Société
            </label>
            <input
              type="text"
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Garant (Nom & Contact)
            </label>
            <input
              type="text"
              value={guarantorName}
              onChange={(e) => setGuarantorName(e.target.value)}
              placeholder="ex: Touré Ibrahim"
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-800 mb-1">
              Bien Immobilier attribué
            </label>
            <select
              value={propertyId}
              onChange={(e) => handlePropertyChange(Number(e.target.value))}
              className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-lg bg-white font-semibold"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference} — {p.title} (
                  {Number(p.monthlyRent).toLocaleString('fr-FR')} {p.currency})
                </option>
              ))}
            </select>
          </div>

          {isEditing && (
            <>
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Loyer mensuel HC (FCFA)
                </label>
                <input
                  type="number"
                  required
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-indigo-950"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Charges mensuelles (FCFA)
                </label>
                <input
                  type="number"
                  required
                  value={chargesAmount}
                  onChange={(e) => setChargesAmount(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-indigo-950"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Caution / Dépôt de garantie
                </label>
                <input
                  type="number"
                  required
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Statut du Bail
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="active">Actif</option>
                  <option value="terminated">Résilié</option>
                  <option value="expired">Expiré</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Date d’entrée
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Fin de bail prévue
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-800 mb-1">
              Clauses particulières du contrat de bail PDF
            </label>
            <textarea
              rows={2}
              value={customClauses}
              onChange={(e) => setCustomClauses(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t-2 border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            {submitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer les modifications'
                : 'Enregistrer le Dossier & Bail'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================================
 * 4. MODALE : CRÉER OU MODIFIER UNE QUITTANCE DE LOYER / RÈGLEMENT
 * ============================================================================ */
function PaymentFormModal({
  initialPayment,
  leases,
  tenants,
  properties,
  accountingMonths,
  onSubmitMutation,
  onClose,
  onSaved,
}: {
  initialPayment: Payment | null;
  leases: Lease[];
  tenants: Tenant[];
  properties: Property[];
  accountingMonths: AccountingMonth[];
  onSubmitMutation: (
    url: string,
    method: 'POST' | 'PUT',
    body: Record<string, any>,
    description: string
  ) => Promise<void>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEditing = Boolean(initialPayment);

  const defaultLease = leases[0] || null;
  const defaultTotal = defaultLease
    ? String(Number(defaultLease.rentAmount) + Number(defaultLease.chargesAmount))
    : '650000';

  const defaultMonthObj =
    accountingMonths.find((m) => m.isCurrent) ||
    accountingMonths[0] || {
      periodMonth: '2026-11',
      periodLabel: 'Novembre 2026',
      defaultDueDay: 5,
    };

  const [selectedLeaseId, setSelectedLeaseId] = useState<number>(
    initialPayment?.leaseId || defaultLease?.id || 1
  );
  const [periodMonth, setPeriodMonth] = useState<string>(
    initialPayment?.periodMonth || defaultMonthObj.periodMonth
  );
  const [periodLabel, setPeriodLabel] = useState(
    initialPayment?.periodLabel || defaultMonthObj.periodLabel
  );
  const [amountDue, setAmountDue] = useState(
    initialPayment?.amountDue || defaultTotal
  );
  const [amountPaid, setAmountPaid] = useState(
    initialPayment?.amountPaid || defaultTotal
  );
  const [dueDate, setDueDate] = useState(
    initialPayment?.dueDate ||
      `${defaultMonthObj.periodMonth}-${String(defaultMonthObj.defaultDueDay || 5).padStart(2, '0')}`
  );
  const [paymentDate, setPaymentDate] = useState(
    initialPayment?.paymentDate || new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialPayment?.paymentMethod || 'Mobile Money'
  );
  const [status, setStatus] = useState<string>(
    initialPayment?.status || 'paid'
  );
  const [daysLate, setDaysLate] = useState<number>(
    initialPayment?.daysLate || 0
  );
  const [submitting, setSubmitting] = useState(false);

  const handleLeaseChange = (newLeaseId: number) => {
    setSelectedLeaseId(newLeaseId);
    const foundLease = leases.find((l) => l.id === newLeaseId);
    if (foundLease) {
      const total = String(
        Number(foundLease.rentAmount) + Number(foundLease.chargesAmount)
      );
      setAmountDue(total);
      if (status === 'paid') {
        setAmountPaid(total);
      }
    }
  };

  const handlePeriodMonthChange = (newMonth: string) => {
    setPeriodMonth(newMonth);
    const matched = accountingMonths.find((m) => m.periodMonth === newMonth);
    if (matched) {
      setPeriodLabel(matched.periodLabel);
      const dayStr = String(matched.defaultDueDay || 5).padStart(2, '0');
      setDueDate(`${newMonth}-${dayStr}`);
    } else {
      setPeriodLabel(formatPeriodMonthToLabelFr(newMonth));
      setDueDate(`${newMonth}-05`);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    if (newStatus === 'paid') {
      setAmountPaid(amountDue);
      setDaysLate(0);
    } else if (newStatus === 'pending') {
      setAmountPaid('0');
      setDaysLate(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing && initialPayment) {
        await onSubmitMutation(
          `/api/payments/${initialPayment.id}`,
          'PUT',
          {
            periodLabel,
            amountDue: String(amountDue),
            amountPaid: String(amountPaid),
            dueDate,
            paymentDate:
              status === 'paid' || Number(amountPaid) > 0 ? paymentDate : null,
            paymentMethod:
              status === 'paid' || Number(amountPaid) > 0
                ? paymentMethod
                : null,
            status,
            daysLate: Number(daysLate),
          },
          `Modification quittance ${initialPayment.receiptNumber}`
        );
        await onSaved();
      } else {
        await onSubmitMutation(
          '/api/payments',
          'POST',
          {
            leaseId: Number(selectedLeaseId),
            periodMonth,
            periodLabel,
            amountDue: String(amountDue),
            amountPaid: String(amountPaid),
            dueDate,
            paymentDate:
              status === 'paid' || Number(amountPaid) > 0 ? paymentDate : null,
            paymentMethod:
              status === 'paid' || Number(amountPaid) > 0
                ? paymentMethod
                : null,
            status,
            daysLate: Number(daysLate),
          },
          `Création quittance ${periodLabel}`
        );
        await onSaved();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b-2 border-indigo-100 px-5 py-4 shrink-0 bg-indigo-950 text-white">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              {isEditing
                ? `Modifier la Quittance (${initialPayment?.receiptNumber})`
                : 'Créer une Nouvelle Quittance de Loyer'}
            </h3>
            <p className="text-xs font-medium text-indigo-200 mt-0.5">
              {isEditing
                ? 'Mise à jour du règlement, du mode de paiement ou du retard'
                : 'Génération immédiate du numéro de quittance PDF et du lien WhatsApp'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
          {!isEditing && (
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                Contrat de Bail & Locataire concerné
              </label>
              <select
                value={selectedLeaseId}
                onChange={(e) => handleLeaseChange(Number(e.target.value))}
                className="w-full px-3 py-2.5 border-2 border-indigo-300 rounded-xl bg-indigo-50/50 font-bold text-indigo-950"
              >
                {leases.map((l) => {
                  const t = tenants.find((item) => item.id === l.tenantId);
                  const p = properties.find((item) => item.id === l.propertyId);
                  const total =
                    Number(l.rentAmount) + Number(l.chargesAmount);
                  return (
                    <option key={l.id} value={l.id}>
                      {t ? `${t.firstName} ${t.lastName}` : l.contractNumber} —{' '}
                      {p?.title || p?.reference} (
                      {total.toLocaleString('fr-FR')} FCFA)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {!isEditing && (
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Mois comptable
              </label>
              <select
                value={periodMonth}
                onChange={(e) => handlePeriodMonthChange(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white font-semibold"
              >
                {accountingMonths.map((m) => (
                  <option key={m.periodMonth} value={m.periodMonth}>
                    {m.periodLabel} ({m.periodMonth})
                    {m.isCurrent ? ' — Actif' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={isEditing ? 'sm:col-span-2' : ''}>
            <label className="block font-bold text-slate-800 mb-1">
              Libellé sur la quittance PDF
            </label>
            <input
              type="text"
              required
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Montant total appelé (FCFA)
            </label>
            <input
              type="number"
              required
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-indigo-950"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Montant encaissé (FCFA)
            </label>
            <input
              type="number"
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              État du règlement
            </label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="paid">Soldé (Payé — Quittance active)</option>
              <option value="overdue">En retard (Impayé / Partiel)</option>
              <option value="pending">En attente d’échéance</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Mode de règlement
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="Mobile Money">Mobile Money</option>
              <option value="Virement">Virement Bancaire</option>
              <option value="Chèque">Chèque</option>
              <option value="Espèces">Espèces</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Date d’échéance
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Date de règlement
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-800 mb-1">
              Jours de retard comptabilisés
            </label>
            <input
              type="number"
              min={0}
              value={daysLate}
              onChange={(e) => setDaysLate(Number(e.target.value))}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t-2 border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] px-5 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
          >
            {submitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer les modifications'
                : 'Générer & Enregistrer la Quittance'}
          </button>
        </div>
      </form>
    </div>
  );
}
