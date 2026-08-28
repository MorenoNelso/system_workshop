import type { Metadata } from "next";

import { RecuperarForm } from "./recuperar-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Taller",
};

export default function RecuperarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="h-1 w-full bg-pink-400" aria-hidden="true" />
        <div className="px-8 py-8">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              Recuperar contraseña
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Ingresa tu correo y recibirás un código de 6 dígitos.
            </p>
          </div>
          <RecuperarForm />
        </div>
      </div>
    </main>
  );
}