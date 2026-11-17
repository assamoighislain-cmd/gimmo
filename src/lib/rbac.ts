import type { UserRole } from '../types/gimmo.ts';

export interface RoleDefinition {
  role: UserRole;
  label: string;
  shortLabel: string;
  badgeClass: string;
  headerBadgeClass: string;
  description: string;
  permissionsSummary: string[];
  permissions: {
    canManageUsers: boolean;
    canManageSettings: boolean;
    canCreateEditLandlord: boolean;
    canDeleteLandlord: boolean;
    canCreateEditProperty: boolean;
    canDeleteProperty: boolean;
    canCreateEditLease: boolean;
    canDeleteLease: boolean;
    canCreateEditPayment: boolean;
    canSettlePayment: boolean;
    canDeletePayment: boolean;
    canExportFinancialReports: boolean;
  };
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  administrateur: {
    role: 'administrateur',
    label: 'Administrateur',
    shortLabel: 'Admin',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    headerBadgeClass: 'bg-amber-400 text-slate-950 border-amber-300',
    description:
      'Accès intégral à toute la plateforme : gestion des utilisateurs et rôles, paramétrage système, bailleurs, patrimoine GPS, baux, quittances, recouvrement et suppressions.',
    permissionsSummary: [
      'Gestion complète des Bailleurs (Ajout, Modification, Suppression)',
      'Gestion complète des Biens GPS, Locataires, Baux & Quittances',
      'Encaissement des loyers, Relances WhatsApp & Rapports Financiers PDF',
      'Paramétrage global (Mois comptables, Types de biens, Modèles PDF, Comptes & Rôles)',
      'Autorisation de suppression sur tous les tableaux',
    ],
    permissions: {
      canManageUsers: true,
      canManageSettings: true,
      canCreateEditLandlord: true,
      canDeleteLandlord: true,
      canCreateEditProperty: true,
      canDeleteProperty: true,
      canCreateEditLease: true,
      canDeleteLease: true,
      canCreateEditPayment: true,
      canSettlePayment: true,
      canDeletePayment: true,
      canExportFinancialReports: true,
    },
  },
  gerant: {
    role: 'gerant',
    label: 'Gérant',
    shortLabel: 'Gérant',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    headerBadgeClass: 'bg-emerald-400 text-slate-950 border-emerald-300',
    description:
      'Responsable de la gestion locative, comptable et financière : gère les bailleurs, biens, baux, quittances, encaissements, mois comptables et recouvrement.',
    permissionsSummary: [
      'Création et modification des Bailleurs, Biens GPS, Locataires & Baux',
      'Émission, modification, encaissement et suppression des Quittances',
      'Ouverture des Mois Comptables & Génération automatique des appels de loyer',
      'Suivi du Recouvrement, Relances WhatsApp & Rapports Financiers PDF',
      'Protection : suppression de compte Bailleur et gestion des Administrateurs réservées à l’Administrateur',
    ],
    permissions: {
      canManageUsers: false,
      canManageSettings: true,
      canCreateEditLandlord: true,
      canDeleteLandlord: false,
      canCreateEditProperty: true,
      canDeleteProperty: true,
      canCreateEditLease: true,
      canDeleteLease: true,
      canCreateEditPayment: true,
      canSettlePayment: true,
      canDeletePayment: true,
      canExportFinancialReports: true,
    },
  },
  commercial: {
    role: 'commercial',
    label: 'Commercial',
    shortLabel: 'Commercial',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    headerBadgeClass: 'bg-cyan-400 text-slate-950 border-cyan-300',
    description:
      'Chargé du développement commercial, du terrain GPS et de la mise en location : ajout/mise à jour des biens immobiliers, constitution des dossiers locataires et contrats de bail.',
    permissionsSummary: [
      'Ajout et modification des Biens Immobiliers avec géolocalisation GPS PostGIS',
      'Création et modification des Dossiers Locataires & Contrats de Bail PDF',
      'Consultation des Quittances et partage WhatsApp des documents aux clients',
      'Protection : aucune suppression autorisée, pas de modification des Bailleurs ni du Paramétrage système',
    ],
    permissions: {
      canManageUsers: false,
      canManageSettings: false,
      canCreateEditLandlord: false,
      canDeleteLandlord: false,
      canCreateEditProperty: true,
      canDeleteProperty: false,
      canCreateEditLease: true,
      canDeleteLease: false,
      canCreateEditPayment: false,
      canSettlePayment: false,
      canDeletePayment: false,
      canExportFinancialReports: false,
    },
  },
};

export function normalizeUserRole(raw?: string | null): UserRole {
  if (!raw) return 'administrateur';
  const lower = raw.toLowerCase().trim();
  if (lower === 'gerant' || lower === 'gérant' || lower === 'manager') {
    return 'gerant';
  }
  if (lower === 'commercial' || lower === 'sales' || lower === 'agent') {
    return 'commercial';
  }
  return 'administrateur';
}
