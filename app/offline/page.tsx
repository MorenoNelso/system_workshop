"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-sm text-center">
        <svg
          className="mx-auto h-16 w-16 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
          />
        </svg>
        <h1 className="mt-4 text-xl font-semibold text-zinc-900">
          Sin conexión
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          No se pudo establecer conexión con el servidor. Verifica tu conexión a
          internet e intenta de nuevo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-[#1234ab] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e2a8a]"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}