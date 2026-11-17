import React, { useMemo, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  FileText,
  Download,
  LogOut,
  RefreshCw,
  Search,
  MapPin,
  MessageCircle,
  Menu,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import type {
  LandlordPortalSession,
  Property,
} from '../types/gimmo.ts';
import { sanitizeWhatsAppNumber } from '../lib/agency-notifications.ts';

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

type PortalSection = 'properties' | 'leases' | 'payments' | 'mandate';

const PORTAL_SECTION_LABELS: Record<PortalSection, string> = {
  properties: 'Mes Biens & Carte',
  leases: 'Baux & Locataires',
  payments: 'Loyers & Reversements',
  mandate: 'Mon Mandat',
};

interface LandlordPortalViewProps {
  session: LandlordPortalSession;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  isRefreshing?: boolean;
}

export const LandlordPortalView: React.FC<LandlordPortalViewProps> = ({
  session,
  onRefresh,
  onLogout,
  isRefreshing = false,
}) => {
  const { landlord, properties, leases, tenants, payments, managementCompany } =
    session;

  const [activeSection, setActiveSection] =
    useState<PortalSection>('properties');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<
    'all' | 'occupied' | 'vacant' | 'maintenance'
  >('all');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    () => properties[0] || null
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    'all' | 'paid' | 'pending' | 'partial' | 'overdue'
  >('all');

  const tenantById = useMemo(() => {
    const map = new Map<number, (typeof tenants)[number]>();
    tenants.forEach((t) => map.set(t.id, t));
    return map;
  }, [tenants]);

  const propertyById = useMemo(() => {
    const map = new Map<number, Property>();
    properties.forEach((p) => map.set(p.id, p));
    return map;
  }, [properties]);

  const activeLeaseByPropertyId = useMemo(() => {
    const map = new Map<number, (typeof leases)[number]>();
    leases.forEach((l) => {
      if (l.status === 'active' || !map.has(l.propertyId)) {
        map.set(l.propertyId, l);
      }
    });
    return map;
  }, [leases]);

  const availablePeriods = useMemo(() => {
    const seen = new Map<string, string>();
    payments.forEach((p) => {
      if (!seen.has(p.periodMonth)) {
        seen.set(p.periodMonth, p.periodLabel);
      }
    });
    return Array.from(seen.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [payments]);

  const periodFilteredPayments = useMemo(() => {
    return payments.filter((p) =>
      selectedPeriod === 'all' ? true : p.periodMonth === selectedPeriod
    );
  }, [payments, selectedPeriod]);

  const displayedPayments = useMemo(() => {
    return periodFilteredPayments.filter((p) =>
      paymentStatusFilter === 'all' ? true : p.status === paymentStatusFilter
    );
  }, [periodFilteredPayments, paymentStatusFilter]);

  // Indicateurs financiers calculés sur la sélection de période
  const commissionRate = Number(landlord.commissionRate || 0);
  const totalBilled = periodFilteredPayments.reduce(
    (sum, p) => sum + Number(p.amountDue || 0),
    0
  );
  const totalCollected = periodFilteredPayments.reduce(
    (sum, p) => sum + Number(p.amountPaid || 0),
    0
  );
  const totalAgencyFee = Math.round((totalCollected * commissionRate) / 100);
  const netLandlordPayout = Math.max(0, totalCollected - totalAgencyFee);
  const overdueAmount = periodFilteredPayments
    .filter((p) => p.status === 'overdue' || p.status === 'partial')
    .reduce(
      (sum, p) =>
        sum + Math.max(0, Number(p.amountDue || 0) - Number(p.amountPaid || 0)),
      0
    );

  const occupiedCount = properties.filter((p) => p.status === 'occupied').length;
  const vacantCount = properties.filter((p) => p.status === 'vacant').length;
  const maintenanceCount = properties.filter(
    (p) => p.status === 'maintenance'
  ).length;
  const occupancyRate =
    properties.length > 0
      ? Math.round((occupiedCount / properties.length) * 100)
      : 0;

  const filteredProperties = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    return properties.filter((p) => {
      if (propertyStatusFilter !== 'all' && p.status !== propertyStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.neighborhood.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.propertyType.toLowerCase().includes(q)
      );
    });
  }, [properties, propertySearch, propertyStatusFilter]);

  const mapCenter = useMemo(() => {
    if (selectedProperty) {
      return {
        lat: Number(selectedProperty.latitude) || 5.359952,
        lng: Number(selectedProperty.longitude) || -3.987612,
      };
    }
    if (properties.length > 0) {
      return {
        lat: Number(properties[0].latitude) || 5.359952,
        lng: Number(properties[0].longitude) || -3.987612,
      };
    }
    return { lat: 5.359952, lng: -3.987612 };
  }, [selectedProperty, properties]);

  const agencyWaDigits = sanitizeWhatsAppNumber(managementCompany.phone || '');
  const agencyContactWaUrl = agencyWaDigits
    ? `https://wa.me/${agencyWaDigits}?text=${encodeURIComponent(
        `Bonjour ${managementCompany.tradeName || managementCompany.companyName}, je vous contacte depuis mon Portail Bailleur (${landlord.companyName || landlord.fullName}).`
      )}`
    : '';

  const formatStatusFr = (status: Property['status']) => {
    if (status === 'occupied') return 'Occupé';
    if (status === 'vacant') return 'Vacant';
    return 'En maintenance';
  };

  const formatPaymentStatusFr = (
    status: 'paid' | 'overdue' | 'partial' | 'pending'
  ) => {
    if (status === 'paid') return 'Acquitté';
    if (status === 'overdue') return 'En retard';
    if (status === 'partial') return 'Partiel';
    return 'En attente';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract : 3 zones strictes séparées par gap-8 */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 py-4 bg-slate-950 text-white border-b border-slate-800">
        <a
          href="#portail-bailleur"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('properties');
          }}
          className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Gimmo Propriétaire
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          {(Object.keys(PORTAL_SECTION_LABELS) as PortalSection[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeSection === key
                  ? 'text-white font-semibold border-emerald-400'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {PORTAL_SECTION_LABELS[key]}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-rose-700 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Navigation mobile */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between text-white text-sm font-semibold"
        >
          <span className="inline-flex items-center gap-2">
            <Menu className="w-4 h-4 text-emerald-400" />
            <span>{PORTAL_SECTION_LABELS[activeSection]}</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-300 transition-transform duration-150 ${
              mobileMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        {mobileMenuOpen && (
          <nav className="flex flex-col bg-slate-950 border-t border-slate-800 divide-y divide-slate-900">
            {(Object.keys(PORTAL_SECTION_LABELS) as PortalSection[]).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveSection(key);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-5 py-3 text-left text-sm font-medium ${
                    activeSection === key
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  {PORTAL_SECTION_LABELS[key]}
                </button>
              )
            )}
          </nav>
        )}
      </div>

      {/* Barre contextuelle du portefeuille propriétaire */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-[1360px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              Portail Bailleur · Géré par{' '}
              <strong className="text-slate-700">
                {managementCompany.tradeName || managementCompany.companyName}
              </strong>
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {landlord.companyName
                ? `${landlord.companyName} — ${landlord.fullName}`
                : landlord.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
              <span>Compte : {landlord.portalUsername || landlord.email}</span>
              <span aria-hidden="true">·</span>
              <span> Téléphone : {landlord.phone}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Commission agence : {commissionRate}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              aria-label="Filtrer par période comptable"
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-600"
            >
              <option value="all">Toutes les périodes comptables</option>
              {availablePeriods.map(([monthCode, monthLabel]) => (
                <option key={monthCode} value={monthCode}>
                  {monthLabel} ({monthCode})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>Actualiser</span>
            </button>

            <a
              href={`/api/public/reports/financial/pdf?landlordId=${landlord.id}&granularity=monthly`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-950 hover:bg-indigo-900 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Relevé Financier PDF</span>
            </a>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Bandeau de synthèse financière et patrimoniale (4 indicateurs alignés) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">
              Biens immobiliers confiés
            </p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {properties.length} bien{properties.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
              {occupiedCount} occupé{occupiedCount > 1 ? 's' : ''} · {vacantCount}{' '}
              vacant{vacantCount > 1 ? 's' : ''} · Occupation {occupancyRate}%
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">
              Loyers encaissés sur la période
            </p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1.5">
              {totalCollected.toLocaleString('fr-FR')} FCFA
            </p>
            <p className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
              Sur {totalBilled.toLocaleString('fr-FR')} FCFA appelés
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">
              Honoraires de gestion ({commissionRate}%)
            </p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {totalAgencyFee.toLocaleString('fr-FR')} FCFA
            </p>
            <p className="text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
              Impayés / restes : {overdueAmount.toLocaleString('fr-FR')} FCFA
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">
              Net à reverser au propriétaire
            </p>
            <p className="text-2xl font-bold text-indigo-950 font-mono tabular-nums mt-1.5">
              {netLandlordPayout.toLocaleString('fr-FR')} FCFA
            </p>
            <p className="text-xs text-slate-600 mt-1.5">
              Après déduction des honoraires d’agence
            </p>
          </div>
        </section>

        {/* SECTION 1 : MES BIENS & CARTE GPS */}
        {activeSection === 'properties' && (
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Suivi de vos biens immobiliers ({filteredProperties.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Consultez l’état locatif, les loyers mensuels et l’emplacement exact de chaque bien géré.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    placeholder="Rechercher un bien, quartier..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-600 w-56"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                  {(
                    [
                      ['all', `Tous (${properties.length})`],
                      ['occupied', `Occupés (${occupiedCount})`],
                      ['vacant', `Vacants (${vacantCount})`],
                      ...(maintenanceCount > 0
                        ? ([
                            ['maintenance', `Travaux (${maintenanceCount})`],
                          ] as const)
                        : []),
                    ] as const
                  ).map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setPropertyStatusFilter(code)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        propertyStatusFilter === code
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {properties.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">
                  Aucun bien immobilier rattaché pour le moment
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Dès que votre agence gestionnaire enregistrera vos biens immobiliers sur votre compte propriétaire, ils apparaîtront automatiquement ici avec leur géolocalisation GPS et leurs loyers.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Liste des biens */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Bien & Référence</th>
                          <th className="py-3 px-4">Locataire actuel</th>
                          <th className="py-3 px-4 text-right">Loyer + Charges</th>
                          <th className="py-3 px-4">État</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {filteredProperties.map((prop) => {
                          const lease = activeLeaseByPropertyId.get(prop.id);
                          const tenant = lease
                            ? tenantById.get(lease.tenantId)
                            : undefined;
                          const totalMonthly =
                            Number(prop.monthlyRent || 0) +
                            Number(prop.chargesAmount || 0);
                          const isSelected = selectedProperty?.id === prop.id;

                          return (
                            <tr
                              key={prop.id}
                              onClick={() => setSelectedProperty(prop)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50/70'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-900 text-sm">
                                  {prop.title}
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  <span className="font-mono">
                                    {prop.reference}
                                  </span>
                                  <span> · {prop.propertyType}</span>
                                  <span>
                                    {' '}
                                    · {prop.neighborhood}, {prop.city}
                                  </span>
                                  <span className="font-mono tabular-nums">
                                    {' '}
                                    · {prop.surfaceArea} m² ({prop.roomsCount} p.)
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-slate-700">
                                {tenant ? (
                                  <div>
                                    <div className="font-medium text-slate-900">
                                      {tenant.firstName} {tenant.lastName}
                                    </div>
                                    <div className="text-slate-500 font-mono">
                                      Bail {lease?.contractNumber}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">
                                    Aucun locataire actif
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                                <div className="font-semibold text-slate-900">
                                  {totalMonthly.toLocaleString('fr-FR')}{' '}
                                  {prop.currency || 'FCFA'}
                                </div>
                                <div className="text-slate-500">
                                  Loyer{' '}
                                  {Number(prop.monthlyRent || 0).toLocaleString(
                                    'fr-FR'
                                  )}{' '}
                                  + Ch.{' '}
                                  {Number(
                                    prop.chargesAmount || 0
                                  ).toLocaleString('fr-FR')}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-medium">
                                <span
                                  className={
                                    prop.status === 'occupied'
                                      ? 'text-emerald-700'
                                      : prop.status === 'vacant'
                                        ? 'text-amber-700'
                                        : 'text-slate-600'
                                  }
                                >
                                  {formatStatusFr(prop.status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Carte GPS en lecture seule */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[380px]">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-indigo-700" />
                      <span>Localisation GPS du patrimoine</span>
                    </div>
                    {selectedProperty && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedProperty.latitude},${selectedProperty.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-indigo-700 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Ouvrir dans Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex-1 min-h-[330px] relative bg-slate-100">
                    {GOOGLE_MAPS_API_KEY ? (
                      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                        <GoogleMap
                          defaultZoom={13}
                          center={mapCenter}
                          mapId="gimmo-landlord-portal-map"
                          gestureHandling="greedy"
                          disableDefaultUI={false}
                          className="w-full h-full min-h-[330px]"
                        >
                          {filteredProperties.map((prop) => (
                            <AdvancedMarker
                              key={prop.id}
                              position={{
                                lat: Number(prop.latitude),
                                lng: Number(prop.longitude),
                              }}
                              onClick={() => setSelectedProperty(prop)}
                            >
                              <div
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm border ${
                                  selectedProperty?.id === prop.id
                                    ? 'bg-indigo-950 text-white border-white'
                                    : prop.status === 'occupied'
                                      ? 'bg-emerald-700 text-white border-emerald-900'
                                      : 'bg-amber-500 text-slate-950 border-amber-700'
                                }`}
                              >
                                {prop.reference}
                              </div>
                            </AdvancedMarker>
                          ))}

                          {selectedProperty && (
                            <InfoWindow
                              position={{
                                lat: Number(selectedProperty.latitude),
                                lng: Number(selectedProperty.longitude),
                              }}
                              onCloseClick={() => setSelectedProperty(null)}
                            >
                              <div className="p-1 max-w-[220px] text-slate-900 space-y-1">
                                <div className="text-xs font-bold">
                                  {selectedProperty.title}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  {selectedProperty.address},{' '}
                                  {selectedProperty.neighborhood}
                                </div>
                                <div className="text-[11px] font-mono font-semibold text-indigo-900">
                                  {Number(
                                    selectedProperty.monthlyRent || 0
                                  ).toLocaleString('fr-FR')}{' '}
                                  FCFA / mois
                                </div>
                              </div>
                            </InfoWindow>
                          )}
                        </GoogleMap>
                      </APIProvider>
                    ) : (
                      <div className="p-6 h-full flex flex-col items-center justify-center text-center space-y-2">
                        <MapPin className="w-7 h-7 text-indigo-700" />
                        {selectedProperty ? (
                          <>
                            <div className="text-sm font-semibold text-slate-900">
                              {selectedProperty.title}
                            </div>
                            <div className="text-xs text-slate-600">
                              {selectedProperty.address},{' '}
                              {selectedProperty.neighborhood} (
                              {selectedProperty.city})
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              GPS : {selectedProperty.latitude.toFixed(5)},{' '}
                              {selectedProperty.longitude.toFixed(5)}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Sélectionnez un bien pour afficher ses coordonnées GPS.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 2 : CONTRATS DE BAIL & LOCATAIRES */}
        {activeSection === 'leases' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Contrats de bail & locataires en place ({leases.length})
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Consultez les baux signés sur vos biens et téléchargez chaque contrat officiel en PDF.
              </p>
            </div>

            {leases.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">
                  Aucun contrat de bail actif
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Les contrats de bail établis par votre agence immobilière pour vos biens s’afficheront ici avec leur lien de téléchargement PDF.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">N° Contrat & Période</th>
                        <th className="py-3 px-4">Bien Immobilier</th>
                        <th className="py-3 px-4">Locataire</th>
                        <th className="py-3 px-4 text-right">Loyer Mensuel</th>
                        <th className="py-3 px-4 text-right">Caution</th>
                        <th className="py-3 px-4 text-right">Contrat PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {leases.map((lease) => {
                        const prop = propertyById.get(lease.propertyId);
                        const tenant = tenantById.get(lease.tenantId);
                        const totalMonthly =
                          Number(lease.rentAmount || 0) +
                          Number(lease.chargesAmount || 0);

                        return (
                          <tr key={lease.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-semibold text-slate-900">
                                {lease.contractNumber}
                              </div>
                              <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                                Du {lease.startDate}
                                {lease.endDate ? ` au ${lease.endDate}` : ''} ·
                                Échéance le {lease.paymentDueDay}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-900">
                                {prop?.title || `Bien #${lease.propertyId}`}
                              </div>
                              <div className="text-slate-500">
                                {prop
                                  ? `${prop.reference} · ${prop.neighborhood}`
                                  : '—'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-900">
                                {tenant
                                  ? `${tenant.firstName} ${tenant.lastName}`
                                  : '—'}
                              </div>
                              <div className="text-slate-500">
                                {tenant?.profession || 'Locataire'} ·{' '}
                                {tenant?.phoneWhatsapp || ''}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {totalMonthly.toLocaleString('fr-FR')} FCFA
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                              {Number(
                                lease.securityDeposit || 0
                              ).toLocaleString('fr-FR')}{' '}
                              FCFA
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <a
                                href={`/api/public/leases/${lease.shareToken}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Bail PDF</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 3 : LOYERS, QUITTANCES & REVERSEMENTS */}
        {activeSection === 'payments' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Historique des loyers, quittances & reversements nets (
                  {displayedPayments.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Détail de chaque encaissement, des honoraires de gestion ({commissionRate}%) et du net propriétaire.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                {(
                  [
                    ['all', 'Tous'],
                    ['paid', 'Acquittés'],
                    ['pending', 'En attente'],
                    ['partial', 'Partiels'],
                    ['overdue', 'En retard'],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setPaymentStatusFilter(code)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      paymentStatusFilter === code
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {displayedPayments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">
                  Aucune échéance enregistrée sur ce filtre
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Dès que les appels de loyers et encaissements sont enregistrés par votre agence, vos quittances PDF et montants nets apparaissent ici.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Quittance & Période</th>
                        <th className="py-3 px-4">Bien & Locataire</th>
                        <th className="py-3 px-4 text-right">Appelé</th>
                        <th className="py-3 px-4 text-right">Encaissé</th>
                        <th className="py-3 px-4 text-right">
                          Net Propriétaire
                        </th>
                        <th className="py-3 px-4">État</th>
                        <th className="py-3 px-4 text-right">Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {displayedPayments.map((payment) => {
                        const prop = propertyById.get(payment.propertyId);
                        const tenant = tenantById.get(payment.tenantId);
                        const paidVal = Number(payment.amountPaid || 0);
                        const feeVal = Math.round(
                          (paidVal * commissionRate) / 100
                        );
                        const netVal = Math.max(0, paidVal - feeVal);

                        return (
                          <tr key={payment.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-semibold text-slate-900">
                                {payment.receiptNumber}
                              </div>
                              <div className="text-slate-500 mt-0.5">
                                {payment.periodLabel} · Échéance{' '}
                                <span className="font-mono">
                                  {payment.dueDate}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-900">
                                {prop?.title || `Bien #${payment.propertyId}`}
                              </div>
                              <div className="text-slate-500">
                                {tenant
                                  ? `${tenant.firstName} ${tenant.lastName}`
                                  : '—'}
                                {payment.paymentMethod
                                  ? ` · ${payment.paymentMethod}`
                                  : ''}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                              {Number(payment.amountDue || 0).toLocaleString(
                                'fr-FR'
                              )}{' '}
                              FCFA
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                              {paidVal.toLocaleString('fr-FR')} FCFA
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-indigo-950">
                              {netVal.toLocaleString('fr-FR')} FCFA
                            </td>

                            <td className="py-3.5 px-4 font-medium">
                              <span
                                className={
                                  payment.status === 'paid'
                                    ? 'text-emerald-700'
                                    : payment.status === 'overdue'
                                      ? 'text-rose-700'
                                      : payment.status === 'partial'
                                        ? 'text-amber-700'
                                        : 'text-slate-600'
                                }
                              >
                                {formatPaymentStatusFr(payment.status)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <a
                                href={`/api/public/receipts/${payment.shareToken}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Quittance PDF</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 4 : MON MANDAT & AGENCE GESTIONNAIRE */}
        {activeSection === 'mandate' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Informations de votre mandat propriétaire
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Récapitulatif de vos coordonnées enregistrées pour le reversement des loyers.
                </p>
              </div>

              <dl className="divide-y divide-slate-200 text-xs">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500">Propriétaire / Société</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {landlord.companyName
                      ? `${landlord.companyName} (${landlord.fullName})`
                      : landlord.fullName}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500">Identifiant Portail</dt>
                  <dd className="font-mono font-semibold text-slate-900 text-right">
                    {landlord.portalUsername || landlord.email}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500">Téléphone WhatsApp</dt>
                  <dd className="font-mono text-slate-900 text-right">
                    {landlord.phone}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500">N° Fiscal / RCCM</dt>
                  <dd className="font-mono text-slate-900 text-right">
                    {landlord.taxId || '—'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500">IBAN / Compte de reversement</dt>
                  <dd className="font-mono text-slate-900 text-right">
                    {landlord.iban || '—'}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500">Taux d’honoraires agence</dt>
                  <dd className="font-mono font-bold text-indigo-950 text-right">
                    {commissionRate}%
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Votre agence immobilière gestionnaire
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Interlocuteur mandaté pour l’administration de vos biens, l’encaissement et le recouvrement.
                  </p>
                </div>

                <dl className="divide-y divide-slate-200 text-xs">
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500">Raison sociale</dt>
                    <dd className="font-semibold text-slate-900 text-right">
                      {managementCompany.companyName}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500">Direction</dt>
                    <dd className="text-slate-900 text-right">
                      {managementCompany.managerName}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500">Adresse</dt>
                    <dd className="text-slate-900 text-right">
                      {managementCompany.address}, {managementCompany.city}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500">Téléphone</dt>
                    <dd className="font-mono text-slate-900 text-right">
                      {managementCompany.phone}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="text-slate-900 text-right">
                      {managementCompany.email}
                    </dd>
                  </div>
                </dl>
              </div>

              {agencyContactWaUrl && (
                <div className="pt-2">
                  <a
                    href={agencyContactWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Contacter mon agence sur WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 text-center">
        Portail Propriétaire Mandant · {managementCompany.companyName}
      </footer>
    </div>
  );
};
