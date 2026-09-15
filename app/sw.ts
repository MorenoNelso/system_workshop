/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Excluir requests RSC (_rsc) y chunks del SW.
// RSC = React Server Component fetches (navegación client-side).
// Si el SW los intercepta con NetworkFirst, falla offline y causa loop infinito.
const runtimeCaching = [
  {
    matcher: ({ url }: { url: URL }) =>
      url.searchParams.has("_rsc") ||
      url.pathname.startsWith("/_next/static/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request }: { request: Request }) =>
      request.destination === "document",
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request }: { request: Request }) =>
      request.destination === "image" ||
      request.destination === "font" ||
      request.destination === "style" ||
      request.destination === "script",
    handler: new StaleWhileRevalidate({
      cacheName: "static-assets",
    }),
  },
  {
    matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: "api-cache",
      networkTimeoutSeconds: 3,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }: { request: Request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
