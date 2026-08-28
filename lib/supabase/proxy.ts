import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

/**
 * Rutas públicas — accesibles sin sesión iniciada.
 * El resto de rutas de la app son protegidas por defecto.
 */
const PUBLIC_PATHS = ["/login", "/recuperar"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refresca la sesión de Supabase en cada request y aplica redirects
 * de autenticación (check optimista, sin consultar la DB).
 *
 * La verificación fina de rol se hace server-side (layout + RLS),
 * nunca solamente en el proxy.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANTE: `getUser()` valida el token contra el servidor de Auth
  // y refresca la cookie si es necesario. No usar `getSession()`, que solo
  // lee la cookie y puede devolver datos manipulables.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sesión débil: usuario logueó con contraseña pero aún no completa el 2FA.
  let mfaPending = false;
  if (user) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    mfaPending = aal?.nextLevel === "aal2";
  }

  const { pathname } = request.nextUrl;
  const publicRoute = isPublicPath(pathname);

  // Sin sesión intentando entrar a una ruta protegida → /login
  if (!user && !publicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Sesión débil (2FA pendiente) en ruta protegida → vuelve a /login
  // para mostrar el paso del código TOTP.
  if (user && mfaPending && !publicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("mfa", "1");
    return NextResponse.redirect(url);
  }

  // Usuario con sesión completa tratando de ver /login o /recuperar → home
  if (user && !mfaPending && publicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
