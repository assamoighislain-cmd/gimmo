import React, { useState, useEffect, useMemo } from 'react';
import {
  Landlord,
  Property,
  Tenant,
  Lease,
  Payment,
} from '../types/gimmo.ts';
import {
  DocumentTemplatesStore,
  LeaseTemplateConfig,
  ReceiptTemplateConfig,
  DEFAULT_LEASE_TEMPLATE,
  DEFAULT_RECEIPT_TEMPLATE,
  LEASE_PRESETS,
  RECEIPT_PRESETS,
  TEMPLATE_VARIABLES_HELP,
  resolveLeaseTemplate,
  resolveReceiptTemplate,
  resolveManagementCompany,
  interpolateTemplateVariables,
} from '../lib/document-templates.ts';
import {
  X,
  FileText,
  CheckCircle2,
  RotateCcw,
  Eye,
  Sliders,
  Printer,
  Copy,
  Check,
} from 'lucide-react';

interface DocumentTemplateModalProps {
  initialKind: 'lease' | 'receipt';
  initialLandlordId: number | 'all';
  templatesStore: DocumentTemplatesStore;
  landlords: Landlord[];
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  payments: Payment[];
  onSaveTemplate: (payload: {
    scopeKey: string;
    kind: 'lease' | 'receipt';
    config: LeaseTemplateConfig | ReceiptTemplateConfig;
    description: string;
  }) => Promise<void>;
  onClose: () => void;
}

const ACCENT_COLOR_OPTIONS = [
  { hex: '#1E1B4B', label: 'Indigo Royal' },
  { hex: '#0F172A', label: 'Ardoise Officiel' },
  { hex: '#065F46', label: 'Émeraude Patrimoine' },
  { hex: '#7C2D12', label: 'Terre Cuite & Or' },
];

