import { type SaaSTenantAgency } from '../types/gimmo.ts';

export interface WhatsAppCountryRule {
  code: string; // digits without '+', e.g. '225'
  iso: string;
  label: string;
  placeholder: string;
  nationalLengths: number[];
  keepLeadingZero: boolean;
  validPrefixes?: string[];
  exampleFormatted: string;
}

export const WHATSAPP_COUNTRY_RULES: WhatsAppCountryRule[] = [
  {
    code: '225',
    iso: 'CI',
    label: 'Côte d’Ivoire (+225)',
    placeholder: '07 08 09 10 11',
    nationalLengths: [10],
    keepLeadingZero: true,
    validPrefixes: ['01', '05', '07', '21', '25', '27'],
    exampleFormatted: '+225 07 08 09 10 11',
  },
  {
    code: '221',
    iso: 'SN',
    label: 'Sénégal (+221)',
    placeholder: '77 123 45 67',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['70', '75', '76', '77', '78', '33'],
    exampleFormatted: '+221 77 123 45 67',
  },
  {
    code: '223',
    iso: 'ML',
    label: 'Mali (+223)',
    placeholder: '76 12 34 56',
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ['5', '6', '7', '8', '9', '2', '4'],
    exampleFormatted: '+223 76 12 34 56',
  },
  {
    code: '226',
    iso: 'BF',
    label: 'Burkina Faso (+226)',
    placeholder: '70 12 34 56',
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ['5', '6', '7', '0', '2'],
    exampleFormatted: '+226 70 12 34 56',
  },
  {
    code: '229',
    iso: 'BJ',
    label: 'Bénin (+229)',
    placeholder: '01 97 12 34 56',
    nationalLengths: [10],
    keepLeadingZero: true,
    validPrefixes: ['01'],
    exampleFormatted: '+229 01 97 12 34 56',
  },
  {
    code: '228',
    iso: 'TG',
    label: 'Togo (+228)',
    placeholder: '90 12 34 56',
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ['7', '9', '2'],
    exampleFormatted: '+228 90 12 34 56',
  },
  {
    code: '227',
    iso: 'NE',
    label: 'Niger (+227)',
    placeholder: '96 12 34 56',
    nationalLengths: [8],
    keepLeadingZero: false,
    validPrefixes: ['7', '8', '9', '2'],
    exampleFormatted: '+227 96 12 34 56',
  },
  {
    code: '224',
    iso: 'GN',
    label: 'Guinée (+224)',
    placeholder: '622 12 34 56',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['6'],
    exampleFormatted: '+224 622 12 34 56',
  },
  {
    code: '237',
    iso: 'CM',
    label: 'Cameroun (+237)',
    placeholder: '6 99 12 34 56',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['6', '2'],
    exampleFormatted: '+237 6 99 12 34 56',
  },
  {
    code: '241',
    iso: 'GA',
    label: 'Gabon (+241)',
    placeholder: '07 12 34 56',
    nationalLengths: [7, 8, 9],
    keepLeadingZero: false,
    exampleFormatted: '+241 77 12 34 56',
  },
  {
    code: '242',
    iso: 'CG',
    label: 'Congo (+242)',
    placeholder: '06 123 45 67',
    nationalLengths: [9],
    keepLeadingZero: true,
    validPrefixes: ['04', '05', '06', '22'],
    exampleFormatted: '+242 06 123 45 67',
  },
  {
    code: '243',
    iso: 'CD',
    label: 'RD Congo (+243)',
    placeholder: '81 234 56 78',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['8', '9'],
    exampleFormatted: '+243 81 234 56 78',
  },
  {
    code: '212',
    iso: 'MA',
    label: 'Maroc (+212)',
    placeholder: '6 12 34 56 78',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['5', '6', '7'],
    exampleFormatted: '+212 6 12 34 56 78',
  },
  {
    code: '216',
    iso: 'TN',
    label: 'Tunisie (+216)',
    placeholder: '20 123 456',
    nationalLengths: [8],
    keepLeadingZero: false,
    exampleFormatted: '+216 20 123 456',
  },
  {
    code: '213',
    iso: 'DZ',
    label: 'Algérie (+213)',
    placeholder: '5 51 23 45 67',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['5', '6', '7'],
    exampleFormatted: '+213 5 51 23 45 67',
  },
  {
    code: '33',
    iso: 'FR',
    label: 'France (+33)',
    placeholder: '6 12 34 56 78',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['6', '7', '1', '2', '3', '4', '5', '9'],
    exampleFormatted: '+33 6 12 34 56 78',
  },
  {
    code: '32',
    iso: 'BE',
    label: 'Belgique (+32)',
    placeholder: '470 12 34 56',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['4'],
    exampleFormatted: '+32 470 12 34 56',
  },
  {
    code: '41',
    iso: 'CH',
    label: 'Suisse (+41)',
    placeholder: '79 123 45 67',
    nationalLengths: [9],
    keepLeadingZero: false,
    validPrefixes: ['7'],
    exampleFormatted: '+41 79 123 45 67',
  },
  {
    code: '1',
    iso: 'US',
    label: 'Canada / USA (+1)',
    placeholder: '514 555 0199',
    nationalLengths: [10],
    keepLeadingZero: false,
    exampleFormatted: '+1 514 555 0199',
  },
];

