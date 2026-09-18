import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { SeguridadClient } from "./seguridad-client";


export const instant = false;


export const metadata: Metadata = {
  title: "Seguridad — Pacho Motos",
};

export default async function SeguridadPage() {
  await requireRole("administrador");

  const supabase = await createClient();
  const { data } = await safeQuery(
    supabase.auth.mfa.listFactors() as Promise<{ data: { totp: { status: string }[] } | null }>,
    { data: { totp: [] } },
  );
  const totpActive = (data?.totp ?? []).some((f) => f.status === "verified");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Seguridad
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Verificación en dos pasos (2FA) de tu cuenta de administrador.
        </p>
      </div>

      <SeguridadClient totpActive={totpActive} />
    </div>
  );
}