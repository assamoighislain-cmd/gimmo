import React, { useState } from 'react';
import { AccountingMonth, Lease, Payment } from '../types/gimmo.ts';
import { formatPeriodMonthToLabelFr } from '../lib/document-templates.ts';
import {
  CalendarPlus,
  CheckCircle2,
  Lock,
  Unlock,
  Play,
  X,
  Star,
  Trash2,
} from 'lucide-react';

interface AccountingMonthsPanelProps {
  accountingMonths: AccountingMonth[];
  leases: Lease[];
  payments: Payment[];
  onUpsertAccountingMonth: (payload: {
    periodMonth: string;
    periodLabel: string;
    defaultDueDay: number;
    status: 'open' | 'closed';
    isCurrent: boolean;
    autoGenerateRentCalls: boolean;
    initialStatus?: 'pending' | 'paid';
    description: string;
  }) => Promise<void>;
  onDeleteAccountingMonth?: (
    periodMonth: string,
    periodLabel: string
  ) => Promise<void>;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const AccountingMonthsPanel: React.FC<AccountingMonthsPanelProps> = ({
  accountingMonths,
  leases,
  payments,
  onUpsertAccountingMonth,
  onDeleteAccountingMonth,
  isModal = false,
  onCloseModal,
}) => {
  // Détermine par défaut le mois suivant le dernier mois comptable créé
  const getNextSuggestedMonth = () => {
    const latest = accountingMonths[0]?.periodMonth || '2026-12';
    const [yStr, mStr] = latest.split('-');
    let year = Number(yStr) || 2026;
    let month = (Number(mStr) || 12) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  const [periodMonth, setPeriodMonth] = useState<string>(() =>
    getNextSuggestedMonth()
  );
  const [periodLabel, setPeriodLabel] = useState<string>(() =>
    formatPeriodMonthToLabelFr(getNextSuggestedMonth())
  );
  const [defaultDueDay, setDefaultDueDay] = useState<number>(5);
  const [isCurrent, setIsCurrent] = useState<boolean>(true);
  const [autoGenerateRentCalls, setAutoGenerateRentCalls] =
    useState<boolean>(true);
  const [initialStatus, setInitialStatus] = useState<'pending' | 'paid'>(
    'pending'
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState<string | null>(
    null
  );

  const activeLeasesCount = leases.filter((l) => l.status === 'active').length;

  const handleMonthInputChange = (val: string) => {
    setPeriodMonth(val);
    setPeriodLabel(formatPeriodMonthToLabelFr(val));
  };

  const handleCreateMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodMonth || !periodLabel) return;
    setSubmitting(true);
    setFeedbackMessage(null);
    try {
      await onUpsertAccountingMonth({
        periodMonth,
        periodLabel,
        defaultDueDay: Number(defaultDueDay || 5),
        status: 'open',
        isCurrent,
        autoGenerateRentCalls,
        initialStatus,
        description: `Création du mois comptable ${periodLabel} (${periodMonth})`,
      });
      setFeedbackMessage(
        `Mois comptable « ${periodLabel} » créé avec succès${
          autoGenerateRentCalls
            ? ` et appels de loyer générés pour les ${activeLeasesCount} baux actifs.`
            : '.'
        }`
      );
      // Prépare le mois suivant
      const [yStr, mStr] = periodMonth.split('-');
      let year = Number(yStr) || 2027;
      let month = (Number(mStr) || 1) + 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const nextM = `${year}-${String(month).padStart(2, '0')}`;
      setPeriodMonth(nextM);
      setPeriodLabel(formatPeriodMonthToLabelFr(nextM));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetCurrentMonth = async (m: AccountingMonth) => {
    setSubmitting(true);
    try {
      await onUpsertAccountingMonth({
        periodMonth: m.periodMonth,
        periodLabel: m.periodLabel,
        defaultDueDay: m.defaultDueDay,
        status: m.status,
        isCurrent: true,
        autoGenerateRentCalls: false,
        description: `Activation du mois comptable ${m.periodLabel}`,
      });
      setFeedbackMessage(
        `Le mois comptable actif est désormais « ${m.periodLabel} ».`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMonthStatus = async (m: AccountingMonth) => {
    const nextStatus = m.status === 'open' ? 'closed' : 'open';
    setSubmitting(true);
    try {
      await onUpsertAccountingMonth({
        periodMonth: m.periodMonth,
        periodLabel: m.periodLabel,
        defaultDueDay: m.defaultDueDay,
        status: nextStatus,
        isCurrent: m.isCurrent,
        autoGenerateRentCalls: false,
        description: `${
          nextStatus === 'closed' ? 'Clôture' : 'Réouverture'
        } du mois comptable ${m.periodLabel}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateCallsForExistingMonth = async (m: AccountingMonth) => {
    setSubmitting(true);
    try {
      await onUpsertAccountingMonth({
        periodMonth: m.periodMonth,
        periodLabel: m.periodLabel,
        defaultDueDay: m.defaultDueDay,
        status: m.status,
        isCurrent: m.isCurrent,
        autoGenerateRentCalls: true,
        initialStatus: 'pending',
        description: `Génération des appels de loyer pour ${m.periodLabel}`,
      });
      setFeedbackMessage(
        `Appels de loyer générés pour tous les baux actifs sur « ${m.periodLabel} ».`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Formulaire de création d'un nouveau Mois Comptable */}
      <form
        onSubmit={handleCreateMonth}
        className="p-4 sm:p-5 bg-indigo-50/60 border-2 border-indigo-200 rounded-2xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-indigo-950 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>Créer un Nouveau Mois Comptable</span>
            </h3>
            <p className="text-xs sm:text-sm font-medium text-slate-700 mt-0.5">
              Ouvrez une nouvelle période comptable mensuelle et générez automatiquement les appels de loyer pour les {activeLeasesCount} baux actifs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs sm:text-sm">
          <div>
            <label className="block font-extrabold text-indigo-950 mb-1">
              Mois & Année (YYYY-MM) :
            </label>
            <input
              type="month"
              required
              value={periodMonth}
              onChange={(e) => handleMonthInputChange(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 font-mono font-bold bg-white border-2 border-indigo-200 rounded-xl text-indigo-950 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-extrabold text-indigo-950 mb-1">
              Libellé du Mois Comptable :
            </label>
            <input
              type="text"
              required
              placeholder="ex: Janvier 2027"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 font-bold bg-white border-2 border-indigo-200 rounded-xl text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-extrabold text-indigo-950 mb-1">
              Jour d’échéance par défaut :
            </label>
            <input
              type="number"
              min={1}
              max={28}
              required
              value={defaultDueDay}
              onChange={(e) => setDefaultDueDay(Number(e.target.value))}
              className="w-full min-h-[42px] px-3 py-2 font-mono font-bold bg-white border-2 border-indigo-200 rounded-xl text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-extrabold text-indigo-950 mb-1">
              État initial des quittances :
            </label>
            <select
              value={initialStatus}
              onChange={(e) =>
                setInitialStatus(e.target.value as 'pending' | 'paid')
              }
              disabled={!autoGenerateRentCalls}
              className="w-full min-h-[42px] px-3 py-2 font-bold bg-white border-2 border-indigo-200 rounded-xl text-slate-900 disabled:opacity-50"
            >
              <option value="pending">En attente d’encaissement</option>
              <option value="paid">Soldées / Quittancées d’office</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-bold text-slate-800">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerateRentCalls}
                onChange={(e) => setAutoGenerateRentCalls(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Générer les appels de loyer pour les {activeLeasesCount} baux actifs
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCurrent}
                onChange={(e) => setIsCurrent(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Définir comme mois comptable en cours</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>
              {submitting
                ? 'Création en cours...'
                : 'Créer le Mois Comptable'}
            </span>
          </button>
        </div>

        {feedbackMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}
      </form>

      {/* Tableau des Mois Comptables existants */}
      <div className="border border-indigo-200/80 bg-white rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 sm:px-5 py-3.5 bg-indigo-950 text-white flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">
            Calendrier des Mois Comptables ({accountingMonths.length} périodes)
          </h4>
          <span className="text-xs text-indigo-200 font-mono">
            Synchronisé en temps réel
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-indigo-100 bg-indigo-50/50 text-indigo-950 font-extrabold text-xs">
                <th className="py-3 px-4">Code & Période</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Échéance</th>
                <th className="py-3 px-4 text-right">Quittances émises</th>
                <th className="py-3 px-4 text-right">Total Appelé / Encaissé</th>
                <th className="py-3 px-4 text-right">Actions Comptables</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {accountingMonths.map((m) => {
                const monthPayments = payments.filter(
                  (p) => p.periodMonth === m.periodMonth
                );
                const totalDue = monthPayments.reduce(
                  (s, p) => s + Number(p.amountDue || 0),
                  0
                );
                const totalPaid = monthPayments.reduce(
                  (s, p) => s + Number(p.amountPaid || 0),
                  0
                );

                return (
                  <tr
                    key={m.periodMonth}
                    className={`transition-colors ${
                      m.isCurrent
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                        : 'hover:bg-indigo-50/30'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-indigo-700">
                          {m.periodMonth}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          — {m.periodLabel}
                        </span>
                        {m.isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-extrabold bg-emerald-600 text-white rounded-md">
                            <Star className="w-3 h-3" />
                            Mois Actif
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {m.status === 'open' ? (
                        <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 text-xs">
                          <Unlock className="w-3.5 h-3.5" />
                          Ouvert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-slate-500 text-xs">
                          <Lock className="w-3.5 h-3.5" />
                          Clôturé
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                      Le {m.defaultDueDay} du mois
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {monthPayments.length} / {activeLeasesCount} baux
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div className="font-extrabold text-indigo-950">
                        {totalDue.toLocaleString('fr-FR')} FCFA
                      </div>
                      <div className="text-xs font-bold text-emerald-700">
                        Encaissé : {totalPaid.toLocaleString('fr-FR')} FCFA
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {!m.isCurrent && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSetCurrentMonth(m)}
                            className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 whitespace-nowrap"
                          >
                            Définir Actif
                          </button>
                        )}

                        {monthPayments.length < activeLeasesCount &&
                          m.status === 'open' && (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                handleGenerateCallsForExistingMonth(m)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 whitespace-nowrap"
                              title="Générer les quittances / appels de loyer manquants pour ce mois"
                            >
                              <Play className="w-3 h-3" />
                              Générer loyers
                            </button>
                          )}

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleToggleMonthStatus(m)}
                          className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                        >
                          {m.status === 'open' ? 'Clôturer' : 'Réouvrir'}
                        </button>

                        {onDeleteAccountingMonth &&
                          accountingMonths.length > 1 &&
                          (confirmDeleteMonth === m.periodMonth ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={async () => {
                                  setConfirmDeleteMonth(null);
                                  await onDeleteAccountingMonth(
                                    m.periodMonth,
                                    m.periodLabel
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-white bg-rose-600 rounded-lg hover:bg-rose-700 whitespace-nowrap"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Confirmer ?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteMonth(null)}
                                className="px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                setConfirmDeleteMonth(m.periodMonth)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 whitespace-nowrap"
                              title="Supprimer ce mois comptable"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Supprimer
                            </button>
                          ))}
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
  );

  if (!isModal) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-indigo-950/75 p-0 sm:p-4">
      <div className="bg-white border-2 border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-4xl w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-indigo-950 text-white border-b border-indigo-800 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-emerald-400" />
              <span>Paramétrage & Création des Mois Comptables</span>
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5">
              Créez vos périodes mensuelles et générez en un clic les appels de loyers pour tous vos baux actifs
            </p>
          </div>
          {onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-900"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{content}</div>

        {onCloseModal && (
          <div className="flex justify-end px-5 py-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onCloseModal}
              className="min-h-[42px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-800 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-100"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
