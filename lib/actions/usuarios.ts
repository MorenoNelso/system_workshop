"use server";

import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  rol: "administrador" | "colaborador";
  activo: boolean;
  creado_en: string | null;
}

const createUsuarioSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Ingresa el correo." })
    .email({ message: "El correo no es válido." }),
  nombre: z
    .string()
    .trim()
    .min(2, { message: "Ingresa el nombre completo." })
    .max(100),
  rol: z.enum(["administrador", "colaborador"], {
    message: "Rol no válido.",
  }),
  password: z
    .string()
    .min(10, { message: "La contraseña debe tener al menos 10 caracteres." }),
});

export type CrearUsuarioState =
  | { ok?: boolean; message?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

/**
 * Crea un usuario: primero en Supabase Auth (para que pueda iniciar sesión)
 * y luego en `public.usuarios` (rol + nombre). Solo administrador.
 */
export async function crearUsuario(
  _prev: CrearUsuarioState,
  formData: FormData,
): Promise<CrearUsuarioState> {
  await requireRole("administrador");

  const parsed = createUsuarioSchema.safeParse({
    email: formData.get("email"),
    nombre: formData.get("nombre"),
    rol: formData.get("rol"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const admin = createAdminClient();

  // 1. Crear en Supabase Auth (confirmado para que pueda loguear directo).
  const { data: authUser, error: authError } = await admin.auth.admin.createUser(
    {
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    },
  );
  if (authError) {
    if (authError.message.includes("already been registered")) {
      return { message: "Ese correo ya está registrado en el sistema." };
    }
    return { message: "No se pudo crear el usuario. Intenta de nuevo." };
  }
  if (!authUser.user) {
    return { message: "No se pudo crear el usuario. Intenta de nuevo." };
  }

  // 2. Registrar en public.usuarios con su rol.
  const { error: dbError } = await admin.from("usuarios").insert({
    id: authUser.user.id,
    email: parsed.data.email,
    nombre: parsed.data.nombre,
    rol: parsed.data.rol,
    activo: true,
  });
  if (dbError) {
    // Revertir el usuario de auth para no dejar datos huérfanos.
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { message: "No se pudo guardar el usuario. Intenta de nuevo." };
  }

  return { ok: true, message: `Usuario ${parsed.data.nombre} creado correctamente.` };
}

/** Lista los usuarios del sistema (solo admin). */
export async function listUsuarios(): Promise<UsuarioRow[]> {
  await requireRole("administrador");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, activo, creado_en")
    .order("nombre");
  if (error) return [];
  return (data ?? []) as unknown as UsuarioRow[];
}

/** Activa o desactiva un usuario (solo admin). */
export async function toggleUsuarioActivo(
  id: string,
  activo: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("administrador");
  const admin = createAdminClient();
  const { error } = await admin.from("usuarios").update({ activo }).eq("id", id);
  if (error) {
    return { ok: false, error: "No se pudo actualizar el usuario." };
  }
  return { ok: true };
}

/** Cambia el rol de un usuario (solo admin). */
export async function cambiarRolUsuario(
  id: string,
  rol: "administrador" | "colaborador",
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("administrador");
  const admin = createAdminClient();
  const { error } = await admin.from("usuarios").update({ rol }).eq("id", id);
  if (error) {
    return { ok: false, error: "No se pudo actualizar el rol." };
  }
  return { ok: true };
}