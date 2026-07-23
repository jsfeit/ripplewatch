import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 700,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            R
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
            color: "#1a231f",
            maxWidth: 980,
          }}
        >
          <div style={{ display: "flex" }}>Every tool tells you what changed.</div>
          <div style={{ display: "flex", color: "#0d7d6f" }}>We tell you if it matters.</div>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: "#66756e" }}>
          AI-native competitive intelligence for startup product and marketing teams
        </div>
      </div>
    ),
    { ...size }
  );
}
