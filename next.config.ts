import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { withSerwist } from "@serwist/turbopack";

const isDev = process.env.NODE_ENV === "development";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // React dev necesita `unsafe-eval` para debug (callstacks). En producción no.
      // NOTA: 'unsafe-inline' es necesario para React hydration (__NEXT_DATA__, chunks).
      // Para eliminarlo, implementar nonces por request via middleware + layout.
      // Riesgo aceptado: usuarios internos (1-3 personas), no público.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: ${supabaseUrl} https://o4511990296346624.ingest.us.sentry.io`,
      "font-src 'self'",
      `connect-src 'self' ${supabaseUrl} wss://${supabaseUrl.replace("https://", "")} https://o4511990296346624.ingest.us.sentry.io`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: isDev ? "same-origin-allow-popups" : "same-origin",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseUrl.replace("https://", ""),
      },
    ],
  },
};

export default withSentryConfig(
  withSerwist(nextConfig),
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    sourcemaps: { disable: true },
    telemetry: false,
  },
);