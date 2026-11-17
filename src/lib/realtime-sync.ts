import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Landlord,
  Property,
  Tenant,
  Lease,
  Payment,
} from '../types/gimmo.ts';
import {
  saveOfflineSnapshot,
  getOfflineQueue,
  clearOfflineQueue,
} from './offline-manager.ts';
import { DocumentTemplatesStore } from './document-templates.ts';
import { parseJsonResponseSafely } from './landlord-portal.ts';

export interface RealtimeStatePayload {
  type: 'gimmo:state_updated';
  action: string;
  timestamp: string;
  connectedClients: number;
  data: {
    landlords: Landlord[];
    properties: Property[];
    tenants: Tenant[];
    leases: Lease[];
    payments: Payment[];
    templates?: DocumentTemplatesStore;
  };
}

interface UseRealtimeSyncOptions {
  enabled: boolean;
  onStateReceived: (
    data: RealtimeStatePayload['data'],
    meta: { action: string; timestamp: string; connectedClients: number }
  ) => void;
  onQueueSynced: () => void;
}

export function useRealtimeBackgroundSync({
  enabled,
  onStateReceived,
  onQueueSynced,
}: UseRealtimeSyncOptions) {
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connected' | 'reconnecting' | 'paused'
  >('reconnecting');
  const [connectedPeers, setConnectedPeers] = useState<number>(1);
  const [lastRealtimeAction, setLastRealtimeAction] = useState<string | null>(
    null
  );

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isFlushingRef = useRef(false);

  // Vide automatiquement la file d'attente hors-ligne en arrière-plan vers PostgreSQL
  const flushOfflineQueueInBackground = useCallback(async (): Promise<boolean> => {
    if (!enabled || !navigator.onLine || isFlushingRef.current) return false;
    const queue = getOfflineQueue();
    if (queue.length === 0) return true;

    isFlushingRef.current = true;
    try {
      const res = await fetch('/api/gimmo/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: queue }),
      });

      if (res.ok) {
        const parsed = await parseJsonResponseSafely<any>(res);
        if (!parsed.isJson || !parsed.data) {
          return false;
        }
        const result = parsed.data;
        clearOfflineQueue();
        onQueueSynced();
        if (result.data) {
          const saved = saveOfflineSnapshot(result.data);
          const nowStr = saved.lastSyncedAt;
          setLastRealtimeAction(
            `Synchronisé (${queue.length} modif. hors-ligne)`
          );
          onStateReceived(result.data, {
            action: `Synchronisé (${queue.length} modif.)`,
            timestamp: nowStr,
            connectedClients: connectedPeers,
          });
          channelRef.current?.postMessage({
            type: 'gimmo:tab_sync',
            action: `Synchronisé (${queue.length} modif.)`,
            timestamp: nowStr,
            data: result.data,
          });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Background batch sync deferred:', err);
      return false;
    } finally {
      isFlushingRef.current = false;
    }
  }, [enabled, onQueueSynced, onStateReceived, connectedPeers]);

  // Synchronisation inter-onglets instantanée via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('gimmo_realtime_channel');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg?.type === 'gimmo:tab_sync' && msg.data) {
        saveOfflineSnapshot(msg.data);
        setLastRealtimeAction(msg.action || 'Mise à jour multi-onglets');
        onStateReceived(msg.data, {
          action: msg.action || 'Mise à jour multi-onglets',
          timestamp: msg.timestamp || new Date().toISOString(),
          connectedClients: connectedPeers,
        });
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [onStateReceived, connectedPeers]);

  // Connexion WebSocket Temps Réel + Repli SSE automatique en arrière-plan
  useEffect(() => {
    if (!enabled) {
      setRealtimeStatus('paused');
      wsRef.current?.close();
      sseRef.current?.close();
      return;
    }

    let isUnmounted = false;
    let reconnectCount = 0;

    const handleIncomingPayload = (rawText: string) => {
      try {
        const parsed = JSON.parse(rawText) as RealtimeStatePayload;
        if (parsed.type === 'gimmo:state_updated' && parsed.data) {
          saveOfflineSnapshot(parsed.data);
          setConnectedPeers(parsed.connectedClients || 1);
          setLastRealtimeAction(parsed.action);
          onStateReceived(parsed.data, {
            action: parsed.action,
            timestamp: parsed.timestamp,
            connectedClients: parsed.connectedClients || 1,
          });
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    const connectSseFallback = () => {
      if (isUnmounted || sseRef.current) return;
      try {
        const es = new EventSource('/api/realtime/events');
        sseRef.current = es;

        es.onopen = () => {
          if (isUnmounted) return;
          setRealtimeStatus('connected');
          flushOfflineQueueInBackground();
        };

        es.onmessage = (event) => {
          if (isUnmounted) return;
          handleIncomingPayload(event.data);
        };

        es.onerror = () => {
          if (isUnmounted) return;
          setRealtimeStatus('reconnecting');
        };
      } catch {
        // Ignore SSE errors
      }
    };

    const connectWebSocket = () => {
      if (isUnmounted) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/realtime/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          reconnectCount = 0;
          setRealtimeStatus('connected');
          flushOfflineQueueInBackground();
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          handleIncomingPayload(String(event.data));
        };

        ws.onerror = () => {
          if (isUnmounted) return;
          connectSseFallback();
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setRealtimeStatus('reconnecting');
          if (reconnectCount < 2) {
            reconnectCount += 1;
            connectSseFallback();
          }
        };
      } catch {
        connectSseFallback();
      }
    };

    connectWebSocket();

    // Écouteurs d'événements navigateur (retour réseau, reprise du focus de l'application)
    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        flushOfflineQueueInBackground();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'client:request_sync' }));
        }
      }
    };

    window.addEventListener('online', handleVisibilityOrOnline);
    window.addEventListener('focus', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      isUnmounted = true;
      window.removeEventListener('online', handleVisibilityOrOnline);
      window.removeEventListener('focus', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      wsRef.current?.close();
      sseRef.current?.close();
      wsRef.current = null;
      sseRef.current = null;
    };
  }, [enabled, onStateReceived, flushOfflineQueueInBackground]);

  const broadcastTabUpdate = useCallback(
    (action: string, data: RealtimeStatePayload['data']) => {
      channelRef.current?.postMessage({
        type: 'gimmo:tab_sync',
        action,
        timestamp: new Date().toISOString(),
        data,
      });
    },
    []
  );

  return {
    realtimeStatus,
    connectedPeers,
    lastRealtimeAction,
    flushOfflineQueueInBackground,
    broadcastTabUpdate,
  };
}
