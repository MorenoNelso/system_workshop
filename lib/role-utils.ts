/**
 * Overrides de permisos para CrudConfig según el rol del usuario.
 *
 * - Admin: acceso completo (crear + eliminar visibles).
 * - Colaborador: crear permitido (por defecto), eliminar oculto.
 * - Para vistas admin-only de creación: pasar `allowCreateForColaborador: false`.
 */
export function crudRoleOverrides(
  userRole: string,
  options?: { allowCreateForColaborador?: boolean },
): { hideCreate?: boolean; hideDelete?: boolean } {
  const isAdmin = userRole === "administrador";
  const allowCreate = options?.allowCreateForColaborador ?? true;

  return {
    hideDelete: !isAdmin,
    hideCreate: allowCreate ? undefined : !isAdmin,
  };
}
