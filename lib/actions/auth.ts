"use server";

import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { rateLimitLogin, rateLimitMfa, rateLimitRecuperacion } from "@/lib/rate-limit";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/* ------------------------------------------------------------------ */
/* Login + MFA                                                         */
/* ------------------------------------------------------------------ */

export type LoginState = {
  errors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
  /** true si el usuario debe completar el paso 2FA (TOTP). */
  mfa?: boolean;
} | undefined;

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Ingresa tu correo." })
    .email({ message: "El correo no es válido." }),
  password: z.string().min(1, { message: "Ingresa tu contraseña." }),
});

/** Ruta segura tras login: solo paths internos. */
function safeRedirect(input: unknown): string {
  if (typeof input !== "string") return "/";
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  if (input.startsWith("/login") || input.startsWith("/recuperar")) return "/";
  return input;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  if (!rateLimitLogin(parsed.data.email)) {
    return { message: "Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.session) {
    // Mensaje genérico: no confirmar si el email existe.
    return { message: "Correo o contraseña incorrectos." };
  }

  // Si el usuario tiene 2FA (TOTP verificado), exige el segundo paso.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    return { mfa: true };
  }

  const redirectTo = safeRedirect(formData.get("redirect"));
  redirect(redirectTo);
}

/** Segundo paso de login: verifica el código TOTP del factor activo. */
export async function verificarMfa(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { message: "El código debe tener 6 dígitos." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "Sesi\u00f3n no v\u00e1lida. Vuelve a iniciar sesi\u00f3n." };

  if (!rateLimitMfa(user.id)) {
    return { message: "Demasiados intentos. Espera 15 minutos e intenta de nuevo." };
  }

  const factor = (user.factors ?? []).find((f) => f.status === "verified");
  if (!factor)
    return { message: "No se encontró un factor 2FA. Vuelve a iniciar sesión." };

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError)
    return { message: "No se pudo iniciar la verificación. Intenta de nuevo." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return { message: "El código no es válido. Intenta de nuevo." };

  const redirectTo = safeRedirect(formData.get("redirect"));
  redirect(redirectTo);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Recuperación de contraseña por OTP (código de 6 dígitos)            */
/* ------------------------------------------------------------------ */

export type RecuperarState = {
  message?: string;
  email?: string;
} | undefined;

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Ingresa tu correo." })
    .email({ message: "El correo no es válido." }),
});

/**
 * Solicita el código OTP. Mensaje SIEMPRE genérico (no revela si el
 * correo existe). El template de email en Supabase debe mostrar el token
 * numérico (`{{ .Token }}`), no un link de auto-login.
 */
export async function solicitarRecuperacion(
  _prevState: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Correo inv\u00e1lido." };
  }

  if (!rateLimitRecuperacion(parsed.data.email)) {
    return { message: "Demasiadas solicitudes. Espera 15 minutos e intenta de nuevo." };
  }

  const supabase = await createClient();
  // `shouldCreateUser: false`: no registrar cuentas nuevas desde recuperación.
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${SITE_URL}/login`,
    },
  });

  return {
    message:
      "Si el correo está registrado, recibirás un código de 6 dígitos válido por 10 minutos.",
    email: parsed.data.email,
  };
}

const recuperarSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, { message: "Ingresa tu correo." })
      .email({ message: "El correo no es válido." }),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, { message: "El código debe tener 6 dígitos." }),
    password: z
      .string()
      .min(10, { message: "La contraseña debe tener al menos 10 caracteres." }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });

export async function verificarCodigoRecuperacion(
  _prevState: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const parsed = recuperarSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (verifyError) {
    return {
      message: "El código no es válido o ya expiró. Solicita uno nuevo.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  await supabase.auth.signOut();
  if (updateError) {
    return { message: "No se pudo actualizar la contraseña. Intenta de nuevo." };
  }

  redirect("/login");
}

/* ------------------------------------------------------------------ */
/* 2FA / TOTP (solo administrador)                                     */
/* ------------------------------------------------------------------ */

export type EnrollResult =
  | { ok: true; factorId: string; qrDataUrl: string; secret: string }
  | { ok: false; error: string };

/** Inicia el alta de TOTP y devuelve el QR para escanear. */
export async function enrollTotp(): Promise<EnrollResult> {
  await requireRole("administrador");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
  });
  if (error || !data)
    return { ok: false, error: "No se pudo iniciar la configuración 2FA." };

  const qrDataUrl = await QRCode.toDataURL(data.totp.qr_code);
  return {
    ok: true,
    factorId: data.id,
    qrDataUrl,
    secret: data.totp.secret,
  };
}

export type ConfirmEnrollResult = { ok: boolean; error?: string };

/** Confirma el alta verificando un código de la app de autenticación. */
export async function confirmarEnroll(
  factorId: string,
  code: string,
): Promise<ConfirmEnrollResult> {
  await requireRole("administrador");
  const supabase = await createClient();

  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return { ok: false, error: "El código debe tener 6 dígitos." };

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) return { ok: false, error: "No se pudo verificar el código." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: trimmed,
  });
  if (verifyError) return { ok: false, error: "El código no es válido. Escanéalo de nuevo." };

  return { ok: true };
}

export type TfaResult = { ok: boolean; error?: string };

/** Desactiva el 2FA del administrador actual. */
export async function desactivarTotp(): Promise<TfaResult> {
  await requireRole("administrador");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const factor = (user?.factors ?? []).find((f) => f.factor_type === "totp");
  if (!factor) return { ok: true };

  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) return { ok: false, error: "No se pudo desactivar el 2FA." };
  return { ok: true };
}