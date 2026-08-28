import type { Metadata } from "next";

import { getAuthState } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Taller",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const search = await props.searchParams;
  const redirectParam = search?.redirect;
  const redirectTo =
    typeof redirectParam === "string" && redirectParam.startsWith("/")
      ? redirectParam
      : "/";

  // Si llegó con sesión débil (2FA pendiente), el proxy lo redirige aquí.
  const authState = await getAuthState();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Acento rosa discreto: borde superior */}
        <div className="h-1 w-full bg-pink-400" aria-hidden="true" />

        <div className="px-8 pb-8 pt-6">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white"
              aria-hidden="true"
            >
              TM
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              Taller de Motos
            </h1>
            <p className="text-sm text-zinc-500">
              {authState.status === "mfa_pending"
                ? "Verificación en dos pasos"
                : "Ingresa con tu correo y contraseña"}
            </p>
          </div>

          <LoginForm
            redirectTo={redirectTo}
            initialMfa={authState.status === "mfa_pending"}
          />
        </div>
      </div>
    </main>
  );
}