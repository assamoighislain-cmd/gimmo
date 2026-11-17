import React, { useState, useEffect } from 'react';
import {
  Building2,
  Save,
  CheckCircle2,
  FileText,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Landmark,
  UserCheck,
  RotateCcw,
  Eye,
} from 'lucide-react';
import type { ManagementCompanyProfile } from '../types/gimmo';
import {
  type DocumentTemplatesStore,
  DEFAULT_MANAGEMENT_COMPANY,
  resolveManagementCompany,
} from '../lib/document-templates';
import { executeMutation } from '../lib/offline-manager';

interface AgencyProfilePanelProps {
  templatesStore?: DocumentTemplatesStore;
  onSuccess: () => void;
  onOpenSaaSAdmin?: () => void;
}

export const AgencyProfilePanel: React.FC<AgencyProfilePanelProps> = ({
  templatesStore,
  onSuccess,
  onOpenSaaSAdmin,
}) => {
  const currentProfile = resolveManagementCompany(templatesStore);

  const [formData, setFormData] = useState<ManagementCompanyProfile>(currentProfile);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setFormData(resolveManagementCompany(templatesStore));
  }, [templatesStore]);

  const handleChange = (field: keyof ManagementCompanyProfile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetDefault = () => {
    setFormData({ ...DEFAULT_MANAGEMENT_COMPANY });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formData.companyName.trim()) {
      setFeedback({
        type: 'error',
        message: 'La raison sociale de la société de gestion est obligatoire.',
      });
      return;
    }

    setSaving(true);
    try {
      const result = await executeMutation('/api/management-company', 'PUT', {
        ...formData,
        companyName: formData.companyName.trim(),
      });

      if (!result.ok) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde');
      }

      setFeedback({
        type: 'success',
        message: result.queuedOffline
          ? `Société "${formData.companyName}" enregistrée en mode hors-ligne (en-tête PDF mis à jour).`
          : `Identité de la société "${formData.companyName}" enregistrée. Elle apparaît désormais à l'en-tête de tous les documents PDF (Quittances, Contrats de Bail, Rapports Financiers, Guide).`,
      });
      onSuccess();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Impossible de sauvegarder la société de gestion',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-xs overflow-hidden">
      {/* En-tête de la section */}
      <div className="bg-indigo-950 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold tracking-tight">
                Identification de la Société de Gestion (En-tête Officiel des Documents)
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-sm">
                Mandataire des Bailleurs
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5">
              Renseignez les coordonnées légales et fiscales de la société qui gère les biens des bailleurs. Ces informations figurent automatiquement en haut de chaque Quittance, Contrat de Bail et Rapport PDF.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSaaSAdmin && (
            <button
              type="button"
              onClick={onOpenSaaSAdmin}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-indigo-950 rounded-sm text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Console Super Admin SaaS
            </button>
          )}
          <a
            href="/api/public/reports/financial/pdf?granularity=monthly&landlordId=all"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-700 rounded-sm text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-amber-300" />
            Tester l’en-tête PDF
          </a>
        </div>
      </div>

      {/* Aperçu visuel en direct du bandeau d'en-tête PDF épuré */}
      <div className="p-5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-700" />
            Aperçu de l’en-tête épuré en haut de vos documents PDF (Quittances, Baux, Rapports)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            En-tête compact sur 2 lignes
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-md shadow-xs px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-tight text-indigo-950">
              {formData.companyName || 'NOM DE L’AGENCE IMMOBILIÈRE'}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              RCCM : {formData.rccm} · ID Fiscal : {formData.taxId} · {formData.address},{' '}
              {formData.city} · Tél : {formData.phone}
            </p>
          </div>
          {formData.tradeName && (
            <span className="text-xs font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-sm">
              Enseigne : {formData.tradeName}
            </span>
          )}
        </div>
      </div>

      {/* Formulaire de saisie des informations de la société */}
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {feedback && (
          <div
            className={`p-3 rounded-sm border text-xs font-medium flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Raison Sociale Officielle (Société de Gestion) *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Ex: GIMMO PRESTIGE IMMOBILIER SARL"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600 font-semibold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom Commercial / Enseigne
            </label>
            <input
              type="text"
              value={formData.tradeName}
              onChange={(e) => handleChange('tradeName', e.target.value)}
              placeholder="Ex: GIMMO GESTION & PATRIMOINE"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Forme Juridique & Capital Social
            </label>
            <input
              type="text"
              value={formData.legalForm}
              onChange={(e) => handleChange('legalForm', e.target.value)}
              placeholder="Ex: SARL au capital de 10 000 000 FCFA"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              N° Registre du Commerce (RCCM) *
            </label>
            <input
              type="text"
              value={formData.rccm}
              onChange={(e) => handleChange('rccm', e.target.value)}
              placeholder="Ex: CI-ABJ-03-2024-B12-04892"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ID Fiscal / Compte Contribuable (DFE / CC) *
            </label>
            <input
              type="text"
              value={formData.taxId}
              onChange={(e) => handleChange('taxId', e.target.value)}
              placeholder="Ex: CC 2408915 M"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              N° Agrément Ministériel / Carte Professionnelle
            </label>
            <input
              type="text"
              value={formData.licenseNumber}
              onChange={(e) => handleChange('licenseNumber', e.target.value)}
              placeholder="Ex: Agrément MCLU N° 0184/MCLU/DGLCV/AG"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom du Dirigeant / Gérant Mandataire
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={formData.managerName}
                onChange={(e) => handleChange('managerName', e.target.value)}
                placeholder="Ex: M. Ghislain Assamoi"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Qualité / Fonction du Signataire
            </label>
            <input
              type="text"
              value={formData.managerTitle}
              onChange={(e) => handleChange('managerTitle', e.target.value)}
              placeholder="Ex: Directeur Général & Administrateur de Biens"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Téléphones Officiels (Agence & WhatsApp)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="Ex: +225 07 07 00 11 22"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Adresse Géographique du Siège Social *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Ex: Boulevard Latrille, Cocody Deux-Plateaux Vallons, Immeuble Prestige"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ville & Pays
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Ex: Abidjan — Côte d’Ivoire"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Officiel de la Société de Gestion
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Ex: contact@agence-immobiliere.ci"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Site Internet
            </label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="Ex: www.gimmo-prestige.ci"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              RIB / IBAN & Comptes Mobile Money Marchands
            </label>
            <div className="relative">
              <Landmark className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={formData.bankInfo}
                onChange={(e) => handleChange('bankInfo', e.target.value)}
                placeholder="Ex: SGBCI CI008 ... · Orange Money #144*821#"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefault}
            className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser les valeurs par défaut
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-indigo-950 hover:bg-indigo-900 text-white rounded-sm text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-400" />
            {saving
              ? 'Enregistrement en cours...'
              : 'Enregistrer la Société de Gestion (En-tête de tous les documents)'}
          </button>
        </div>
      </form>
    </div>
  );
};
