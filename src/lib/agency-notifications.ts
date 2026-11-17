import { type SaaSTenantAgency } from '../types/gimmo.ts';

/**
 * Émet une notification sonore claire et harmonieuse (carillon 4 notes)
 * via l'API Web Audio lorsqu'une Agence Immobilière est créée ou approuvée.
 */
export function playAgencyCreatedSound(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Arpège ascendant harmonieux (Do5 - Mi5 - Sol5 - Do6)
    const notes = [
      { freq: 523.25, start: 0, duration: 0.14 },
      { freq: 659.25, start: 0.12, duration: 0.14 },
      { freq: 783.99, start: 0.24, duration: 0.16 },
      { freq: 1046.5, start: 0.38, duration: 0.36 },
    ];

    const now = ctx.currentTime;

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.24, now + note.start + 0.025);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.start + note.duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1100);

    return true;
  } catch {
    return false;
  }
}

/**
 * Nettoie un numéro de téléphone WhatsApp pour les liens wa.me (chiffres uniquement, avec indicatif 225 par défaut si 10 chiffres).
 */
export function sanitizeWhatsAppNumber(rawPhone: string): string {
  const digits = String(rawPhone || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  if (digits.length === 10 && !digits.startsWith('225')) {
    return `225${digits}`;
  }
  return digits;
}

export interface AgencyWhatsAppNotification {
  agencyName: string;
  directorName: string;
  whatsappPhone: string;
  sanitizedDigits: string;
  messageText: string;
  whatsappUrl: string;
  createdAtLabel: string;
}

/**
 * Construit le message WhatsApp officiel et l'URL wa.me lorsqu'une Agence Immobilière est créée.
 */
export function buildAgencyCreatedWhatsAppDetails(
  agency: SaaSTenantAgency
): AgencyWhatsAppNotification {
  const rawWhatsapp = agency.whatsappPhone || agency.phone || '';
  const sanitizedDigits = sanitizeWhatsAppNumber(rawWhatsapp);
  const createdAtLabel = new Date().toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const statusText =
    agency.status === 'pending_approval'
      ? 'En attente d’approbation du Super Admin (assamoighislain@gmail.com)'
      : 'Agence Active & Approuvée';

  const messageText = [
    `🔔 *NOTIFICATION GIMMO SaaS — CRÉATION D'AGENCE IMMOBILIÈRE*`,
    ``,
    `Bonjour *${agency.managerName}*,`,
    `Votre agence immobilière a bien été enregistrée sur la plateforme *Gimmo* :`,
    `• *Agence Immobilière (Clé Unique)* : ${agency.companyName}`,
    `• *Directeur d’Agence (Rôle par défaut)* : ${agency.managerName}`,
    `• *Email* : ${agency.ownerEmail}`,
    `• *WhatsApp* : ${rawWhatsapp}`,
    `• *RCCM / ID Fiscal* : ${agency.rccm} / ${agency.taxId}`,
    `• *Ville* : ${agency.address}, ${agency.city}`,
    `• *Statut* : ${statusText}`,
    ``,
    `Dès validation par le Super Admin, vous pourrez vous connecter à votre espace de gestion locative.`,
  ].join('\n');

  const whatsappUrl = sanitizedDigits
    ? `https://wa.me/${sanitizedDigits}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  return {
    agencyName: agency.companyName,
    directorName: agency.managerName,
    whatsappPhone: rawWhatsapp,
    sanitizedDigits,
    messageText,
    whatsappUrl,
    createdAtLabel,
  };
}

/**
 * Construit le message WhatsApp d'approbation envoyé par le Super Admin au Directeur d'Agence.
 */
export function buildAgencyApprovedWhatsAppDetails(
  agency: SaaSTenantAgency
): AgencyWhatsAppNotification {
  const rawWhatsapp = agency.whatsappPhone || agency.phone || '';
  const sanitizedDigits = sanitizeWhatsAppNumber(rawWhatsapp);
  const createdAtLabel = new Date().toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const messageText = [
    `✅ *GIMMO SaaS — AGENCE IMMOBILIÈRE APPROUVÉE PAR LE SUPER ADMIN*`,
    ``,
    `Bonjour *${agency.managerName}*,`,
    `Le Super Administrateur (*assamoighislain@gmail.com*) vient d'approuver votre agence immobilière :`,
    `• *Agence* : ${agency.companyName}`,
    `• *Rôle* : Directeur d’Agence`,
    `• *Identifiant de connexion* : ${agency.ownerEmail}`,
    `• *Statut* : Actif (En-tête PDF & espace de gestion opérationnels)`,
    ``,
    `Vous pouvez désormais vous connecter à l'application Gimmo.`,
  ].join('\n');

  const whatsappUrl = sanitizedDigits
    ? `https://wa.me/${sanitizedDigits}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  return {
    agencyName: agency.companyName,
    directorName: agency.managerName,
    whatsappPhone: rawWhatsapp,
    sanitizedDigits,
    messageText,
    whatsappUrl,
    createdAtLabel,
  };
}
