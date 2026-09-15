function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary/60 ${className ?? ""}`} />;
}

export default function CompetitorDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <Block className="h-7 w-56" />
      <Block className="mt-2 h-4 w-96" />
      <Block className="mt-6 h-14 w-full" />
      <div className="mt-8 flex items-center gap-3">
        <Block className="size-10 rounded-full" />
        <div className="space-y-2">
          <Block className="h-5 w-40" />
          <Block className="h-3.5 w-28" />
        </div>
      </div>
      <Block className="mt-8 h-40 w-full" />
    </div>
  );
}
