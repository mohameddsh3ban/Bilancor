import { Injectable, computed, inject, signal } from '@angular/core';
import { SafeStorage } from '../core/storage/safe-storage';
import { Notice } from '../data/models';
import { splitNotices } from '../domain/notices';
import { DemoStateService } from './demo-state.service';

/** Notices of the open business, with dismissals remembered per person and business. */
@Injectable({ providedIn: 'root' })
export class NoticeService {
  private readonly storage = inject(SafeStorage);
  private readonly demo = inject(DemoStateService);

  /** Dismissed ids by business id, filled from storage the first time a business is read. */
  private readonly dismissedByBusiness = signal<Record<string, readonly string[]>>({});

  private readonly dismissedIds = computed<ReadonlySet<string>>(() => {
    const businessId = this.demo.business().id;
    return new Set(this.dismissedByBusiness()[businessId] ?? this.read(businessId));
  });

  private readonly split = computed(() => splitNotices(this.demo.business().notices, this.dismissedIds()));

  readonly shown = computed(() => this.split().shown);
  readonly overflow = computed(() => this.split().overflow);
  readonly unreadCount = computed(() => this.shown().length + this.overflow().length);

  readonly history = computed<Notice[]>(() => {
    const business = this.demo.business();
    const ids = this.dismissedIds();
    const dismissed = business.notices.filter((n) => !n.blocking && ids.has(n.id));
    return [...dismissed, ...business.noticeHistory].sort((a, b) => b.date.localeCompare(a.date));
  });

  dismiss(id: string): void {
    const business = this.demo.business();
    const notice = business.notices.find((n) => n.id === id);
    if (!notice || notice.blocking) return;
    const current = [...this.dismissedIds()];
    if (current.includes(id)) return;
    const next = [...current, id];
    this.storage.set(this.key(business.id), JSON.stringify(next));
    this.dismissedByBusiness.update((all) => ({ ...all, [business.id]: next }));
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
