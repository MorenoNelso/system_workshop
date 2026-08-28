/**
 * Skeleton loader para listas CRUD (se muestra mientras el server carga datos).
 */
export function CrudSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-3 w-56 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-200" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex gap-6 border-b border-zinc-100 px-4 py-4 last:border-0"
          >
            <div className="h-4 flex-1 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 flex-1 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 flex-1 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
