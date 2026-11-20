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

function computeSnapshotSignature(data: RealtimeStatePayload['data']): string {
  try {
    return JSON.stringify({
      l: data.landlords || [],
      p: data.properties || [],
      t: data.tenants || [],
      le: data.leases || [],
      pa: data.payments || [],
      tpl: data.templates || null,
    });
  } catch {
    return String(Date.now());
  }
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
  const isPollingRef = useRef(false);
  const lastPollAtRef = useRef(0);
  const lastSignatureRef = useRef<string>('');
  const connectedPeersRef = useRef<number>(1);
  const onStateReceivedRef = useRef(onStateReceived);
  const onQueueSyncedRef = useRef(onQueueSynced);

  useEffect(() => {
    onStateReceivedRef.current = onStateReceived;
  }, [onStateReceived]);

  useEffect(() => {
    onQueueSyncedRef.current = onQueueSynced;
  }, [onQueueSynced]);

  const applyIncomingStateIfChanged = useCallback(
    (
      data: RealtimeStatePayload['data'],
      meta: { action: string; timestamp: string; connectedClients: number }
    ) => {
      const nextSig = computeSnapshotSignature(data);
      if (nextSig === lastSignatureRef.current) {
        return false;
      }
      lastSignatureRef.current = nextSig;
      saveOfflineSnapshot(data);
      connectedPeersRef.current = meta.connectedClients || 1;
      setConnectedPeers(meta.connectedClients || 1);
      setLastRealtimeAction(meta.action);
      onStateReceivedRef.current(data, meta);
      return true;
    },
    []
  );

  // Vide automatiquement la file d'attente hors-ligne en arrière-plan vers Supabase
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
        onQueueSyncedRef.current();
        if (result.data) {
          const saved = saveOfflineSnapshot(result.data);
          const nowStr = saved.lastSyncedAt;
          lastSignatureRef.current = computeSnapshotSignature(result.data);
          setLastRealtimeAction(
            `Synchronisé (${queue.length} modif. hors-ligne)`
          );
          onStateReceivedRef.current(result.data, {
            action: `Synchronisé (${queue.length} modif.)`,
            timestamp: nowStr,
            connectedClients: connectedPeersRef.current,
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
  }, [enabled]);

  // Rafraîchissement silencieux en arrière-plan (ne déclenche aucun rendu si les données n'ont pas changé)
  const pollOverviewSilently = useCallback(
    async (reason: string, minThrottleMs = 2500) => {
      if (
        !enabled ||
        !navigator.onLine ||
        isPollingRef.current ||
        isFlushingRef.current
      ) {
        return;
      }
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastPollAtRef.current < minThrottleMs) {
        return;
      }

      isPollingRef.current = true;
      lastPollAtRef.current = now;
      try {
        // S'il y a des modifications hors-ligne en attente, on les pousse d'abord avant de lire
        if (getOfflineQueue().length > 0) {
          await flushOfflineQueueInBackground();
          return;
        }

        const res = await fetch('/api/gimmo/overview', {
          cache: 'no-store',
          priority: 'low',
        } as RequestInit);
        if (!res.ok) return;
        const parsed = await parseJsonResponseSafely<any>(res);
        if (!parsed.isJson || !parsed.data) return;

        setRealtimeStatus('connected');
        const changed = applyIncomingStateIfChanged(parsed.data, {
          action: reason,
          timestamp: new Date().toISOString(),
          connectedClients: connectedPeersRef.current,
        });
        if (changed) {
          channelRef.current?.postMessage({
            type: 'gimmo:tab_sync',
            action: reason,
            timestamp: new Date().toISOString(),
            data: parsed.data,
          });
        }
      } catch {
        // Silencieux : ne perturbe jamais l'utilisation en cas de micro-coupure réseau
      } finally {
        isPollingRef.current = false;
      }
    },
    [enabled, flushOfflineQueueInBackground, applyIncomingStateIfChanged]
  );

  // Synchronisation inter-onglets instantanée via BroadcastChannel (0ms)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('gimmo_realtime_channel');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg?.type === 'gimmo:tab_sync' && msg.data) {
        applyIncomingStateIfChanged(msg.data, {
          action: msg.action || 'Mise à jour multi-onglets',
          timestamp: msg.timestamp || new Date().toISOString(),
          connectedClients: connectedPeersRef.current,
        });
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [applyIncomingStateIfChanged]);

  // Synchronisation adaptative : WebSocket/SSE (Node/Cloud Run) ou Polling Silencieux Intelligent (Vercel Serverless)
  useEffect(() => {
    if (!enabled) {
      setRealtimeStatus('paused');
      wsRef.current?.close();
      sseRef.current?.close();
      wsRef.current = null;
      sseRef.current = null;
      return;
    }

    let isUnmounted = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let activeMode: 'ws' | 'polling' = 'polling';

    const startSilentBackgroundPolling = (intervalMs = 10000) => {
      if (isUnmounted || pollTimer) return;
      activeMode = 'polling';
      setRealtimeStatus('connected');
      flushOfflineQueueInBackground();
      pollTimer = setInterval(() => {
        if (!isUnmounted) {
          void pollOverviewSilently('Synchronisation temps réel');
        }
      }, Math.max(5000, intervalMs));
    };

    const handleIncomingPayload = (rawText: string) => {
      try {
        const parsed = JSON.parse(rawText) as RealtimeStatePayload;
        if (parsed.type === 'gimmo:state_updated' && parsed.data) {
          applyIncomingStateIfChanged(parsed.data, {
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
          // Fermer immédiatement l'EventSource pour éviter les boucles d'erreurs sur Serverless (204)
          es.close();
          sseRef.current = null;
          startSilentBackgroundPolling(10000);
        };
      } catch {
        startSilentBackgroundPolling(10000);
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
          activeMode = 'ws';
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
          wsRef.current = null;
          if (!sseRef.current && !pollTimer) {
            connectSseFallback();
          }
        };
      } catch {
        connectSseFallback();
      }
    };

    const initRealtimeTransport = async () => {
      try {
        const res = await fetch('/api/realtime/mode', { cache: 'no-store' });
        if (isUnmounted) return;
        if (res.ok) {
          const parsed = await parseJsonResponseSafely<{
            mode?: 'ws' | 'polling';
            intervalMs?: number;
          }>(res);
          if (parsed.isJson && parsed.data?.mode === 'polling') {
            startSilentBackgroundPolling(parsed.data.intervalMs || 10000);
            return;
          }
          if (parsed.isJson && parsed.data?.mode === 'ws') {
            connectWebSocket();
            return;
          }
        }
      } catch {
        // En cas d'échec de détection, utiliser le polling silencieux sans erreur console
      }
      if (!isUnmounted) {
        startSilentBackgroundPolling(10000);
      }
    };

    void initRealtimeTransport();

    // Écouteurs d'événements navigateur (retour réseau, reprise du focus de l'application)
    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void flushOfflineQueueInBackground();
        if (activeMode === 'ws' && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'client:request_sync' }));
        } else {
          void pollOverviewSilently('Synchronisation au retour sur l’onglet', 3000);
        }
      }
    };

    window.addEventListener('online', handleVisibilityOrOnline);
    window.addEventListener('focus', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      isUnmounted = true;
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener('online', handleVisibilityOrOnline);
      window.removeEventListener('focus', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      wsRef.current?.close();
      sseRef.current?.close();
      wsRef.current = null;
      sseRef.current = null;
    };
  }, [
    enabled,
    flushOfflineQueueInBackground,
    pollOverviewSilently,
    applyIncomingStateIfChanged,
  ]);

  const broadcastTabUpdate = useCallback(
    (action: string, data: RealtimeStatePayload['data']) => {
      lastSignatureRef.current = computeSnapshotSignature(data);
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
