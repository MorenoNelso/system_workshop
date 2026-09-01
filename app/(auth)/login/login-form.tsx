"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login, verificarMfa, type LoginState } from "@/lib/actions/auth";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:opacity-60";

export function LoginForm({
  redirectTo,
  initialMfa,
}: {
  redirectTo: string;
  initialMfa: boolean;
}) {
  const [passwordState, passwordAction, passwordPending] = useActionState<
    LoginState,
    FormData
  >(login, undefined);
  const [mfaState, mfaAction, mfaPending] = useActionState<LoginState, FormData>(
    verificarMfa,
    undefined,
  );

  const showMfa = initialMfa || passwordState?.mfa === true;

  if (showMfa) {
    return (
      <form action={mfaAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="redirect" value={redirectTo} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mfa-code" className="text-sm font-medium text-zinc-800">
            Código de autenticación
          </label>
          <input
            id="mfa-code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            required
            disabled={mfaPending}
            placeholder="123456"
            className={`${inputClass} text-center tracking-[0.4em]`}
          />
        </div>

        {mfaState?.message ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {mfaState.message}
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={mfaPending}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mfaPending ? "Verificando…" : "Verificar"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={passwordAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="redirect" value={redirectTo} />

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
          disabled={passwordPending}
          aria-invalid={Boolean(passwordState?.errors?.email)}
          aria-describedby={
            passwordState?.errors?.email ? "email-error" : undefined
          }
          className={inputClass}
          placeholder="tu@correo.com"
        />
        {passwordState?.errors?.email?.[0] ? (
          <p id="email-error" className="text-xs text-red-600">
            {passwordState.errors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-zinc-800">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={passwordPending}
          aria-invalid={Boolean(passwordState?.errors?.password)}
          aria-describedby={
            passwordState?.errors?.password ? "password-error" : undefined
          }
          className={inputClass}
          placeholder="••••••••"
        />
        {passwordState?.errors?.password?.[0] ? (
          <p id="password-error" className="text-xs text-red-600">
            {passwordState.errors.password[0]}
          </p>
        ) : null}
      </div>

      {passwordState?.message ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {passwordState.message}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-end">
        <button
          type="submit"
          disabled={passwordPending}
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {passwordPending ? "Entrando…" : "Entrar"}
        </button>
      </div>

      <div className="mt-1 text-center">
        <Link
          href="/recuperar"
          className="text-xs text-zinc-500 underline-offset-4 hover:text-brand-700 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </form>
  );
}