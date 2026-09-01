import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { listUsuarios } from "@/lib/actions/usuarios";
import { UsuariosClient } from "./usuarios-client";

export const metadata: Metadata = { title: "Usuarios — Pacho Motos" };

export default async function UsuariosPage() {
  await requireRole("administrador");
  const usuarios = await listUsuarios();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Usuarios
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Crea cuentas para el personal. Cada usuario inicia sesión con su
          correo y contraseña.
        </p>
      </div>

      <UsuariosClient usuarios={usuarios} />
    </div>
  );
}