import type {
  AccountingMonth,
  PropertyTypeItem,
  ManagementCompanyProfile,
  SaaSTenantAgency,
  SaaSUserAccount,
} from '../types/gimmo.ts';

export interface LeaseTemplateConfig {
  presetId: 'habitation_standard' | 'commercial_ohada' | 'meuble_courte_duree' | 'custom';
  accentColor: string;
  documentTitle: string;
  documentSubtitle: string;
  showPostgisCoords: boolean;
  article1Title: string;
  article1Body: string;
  article2Title: string;
  article2Body: string;
  article3Title: string;
  article3Body: string;
  article4Title: string;
  article4Body: string;
  article5Title: string;
  article5Body: string;
  article6Title: string;
  article6Body: string;
  landlordSignatureLabel: string;
  tenantSignatureLabel: string;
  signatureSubtext: string;
  footerText: string;
}

export interface ReceiptTemplateConfig {
  presetId: 'quittance_classique' | 'facture_commerciale' | 'recu_compact' | 'custom';
  accentColor: string;
  agencyBrandTitle: string;
  agencyBrandSubtitle: string;
  documentTitle: string;
  rentRowLabel: string;
  chargesRowLabel: string;
  attestationBody: string;
  signatureLabel: string;
  footerNote: string;
}

export interface DocumentTemplatesStore {
  /**
   * Key is 'default' for global template or 'landlord_<id>' for per-landlord override
   */
  leases: Record<string, LeaseTemplateConfig>;
  receipts: Record<string, ReceiptTemplateConfig>;
  accountingMonths?: AccountingMonth[];
  propertyTypes?: PropertyTypeItem[];
  managementCompany?: ManagementCompanyProfile;
  saasTenants?: SaaSTenantAgency[];
  saasUsers?: SaaSUserAccount[];
  updatedAt: string;
}

