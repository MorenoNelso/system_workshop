import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los redirects de auth los gestiona `proxy.ts` (rutas protegidas → /login,
  // sesión activa en /login → /). No definir aquí redirects estáticos que
  // colisionen con la lógica del proxy.
};

export default nextConfig;
