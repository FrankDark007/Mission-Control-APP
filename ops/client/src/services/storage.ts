
import { openDB, IDBPDatabase } from 'https://esm.sh/idb@8.0.1';

/**
 * Advanced Storage Service combining IndexedDB for structured data 
 * and OPFS for binary asset persistence.
 */
export class PersistentStorage {
  private db: IDBPDatabase | null = null;

  async init() {
    this.db = await openDB('SwarmOpsLocal', 1, {
      upgrade(db) {
        db.createObjectStore('missions', { keyPath: 'id' });
        db.createObjectStore('facts', { keyPath: 'id' });
        db.createObjectStore('telemetry', { keyPath: 'timestamp' });
      },
    });
  }

  async saveMission(mission: any) {
    if (!this.db) return;
    return this.db.put('missions', mission);
  }

  async getAllMissions() {
    if (!this.db) return [];
    return this.db.getAll('missions');
  }

  /**
   * Origin Private File System (OPFS) for large asset storage (Visual Baselines).
   */
  async saveToOPFS(fileName: string, content: Blob) {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(fileName, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(content);
    await writable.close();
  }
}

export const localStore = new PersistentStorage();
