import React, { useState } from 'react';
import {
  Landlord,
  Property,
  Tenant,
  Payment,
} from '../types/gimmo.ts';
import {
  AlertTriangle,
  CheckCircle2,
  Send,
  Printer,
  Pencil,
  Download,
  Trash2,
} from 'lucide-react';

interface FinancialRecoveryViewProps {
  landlords: Landlord[];
  properties: Property[];
  tenants: Tenant[];
  payments: Payment[];
  selectedLandlordId: number | 'all';
  onSettlePayment: (paymentId: number, method: string) => Promise<void>;
  onEditLandlord: (landlord: Landlord) => void;
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: number) => Promise<void>;
  onDeleteLandlord: (landlordId: number) => Promise<void>;
}

export const FinancialRecoveryView: React.FC<FinancialRecoveryViewProps> = ({
  landlords,
  properties,
  tenants,
  payments,
  selectedLandlordId,
  onSettlePayment,
  onEditLandlord,
  onEditPayment,
  onDeletePayment,
  onDeleteLandlord,
}) => {
  const [reportGranularity, setReportGranularity] = useState<
    'daily' | 'monthly' | 'annual'
  >('monthly');
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<
    number | null
  >(null);
  const [confirmDeleteLandlordId, setConfirmDeleteLandlordId] = useState<
    number | null
  >(null);

  const landlordById: Record<number, Landlord> = {};
  for (const l of landlords) landlordById[l.id] = l;

  const propertyById: Record<number, Property> = {};
  for (const p of properties) propertyById[p.id] = p;

  const tenantById: Record<number, Tenant> = {};
  for (const t of tenants) tenantById[t.id] = t;

  const scopedPayments = payments.filter((p) =>
    selectedLandlordId === 'all' ? true : p.landlordId === selectedLandlordId
  );

  // 1. Liste automatique des locataires en situation d'impayé (retards)
  const overduePayments = scopedPayments.filter((p) => p.status === 'overdue');

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = '2026-11';
  const currentYearPrefix = '2026';

  // Filtrage selon la période choisie (Journalier / Mensuel / Annuel)
  const filterByGranularity = (p: Payment) => {
    if (reportGranularity === 'daily') {
      return p.paymentDate === '2026-11-09' || p.paymentDate === todayStr;
    }
    if (reportGranularity === 'monthly') {
      return p.periodMonth === currentMonthStr;
    }
    return p.periodMonth.startsWith(currentYearPrefix);
  };

  const periodPayments = scopedPayments.filter(filterByGranularity);

  // Calcul global sur la période
  const totalExpectedPeriod = periodPayments.reduce(
    (acc, p) => acc + Number(p.amountDue),
    0
  );
  const totalCollectedPeriod = periodPayments.reduce(
    (acc, p) => acc + Number(p.amountPaid),
    0
  );
  const totalArrears = overduePayments.reduce(
    (acc, p) => acc + (Number(p.amountDue) - Number(p.amountPaid)),
    0
  );

  // Agrégation par Bailleur
  const scopedLandlords = landlords.filter((l) =>
    selectedLandlordId === 'all' ? true : l.id === selectedLandlordId
  );

  const landlordReportRows = scopedLandlords.map((landlord) => {
    const lPayments = payments
      .filter((p) => p.landlordId === landlord.id)
      .filter(filterByGranularity);

    const expected = lPayments.reduce((s, p) => s + Number(p.amountDue), 0);
    const collected = lPayments.reduce((s, p) => s + Number(p.amountPaid), 0);
    const unpaid = Math.max(0, expected - collected);
    const agencyFee = (collected * landlord.commissionRate) / 100;
    const netLandlord = collected - agencyFee;
    const propertiesCount = properties.filter(
      (prop) => prop.landlordId === landlord.id
    ).length;

    return {
      landlord,
      propertiesCount,
      expected,
      collected,
      unpaid,
      agencyFee,
      netLandlord,
    };
  });

  const periodLabelDisplay =
    reportGranularity === 'daily'
      ? 'Point Journalier (09 Novembre 2026)'
      : reportGranularity === 'monthly'
        ? 'Point Mensuel (Novembre 2026)'
        : 'Exercice Annuel Consolidé (2026)';

  const reportPdfUrl = `/api/public/reports/financial/pdf?granularity=${reportGranularity}&landlordId=${selectedLandlordId}`;

  return (
    <div className="space-y-8">
      {/* En-tête & Sélecteur de période */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-indigo-100">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-indigo-950 leading-snug">
            Suivi Financier, Recouvrement des Impayés & Reddition par Bailleur
          </h2>
          <p className="text-xs sm:text-sm lg:text-base font-medium text-slate-700 mt-1">
            Détection automatique des retards de paiement et états d’encaissement multi-périodes (journalier, mensuel, annuel)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1 p-1 sm:p-1.5 bg-indigo-950/5 rounded-xl border border-indigo-200/80">
            <button
              type="button"
              onClick={() => setReportGranularity('daily')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                reportGranularity === 'daily'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-indigo-950'
              }`}
            >
              Journalier
            </button>
            <button
              type="button"
              onClick={() => setReportGranularity('monthly')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                reportGranularity === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-indigo-950'
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setReportGranularity('annual')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                reportGranularity === 'annual'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-indigo-950'
              }`}
            >
              Annuel
            </button>
          </div>

          <a
            href={reportPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            Imprimer le Rapport PDF
          </a>

          <a
            href={`${reportPdfUrl}&download=1`}
            className="min-h-[44px] inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Télécharger PDF
          </a>
        </div>
      </div>

      {/* Bandeau KPIs Financiers aux couleurs vives (Tabular Numerals) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-4 sm:p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
          <div className="text-xs sm:text-sm font-bold text-emerald-900">
            Total Encaissé · {periodLabelDisplay}
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono text-emerald-700 tabular-nums mt-1.5 sm:mt-2">
            {totalCollectedPeriod.toLocaleString('fr-FR')} FCFA
          </div>
          <div className="text-xs text-emerald-800 font-bold mt-1.5 font-mono tabular-nums">
            Sur {totalExpectedPeriod.toLocaleString('fr-FR')} FCFA appelés
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-rose-50/70 border border-rose-200 rounded-2xl">
          <div className="text-xs sm:text-sm font-bold text-rose-900">
            Reste à Recouvrer (Arriérés en cours)
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono text-rose-600 tabular-nums mt-1.5 sm:mt-2">
            {totalArrears.toLocaleString('fr-FR')} FCFA
          </div>
          <div className="text-xs text-rose-800 font-bold mt-1.5">
            {overduePayments.length} dossier(s) en dépassement d’échéance
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
          <div className="text-xs sm:text-sm font-bold text-indigo-900">
            Taux de Recouvrement sur la Période
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono text-indigo-700 tabular-nums mt-1.5 sm:mt-2">
            {totalExpectedPeriod > 0
              ? ((totalCollectedPeriod / totalExpectedPeriod) * 100).toFixed(1)
              : '100.0'}
            %
          </div>
          <div className="text-xs text-indigo-800 font-bold mt-1.5">
            Date limite contractuelle : le 5 du mois
          </div>
        </div>
      </div>

      {/* SECTION 1 : Tableau mensuel automatique des locataires en situation d'impayé (retards) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold text-rose-900">
              01. Tableau Mensuel des Locataires en Situation d’Impayé (Retards)
            </h3>
            <p className="text-sm font-medium text-slate-700">
              Liste générée automatiquement dès dépassement de la date d’exigibilité du bail
            </p>
          </div>
          <span className="text-sm font-mono font-extrabold text-rose-600 tabular-nums">
            {overduePayments.length} locataire(s) en retard
          </span>
        </div>

        <div className="border border-rose-200 bg-white rounded-2xl overflow-hidden shadow-xs">
          {overduePayments.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <p className="text-base font-extrabold text-slate-900">
                Aucun impayé enregistré pour ce périmètre
              </p>
              <p className="text-sm font-medium text-slate-600 mt-0.5">
                Tous les locataires sont à jour de leurs règlements mensuels.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-rose-200 bg-rose-900 text-white text-xs font-bold tracking-wide">
                    <th className="py-4 px-4">Locataire & Contact</th>
                    <th className="py-4 px-4">Bien Immobilier & Bailleur</th>
                    <th className="py-4 px-4">Période & Échéance</th>
                    <th className="py-4 px-4 text-right">Retard</th>
                    <th className="py-4 px-4 text-right">Déjà Versé</th>
                    <th className="py-4 px-4 text-right">Solde Impayé</th>
                    <th className="py-4 px-4 text-right">Actions de Recouvrement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100 text-sm">
                  {overduePayments.map((payment) => {
                    const tenant = tenantById[payment.tenantId];
                    const property = propertyById[payment.propertyId];
                    const landlord = landlordById[payment.landlordId];
                    const unpaidAmount =
                      Number(payment.amountDue) - Number(payment.amountPaid);
                    const cleanPhone = (tenant?.phoneWhatsapp || '').replace(
                      /[^0-9]/g,
                      ''
                    );
                    const reminderText = `Bonjour ${tenant?.firstName} ${tenant?.lastName}, sauf erreur de notre part, le solde de votre loyer de ${payment.periodLabel} (${unpaidAmount.toLocaleString('fr-FR')} FCFA) concernant le bien ${property?.title} (${landlord?.companyName || landlord?.fullName}) présente un retard de ${payment.daysLate} jours. Merci de procéder à la régularisation. — Gestion Gimmo`;
                    const reminderWhatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderText)}`;

                    return (
                      <tr key={payment.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="py-4 px-4 align-top">
                          <div className="font-extrabold text-slate-900 text-base">
                            {tenant?.firstName} {tenant?.lastName}
                          </div>
                          <div className="text-xs font-bold text-indigo-700 font-mono mt-0.5">
                            WhatsApp : {tenant?.phoneWhatsapp}
                          </div>
                          {tenant?.guarantorName && (
                            <div className="text-xs font-medium text-slate-600 mt-0.5">
                              Garant : {tenant.guarantorName} ({tenant.guarantorPhone})
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top">
                          <div className="font-bold text-slate-900 text-base">
                            {property?.title}
                          </div>
                          <div className="text-sm font-semibold text-indigo-800 mt-0.5">
                            Bailleur : {landlord?.companyName || landlord?.fullName}
                          </div>
                        </td>

                        <td className="py-4 px-4 align-top text-xs">
                          <div className="font-extrabold text-slate-900 text-sm">
                            {payment.periodLabel}
                          </div>
                          <div className="text-slate-600 font-semibold font-mono mt-0.5">
                            Exigible le {payment.dueDate}
                          </div>
                        </td>

                        <td className="py-4 px-4 align-top text-right font-mono tabular-nums">
                          <span className="inline-flex items-center gap-1 text-sm font-extrabold text-rose-600">
                            <AlertTriangle className="w-4 h-4" />
                            +{payment.daysLate} jours
                          </span>
                        </td>

                        <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-bold text-slate-700">
                          {Number(payment.amountPaid).toLocaleString('fr-FR')} FCFA
                        </td>

                        <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-extrabold text-rose-600 text-base">
                          {unpaidAmount.toLocaleString('fr-FR')} FCFA
                        </td>

                        <td className="py-4 px-4 align-top text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEditPayment(payment)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 whitespace-nowrap shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Modifier
                            </button>
                            <a
                              href={reminderWhatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-400 rounded-lg hover:bg-amber-500 whitespace-nowrap shrink-0"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Relance WhatsApp
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                onSettlePayment(payment.id, 'Virement')
                              }
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 whitespace-nowrap shrink-0"
                            >
                              Régulariser & Quittancer
                            </button>
                            {confirmDeletePaymentId === payment.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setConfirmDeletePaymentId(null);
                                    await onDeletePayment(payment.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-white bg-rose-600 rounded-lg hover:bg-rose-700 whitespace-nowrap shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Confirmer ?
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeletePaymentId(null)
                                  }
                                  className="px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeletePaymentId(payment.id)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 whitespace-nowrap shrink-0"
                                title="Supprimer cet impayé / quittance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Supprimer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2 : Outil de rapport par période des montants totaux encaissés par bailleur */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-indigo-950">
              02. Rapport Financier des Encaissements par Bailleur — {periodLabelDisplay}
            </h3>
            <p className="text-sm font-medium text-slate-700">
              Synthèse comptable des loyers appelés, montants encaissés, honoraires de gestion et net à reverser par propriétaire
            </p>
          </div>
        </div>

        <div className="border border-indigo-200/80 bg-white rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-indigo-200 bg-indigo-950 text-white text-xs font-bold tracking-wide">
                  <th className="py-4 px-4">Bailleur / Société Civile</th>
                  <th className="py-4 px-4 text-right">Biens Gérés</th>
                  <th className="py-4 px-4 text-right">Total Appelé</th>
                  <th className="py-4 px-4 text-right">Total Encaissé</th>
                  <th className="py-4 px-4 text-right">Impayés</th>
                  <th className="py-4 px-4 text-right">Honoraires Agence</th>
                  <th className="py-4 px-4 text-right">Net à Reverser</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {landlordReportRows.map((row) => (
                  <tr
                    key={row.landlord.id}
                    className="hover:bg-indigo-50/40 transition-colors"
                  >
                    <td className="py-4 px-4 align-top">
                      <div className="font-extrabold text-indigo-950 text-base">
                        {row.landlord.companyName || row.landlord.fullName}
                      </div>
                      <div className="text-xs font-semibold text-slate-700 mt-0.5">
                        Représentant : {row.landlord.fullName} · Taux :{' '}
                        <strong className="text-indigo-700">{row.landlord.commissionRate}%</strong>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        IBAN : {row.landlord.iban}
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-bold text-slate-800">
                      {row.propertiesCount} lot(s)
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-bold text-slate-900">
                      {row.expected.toLocaleString('fr-FR')} FCFA
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-extrabold text-emerald-600 text-base">
                      {row.collected.toLocaleString('fr-FR')} FCFA
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-extrabold text-rose-600">
                      {row.unpaid.toLocaleString('fr-FR')} FCFA
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-700">
                      {row.agencyFee.toLocaleString('fr-FR')} FCFA
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-extrabold text-indigo-700 text-base">
                      {row.netLandlord.toLocaleString('fr-FR')} FCFA
                    </td>

                    <td className="py-4 px-4 align-top text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEditLandlord(row.landlord)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 whitespace-nowrap shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Modifier Bailleur
                        </button>
                        {confirmDeleteLandlordId === row.landlord.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                setConfirmDeleteLandlordId(null);
                                await onDeleteLandlord(row.landlord.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-white bg-rose-600 rounded-lg hover:bg-rose-700 whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Confirmer ?
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLandlordId(null)}
                              className="px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteLandlordId(row.landlord.id)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 whitespace-nowrap shrink-0"
                            title="Supprimer ce bailleur et ses biens"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
