export interface Field {
  /** Nombre del atributo (clave en el registro). */
  name: string;
  /** Etiqueta visible del campo. */
  label: string;
  type?:
    | "text"
    | "number"
    | "email"
    | "select"
    | "textarea"
    | "checkbox";
  /** Placeholder del input. */
  placeholder?: string;
  /** Opciones para type="select" (value = uuid, label = texto). */
  options?: { value: string; label: string }[];
  /** Para type="number": mínimo y paso. */
  min?: number;
  step?: number;
  required?: boolean;
  /** Si el registro viene con relación `columna: { nombre }`, el campo lo muestra. */
  selectLabel?: (row: Record<string, unknown>) => string;
  /** Función para leer el valor del registro (por defecto row[name]). */
  get?: (row: Record<string, unknown>) => unknown;
  /** Función para escribir el valor en el FormData. */
  set?: (fd: FormData, value: unknown) => void;
  /**
   * Controla si el campo se muestra en el formulario.
   * - `true` / `undefined` → siempre visible
   * - `false` → siempre oculto
   * - función → se evalúa con el registro actual (null si es creación)
   */
  visible?: boolean | ((row: Record<string, unknown> | null) => boolean);
}

export interface CrudAction {
  label: string;
  /** id solo aplica a update/delete (create lo ignora). */
  run: (
    id: string,
    raw: Record<string, unknown>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export interface CrudConfig {
  title: string;
  singular: string;
  description?: string;
  fields: Field[];
  /** Columnas a mostrar en la tabla (names de Field). */
  columns: string[];
  /** Función para obtener el id de una fila. */
  getId?: (row: Record<string, unknown>) => string;
  create: CrudAction;
  update: CrudAction;
  delete: CrudAction;
  /** Ocultar botón de crear (para roles sin permiso). */
  hideCreate?: boolean;
  /** Ocultar columna de acciones de eliminación. */
  hideDelete?: boolean;
  /** Acciones extra por fila (ej. botón "+ Entrada"). */
  rowActions?: CrudRowAction[];
  /** Campos usados en la búsqueda por texto (si se define, aparece un buscador). */
  searchFields?: string[];
}

export interface CrudRowAction {
  label: string;
  /** Retorna un color/badge opcional para el botón. */
  className?: string;
  onClick: (row: Record<string, unknown>) => void;
}
