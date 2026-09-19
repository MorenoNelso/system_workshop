/**
 * Rate limiter distribuido via Supabase (funciona en serverless).
 *
 * Usa la tabla rate_limits (docs/tabla-rate-limits.sql) para persistir
 * contadores entre cold starts. La función RPC check_rate_limit()
 * maneja la lógica atómicamente en la BD.
 *
 * Fallback: si la BD no está disponible, permite la acción
 * (degrada a "sin rate limiting" en vez de bloquear usuarios legítimos).
 */

import { createClient } from "@/lib/supabase/server";

async function checkLimit(
  identifier: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_id: identifier,
      p_max: max,
      p_window_ms: windowMs,
    });

    if (error) return true; // fallback: permitir
    return data === true;
  } catch {
    return true; // fallback: permitir
  }
}

/** Limpieza de registros expirados (llamar periódicamente). */
export async function cleanupRateLimits(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("cleanup_rate_limits");
  } catch {
    // ignorar errores de limpieza
  }
}

/** Limite estricto para intentos de login (5 por 15 min). */
export function rateLimitLogin(email: string): Promise<boolean> {
  return checkLimit(`login:${email}`, 5, 15 * 60_000);
}

/** Limite para verificacion MFA (5 por 15 min). */
export function rateLimitMfa(userId: string): Promise<boolean> {
  return checkLimit(`mfa:${userId}`, 5, 15 * 60_000);
}

/** Limite para solicitud de recuperacion (3 por 15 min). */
export function rateLimitRecuperacion(email: string): Promise<boolean> {
  return checkLimit(`recuperar:${email}`, 3, 15 * 60_000);
}

/** Limite para creacion de facturas (10 por 15 min por usuario). */
export function rateLimitFactura(userId: string): Promise<boolean> {
  return checkLimit(`factura:${userId}`, 10, 15 * 60_000);
}

/** Limite para verificacion de codigo OTP (5 por 15 min por email). */
export function rateLimitOtpVerify(email: string): Promise<boolean> {
  return checkLimit(`otp:${email}`, 5, 15 * 60_000);
}

/** Limite para registro de pagos (10 por 15 min por usuario). */
export function rateLimitPago(userId: string): Promise<boolean> {
  return checkLimit(`pago:${userId}`, 10, 15 * 60_000);
}

/** Limite para acciones admin-only (20 por 15 min por usuario). */
export function rateLimitAdmin(userId: string): Promise<boolean> {
  return checkLimit(`admin:${userId}`, 20, 15 * 60_000);
}