export interface WhatsAppValidationResult {
  isValid: boolean;
  e164: string; // ex: '+2250708091011'
  waDigits: string; // ex: '2250708091011'
  formattedDisplay: string; // ex: '+225 07 08 09 10 11'
  countryCode: string; // ex: '225'
  countryLabel: string;
  error?: string;
}

function formatNationalPairs(national: string): string {
  if (national.length % 2 === 0) {
    return national.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  if (national.length === 9) {
    return `${national.slice(0, 1)} ${national
      .slice(1)
      .replace(/(\d{2})(?=\d)/g, '$1 ')
      .trim()}`;
  }
  return national;
}

function detectRuleFromLeadingDigits(digits: string): WhatsAppCountryRule | undefined {
  // Trie par longueur d'indicatif décroissante (ex: '225' avant '1')
  const sorted = [...WHATSAPP_COUNTRY_RULES].sort(
    (a, b) => b.code.length - a.code.length
  );
  return sorted.find((r) => digits.startsWith(r.code));
}

/**
 * Valide et normalise strictement un numéro WhatsApp au format international E.164 (compatible wa.me).
 */
export function validateWhatsAppPhone(
  rawInput: string,
  defaultCountryCode = '225'
): WhatsAppValidationResult {
  const trimmed = String(rawInput || '').trim();
  const fallbackRule =
    WHATSAPP_COUNTRY_RULES.find((r) => r.code === defaultCountryCode) ||
    WHATSAPP_COUNTRY_RULES[0];

  if (!trimmed) {
    return {
      isValid: false,
      e164: '',
      waDigits: '',
      formattedDisplay: '',
      countryCode: fallbackRule.code,
      countryLabel: fallbackRule.label,
      error: `Veuillez saisir un numéro WhatsApp valide (ex : ${fallbackRule.exampleFormatted}).`,
    };
  }

  // Refuse la présence de lettres (numéro mal saisi)
  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      e164: '',
      waDigits: '',
      formattedDisplay: trimmed,
      countryCode: fallbackRule.code,
      countryLabel: fallbackRule.label,
      error:
        'Le numéro WhatsApp ne doit contenir que des chiffres (et éventuellement l’indicatif +...).',
    };
  }

  // Nettoyage d'un éventuel "(0)" au milieu d'un numéro international ex: +33 (0)6... ou +225 (0)7...
  const cleanedParenZero = trimmed.replace(/\(0\)/g, '0');
  const hasExplicitIntlPrefix =
    cleanedParenZero.startsWith('+') || cleanedParenZero.startsWith('00');

  let digits = cleanedParenZero.replace(/\D+/g, '');
  if (cleanedParenZero.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (!digits || digits.length < 8) {
    return {
      isValid: false,
      e164: '',
      waDigits: '',
      formattedDisplay: trimmed,
      countryCode: fallbackRule.code,
      countryLabel: fallbackRule.label,
      error: `Numéro WhatsApp trop court. Format attendu pour ${fallbackRule.label} : ${fallbackRule.exampleFormatted}.`,
    };
  }

  // Détection de l'indicatif pays et extraction du numéro national
  let activeRule: WhatsAppCountryRule | undefined = fallbackRule;
  let national = digits;

  if (hasExplicitIntlPrefix) {
    const matched = detectRuleFromLeadingDigits(digits);
    if (matched) {
      activeRule = matched;
      national = digits.slice(matched.code.length);
      // Cas fréquent : double saisie de l'indicatif ex: +225 225 07... ou +225 00225 07...
      if (national.startsWith(`00${matched.code}`)) {
        national = national.slice(matched.code.length + 2);
      } else if (
        national.startsWith(matched.code) &&
        national.length - matched.code.length >= Math.min(...matched.nationalLengths)
      ) {
        national = national.slice(matched.code.length);
      }
    } else {
      // Autre pays international non listé explicitement : validation norme ITU-T E.164 (8 à 15 chiffres, sans 0 initial)
      if (digits.startsWith('0') || digits.length < 10 || digits.length > 15) {
        return {
          isValid: false,
          e164: '',
          waDigits: '',
          formattedDisplay: trimmed,
          countryCode: defaultCountryCode,
          countryLabel: 'International',
          error:
            'Indicatif ou numéro international WhatsApp non conforme (8 à 15 chiffres requis au format +IndicatifNuméro).',
        };
      }
      if (/^(\d)\1{6,}$/.test(digits.slice(-8))) {
        return {
          isValid: false,
          e164: '',
          waDigits: '',
          formattedDisplay: trimmed,
          countryCode: defaultCountryCode,
          countryLabel: 'International',
          error: 'Ce numéro WhatsApp semble fictif ou non conforme.',
        };
      }
      return {
        isValid: true,
        e164: `+${digits}`,
        waDigits: digits,
        formattedDisplay: `+${digits}`,
        countryCode: digits.slice(0, 3),
        countryLabel: 'International',
      };
    }
  } else {
    // Pas de '+' ni '00' : vérifier si l'utilisateur a quand même tapé l'indicatif en tête (ex: 2250708091011)
    if (
      digits.startsWith(fallbackRule.code) &&
      fallbackRule.nationalLengths.includes(digits.length - fallbackRule.code.length)
    ) {
      national = digits.slice(fallbackRule.code.length);
    } else {
      // Sinon vérifie s'il a tapé un autre indicatif complet reconnu (ex: 221771234567)
      const matchedOther = detectRuleFromLeadingDigits(digits);
      if (
        matchedOther &&
        !fallbackRule.nationalLengths.includes(digits.length) &&
        matchedOther.nationalLengths.includes(digits.length - matchedOther.code.length)
      ) {
        activeRule = matchedOther;
        national = digits.slice(matchedOther.code.length);
      }
    }
  }

  // Normalisation spécifique du 0 national selon le pays
  if (activeRule.code === '225') {
    // Côte d'Ivoire (+225) : plan national à 10 chiffres commençant OBLIGATOIREMENT par 01, 05, 07 (mobile) ou 21, 25, 27
    if (national.length === 9 && /^[157]/.test(national)) {
      national = `0${national}`;
    }
    if (national.length !== 10) {
      return {
        isValid: false,
        e164: '',
        waDigits: '',
        formattedDisplay: trimmed,
        countryCode: activeRule.code,
        countryLabel: activeRule.label,
        error: `Numéro WhatsApp Côte d’Ivoire (+225) non conforme : 10 chiffres requis (vous en avez saisi ${national.length}). Exemple : ${activeRule.exampleFormatted}.`,
      };
    }
    const prefix2 = national.slice(0, 2);
    if (!['01', '05', '07', '21', '25', '27'].includes(prefix2)) {
      return {
        isValid: false,
        e164: '',
        waDigits: '',
        formattedDisplay: trimmed,
        countryCode: activeRule.code,
        countryLabel: activeRule.label,
        error: `Préfixe « ${prefix2} » non conforme pour la Côte d’Ivoire (+225). Le numéro doit commencer par 01, 05 ou 07 (ex : ${activeRule.exampleFormatted}).`,
      };
    }
  } else if (activeRule.code === '229') {
    // Bénin (+229) : plan à 10 chiffres commençant par 01 (conversion auto si 8 chiffres saisis)
    if (national.length === 8 && !national.startsWith('01')) {
      national = `01${national}`;
    }
    if (national.length !== 10 || !national.startsWith('01')) {
      return {
        isValid: false,
        e164: '',
        waDigits: '',
        formattedDisplay: trimmed,
        countryCode: activeRule.code,
        countryLabel: activeRule.label,
        error: `Numéro WhatsApp Bénin (+229) non conforme : 10 chiffres commençant par 01 requis (ex : ${activeRule.exampleFormatted}).`,
      };
    }
  } else if (!activeRule.keepLeadingZero) {
    // Pays où le 0 national (trunk prefix) DOIT être retiré en international (France +33, Maroc +212, Sénégal +221, RDC +243, Belgique +32, Suisse +41, Algérie +213, Cameroun +237...)
    if (
      national.startsWith('0') &&
      activeRule.nationalLengths.includes(national.length - 1)
    ) {
      national = national.slice(1);
    }
  }

  // Vérification de la longueur nationale
  if (!activeRule.nationalLengths.includes(national.length)) {
    const expectedStr = activeRule.nationalLengths.join(' ou ');
    return {
      isValid: false,
      e164: '',
      waDigits: '',
      formattedDisplay: trimmed,
      countryCode: activeRule.code,
      countryLabel: activeRule.label,
      error: `Numéro WhatsApp non conforme pour ${activeRule.label} : ${expectedStr} chiffres attendus après +${activeRule.code} (ex : ${activeRule.exampleFormatted}).`,
    };
  }

  // Vérification des préfixes valides du pays s'ils sont définis
  if (
    activeRule.validPrefixes &&
    !activeRule.validPrefixes.some((p) => national.startsWith(p))
  ) {
    return {
      isValid: false,
      e164: '',
      waDigits: '',
      formattedDisplay: trimmed,
      countryCode: activeRule.code,
      countryLabel: activeRule.label,
      error: `Numéro WhatsApp non conforme pour ${activeRule.label}. Exemple attendu : ${activeRule.exampleFormatted}.`,
    };
  }

  // Rejet des numéros fictifs remplis de 00000000 ou d'un même chiffre répété
  const subscriberTail = national.slice(-7);
  if (/^0{7,}$/.test(subscriberTail) || /^(\d)\1{7,}$/.test(national)) {
    return {
      isValid: false,
      e164: '',
      waDigits: '',
      formattedDisplay: trimmed,
      countryCode: activeRule.code,
      countryLabel: activeRule.label,
      error: `Ce numéro WhatsApp (${trimmed}) est un numéro fictif de démonstration. Veuillez saisir un vrai numéro WhatsApp actif.`,
    };
  }

  const waDigits = `${activeRule.code}${national}`;
  const e164 = `+${waDigits}`;
  const formattedDisplay = `+${activeRule.code} ${formatNationalPairs(national)}`;

  return {
    isValid: true,
    e164,
    waDigits,
    formattedDisplay,
    countryCode: activeRule.code,
    countryLabel: activeRule.label,
  };
}

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
 * Nettoie et normalise un numéro de téléphone WhatsApp pour les liens wa.me (norme E.164 stricte).
 */
