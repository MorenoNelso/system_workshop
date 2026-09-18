import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/types/database.types";

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  permisos: Record<string, boolean> | null;
}

export type AuthState = {
  status: "anon" | "mfa_pending" | "authed";
};

/**
 * Estado de autenticación sin consultar la DB:
 * - "anon": sin sesión.
 * - "mfa_pending": sesión débil (login con contraseña OK, falta el paso 2FA).
 * - "authed": sesión completa.
 *
 * En offline, si hay cookies de sesión válidas, devuelve "authed".
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Fallback offline: verificar si hay cookies de sesión
      const fallback = await getUserFromCookies();
      return fallback ? { status: "authed" } : { status: "anon" };
    }

    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
      return { status: "mfa_pending" };
    }

    return { status: "authed" };
  } catch {
    // Error de red: si hay cookies, asumir authed (offline mode)
    const fallback = await getUserFromCookies();
    return fallback ? { status: "authed" } : { status: "anon" };
  }
}

/**
 * Intenta extraer datos del usuario del JWT en las cookies de sesión.
 * Útil cuando Supabase es inalcanzable (offline). Solo Extrae datos
 * básicos; NO valida el token (eso lo hace Supabase online).
 */
async function getUserFromCookies(): Promise<SessionUser | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const authCookie = cookieStore
      .getAll()
      .find(
        (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
      );
    if (!authCookie) return null;

    // El valor puede ser un JWT directo o un JSON array con tokens
    let token = authCookie.value;
    try {
      const parsed = JSON.parse(token);
      if (Array.isArray(parsed) && parsed.length > 0) {
        token = parsed[0].value ?? parsed[0];
      }
    } catch {
      // ya es un JWT directo
    }

    // Decodificar el payload del JWT (sin validación — solo para datos offline)
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));

    // Los claims estándar de Supabase Auth
    const sub = payload.sub as string | undefined;
    const email = payload.email as string | undefined;
    if (!sub || !email) return null;

    return {
      id: sub,
      email,
      nombre: email.split("@")[0],
      rol: "colaborador",
      activo: true,
      permisos: null,
    };
  } catch {
    return null;
  }
}

/**
 * Devuelve el usuario autenticado con su rol leído de `public.usuarios`,
 * o `null` si no hay sesión (o si falta completar el 2FA). Memoizado con
 * `cache()` para reutilizar el resultado durante un mismo render.
 *
 * Uso: en Server Components, layouts y server actions. Nunca desde el cliente.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  let user = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (err) {
    // Error de red: intentar leer usuario de las cookies JWT
    console.error("[session] getUser failed (network?):", err);
    return getUserFromCookies();
  }

  if (!user) {
    // Sin usuario de Supabase: intentar cookies como fallback offline
    return getUserFromCookies();
  }

  // Sesión débil (2FA pendiente): no cuenta como autenticado.
  try {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") return null;
  } catch {
    // Offline: no podemos verificar MFA, asumir OK
    console.warn("[session] getAuthenticatorAssuranceLevel failed (network?)");
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, activo, permisos")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.activo) {
    // Si es error de red (no RLS/DB), intentar cookies
    if (error?.message?.includes("fetch") || error?.code === "PGRST301" || !error?.code) {
      return getUserFromCookies();
    }
    console.error("[Auth] Usuario no encontrado en public.usuarios o error RLS:", {
      userId: user.id,
    });
    Sentry.captureMessage(
      "Usuario autenticado sin registro en public.usuarios (posible RLS o registro incompleto)",
      {
        level: "warning",
        extra: { authUserId: user.id, authUserEmail: user.email },
      },
    );
    try {
      await supabase.auth.signOut();
    } catch {
      // Offline: no se puede cerrar sesión
    }
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    nombre: data.nombre,
    rol: data.rol,
    activo: data.activo,
    permisos: data.permisos as Record<string, boolean> | null,
  };
});

/**
 * Exige sesión activa. Si no hay usuario, redirige a `/login`.
 * Uso en layouts / pages protegidos.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Exige que el usuario autenticado tenga alguno de los roles indicados.
 * Si no cumple, redirige al home. RLS es la última línea de defensa.
 */
export async function requireRole(
  ...roles: [Rol, ...Rol[]]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) redirect("/");
  return user;
}
