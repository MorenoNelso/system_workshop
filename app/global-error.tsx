"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-zinc-50">
        <div className="flex min-h-dvh items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m0 3.75h.007v.008H12v-.008ZM21.75 12a9.75 9.75 0 1 1-19.5 0 9.75 9.75 0 0 1 19.5 0Z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Error del sistema
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              La aplicaci&oacute;n encontr&oacute; un error cr&iacute;tico.
              Recarga la p&aacute;gina o contacta al administrador si persiste.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
