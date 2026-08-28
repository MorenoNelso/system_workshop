import type { Metadata } from "next";

import { CodigoForm } from "./codigo-form";

export const metadata: Metadata = {
  title: "Ingresar código — Taller",
};

export default async function CodigoPage(props: PageProps<"/recuperar/codigo">) {
  const search = await props.searchParams;
  const email =
    typeof search?.email === "string" ? search.email : "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="h-1 w-full bg-pink-400" aria-hidden="true" />
        <div className="px-8 py-8">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              Código de verificación
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Ingresa el código de 6 dígitos y define tu nueva contraseña.
            </p>
          </div>
          <CodigoForm email={email} />
        </div>
      </div>
    </main>
  );
}