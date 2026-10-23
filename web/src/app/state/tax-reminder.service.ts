import { Injectable, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { SafeStorage } from '../core/storage/safe-storage';
import { DUE_SOON_DAYS, currentVatReturn, type VatReturnView } from '../domain/vat-return';
import { DemoStateService } from './demo-state.service';

/** Every acknowledgement is stored under this prefix, so Reset demo can clear them all at once. */
const KEY_PREFIX = 'mockup.taxReminder.';

/** A business whose VAT return is due soon, or overdue, as the reminder lists it. */
export interface TaxReminderItem {
  businessId: string;
  name: string;
  view: VatReturnView;
}

/**
 * The tax reminder that pops up when the app opens: which businesses of the person have a VAT return due within
 * `DUE_SOON_DAYS` (or overdue), and what "Got it" and "Not now" do. "Got it" is remembered per person, business and due
 * date, so the next deadline reminds again; "Not now" is remembered only until the app is opened again.
 */
@Injectable({ providedIn: 'root' })
export class TaxReminderService {
  private readonly demo = inject(DemoStateService);
  private readonly storage = inject(SafeStorage);
  private readonly router = inject(Router);

  /** Goes up whenever the acknowledgements in storage change, so `due` reads them again. */
  private readonly acknowledgements = signal(0);

  /** The businesses to remind about, the one whose return is due first on top; acknowledged ones are left out. */
  readonly due = computed<TaxReminderItem[]>(() => {
    this.acknowledgements();
    const items: TaxReminderItem[] = [];
    for (const business of this.demo.businesses) {
      const current = currentVatReturn(business);
      if (current?.kind !== 'return' || current.view.daysLeft > DUE_SOON_DAYS) continue;
      if (this.storage.get(this.key(business.id, current.view.dueDate)) !== null) continue;
      items.push({ businessId: business.id, name: business.name, view: current.view });
    }
    return items.sort((a, b) => a.view.dueDate.localeCompare(b.view.dueDate));
  });

  /**
   * Whether the pop-up is showing. It opens when the app starts and again after Reset demo (a new data generation), but
   * only when something is due then: a return that becomes due while the app is open (a changed tax answer) waits for
   * the next start.
   */
  private readonly openSignal = linkedSignal<number, boolean>({
    source: this.demo.dataGeneration,
    computation: () => untracked(this.due).length > 0,
  });
  readonly open = this.openSignal.asReadonly();

  constructor() {
    // Reset demo puts the sample data back, and with it every reminder: forget what was acknowledged.
    let generation = this.demo.dataGeneration();
    effect(() => {
      const current = this.demo.dataGeneration();
      untracked(() => {
        if (current === generation) return;
        generation = current;
        this.storage.removeWithPrefix(KEY_PREFIX);
        this.acknowledgements.update((n) => n + 1);
      });
    });
  }

  /** Acknowledges every reminder that is listed now and closes the pop-up: they stay away until their next deadline. */
  gotIt(): void {
    for (const item of this.due()) this.storage.set(this.key(item.businessId, item.view.dueDate), '1');
    this.acknowledgements.update((n) => n + 1);
    this.openSignal.set(false);
  }

  /** Closes the pop-up and nothing more: the reminders show again the next time the app is opened. */
  notNow(): void {
    this.openSignal.set(false);
  }

  /** Opens the Taxes page of a business: switches to it and closes the pop-up as Not now. */
  openTaxes(businessId: string): void {
    this.demo.setBusiness(businessId);
    this.notNow();
    void this.router.navigateByUrl('/taxes');
  }

  private key(businessId: string, dueDate: string): string {
    return `${KEY_PREFIX}${this.demo.person.id}.${businessId}.${dueDate}`;
  }
}
