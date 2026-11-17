import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  Save,
  RotateCcw,
  Building2,
  Phone,
  Mail,
  Percent,
  Landmark,
  FileText,
  MapPin,
  KeyRound,
  MessageCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import type { Landlord, Property } from '../types/gimmo.ts';
import {
  generateLandlordPortalPassword,
  deriveDefaultLandlordUsername,
  buildLandlordPortalWhatsAppDetails,
  parseJsonResponseSafely,
  type LandlordPortalWhatsAppPayload,
} from '../lib/landlord-portal.ts';

interface LandlordsPanelProps {
  landlords: Landlord[];
  properties: Property[];
  agencyName?: string;
  onRefresh?: () => Promise<void>;
  onSaveLandlord: (
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
  ) => Promise<void>;
  onDeleteLandlord: (landlordId: number) => Promise<void>;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const LandlordsPanel: React.FC<LandlordsPanelProps> = ({
  landlords,
  properties,
  agencyName = 'Gimmo Gestion Locative',
  onRefresh,
  onSaveLandlord,
  onDeleteLandlord,
  isModal = false,
  onCloseModal,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+225 07 00 00 00 00');
  const [address, setAddress] = useState('Cocody Ambassades, Abidjan');
  const [taxId, setTaxId] = useState('CI-ABJ-2026-B-9900');
  const [iban, setIban] = useState('CI93 CI00 8011 1200 0000 0000 00');
  const [commissionRate, setCommissionRate] = useState<number>(8);
  const [contractHeaderNote, setContractHeaderNote] = useState(
    'Contrat de bail soumis aux dispositions légales en vigueur avec révision triennale.'
  );

  // Accès Portail Bailleur
  const [portalUsername, setPortalUsername] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [portalPassword, setPortalPassword] = useState(() =>
    generateLandlordPortalPassword()
  );
  const [portalEnabled, setPortalEnabled] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<
    Record<number, boolean>
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [readyWhatsappInvite, setReadyWhatsappInvite] =
    useState<LandlordPortalWhatsAppPayload | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setCompanyName('');
    setEmail('');
    setPhone('+225 07 00 00 00 00');
    setAddress('Cocody Ambassades, Abidjan');
    setTaxId('CI-ABJ-2026-B-9900');
    setIban('CI93 CI00 8011 1200 0000 0000 00');
    setCommissionRate(8);
    setContractHeaderNote(
      'Contrat de bail soumis aux dispositions légales en vigueur avec révision triennale.'
    );
    setPortalUsername('');
    setUsernameManuallyEdited(false);
    setPortalPassword(generateLandlordPortalPassword());
    setPortalEnabled(true);
    setErrorMsg(null);
  };

  const handleStartEdit = (landlord: Landlord) => {
    setEditingId(landlord.id);
    setFullName(landlord.fullName || '');
    setCompanyName(landlord.companyName || '');
    setEmail(landlord.email || '');
    setPhone(landlord.phone || '');
    setAddress(landlord.address || '');
    setTaxId(landlord.taxId || '');
    setIban(landlord.iban || '');
    setCommissionRate(landlord.commissionRate ?? 8);
    setContractHeaderNote(landlord.contractHeaderNote || '');
    setPortalUsername(
      landlord.portalUsername ||
        deriveDefaultLandlordUsername({
          email: landlord.email,
          phone: landlord.phone,
          fullName: landlord.fullName,
        })
    );
    setUsernameManuallyEdited(Boolean(landlord.portalUsername));
    setPortalPassword(
      landlord.portalPassword || generateLandlordPortalPassword()
    );
    setPortalEnabled(landlord.portalEnabled !== false);
    setErrorMsg(null);
    setFeedback(null);
  };

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);
    if (!usernameManuallyEdited) {
      setPortalUsername(nextEmail.trim().toLowerCase());
    }
  };

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleRegenerateCredentials = async (landlord: Landlord) => {
    setRegeneratingId(landlord.id);
    setErrorMsg(null);

    const nextUsername =
      (landlord.portalUsername || '').trim() ||
      deriveDefaultLandlordUsername({
        email: landlord.email,
        phone: landlord.phone,
        fullName: landlord.fullName,
      });
    const nextPassword = generateLandlordPortalPassword();

    try {
      let handledByPortalEndpoint = false;

      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const res = await fetch(
            `/api/landlords/${landlord.id}/portal-credentials`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                portalUsername: nextUsername,
                portalPassword: nextPassword,
                portalEnabled: true,
              }),
            }
          );
          const parsed = await parseJsonResponseSafely<any>(res);

          if (res.ok && parsed.isJson && parsed.data?.whatsapp) {
            setVisiblePasswordIds((prev) => ({ ...prev, [landlord.id]: true }));
            setReadyWhatsappInvite(parsed.data.whatsapp);
            await onRefresh?.();
            handledByPortalEndpoint = true;
          }
        } catch {
          // Repli automatique sur la mise à jour standard ci-dessous
        }
      }

      if (!handledByPortalEndpoint) {
        await onSaveLandlord(landlord.id, {
          fullName: landlord.fullName || '',
          companyName: landlord.companyName || '',
          email: landlord.email || '',
          phone: landlord.phone || '',
          address: landlord.address || '',
          taxId: landlord.taxId || '',
          iban: landlord.iban || '',
          commissionRate: Number(landlord.commissionRate ?? 8),
          contractHeaderNote: landlord.contractHeaderNote || '',
          portalUsername: nextUsername,
          portalPassword: nextPassword,
          portalEnabled: true,
        });

        const updatedPreview: Landlord = {
          ...landlord,
          portalUsername: nextUsername,
          portalPassword: nextPassword,
          portalEnabled: true,
        };
        const waInvite = buildLandlordPortalWhatsAppDetails({
          landlord: updatedPreview,
          agencyName,
          overrideUsername: nextUsername,
          overridePassword: nextPassword,
        });

        setVisiblePasswordIds((prev) => ({ ...prev, [landlord.id]: true }));
        setReadyWhatsappInvite(waInvite);
      }

      setFeedback(
        `Mot de passe Portail généré (${nextPassword}) pour "${landlord.companyName || landlord.fullName}". Cliquez sur le bouton vert WhatsApp pour lui envoyer ses accès.`
      );
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Erreur lors de la génération des identifiants Portail.'
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Veuillez saisir le nom complet du bailleur.');
      return;
    }

    const finalUsername =
      portalUsername.trim() ||
      deriveDefaultLandlordUsername({
        email,
        phone,
        fullName,
      });
    const finalPassword =
      portalPassword.trim() || generateLandlordPortalPassword();

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const isEdit = editingId !== null;
      const displayLabel = companyName.trim() || fullName.trim();
      await onSaveLandlord(editingId, {
        fullName: fullName.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        taxId: taxId.trim(),
        iban: iban.trim(),
        commissionRate: Number(commissionRate),
        contractHeaderNote: contractHeaderNote.trim(),
        portalUsername: finalUsername,
        portalPassword: finalPassword,
        portalEnabled,
      });

      const previewLandlord: Landlord = {
        id: editingId || Date.now(),
        userId: 'agency',
        fullName: fullName.trim(),
        companyName: companyName.trim() || null,
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        taxId: taxId.trim() || null,
        iban: iban.trim() || null,
        commissionRate: Number(commissionRate),
        contractHeaderNote: contractHeaderNote.trim() || null,
        portalUsername: finalUsername,
        portalPassword: finalPassword,
        portalEnabled,
        createdAt: new Date().toISOString(),
      };

      const waDetails = buildLandlordPortalWhatsAppDetails({
        landlord: previewLandlord,
        agencyName,
      });
      setReadyWhatsappInvite(waDetails);

      setFeedback(
        isEdit
          ? `Bailleur "${displayLabel}" mis à jour. Ses accès Portail Bailleur sont prêts à être envoyés sur WhatsApp.`
          : `Bailleur "${displayLabel}" créé avec son compte Portail Bailleur. Envoyez-lui ses identifiants par WhatsApp ci-dessous.`
      );
      resetForm();
    } catch (err) {
      console.error('Failed to save landlord:', err);
      setErrorMsg("Erreur lors de l'enregistrement du bailleur.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="bg-indigo-950 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <Users className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Bailleurs Mandants & Accès Portail Propriétaire ({landlords.length})
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5">
              Créez les comptes bailleurs, générez leurs mots de passe et envoyez leurs accès Portail directement sur WhatsApp.
            </p>
          </div>
        </div>

        {isModal && onCloseModal && (
          <button
            type="button"
            onClick={onCloseModal}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Carte d'envoi WhatsApp immédiat des accès Portail Bailleur */}
        {readyWhatsappInvite && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-emerald-950">
                  Accès Portail Bailleur prêts pour{' '}
                  {readyWhatsappInvite.landlordDisplayName}
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 font-mono">
                  Compte : <strong>{readyWhatsappInvite.portalUsername}</strong> ·
                  Mot de passe :{' '}
                  <strong>{readyWhatsappInvite.portalPassword}</strong> ·
                  WhatsApp :{' '}
                  <strong>{readyWhatsappInvite.whatsappPhoneDisplay}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReadyWhatsappInvite(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-white border border-emerald-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-line max-h-40 overflow-y-auto">
              {readyWhatsappInvite.messageText}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() =>
                  handleCopyText(
                    'invite_msg',
                    readyWhatsappInvite.messageText
                  )
                }
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                {copiedId === 'invite_msg' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Message copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier les accès</span>
                  </>
                )}
              </button>

              {readyWhatsappInvite.whatsappUrl && (
                <a
                  href={readyWhatsappInvite.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    Envoyer Compte & Mot de passe sur WhatsApp (
                    {readyWhatsappInvite.whatsappPhoneDisplay})
                  </span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Formulaire de Création / Modification d'un Bailleur + Compte Portail */}
        <form
          onSubmit={handleSubmit}
          className={`p-4 sm:p-5 rounded-xl border transition-all ${
            editingId !== null
              ? 'bg-amber-50/60 border-amber-300'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {editingId !== null ? (
                <>
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>Modification du Bailleur #{editingId}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-indigo-700" />
                  <span>Nouveau Bailleur & Création de son Accès Portail</span>
                </>
              )}
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Annuler l’édition
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-600 hover:text-rose-900 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {feedback && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nom complet du propriétaire *
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Yao Kouadio"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                SCI / Société (Optionnel)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: SCI Horizon Ivoire"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email du bailleur *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="proprietaire@domaine.ci"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-800 mb-1">
                Numéro WhatsApp *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 08 09 10 11"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-400 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Honoraires de gestion (%) *
              </label>
              <div className="relative">
                <Percent className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  required
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                N° Fiscal / RCCM
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                IBAN / Compte de reversement
              </label>
              <div className="relative">
                <Landmark className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Adresse *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Paramètres du Compte Portail Bailleur */}
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
            <div>
              <label className="block text-xs font-bold text-indigo-950 mb-1">
                Identifiant Portail Bailleur
              </label>
              <input
                type="text"
                value={portalUsername}
                onChange={(e) => {
                  setPortalUsername(e.target.value);
                  setUsernameManuallyEdited(true);
                }}
                placeholder="Par défaut : email du bailleur"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-indigo-950 mb-1">
                Mot de passe Portail Bailleur *
              </label>
              <div className="flex items-stretch gap-1.5">
                <div className="relative flex-1">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPortalPassword(generateLandlordPortalPassword())
                  }
                  className="px-2.5 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                  title="Générer un nouveau mot de passe"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Générer</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 pb-0.5">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={portalEnabled}
                  onChange={(e) => setPortalEnabled(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Accès Portail actif</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                  editingId !== null
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-950 hover:bg-indigo-900'
                }`}
              >
                {editingId !== null ? (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Sauvegarde...' : 'Enregistrer'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {submitting ? 'Création...' : 'Créer & Préparer WhatsApp'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Tableau des Bailleurs + Envoi WhatsApp des Identifiants */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-semibold">
                  <th className="py-3 px-4">Bailleur / Société</th>
                  <th className="py-3 px-4">Contact WhatsApp</th>
                  <th className="py-3 px-4">Compte & Mot de passe Portail</th>
                  <th className="py-3 px-4 text-center">Patrimoine</th>
                  <th className="py-3 px-4 text-right">
                    Envoi WhatsApp & Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {landlords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-slate-500 font-medium"
                    >
                      Aucun bailleur enregistré. Créez un bailleur ci-dessus pour générer ses accès Portail et les envoyer par WhatsApp.
                    </td>
                  </tr>
                ) : (
                  landlords.map((l) => {
                    const propCount = properties.filter(
                      (p) => p.landlordId === l.id
                    ).length;
                    const isBeingEdited = editingId === l.id;
                    const isPassVisible = Boolean(visiblePasswordIds[l.id]);
                    const hasPassword = Boolean(
                      l.portalPassword && l.portalPassword.trim()
                    );
                    const waInfo = buildLandlordPortalWhatsAppDetails({
                      landlord: l,
                      agencyName,
                    });

                    return (
                      <tr
                        key={l.id}
                        className={`transition-colors ${
                          isBeingEdited
                            ? 'bg-amber-50/70'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-bold text-slate-900 text-sm">
                            {l.companyName || l.fullName}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            {l.companyName ? `Représentant : ${l.fullName} · ` : ''}
                            Honoraires{' '}
                            <span className="font-mono font-semibold text-slate-700">
                              {l.commissionRate}%
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="font-mono font-semibold text-slate-900">
                            {waInfo.whatsappPhoneDisplay || l.phone}
                          </div>
                          <div className="text-slate-500">{l.email}</div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="font-mono text-slate-800">
                            <span className="text-slate-500">Compte : </span>
                            <strong>{waInfo.portalUsername}</strong>
                          </div>
                          {hasPassword ? (
                            <div className="flex items-center gap-1.5 mt-1 font-mono">
                              <span className="text-slate-500">MDP :</span>
                              <strong className="text-indigo-950">
                                {isPassVisible
                                  ? l.portalPassword
                                  : '••••••••••'}
                              </strong>
                              <button
                                type="button"
                                onClick={() =>
                                  setVisiblePasswordIds((prev) => ({
                                    ...prev,
                                    [l.id]: !prev[l.id],
                                  }))
                                }
                                className="p-1 text-slate-500 hover:text-slate-900 rounded"
                                title={
                                  isPassVisible
                                    ? 'Masquer le mot de passe'
                                    : 'Afficher le mot de passe'
                                }
                              >
                                {isPassVisible ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(
                                    `cred_${l.id}`,
                                    `Portail : ${waInfo.portalUrl}\nCompte : ${waInfo.portalUsername}\nMot de passe : ${l.portalPassword}`
                                  )
                                }
                                className="p-1 text-slate-500 hover:text-indigo-700 rounded"
                                title="Copier le compte et le mot de passe"
                              >
                                {copiedId === `cred_${l.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={regeneratingId === l.id}
                              onClick={() => handleRegenerateCredentials(l)}
                              className="mt-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md inline-flex items-center gap-1"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Activer & Générer MDP</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top text-center font-mono tabular-nums font-semibold text-slate-800">
                          {propCount} bien{propCount > 1 ? 's' : ''}
                        </td>

                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                            {hasPassword && waInfo.whatsappUrl ? (
                              <a
                                href={waInfo.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
                                title="Envoyer le compte et le mot de passe au bailleur sur WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Envoyer Accès WhatsApp</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled={regeneratingId === l.id}
                                onClick={() => handleRegenerateCredentials(l)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Générer & WhatsApp</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={regeneratingId === l.id}
                              onClick={() => handleRegenerateCredentials(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
                              title="Générer un nouveau mot de passe Portail"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  regeneratingId === l.id ? 'animate-spin' : ''
                                }`}
                              />
                              <span>Nouveau MDP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Modifier</span>
                            </button>

                            {confirmDeleteId === l.id ? (
                              <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-lg px-2 py-1">
                                <button
                                  type="button"
                                  disabled={deletingId === l.id}
                                  onClick={async () => {
                                    setDeletingId(l.id);
                                    try {
                                      await onDeleteLandlord(l.id);
                                      if (editingId === l.id) {
                                        resetForm();
                                      }
                                    } finally {
                                      setDeletingId(null);
                                      setConfirmDeleteId(null);
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                                >
                                  {deletingId === l.id ? '...' : 'Confirmer'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded bg-white text-slate-700 text-xs font-semibold border border-slate-200 cursor-pointer"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(l.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Supprimer ce bailleur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-6xl my-auto max-h-[92dvh] overflow-y-auto rounded-2xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
