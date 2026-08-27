import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Anon-key client that never touches cookies() — for genuinely public,
// unauthenticated reads (e.g. blog posts, RLS policy "anyone can read").
// Using the cookie-bound client from server.ts for content like this
// forces the whole route to render dynamically on every request (Next.js
// treats any cookies() read as request-specific), which defeats revalidate
// caching for pages that don't actually need a per-visitor session.
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