export const DocumentTemplateModal: React.FC<DocumentTemplateModalProps> = ({
  initialKind,
  initialLandlordId,
  templatesStore,
  landlords,
  properties,
  tenants,
  leases,
  payments,
  onSaveTemplate,
  onClose,
}) => {
  const [activeKind, setActiveKind] = useState<'lease' | 'receipt'>(
    initialKind
  );
  const [scopeKey, setScopeKey] = useState<string>(
    initialLandlordId !== 'all' ? `landlord_${initialLandlordId}` : 'default'
  );
  const [mobileViewTab, setMobileViewTab] = useState<'editor' | 'preview'>(
    'editor'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [focusedLeaseField, setFocusedLeaseField] =
    useState<keyof LeaseTemplateConfig>('article1Body');
  const [focusedReceiptField, setFocusedReceiptField] =
    useState<keyof ReceiptTemplateConfig>('attestationBody');

  const selectedLandlordNum = scopeKey.startsWith('landlord_')
    ? Number(scopeKey.replace('landlord_', ''))
    : null;

  const [leaseForm, setLeaseForm] = useState<LeaseTemplateConfig>(() =>
    resolveLeaseTemplate(templatesStore, selectedLandlordNum)
  );

  const [receiptForm, setReceiptForm] = useState<ReceiptTemplateConfig>(() =>
    resolveReceiptTemplate(templatesStore, selectedLandlordNum)
  );

  // Recharge la configuration dès qu'on change de périmètre (Global vs Bailleur spécifique)
  useEffect(() => {
    const lId = scopeKey.startsWith('landlord_')
      ? Number(scopeKey.replace('landlord_', ''))
      : null;
    setLeaseForm(resolveLeaseTemplate(templatesStore, lId));
    setReceiptForm(resolveReceiptTemplate(templatesStore, lId));
  }, [scopeKey, templatesStore]);

  // Données d'exemple réelles issues du portefeuille pour l'aperçu en direct
  const sampleBundle = useMemo(() => {
    const landlord =
      (selectedLandlordNum &&
        landlords.find((l) => l.id === selectedLandlordNum)) ||
      landlords[0];
    const lease =
      leases.find((l) => (landlord ? l.landlordId === landlord.id : true)) ||
      leases[0];
    const property =
      properties.find((p) => p.id === lease?.propertyId) || properties[0];
    const tenant =
      tenants.find((t) => t.id === lease?.tenantId) || tenants[0];
    const payment =
      payments.find((p) => (lease ? p.leaseId === lease.id : true)) ||
      payments[0];

    const currency = property?.currency || 'FCFA';
    const rentVal = Number(lease?.rentAmount || property?.monthlyRent || 650000);
    const chargesVal = Number(
      lease?.chargesAmount || property?.chargesAmount || 45000
    );
    const totalMensuel = rentVal + chargesVal;
    const totalDueVal = Number(payment?.amountDue || totalMensuel);
    const paidVal = Number(payment?.amountPaid || totalDueVal);
    const balanceVal = Math.max(0, totalDueVal - paidVal);

    const company = resolveManagementCompany(templatesStore);

    const vars: Record<string, string> = {
      nom_societe_gestion: company.companyName,
      enseigne_societe_gestion: company.tradeName || company.companyName,
      forme_juridique_societe_gestion: company.legalForm,
      rccm_societe_gestion: company.rccm,
      id_fiscal_societe_gestion: company.taxId,
      agrement_societe_gestion: company.licenseNumber,
      gerant_societe_gestion: `${company.managerName} (${company.managerTitle})`,
      adresse_societe_gestion: `${company.address}, ${company.city}`,
      telephone_societe_gestion: company.phone,
      email_societe_gestion: company.email,
      nom_bailleur: landlord?.companyName
        ? `${landlord.companyName} (représentée par ${landlord.fullName})`
        : landlord?.fullName || 'SCI Lagune Patrimoine',
      id_fiscal_bailleur: landlord?.taxId || 'CI-ABJ-2021-B-14920',
      adresse_bailleur:
        landlord?.address || 'Boulevard Latrille, Cocody Deux-Plateaux, Abidjan',
      telephone_bailleur: landlord?.phone || '+2250707112233',
      email_bailleur: landlord?.email || 'contact@gimmo.ci',
      note_bailleur:
        landlord?.contractHeaderNote ||
        'Le Preneur s’engage à jouir des lieux en bon père de famille et à souscrire une police d’assurance multirisque.',
      nom_locataire: tenant
        ? `${tenant.firstName} ${tenant.lastName}`
        : 'Awa Touré',
      cni_locataire: tenant?.nationalIdNumber || 'CI0049281742',
      whatsapp_locataire: tenant?.phoneWhatsapp || '+2250708123456',
      email_locataire: tenant?.email || 'locataire@email.ci',
      profession_locataire: tenant?.profession || 'Directrice Financière',
      employeur_locataire: tenant?.employer || 'Banque Atlantique CI',
      titre_bien: property?.title || 'Résidence Les Orchidées - Appt A4',
      reference_bien: property?.reference || 'GIM-COC-001',
      type_bien: property?.propertyType || 'Appartement',
      adresse_bien: property?.address || 'Rue des Jardins, Vallon',
      quartier_bien: property?.neighborhood || 'Cocody Deux-Plateaux',
      ville_bien: property?.city || 'Abidjan',
      surface_bien: String(property?.surfaceArea || 145),
      pieces_bien: String(property?.roomsCount || 4),
      numero_contrat: lease?.contractNumber || 'BAIL-2026-0101',
      loyer_mensuel: `${rentVal.toLocaleString('fr-FR')} ${currency}`,
      charges: `${chargesVal.toLocaleString('fr-FR')} ${currency}`,
      total_mensuel: `${totalMensuel.toLocaleString('fr-FR')} ${currency}`,
      caution: `${Number(lease?.securityDeposit || rentVal * 2).toLocaleString('fr-FR')} ${currency}`,
      date_debut: lease?.startDate || '2026-01-01',
      date_fin: lease?.endDate || '2027-12-31',
      jour_echeance: String(lease?.paymentDueDay || 5),
      clauses_contrat:
        lease?.customClauses ||
        'Accès piscine et parking souterrain inclus dans les charges locatives.',
      numero_quittance: payment?.receiptNumber || 'QUIT-202611-001',
      periode: payment?.periodLabel || 'Novembre 2026',
      montant_appele: `${totalDueVal.toLocaleString('fr-FR')} ${currency}`,
      montant_paye: `${paidVal.toLocaleString('fr-FR')} ${currency}`,
      reste_a_payer: `${balanceVal.toLocaleString('fr-FR')} ${currency}`,
      mode_paiement: payment?.paymentMethod || 'Virement',
      date_paiement: payment?.paymentDate || '2026-11-03',
      jeton_partage:
        activeKind === 'lease'
          ? lease?.shareToken || 'tok-lease-demo'
          : payment?.shareToken || 'tok-quit-demo',
    };

    return { company, landlord, lease, property, tenant, payment, vars };
  }, [
    templatesStore,
    selectedLandlordNum,
    landlords,
    leases,
    properties,
    tenants,
    payments,
    activeKind,
  ]);

  const handleInsertVariable = (token: string) => {
    setCopiedVar(token);
    setTimeout(() => setCopiedVar(null), 1600);

    if (activeKind === 'lease') {
      const currentVal = String(leaseForm[focusedLeaseField] || '');
      setLeaseForm((prev) => ({
        ...prev,
        presetId: 'custom',
        [focusedLeaseField]: `${currentVal}${currentVal.endsWith(' ') || currentVal.length === 0 ? '' : ' '}${token}`,
      }));
    } else {
      const currentVal = String(receiptForm[focusedReceiptField] || '');
      setReceiptForm((prev) => ({
        ...prev,
        presetId: 'custom',
        [focusedReceiptField]: `${currentVal}${currentVal.endsWith(' ') || currentVal.length === 0 ? '' : ' '}${token}`,
      }));
    }
  };

  const handleResetToDefault = () => {
    if (activeKind === 'lease') {
      setLeaseForm({ ...DEFAULT_LEASE_TEMPLATE });
    } else {
      setReceiptForm({ ...DEFAULT_RECEIPT_TEMPLATE });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const scopeLabel =
        scopeKey === 'default'
          ? 'Modèle Global'
          : sampleBundle.landlord?.companyName ||
            sampleBundle.landlord?.fullName ||
            scopeKey;

      await onSaveTemplate({
        scopeKey,
        kind: activeKind,
        config: activeKind === 'lease' ? leaseForm : receiptForm,
        description: `Personnalisation du modèle de ${
          activeKind === 'lease' ? 'Contrat de Bail' : 'Quittance de Loyer'
        } (${scopeLabel})`,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredVariables = TEMPLATE_VARIABLES_HELP.filter(
    (v) => v.scope === 'both' || v.scope === activeKind
  );

  const testPdfUrl =
    activeKind === 'lease'
      ? sampleBundle.lease
        ? `/api/public/leases/${sampleBundle.lease.shareToken}/pdf`
        : null
      : sampleBundle.payment
        ? `/api/public/receipts/${sampleBundle.payment.shareToken}/pdf`
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-indigo-950/75 p-0 sm:p-4">
      <form
        onSubmit={handleSave}
        className="bg-white border-2 border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-6xl w-full max-h-[94dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* En-tête de l'atelier de personnalisation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 bg-indigo-950 text-white shrink-0 border-b border-indigo-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                <span>
                  Personnalisation des Modèles de Contrat de Bail & Quittance
                </span>
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                Adaptez les articles, clauses, attestations, variables dynamiques et couleurs des PDF officiels
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden min-h-[38px] min-w-[38px] flex items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bascule Contrat de Bail vs Quittance */}
            <div className="flex items-center bg-indigo-900/90 p-1 rounded-xl border border-indigo-700">
              <button
                type="button"
                onClick={() => setActiveKind('lease')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors ${
                  activeKind === 'lease'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-indigo-100 hover:text-white'
                }`}
              >
                Modèle Contrat de Bail
              </button>
              <button
                type="button"
                onClick={() => setActiveKind('receipt')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors ${
                  activeKind === 'receipt'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-indigo-100 hover:text-white'
                }`}
              >
                Modèle Quittance de Loyer
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex min-h-[38px] min-w-[38px] items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barre de sélection du Bailleur cible + Bascule Mobile Éditeur/Aperçu */}
        <div className="bg-indigo-50/70 border-b border-indigo-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="font-extrabold text-indigo-950">
              Appliquer ce modèle à :
            </span>
            <select
              value={scopeKey}
              onChange={(e) => setScopeKey(e.target.value)}
              className="px-3 py-1.5 text-xs sm:text-sm font-bold bg-white border-2 border-indigo-200 rounded-xl text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="default">
                Tous les Bailleurs (Modèle Global par défaut)
              </option>
              {landlords.map((l) => (
                <option key={l.id} value={`landlord_${l.id}`}>
                  Bailleur :{' '}
                  {l.companyName ? `${l.companyName} (${l.fullName})` : l.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Bascule Éditeur / Aperçu sur Smartphone */}
            <div className="flex lg:hidden items-center bg-white border border-indigo-200 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setMobileViewTab('editor')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                  mobileViewTab === 'editor'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700'
                }`}
              >
                Éditer
              </button>
              <button
                type="button"
                onClick={() => setMobileViewTab('preview')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg inline-flex items-center gap-1 ${
                  mobileViewTab === 'preview'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Aperçu
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
              title="Réinitialiser avec le texte standard d'origine"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>

        {/* Corps principal scrollable en 2 colonnes (Éditeur à gauche + Aperçu A4 en direct à droite) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-indigo-100">
          {/* COLONNE GAUCHE : Éditeur de Modèle + Variables */}
          <div
            className={`lg:col-span-7 p-4 sm:p-6 space-y-5 overflow-y-auto ${
              mobileViewTab === 'preview' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* 1. Préréglages rapides (Presets) */}
            <div>
              <label className="block text-xs sm:text-sm font-extrabold text-indigo-950 mb-2">
                1. Choisir un Modèle Type pré-configuré (modifiable librement) :
              </label>
              {activeKind === 'lease' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    Object.entries(LEASE_PRESETS) as [
                      keyof typeof LEASE_PRESETS,
                      (typeof LEASE_PRESETS)['habitation_standard'],
                    ][]
                  ).map(([key, preset]) => {
                    const isSelected = leaseForm.presetId === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLeaseForm({ ...preset.config })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/80 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="text-xs font-extrabold text-indigo-950">
                          {preset.label}
                        </div>
                        <div className="text-[11px] font-medium text-slate-600 mt-1 line-clamp-2">
                          {preset.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    Object.entries(RECEIPT_PRESETS) as [
                      keyof typeof RECEIPT_PRESETS,
                      (typeof RECEIPT_PRESETS)['quittance_classique'],
                    ][]
                  ).map(([key, preset]) => {
                    const isSelected = receiptForm.presetId === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setReceiptForm({ ...preset.config })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/80 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="text-xs font-extrabold text-indigo-950">
                          {preset.label}
                        </div>
                        <div className="text-[11px] font-medium text-slate-600 mt-1 line-clamp-2">
                          {preset.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Couleur d'accentuation PDF & Options d'affichage */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  Couleur officielle du PDF :
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_COLOR_OPTIONS.map((c) => {
                    const currentAccent =
                      activeKind === 'lease'
                        ? leaseForm.accentColor
                        : receiptForm.accentColor;
                    const active = currentAccent === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() =>
                          activeKind === 'lease'
                            ? setLeaseForm((p) => ({ ...p, accentColor: c.hex }))
                            : setReceiptForm((p) => ({
                                ...p,
                                accentColor: c.hex,
                              }))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${
                          active
                            ? 'border-indigo-600 bg-white text-slate-900 shadow-xs'
                            : 'border-transparent bg-white/60 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeKind === 'lease' && (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leaseForm.showPostgisCoords}
                    onChange={(e) =>
                      setLeaseForm((p) => ({
                        ...p,
                        showPostgisCoords: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Inclure les coordonnées GPS PostGIS à l’Article 2</span>
                </label>
              )}
            </div>

            {/* 3. Barre d'insertion des variables dynamiques en 1 clic */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-extrabold text-indigo-950">
                  Variables dynamiques (cliquez pour insérer dans le champ actif) :
                </span>
                {copiedVar && (
                  <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {copiedVar} inséré
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {filteredVariables.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => handleInsertVariable(v.token)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-bold text-indigo-900 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors"
                    title={`Insérer ${v.label} (${v.token})`}
                  >
                    <Copy className="w-2.5 h-2.5 opacity-70" />
                    <span>{v.token}</span>
                    <span className="font-sans font-normal opacity-75">
                      ({v.label})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Champs d'édition selon le type de document */}
            {activeKind === 'lease' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Titre principal du Contrat :
                    </label>
                    <input
                      type="text"
                      value={leaseForm.documentTitle}
                      onFocus={() => setFocusedLeaseField('documentTitle')}
                      onChange={(e) =>
                        setLeaseForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          documentTitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border-2 border-slate-300 rounded-xl text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Sous-titre / Référence d’en-tête :
                    </label>
                    <input
                      type="text"
                      value={leaseForm.documentSubtitle}
                      onFocus={() => setFocusedLeaseField('documentSubtitle')}
                      onChange={(e) =>
                        setLeaseForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          documentSubtitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-white border-2 border-slate-300 rounded-xl text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                {(
                  [
                    ['article1Title', 'article1Body', 'Article 1 (Parties)'],
                    ['article2Title', 'article2Body', 'Article 2 (Bien loué)'],
                    ['article3Title', 'article3Body', 'Article 3 (Durée)'],
                    [
                      'article4Title',
                      'article4Body',
                      'Article 4 (Loyer, Charges & Caution)',
                    ],
                    [
                      'article5Title',
                      'article5Body',
                      'Article 5 (Dispositions du Bailleur)',
                    ],
                    [
                      'article6Title',
                      'article6Body',
                      'Article 6 (Clauses complémentaires)',
                    ],
                  ] as [
                    keyof LeaseTemplateConfig,
                    keyof LeaseTemplateConfig,
                    string,
                  ][]
                ).map(([titleKey, bodyKey, sectionLabel]) => (
                  <div
                    key={titleKey}
                    className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2"
                  >
                    <div>
                      <label className="block text-xs font-extrabold text-indigo-950 mb-1">
                        Titre — {sectionLabel} :
                      </label>
                      <input
                        type="text"
                        value={String(leaseForm[titleKey] || '')}
                        onFocus={() => setFocusedLeaseField(titleKey)}
                        onChange={(e) =>
                          setLeaseForm((p) => ({
                            ...p,
                            presetId: 'custom',
                            [titleKey]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 text-xs sm:text-sm font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contenu de l’article :
                      </label>
                      <textarea
                        rows={3}
                        value={String(leaseForm[bodyKey] || '')}
                        onFocus={() => setFocusedLeaseField(bodyKey)}
                        onChange={(e) =>
                          setLeaseForm((p) => ({
                            ...p,
                            presetId: 'custom',
                            [bodyKey]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-indigo-600 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Entête Signature Bailleur :
                    </label>
                    <input
                      type="text"
                      value={leaseForm.landlordSignatureLabel}
                      onFocus={() =>
                        setFocusedLeaseField('landlordSignatureLabel')
                      }
                      onChange={(e) =>
                        setLeaseForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          landlordSignatureLabel: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Entête Signature Locataire :
                    </label>
                    <input
                      type="text"
                      value={leaseForm.tenantSignatureLabel}
                      onFocus={() =>
                        setFocusedLeaseField('tenantSignatureLabel')
                      }
                      onChange={(e) =>
                        setLeaseForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          tenantSignatureLabel: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ÉDITEUR DE MODÈLE DE QUITTANCE DE LOYER */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Marque / Nom Agence :
                    </label>
                    <input
                      type="text"
                      value={receiptForm.agencyBrandTitle}
                      onFocus={() =>
                        setFocusedReceiptField('agencyBrandTitle')
                      }
                      onChange={(e) =>
                        setReceiptForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          agencyBrandTitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border-2 border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Sous-titre Agence :
                    </label>
                    <input
                      type="text"
                      value={receiptForm.agencyBrandSubtitle}
                      onFocus={() =>
                        setFocusedReceiptField('agencyBrandSubtitle')
                      }
                      onChange={(e) =>
                        setReceiptForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          agencyBrandSubtitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white border-2 border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Titre de la Quittance :
                    </label>
                    <input
                      type="text"
                      value={receiptForm.documentTitle}
                      onFocus={() => setFocusedReceiptField('documentTitle')}
                      onChange={(e) =>
                        setReceiptForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          documentTitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border-2 border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Libellé ligne Loyer (Tableau financier) :
                    </label>
                    <input
                      type="text"
                      value={receiptForm.rentRowLabel}
                      onFocus={() => setFocusedReceiptField('rentRowLabel')}
                      onChange={(e) =>
                        setReceiptForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          rentRowLabel: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Libellé ligne Charges locatives :
                    </label>
                    <input
                      type="text"
                      value={receiptForm.chargesRowLabel}
                      onFocus={() => setFocusedReceiptField('chargesRowLabel')}
                      onChange={(e) =>
                        setReceiptForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          chargesRowLabel: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-indigo-950 mb-1">
                    Texte d’attestation légale de Quittance (avec variables dynamiques) :
                  </label>
                  <textarea
                    rows={5}
                    value={receiptForm.attestationBody}
                    onFocus={() => setFocusedReceiptField('attestationBody')}
                    onChange={(e) =>
                      setReceiptForm((p) => ({
                        ...p,
                        presetId: 'custom',
                        attestationBody: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-medium bg-white border-2 border-slate-300 rounded-xl text-slate-900 focus:border-indigo-600 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Mention Signature & Cachet :
                    </label>
                    <input
                      type="text"
                      value={receiptForm.signatureLabel}
                      onFocus={() => setFocusedReceiptField('signatureLabel')}
                      onChange={(e) =>
                        setReceiptForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          signatureLabel: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Note de pied de page :
                    </label>
                    <input
                      type="text"
                      value={receiptForm.footerNote}
                      onFocus={() => setFocusedReceiptField('footerNote')}
                      onChange={(e) =>
                        setReceiptForm((p) => ({
                          ...p,
                          presetId: 'custom',
                          footerNote: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COLONNE DROITE : Aperçu A4 en Temps Réel */}
          <div
            className={`lg:col-span-5 bg-slate-100 p-4 sm:p-6 overflow-y-auto ${
              mobileViewTab === 'editor' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-600" />
                Aperçu en Direct (Simulation A4)
              </span>
              {testPdfUrl && (
                <a
                  href={testPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Ouvrir PDF Réel
                </a>
              )}
            </div>

            {/* Feuille A4 simulée */}
            <div className="bg-white border border-slate-300 rounded-xl shadow-md p-5 sm:p-6 text-slate-900 space-y-4 text-xs leading-relaxed">
              {activeKind === 'lease' ? (
                <>
                  {/* En-tête épuré de l'Agence Immobilière (2 lignes) */}
                  <div className="pb-2.5 border-b border-slate-200 text-[10px] leading-snug">
                    <div
                      className="font-extrabold uppercase tracking-tight text-xs"
                      style={{ color: leaseForm.accentColor }}
                    >
                      {sampleBundle.company.companyName}
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      RCCM : {sampleBundle.company.rccm} · ID Fiscal :{' '}
                      {sampleBundle.company.taxId} · {sampleBundle.company.address},{' '}
                      {sampleBundle.company.city} · Tél : {sampleBundle.company.phone}
                    </div>
                  </div>

                  <div
                    className="text-center pb-3 border-b-2"
                    style={{ borderColor: leaseForm.accentColor }}
                  >
                    <div
                      className="text-sm sm:text-base font-extrabold tracking-tight"
                      style={{ color: leaseForm.accentColor }}
                    >
                      {interpolateTemplateVariables(
                        leaseForm.documentTitle,
                        sampleBundle.vars
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                      {interpolateTemplateVariables(
                        leaseForm.documentSubtitle,
                        sampleBundle.vars
                      )}
                    </div>
                  </div>

                  {[
                    [leaseForm.article1Title, leaseForm.article1Body],
                    [leaseForm.article2Title, leaseForm.article2Body],
                    [leaseForm.article3Title, leaseForm.article3Body],
                    [leaseForm.article4Title, leaseForm.article4Body],
                    [leaseForm.article5Title, leaseForm.article5Body],
                    [leaseForm.article6Title, leaseForm.article6Body],
                  ].map(([t, b], idx) => (
                    <div key={idx} className="space-y-1">
                      <div
                        className="font-extrabold text-xs"
                        style={{ color: leaseForm.accentColor }}
                      >
                        {interpolateTemplateVariables(t, sampleBundle.vars)}
                      </div>
                      <div className="text-[11px] text-slate-800 whitespace-pre-line">
                        {interpolateTemplateVariables(b, sampleBundle.vars)}
                      </div>
                      {idx === 1 && leaseForm.showPostgisCoords && (
                        <div className="text-[10px] font-mono text-slate-500">
                          Coordonnées GPS PostGIS :{' '}
                          {sampleBundle.property?.postgisWkt}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-[11px]">
                    <div>
                      <div
                        className="font-extrabold"
                        style={{ color: leaseForm.accentColor }}
                      >
                        {interpolateTemplateVariables(
                          leaseForm.landlordSignatureLabel,
                          sampleBundle.vars
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {leaseForm.signatureSubtext}
                      </div>
                    </div>
                    <div>
                      <div
                        className="font-extrabold"
                        style={{ color: leaseForm.accentColor }}
                      >
                        {interpolateTemplateVariables(
                          leaseForm.tenantSignatureLabel,
                          sampleBundle.vars
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {leaseForm.signatureSubtext}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* APERÇU QUITTANCE DE LOYER — En-tête unique épuré (Agence à gauche | Titre & Réf à droite) */
                <>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <div
                        className="text-sm font-extrabold uppercase tracking-tight"
                        style={{ color: receiptForm.accentColor }}
                      >
                        {sampleBundle.company.companyName}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        RCCM : {sampleBundle.company.rccm} · ID Fiscal :{' '}
                        {sampleBundle.company.taxId}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {sampleBundle.company.address}, {sampleBundle.company.city} · Tél :{' '}
                        {sampleBundle.company.phone}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-xs font-extrabold"
                        style={{ color: receiptForm.accentColor }}
                      >
                        {interpolateTemplateVariables(
                          receiptForm.documentTitle,
                          sampleBundle.vars
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                        Réf : {sampleBundle.vars.numero_quittance}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Période : {sampleBundle.vars.periode}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div
                        className="font-extrabold"
                        style={{ color: receiptForm.accentColor }}
                      >
                        BAILLEUR / MANDANT
                      </div>
                      <div className="font-semibold text-slate-800">
                        {sampleBundle.vars.nom_bailleur}
                      </div>
                      <div className="text-slate-600">
                        {sampleBundle.vars.adresse_bailleur}
                      </div>
                    </div>
                    <div>
                      <div
                        className="font-extrabold"
                        style={{ color: receiptForm.accentColor }}
                      >
                        LOCATAIRE / PRENEUR
                      </div>
                      <div className="font-semibold text-slate-800">
                        {sampleBundle.vars.nom_locataire}
                      </div>
                      <div className="text-slate-600">
                        Contrat : {sampleBundle.vars.numero_contrat}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                    <div
                      className="font-extrabold"
                      style={{ color: receiptForm.accentColor }}
                    >
                      BIEN LOUÉ : {sampleBundle.vars.titre_bien} (
                      {sampleBundle.vars.reference_bien})
                    </div>
                    <div className="text-slate-600">
                      {sampleBundle.vars.adresse_bien},{' '}
                      {sampleBundle.vars.quartier_bien},{' '}
                      {sampleBundle.vars.ville_bien}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden text-[11px]">
                    <div
                      className="px-3 py-1.5 text-white font-bold flex justify-between"
                      style={{ backgroundColor: receiptForm.accentColor }}
                    >
                      <span>DÉSIGNATION DES SOMMES</span>
                      <span>MONTANT</span>
                    </div>
                    <div className="p-2.5 space-y-1.5 divide-y divide-slate-100">
                      <div className="flex justify-between pt-1">
                        <span>
                          {interpolateTemplateVariables(
                            receiptForm.rentRowLabel,
                            sampleBundle.vars
                          )}
                        </span>
                        <span className="font-mono font-semibold">
                          {sampleBundle.vars.loyer_mensuel}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1.5">
                        <span>
                          {interpolateTemplateVariables(
                            receiptForm.chargesRowLabel,
                            sampleBundle.vars
                          )}
                        </span>
                        <span className="font-mono font-semibold">
                          {sampleBundle.vars.charges}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1.5 font-extrabold text-emerald-700">
                        <span>MONTANT RÉGLÉ PAR LE LOCATAIRE</span>
                        <span className="font-mono">
                          {sampleBundle.vars.montant_paye}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-800 whitespace-pre-line bg-indigo-50/40 p-3 rounded-lg border border-indigo-100">
                    {interpolateTemplateVariables(
                      receiptForm.attestationBody,
                      sampleBundle.vars
                    )}
                  </div>

                  <div className="text-right text-[11px] pt-2">
                    <div
                      className="font-extrabold"
                      style={{ color: receiptForm.accentColor }}
                    >
                      Fait à {sampleBundle.vars.ville_bien}, le{' '}
                      {new Date().toISOString().split('T')[0]}
                    </div>
                    <div className="text-slate-600 font-semibold">
                      {interpolateTemplateVariables(
                        receiptForm.signatureLabel,
                        sampleBundle.vars
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pied de modale sticky (Toujours visible sur Android / Smartphone) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-indigo-50/80 border-t-2 border-indigo-100 shrink-0">
          <div className="text-xs font-bold text-slate-700">
            {saveSuccess ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-extrabold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Modèle enregistré ! Tous les PDF générés utilisent désormais cette configuration.
              </span>
            ) : (
              <span>
                Les modifications s’appliquent immédiatement aux exports PDF, impressions et envois WhatsApp.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Enregistrement...'
                  : activeKind === 'lease'
                    ? 'Enregistrer le Modèle de Contrat'
                    : 'Enregistrer le Modèle de Quittance'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
