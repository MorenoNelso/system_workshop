"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  verificarCodigoRecuperacion,
  type RecuperarState,
} from "@/lib/actions/auth";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CodigoForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<
    RecuperarState,
    FormData
  >(verificarCodigoRecuperacion, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="email" value={email} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium text-zinc-800">
          Código de 6 dígitos
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          disabled={pending}
          placeholder="123456"
          className={`${inputClass} text-center tracking-[0.4em]`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-zinc-800">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          placeholder="Mínimo 10 caracteres"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-medium text-zinc-800">
          Confirmar contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          placeholder="Repite la contraseña"
          className={inputClass}
        />
      </div>

      {state?.message ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Verificando…" : "Restablecer contraseña"}
        </button>
      </div>

      <div className="mt-1 text-center">
        <Link
          href="/recuperar"
          className="text-xs text-zinc-500 underline-offset-4 hover:text-blue-700 hover:underline"
        >
          Solicitar otro código
        </Link>
      </div>
    </form>
  );
}