export const DEFAULT_MANAGEMENT_COMPANY: ManagementCompanyProfile = {
  companyName: 'GIMMO PRESTIGE IMMOBILIER SARL',
  tradeName: 'GIMMO GESTION & PATRIMOINE',
  legalForm: 'SARL au capital de 10 000 000 FCFA',
  rccm: 'CI-ABJ-03-2024-B12-04892',
  taxId: 'CC 2408915 M',
  licenseNumber: 'Agrément Ministériel MCLU N° 0184/MCLU/DGLCV/AG',
  managerName: 'M. Ghislain Assamoi',
  managerTitle: 'Directeur Général & Administrateur de Biens',
  address: 'Boulevard Latrille, Cocody Deux-Plateaux Vallons, Immeuble Prestige 3e étage',
  city: 'Abidjan — Côte d’Ivoire',
  phone: '+225 07 07 00 11 22 / +225 27 22 41 00 00',
  email: 'assamoighislain@gmail.com',
  website: 'www.gimmo-prestige.ci',
  bankInfo: 'SGBCI CI008 01111 012345678901 88 · Orange Money Marchand : #144*821#',
  headerSlogan:
    'Société de Gérance Locative, Syndic de Copropriété & Administration de Patrimoine Immobilier',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

export const DEFAULT_SAAS_TENANTS: SaaSTenantAgency[] = [
  {
    id: 'tenant_gimmo_prestige',
    companyName: 'GIMMO PRESTIGE IMMOBILIER SARL',
    tradeName: 'GIMMO GESTION & PATRIMOINE',
    legalForm: 'SARL au capital de 10 000 000 FCFA',
    rccm: 'CI-ABJ-03-2024-B12-04892',
    taxId: 'CC 2408915 M',
    licenseNumber: 'Agrément MCLU N° 0184/MCLU/DGLCV/AG',
    managerName: 'M. Ghislain Assamoi',
    ownerEmail: 'assamoighislain@gmail.com',
    phone: '+225 07 07 00 11 22',
    whatsappPhone: '+225 07 07 00 11 22',
    address: 'Cocody Deux-Plateaux Vallons, Boulevard Latrille',
    city: 'Abidjan',
    plan: 'enterprise',
    status: 'active',
    monthlyFeeFcfa: 150000,
    maxProperties: 500,
    maxLandlords: 100,
    subscriptionEndsAt: '2027-12-31',
    isCurrentTenant: true,
    createdAt: '2026-01-10T00:00:00.000Z',
  },
];

export const DEFAULT_SAAS_USERS: SaaSUserAccount[] = [
  {
    id: 'user_super_admin_main',
    fullName: 'Ghislain Assamoi',
    email: 'assamoighislain@gmail.com',
    role: 'super_admin',
    tenantId: 'tenant_gimmo_prestige',
    tenantName: 'GIMMO PRESTIGE IMMOBILIER SARL',
    status: 'active',
    lastLoginAt: '2026-11-13T08:30:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_LEASE_TEMPLATE: LeaseTemplateConfig = {
  presetId: 'habitation_standard',
  accentColor: '#1E1B4B',
  documentTitle: 'CONTRAT DE BAIL LOCATIF',
  documentSubtitle:
    'Contrat N° {{numero_contrat}} — Établi pour {{nom_bailleur}} par {{nom_societe_gestion}}',
  showPostgisCoords: true,
  article1Title: 'ARTICLE 1 : DÉSIGNATION DES PARTIES & MANDATAIRE',
  article1Body:
    'ENTRE LE BAILLEUR : {{nom_bailleur}}, immatriculé sous le N° {{id_fiscal_bailleur}}, demeurant à {{adresse_bailleur}}, Téléphone : {{telephone_bailleur}}, représenté aux présentes par son mandataire exclusif la société {{nom_societe_gestion}} (RCCM : {{rccm_societe_gestion}}, {{agrement_societe_gestion}}), sise à {{adresse_societe_gestion}}, Tél : {{telephone_societe_gestion}}.\n\nET LE PRENEUR (LOCATAIRE) : M./Mme {{nom_locataire}}, titulaire de la pièce d’identité N° {{cni_locataire}}, exerçant la profession de {{profession_locataire}} ({{employeur_locataire}}), joignable sur WhatsApp au {{whatsapp_locataire}} et par email à {{email_locataire}}.',
  article2Title: 'ARTICLE 2 : DÉSIGNATION ET GÉOLOCALISATION DU BIEN',
  article2Body:
    'Référence : {{reference_bien}} — {{titre_bien}} ({{type_bien}})\nSituation géographique : {{adresse_bien}}, Quartier {{quartier_bien}}, {{ville_bien}}.\nConsistance : Superficie de {{surface_bien}} m² comprenant {{pieces_bien}} pièces principales.',
  article3Title: 'ARTICLE 3 : DURÉE ET PRISE D’EFFET',
  article3Body:
    'Le présent bail prend effet le {{date_debut}} et se terminera le {{date_fin}}, sauf dénonciation par l’une des parties dans le respect du préavis légal de trois (3) mois.',
  article4Title: 'ARTICLE 4 : LOYER, CHARGES ET DÉPÔT DE GARANTIE',
  article4Body:
    '• Loyer mensuel principal : {{loyer_mensuel}}\n• Provision mensuelle sur charges : {{charges}}\n• Total mensuel exigible : {{total_mensuel}} payable d’avance au plus tard le {{jour_echeance}} de chaque mois auprès de {{nom_societe_gestion}}.\n• Dépôt de garantie (Caution) versé à la signature : {{caution}}.',
  article5Title: 'ARTICLE 5 : DISPOSITIONS PARTICULIÈRES DU BAILLEUR',
  article5Body:
    '{{note_bailleur}}\n\nClauses additionnelles du contrat : {{clauses_contrat}}',
  article6Title: 'ARTICLE 6 : ENTRETIEN, ASSURANCE ET RÉSILIATION',
  article6Body:
    'Le Preneur s’engage à user des lieux loués en bon père de famille, à souscrire une assurance multirisque habitation dès la remise des clés et à ne procéder à aucune transformation sans l’accord écrit préalable du Bailleur ou de {{nom_societe_gestion}}.',
  landlordSignatureLabel: 'POUR LE BAILLEUR ({{nom_societe_gestion}})',
  tenantSignatureLabel: 'LE PRENEUR (Locataire)',
  signatureSubtext: 'Signature précédée de la mention « Lu et approuvé »',
  footerText:
    '{{nom_societe_gestion}} · RCCM {{rccm_societe_gestion}} · Jeton d’authenticité : {{jeton_partage}}',
};

export const LEASE_PRESETS: Record<
  'habitation_standard' | 'commercial_ohada' | 'meuble_courte_duree',
  { label: string; description: string; config: LeaseTemplateConfig }
> = {
  habitation_standard: {
    label: 'Bail d’Habitation Standard (CI / OHADA)',
    description:
      'Modèle complet avec clauses résidentielles, dépôt de garantie et préavis de 3 mois.',
    config: DEFAULT_LEASE_TEMPLATE,
  },
  commercial_ohada: {
    label: 'Bail à Usage Professionnel / Commercial (AUDCG OHADA)',
    description:
      'Adapté aux bureaux, boutiques et locaux commerciaux avec révision triennale et droit au renouvellement.',
    config: {
      ...DEFAULT_LEASE_TEMPLATE,
      presetId: 'commercial_ohada',
      accentColor: '#0F172A',
      documentTitle: 'CONTRAT DE BAIL À USAGE PROFESSIONNEL (OHADA)',
      documentSubtitle:
        'Bail Commercial N° {{numero_contrat}} — Régime Acte Uniforme OHADA — {{nom_bailleur}}',
      article3Title: 'ARTICLE 3 : DURÉE, RENOUVELLEMENT ET PRÉAVIS COMMERCIAL',
      article3Body:
        'Le présent bail professionnel prend effet le {{date_debut}} pour se terminer le {{date_fin}}. Conformément aux dispositions de l’Acte Uniforme OHADA portant sur le Droit Commercial Général, toute demande de renouvellement ou de congé devra être notifiée au moins six (6) mois avant l’expiration du bail.',
      article6Title: 'ARTICLE 6 : DESTINATION DES LIEUX ET ENSEIGNE COMMERCIALE',
      article6Body:
        'Les locaux loués sont exclusivement destinés à l’exercice de l’activité professionnelle du Preneur. Toute pose d’enseigne extérieure ou aménagement technique devra respecter les règles d’urbanisme et de copropriété de {{ville_bien}}.',
    },
  },
  meuble_courte_duree: {
    label: 'Bail Résidence Meublée & Équipée',
    description:
      'Idéal pour les studios haut standing, appartements meublés et villas avec inventaire mobilier.',
    config: {
      ...DEFAULT_LEASE_TEMPLATE,
      presetId: 'meuble_courte_duree',
      accentColor: '#065F46',
      documentTitle: 'CONTRAT DE LOCATION MEUBLÉE',
      documentSubtitle:
        'Convention de Location Meublée N° {{numero_contrat}} — {{nom_bailleur}}',
      article3Title: 'ARTICLE 3 : DURÉE DE LA LOCATION MEUBLÉE',
      article3Body:
        'La présente location meublée est consentie du {{date_debut}} au {{date_fin}}. Le préavis de départ du Locataire est fixé à un (1) mois par notification écrite.',
      article6Title: 'ARTICLE 6 : INVENTAIRE DU MOBILIER ET ÉTAT DES LIEUX',
      article6Body:
        'Un inventaire contradictoire des équipements, appareils électroménagers et meubles garnissant le bien {{titre_bien}} est annexé au présent contrat. Le Preneur s’engage à les restituer en parfait état de fonctionnement.',
    },
  },
};

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateConfig = {
  presetId: 'quittance_classique',
  accentColor: '#0F172A',
  agencyBrandTitle: '{{nom_societe_gestion}}',
  agencyBrandSubtitle: '{{adresse_societe_gestion}} · Tél : {{telephone_societe_gestion}}',
  documentTitle: 'QUITTANCE DE LOYER',
  rentRowLabel: 'Loyer nu mensuel ({{periode}})',
  chargesRowLabel: 'Provision sur charges locatives (syndic, entretien, sécurité)',
  attestationBody:
    'Nous soussignés, {{nom_societe_gestion}}, agissant en qualité de mandataire de {{nom_bailleur}}, reconnaissons avoir reçu de {{nom_locataire}} la somme de {{montant_paye}} au titre du loyer et des charges pour la période de {{periode}} concernant le bien {{titre_bien}} situé à {{adresse_bien}}, {{quartier_bien}}.\n\nCette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel de la présente échéance.',
  signatureLabel: 'Pour la Société de Gestion {{nom_societe_gestion}} (Cachet & Signature)',
  footerNote:
    '{{nom_societe_gestion}} · RCCM {{rccm_societe_gestion}} · ID Fiscal {{id_fiscal_societe_gestion}} · Jeton : {{jeton_partage}}',
};

export const RECEIPT_PRESETS: Record<
  'quittance_classique' | 'facture_commerciale' | 'recu_compact',
  { label: string; description: string; config: ReceiptTemplateConfig }
> = {
  quittance_classique: {
    label: 'Quittance de Loyer Officielle (Standard)',
    description:
      'Quittance détaillée distinguant le loyer nu et la provision pour charges avec attestation légale.',
    config: DEFAULT_RECEIPT_TEMPLATE,
  },
  facture_commerciale: {
    label: 'Facture de Loyer Acquittée (Bail Commercial)',
    description:
      'Présentation orientée comptabilité d’entreprise et baux professionnels avec références fiscales.',
    config: {
      ...DEFAULT_RECEIPT_TEMPLATE,
      presetId: 'facture_commerciale',
      accentColor: '#1E1B4B',
      documentTitle: 'FACTURE DE LOYER ACQUITTÉE',
      rentRowLabel: 'Redevance locative mensuelle H.T. / T.T.C. ({{periode}})',
      chargesRowLabel: 'Prestations d’immeuble, gardiennage et charges communes',
      attestationBody:
        'Facture acquittée émise par {{nom_societe_gestion}} pour le compte de {{nom_bailleur}} (ID Fiscal : {{id_fiscal_bailleur}}) au profit du preneur {{nom_locataire}} pour un montant réglé de {{montant_paye}} par {{mode_paiement}} en date du {{date_paiement}}, couvrant l’échéance locative de {{periode}} pour le local {{titre_bien}} ({{reference_bien}}).',
      signatureLabel: 'La Direction Comptable & Gérance ({{nom_societe_gestion}})',
    },
  },
  recu_compact: {
    label: 'Reçu d’Encaissement & Quittance Express',
    description:
      'Formulation directe et synthétique idéale pour les envois rapides sur WhatsApp.',
    config: {
      ...DEFAULT_RECEIPT_TEMPLATE,
      presetId: 'recu_compact',
      accentColor: '#065F46',
      documentTitle: 'REÇU & QUITTANCE DE LOYER',
      rentRowLabel: 'Loyer principal période {{periode}}',
      chargesRowLabel: 'Charges locatives forfaitaires',
      attestationBody:
        'Reçu de M./Mme {{nom_locataire}} la somme de {{montant_paye}} (sur {{montant_appele}} appelés) auprès de {{nom_societe_gestion}} pour le loyer de {{periode}} du bien {{titre_bien}} ({{quartier_bien}}). Reste à payer sur la période : {{reste_a_payer}}.',
      signatureLabel: 'Visa du Gestionnaire Mandataire ({{nom_societe_gestion}})',
    },
  },
};

export const TEMPLATE_VARIABLES_HELP: {
  token: string;
  label: string;
  scope: 'both' | 'lease' | 'receipt';
}[] = [
  { token: '{{nom_societe_gestion}}', label: 'Nom de la Société de Gestion (En-tête)', scope: 'both' },
  { token: '{{rccm_societe_gestion}}', label: 'N° RCCM de la Société de Gestion', scope: 'both' },
  { token: '{{id_fiscal_societe_gestion}}', label: 'ID Fiscal / CC de la Société de Gestion', scope: 'both' },
  { token: '{{agrement_societe_gestion}}', label: 'N° Agrément Ministériel de l’Agence', scope: 'both' },
  { token: '{{adresse_societe_gestion}}', label: 'Adresse du Siège de la Société de Gestion', scope: 'both' },
  { token: '{{telephone_societe_gestion}}', label: 'Téléphone de la Société de Gestion', scope: 'both' },
  { token: '{{email_societe_gestion}}', label: 'Email de la Société de Gestion', scope: 'both' },
  { token: '{{gerant_societe_gestion}}', label: 'Nom du Gérant / Directeur de l’Agence', scope: 'both' },
  { token: '{{nom_bailleur}}', label: 'Nom / Société du Bailleur', scope: 'both' },
  { token: '{{id_fiscal_bailleur}}', label: 'ID Fiscal / RCCM Bailleur', scope: 'both' },
  { token: '{{adresse_bailleur}}', label: 'Adresse du Bailleur', scope: 'both' },
  { token: '{{telephone_bailleur}}', label: 'Téléphone du Bailleur', scope: 'both' },
  { token: '{{nom_locataire}}', label: 'Nom complet du Locataire', scope: 'both' },
  { token: '{{cni_locataire}}', label: 'N° CNI / Passeport Locataire', scope: 'both' },
  { token: '{{whatsapp_locataire}}', label: 'WhatsApp du Locataire', scope: 'both' },
  { token: '{{titre_bien}}', label: 'Titre du Bien Immobilier', scope: 'both' },
  { token: '{{reference_bien}}', label: 'Référence du Bien', scope: 'both' },
  { token: '{{adresse_bien}}', label: 'Adresse du Bien', scope: 'both' },
  { token: '{{quartier_bien}}', label: 'Quartier du Bien', scope: 'both' },
  { token: '{{ville_bien}}', label: 'Ville du Bien', scope: 'both' },
  { token: '{{surface_bien}}', label: 'Surface (m²)', scope: 'both' },
  { token: '{{pieces_bien}}', label: 'Nombre de pièces', scope: 'both' },
  { token: '{{numero_contrat}}', label: 'N° du Contrat de Bail', scope: 'both' },
  { token: '{{loyer_mensuel}}', label: 'Loyer nu mensuel', scope: 'lease' },
  { token: '{{charges}}', label: 'Montant des charges', scope: 'lease' },
  { token: '{{total_mensuel}}', label: 'Loyer + Charges', scope: 'lease' },
  { token: '{{caution}}', label: 'Dépôt de garantie (Caution)', scope: 'lease' },
  { token: '{{date_debut}}', label: 'Date de début du bail', scope: 'lease' },
  { token: '{{date_fin}}', label: 'Date de fin du bail', scope: 'lease' },
  { token: '{{jour_echeance}}', label: 'Jour d’échéance mensuel', scope: 'lease' },
  { token: '{{note_bailleur}}', label: 'Note d’en-tête propre au Bailleur', scope: 'lease' },
  { token: '{{clauses_contrat}}', label: 'Clauses particulières du bail', scope: 'lease' },
  { token: '{{numero_quittance}}', label: 'N° de Quittance', scope: 'receipt' },
  { token: '{{periode}}', label: 'Période quittancée (ex: Novembre 2026)', scope: 'receipt' },
  { token: '{{montant_appele}}', label: 'Montant total appelé', scope: 'receipt' },
  { token: '{{montant_paye}}', label: 'Montant réglé par le locataire', scope: 'receipt' },
  { token: '{{reste_a_payer}}', label: 'Solde restant à payer', scope: 'receipt' },
  { token: '{{mode_paiement}}', label: 'Mode de règlement', scope: 'receipt' },
  { token: '{{date_paiement}}', label: 'Date de règlement', scope: 'receipt' },
];

export const DEFAULT_ACCOUNTING_MONTHS: AccountingMonth[] = [
  {
    periodMonth: '2026-12',
    periodLabel: 'Décembre 2026',
    defaultDueDay: 5,
    status: 'open',
    isCurrent: false,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    periodMonth: '2026-11',
    periodLabel: 'Novembre 2026',
    defaultDueDay: 5,
    status: 'open',
    isCurrent: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    periodMonth: '2026-10',
    periodLabel: 'Octobre 2026',
    defaultDueDay: 5,
    status: 'closed',
    isCurrent: false,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
];

const FRENCH_MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export function formatPeriodMonthToLabelFr(periodMonth: string): string {
  const [year, monthStr] = (periodMonth || '').split('-');
  const monthIdx = Number(monthStr) - 1;
  if (year && monthIdx >= 0 && monthIdx < 12) {
    return `${FRENCH_MONTH_NAMES[monthIdx]} ${year}`;
  }
  return periodMonth;
}

export const DEFAULT_PROPERTY_TYPES: PropertyTypeItem[] = [
  {
    id: 'type_appartement',
    name: 'Appartement',
    code: 'APPT',
    category: 'habitation',
    defaultCharges: '45000',
    description: 'Logement résidentiel en immeuble collectif avec syndic et parties communes',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'type_villa',
    name: 'Villa',
    code: 'VILLA',
    category: 'habitation',
    defaultCharges: '80000',
    description: 'Maison individuelle ou villa duplex avec jardin privatif et dépendance',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'type_bureau',
    name: 'Bureau',
    code: 'BUR',
    category: 'professionnel',
    defaultCharges: '75000',
    description: 'Plateau professionnel ou espace de travail tertiaire climatisé',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'type_local_commercial',
    name: 'Local Commercial',
    code: 'COM',
    category: 'commercial',
    defaultCharges: '50000',
    description: 'Boutique, showroom ou magasin en rez-de-chaussée avec vitrine sur rue',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'type_studio',
    name: 'Studio',
    code: 'STD',
    category: 'habitation',
    defaultCharges: '20000',
    description: 'Logement compact de 1 à 2 pièces adapté aux jeunes actifs et étudiants',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function createInitialTemplatesStore(): DocumentTemplatesStore {
  return {
    leases: {
      default: { ...DEFAULT_LEASE_TEMPLATE },
    },
    receipts: {
      default: { ...DEFAULT_RECEIPT_TEMPLATE },
    },
    accountingMonths: [...DEFAULT_ACCOUNTING_MONTHS],
    propertyTypes: [...DEFAULT_PROPERTY_TYPES],
    managementCompany: { ...DEFAULT_MANAGEMENT_COMPANY },
    saasTenants: [...DEFAULT_SAAS_TENANTS],
    saasUsers: [...DEFAULT_SAAS_USERS],
    updatedAt: new Date().toISOString(),
  };
}

export function resolveManagementCompany(
  store: DocumentTemplatesStore | null | undefined
): ManagementCompanyProfile {
  if (store?.managementCompany && store.managementCompany.companyName) {
    return {
      ...DEFAULT_MANAGEMENT_COMPANY,
      ...store.managementCompany,
    };
  }
  return { ...DEFAULT_MANAGEMENT_COMPANY };
}

export function resolveSaaSTenants(
  store: DocumentTemplatesStore | null | undefined
): SaaSTenantAgency[] {
  if (store?.saasTenants && store.saasTenants.length > 0) {
    return [...store.saasTenants];
  }
  return [...DEFAULT_SAAS_TENANTS];
}

export function resolveSaaSUsers(
  store: DocumentTemplatesStore | null | undefined
): SaaSUserAccount[] {
  if (store?.saasUsers && store.saasUsers.length > 0) {
    return [...store.saasUsers];
  }
  return [...DEFAULT_SAAS_USERS];
}

export function resolveAccountingMonths(
  store: DocumentTemplatesStore | null | undefined
): AccountingMonth[] {
  if (store?.accountingMonths && store.accountingMonths.length > 0) {
    return [...store.accountingMonths].sort((a, b) =>
      b.periodMonth.localeCompare(a.periodMonth)
    );
  }
  return [...DEFAULT_ACCOUNTING_MONTHS];
}

export function resolvePropertyTypes(
  store: DocumentTemplatesStore | null | undefined
): PropertyTypeItem[] {
  if (store?.propertyTypes && store.propertyTypes.length > 0) {
    return [...store.propertyTypes];
  }
  return [...DEFAULT_PROPERTY_TYPES];
}

export function resolveLeaseTemplate(
  store: DocumentTemplatesStore | null | undefined,
  landlordId?: number | null
): LeaseTemplateConfig {
  if (!store || !store.leases) return { ...DEFAULT_LEASE_TEMPLATE };
  if (landlordId && store.leases[`landlord_${landlordId}`]) {
    return {
      ...DEFAULT_LEASE_TEMPLATE,
      ...store.leases[`landlord_${landlordId}`],
    };
  }
  return {
    ...DEFAULT_LEASE_TEMPLATE,
    ...(store.leases.default || {}),
  };
}

export function resolveReceiptTemplate(
  store: DocumentTemplatesStore | null | undefined,
  landlordId?: number | null
): ReceiptTemplateConfig {
  if (!store || !store.receipts) return { ...DEFAULT_RECEIPT_TEMPLATE };
  if (landlordId && store.receipts[`landlord_${landlordId}`]) {
    return {
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...store.receipts[`landlord_${landlordId}`],
    };
  }
  return {
    ...DEFAULT_RECEIPT_TEMPLATE,
    ...(store.receipts.default || {}),
  };
}

export function interpolateTemplateVariables(
  templateText: string,
  variables: Record<string, string | number | null | undefined>
): string {
  if (!templateText) return '';
  return templateText.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => {
    const val = variables[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}
