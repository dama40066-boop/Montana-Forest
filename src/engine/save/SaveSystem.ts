// #20 SAVE_SYSTEM - IndexedDB Snapshot Persistence, Version Migration & State Deserialization
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

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveGame(data: GameSaveData): Promise<void> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('IndexedDB not initialized'));
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(data, 'main_slot');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async loadGame(): Promise<GameSaveData | null> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('IndexedDB not initialized'));
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get('main_slot');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
}
