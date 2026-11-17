import express, { type Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  getAllDashboardData,
  getPaymentFullDetailsByToken,
  getPaymentFullDetailsById,
  getLeaseFullDetailsByToken,
  getLeaseFullDetailsById,
  markPaymentAsPaid,
  markWhatsappSent,
  createPropertyRecord,
  createLandlordRecord,
  createTenantAndLeaseRecord,
  updatePropertyRecord,
  updateLandlordRecord,
  updateTenantAndLeaseRecord,
  updatePaymentRecord,
  createPaymentRecord,
  generateRentCallsForMonthRecord,
  deletePropertyRecord,
  deleteLandlordRecord,
  deleteLeaseRecord,
  deletePaymentRecord,
  renamePropertyTypeInRecords,
} from './src/db/gimmo-repository.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  streamReceiptPdf,
  streamLeaseContractPdf,
  streamFinancialReportPdf,
  streamUserGuidePdf,
  getDocumentTemplatesStore,
  saveDocumentTemplateEntry,
  saveManagementCompanyEntry,
  upsertSaaSTenantEntry,
  deleteSaaSTenantEntry,
  upsertSaaSUserEntry,
  deleteSaaSUserEntry,
  upsertAccountingMonthEntry,
  deleteAccountingMonthEntry,
  upsertPropertyTypeEntry,
  deletePropertyTypeEntry,
} from './src/services/pdf-generator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  const getDashboardDataWithTemplates = async () => {
    const dbData = await getAllDashboardData();
    return {
      ...dbData,
      templates: getDocumentTemplatesStore(),
    };
  };

  // ============================================================================
  // INFRASTRUCTURE DE SYNCHRONISATION TEMPS RÉEL (WebSocket + SSE)
  // ============================================================================
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/realtime/ws',
  });
  const sseClients = new Set<Response>();

  const getActiveConnectionsCount = () => {
    let wsCount = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) wsCount++;
    });
    return wsCount + sseClients.size;
  };

  const broadcastRealtimeState = async (action: string) => {
    try {
      const data = await getDashboardDataWithTemplates();
      const payload = JSON.stringify({
        type: 'gimmo:state_updated',
        action,
        timestamp: new Date().toISOString(),
        connectedClients: Math.max(1, getActiveConnectionsCount()),
        data,
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });

      sseClients.forEach((res) => {
        res.write(`data: ${payload}\n\n`);
      });
    } catch (err) {
      console.error('Error broadcasting real-time state:', err);
    }
  };

  wss.on('connection', async (ws) => {
    try {
      const data = await getDashboardDataWithTemplates();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'gimmo:state_updated',
            action: 'Synchronisation initiale temps réel',
            timestamp: new Date().toISOString(),
            connectedClients: Math.max(1, getActiveConnectionsCount()),
            data,
          })
        );
      }
    } catch (err) {
      console.error('Initial WS state push error:', err);
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'client:request_sync') {
          await broadcastRealtimeState('Synchronisation demandée');
        }
      } catch {
        // Ignore malformed messages
      }
    });
  });

  // Canal SSE de secours pour la synchronisation temps réel en arrière-plan
  app.get('/api/realtime/events', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);

    try {
      const data = await getDashboardDataWithTemplates();
      res.write(
        `data: ${JSON.stringify({
          type: 'gimmo:state_updated',
          action: 'Connexion flux temps réel',
          timestamp: new Date().toISOString(),
          connectedClients: Math.max(1, getActiveConnectionsCount()),
          data,
        })}\n\n`
      );
    } catch (err) {
      console.error('Initial SSE push error:', err);
    }

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  /**
   * 1. Synchronisation du profil utilisateur Firebase Auth -> PostgreSQL
   */
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid || 'global_demo';
      const email = req.user?.email || 'gestionnaire@gimmo.ci';
      const name = req.user?.name;
      const user = await getOrCreateUser(uid, email, name);
      res.json({ user });
    } catch (error: any) {
      console.error('Auth sync error:', error);
      res.status(500).json({ error: error.message || 'Auth sync failed' });
    }
  });

  /**
   * 2. Récupération complète des données du portefeuille multi-bailleurs + Modèles de documents
   */
  app.get('/api/gimmo/overview', async (_req, res) => {
    try {
      const data = await getDashboardDataWithTemplates();
      res.json(data);
    } catch (error: any) {
      console.error('Overview error:', error);
      res.status(500).json({ error: error.message || 'Erreur lors du chargement des données' });
    }
  });

  /**
   * 2b. Synchronisation groupée en arrière-plan de la file d'attente Hors-Ligne
   */
  app.post('/api/gimmo/sync-batch', async (req, res) => {
    try {
      const mutations = Array.isArray(req.body?.mutations)
        ? req.body.mutations
        : [];

      for (const item of mutations) {
        const { url, method, body } = item;
        if (url === '/api/properties' && method === 'POST') {
          await createPropertyRecord({ userId: 'global_demo', ...body });
        } else if (url?.startsWith('/api/properties/') && method === 'PUT') {
          const id = Number(url.split('/').pop());
          await updatePropertyRecord(id, body);
        } else if (url === '/api/landlords' && method === 'POST') {
          await createLandlordRecord({ userId: 'global_demo', ...body });
        } else if (url?.startsWith('/api/landlords/') && method === 'PUT') {
          const id = Number(url.split('/').pop());
          await updateLandlordRecord(id, body);
        } else if (url === '/api/tenants-leases' && method === 'POST') {
          await createTenantAndLeaseRecord({ userId: 'global_demo', ...body });
        } else if (url?.startsWith('/api/tenants-leases/') && method === 'PUT') {
          const id = Number(url.split('/').pop());
          await updateTenantAndLeaseRecord(id, body);
        } else if (url === '/api/payments' && method === 'POST') {
          await createPaymentRecord({ userId: 'global_demo', ...body });
        } else if (url?.endsWith('/settle') && method === 'POST') {
          const parts = url.split('/');
          const paymentId = Number(parts[parts.length - 2]);
          await markPaymentAsPaid(paymentId, body?.paymentMethod || 'Mobile Money');
        } else if (url?.startsWith('/api/payments/') && method === 'PUT') {
          const id = Number(url.split('/').pop());
          await updatePaymentRecord(id, body);
        } else if (url === '/api/templates' && method === 'PUT') {
          saveDocumentTemplateEntry(body);
        } else if (url === '/api/accounting-months' && method === 'POST') {
          upsertAccountingMonthEntry(body);
          if (body?.autoGenerateRentCalls) {
            await generateRentCallsForMonthRecord({
              userId: 'global_demo',
              periodMonth: body.periodMonth,
              periodLabel: body.periodLabel,
              defaultDueDay: Number(body.defaultDueDay || 5),
              initialStatus: body.initialStatus || 'pending',
            });
          }
        } else if (url?.startsWith('/api/properties/') && method === 'DELETE') {
          const id = Number(url.split('/').pop());
          await deletePropertyRecord(id);
        } else if (url?.startsWith('/api/landlords/') && method === 'DELETE') {
          const id = Number(url.split('/').pop());
          await deleteLandlordRecord(id);
        } else if (url?.startsWith('/api/tenants-leases/') && method === 'DELETE') {
          const id = Number(url.split('/').pop());
          await deleteLeaseRecord(id);
        } else if (url?.startsWith('/api/payments/') && method === 'DELETE') {
          const id = Number(url.split('/').pop());
          await deletePaymentRecord(id);
        } else if (url?.startsWith('/api/accounting-months/') && method === 'DELETE') {
          const periodMonth = decodeURIComponent(url.split('/').pop() || '');
          deleteAccountingMonthEntry(periodMonth);
        } else if (url === '/api/property-types' && method === 'POST') {
          upsertPropertyTypeEntry(body);
          if (body?.previousName && body.previousName !== body.name) {
            await renamePropertyTypeInRecords(body.previousName, body.name);
          }
        } else if (url?.startsWith('/api/property-types/') && method === 'DELETE') {
          const id = decodeURIComponent(url.split('/').pop() || '');
          deletePropertyTypeEntry(id);
        } else if (url === '/api/management-company' && method === 'PUT') {
          saveManagementCompanyEntry(body || {});
        } else if (url === '/api/saas/tenants' && method === 'POST') {
          if (body?.companyName) {
            upsertSaaSTenantEntry(body);
          }
        } else if (url?.startsWith('/api/saas/tenants/') && method === 'DELETE') {
          const id = decodeURIComponent(url.split('/').pop() || '');
          deleteSaaSTenantEntry(id);
        } else if (url === '/api/saas/users' && method === 'POST') {
          if (body?.email && body?.fullName) {
            upsertSaaSUserEntry(body);
          }
        } else if (url?.startsWith('/api/saas/users/') && method === 'DELETE') {
          const id = decodeURIComponent(url.split('/').pop() || '');
          deleteSaaSUserEntry(id);
        }
      }

      const data = await getDashboardDataWithTemplates();
      await broadcastRealtimeState(
        `Synchronisation arrière-plan (${mutations.length} opération(s))`
      );
      res.json({ success: true, syncedCount: mutations.length, data });
    } catch (error: any) {
      console.error('Batch sync error:', error);
      res.status(500).json({ error: error.message || 'Erreur de synchronisation' });
    }
  });

  /**
   * 2c. Sauvegarde d'un Modèle Personnalisé de Contrat de Bail ou de Quittance
   */
  app.put('/api/templates', async (req, res) => {
    try {
      const { scopeKey, kind, config } = req.body || {};
      if (!scopeKey || (kind !== 'lease' && kind !== 'receipt') || !config) {
        return res.status(400).json({ error: 'Paramètres de modèle invalides' });
      }
      const updatedStore = saveDocumentTemplateEntry({ scopeKey, kind, config });
      await broadcastRealtimeState(
        `Modèle de ${kind === 'lease' ? 'Contrat de Bail' : 'Quittance'} mis à jour (${scopeKey})`
      );
      res.json({ templates: updatedStore });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur sauvegarde modèle' });
    }
  });

  /**
   * 2d. Création ou mise à jour d'un Mois Comptable (+ génération automatique optionnelle des appels de loyer)
   */
  app.post('/api/accounting-months', async (req, res) => {
    try {
      const {
        periodMonth,
        periodLabel,
        defaultDueDay,
        status,
        isCurrent,
        autoGenerateRentCalls,
        initialStatus,
      } = req.body || {};

      if (!periodMonth || !periodLabel) {
        return res
          .status(400)
          .json({ error: 'Le code du mois (YYYY-MM) et le libellé sont requis' });
      }

      const updatedStore = upsertAccountingMonthEntry({
        periodMonth,
        periodLabel,
        defaultDueDay: Number(defaultDueDay || 5),
        status: status || 'open',
        isCurrent,
      });

      let generatedCount = 0;
      if (autoGenerateRentCalls) {
        const createdPayments = await generateRentCallsForMonthRecord({
          userId: 'global_demo',
          periodMonth,
          periodLabel,
          defaultDueDay: Number(defaultDueDay || 5),
          initialStatus: initialStatus || 'pending',
        });
        generatedCount = createdPayments.length;
      }

      await broadcastRealtimeState(
        `Mois comptable ${periodLabel} enregistré (${generatedCount} appel(s) généré(s))`
      );
      res.status(201).json({
        templates: updatedStore,
        generatedCount,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur création mois comptable' });
    }
  });

  /**
   * 2e. Création ou modification d'un Type de Bien Immobilier dans Paramétrage
   */
  app.post('/api/property-types', async (req, res) => {
    try {
      const {
        id,
        name,
        code,
        category,
        defaultCharges,
        description,
        previousName,
      } = req.body || {};

      if (!name || !String(name).trim()) {
        return res
          .status(400)
          .json({ error: 'Le nom du type de bien est requis' });
      }

      const updatedStore = upsertPropertyTypeEntry({
        id,
        name: String(name).trim(),
        code,
        category,
        defaultCharges,
        description,
      });

      if (previousName && previousName !== String(name).trim()) {
        await renamePropertyTypeInRecords(previousName, String(name).trim());
      }

      await broadcastRealtimeState(
        `Type de bien enregistré : ${String(name).trim()}`
      );
      res.status(201).json({ templates: updatedStore });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur sauvegarde type de bien' });
    }
  });

  app.delete('/api/property-types/:id', async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const updatedStore = deletePropertyTypeEntry(id);
      await broadcastRealtimeState(`Type de bien supprimé : ${id}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur suppression type de bien' });
    }
  });

  /**
   * 2f. Identification de la Société de Gestion (En-tête officiel de tous les documents PDF)
   */
  app.put('/api/management-company', async (req, res) => {
    try {
      const payload = req.body || {};
      if (!payload.companyName || !String(payload.companyName).trim()) {
        return res
          .status(400)
          .json({ error: 'La raison sociale de la société de gestion est requise' });
      }
      const updatedStore = saveManagementCompanyEntry(payload);
      await broadcastRealtimeState(
        `Société de gestion mise à jour : ${String(payload.companyName).trim()}`
      );
      res.json({ templates: updatedStore });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur sauvegarde société de gestion' });
    }
  });

  /**
   * 2g. Système SaaS Multi-Agences & Super Admin (Agences clientes & Utilisateurs RBAC)
   */
  app.post('/api/saas/tenants', async (req, res) => {
    try {
      const payload = req.body || {};
      if (!payload.companyName || !String(payload.companyName).trim()) {
        return res
          .status(400)
          .json({ error: 'Le nom de la société/agence SaaS est requis' });
      }
      const updatedStore = upsertSaaSTenantEntry(payload);
      await broadcastRealtimeState(
        `Agence SaaS enregistrée : ${String(payload.companyName).trim()}`
      );
      res.status(201).json({ templates: updatedStore });
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || 'Erreur sauvegarde agence SaaS' });
    }
  });

  app.delete('/api/saas/tenants/:id', async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const updatedStore = deleteSaaSTenantEntry(id);
      await broadcastRealtimeState(`Agence SaaS supprimée : ${id}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur suppression agence SaaS' });
    }
  });

  app.post('/api/saas/users', async (req, res) => {
    try {
      const payload = req.body || {};
      if (!payload.email || !payload.fullName) {
        return res
          .status(400)
          .json({ error: 'Le nom complet et l’email de l’utilisateur SaaS sont requis' });
      }
      const updatedStore = upsertSaaSUserEntry(payload);
      await broadcastRealtimeState(
        `Compte utilisateur SaaS mis à jour : ${String(payload.email).trim()}`
      );
      res.status(201).json({ templates: updatedStore });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur sauvegarde utilisateur SaaS' });
    }
  });

  app.delete('/api/saas/users/:id', async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const updatedStore = deleteSaaSUserEntry(id);
      await broadcastRealtimeState(`Compte utilisateur SaaS supprimé : ${id}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur suppression utilisateur SaaS' });
    }
  });

  /**
   * 3. ENDPOINT API : Génération du PDF de Quittance + Lien de partage WhatsApp Cloud API & wa.me
   */
  app.post('/api/receipts/:paymentId/whatsapp-share', async (req, res) => {
    try {
      const paymentId = Number(req.params.paymentId);
      if (isNaN(paymentId)) {
        return res.status(400).json({ error: 'Identifiant de paiement invalide' });
      }

      const details = await getPaymentFullDetailsById(paymentId);
      if (!details) {
        return res.status(404).json({ error: 'Quittance introuvable' });
      }

      const { payment, landlord, property, tenant } = details;

      const baseUrl =
        process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')
          ? process.env.APP_URL.replace(/\/$/, '')
          : `${req.protocol}://${req.get('host')}`;

      const pdfUrl = `${baseUrl}/api/public/receipts/${payment.shareToken}/pdf`;
      const cleanPhone = tenant.phoneWhatsapp.replace(/[^0-9]/g, '');
      const amountFormatted = `${Number(payment.amountPaid || payment.amountDue).toLocaleString('fr-FR')} ${property.currency}`;

      const messageText = [
        `Bonjour ${tenant.firstName} ${tenant.lastName},`,
        ``,
        `Veuillez trouver ci-joint votre *Quittance de Loyer N° ${payment.receiptNumber}* pour la période de *${payment.periodLabel}*.`,
        `• Bien : ${property.title} (${property.neighborhood})`,
        `• Bailleur : ${landlord.companyName || landlord.fullName}`,
        `• Montant quittancé : *${amountFormatted}*`,
        ``,
        `📄 Télécharger votre quittance PDF officielle :`,
        pdfUrl,
        ``,
        `Cordialement,`,
        `La Gestion Locative Gimmo`,
      ].join('\n');

      const whatsappClickToChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

      const cloudApiPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'document',
        document: {
          link: pdfUrl,
          caption: `Quittance de loyer ${payment.receiptNumber} - ${payment.periodLabel} (${amountFormatted})`,
          filename: `Quittance_${payment.receiptNumber}.pdf`,
        },
      };

      let cloudApiStatus: 'sent_via_cloud_api' | 'ready_via_share_link' =
        'ready_via_share_link';

      const waToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
      const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (waToken && waPhoneId) {
        const waResponse = await fetch(
          `https://graph.facebook.com/v21.0/${waPhoneId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(cloudApiPayload),
          }
        );
        if (waResponse.ok) {
          cloudApiStatus = 'sent_via_cloud_api';
        }
      }

      await markWhatsappSent(paymentId);
      await broadcastRealtimeState(`Quittance ${payment.receiptNumber} partagée sur WhatsApp`);

      return res.json({
        success: true,
        receiptNumber: payment.receiptNumber,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        phoneWhatsapp: tenant.phoneWhatsapp,
        pdfUrl,
        whatsappShareUrl: whatsappClickToChatUrl,
        cloudApiStatus,
        cloudApiPayload,
      });
    } catch (error: any) {
      console.error('WhatsApp share generation error:', error);
      return res.status(500).json({
        error: error.message || 'Erreur lors de la génération du lien WhatsApp',
      });
    }
  });

  /**
   * 4. ENDPOINT API : Génération du lien WhatsApp pour un Contrat de Bail PDF
   */
  app.post('/api/leases/:leaseId/whatsapp-share', async (req, res) => {
    try {
      const leaseId = Number(req.params.leaseId);
      const details = await getLeaseFullDetailsById(leaseId);
      if (!details) {
        return res.status(404).json({ error: 'Contrat de bail introuvable' });
      }

      const { lease, landlord, property, tenant } = details;
      const baseUrl =
        process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')
          ? process.env.APP_URL.replace(/\/$/, '')
          : `${req.protocol}://${req.get('host')}`;

      const pdfUrl = `${baseUrl}/api/public/leases/${lease.shareToken}/pdf`;
      const cleanPhone = tenant.phoneWhatsapp.replace(/[^0-9]/g, '');

      const messageText = [
        `Bonjour ${tenant.firstName} ${tenant.lastName},`,
        ``,
        `Votre *Contrat de Bail Locatif N° ${lease.contractNumber}* (${landlord.companyName || landlord.fullName}) concernant le bien *${property.title}* est disponible en PDF :`,
        pdfUrl,
        ``,
        `Cordialement,`,
        `Gimmo SaaS`,
      ].join('\n');

      const whatsappShareUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

      return res.json({
        success: true,
        contractNumber: lease.contractNumber,
        pdfUrl,
        whatsappShareUrl,
      });
    } catch (error: any) {
      console.error('Lease WhatsApp share error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * 5. ENDPOINT PUBLIC : Streaming PDF de la Quittance de Loyer (par shareToken)
   */
  app.get('/api/public/receipts/:shareToken/pdf', async (req, res) => {
    try {
      const details = await getPaymentFullDetailsByToken(req.params.shareToken);
      if (!details) {
        return res.status(404).send('Quittance introuvable ou lien expiré.');
      }
      const download = req.query.download === '1';
      streamReceiptPdf(res, details, !download);
    } catch (error) {
      console.error('Error streaming receipt PDF:', error);
      res.status(500).send('Erreur lors de la génération du PDF de quittance.');
    }
  });

  /**
   * 6. ENDPOINT PUBLIC : Streaming PDF du Contrat de Bail personnalisé (par shareToken)
   */
  app.get('/api/public/leases/:shareToken/pdf', async (req, res) => {
    try {
      const details = await getLeaseFullDetailsByToken(req.params.shareToken);
      if (!details) {
        return res.status(404).send('Contrat de bail introuvable.');
      }
      const download = req.query.download === '1';
      streamLeaseContractPdf(res, details, !download);
    } catch (error) {
      console.error('Error streaming lease PDF:', error);
      res.status(500).send('Erreur lors de la génération du PDF du contrat.');
    }
  });

  /**
   * 7. Encaissement d'un loyer & génération immédiate de la quittance
   */
  app.post('/api/payments/:paymentId/settle', async (req, res) => {
    try {
      const paymentId = Number(req.params.paymentId);
      const { paymentMethod } = req.body || {};
      const updated = await markPaymentAsPaid(paymentId, paymentMethod || 'Mobile Money');
      await broadcastRealtimeState(`Quittance ${updated.receiptNumber} encaissée`);
      res.json({ payment: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Échec de l’encaissement' });
    }
  });

  /**
   * 8. Création d'un nouveau Bien Immobilier géolocalisé (PostGIS)
   */
  app.post('/api/properties', async (req, res) => {
    try {
      const created = await createPropertyRecord({
        userId: 'global_demo',
        ...req.body,
      });
      await broadcastRealtimeState(`Bien ajouté : ${created.reference}`);
      res.status(201).json({ property: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur création bien' });
    }
  });

  /**
   * 9. Création d'un nouveau Bailleur
   */
  app.post('/api/landlords', async (req, res) => {
    try {
      const created = await createLandlordRecord({
        userId: 'global_demo',
        ...req.body,
      });
      await broadcastRealtimeState(`Bailleur ajouté : ${created.companyName || created.fullName}`);
      res.status(201).json({ landlord: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur création bailleur' });
    }
  });

  /**
   * 10. Création d'un Locataire + Contrat de Bail + 1ère Quittance
   */
  app.post('/api/tenants-leases', async (req, res) => {
    try {
      const created = await createTenantAndLeaseRecord({
        userId: 'global_demo',
        ...req.body,
      });
      await broadcastRealtimeState(`Nouveau bail créé : ${created.lease.contractNumber}`);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur création dossier locataire' });
    }
  });

  /**
   * 11. Modification d'un Bien Immobilier géolocalisé (PostGIS)
   */
  app.put('/api/properties/:id', async (req, res) => {
    try {
      const propertyId = Number(req.params.id);
      const updated = await updatePropertyRecord(propertyId, req.body);
      await broadcastRealtimeState(`Bien mis à jour : ${updated.reference}`);
      res.json({ property: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur modification bien' });
    }
  });

  /**
   * 12. Modification d'un Bailleur
   */
  app.put('/api/landlords/:id', async (req, res) => {
    try {
      const landlordId = Number(req.params.id);
      const updated = await updateLandlordRecord(landlordId, req.body);
      await broadcastRealtimeState(`Bailleur mis à jour : ${updated.companyName || updated.fullName}`);
      res.json({ landlord: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur modification bailleur' });
    }
  });

  /**
   * 13. Modification d'un Dossier Locataire & Contrat de Bail
   */
  app.put('/api/tenants-leases/:leaseId', async (req, res) => {
    try {
      const leaseId = Number(req.params.leaseId);
      const updated = await updateTenantAndLeaseRecord(leaseId, req.body);
      await broadcastRealtimeState(`Contrat mis à jour : ${updated.lease.contractNumber}`);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur modification dossier locataire' });
    }
  });

  /**
   * 14. Modification d'une Quittance / Paiement
   */
  app.put('/api/payments/:id', async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const updated = await updatePaymentRecord(paymentId, req.body);
      await broadcastRealtimeState(`Quittance mise à jour : ${updated.receiptNumber}`);
      res.json({ payment: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur modification quittance' });
    }
  });

  /**
   * 15. Création manuelle d'une Quittance de Loyer
   */
  app.post('/api/payments', async (req, res) => {
    try {
      const created = await createPaymentRecord({
        userId: 'global_demo',
        ...req.body,
      });
      await broadcastRealtimeState(`Nouvelle quittance émise : ${created.receiptNumber}`);
      res.status(201).json({ payment: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur création quittance' });
    }
  });

  /**
   * 15b. Suppression de données dans les tableaux (Biens, Bailleurs, Baux/Locataires, Quittances, Mois Comptables)
   */
  app.delete('/api/properties/:id', async (req, res) => {
    try {
      const propertyId = Number(req.params.id);
      const deleted = await deletePropertyRecord(propertyId);
      await broadcastRealtimeState(
        `Bien supprimé : ${deleted?.reference || `#${propertyId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur suppression bien' });
    }
  });

  app.delete('/api/landlords/:id', async (req, res) => {
    try {
      const landlordId = Number(req.params.id);
      const deleted = await deleteLandlordRecord(landlordId);
      await broadcastRealtimeState(
        `Bailleur supprimé : ${deleted?.companyName || deleted?.fullName || `#${landlordId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur suppression bailleur' });
    }
  });

  app.delete('/api/tenants-leases/:leaseId', async (req, res) => {
    try {
      const leaseId = Number(req.params.leaseId);
      const deleted = await deleteLeaseRecord(leaseId);
      await broadcastRealtimeState(
        `Contrat de bail supprimé : ${deleted?.contractNumber || `#${leaseId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur suppression contrat' });
    }
  });

  app.delete('/api/payments/:id', async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const deleted = await deletePaymentRecord(paymentId);
      await broadcastRealtimeState(
        `Quittance supprimée : ${deleted?.receiptNumber || `#${paymentId}`}`
      );
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erreur suppression quittance' });
    }
  });

  app.delete('/api/accounting-months/:periodMonth', async (req, res) => {
    try {
      const periodMonth = decodeURIComponent(req.params.periodMonth);
      const updatedStore = deleteAccountingMonthEntry(periodMonth);
      await broadcastRealtimeState(`Mois comptable supprimé : ${periodMonth}`);
      res.json({ success: true, templates: updatedStore });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Erreur suppression mois comptable' });
    }
  });

  /**
   * 16. ENDPOINT PUBLIC : Génération et impression PDF du Rapport Financier
   */
  app.get('/api/public/reports/financial/pdf', async (req, res) => {
    try {
      const data = await getAllDashboardData();
      const granularity =
        req.query.granularity === 'daily' || req.query.granularity === 'annual'
          ? req.query.granularity
          : 'monthly';
      const landlordId =
        req.query.landlordId && req.query.landlordId !== 'all'
          ? Number(req.query.landlordId)
          : 'all';
      const download = req.query.download === '1';

      streamFinancialReportPdf(
        res,
        {
          granularity,
          landlordId,
          ...data,
        },
        !download
      );
    } catch (error) {
      console.error('Error streaming financial report PDF:', error);
      res.status(500).send('Erreur lors de la génération du rapport financier PDF.');
    }
  });

  /**
   * 17. ENDPOINT PUBLIC : Génération et exportation PDF du Guide d'Utilisation du logiciel
   */
  app.get('/api/public/user-guide/pdf', (req, res) => {
    try {
      const download = req.query.download === '1';
      streamUserGuidePdf(res, !download);
    } catch (error) {
      console.error('Error streaming user guide PDF:', error);
      res.status(500).send("Erreur lors de la génération du guide d'utilisation PDF.");
    }
  });

  // Montage Vite en développement ou fichiers statiques en production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Gimmo SaaS Server (HTTP + WebSocket Real-Time Sync) running on http://localhost:${PORT}`
    );
  });
}

startServer();
