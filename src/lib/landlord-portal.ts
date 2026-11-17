import type {
  Landlord,
  LandlordPortalSession,
} from '../types/gimmo.ts';
import {
  sanitizeWhatsAppNumber,
  validateWhatsAppPhone,
} from './agency-notifications.ts';
import {
  createInitialTemplatesStore,
  resolveManagementCompany,
} from './document-templates.ts';

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Parse une réponse HTTP en JSON sans jamais lever d'exception SyntaxError
 * si un proxy ou serveur statique renvoie du texte/HTML (ex: "The page could not be found").
 */
export async function parseJsonResponseSafely<T = any>(
  res: Response
): Promise<{ isJson: boolean; data: T | null; rawText: string }> {
  const rawText = await res.text().catch(() => '');
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { isJson: false, data: null, rawText: '' };
  }
  try {
    const parsed = JSON.parse(trimmed) as T;
    return { isJson: true, data: parsed, rawText };
  } catch {
    return { isJson: false, data: null, rawText };
  }
}

/**
 * Génère un mot de passe clair, mémorisable et sans caractères ambigus (ex: GIM-4829-KPQ).
 */
export function generateLandlordPortalPassword(): string {
  const digits = Array.from({ length: 4 }, () =>
    Math.floor(2 + Math.random() * 8).toString()
  ).join('');
  const letters = Array.from(
    { length: 3 },
    () => PASSWORD_ALPHABET[Math.floor(Math.random() * 24)]
  ).join('');
  return `GIM-${digits}-${letters}`;
}

/**
 * Détermine l'identifiant de connexion par défaut du bailleur (email en priorité, sinon identifiant normalisé).
 */
export function deriveDefaultLandlordUsername(params: {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
}): string {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  if (cleanEmail) {
    return cleanEmail;
  }

  const slug = (params.fullName || 'proprietaire')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  const lastDigits =
    (params.phone || '').replace(/\D+/g, '').slice(-4) || '2026';
  return `${slug || 'bailleur'}.${lastDigits}`;
}

export interface LandlordPortalWhatsAppPayload {
  landlordId: number;
  landlordDisplayName: string;
  portalUsername: string;
  portalPassword: string;
  portalUrl: string;
  whatsappPhoneDisplay: string;
  sanitizedDigits: string;
  isCompliant: boolean;
  validationError?: string;
  messageText: string;
  whatsappUrl: string;
}

/**
 * Construit le message WhatsApp officiel permettant d'envoyer au bailleur son compte et son mot de passe.
 */
export function buildLandlordPortalWhatsAppDetails(params: {
  landlord: Landlord;
  agencyName: string;
  baseUrl?: string;
  overrideUsername?: string;
  overridePassword?: string;
}): LandlordPortalWhatsAppPayload {
  const { landlord, agencyName } = params;
  const rawPhone = (landlord.phone || '').split('/')[0].trim();
  const waValidation = validateWhatsAppPhone(rawPhone, '225');
  const sanitizedDigits = waValidation.isValid
    ? waValidation.waDigits
    : sanitizeWhatsAppNumber(rawPhone, '225');

  const whatsappPhoneDisplay = waValidation.isValid
    ? waValidation.formattedDisplay
    : rawPhone;

  const portalUsername =
    (params.overrideUsername ?? landlord.portalUsername ?? '').trim() ||
    deriveDefaultLandlordUsername({
      email: landlord.email,
      phone: landlord.phone,
      fullName: landlord.fullName,
    });

  const portalPassword =
    (params.overridePassword ?? landlord.portalPassword ?? '').trim() ||
    'Non généré';

  const resolvedOrigin =
    params.baseUrl?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const portalUrl = `${resolvedOrigin}/?portal=bailleur`;

  const landlordDisplayName = landlord.companyName
    ? `${landlord.companyName} (${landlord.fullName})`
    : landlord.fullName;

  const messageText = [
    `*ACCÈS PORTAIL BAILLEUR — ${agencyName.toUpperCase()}*`,
    ``,
    `Bonjour *${landlordDisplayName}*,`,
    `Votre compte propriétaire est activé pour suivre vos biens immobiliers en temps réel.`,
    ``,
    `🔗 *Lien de connexion Portail Bailleur* :`,
    `${portalUrl}`,
    ``,
    `👤 *Compte (Identifiant)* : ${portalUsername}`,
    `🔑 *Mot de passe* : ${portalPassword}`,
    ``,
    `Depuis votre portail sécurisé, vous pouvez consulter à tout moment :`,
    `• L'état d'occupation et la localisation GPS de vos biens`,
    `• Vos contrats de bail PDF et locataires en place`,
    `• Vos loyers encaissés, quittances PDF et reversements nets`,
    ``,
    `Cordialement,`,
    `*${agencyName}*`,
  ].join('\n');

  const whatsappUrl = sanitizedDigits
    ? `https://wa.me/${sanitizedDigits}?text=${encodeURIComponent(messageText)}`
    : '';

  return {
    landlordId: landlord.id,
    landlordDisplayName,
    portalUsername,
    portalPassword,
    portalUrl,
    whatsappPhoneDisplay,
    sanitizedDigits,
    isCompliant: Boolean(sanitizedDigits.length >= 8),
    validationError: waValidation.isValid ? undefined : waValidation.error,
    messageText,
    whatsappUrl,
  };
}

/**
 * Authentification de secours sur les données disponibles (/api/gimmo/overview ou cache local)
 * si un proxy / environnement statique renvoie une erreur 404/502/503 non-JSON.
 */
