/**
 * Rate limiter en memoria (basic).
 *
 * Aviso: en entornos serverless (Netlify) cada invocacion puede
 * arrancar en una instancia nueva, por lo que este limite es
 * best-effort. Supabase Auth ya tiene rate limiting propio para
 * los endpoints de login/OTP. Para produccion robusta considerar
 * Upstash Redis (ver .env.example).
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

const SWEEP_INTERVAL = 60_000;
let lastSweep = Date.now();

function sweep() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Devuelve `true` si la accion esta permitida, `false` si se excedio el limite.
 *
 * @param identifier  clave unica (ej. `login:email`, `factura:userId`)
 * @param max          maximo de intentos en la ventana
 * @param windowMs     tamano de la ventana en milisegundos
 */
export function rateLimit(
  identifier: string,
  max: number,
  windowMs: number,
): boolean {
  sweep();
  const now = Date.now();
  const entry = buckets.get(identifier);

  if (!entry || entry.resetAt <= now) {
    buckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= max;
}

/** Limite estricto para intentos de login (5 por 15 min). */
export function rateLimitLogin(email: string): boolean {
  return rateLimit(`login:${email}`, 5, 15 * 60_000);
}

/** Limite para verificacion MFA (5 por 15 min). */
export function rateLimitMfa(userId: string): boolean {
  return rateLimit(`mfa:${userId}`, 5, 15 * 60_000);
}

/** Limite para solicitud de recuperacion (3 por 15 min). */
export function rateLimitRecuperacion(email: string): boolean {
  return rateLimit(`recuperar:${email}`, 3, 15 * 60_000);
}

/** Limite para creacion de facturas (10 por 15 min por usuario). */
export function rateLimitFactura(userId: string): boolean {
  return rateLimit(`factura:${userId}`, 10, 15 * 60_000);
}
