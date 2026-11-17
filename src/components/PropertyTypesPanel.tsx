import React, { useState } from 'react';
import {
  Building,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  Save,
  RotateCcw,
  Tag,
  Layers,
  Coins,
  FileText,
} from 'lucide-react';
import type { Property, PropertyTypeItem } from '../types/gimmo.ts';

interface PropertyTypesPanelProps {
  propertyTypes: PropertyTypeItem[];
  properties: Property[];
  onUpsertPropertyType: (payload: {
    id?: string;
    name: string;
    code: string;
    category: PropertyTypeItem['category'];
    defaultCharges: string;
    description: string;
    previousName?: string;
    descriptionLog: string;
  }) => Promise<void>;
  onDeletePropertyType?: (id: string, name: string) => Promise<void>;
  isModal?: boolean;
  onCloseModal?: () => void;
}

const CATEGORY_COLORS: Record<PropertyTypeItem['category'], string> = {
  habitation: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  commercial: 'bg-amber-100 text-amber-800 border-amber-300',
  professionnel: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  terrain: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  autre: 'bg-cyan-100 text-cyan-800 border-cyan-300',
};

const CATEGORY_LABELS: Record<PropertyTypeItem['category'], string> = {
  habitation: 'Habitation / Résidentiel',
  commercial: 'Commercial / Boutique',
  professionnel: 'Professionnel / Bureau',
  terrain: 'Terrain / Foncier',
  autre: 'Mixte / Autre',
};