async function authenticateFromSnapshotFallback(params: {
  identifier?: string;
  password: string;
  explicitLandlordId?: number;
}): Promise<LandlordPortalSession> {
  const cleanId = (params.identifier || '').trim().toLowerCase();
  const idDigits = (params.identifier || '').replace(/\D+/g, '');
  const cleanPass = (params.password || '').trim();

  let snapshot: any = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('gimmo_offline_cache_v3');
      if (raw) {
        snapshot = JSON.parse(raw);
      }
    } catch {
      // ignore localStorage read error
    }
  }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const ovRes = await fetch('/api/gimmo/overview', { cache: 'no-store' });
      const parsedOv = await parseJsonResponseSafely<any>(ovRes);
      if (ovRes.ok && parsedOv.isJson && parsedOv.data) {
        const remote = parsedOv.data;
        const localLandlords: Landlord[] = snapshot?.landlords || [];
        const remoteLandlords: Landlord[] = remote.landlords || [];
        // Fusionne les identifiants portail éventuellement créés localement en attente de synchro
        const mergedLandlords = remoteLandlords.map((rl) => {
          const localMatch = localLandlords.find((ll) => ll.id === rl.id);
          if (!localMatch) return rl;
          return {
            ...rl,
            portalUsername: rl.portalUsername || localMatch.portalUsername,
            portalPassword: rl.portalPassword || localMatch.portalPassword,
            portalEnabled:
              rl.portalEnabled !== undefined
                ? rl.portalEnabled
                : localMatch.portalEnabled,
          };
        });
        for (const ll of localLandlords) {
          if (!mergedLandlords.some((m) => m.id === ll.id)) {
            mergedLandlords.push(ll);
          }
        }
        snapshot = {
          ...remote,
          landlords: mergedLandlords,
        };
      }
    } catch {
      // ignore network error and rely on local snapshot
    }
  }

  const allLandlords: Landlord[] = snapshot?.landlords || [];
  const candidates = allLandlords.filter((l) => {
    if (params.explicitLandlordId && l.id === params.explicitLandlordId) {
      return true;
    }
    const uName = (
      l.portalUsername ||
      deriveDefaultLandlordUsername({
        email: l.email,
        phone: l.phone,
        fullName: l.fullName,
      })
    )
      .trim()
      .toLowerCase();
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
      'Aucun mot de passe portail n’a encore été généré pour ce compte. Demandez vos accès WhatsApp à votre agence.'
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

  const landlordProperties = (snapshot?.properties || []).filter(
    (p: any) => p.landlordId === matched.id
  );
  const landlordLeases = (snapshot?.leases || []).filter(
    (l: any) => l.landlordId === matched.id
  );
  const landlordPayments = (snapshot?.payments || []).filter(
    (p: any) => p.landlordId === matched.id
  );
  const tenantIds = new Set<number>([
    ...landlordLeases.map((l: any) => Number(l.tenantId)),
    ...landlordPayments.map((p: any) => Number(p.tenantId)),
  ]);
  const landlordTenants = (snapshot?.tenants || []).filter((t: any) =>
    tenantIds.has(Number(t.id))
  );
  const managementCompany = resolveManagementCompany(
    snapshot?.templates || createInitialTemplatesStore()
  );

  return {
    landlord: matched,
    properties: landlordProperties,
    leases: landlordLeases,
    tenants: landlordTenants,
    payments: landlordPayments,
    managementCompany,
    authenticatedAt: new Date().toISOString(),
  };
}

/**
 * Connexion ou rafraîchissement résilient du Portail Bailleur (compatible serveur Express,
 * réveil Cloud Run et repli local si un proxy renvoie une réponse non-JSON).
 */
export async function authenticateOrRefreshLandlordPortalClient(params: {
  identifier?: string;
  password: string;
  explicitLandlordId?: number;
}): Promise<LandlordPortalSession> {
  const isRefresh = Boolean(params.explicitLandlordId);
  const endpoint = isRefresh
    ? '/api/landlord-portal/refresh'
    : '/api/landlord-portal/login';
  const payload = isRefresh
    ? {
        landlordId: params.explicitLandlordId,
        password: params.password.trim(),
      }
    : {
        identifier: (params.identifier || '').trim(),
        password: params.password.trim(),
      };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return authenticateFromSnapshotFallback(params);
  }

  try {
    let res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let parsed = await parseJsonResponseSafely<any>(res);

    if (
      !parsed.isJson &&
      (res.status === 404 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504)
    ) {
      await new Promise((r) => setTimeout(r, 800));
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      parsed = await parseJsonResponseSafely<any>(res);
    }

    if (parsed.isJson && parsed.data) {
      if (res.ok && parsed.data.landlord) {
        return parsed.data as LandlordPortalSession;
      }
      if (parsed.data.error) {
        throw new Error(String(parsed.data.error));
      }
    }

    // Si la réponse n'est pas du JSON (ex: 404 "The page could not be found" sur une instance non redéployée),
    // repli transparent sur les données synchronisées
    return await authenticateFromSnapshotFallback(params);
  } catch (err: any) {
    // Si c'est une vraie erreur d'identifiant/mot de passe explicite, la remonter telle quelle
    if (
      err instanceof Error &&
      (err.message.includes('Mot de passe incorrect') ||
        err.message.includes('désactivé') ||
        err.message.includes('Aucun compte bailleur') ||
        err.message.includes('Aucun mot de passe'))
    ) {
      throw err;
    }
    return authenticateFromSnapshotFallback(params);
  }
}
