import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import type { Transaction } from '../data/models';
import { isClosedDate } from '../domain/months';
import { canWriteSelfIssued, type SelfIssuedInput } from '../domain/self-issued';
import { DemoStateService } from '../state/demo-state.service';
import { ReceiptService } from '../state/receipt.service';
import { SelfIssuedForm } from './self-issued-form';

/**
 * Write a self-issued receipt (`/payments/:id/self-issued`): a page of its own around the form, with a way back to the payment. Creating
 * the receipt (see `ReceiptService.createSelfIssued`, from the payment's page, so a payment in a closed month is refused) takes the person
 * back to the payment, which says the receipt was written and offers Undo for a few seconds. Cancel and the Back link go back to the
 * payment too and change nothing.
 *
 * A payment that can't have a receipt (money in, private, one that has its receipt already, one in a closed month) goes back to its own
 * page, and one that is not there (another business opened, an unknown id, no bank yet) to the list.
 */
@Component({
  selector: 'app-self-issued-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, RouterLink, SelfIssuedForm, TranslocoPipe],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    <a
      class="text-primary inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium"
      data-testid="back-link"
      [routerLink]="['/payments', id()]"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'selfIssued.back' | transloco }}
    </a>

    @if (writable(); as tx) {
      <section class="bg-card border-border rounded-xl border p-4" data-testid="self-issued-card">
        <app-self-issued-form [payment]="tx" (created)="write($event)" (cancelled)="back()" />
      </section>
    }
  `,
})
export class SelfIssuedPage {
  private readonly demo = inject(DemoStateService);
  private readonly receipts = inject(ReceiptService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  /** The payment of the open business the address names; none when its id is unknown or no bank is connected yet. */
  private readonly payment = computed<Transaction | null>(() => {
    if (!this.demo.bankConnected()) return null;
    return this.demo.business().transactions.find((tx) => tx.id === this.id()) ?? null;
  });

  /** The payment while a receipt can be written for it (the same rule the payment's own page follows, closed months included). */
  protected readonly writable = computed<Transaction | null>(() => {
    const tx = this.payment();
    const business = this.demo.business();
    return tx !== null && canWriteSelfIssued(tx, (month) => isClosedDate(business, `${month}-01`))
      ? tx
      : null;
  });

  constructor() {
    effect(() => {
      if (this.writable() !== null) return;
      const tx = this.payment();
      untracked(
        () =>
          void this.router.navigate(tx === null ? ['/payments'] : ['/payments', tx.id], {
            replaceUrl: true,
          }),
      );
    });
  }

  /** Writes the receipt and goes back to the payment. The service refuses what can't be written, and then the page leaves by itself (see the constructor). */
  protected write(input: SelfIssuedInput): void {
    const tx = this.writable();
    if (tx === null || this.receipts.createSelfIssued(tx.id, input, 'payment') === null) return;
    void this.router.navigate(['/payments', tx.id], { replaceUrl: true });
  }

  protected back(): void {
    void this.router.navigate(['/payments', this.id()], { replaceUrl: true });
  }
}
