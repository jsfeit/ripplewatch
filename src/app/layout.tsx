import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieConsent } from "@/components/cookie-consent";
import { UtmCapture } from "@/components/utm-capture";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { getBannerCampaign } from "@/lib/promo-campaign";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const REDITUS_CUSTOMER_ID = process.env.NEXT_PUBLIC_REDITUS_CUSTOMER_ID;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TITLE = "Ripplewatch | Competitive intelligence that knows what matters to you";
const DESCRIPTION =
  "AI-native competitive intelligence for startup marketing teams. Not just what changed: whether it matters to you, and why.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: TITLE, template: "%s | Ripplewatch" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Ripplewatch",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const campaign = isSupabaseConfigured() ? await getBannerCampaign() : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {REDITUS_CUSTOMER_ID && (
            // beforeInteractive is required by Reditus's own install spec —
            // Next.js always injects beforeInteractive scripts into <head>
            // regardless of where they're rendered in the tree, unconditionally
            // on every page (not gated behind cookie consent like the other
            // trackers in cookie-consent.tsx), since their install verification
            // and click-to-signup attribution both depend on it firing that way.
            <Script id="reditus-init" strategy="beforeInteractive">
              {`(function (w, d, s, p, t) {
                w.gr = w.gr || function () { w.gr.ce = 60; w.gr.q = w.gr.q || []; w.gr.q.push(arguments); };
                p = d.getElementsByTagName(s)[0]; t = d.createElement(s); t.async = true;
                t.src = "https://script.getreditus.com/v2.js";
                p.parentNode.insertBefore(t, p);
              })(window, document, "script");
              gr("initCustomer", "${REDITUS_CUSTOMER_ID}");
              gr("track", "pageview");`}
            </Script>
          )}
          <UtmCapture />
          <PromoBanner bannerText={campaign?.bannerText ?? null} linkUrl={campaign?.linkUrl ?? null} />
          {children}
          <Analytics />
          <SpeedInsights />
          <CookieConsent />
          <script
            type="application/ld+json"
            // Sitewide Organization markup — one static block, safe to inline
            // since it contains no user data, just fixed brand facts.
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "Ripplewatch",
                url: APP_URL,
                description: DESCRIPTION,
                logo: `${APP_URL}/opengraph-image`,
                sameAs: ["https://www.linkedin.com/company/ripplewatch/"],
              }),
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
