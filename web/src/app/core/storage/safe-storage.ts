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
}
