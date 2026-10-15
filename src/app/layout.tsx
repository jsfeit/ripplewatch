import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieConsent } from "@/components/cookie-consent";
import { UtmCapture } from "@/components/utm-capture";
import { ReferralCapture } from "@/components/referral-capture";
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TITLE = "Ripplewatch | Not alerts. Not data. Answers.";
// Search results show about 155 characters, so the page description is a short one; the long
// DESCRIPTION below stays for the structured data, where length is not cut off.
const META_DESCRIPTION =
  "An AI competitive intelligence analyst inside Claude and ChatGPT. It tracks competitor pricing, hiring and press, and scores each move against your deals.";
const DESCRIPTION =
  "Ripplewatch is an AI competitive intelligence analyst that works inside Claude and other AI assistants over MCP. It tracks your competitors' pricing, hiring, press and product changes, scores each one against your positioning and your win/loss history, and tells product marketing and revenue teams which competitors are becoming a real threat.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: TITLE, template: "%s | Ripplewatch" },
  description: META_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Ripplewatch",
    title: TITLE,
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: META_DESCRIPTION,
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
          <UtmCapture />
          <ReferralCapture />
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
          <script
            type="application/ld+json"
            // Separate from Organization on purpose — WebSite describes the
            // site itself (what search/AI engines index and cite), while
            // Organization describes the company behind it. Same
            // no-user-data, safe-to-inline reasoning as the block above.
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Ripplewatch",
                url: APP_URL,
              }),
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
