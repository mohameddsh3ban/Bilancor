import { Injectable, inject, signal } from '@angular/core';
import type { Business, Doc, PoolResult } from '../data/models';
import { UPLOAD_POOLS } from '../data/sample-documents';
import { certainMatch } from '../domain/document-matching';
import { docNeedsYou } from '../domain/document-status';
import {
  READING_MS,
  RefuseReason,
  applyReadResult,
  checkFile,
  newReadingDoc,
  nextPoolResult,
} from '../domain/document-upload';
import { DemoStateService } from './demo-state.service';

/**
 * What the last drop of files came to. While its files are still being read `added` and `needsYou` are 0 and only
 * `refused` is known; they are filled in once the whole drop is read.
 */
export interface UploadSummary {
  added: number;
  needsYou: number;
  refused: { name: string; reason: RefuseReason }[];
}

/** A document of a drop that is being read, with the result it will get. */
interface Reading {
  id: string;
  result: PoolResult;
}

/** One drop of files, as it was when it was added. */
interface Batch {
  businessId: string;
  generation: number; // the data generation it was added in
  reading: Reading[];
  refused: UploadSummary['refused'];
  summaryVersion: number;
}

/** Simulates adding documents: a document shows Reading… for a moment, then gets the next ready-made result of its business. */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly demo = inject(DemoStateService);

  private readonly summarySignal = signal<UploadSummary | null>(null);
  /** The summary of the last drop, or null when there is none or it was cleared. */
  readonly summary = this.summarySignal.asReadonly();

  /** Never goes back, so a document id is never used twice in one page load, not even after a reset. */
  private idCounter = 0;
  /** Changes whenever the summary is replaced or cleared, so a drop that is read later cannot bring back an old summary. */
  private summaryVersion = 0;
  /** How many results each business has handed out in each data generation: a reset starts every pool over. */
  private readonly poolUsed = new Map<string, number>();

  /**
   * Adds the accepted files to the open business as documents still being read, and refuses the rest. Each result is
   * applied after `READING_MS` to the business the files were added to, whichever is open by then, unless the data was reset meanwhile.
   */
  add(files: readonly File[], source: 'photo' | 'file'): void {
    if (files.length === 0) return;
    const businessId = this.demo.business().id;
    const generation = this.demo.dataGeneration();
    const refused: UploadSummary['refused'] = [];
    const reading: Reading[] = [];
    for (const file of files) {
      const reason = checkFile(file);
      if (reason !== null) {
        refused.push({ name: file.name, reason });
        continue;
      }
      const id = `up-${++this.idCounter}`;
      this.demo.addDocument(businessId, newReadingDoc(id, file.name, source));
      reading.push({ id, result: this.nextResult(businessId, generation) });
    }
    const summaryVersion = ++this.summaryVersion;
    this.summarySignal.set({ added: 0, needsYou: 0, refused });
    if (reading.length === 0) return;
    setTimeout(
      () => this.finish({ businessId, generation, reading, refused, summaryVersion }),
      READING_MS,
    );
  }

  /** Removes the summary, and with it whatever a drop that is still being read would have said. */
  clearSummary(): void {
    this.summaryVersion++;
    this.summarySignal.set(null);
  }

  private nextResult(businessId: string, generation: number): PoolResult {
    const key = `${generation}:${businessId}`;
    const index = this.poolUsed.get(key) ?? 0;
    this.poolUsed.set(key, index + 1);
    return nextPoolResult(UPLOAD_POOLS[businessId], index);
  }

  /** Applies the results of a drop (none when the data was reset since) and, if it is still the latest summary, tells how it went. */
  private finish(batch: Batch): void {
    let added = 0;
    let needsYou = 0;
    if (this.demo.dataGeneration() === batch.generation) {
      for (const reading of batch.reading) {
        const doc = this.read(batch.businessId, reading);
        if (doc === undefined) continue;
        added++;
        if (docNeedsYou(doc)) needsYou++;
      }
    }
    if (this.summaryVersion === batch.summaryVersion) {
      this.summarySignal.set({ added, needsYou, refused: batch.refused });
    }
  }

  /** Gives one document its result and links it to the payment it surely belongs to; returns it as it is then, or undefined when it is gone. */
  private read(businessId: string, { id, result }: Reading): Doc | undefined {
    this.demo.updateDocument(id, (doc) => applyReadResult(doc, result), businessId);
    const business = this.businessOf(businessId);
    const doc = business?.documents.find((d) => d.id === id);
    if (!business || !doc) return undefined; // it was taken out while it was being read
    const payment = this.demo.bankConnected() ? certainMatch(doc, business.transactions) : null;
    if (payment) this.demo.link(id, payment.id, true, businessId);
    return this.businessOf(businessId)?.documents.find((d) => d.id === id);
  }

  private businessOf(businessId: string): Business | undefined {
    return this.demo.businesses.find((b) => b.id === businessId);
  }
}
