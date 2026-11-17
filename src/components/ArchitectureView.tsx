import React, { useState } from 'react';
import { Copy, Check, Database, Server, MapPin } from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const handleCopy = async (id: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedTab(id);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const sqlPostgisSnippet = `-- 1. Activation de l'extension spatiale PostGIS sur PostgreSQL
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Table des Bailleurs (Multi-Bailleurs / Multi-Tenant SaaS)
CREATE TABLE landlords (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  tax_id TEXT,
  iban TEXT,
  commission_rate DOUBLE PRECISION DEFAULT 8.0 NOT NULL,
  contract_header_note TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. Table des Biens Immobiliers avec Géolocalisation GPS & PostGIS (SRID 4326)
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  landlord_id INTEGER NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  property_type TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  surface_area INTEGER NOT NULL,
  rooms_count INTEGER NOT NULL,
  monthly_rent NUMERIC(12, 2) NOT NULL,
  charges_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  postgis_wkt TEXT NOT NULL, -- ex: 'SRID=4326;POINT(-3.987612 5.359952)'
  status TEXT DEFAULT 'occupied' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. Tables Locataires, Contrats de Bail (Leases) & Paiements/Quittances
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_whatsapp TEXT NOT NULL,
  national_id_number TEXT NOT NULL
);

CREATE TABLE leases (
  id SERIAL PRIMARY KEY,
  contract_number TEXT UNIQUE NOT NULL,
  landlord_id INTEGER NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rent_amount NUMERIC(12, 2) NOT NULL,
  charges_amount NUMERIC(12, 2) NOT NULL,
  payment_due_day INTEGER DEFAULT 5 NOT NULL,
  custom_clauses TEXT,
  share_token TEXT UNIQUE NOT NULL
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  landlord_id INTEGER NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  amount_due NUMERIC(12, 2) NOT NULL,
  amount_paid NUMERIC(12, 2) DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  days_late INTEGER DEFAULT 0 NOT NULL,
  share_token TEXT UNIQUE NOT NULL
);`;

  const whatsappEndpointSnippet = `// Endpoint Express.js : Génération du PDF de Quittance & Lien API WhatsApp Cloud
app.post('/api/receipts/:paymentId/whatsapp-share', async (req, res) => {
  const paymentId = Number(req.params.paymentId);
  const details = await getPaymentFullDetailsById(paymentId);
  if (!details) return res.status(404).json({ error: 'Quittance introuvable' });

  const { payment, landlord, property, tenant } = details;
  const baseUrl = process.env.APP_URL || \`\${req.protocol}://\${req.get('host')}\`;

  // 1. Lien sécurisé vers le générateur PDFKit de la quittance
  const pdfUrl = \`\${baseUrl}/api/public/receipts/\${payment.shareToken}/pdf\`;
  const cleanPhone = tenant.phoneWhatsapp.replace(/[^0-9]/g, '');

  // 2. Construction du lien de partage WhatsApp direct
  const message = \`Bonjour \${tenant.firstName}, voici votre Quittance PDF (\${payment.receiptNumber}) : \${pdfUrl}\`;
  const whatsappShareUrl = \`https://wa.me/\${cleanPhone}?text=\${encodeURIComponent(message)}\`;

  // 3. Envoi automatique via Meta WhatsApp Cloud API (Graph API v21.0)
  const cloudApiPayload = {
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'document',
    document: {
      link: pdfUrl,
      caption: \`Quittance \${payment.receiptNumber} - \${payment.periodLabel}\`,
      filename: \`Quittance_\${payment.receiptNumber}.pdf\`,
    },
  };

  return res.json({ pdfUrl, whatsappShareUrl, cloudApiPayload });
});`;

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">
          Architecture Technique Globale — Gimmo SaaS
        </h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Schéma relationnel PostgreSQL + PostGIS, API Backend Express/PDFKit/WhatsApp Cloud et Composant Cartographique Google Maps Platform
        </p>
      </div>

      {/* 3 Piliers d'architecture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Database className="w-4 h-4 text-slate-700" />
            <span>01. Base de Données PostgreSQL & PostGIS</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Isolation multi-bailleurs (`landlords`), biens géolocalisés en WGS84 (`SRID=4326`), contrats personnalisés (`leases`) et grand livre des quittances (`payments`).
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Server className="w-4 h-4 text-slate-700" />
            <span>02. Moteur PDFKit & API WhatsApp Cloud</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Génération PDF à la volée avec jetons cryptographiques uniques (`shareToken`), compatible impression directe et envoi `document` via Graph API Meta v21.0.
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <MapPin className="w-4 h-4 text-slate-700" />
            <span>03. Cartographie Interactive GPS</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Intégration `@vis.gl/react-google-maps` avec `AdvancedMarkerElement`, signalétique couleur temps réel des loyers impayés et inspection PostGIS WKT.
          </p>
        </div>
      </div>

      {/* Bloc 1 : Schéma SQL + PostGIS */}
      <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 font-mono">
            1. Schéma Relationnel PostgreSQL + PostGIS (src/db/schema.ts)
          </span>
          <button
            type="button"
            onClick={() => handleCopy('sql', sqlPostgisSnippet)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
          >
            {copiedTab === 'sql' ? (
              <Check className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedTab === 'sql' ? 'Copié' : 'Copier le SQL'}
          </button>
        </div>
        <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
          {sqlPostgisSnippet}
        </pre>
      </div>

      {/* Bloc 2 : Endpoint Backend WhatsApp + PDF */}
      <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 font-mono">
            2. Endpoint API Backend : Quittance PDF & Partage WhatsApp Cloud (server.ts)
          </span>
          <button
            type="button"
            onClick={() => handleCopy('wa', whatsappEndpointSnippet)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
          >
            {copiedTab === 'wa' ? (
              <Check className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedTab === 'wa' ? 'Copié' : 'Copier le Code'}
          </button>
        </div>
        <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
          {whatsappEndpointSnippet}
        </pre>
      </div>
    </div>
  );
};
