"use client";

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV,
  ignoreErrors: [
    "Cannot read properties of undefined (reading 'startTime')",
    "Cannot read properties of null (reading 'startTime')",
  ],
});
