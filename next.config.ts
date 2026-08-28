import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        basePath: false, // Esto es CRÍTICO para que funcione sin /dashboard
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
