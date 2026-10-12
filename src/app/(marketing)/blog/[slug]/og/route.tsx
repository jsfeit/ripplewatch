import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getPost } from "@/lib/posts";

const size = { width: 1200, height: 630 };

// Served at /blog/<slug>/og (a stable URL, unlike the file-convention image Next hashes).
// Each post gets its own share card with its real title, so a link pasted into
// LinkedIn or Slack says what the post is instead of showing the generic card.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => undefined);
  const title = post?.title ?? "Ripplewatch";
  const fontSize = title.length > 90 ? 48 : title.length > 60 ? 56 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#faf8f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              width: 52,
              height: 52,
              borderRadius: 13,
              background: "#0d7d6f",
              color: "#ffffff",
              fontSize: 28,
              fontWeight: 700,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            R
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "#1a231f" }}>Ripplewatch</div>
          <div style={{ display: "flex", fontSize: 24, color: "#66756e", marginLeft: 8 }}>/ Blog</div>
        </div>
        <div style={{ display: "flex", fontSize, fontWeight: 600, lineHeight: 1.18, color: "#1a231f", maxWidth: 1040 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#66756e" }}>ripplewatch.ai</div>
      </div>
    ),
    { ...size },
  );
}
