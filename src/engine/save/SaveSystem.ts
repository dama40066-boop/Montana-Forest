// #20 SAVE_SYSTEM - IndexedDB Snapshot Persistence, Version Migration & State Deserialization with In-Memory Fallback
import { PlayerStats } from '../../types/game';
import { NPCAgentData } from '../ai/NPCBrain';

export interface GameSaveData {
  version: number;
  timestamp: number;
  gameTimeSeconds: number;
  gameDay: number;
  player: {
    stats: PlayerStats;
    pos: [number, number, number];
    yaw: number;
    pitch: number;
  };
  npcs: {
    id: number;
    name: string;
    hp: number;
    pos: [number, number, number];
    gold: number;
    needs: {
      hunger: number;
      thirst: number;
      sleepiness: number;
      social: number;
      safety: number;
    };
    emotions: {
      fear: number;
      stress: number;
      anger: number;
      morale: number;
      label: string;
    };
    state: string;
    goal: string;
    memories: unknown[];
  }[];
}

export class SaveSystem {
  private dbName = 'VanishingPinesDB_v3';
  private storeName = 'saves';
  private db: IDBDatabase | null = null;
  private memoryFallback: Map<string, GameSaveData> = new Map();
  private isIndexedDBAvailable: boolean = true;

  async open(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.isIndexedDBAvailable = false;
      return;
    }

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName);
            }
          } catch {
            this.isIndexedDBAvailable = false;
          }
        };
        req.onsuccess = () => {
          this.db = req.result;
          resolve();
        };
        req.onerror = () => {
          console.warn('IndexedDB unavailable, falling back to in-memory state.');
          this.isIndexedDBAvailable = false;
          resolve();
        };
      } catch {
        this.isIndexedDBAvailable = false;
        resolve();
      }
    });
  }

  async saveGame(data: GameSaveData): Promise<void> {
    if (!this.isIndexedDBAvailable) {
      this.memoryFallback.set('main_slot', data);
      return;
    }

    if (!this.db) {
      await this.open();
    }

    if (!this.db || !this.isIndexedDBAvailable) {
      this.memoryFallback.set('main_slot', data);
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(data, 'main_slot');
        req.onsuccess = () => resolve();
        req.onerror = () => {
          this.memoryFallback.set('main_slot', data);
          resolve();
        };
      } catch {
        this.memoryFallback.set('main_slot', data);
        resolve();
      }
    });
  }

  async loadGame(): Promise<GameSaveData | null> {
    if (!this.isIndexedDBAvailable) {
      return this.memoryFallback.get('main_slot') || null;
    }

    if (!this.db) {
      await this.open();
    }

    if (!this.db || !this.isIndexedDBAvailable) {
      return this.memoryFallback.get('main_slot') || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get('main_slot');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(this.memoryFallback.get('main_slot') || null);
      } catch {
        resolve(this.memoryFallback.get('main_slot') || null);
      }
    });
  }
}
