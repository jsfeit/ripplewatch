// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Replay's recording code is a real chunk of client JS on its own, fetched
// the moment replayIntegration() is added — worth paying on /app and
// /admin, where a session replay actually helps debug a paying customer's
// real problem, but not on marketing pages, where every anonymous visitor
// would otherwise pay that weight for a debugging tool aimed at customers,
// not prospects. Read once at module init (this file only runs in the
// browser), not per-navigation — a fresh page load re-evaluates it anyway.
const isAppRoute =
  typeof window !== "undefined" &&
  (window.location.pathname.startsWith("/app") || window.location.pathname.startsWith("/admin"));

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Without this, a local `next dev` with .env.local's DSN set reports
  // straight into the real production Sentry project — every error during
  // routine local development pages the team the same as a live incident.
  enabled: process.env.NODE_ENV === "production",

  // Add optional integrations for additional features
  integrations: isAppRoute ? [Sentry.replayIntegration()] : [],

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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