export function sanitizeWhatsAppNumber(
  rawPhone: string,
  defaultCountryCode = '225'
): string {
  const firstCandidate = String(rawPhone || '').split('/')[0]?.trim() || '';
  const validated = validateWhatsAppPhone(firstCandidate, defaultCountryCode);
  if (validated.isValid) {
    return validated.waDigits;
  }

  // Repli de nettoyage si un ancien enregistrement a un format atypique
  let digits = firstCandidate.replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 && /^(01|05|07|21|25|27)/.test(digits)) {
    return `225${digits}`;
  }
  if (digits.length === 12 && /^225[157]/.test(digits)) {
    return `2250${digits.slice(3)}`;
  }
  if (digits.length === 10 && /^0[67]/.test(digits)) {
    return `33${digits.slice(1)}`;
  }
  if (/^(33|212|243|32|41|213)0\d{9}$/.test(digits)) {
    const prefixMatch = digits.match(/^(33|212|243|32|41|213)0(\d{9})$/);
    if (prefixMatch) {
      return `${prefixMatch[1]}${prefixMatch[2]}`;
    }
  }
  return digits;
}

export interface AgencyWhatsAppNotification {
  agencyName: string;
  directorName: string;
  whatsappPhone: string;
  sanitizedDigits: string;
  isCompliant: boolean;
  validationError?: string;
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
  const rawWhatsapp = (agency.whatsappPhone || agency.phone || '').split('/')[0].trim();
  const validation = validateWhatsAppPhone(rawWhatsapp);
  const sanitizedDigits = validation.isValid
    ? validation.waDigits
    : sanitizeWhatsAppNumber(rawWhatsapp);
  const displayPhone = validation.isValid ? validation.formattedDisplay : rawWhatsapp;

