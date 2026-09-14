import type { Metadata } from "next";

import { getAuthState } from "@/lib/auth/session";
import { getConfiguracion } from "@/lib/actions/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Pacho Motos",
};

// Cache Components: lee el estado de sesión (cookies) en el servidor.
export const instant = false;

export default async function LoginPage(props: PageProps<"/login">) {
  const search = await props.searchParams;
  const redirectParam = search?.redirect;
  const redirectTo =
    typeof redirectParam === "string" && redirectParam.startsWith("/")
      ? redirectParam
      : "/";

  // Si llegó con sesión débil (2FA pendiente), el proxy lo redirige aquí.
  const authState = await getAuthState();
  const config = await getConfiguracion();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-brand-900 px-4 py-12">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="px-8 pb-8 pt-6">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            {config.logo_login_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logo_login_url}
                alt={config.nombre_taller}
                className="h-16 w-auto"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white"
                aria-hidden="true"
              >
                {config.nombre_taller.slice(0, 2).toUpperCase()}
              </div>
            )}
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              {config.nombre_taller}
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