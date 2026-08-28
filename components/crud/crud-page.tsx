import { CrudClient } from "./crud-client";
import type { CrudConfig } from "./types";

interface PageProps {
  config: CrudConfig;
  fetchRows: () => Promise<Record<string, unknown>[]>;
}

/**
 * Server component que carga las filas y delega el CRUD interactivo al cliente.
 * El fetch ocurre en el servidor; durante la espera Next.js muestra el
 * `loading.tsx` (skeleton) de la ruta.
 */
export async function CrudPage({ config, fetchRows }: PageProps) {
  const rows = await fetchRows();
  return <CrudClient config={config} rows={rows} />;
}