  const createdAtLabel = new Date().toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const statusText =
    agency.status === 'pending_approval'
      ? 'En attente d’approbation du Super Admin (assamoighislain@gmail.com)'
      : 'Agence Active & Approuvée';

  const messageText = [
    `*NOTIFICATION GIMMO SaaS — CRÉATION D'AGENCE IMMOBILIÈRE*`,
    ``,
    `Bonjour *${agency.managerName}*,`,
    `Votre agence immobilière a bien été enregistrée sur la plateforme *Gimmo* :`,
    `- *Agence Immobilière (Clé Unique)* : ${agency.companyName}`,
    `- *Directeur d’Agence (Rôle par défaut)* : ${agency.managerName}`,
    `- *Email* : ${agency.ownerEmail}`,
    `- *WhatsApp* : ${displayPhone}`,
    `- *RCCM / ID Fiscal* : ${agency.rccm} / ${agency.taxId}`,
    `- *Ville* : ${agency.address}, ${agency.city}`,
    `- *Statut* : ${statusText}`,
    ``,
    `Dès validation par le Super Admin, vous pourrez vous connecter à votre espace de gestion locative.`,
  ].join('\n');

  const whatsappUrl = sanitizedDigits
    ? `https://api.whatsapp.com/send?phone=${sanitizedDigits}&text=${encodeURIComponent(messageText)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

  return {
    agencyName: agency.companyName,
    directorName: agency.managerName,
    whatsappPhone: displayPhone,
    sanitizedDigits,
    isCompliant: validation.isValid,
    validationError: validation.error,
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
  const rawWhatsapp = (agency.whatsappPhone || agency.phone || '').split('/')[0].trim();
  const validation = validateWhatsAppPhone(rawWhatsapp);
  const sanitizedDigits = validation.isValid
    ? validation.waDigits
    : sanitizeWhatsAppNumber(rawWhatsapp);
  const displayPhone = validation.isValid ? validation.formattedDisplay : rawWhatsapp;

  const createdAtLabel = new Date().toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const messageText = [
    `*GIMMO SaaS — AGENCE IMMOBILIÈRE APPROUVÉE PAR LE SUPER ADMIN*`,
    ``,
    `Bonjour *${agency.managerName}*,`,
    `Le Super Administrateur (*assamoighislain@gmail.com*) vient d'approuver votre agence immobilière :`,
    `- *Agence* : ${agency.companyName}`,
    `- *Rôle* : Directeur d’Agence`,
    `- *Identifiant de connexion* : ${agency.ownerEmail}`,
    `- *Statut* : Actif (En-tête PDF & espace de gestion opérationnels)`,
    ``,
    `Vous pouvez désormais vous connecter à l'application Gimmo.`,
  ].join('\n');

  const whatsappUrl = sanitizedDigits
    ? `https://api.whatsapp.com/send?phone=${sanitizedDigits}&text=${encodeURIComponent(messageText)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

  return {
    agencyName: agency.companyName,
    directorName: agency.managerName,
    whatsappPhone: displayPhone,
    sanitizedDigits,
    isCompliant: validation.isValid,
    validationError: validation.error,
    messageText,
    whatsappUrl,
    createdAtLabel,
  };
}
