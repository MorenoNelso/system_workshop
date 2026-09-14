"use client";

import { useSyncExternalStore } from "react";

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

/**
 * Muestra un banner cuando no hay conexión a internet.
 * El registro del service worker lo maneja SerwistProvider.
 */
export function PwaOfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isOffline = !isOnline;

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="sticky top-14 z-20 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800"
    >
      Sin conexión a internet. Puedes seguir trabajando; las facturas se
      guardarán y se sincronizarán cuando vuelva la conexión.
    </div>
  );
}