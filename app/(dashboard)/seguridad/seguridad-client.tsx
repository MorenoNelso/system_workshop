"use client";

import { useState } from "react";

import {
  confirmarEnroll,
  desactivarTotp,
  enrollTotp,
} from "@/lib/actions/auth";

export function SeguridadClient({ totpActive }: { totpActive: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [enabled, setEnabled] = useState(totpActive);
  const [qr, setQr] = useState<{ factorId: string; qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function startEnroll() {
    setStatus("loading");
    setError(null);
    const res = await enrollTotp();
    setStatus("idle");
    if (!res.ok) return setError(res.error);
    setQr({ factorId: res.factorId, qrDataUrl: res.qrDataUrl, secret: res.secret });
    setCode("");
  }

  async function confirmEnroll() {
    if (!qr) return;
    setStatus("loading");
    setError(null);
    const res = await confirmarEnroll(qr.factorId, code);
    setStatus("idle");
    if (!res.ok) return setError(res.error ?? "No se pudo verificar el código.");
    setQr(null);
    setEnabled(true);
  }

  async function disable() {
    setStatus("loading");
    setError(null);
    const res = await desactivarTotp();
    setStatus("idle");
    if (!res.ok) return setError(res.error ?? "No se pudo desactivar el 2FA.");
    setEnabled(false);
  }

  if (qr) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">
          Escanea el código QR con tu app de autenticación (Google
          Authenticator, Authy, 1Password…).
        </p>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.qrDataUrl}
            alt="Código QR para configurar 2FA"
            width={200}
            height={200}
            className="rounded-lg border border-zinc-200"
          />
        </div>
        <p className="text-center text-xs text-zinc-500">
          Si no puedes escanearlo, ingresa manualmente:{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5">{qr.secret}</code>
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-sm font-medium text-zinc-800">
            Código de confirmación
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-sm tracking-[0.4em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={() => setQr(null)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={status === "loading" || code.length !== 6}
            onClick={confirmEnroll}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
          >
            {status === "loading" ? "Verificando…" : "Activar 2FA"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            Aplicación de autenticación (TOTP)
          </p>
          <p className="text-xs text-zinc-500">
            {enabled ? "Activo: se pedirá un código al iniciar sesión." : "Inactivo."}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            enabled
              ? "bg-emerald-100 text-emerald-700"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {enabled ? "Activado" : "Desactivado"}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
        {enabled ? (
          <button
            type="button"
            disabled={status === "loading"}
            onClick={disable}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-60"
          >
            {status === "loading" ? "Procesando…" : "Desactivar 2FA"}
          </button>
        ) : (
          <button
            type="button"
            disabled={status === "loading"}
            onClick={startEnroll}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
          >
            {status === "loading" ? "Procesando…" : "Configurar 2FA"}
          </button>
        )}
      </div>
    </div>
  );
}