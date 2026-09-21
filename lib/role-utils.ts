export type RolUsuario = "administrador" | "colaborador";

export function crudRoleOverrides(
  userRole: RolUsuario,
  options?: { allowCreateForColaborador?: boolean },
): { hideCreate?: boolean; hideDelete?: boolean } {
  const isAdmin = userRole === "administrador";
  const allowCreate = options?.allowCreateForColaborador ?? true;

  return {
    hideDelete: !isAdmin,
    hideCreate: allowCreate ? undefined : !isAdmin,
  };
}
