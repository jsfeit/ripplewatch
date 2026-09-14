const description = "Where Ripplewatch has been featured and covered.";

export const metadata = {
  title: "Press",
  description,
  alternates: { canonical: "/press" },
  openGraph: { title: "Press | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Press | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function PressPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Press</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">Where Ripplewatch has been featured and covered.</p>

      <div className="mt-10 flex flex-wrap items-center gap-6">
        <a href="https://postyourstartup.co/startup/ripplewatch?ref=badge" target="_blank" rel="noopener noreferrer">
          <img
            src="https://postyourstartup.co/api/badge/ripplewatch?theme=light"
            alt="Featured on PostYourStartup"
            width={212}
            height={55}
          />
        </a>
      </div>
    </div>
  );
}
