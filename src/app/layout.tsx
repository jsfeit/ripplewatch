import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieConsent } from "@/components/cookie-consent";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
      </body>
    </html>
  );
}
