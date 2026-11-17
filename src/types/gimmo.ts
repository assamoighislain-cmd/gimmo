export interface Landlord {
  id: number;
  userId: string;
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string;
  address: string;
  taxId: string | null;
  iban: string | null;
  commissionRate: number;
  contractHeaderNote: string | null;
  createdAt: string;
}

export interface Property {
  id: number;
  userId: string;
  landlordId: number;
  reference: string;
  title: string;
  propertyType: string;
  address: string;
  city: string;
  neighborhood: string;
  surfaceArea: number;
  roomsCount: number;
  monthlyRent: string;
  chargesAmount: string;
  currency: string;
  latitude: number;
  longitude: number;
  postgisWkt: string;
  status: 'occupied' | 'vacant' | 'maintenance';
  createdAt: string;
}

export interface Tenant {
  id: number;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneWhatsapp: string;
  nationalIdNumber: string;
  profession: string | null;
  employer: string | null;
  monthlyIncome: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  dossierStatus: string;
  createdAt: string;
}

export interface Lease {
  id: number;
  userId: string;
  contractNumber: string;
  landlordId: number;
  propertyId: number;
  tenantId: number;
  startDate: string;
  endDate: string | null;
  rentAmount: string;
  chargesAmount: string;
  securityDeposit: string;
  paymentDueDay: number;
  customClauses: string | null;
  status: string;
  shareToken: string;
  createdAt: string;
}

export interface Payment {
  id: number;
  userId: string;
  receiptNumber: string;
  leaseId: number;
  landlordId: number;
  propertyId: number;
  tenantId: number;
  periodMonth: string;
  periodLabel: string;
  amountDue: string;
  amountPaid: string;
  dueDate: string;
  paymentDate: string | null;
  paymentMethod: string | null;
  status: 'paid' | 'overdue' | 'partial' | 'pending';
  daysLate: number;
  whatsappSent: boolean;
  shareToken: string;
  createdAt: string;
}

export interface WhatsappShareResponse {
  success: boolean;
  receiptNumber?: string;
  contractNumber?: string;
  tenantName?: string;
  phoneWhatsapp?: string;
  pdfUrl: string;
  whatsappShareUrl: string;
  cloudApiStatus?: string;
  cloudApiPayload?: Record<string, unknown>;
}

export interface AccountingMonth {
  periodMonth: string; // Format 'YYYY-MM' ex: '2026-11'
  periodLabel: string; // ex: 'Novembre 2026'
  defaultDueDay: number; // ex: 5
  status: 'open' | 'closed';
  isCurrent: boolean;
  createdAt: string;
}

export interface PropertyTypeItem {
  id: string;
  name: string; // ex: 'Appartement', 'Villa', 'Immeuble R+2'
  code: string; // ex: 'APPT', 'VILLA', 'BUR'
  category: 'habitation' | 'commercial' | 'professionnel' | 'terrain' | 'autre';
  defaultCharges: string; // ex: '45000'
  description: string;
  createdAt: string;
}

export interface ManagementCompanyProfile {
  companyName: string; // Raison sociale ex: 'GIMMO GESTION IMMOBILIÈRE SARL'
  tradeName: string; // Enseigne commerciale ex: 'GIMMO CÔTE D’IVOIRE'
  legalForm: string; // Forme juridique & Capital ex: 'SARL au capital de 10 000 000 FCFA'
  rccm: string; // N° RCCM ex: 'CI-ABJ-03-2026-B12-00458'
  taxId: string; // N° Compte Contribuable / DGI ex: 'CC N° 2604589-W'
  licenseNumber: string; // Carte Pro / Agrément ex: 'Agrément MCLU N° 0148/DGUF'
  managerName: string; // Nom du dirigeant / gérant
  managerTitle: string; // Fonction ex: 'Directeur Général'
  address: string; // Adresse géographique & Boîte postale
  city: string; // Ville ex: 'Abidjan'
  phone: string; // Téléphone & WhatsApp officiel
  email: string; // Email officiel de l'agence
  website: string; // Site web
  bankInfo: string; // Coordonnées bancaires / IBAN de la société de gestion
  headerSlogan: string; // Mention d'en-tête sur les documents PDF
  updatedAt: string;
}

export interface SaaSTenantAgency {
  id: string;
  companyName: string; // Clé unique (insensible à la casse)
  tradeName: string;
  legalForm: string;
  rccm: string;
  taxId: string;
  licenseNumber: string;
  managerName: string;
  ownerEmail: string;
  phone: string;
  whatsappPhone?: string;
  address: string;
  city: string;
  plan: 'starter' | 'pro' | 'enterprise';
  monthlyFeeFcfa: number;
  status: 'active' | 'pending_approval' | 'trial' | 'past_due' | 'suspended';
  maxProperties: number;
  maxLandlords: number;
  subscriptionEndsAt: string;
  isCurrentTenant: boolean;
  createdAt: string;
}

