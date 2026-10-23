import { Injectable } from '@angular/core';

/** The only way the app touches browser storage. Never throws; falls back to memory. */
@Injectable({ providedIn: 'root' })
export class SafeStorage {
  private readonly memory = new Map<string, string>();

  get(key: string): string | null {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
    } catch {
      // storage blocked or missing: use memory
    }
    return this.memory.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage blocked or missing: the memory copy above is enough
    }
  }

  /** Forgets every value whose key starts with `prefix`, in memory and in browser storage (demo reset). */
  removeWithPrefix(prefix: string): void {
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
    try {
      const stored: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) stored.push(key);
      }
      for (const key of stored) localStorage.removeItem(key);
    } catch {
      // storage blocked or missing: nothing is stored there that could come back
    }
  }
}
