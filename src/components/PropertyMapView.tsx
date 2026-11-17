import React, { useState, useCallback, useEffect } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { Property, Landlord, Payment } from '../types/gimmo.ts';
import {
  MapPin,
  Navigation,
  Building2,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

interface PropertyMarkerItemProps {
  property: Property;
  landlord?: Landlord;
  hasOverdue: boolean;
  isSelected: boolean;
  onSelect: (property: Property) => void;
  onEdit: (property: Property) => void;
}

function PropertyMarkerItem({
  property,
  landlord,
  hasOverdue,
  isSelected,
  onSelect,
  onEdit,
}: PropertyMarkerItemProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  // Couleur sémantique vive selon l'état locatif et financier
  const pinColor = hasOverdue
    ? 'bg-rose-600 border-rose-800 text-white'
    : property.status === 'vacant'
      ? 'bg-amber-500 border-amber-700 text-slate-950'
      : 'bg-indigo-600 border-indigo-800 text-white';

  const statusLabel = hasOverdue
    ? 'Impayé signalé'
    : property.status === 'vacant'
      ? 'Vacant · Disponible'
      : 'Occupé · À jour';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: property.latitude, lng: property.longitude }}
        onClick={() => onSelect(property)}
        title={`${property.title} (${property.reference})`}
      >
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 shadow-md cursor-pointer transition-transform duration-150 ${pinColor} ${
            isSelected
              ? 'scale-110 ring-2 ring-indigo-600 ring-offset-2'
              : 'hover:scale-105'
          }`}
        >
          <span className="font-mono text-xs font-bold tabular-nums whitespace-nowrap">
            {(Number(property.monthlyRent) / 1000).toFixed(0)}k {property.currency}
          </span>
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={340}
          onCloseClick={() => onSelect(property)}
        >
          <div className="p-1.5 text-slate-900 font-sans">
            <div className="text-xs font-bold text-indigo-700 font-mono mb-1">
              {property.reference} · {property.propertyType} · {statusLabel}
            </div>
            <h4 className="text-base font-extrabold text-slate-900 mb-1">
              {property.title}
            </h4>
            <p className="text-xs font-medium text-slate-700 mb-2">
              {property.address}, {property.neighborhood}, {property.city}
            </p>
            <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Loyer mensuel HC :</span>
              <span className="font-mono font-bold text-indigo-700 tabular-nums text-sm">
                {Number(property.monthlyRent).toLocaleString('fr-FR')} {property.currency}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="font-semibold text-slate-600">Bailleur :</span>
              <span className="font-bold text-slate-900 truncate max-w-[180px]">
                {landlord?.companyName || landlord?.fullName || 'N/A'}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-semibold text-slate-600 truncate">
                {property.latitude.toFixed(5)}, {property.longitude.toFixed(5)}
              </span>
              <button
                type="button"
                onClick={() => onEdit(property)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shrink-0"
              >
                <Pencil className="w-3 h-3" />
                Modifier
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapCameraController({
  selectedProperty,
}: {
  selectedProperty: Property | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (map && selectedProperty) {
      map.panTo({
        lat: selectedProperty.latitude,
        lng: selectedProperty.longitude,
      });
      map.setZoom(14);
    }
  }, [map, selectedProperty]);

  return null;
}

interface PropertyMapViewProps {
  properties: Property[];
  landlords: Landlord[];
  payments: Payment[];
  selectedLandlordId: number | 'all';
  onOpenNewPropertyModal: () => void;
  onEditProperty: (property: Property) => void;
  onDeleteProperty: (propertyId: number) => Promise<void>;
}

export const PropertyMapView: React.FC<PropertyMapViewProps> = ({
  properties,
  landlords,
  payments,
  selectedLandlordId,
  onOpenNewPropertyModal,
  onEditProperty,
  onDeleteProperty,
}) => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    properties[0] || null
  );
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'occupied' | 'vacant' | 'overdue'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Table de correspondance par ID (évite new Map() pour respecter la règle anti-shadowing CF5)
  const landlordLookup: Record<number, Landlord> = {};
  for (const l of landlords) {
    landlordLookup[l.id] = l;
  }

  const overdueByProperty: Record<number, boolean> = {};
  for (const p of payments) {
    if (p.status === 'overdue') {
      overdueByProperty[p.propertyId] = true;
    }
  }

  const filteredProperties = properties.filter((prop) => {
    if (selectedLandlordId !== 'all' && prop.landlordId !== selectedLandlordId) {
      return false;
    }
    if (statusFilter === 'occupied' && prop.status !== 'occupied') return false;
    if (statusFilter === 'vacant' && prop.status !== 'vacant') return false;
    if (statusFilter === 'overdue' && !overdueByProperty[prop.id]) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        prop.title.toLowerCase().includes(q) ||
        prop.reference.toLowerCase().includes(q) ||
        prop.neighborhood.toLowerCase().includes(q) ||
        prop.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectProperty = useCallback((prop: Property) => {
    setSelectedProperty((prev) => (prev?.id === prop.id ? null : prop));
  }, []);

  const defaultCenter = {
    lat: filteredProperties[0]?.latitude || 5.3364,
    lng: filteredProperties[0]?.longitude || -3.9796,
  };

  return (
    <div className="space-y-6">
      {/* Barre d'outils et filtres de géolocalisation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-indigo-100">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-indigo-950 leading-snug">
            Patrimoine Immobilier & Cartographie GPS PostGIS
          </h2>
          <p className="text-xs sm:text-sm lg:text-base font-medium text-slate-700 mt-1">
            Visualisation temps réel des lots, coordonnées WGS84 (SRID 4326) et état d’occupation par bailleur
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Filtres segmentés fonctionnels vifs */}
          <div className="flex items-center gap-1 p-1 sm:p-1.5 bg-indigo-950/5 rounded-xl border border-indigo-200/80 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-indigo-950'
              }`}
            >
              Tous ({properties.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('occupied')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'occupied'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-emerald-800'
              }`}
            >
              Occupés
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('vacant')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'vacant'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 hover:text-amber-800'
              }`}
            >
              Vacants
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'overdue'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-rose-800'
              }`}
            >
              Avec Impayé
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenNewPropertyModal}
            className="w-full sm:w-auto min-h-[44px] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            + Ajouter un bien GPS
          </button>
        </div>
      </div>

      {/* Grille principale : Liste des biens + Carte interactive Google Maps Platform */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Colonne gauche : Répertoire des biens géolocalisés (5 colonnes) */}
        <div className="lg:col-span-5 flex flex-col border border-indigo-200/80 bg-white rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-indigo-100 bg-indigo-50/50">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par réf, quartier, adresse..."
              className="w-full px-4 py-2.5 text-sm font-medium bg-white border border-indigo-200 rounded-xl text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
            {filteredProperties.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-base font-semibold text-slate-700">
                  Aucun bien immobilier ne correspond aux critères sélectionnés.
                </p>
              </div>
            ) : (
              filteredProperties.map((prop) => {
                const landlord = landlordLookup[prop.landlordId];
                const hasOverdue = Boolean(overdueByProperty[prop.id]);
                const isSelected = selectedProperty?.id === prop.id;

                return (
                  <div
                    key={prop.id}
                    onClick={() => setSelectedProperty(prop)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/90'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {/* Métadonnées textuelles épurées avec séparateurs typographiques (Zero-Pill Discipline) */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono font-bold">
                          <span className="text-indigo-700">
                            {prop.reference}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="text-slate-700">{prop.propertyType}</span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="text-slate-700">{prop.surfaceArea} m²</span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span
                            className={
                              hasOverdue
                                ? 'text-rose-600 font-extrabold'
                                : prop.status === 'vacant'
                                  ? 'text-amber-600 font-extrabold'
                                  : 'text-emerald-600 font-extrabold'
                            }
                          >
                            {hasOverdue
                              ? 'Retard de loyer'
                              : prop.status === 'vacant'
                                ? 'Vacant'
                                : 'Occupé'}
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900 mt-1">
                          {prop.title}
                        </h3>
                        <p className="text-sm font-medium text-slate-700 mt-0.5">
                          {prop.address}, {prop.neighborhood} ({prop.city})
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold font-mono text-indigo-700 tabular-nums">
                          {Number(prop.monthlyRent).toLocaleString('fr-FR')}{' '}
                          {prop.currency}
                        </div>
                        <div className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
                          +{Number(prop.chargesAmount).toLocaleString('fr-FR')} charges
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                      <span className="truncate max-w-[210px] font-medium">
                        Bailleur :{' '}
                        <strong className="font-bold text-indigo-950">
                          {landlord?.companyName || landlord?.fullName}
                        </strong>
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums flex items-center gap-1">
                          <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                          {prop.latitude.toFixed(4)}, {prop.longitude.toFixed(4)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProperty(prop);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Modifier
                        </button>
                        {confirmDeleteId === prop.id ? (
                          <div
                            className="inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={async () => {
                                setConfirmDeleteId(null);
                                if (selectedProperty?.id === prop.id) {
                                  setSelectedProperty(null);
                                }
                                await onDeleteProperty(prop.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Confirmer ?
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(prop.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0"
                            title="Supprimer ce bien immobilier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Colonne droite : Carte Interactive Google Maps Platform (7 colonnes, hauteur explicite CF2) */}
        <div className="lg:col-span-7 flex flex-col border border-indigo-200/80 bg-white rounded-2xl overflow-hidden shadow-xs">
          <div className="px-4 py-3.5 border-b border-indigo-100 bg-indigo-50/50 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-indigo-950 text-sm">
                Carte Interactive Google Maps Platform
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-indigo-700">SRID=4326 (PostGIS)</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-indigo-700">Indigo : Occupé à jour</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-600">Rouge : Impayé</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-600">Ambre : Vacant</span>
            </div>
          </div>

          {/* Conteneur Map avec hauteur explicite obligatoire (CF2) */}
          <div className="w-full h-[540px] relative bg-slate-100">
            <APIProvider
              apiKey={GOOGLE_MAPS_API_KEY}
              language="fr"
              region="CI"
            >
              <GoogleMap
                defaultCenter={defaultCenter}
                defaultZoom={12}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="w-full h-full"
              >
                <MapCameraController selectedProperty={selectedProperty} />
                {filteredProperties.map((prop) => (
                  <PropertyMarkerItem
                    key={prop.id}
                    property={prop}
                    landlord={landlordLookup[prop.landlordId]}
                    hasOverdue={Boolean(overdueByProperty[prop.id])}
                    isSelected={selectedProperty?.id === prop.id}
                    onSelect={handleSelectProperty}
                    onEdit={onEditProperty}
                  />
                ))}
              </GoogleMap>
            </APIProvider>
          </div>

          {/* Barre d'inspection PostGIS du bien sélectionné */}
          {selectedProperty && (
            <div className="px-4 py-3.5 border-t border-indigo-100 bg-indigo-50/40 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-800">
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-extrabold text-indigo-950">
                  {selectedProperty.title}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-xs font-semibold text-indigo-700">
                  {selectedProperty.postgisWkt}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onEditProperty(selectedProperty)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier ce bien
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const idToDelete = selectedProperty.id;
                    setSelectedProperty(null);
                    await onDeleteProperty(idToDelete);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer ce bien
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedProperty.latitude},${selectedProperty.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline whitespace-nowrap shrink-0"
                >
                  Ouvrir dans Google Maps
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
