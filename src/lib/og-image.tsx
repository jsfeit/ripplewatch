import { ImageResponse } from "next/og";

// Shared visual so every page-specific opengraph-image.tsx (see
// pricing/, how-it-works/, faq/, compare/[slug]/, and
// state-of-competitive-intelligence/) doesn't have to redefine the brand
// mark and layout — only the headline/subheadline text changes per page.
// Previously every page shared one generic root-level image regardless of
// what was actually being linked/shared.
export const ogImageSize = { width: 1200, height: 630 };
export const ogImageContentType = "image/png";

export function renderOgImage(headline: string, subheadline: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#faf8f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#0d7d6f",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#1a231f" }}>
            Ripplewatch
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 56,
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.2,
            color: "#0d7d6f",
            maxWidth: 980,
          }}
        >
          <div style={{ display: "flex" }}>{headline}</div>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: "#66756e", maxWidth: 980 }}>
          {subheadline}
        </div>
      </div>
    ),
    { ...ogImageSize }
  );
}
