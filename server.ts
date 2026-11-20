import express, { type Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initTemplatesStoreFromDb } from './src/services/pdf-generator.ts';
import {
  createGimmoApiApp,
  getDashboardDataWithTemplates,
} from './src/server/create-app.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  let broadcastRealtimeState: (action: string) => Promise<void> = async () => {};

  const app = createGimmoApiApp({
    onStateMutated: (action) => broadcastRealtimeState(action),
  });
  const httpServer = createHttpServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  await initTemplatesStoreFromDb();

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

  broadcastRealtimeState = async (action: string) => {
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
