import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy de Next.js 16 (antes `middleware.ts`, deprecado en v16).
 *
 * Corre en runtime Node.js antes de renderizar cualquier ruta:
 *  - Refresca la sesión de Supabase (rotación de cookies httpOnly).
 *  - Redirige a `/login` si no hay sesión en rutas protegidas.
 *  - Redirige a `/` si un usuario autenticado visita `/login` o `/recuperar`.
 *
 * La autorización por rol (administrador vs colaborador) se aplica en el
 * layout server-side y con las políticas RLS de la base de datos.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas excepto:
     * - api            (route handlers públicos)
     * - _next/static   (assets estáticos)
     * - _next/image    (optimización de imágenes)
     * - favicon.ico, robots.txt, sitemap.xml
     * - archivos con extensión (imágenes, fuentes, css, js)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
