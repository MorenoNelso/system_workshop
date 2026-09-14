import Link from "next/link";

import { NavMenu } from "@/components/nav/menu";
import { OfflineProvider } from "@/components/pwa/offline-provider";
import { logout } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth/session";
import { getConfiguracion } from "@/lib/actions/config";

// Cache Components: el layout lee cookies (sesión), se opta out de la
// validación de render estático y bloquea en el servidor (navegación segura).
export const instant = false;

/**
 * Layout de todas las rutas autenticadas del taller.
 *
 * Ejecuta `requireUser()` para asegurar sesión válida y rol en `usuarios`.
 * El proxy raíz (`proxy.ts`) ya redirige al no autenticado, este check es
 * la segunda barrera (defense-in-depth) y trae los datos del usuario.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireUser();

  let config;
  try {
    config = await getConfiguracion();
  } catch {
    // Fallback offline: configuración por defecto
    config = {
      nombre_taller: "Pacho Motos",
      logo_url: null,
      logo_principal_url: null,
      logo_login_url: null,
      logo_watermark_url: null,
    };
  }

  const iniciales = user.nombre
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              prefetch
              className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900"
            >
              {config.logo_principal_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.logo_principal_url}
                  alt={config.nombre_taller}
                  className="h-12 w-auto"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {config.nombre_taller.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="hidden sm:inline">{config.nombre_taller}</span>
            </Link>

            <NavMenu esAdmin={user.rol === "administrador"} />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-zinc-900">
                {user.nombre}
              </p>
              <p className="text-xs capitalize leading-tight text-zinc-500">
                {user.rol}
              </p>
            </div>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700"
              aria-hidden="true"
            >
              {iniciales || "?"}
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition active:scale-[0.98] hover:border-zinc-400 hover:bg-zinc-50"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <OfflineProvider>{children}</OfflineProvider>
      </main>
    </div>
  );
}
