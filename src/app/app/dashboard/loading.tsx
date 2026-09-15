// Shown instantly on navigation while the dashboard's ~15 parallel queries
// resolve server-side — without this, App Router shows nothing at all
// (or a frozen previous page) for however long that takes, which reads as
// "the app is slow" even when the actual query time is fine.
function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary/60 ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <Block className="h-7 w-40" />
      <Block className="mt-2 h-4 w-72" />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <Block className="mt-6 h-24 w-full" />
      <div className="mt-10 space-y-3">
        <Block className="h-5 w-32" />
        <Block className="h-16 w-full" />
        <Block className="h-16 w-full" />
        <Block className="h-16 w-full" />
      </div>
    </div>
  );
}
