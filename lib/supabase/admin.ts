import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase con la `service_role` key (privilegios totales).
 *
 * SOLO para usar en Server Actions / Route Handlers bajo `requireRole`.
 * NUNCA importar desde componentes cliente. Si esta key llega al navegador,
 * hay que rotarla de inmediato en el dashboard de Supabase.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  );
}