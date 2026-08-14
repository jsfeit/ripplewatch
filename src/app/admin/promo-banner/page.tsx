import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { PromoBannerManager } from "@/components/admin/promo-banner-manager";

export const metadata = { title: "Promo banner | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPromoBannerPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10">
        <SupabaseNotConfigured />
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("promo_campaigns")
    .select("active, percent_off, duration_months, code, banner_text")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Promo banner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One evergreen signup promo. When on, it applies automatically at checkout for any new self-serve
          signup (no code to type in) and shows a dismissible banner across the public site.
        </p>
      </div>
      <PromoBannerManager
        initial={
          data
            ? {
                active: data.active,
                percentOff: data.percent_off,
                durationMonths: data.duration_months,
                code: data.code,
                bannerText: data.banner_text,
              }
            : null
        }
      />
    </div>
  );
}
