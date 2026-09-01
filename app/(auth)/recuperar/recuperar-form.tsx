"use client";

import Link from "next/link";
import { useActionState } from "react";

import { solicitarRecuperacion, type RecuperarState } from "@/lib/actions/auth";

export function RecuperarForm() {
  const [state, formAction, pending] = useActionState<
    RecuperarState,
    FormData
  >(solicitarRecuperacion, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-zinc-800">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
          placeholder="tu@correo.com"
        />
      </div>

      {state?.message ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800"
        >
          <p>{state.message}</p>
          {state.email ? (
            <Link
              href={`/recuperar/codigo?email=${encodeURIComponent(state.email)}`}
              className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Ya tengo el código →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar código"}
        </button>
      </div>

      <div className="mt-1 text-center">
        <Link
          href="/login"
          className="text-xs text-zinc-500 underline-offset-4 hover:text-brand-700 hover:underline"
        >
          ← Volver al login
        </Link>
      </div>
    </form>
  );
}