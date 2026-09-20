/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Reglas de caching para el Service Worker.
// RSC (_rsc) y chunks estáticos NO se interceptan — el browser los maneja.
const runtimeCaching = [
  {
    matcher: ({ request }: { request: Request }) =>
      request.destination === "document",
    handler: new NetworkFirst({
      cacheName: "document-cache",
      networkTimeoutSeconds: 3,
    }),
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
