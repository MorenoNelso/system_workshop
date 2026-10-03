/**
 * Interruptor del flujo de recuperación de contraseña por OTP.
 *
 * Apagado por defecto: el taller opera con 2 usuarios locales y la
 * recuperación se hace manual (el admin restablece desde Supabase).
 * El flujo por código de 6 dígitos exige SMTP propio con template
 * `{{ .Token }}` (el SMTP gratuito de Supabase no lo permite editar).
 *
 * Para reactivar: `NEXT_PUBLIC_ENABLE_PASSWORD_RECOVERY=true` en el
 * entorno + SMTP configurado. Sin tocar código.
 */
export const RECUPERACION_HABILITADA =
  process.env.NEXT_PUBLIC_ENABLE_PASSWORD_RECOVERY === "true";
