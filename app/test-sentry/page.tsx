"use client";

import * as Sentry from "@sentry/nextjs";

export default function TestSentryPage() {
  function throwError() {
    try {
      throw new Error("Error de prueba desde Pacho Motos — Sentry connection test OK");
    } catch (e) {
      Sentry.captureException(e);
      alert("Error enviado a Sentry. Revisa tu dashboard.");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Test Sentry</h1>
        <p className="text-sm text-zinc-500">Presiona el botón para enviar un error de prueba.</p>
        <button
          type="button"
          onClick={throwError}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98] hover:bg-red-700"
        >
          Enviar error de prueba
        </button>
        <button
          type="button"
          onClick={() => {
            Sentry.captureMessage("Mensaje de prueba desde Pacho Motos", "info");
            alert("Mensaje enviado a Sentry");
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98] hover:bg-brand-700"
        >
          Enviar mensaje de prueba
        </button>
      </div>
    </div>
  );
}
