function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary/60 ${className ?? ""}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-10 sm:py-10">
      <Block className="h-7 w-32" />
      <Block className="mt-2 h-4 w-80" />
      <div className="mt-8 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Block key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Block className="h-20 w-full" />
        <Block className="h-20 w-full" />
        <Block className="h-20 w-full" />
      </div>
    </div>
  );
}