export const PropertyTypesPanel: React.FC<PropertyTypesPanelProps> = ({
  propertyTypes,
  properties,
  onUpsertPropertyType,
  onDeletePropertyType,
  isModal = false,
  onCloseModal,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previousName, setPreviousName] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [category, setCategory] = useState<PropertyTypeItem['category']>('habitation');
  const [defaultCharges, setDefaultCharges] = useState<string>('15000');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setPreviousName('');
    setName('');
    setCode('');
    setCategory('habitation');
    setDefaultCharges('15000');
    setDescription('');
    setErrorMsg(null);
  };

  const handleStartEdit = (pt: PropertyTypeItem) => {
    setEditingId(pt.id);
    setPreviousName(pt.name);
    setName(pt.name);
    setCode(pt.code);
    setCategory(pt.category);
    setDefaultCharges(pt.defaultCharges || '0');
    setDescription(pt.description || '');
    setErrorMsg(null);
    setFeedback(null);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!editingId && (!code || code === name.slice(0, 3).toUpperCase())) {
      const autoCode = value
        .trim()
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase();
      setCode(autoCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Veuillez saisir le libellé du type de bien (ex: Duplex, Entrepôt, Magasin).');
      return;
    }

    const duplicate = propertyTypes.find(
      (pt) => pt.name.toLowerCase() === trimmedName.toLowerCase() && pt.id !== editingId
    );
    if (duplicate) {
      setErrorMsg(`Le type de bien "${trimmedName}" existe déjà dans votre catalogue.`);
      return;
    }

    const finalCode =
      code.trim().toUpperCase() ||
      trimmedName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() ||
      'BIEN';

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const isEdit = Boolean(editingId);
      await onUpsertPropertyType({
        id: editingId || undefined,
        name: trimmedName,
        code: finalCode,
        category,
        defaultCharges: defaultCharges.trim() || '0',
        description:
          description.trim() || `${trimmedName} (${CATEGORY_LABELS[category]})`,
        previousName: isEdit ? previousName : undefined,
        descriptionLog: isEdit
          ? `Modification du type de bien "${previousName}" → "${trimmedName}" (${finalCode})`
          : `Création du type de bien "${trimmedName}" (${finalCode})`,
      });
      setFeedback(
        isEdit
          ? `Type de bien "${trimmedName}" modifié avec succès !`
          : `Nouveau type de bien "${trimmedName}" créé avec succès !`
      );
      resetForm();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to save property type:', err);
      setErrorMsg("Erreur lors de l'enregistrement du type de bien.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-md overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-inner">
            <Building className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black tracking-tight">
                Gestion des Types de Biens Immobiliers
              </h3>
              <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-white/20 text-white rounded-md border border-white/30">
                {propertyTypes.length} types configurés
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-100 font-medium mt-0.5">
              Créez de nouveaux types de biens ou modifiez les catégories existantes utilisées dans le patrimoine GPS et les baux.
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
        {/* Form: Création ou Modification */}
        <form
          onSubmit={handleSubmit}
          className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
            editingId
              ? 'bg-amber-50/70 border-amber-400 shadow-sm'
              : 'bg-slate-50 border-indigo-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              {editingId ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-black uppercase tracking-wider shadow-sm">
                  <Edit3 className="w-3.5 h-3.5" />
                  Mode Modification : {previousName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Créer un Nouveau Type de Bien
                </span>
              )}
              {editingId && previousName !== name.trim() && name.trim() !== '' && (
                <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                  Les biens existants de type « {previousName} » seront automatiquement mis à jour en « {name.trim()} »
                </span>
              )}
            </div>

            {editingId && (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
            {/* Nom du type de bien */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Libellé du Type de Bien *
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Duplex, Entrepôt, Boutique..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Code Court */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Code Court
              </label>
              <input
                type="text"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: DUP"
                className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-black uppercase text-indigo-900 font-mono focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Catégorie */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Usage / Catégorie
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PropertyTypeItem['category'])}
                  className="w-full pl-9 pr-2 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value="habitation">Habitation / Résidentiel</option>
                  <option value="commercial">Commercial / Boutique</option>
                  <option value="professionnel">Professionnel / Bureau</option>
                  <option value="terrain">Terrain / Foncier</option>
                  <option value="autre">Mixte / Autre</option>
                </select>
              </div>
            </div>

            {/* Charges par défaut */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Charges Défaut (FCFA)
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={defaultCharges}
                  onChange={(e) => setDefaultCharges(e.target.value)}
                  placeholder="15000"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Description */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                Description / Caractéristiques
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Logement haut standing, commerce..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-black transition-colors cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                editingId
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700'
              }`}
            >
              {editingId ? (
                <>
                  <Save className="w-4 h-4" />
                  {submitting ? 'Modification...' : 'Enregistrer les modifications'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Création...' : 'Ajouter ce Type de Bien'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Tableau des Types de Biens */}
        <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4">Code & Type de Bien</th>
                  <th className="py-3.5 px-4">Catégorie</th>
                  <th className="py-3.5 px-4">Charges par défaut</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-center">Biens rattachés</th>
                  <th className="py-3.5 px-4 text-right">Actions (Modifier / Supprimer)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {propertyTypes.map((pt) => {
                  const linkedCount = properties.filter(
                    (p) => p.propertyType.toLowerCase() === pt.name.toLowerCase()
                  ).length;
                  const isBeingEdited = editingId === pt.id;

                  return (
                    <tr
                      key={pt.id}
                      className={`transition-colors ${
                        isBeingEdited
                          ? 'bg-amber-50/90'
                          : 'hover:bg-indigo-50/40'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-950 text-amber-300 font-mono text-xs font-black tracking-wider">
                            {pt.code}
                          </span>
                          <span className="font-black text-slate-900 text-sm sm:text-base">
                            {pt.name}
                          </span>
                          {isBeingEdited && (
                            <span className="px-2 py-0.5 text-[11px] font-black uppercase bg-amber-200 text-amber-900 rounded-md">
                              En cours d&apos;édition
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black border ${
                            CATEGORY_COLORS[pt.category] || CATEGORY_COLORS.habitation
                          }`}
                        >
                          {CATEGORY_LABELS[pt.category] || pt.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-slate-800">
                        {Number(pt.defaultCharges || 0).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium max-w-xs truncate">
                        {pt.description || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black ${
                            linkedCount > 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {linkedCount} bien{linkedCount > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(pt)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              isBeingEdited
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Modifier
                          </button>

                          {onDeletePropertyType && (
                            <>
                              {confirmDeleteId === pt.id ? (
                                <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-xl px-2 py-1">
                                  <button
                                    type="button"
                                    disabled={deletingId === pt.id}
                                    onClick={async () => {
                                      setDeletingId(pt.id);
                                      try {
                                        await onDeletePropertyType(pt.id, pt.name);
                                        if (editingId === pt.id) {
                                          resetForm();
                                        }
                                      } finally {
                                        setDeletingId(null);
                                        setConfirmDeleteId(null);
                                      }
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
                                  >
                                    {deletingId === pt.id ? '...' : 'Confirmer ?'}
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
                                  onClick={() => setConfirmDeleteId(pt.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black transition-colors cursor-pointer"
                                  title="Supprimer ce type de bien"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Supprimer
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        <div className="w-full max-w-5xl my-auto max-h-[92dvh] overflow-y-auto rounded-2xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
