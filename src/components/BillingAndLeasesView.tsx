import React, { useState } from 'react';
import {
  Landlord,
  Property,
  Tenant,
  Lease,
  Payment,
  WhatsappShareResponse,
  AccountingMonth,
} from '../types/gimmo.ts';
import {
  FileText,
  Printer,
  Send,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Pencil,
  X,
  Plus,
  Sliders,
  Trash2,
} from 'lucide-react';
import { parseJsonResponseSafely } from '../lib/landlord-portal.ts';

interface BillingAndLeasesViewProps {
  mode: 'leases' | 'billing';
  landlords: Landlord[];
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  payments: Payment[];
  accountingMonths: AccountingMonth[];
  selectedLandlordId: number | 'all';
  onSettlePayment: (paymentId: number, method: string) => Promise<void>;
  onOpenNewLeaseModal: () => void;
  onOpenNewPaymentModal: () => void;
  onOpenTemplateEditor: (kind: 'lease' | 'receipt') => void;
  onEditLease: (lease: Lease) => void;
  onEditPayment: (payment: Payment) => void;
  onDeleteLease: (leaseId: number) => Promise<void>;
  onDeletePayment: (paymentId: number) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const BillingAndLeasesView: React.FC<BillingAndLeasesViewProps> = ({
  mode,
  landlords,
  properties,
  tenants,
  leases,
  payments,
  accountingMonths,
  selectedLandlordId,
  onSettlePayment,
  onOpenNewLeaseModal,
  onOpenNewPaymentModal,
  onOpenTemplateEditor,
  onEditLease,
  onEditPayment,
  onDeleteLease,
  onDeletePayment,
  onRefresh,
}) => {
  const [whatsappModalData, setWhatsappModalData] =
    useState<WhatsappShareResponse | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [confirmDeleteLeaseId, setConfirmDeleteLeaseId] = useState<
    number | null
  >(null);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<
    number | null
  >(null);

  const landlordById: Record<number, Landlord> = {};
  for (const l of landlords) landlordById[l.id] = l;

  const propertyById: Record<number, Property> = {};
  for (const p of properties) propertyById[p.id] = p;

  const tenantById: Record<number, Tenant> = {};
  for (const t of tenants) tenantById[t.id] = t;

  const filteredLeases = leases.filter((l) =>
    selectedLandlordId === 'all' ? true : l.landlordId === selectedLandlordId
  );

  const filteredPayments = payments.filter((p) => {
    if (selectedLandlordId !== 'all' && p.landlordId !== selectedLandlordId) {
      return false;
    }
    if (periodFilter !== 'all' && p.periodMonth !== periodFilter) {
      return false;
    }
    return true;
  });

  const handleGenerateReceiptWhatsapp = async (paymentId: number) => {
    try {
      setLoadingActionId(paymentId);
      const res = await fetch(`/api/receipts/${paymentId}/whatsapp-share`, {
        method: 'POST',
      });
      const parsed = await parseJsonResponseSafely<WhatsappShareResponse>(res);
      if (!res.ok || !parsed.isJson || !parsed.data) {
        throw new Error('Erreur génération lien WhatsApp');
      }
      setWhatsappModalData(parsed.data);
      await onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleGenerateLeaseWhatsapp = async (leaseId: number) => {
    try {
      setLoadingActionId(leaseId);
      const res = await fetch(`/api/leases/${leaseId}/whatsapp-share`, {
        method: 'POST',
      });
      const parsed = await parseJsonResponseSafely<WhatsappShareResponse>(res);
      if (!res.ok || !parsed.isJson || !parsed.data) {
        throw new Error('Erreur génération lien WhatsApp contrat');
      }
      setWhatsappModalData(parsed.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (mode === 'leases') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-indigo-100">
          <div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-indigo-950 leading-snug">
              Dossiers Locataires & Contrats de Bail Personnalisés
            </h2>
            <p className="text-xs sm:text-sm lg:text-base font-medium text-slate-700 mt-1">
              Génération automatique des baux selon les clauses propres à chaque bailleur, modification complète, export PDF et envoi WhatsApp Cloud
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => onOpenTemplateEditor('lease')}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-indigo-800 bg-indigo-50 border-2 border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
            >
              <Sliders className="w-4 h-4 text-indigo-600" />
              Adapter le Modèle de Contrat
            </button>
            <button
              type="button"
              onClick={onOpenNewLeaseModal}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nouveau Locataire & Bail
            </button>
          </div>
        </div>

        <div className="border border-indigo-200/80 bg-white rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-indigo-200 bg-indigo-950 text-white text-xs font-bold tracking-wide">
                  <th className="py-4 px-4">N° Contrat & Période</th>
                  <th className="py-4 px-4">Locataire & Dossier</th>
                  <th className="py-4 px-4">Bien Immobilier & Bailleur</th>
                  <th className="py-4 px-4 text-right">Loyer + Charges</th>
                  <th className="py-4 px-4 text-right">Caution</th>
                  <th className="py-4 px-4 text-right">Actions Contrat (Modifier / PDF / WhatsApp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredLeases.map((lease) => {
                  const tenant = tenantById[lease.tenantId];
                  const property = propertyById[lease.propertyId];
                  const landlord = landlordById[lease.landlordId];
                  const totalRent =
                    Number(lease.rentAmount) + Number(lease.chargesAmount);

                  return (
                    <tr key={lease.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-4 px-4 align-top">
                        <div className="font-mono font-extrabold text-indigo-700 text-sm">
                          {lease.contractNumber}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 mt-1 font-mono tabular-nums">
                          Du {lease.startDate} au {lease.endDate || 'Tacite'}
                        </div>
                        <div className="text-xs text-emerald-600 font-bold mt-1">
                          {lease.status === 'active' ? 'Bail actif' : lease.status} · Échéance le {lease.paymentDueDay} du mois
                        </div>
                      </td>

                      <td className="py-4 px-4 align-top">
                        <div className="font-extrabold text-slate-900 text-base">
                          {tenant?.firstName} {tenant?.lastName}
                        </div>
                        <div className="text-sm font-medium text-slate-700 mt-0.5">
                          {tenant?.profession} · {tenant?.employer}
                        </div>
                        <div className="text-xs font-semibold text-indigo-700 font-mono mt-1">
                          CNI : {tenant?.nationalIdNumber} · WhatsApp : {tenant?.phoneWhatsapp}
                        </div>
                      </td>

                      <td className="py-4 px-4 align-top">
                        <div className="font-bold text-slate-900 text-base">
                          {property?.title}
                        </div>
                        <div className="text-sm font-semibold text-indigo-800 mt-0.5">
                          Bailleur : {landlord?.companyName || landlord?.fullName}
                        </div>
                        {lease.customClauses && (
                          <div className="text-xs font-medium text-slate-600 mt-1 max-w-xs truncate">
                            Clause : {lease.customClauses}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 align-top text-right font-mono tabular-nums">
                        <div className="font-extrabold text-indigo-700 text-base">
                          {totalRent.toLocaleString('fr-FR')} {property?.currency || 'FCFA'}
                        </div>
                        <div className="text-xs font-semibold text-slate-600">
                          dont {Number(lease.chargesAmount).toLocaleString('fr-FR')} charges
                        </div>
                      </td>

                      <td className="py-4 px-4 align-top text-right font-mono tabular-nums font-bold text-slate-800 text-sm">
                        {Number(lease.securityDeposit).toLocaleString('fr-FR')}{' '}
                        {property?.currency || 'FCFA'}
                      </td>

                      <td className="py-4 px-4 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onEditLease(lease)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
                            title="Modifier ce dossier locataire et bail"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Modifier
                          </button>
                          <a
                            href={`/api/public/leases/${lease.shareToken}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                            title="Ouvrir et imprimer le Contrat PDF"
                          >
                            <Printer className="w-3.5 h-3.5 text-indigo-600" />
                            Imprimer PDF
                          </a>
                          <a
                            href={`/api/public/leases/${lease.shareToken}/pdf?download=1`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                            title="Télécharger le PDF"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-600" />
                            PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => handleGenerateLeaseWhatsapp(lease.id)}
                            disabled={loadingActionId === lease.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                          {confirmDeleteLeaseId === lease.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  setConfirmDeleteLeaseId(null);
                                  await onDeleteLease(lease.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Confirmer ?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLeaseId(null)}
                                className="px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLeaseId(lease.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0"
                              title="Supprimer ce dossier locataire et bail"
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
        </div>

        {whatsappModalData && (
          <WhatsappShareModal
            data={whatsappModalData}
            copied={copiedLink}
            onCopy={handleCopyUrl}
            onClose={() => setWhatsappModalData(null)}
          />
        )}
      </div>
    );
  }

  // Mode 'billing' : Facturation & Quittances de Loyer
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-indigo-100">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-indigo-950 leading-snug">
            Facturation des Loyers & Quittances Automatisées
          </h2>
          <p className="text-xs sm:text-sm lg:text-base font-medium text-slate-700 mt-1">
            Création, validation et modification des règlements, génération instantanée des quittances PDF et envoi en un clic via WhatsApp Cloud API
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1 p-1 sm:p-1.5 bg-indigo-950/5 rounded-xl border border-indigo-200/80 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setPeriodFilter('all')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                periodFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-indigo-950'
              }`}
            >
              Toutes périodes
            </button>
            {accountingMonths.map((m) => (
              <button
                key={m.periodMonth}
                type="button"
                onClick={() => setPeriodFilter(m.periodMonth)}
                className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  periodFilter === m.periodMonth
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-indigo-950'
                }`}
              >
                {m.periodLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenTemplateEditor('receipt')}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-indigo-800 bg-indigo-50 border-2 border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            Adapter le Modèle de Quittance
          </button>

          <button
            type="button"
            onClick={onOpenNewPaymentModal}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Quittance de Loyer
          </button>
        </div>
      </div>

      <div className="border border-indigo-200/80 bg-white rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-indigo-200 bg-indigo-950 text-white text-xs font-bold tracking-wide">
                <th className="py-4 px-4">Réf Quittance & Période</th>
                <th className="py-4 px-4">Locataire & Bien</th>
                <th className="py-4 px-4">Bailleur</th>
                <th className="py-4 px-4 text-right">Montant Appelé</th>
                <th className="py-4 px-4 text-right">Montant Réglé</th>
                <th className="py-4 px-4">État & Règlement</th>
                <th className="py-4 px-4 text-right">Actions Quittance (Modifier / PDF / WhatsApp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredPayments.map((payment) => {
                const tenant = tenantById[payment.tenantId];
                const property = propertyById[payment.propertyId];
                const landlord = landlordById[payment.landlordId];
                const isPaid = payment.status === 'paid';

                return (
                  <tr key={payment.id} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="py-4 px-4 align-top">
                      <div className="font-mono font-extrabold text-indigo-700 text-sm">
                        {payment.receiptNumber}
                      </div>
                      <div className="text-xs font-semibold text-slate-600 mt-1">
                        {payment.periodLabel} · Échéance {payment.dueDate}
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top">
                      <div className="font-extrabold text-slate-900 text-base">
                        {tenant?.firstName} {tenant?.lastName}
                      </div>
                      <div className="text-sm font-semibold text-slate-700 mt-0.5">
                        {property?.title} ({property?.reference})
                      </div>
                      <div className="text-xs font-semibold text-indigo-700 font-mono mt-1">
                        WhatsApp : {tenant?.phoneWhatsapp}
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top text-sm">
                      <div className="font-bold text-indigo-950">
                        {landlord?.companyName || landlord?.fullName}
                      </div>
                      <div className="text-xs font-semibold text-slate-600 mt-0.5">
                        Commission agence : {landlord?.commissionRate}%
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums text-slate-900 font-bold text-base">
                      {Number(payment.amountDue).toLocaleString('fr-FR')}{' '}
                      {property?.currency || 'FCFA'}
                    </td>

                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums text-base">
                      <span
                        className={
                          isPaid
                            ? 'text-emerald-600 font-extrabold'
                            : 'text-rose-600 font-extrabold'
                        }
                      >
                        {Number(payment.amountPaid).toLocaleString('fr-FR')}{' '}
                        {property?.currency || 'FCFA'}
                      </span>
                    </td>

                    <td className="py-4 px-4 align-top">
                      {isPaid ? (
                        <div className="text-xs">
                          <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-700 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Soldé ({payment.paymentMethod})
                          </span>
                          <div className="text-slate-600 font-semibold font-mono mt-1">
                            Payé le {payment.paymentDate}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs">
                          <span className="inline-flex items-center gap-1.5 font-extrabold text-rose-600 text-sm">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            Impayé · {payment.daysLate}j de retard
                          </span>
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                onSettlePayment(payment.id, 'Mobile Money')
                              }
                              className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs transition-colors whitespace-nowrap shrink-0"
                            >
                              Encaisser & Quittancer
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 align-top text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEditPayment(payment)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
                          title="Modifier cette quittance / règlement"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Modifier
                        </button>
                        <a
                          href={`/api/public/receipts/${payment.shareToken}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                          title="Visualiser et imprimer la quittance PDF"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-600" />
                          Imprimer
                        </a>
                        <a
                          href={`/api/public/receipts/${payment.shareToken}/pdf?download=1`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                          title="Exporter en PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          PDF
                        </a>
                        <button
                          type="button"
                          onClick={() => handleGenerateReceiptWhatsapp(payment.id)}
                          disabled={loadingActionId === payment.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {payment.whatsappSent ? 'Renvoyer WhatsApp' : 'Envoyer WhatsApp'}
                        </button>
                        {confirmDeletePaymentId === payment.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                setConfirmDeletePaymentId(null);
                                await onDeletePayment(payment.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Confirmer ?
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePaymentId(null)}
                              className="px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePaymentId(payment.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0"
                            title="Supprimer cette quittance"
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
      </div>

      {whatsappModalData && (
        <WhatsappShareModal
          data={whatsappModalData}
          copied={copiedLink}
          onCopy={handleCopyUrl}
          onClose={() => setWhatsappModalData(null)}
        />
      )}
    </div>
  );
};

interface WhatsappShareModalProps {
  data: WhatsappShareResponse;
  copied: boolean;
  onCopy: (url: string) => void;
  onClose: () => void;
}

const WhatsappShareModal: React.FC<WhatsappShareModalProps> = ({
  data,
  copied,
  onCopy,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-indigo-950/60 p-0 sm:p-4">
      <div className="bg-white border border-indigo-200 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90dvh] flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-indigo-100 px-5 py-4 shrink-0 bg-indigo-950 text-white">
          <div>
            <h3 className="text-base font-extrabold text-white">
              Partage WhatsApp Cloud API & Lien Direct PDF
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5 font-mono">
              Document : {data.receiptNumber || data.contractNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-1.5 text-sm">
              Lien direct du PDF généré par le serveur :
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={data.pdfUrl}
                className="w-full px-3.5 py-2.5 font-mono text-xs bg-indigo-50/50 border border-indigo-200 rounded-xl text-slate-900 font-semibold"
              />
              <button
                type="button"
                onClick={() => onCopy(data.pdfUrl)}
                className="inline-flex items-center gap-1 px-3.5 py-2.5 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>

          {data.cloudApiPayload && (
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 text-sm">
                Payload Graph API Meta (`v21.0/messages` — type: `document`) :
              </label>
              <pre className="p-3.5 bg-indigo-950 text-indigo-100 rounded-xl font-mono text-xs overflow-x-auto">
                {JSON.stringify(data.cloudApiPayload, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-3.5 border-t border-indigo-100 bg-indigo-50/40 shrink-0">
          <a
            href={data.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center px-4 py-2 text-sm font-bold text-indigo-800 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-50 whitespace-nowrap"
          >
            Ouvrir le PDF
          </a>
          <a
            href={data.whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            Ouvrir WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};
