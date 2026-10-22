import { Injectable, computed, inject, signal } from '@angular/core';
import { DEMO_TODAY } from '../data/demo-date';
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
import { photoReceiptFor } from '../domain/photo-receipt';
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

/** How a photo taken for a payment ended: linked to it, or dropped (see `UploadService.addPhotoFor`). */
export type PhotoOutcome = 'linked' | 'dropped';

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

  /** The summary of the last drop, with the business it was added to and the data generation it belongs to. */
  private readonly latest = signal<{
    summary: UploadSummary;
    generation: number;
    businessId: string;
  } | null>(null);
  /**
   * The summary of the last drop, or null when there is none, it was cleared, Reset demo has wiped the data it speaks of,
   * or another business is open: the summary speaks of the documents of the business it was added to (and shows again there).
   */
  readonly summary = computed(() => {
    const latest = this.latest();
    return latest !== null &&
      latest.generation === this.demo.dataGeneration() &&
      latest.businessId === this.demo.business().id
      ? latest.summary
      : null;
  });

  /** The payments a photo is being read for, each with how its photo will end, oldest first. */
  private readonly photos = signal<ReadonlyMap<string, Promise<PhotoOutcome>>>(new Map());
  /** The payment a photo is being read for (the latest when there are several), or null when none is. */
  readonly readingFor = computed(() => [...this.photos().keys()].at(-1) ?? null);

  /** Never goes back, so a document id is never used twice in one page load, not even after a reset. */
  private idCounter = 0;
  /** How many photos were taken in this page load, for the number in their file names; it never goes back either. */
  private photoCounter = 0;
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
    this.latest.set({ summary: { added: 0, needsYou: 0, refused }, generation, businessId });
    if (reading.length === 0) return;
    setTimeout(
      () => this.finish({ businessId, generation, reading, refused, summaryVersion }),
      READING_MS,
    );
  }

  /** Removes the summary, and with it whatever a drop that is still being read would have said. */
  clearSummary(): void {
    this.summaryVersion++;
    this.latest.set(null);
  }

  /**
   * Simulates a photo of the receipt of a payment of the open business: a document `photo-<date>-<n>.jpg` shows Reading…
   * for `READING_MS`, then is a receipt made from the payment and is linked to it (by hand, not as a sure match).
   * Resolves `'linked'` when that happened, and `'dropped'` when it did not: nothing is taken when the payment is not there
   * or has its receipt already; a photo whose payment got its receipt meanwhile stays as an unlinked document; a reset
   * during reading takes it away. It never moves a business's upload pool. A second call for a payment that is being read
   * gives the photo already on its way.
   */
  addPhotoFor(paymentId: string): Promise<PhotoOutcome> {
    const running = this.photos().get(paymentId);
    if (running) return running;
    const businessId = this.demo.business().id;
    const payment = this.demo.business().transactions.find((tx) => tx.id === paymentId);
    if (payment?.receipt !== 'missing') return Promise.resolve('dropped');

    const generation = this.demo.dataGeneration();
    const id = `up-${++this.idCounter}`;
    const fileName = `photo-${DEMO_TODAY}-${++this.photoCounter}.jpg`;
    this.demo.addDocument(businessId, newReadingDoc(id, fileName, 'photo'));
    const result = photoReceiptFor(payment);
    const outcome = new Promise<PhotoOutcome>((resolve) => {
      setTimeout(() => {
        this.photos.update((all) => new Map([...all].filter(([key]) => key !== paymentId)));
        resolve(this.readPhoto({ businessId, generation, id, paymentId, result }));
      }, READING_MS);
    });
    this.photos.update((all) => new Map(all).set(paymentId, outcome));
    return outcome;
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
      this.latest.set({
        summary: { added, needsYou, refused: batch.refused },
        generation: batch.generation,
        businessId: batch.businessId,
      });
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

  /** Gives a photo its result and links it to its payment; says whether it is linked now (it is not when the payment got its receipt meanwhile, or the photo is gone). */
  private readPhoto(photo: {
    businessId: string;
    generation: number;
    id: string;
    paymentId: string;
    result: PoolResult;
  }): PhotoOutcome {
    const { businessId, generation, id, paymentId, result } = photo;
    if (this.demo.dataGeneration() !== generation) return 'dropped';
    this.demo.updateDocument(id, (doc) => applyReadResult(doc, result), businessId);
    this.demo.link(id, paymentId, false, businessId);
    const doc = this.businessOf(businessId)?.documents.find((d) => d.id === id);
    return doc?.paymentId === paymentId ? 'linked' : 'dropped';
  }

  private businessOf(businessId: string): Business | undefined {
    return this.demo.businesses.find((b) => b.id === businessId);
  }
}
