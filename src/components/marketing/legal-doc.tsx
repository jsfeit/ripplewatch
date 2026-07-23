export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div
        className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
          [&_p]:mt-2 [&_p]:text-muted-foreground
          [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-muted-foreground
          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
      >
        {children}
      </div>
    </div>
  );
}
