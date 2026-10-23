import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { SafeStorage } from '../core/storage/safe-storage';
import { Notice } from '../data/models';
import { bankNotices } from '../domain/bank-connection';
import { docsToCheckCount, visibleDocuments } from '../domain/document-status';
import { invoiceNotices, noticesForSetup, splitNotices, withUnreadableCount } from '../domain/notices';
import { DemoStateService } from './demo-state.service';

/** Notices of the open business, with dismissals remembered per person and business. */
@Injectable({ providedIn: 'root' })
export class NoticeService {
  private readonly storage = inject(SafeStorage);
  private readonly demo = inject(DemoStateService);

  /** Dismissed ids by business id, set once something is dismissed or reset; until then read from storage per business. */
  private readonly dismissedByBusiness = signal<Record<string, readonly string[]>>({});

  private readonly dismissedIds = computed<ReadonlySet<string>>(() => {
    const businessId = this.demo.business().id;
    return new Set(this.dismissedByBusiness()[businessId] ?? this.read(businessId));
  });

  /** How many documents the open business shows that have a field to check; the "unreadable" notice counts them live. */
  private readonly unreadable = computed(() =>
    docsToCheckCount(visibleDocuments(this.demo.documents(), this.demo.setup())),
  );

  /**
   * The business's open notices whose setup step is done, with the live count of unreadable receipts. The bank notices
   * (from the accounts) and the invoice notices (from the invoices) are calculated and join the stored ones, so they are
   * dismissed, ordered and listed the same way.
   */
  private readonly applicable = computed(() => {
    const business = this.demo.business();
    return withUnreadableCount(
      noticesForSetup(
        [...business.notices, ...bankNotices(business.accounts), ...invoiceNotices(business)],
        this.demo.setup(),
        business.taxProfile,
      ),
      this.unreadable(),
    );
  });

  private readonly split = computed(() => splitNotices(this.applicable(), this.dismissedIds()));

  /** Whether the bell's history panel is open; the homepage's "+N more" sets it. */
  readonly bellOpen: WritableSignal<boolean> = signal(false);

  readonly shown = computed(() => this.split().shown);
  readonly overflow = computed(() => this.split().overflow);
  readonly unreadCount = computed(() => this.shown().length + this.overflow().length);

  readonly history = computed<Notice[]>(() => {
    const ids = this.dismissedIds();
    const dismissed = this.applicable().filter((n) => !n.blocking && ids.has(n.id));
    const business = this.demo.business();
    const earlier = noticesForSetup(business.noticeHistory, this.demo.setup(), business.taxProfile);
    return [...dismissed, ...earlier].sort((a, b) => b.date.localeCompare(a.date));
  });

  dismiss(id: string): void {
    const business = this.demo.business();
    const notice = this.applicable().find((n) => n.id === id);
    if (!notice || notice.blocking) return;
    const current = [...this.dismissedIds()];
    if (current.includes(id)) return;
    const next = [...current, id];
    this.storage.set(this.key(business.id), JSON.stringify(next));
    this.dismissedByBusiness.update((all) => ({ ...all, [business.id]: next }));
  }

  /** Brings back every dismissed notice of the person's businesses (demo only). */
  resetDismissals(): void {
    for (const business of this.demo.businesses) {
      this.storage.set(this.key(business.id), '[]');
    }
    this.dismissedByBusiness.set({});
  }

  private key(businessId: string): string {
    return `mockup.dismissed.${this.demo.person.id}.${businessId}`;
  }

  private read(businessId: string): string[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.get(this.key(businessId)) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
}
