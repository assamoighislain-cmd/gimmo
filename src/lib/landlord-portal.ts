import type { Landlord } from '../types/gimmo.ts';
import {
  sanitizeWhatsAppNumber,
  validateWhatsAppPhone,
} from './agency-notifications.ts';

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Génère un mot de passe clair, mémorisable et sans caractères ambigus (ex: GIM-4829-KP).
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

  const lastDigits = (params.phone || '').replace(/\D+/g, '').slice(-4) || '2026';
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
