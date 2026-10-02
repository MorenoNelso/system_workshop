"use server";

import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAdmin } from "@/lib/rate-limit";

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
  const user = await requireRole("administrador");

  if (!(await rateLimitAdmin(user.id))) {
    return { message: "Demasiadas peticiones. Espera unos minutos e intenta de nuevo." };
  }

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

  // 3. Crear automáticamente su registro de empleado para que pueda
  //    trabajar como mecánico desde el día uno (sin SQL manual):
  //    - colaborador → 30% (su ganancia por trabajo)
  //    - administrador/dueño → 100% (todo lo que cobra queda en el taller;
  //      la lógica de `duenoId` en ganancias ya excluye su comisión del costo)
  //    NOTA: supabase-js NO lanza excepción en insert: retorna { error }.
  //    Por eso se revisa `error` explícitamente en vez de try/catch.
  let advertenciaEmpleado: string | undefined;
  if (authUser.user?.id) {
    const porcentajeInicial = parsed.data.rol === "administrador" ? 100 : 30;
    const { error: empError } = await admin.from("empleados").insert({
      usuario_id: authUser.user.id,
      nombre: parsed.data.nombre,
      telefono: null,
      porcentaje_comision: porcentajeInicial,
      activo: true,
    });
    if (empError) {
      // No se revierte el usuario: se puede vincular el empleado
      // manualmente después. Pero se avisa para que no pase desapercibido.
      console.error("No se pudo crear el empleado automático:", empError.message);
      advertenciaEmpleado =
        " El empleado no se creó automáticamente; vincúlalo manualmente en Empleados.";
    }
  }

  return {
    ok: true,
    message: `Usuario ${parsed.data.nombre} creado correctamente.${advertenciaEmpleado ?? ""}`,
  };
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

/** Cuenta los administradores ACTIVOS (service role). */
async function contarAdminsActivos(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await admin
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("rol", "administrador")
    .eq("activo", true);
  return count ?? 0;
}

/**
 * Activa o desactiva un usuario (solo admin).
 * Protección: no se puede desactivar al ÚLTIMO administrador activo.
 */
export async function toggleUsuarioActivo(
  id: string,
  activo: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("administrador");
  const admin = createAdminClient();

  // Si se intenta desactivar, verificar que no sea el último admin activo.
  if (!activo) {
    const { data: target } = await admin
      .from("usuarios")
      .select("rol")
      .eq("id", id)
      .maybeSingle();
    if (target?.rol === "administrador") {
      const adminsActivos = await contarAdminsActivos(admin);
      if (adminsActivos <= 1) {
        return {
          ok: false,
          error:
            "No se puede desactivar al último administrador activo. Debe haber al menos un administrador en el sistema.",
        };
      }
    }
  }

  const { error } = await admin.from("usuarios").update({ activo }).eq("id", id);
  if (error) {
    return { ok: false, error: "No se pudo actualizar el usuario." };
  }
  return { ok: true };
}

/**
 * Cambia el rol de un usuario (solo admin).
 * Protección: no se puede degradar al ÚLTIMO administrador activo.
 */
export async function cambiarRolUsuario(
  id: string,
  rol: "administrador" | "colaborador",
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("administrador");
  const admin = createAdminClient();

  // Si se intenta quitar el rol admin, verificar que no sea el último.
  if (rol === "colaborador") {
    const { data: target } = await admin
      .from("usuarios")
      .select("rol")
      .eq("id", id)
      .maybeSingle();
    if (target?.rol === "administrador") {
      const adminsActivos = await contarAdminsActivos(admin);
      if (adminsActivos <= 1) {
        return {
          ok: false,
          error:
            "No se puede quitar el rol de administrador al último administrador activo. Debe haber al menos un administrador en el sistema.",
        };
      }
    }
  }

  const { error } = await admin.from("usuarios").update({ rol }).eq("id", id);
  if (error) {
    return { ok: false, error: "No se pudo actualizar el rol." };
  }
  return { ok: true };
}