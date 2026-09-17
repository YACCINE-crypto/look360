/** Skeleton affiché instantanément pendant le chargement d'une page (app). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="space-y-2">
        <div className="bg-muted h-6 w-48 rounded-md" />
        <div className="bg-input h-4 w-72 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border-border h-20 rounded-xl border" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface border-border h-64 rounded-xl border" />
        ))}
      </div>
    </div>
  );
}
