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
} from 'lucide-react';
import type { Landlord, Property } from '../types/gimmo.ts';

interface LandlordsPanelProps {
  landlords: Landlord[];
  properties: Property[];
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
    }
  ) => Promise<void>;
  onDeleteLandlord: (landlordId: number) => Promise<void>;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const LandlordsPanel: React.FC<LandlordsPanelProps> = ({
  landlords,
  properties,
  onSaveLandlord,
  onDeleteLandlord,
  isModal = false,
  onCloseModal,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+2250700000000');
  const [address, setAddress] = useState('Cocody Ambassades, Abidjan');
  const [taxId, setTaxId] = useState('CI-ABJ-2026-B-9900');
  const [iban, setIban] = useState('CI93 CI00 8011 1200 0000 0000 00');
  const [commissionRate, setCommissionRate] = useState<number>(8);
  const [contractHeaderNote, setContractHeaderNote] = useState(
    'Contrat de bail soumis aux dispositions légales en vigueur avec révision triennale.'
  );

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setCompanyName('');
    setEmail('');
    setPhone('+2250700000000');
    setAddress('Cocody Ambassades, Abidjan');
    setTaxId('CI-ABJ-2026-B-9900');
    setIban('CI93 CI00 8011 1200 0000 0000 00');
    setCommissionRate(8);
    setContractHeaderNote(
      'Contrat de bail soumis aux dispositions légales en vigueur avec révision triennale.'
    );
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
    setErrorMsg(null);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Veuillez saisir le nom complet du bailleur.');
      return;
    }

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
      });
      setFeedback(
        isEdit
          ? `Bailleur "${displayLabel}" modifié avec succès !`
          : `Nouveau bailleur "${displayLabel}" créé avec succès !`
      );
      resetForm();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to save landlord:', err);
      setErrorMsg("Erreur lors de l'enregistrement du bailleur.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-md overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-800 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-inner">
            <Users className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black tracking-tight">
                Gestion des Bailleurs (Propriétaires Mandants)
              </h3>
              <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-white/20 text-white rounded-md border border-white/30">
                {landlords.length} bailleur{landlords.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-100 font-medium mt-0.5">
              Ajoutez, modifiez ou supprimez vos propriétaires mandants, leurs taux d&apos;honoraires et leurs coordonnées bancaires.
            </p>
          </div>
        </div>

        {isModal && onCloseModal && (
          <button
            type="button"
            onClick={onCloseModal}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Formulaire de Création / Modification d'un Bailleur */}
        <form
          onSubmit={handleSubmit}
          className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
            editingId !== null
              ? 'bg-amber-50/70 border-amber-400 shadow-sm'
              : 'bg-slate-50 border-indigo-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              {editingId !== null ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-black uppercase tracking-wider shadow-sm">
                  <Edit3 className="w-3.5 h-3.5" />
                  Mode Modification du Bailleur #{editingId}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter un Nouveau Bailleur
                </span>
              )}
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-black transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Quitter la modification
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs sm:text-sm font-bold flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-600 hover:text-rose-900 font-black ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {feedback && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-800 text-xs sm:text-sm font-black flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Nom complet */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Nom complet du représentant *
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Yao Kouadio"
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* SCI / Société */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                SCI / Société (Optionnel)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: SCI Horizon Ivoire"
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@sci-ivoire.ci"
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Téléphone *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2250700000000"
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Honoraires % */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Honoraires de gestion (%) *
              </label>
              <div className="relative">
                <Percent className="w-4 h-4 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  required
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-mono font-black text-indigo-950 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Identifiant Fiscal / RCCM */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                N° Fiscal / RCCM
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* IBAN */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                IBAN / Compte Bancaire
              </label>
              <div className="relative">
                <Landmark className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Adresse du siège / domicile *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-black transition-colors cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                editingId !== null
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'
              }`}
            >
              {editingId !== null ? (
                <>
                  <Save className="w-4 h-4" />
                  {submitting ? 'Modification...' : 'Enregistrer les modifications'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Création...' : 'Ajouter ce Bailleur'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Liste des Bailleurs avec boutons Modifier & Supprimer */}
        <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4">Bailleur / Société Civile</th>
                  <th className="py-3.5 px-4">Contact & Adresse</th>
                  <th className="py-3.5 px-4">N° Fiscal & IBAN</th>
                  <th className="py-3.5 px-4 text-center">Commission</th>
                  <th className="py-3.5 px-4 text-center">Biens gérés</th>
                  <th className="py-3.5 px-4 text-right">Actions (Modifier / Supprimer)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {landlords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">
                      Aucun bailleur enregistré. Utilisez le formulaire ci-dessus pour en créer un.
                    </td>
                  </tr>
                ) : (
                  landlords.map((l) => {
                    const propCount = properties.filter(
                      (p) => p.landlordId === l.id
                    ).length;
                    const isBeingEdited = editingId === l.id;

                    return (
                      <tr
                        key={l.id}
                        className={`transition-colors ${
                          isBeingEdited
                            ? 'bg-amber-50/90'
                            : 'hover:bg-indigo-50/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-black text-indigo-950 text-sm sm:text-base flex items-center gap-2">
                            <span>{l.companyName || l.fullName}</span>
                            {isBeingEdited && (
                              <span className="px-2 py-0.5 text-[11px] font-black uppercase bg-amber-200 text-amber-900 rounded-md">
                                En cours d&apos;édition
                              </span>
                            )}
                          </div>
                          {l.companyName && (
                            <div className="text-xs font-bold text-slate-600 mt-0.5">
                              Représentant : {l.fullName}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top text-xs">
                          <div className="font-mono font-bold text-indigo-700">
                            {l.phone}
                          </div>
                          <div className="text-slate-700 font-medium">{l.email}</div>
                          <div className="text-slate-500 mt-0.5">{l.address}</div>
                        </td>

                        <td className="py-3.5 px-4 align-top text-xs font-mono">
                          <div className="font-bold text-slate-800">
                            {l.taxId || '—'}
                          </div>
                          <div className="text-slate-500 truncate max-w-[180px]">
                            {l.iban || '—'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-300 font-mono text-xs font-black">
                            {l.commissionRate}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black">
                            {propCount} lot{propCount > 1 ? 's' : ''}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(l)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isBeingEdited
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Modifier
                            </button>

                            {confirmDeleteId === l.id ? (
                              <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-xl px-2 py-1">
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
                                  className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
                                >
                                  {deletingId === l.id ? '...' : 'Confirmer ?'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(l.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black transition-colors cursor-pointer"
                                title="Supprimer ce bailleur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Supprimer
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
