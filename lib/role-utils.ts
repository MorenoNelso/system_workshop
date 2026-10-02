export type RolUsuario = "administrador" | "colaborador";

export function crudRoleOverrides(
  userRole: RolUsuario,
  options?: { allowCreateForColaborador?: boolean; allowEditForColaborador?: boolean },
): { hideCreate?: boolean; hideDelete?: boolean; hideEdit?: boolean } {
  const isAdmin = userRole === "administrador";
  const allowCreate = options?.allowCreateForColaborador ?? true;
  const allowEdit = options?.allowEditForColaborador ?? true;

  return {
    hideDelete: !isAdmin,
    hideCreate: allowCreate ? undefined : !isAdmin,
    hideEdit: allowEdit ? undefined : !isAdmin,
  };
}
