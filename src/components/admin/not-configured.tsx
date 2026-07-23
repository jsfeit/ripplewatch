export function SupabaseNotConfigured() {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
      Supabase isn&apos;t configured yet — set NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.local
      (see .env.example) once a Supabase project exists.
    </p>
  );
}
