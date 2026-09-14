"use server";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export interface Configuracion {
  nombre_taller: string;
  logo_url: string | null;
  logo_principal_url: string | null;
  logo_login_url: string | null;
  logo_watermark_url: string | null;
}

const DEFAULT_NOMBRE = "Pacho Motos";

/** URLs públicas por defecto (fallback si no hay fila en la DB). */
const DEFAULT_URLS: Configuracion = {
  nombre_taller: DEFAULT_NOMBRE,
  logo_url:
    "https://xornnmlgufdlscxhgyyp.supabase.co/storage/v1/object/public/logos/Logo3.png",
  logo_principal_url:
    "https://xornnmlgufdlscxhgyyp.supabase.co/storage/v1/object/public/logos/Logo1.png",
  logo_login_url:
    "https://xornnmlgufdlscxhgyyp.supabase.co/storage/v1/object/public/logos/Logo3.png",
  logo_watermark_url:
    "https://xornnmlgufdlscxhgyyp.supabase.co/storage/v1/object/public/logos/Logo4.png",
};

/**
 * Lee la configuración del sistema (nombre + logos). Memoizado por request.
 * Si la DB no tiene fila aún, usa los valores por defecto.
 */
export const getConfiguracion = cache(
  async (): Promise<Configuracion> => {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("configuracion_sistema")
        .select("nombre_taller, logo_url, logo_principal_url, logo_login_url, logo_watermark_url")
        .limit(1)
        .maybeSingle();

      const row = data as
        | {
            nombre_taller: string;
            logo_url: string | null;
            logo_principal_url: string | null;
            logo_login_url: string | null;
            logo_watermark_url: string | null;
          }
        | null;

      if (row?.nombre_taller) {
        return {
          nombre_taller: row.nombre_taller,
          logo_url: row.logo_url ?? DEFAULT_URLS.logo_url,
          logo_principal_url: row.logo_principal_url ?? DEFAULT_URLS.logo_principal_url,
          logo_login_url: row.logo_login_url ?? DEFAULT_URLS.logo_login_url,
          logo_watermark_url: row.logo_watermark_url ?? DEFAULT_URLS.logo_watermark_url,
        };
      }
    } catch {
      // Sin sesión o sin permisos: usamos los defaults (públicos).
    }
    return DEFAULT_URLS;
  },
);