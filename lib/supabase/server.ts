import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase para uso en Server Components, Server Actions y Route Handlers.
 *
 * Gestiona automáticamente las cookies httpOnly de sesión mediante `@supabase/ssr`.
 * En Next.js 16 `cookies()` es asíncrono, por eso este helper también lo es.
 *
 * IMPORTANTE: nunca importar este archivo desde componentes cliente.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // El método `setAll` fue llamado desde un Server Component. Puede
            // ignorarse si hay un proxy (`proxy.ts`) refrescando la sesión.
          }
        },
      },
    },
  );
}
