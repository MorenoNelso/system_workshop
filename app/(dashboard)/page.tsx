import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  // El layout ya asegura sesión; getCurrentUser aquí solo lee de la caché.
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Bienvenido
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Hola, {user?.nombre.split(" ")[0]}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Rol actual: <span className="font-medium capitalize">{user?.rol}</span>
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Aquí irán las tarjetas del dashboard (clientes, órdenes, facturación…)
        en las siguientes fases.
      </section>
    </div>
  );
}
