export default function Loading() {
  return (
    <div className="space-y-4 py-4">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
