"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase para uso en Componentes Cliente ("use client").
 *
 * Usa la clave anon pública y la protección real la da RLS del lado de la DB.
 * Preferir siempre server actions / server components; este cliente se deja
 * disponible para casos puntuales (por ejemplo, suscripciones realtime).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
