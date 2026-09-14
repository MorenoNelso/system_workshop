"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  syncPendingActions,
  getPendingAndFailedActions,
  getPendingCount,
  type OfflineAction,
} from "@/lib/offline/queue";

const ACTION_LABELS: Record<string, string> = {
  createFactura: "Factura (desde orden)",
  createFacturaDirecta: "Venta directa",
  createCliente: "Cliente",
  registrarPago: "Pago",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineQueue() {
  const [count, setCount] = useState(0);
  const [actions, setActions] = useState<OfflineAction[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const pendingCount = actions.filter((a) => a.status === "pending").length;
  const failedCount = actions.filter((a) => a.status === "failed").length;

  useEffect(() => {
    let mounted = true;
    
    async function load() {
      const c = await getPendingCount();
      if (!mounted) return;
      setCount(c);
      if (expanded) {
        const list = await getPendingAndFailedActions();
        if (mounted) setActions(list);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    
    function handleOnline() {
      load();
      // Auto-sincronizar al reconectar
      getPendingCount().then((c) => {
        if (c > 0) syncPendingActions().then(() => { if (mounted) load(); });
      });
    }
    window.addEventListener("online", handleOnline);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, [expanded]);

  async function handleSync() {
    setSyncing(true);
    setLastResult(null);
    const result = await syncPendingActions();
    setSyncing(false);

    if (result.synced > 0 && result.failed === 0) {
      setLastResult(`Sincronizadas: ${result.synced}`);
    } else if (result.synced > 0 && result.failed > 0) {
      setLastResult(`Sincronizadas: ${result.synced}, fallidas: ${result.failed}`);
    } else if (result.failed > 0) {
      setLastResult(`Fallidas: ${result.failed}. ${result.errors[0] ?? ""}`);
    } else {
      setLastResult("No hay acciones pendientes");
    }

    const c = await getPendingCount();
    setCount(c);
    if (expanded) {
      const list = await getPendingAndFailedActions();
      setActions(list);
    }
    setTimeout(() => setLastResult(null), 5000);
  }

  async function toggleExpanded() {
    if (!expanded) {
      const list = await getPendingAndFailedActions();
      setActions(list);
    }
    setExpanded(!expanded);
  }

  if (count === 0 && !lastResult) return null;

  const totalUI = pendingCount + failedCount;

  return (
    <div className="fixed bottom-4 right-4 z-30 max-w-sm">
      <div className="rounded-xl border border-zinc-200 bg-white shadow-lg">
        {/* Header */}
        <button
          onClick={toggleExpanded}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
            <span className="text-sm font-medium text-zinc-800">
              {totalUI} {totalUI === 1 ? "acción" : "acciones"} en cola
            </span>
            {failedCount > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                {failedCount} {failedCount === 1 ? "fallida" : "fallidas"}
              </span>
            )}
          </div>
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Lista expandida */}
        {expanded && (
          <div className="border-t border-zinc-100 px-4 pb-3">
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {actions.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    a.status === "failed"
                      ? "bg-red-50 border border-red-200"
                      : "bg-zinc-50"
                  }`}
                >
                  <div>
                    <span className="text-xs font-medium text-zinc-700">
                      {ACTION_LABELS[a.action] ?? a.action}
                    </span>
                    <span className="ml-2 text-xs text-zinc-400">
                      {formatTime(a.timestamp)}
                    </span>
                  </div>
                  {a.status === "failed" && (
                    <span className="text-xs text-red-500" title={a.error}>
                      Error
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Botón sincronizar */}
            <button
              onClick={handleSync}
              disabled={syncing || !isOnline}
              className="mt-3 w-full rounded-lg bg-[#1234ab] px-3 py-2 text-sm font-medium text-white hover:bg-[#0e2a8a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing
                ? "Sincronizando..."
                : !isOnline
                  ? "Sin conexión"
                  : "Sincronizar ahora"}
            </button>

            {lastResult && (
              <p className="mt-2 text-center text-xs text-zinc-500">
                {lastResult}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}