// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Replay's recording engine (rrweb) is a real chunk of client JS on its
// own — but referencing Sentry.replayIntegration() off this already-
// statically-imported namespace bundles that code into the main chunk
// regardless of any runtime condition around the call, since the bundler
// resolves the reference at build time, not the branch around it. A
// dynamic import() is what actually makes the bundler split Replay into
// its own chunk, fetched only when this branch runs — worth paying on
// /app and /admin, where a session replay helps debug a paying
// customer's real problem, but not on marketing pages, where every
// anonymous visitor would otherwise download a debugging tool aimed at
// customers, not prospects, whether or not it ever activates.
const isAppRoute =
  typeof window !== "undefined" &&
  (window.location.pathname.startsWith("/app") || window.location.pathname.startsWith("/admin"));

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Without this, a local `next dev` with .env.local's DSN set reports
  // straight into the real production Sentry project — every error during
  // routine local development pages the team the same as a live incident.
  enabled: process.env.NODE_ENV === "production",

  // No replay here — added below, after init, only on /app and /admin, so
  // its code is never even requested on marketing pages.
  integrations: [],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

// Dynamic import, not the statically-imported `Sentry` above — this is
// what actually puts Replay's recording engine in its own chunk, fetched
// only when this branch runs instead of bundled into every page.
if (isAppRoute) {
  import("@sentry/nextjs").then(({ replayIntegration }) => {
    Sentry.addIntegration(replayIntegration());
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
