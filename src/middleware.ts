import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Admin "view as" sessions are read-only by construction: while the
  // cookie is set, block every mutating request to customer-facing routes
  // before it reaches a handler, rather than relying on each route to
  // remember to check. /api/admin/** stays open so an admin can always end
  // the session (and so the rest of the admin panel keeps working).
  const isImpersonating = Boolean(request.cookies.get(IMPERSONATION_COOKIE)?.value);
  const isMutatingApiRequest = request.nextUrl.pathname.startsWith("/api") &&
    !request.nextUrl.pathname.startsWith("/api/admin") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (isImpersonating && isMutatingApiRequest) {
    return NextResponse.json(
      { error: "Read-only while viewing as a customer account. End the view-as session to make changes." },
      { status: 403 }
    );
  }

  // Everything below this point does a session lookup, which only
  // /app, /admin, /api/admin, /onboarding, /login, and /signup need — other
  // API routes (webhooks, cron, the external /api/v1 API, etc.) would only
  // pay for it, not use it.
  const { pathname: rawPathname } = request.nextUrl;
  const needsAuthCheck =
    rawPathname.startsWith("/app") ||
    rawPathname.startsWith("/admin") ||
    rawPathname.startsWith("/api/admin") ||
    rawPathname.startsWith("/onboarding") ||
    rawPathname === "/login" ||
    rawPathname === "/signup";
  if (!needsAuthCheck) return response;

  // Supabase isn't configured yet (no project exists) — let requests through
  // unauthenticated rather than hard-crashing every matched route. Auth and
  // admin gating both switch on automatically once real keys are set.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // /onboarding is deliberately not gated here — it's the anonymous product
  // demo. Account creation happens at the end of the flow itself (see
  // onboarding-flow.tsx), not as a precondition to seeing it.
  if (pathname.startsWith("/app") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // A cancelled subscription (not the separate admin-controlled "hold"
  // status — see accounts.status vs. subscription_status) blocks the rest
  // of /app until they resubscribe, rather than leaving a stale dashboard
  // browsable forever with no prompt to reactivate. Deliberately keyed on
  // subscription_status alone, not status: a brand-new account that
  // hasn't paid yet has subscription_status null (not "canceled"), so this
  // never blocks someone mid-onboarding who's simply never subscribed —
  // only an account that had a subscription and lost it. Clears itself the
  // moment a new subscription is created (see the Stripe webhook), so no
  // separate "un-cancel" step is needed here.
  if (pathname.startsWith("/app") && user && pathname !== "/app/reactivate") {
    // Single embedded query (profiles -> accounts is an unambiguous FK, so
    // PostgREST can join it in one round trip) rather than two sequential
    // ones — this runs on every /app request for every logged-in customer,
    // so it's worth the one query it costs rather than two.
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id, accounts(subscription_status, tier, status, connect_get_started_dismissed_at)")
      .eq("id", user.id)
      .single();
    const account = Array.isArray(profile?.accounts) ? profile.accounts[0] : profile?.accounts;

    // Anyone who hasn't finished signing up goes back to the step they stopped at, from any /app
    // URL (a bookmark, the login default, an old email link), instead of landing on a page that
    // has nothing to show them yet. The place is never stored: it's read off the account, so it
    // holds across sessions and devices.
    //   - signed in, no account yet: the purchase step, which remembers their company name
    //   - account created but never paid: the same step, resumed at payment
    //   - paid but setup unfinished: the setup wizard, which resumes where it left off
    // /app/get-started is exempt from the unpaid check because Stripe sends people back to it
    // before the webhook has marked the account paid. Admin "view as" sessions are exempt too.
    if (!isImpersonating) {
      const toOnboarding = () => {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        url.search = "";
        return NextResponse.redirect(url);
      };
      if (!profile?.account_id) return toOnboarding();
      const neverPaid = account?.tier === "connect" && account.status === "hold" && !account.subscription_status;
      if (neverPaid && !pathname.startsWith("/app/get-started")) return toOnboarding();
      if (
        account?.tier === "connect" &&
        !neverPaid &&
        account.status === "active" &&
        !account.connect_get_started_dismissed_at &&
        !pathname.startsWith("/app/get-started")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/get-started";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
    // Ripplewatch Connect accounts have no dashboard and no in-app Ask
    // (Connect already is the assistant, inside Claude, ChatGPT, or Slack):
    // their web app is just Settings (billing, balance, connector). A
    // cancelled one lands on the same Settings tab, which offers to
    // resubscribe, rather than the dashboard-plan reactivation page.
    if (account?.tier === "connect") {
      // /app/get-started is the one-time post-checkout context step (see
      // /app/get-started/page.tsx) — it redirects itself to Settings once
      // connect_get_started_dismissed_at is set, so it's safe to always
      // allow rather than needing its own status check here. The dashboard
      // being unreachable here also means the dashboard's product tour
      // (gated on reaching /app/dashboard, not on tier) can never fire for
      // a Connect account.
      const allowed = pathname.startsWith("/app/settings") || pathname.startsWith("/app/get-started");
      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/settings";
        url.search = "?tab=connect";
        return NextResponse.redirect(url);
      }
    } else if (account?.subscription_status === "canceled") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/reactivate";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // ADMIN_EMAILS is a zero-SQL bootstrap path — useful before anyone has
    // manually promoted a profiles row to role='admin' in the database.
    const bootstrapAdminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const isBootstrapAdmin = Boolean(user.email && bootstrapAdminEmails.includes(user.email.toLowerCase()));

    if (profile?.role !== "admin" && !isBootstrapAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/:path*",
    "/onboarding/:path*",
    "/login",
    "/signup",
  ],
};