export interface SaaSUserAccount {
  id: string;
  fullName: string;
  email: string;
  whatsappPhone?: string;
  role: 'super_admin' | 'agency_admin' | 'manager' | 'agent';
  tenantId: string;
  tenantName: string;
  status: 'active' | 'suspended';
  lastLoginAt?: string;
  createdAt: string;
}

export interface RolePermissionSpec {
  role: SaaSUserAccount['role'];
  label: string;
  canViewSaaSConsole: boolean;
  canApproveAgency: boolean;
  canManageSaaSTenants: boolean;
  canEditAgencyProfile: boolean;
  canManageAgencyUsers: boolean;
  canDeleteLandlord: boolean;
  canDeleteRecords: boolean;
  canAccessRecovery: boolean;
  canAccessSettings: boolean;
  restrictionsSummary: string[];
}

export const ROLE_PERMISSIONS: Record<SaaSUserAccount['role'], RolePermissionSpec> = {
  super_admin: {
    role: 'super_admin',
    label: 'Super Admin SaaS',
    canViewSaaSConsole: true,
    canApproveAgency: true,
    canManageSaaSTenants: true,
    canEditAgencyProfile: true,
    canManageAgencyUsers: true,
    canDeleteLandlord: true,
    canDeleteRecords: true,
    canAccessRecovery: true,
    canAccessSettings: true,
    restrictionsSummary: [
      'Seul rôle autorisé à voir « Système SaaS Multi-Agences & Console Super Administrateur ».',
      'Seul rôle autorisé à approuver, suspendre ou supprimer une Agence Immobilière.',
      'Restriction : Compte de gouvernance SaaS protégé (ne peut être ni supprimé ni rétrogradé par une agence).',
    ],
  },
  agency_admin: {
    role: 'agency_admin',
    label: 'Directeur d’Agence',
    canViewSaaSConsole: false,
    canApproveAgency: false,
    canManageSaaSTenants: false,
    canEditAgencyProfile: true,
    canManageAgencyUsers: true,
    canDeleteLandlord: true,
    canDeleteRecords: true,
    canAccessRecovery: true,
    canAccessSettings: true,
    restrictionsSummary: [
      'Rôle attribué par défaut lors de la création d’une agence immobilière.',
      'Restriction 1 : N’a pas le droit de voir « Système SaaS Multi-Agences & Console Super Administrateur » ni d’approuver une agence (réservé à l’Administrateur).',
      'Restriction 2 : N’a pas le droit de modifier ou supprimer les autres agences du réseau SaaS.',
    ],
  },
  manager: {
    role: 'manager',
    label: 'Gestionnaire Locatif',
    canViewSaaSConsole: false,
    canApproveAgency: false,
    canManageSaaSTenants: false,
    canEditAgencyProfile: false,
    canManageAgencyUsers: false,
    canDeleteLandlord: false,
    canDeleteRecords: true,
    canAccessRecovery: true,
    canAccessSettings: true,
    restrictionsSummary: [
      'Restriction 1 : N’a pas le droit de voir « Système SaaS Multi-Agences & Console Super Administrateur » ni d’approuver une agence.',
      'Restriction 2 : N’a pas le droit de supprimer un bailleur mandant.',
      'Restriction 3 : N’a pas le droit de modifier l’identification légale de l’agence ni de gérer les comptes utilisateurs.',
    ],
  },
  agent: {
    role: 'agent',
    label: 'Agent Immobilier',
    canViewSaaSConsole: false,
    canApproveAgency: false,
    canManageSaaSTenants: false,
    canEditAgencyProfile: false,
    canManageAgencyUsers: false,
    canDeleteLandlord: false,
    canDeleteRecords: false,
    canAccessRecovery: false,
    canAccessSettings: false,
    restrictionsSummary: [
      'Restriction 1 : N’a pas accès aux rubriques « Recouvrement », « Paramétrage » ni à la console Super Administrateur.',
      'Restriction 2 : N’a pas le droit de supprimer des biens, des baux, des quittances ou des bailleurs.',
      'Restriction 3 : N’a pas le droit d’approuver une agence immobilière.',
    ],
  },
};

export type UserRole = 'administrateur' | 'gerant' | 'commercial';

export interface AppUser {
  id: number;
  uid: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}


