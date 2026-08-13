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
