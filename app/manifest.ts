import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pacho Motos",
    short_name: "Pacho Motos",
    description: "Sistema de gestión del taller de motos Pacho Motos",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1234ab",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}