import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { listLogs } from "@/lib/actions/auditoria";
import { createClient } from "@/lib/supabase/server";
import { AuditoriaView } from "@/components/auditoria/auditoria-view";

export const metadata: Metadata = { title: "Auditoría — Pacho Motos" };

export default async function AuditoriaPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("administrador");

  const search = await props.searchParams;
  const supabase = await createClient();

  const [{ data: usuarios }, result] = await Promise.all([
    supabase.from("usuarios").select("id, nombre").order("nombre"),
    listLogs({
      usuarioId: typeof search.usuario === "string" ? search.usuario : undefined,
      tabla: typeof search.tabla === "string" ? search.tabla : undefined,
      accion:
        typeof search.accion === "string" &&
        (search.accion === "insert" || search.accion === "update" || search.accion === "delete")
          ? search.accion
          : undefined,
      desde: typeof search.desde === "string" ? search.desde : undefined,
      hasta: typeof search.hasta === "string" ? search.hasta : undefined,
      pagina: typeof search.pagina === "string" ? Number(search.pagina) : undefined,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Auditoría
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Registro de las modificaciones hechas en el sistema (quién, qué y
          cuándo).
        </p>
      </div>

      <AuditoriaView
        logs={result.logs}
        total={result.total}
        pagina={result.pagina}
        totalPaginas={result.totalPaginas}
        usuarios={(usuarios ?? []) as { id: string; nombre: string }[]}
      />
    </div>
  );
}