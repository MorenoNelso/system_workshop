import Link from "next/link";

import { logout } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth/session";

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
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              TM
            </span>
            Taller de Motos
          </Link>

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
        <nav className="mb-6 flex flex-wrap gap-2">
          {[
            { href: "/", label: "Inicio" },
            { href: "/ordenes", label: "Órdenes de Servicio" },
            { href: "/clientes", label: "Clientes" },
            { href: "/motos", label: "Motos" },
            { href: "/repuestos", label: "Repuestos" },
            { href: "/inventario", label: "Kardex / Stock" },
            { href: "/categorias", label: "Categorías" },
            { href: "/proveedores", label: "Proveedores" },
            { href: "/empleados", label: "Empleados / Mecánicos" },
            ...(user.rol === "administrador"
              ? [{ href: "/seguridad", label: "Seguridad" }]
              : []),
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}
