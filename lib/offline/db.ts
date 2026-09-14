/**
 * Cliente IndexedDB para la cola de acciones offline.
 * Almacena server actions que fallaron por falta de internet
 * para reintentarlas cuando vuelva la conexión.
 */

const DB_NAME = "pacho-motos-offline";
const DB_VERSION = 1;
const STORE_NAME = "action-queue";

export interface OfflineAction {
  id?: number;
  action: string;
  data: unknown;
  timestamp: number;
  status: "pending" | "processing" | "synced" | "failed";
  error?: string;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Agrega una acción a la cola offline.
 * Retorna el ID generado.
 */
export async function enqueueAction(
  action: string,
  data: unknown,
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry: Omit<OfflineAction, "id"> = {
      action,
      data,
      timestamp: Date.now(),
      status: "pending",
      retries: 0,
    };
    const request = store.add(entry);
    request.onsuccess = () => {
      db.close();
      resolve(request.result as number);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Obtiene todas las acciones pendientes (NO processing — para evitar duplicados).
 */
export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");
    const request = index.getAll(IDBKeyRange.only("pending"));
    request.onsuccess = () => {
      const results = (request.result as OfflineAction[]).sort(
        (a, b) => a.timestamp - b.timestamp,
      );
      db.close();
      resolve(results);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Marca una acción como "processing" (siendo procesada).
 * Esto evita que otra instancia de sync la procese duplicadamente.
 */
export async function markProcessing(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as OfflineAction;
      if (item) {
        item.status = "processing";
        store.put(item);
      }
      db.close();
      resolve();
    };
    getReq.onerror = () => {
      db.close();
      reject(getReq.error);
    };
  });
}

/**
 * Marca una acción como sincronizada.
 */
export async function markSynced(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as OfflineAction;
      if (item) {
        item.status = "synced";
        store.put(item);
      }
      db.close();
      resolve();
    };
    getReq.onerror = () => {
      db.close();
      reject(getReq.error);
    };
  });
}

/**
 * Marca una acción como fallida con un error.
 */
export async function markFailed(id: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as OfflineAction;
      if (item) {
        item.status = "failed";
        item.error = error;
        item.retries += 1;
        store.put(item);
      }
      db.close();
      resolve();
    };
    getReq.onerror = () => {
      db.close();
      reject(getReq.error);
    };
  });
}

/**
 * Elimina de la cola una acción sincronizada o fallida (limpieza).
 */
export async function removeAction(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Elimina acciones sincronizadas y resetea las "processing" atascadas.
 * Si una acción lleva más de 30 segundos en "processing", se asume
 * que el sync fue interrumpido (reload) y se vuelve a "pending".
 */
export async function cleanupSyncedActions(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");
    let affected = 0;
    const now = Date.now();
    const STUCK_THRESHOLD_MS = 30_000; // 30 segundos

    const request = index.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        db.close();
        resolve(affected);
        return;
      }
      const val = cursor.value;
      if (val.status === "synced") {
        cursor.delete();
        affected++;
      } else if (val.status === "failed" && (val.retries ?? 0) >= 3) {
        cursor.delete();
        affected++;
      } else if (
        val.status === "processing" &&
        now - val.timestamp > STUCK_THRESHOLD_MS
      ) {
        // Sync interrumpido: resetear a pending para reintentar
        val.status = "pending";
        store.put(val);
        affected++;
      }
      cursor.continue();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Retorna el conteo de acciones pendientes o en proceso.
 * Incluye "pending" y "processing" para que la UI no desaparezca
 * mientras el sync está corriendo.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");

    let count = 0;
    let pending = 2; // dos count requests

    function done() {
      pending--;
      if (pending === 0) {
        db.close();
        resolve(count);
      }
    }

    const r1 = index.count(IDBKeyRange.only("pending"));
    r1.onsuccess = () => { count += r1.result; done(); };
    r1.onerror = () => { db.close(); reject(r1.error); };

    const r2 = index.count(IDBKeyRange.only("processing"));
    r2.onsuccess = () => { count += r2.result; done(); };
    r2.onerror = () => { db.close(); reject(r2.error); };
  });
}

/**
 * Obtiene todas las acciones pendientes, processing Y fallidas (para UI).
 */
export async function getPendingAndFailedActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = (request.result as OfflineAction[])
        .filter((a) => a.status === "pending" || a.status === "processing" || a.status === "failed")
        .sort((a, b) => a.timestamp - b.timestamp);
      db.close();
      resolve(results);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
