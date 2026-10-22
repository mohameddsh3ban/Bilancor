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
import { lucideArrowLeft, lucideDownload, lucideFileText, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { map } from 'rxjs';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatIban } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { Term } from '../core/i18n/term';
import { Account, Booking, Transaction } from '../data/models';
import { setupSteps } from '../domain/home-cards';
import {
  changeCategory,
  confirmBooking,
  markNoReceiptNeeded,
  setPrivate,
} from '../domain/payment-actions';
import { paymentStatus } from '../domain/payment-status';
import { DemoStateService } from '../state/demo-state.service';
import { BookingLabel } from './booking-label';
import { CategoryPicker } from './category-picker';
import { PaymentHistory } from './payment-history';
import { PaymentStatusChip } from './payment-status-chip';

/**
 * One payment of the open business: what it is, its receipt, its booking, the other party's bank details and
 * what happened to it. Confirming, "no receipt needed", changing the category and business/private really
 * change the sample data. Below `lg` it is a page of its own; from `lg` it is the panel beside the list.
 * When the payment is not there (another business opened, an unknown id, no bank yet) it goes back to the list.
 */
@Component({
  selector: 'app-payment-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    BookingLabel,
    CategoryPicker,
    HlmButton,
    MoneyPipe,
    NgIcon,
    PaymentHistory,
    PaymentStatusChip,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideDownload, lucideFileText, lucideX })],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (payment(); as tx) {
      @let status = paymentStatus(tx);
      @let account = accountOf(tx);
      <a
        class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium lg:hidden"
        data-testid="back-link"
        routerLink="/payments"
      >
        <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
        {{ 'payments.detail.back' | transloco }}
      </a>

      <article
        class="bg-card border-border flex flex-col gap-6 rounded-xl border p-4"
        data-testid="payment-detail"
      >
        <header class="flex flex-col gap-1">
          <div class="flex items-start justify-between gap-3">
            <bdi dir="ltr" class="text-3xl font-semibold">
              <span
                data-testid="detail-amount"
                [class]="tx.amountCents >= 0 ? 'text-positive' : 'text-negative'"
              >
                {{ tx.amountCents | money: { signed: true } }}
              </span>
            </bdi>
            <div class="flex items-center gap-2">
              <span aria-live="polite"><app-payment-status-chip [status]="status" /></span>
              <a
                class="text-muted-foreground hover:bg-muted hidden size-8 items-center justify-center rounded-md lg:inline-flex"
                data-testid="close-panel"
                routerLink="/payments"
                [attr.aria-label]="'payments.detail.close' | transloco"
              >
                <ng-icon name="lucideX" size="18" aria-hidden="true" />
              </a>
            </div>
          </div>
          <h1
            class="text-lg font-medium wrap-break-word"
            dir="auto"
            data-testid="detail-counterparty"
          >
            {{ tx.counterparty }}
          </h1>
          <p class="text-muted-foreground text-sm" data-testid="detail-meta">
            {{ tx.date | appDate }} ·
            {{ account?.kind === 'cash' ? ('account.cash' | transloco) : account?.name }}
          </p>
        </header>

        <section class="flex flex-col gap-3" data-testid="receipt-section">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.receipt.title' | transloco }}
          </h2>
          @switch (tx.receipt) {
            @case ('attached') {
              <div class="flex items-center gap-3">
                <span
                  class="bg-muted text-muted-foreground flex h-14 w-11 shrink-0 items-center justify-center rounded-md border"
                  data-testid="receipt-thumbnail"
                  aria-hidden="true"
                >
                  <ng-icon name="lucideFileText" size="20" />
                </span>
                <bdi dir="ltr" class="min-w-0 text-sm font-medium wrap-break-word">
                  <span data-testid="receipt-state">{{ tx.receiptFile }}</span>
                </bdi>
              </div>
            }
            @case ('notNeeded') {
              <p class="text-sm" data-testid="receipt-state">
                {{ 'payments.detail.receipt.notNeeded' | transloco }}
              </p>
            }
            @case ('missing') {
              <p class="text-negative text-sm font-medium" data-testid="receipt-state">
                {{ 'payments.detail.receipt.missing' | transloco }}
              </p>
              @if (!tx.isPrivate) {
                <p class="text-muted-foreground text-sm">
                  {{ 'payments.detail.receipt.missingHint' | transloco }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    hlmBtn
                    size="lg"
                    type="button"
                    data-testid="no-receipt-needed"
                    (click)="noReceiptNeeded()"
                  >
                    {{ 'payments.detail.receipt.noReceiptNeeded' | transloco }}
                  </button>
                  <a
                    hlmBtn
                    variant="outline"
                    size="lg"
                    data-testid="take-photo"
                    [routerLink]="['/soon', 'photo']"
                  >
                    {{ 'payments.detail.receipt.takePhoto' | transloco }}
                  </a>
                  <a
                    hlmBtn
                    variant="outline"
                    size="lg"
                    data-testid="pick-document"
                    [routerLink]="['/soon', 'documents']"
                  >
                    {{ 'payments.detail.receipt.pickDocument' | transloco }}
                  </a>
                  <a
                    hlmBtn
                    variant="outline"
                    size="lg"
                    data-testid="self-receipt"
                    [routerLink]="['/soon', 'selfReceipt']"
                  >
                    {{ 'payments.detail.receipt.selfReceipt' | transloco }}
                  </a>
                </div>
              }
            }
          }
        </section>

        <section class="flex flex-col gap-3" data-testid="booking-section">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.booking.title' | transloco }}
          </h2>
          <dl class="flex flex-col gap-3 text-sm">
            <div class="flex flex-col gap-0.5">
              <dt class="text-muted-foreground"><app-term key="skr03" /></dt>
              <dd class="font-medium wrap-break-word" data-testid="booking-label">
                @if (tx.booking; as booking) {
                  <app-booking-label [booking]="booking" />
                } @else {
                  <span class="text-warning">{{ 'payments.detail.booking.none' | transloco }}</span>
                }
              </dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-muted-foreground">{{ 'payments.detail.booking.vat' | transloco }}</dt>
              <dd class="font-medium" data-testid="booking-vat">
                @if (!tx.booking) {
                  —
                } @else if (vatRate(tx); as rate) {
                  {{ 'payments.detail.booking.vatRate' | transloco: { rate } }}
                } @else {
                  {{ 'payments.detail.booking.noVat' | transloco }}
                }
                @if (kleinunternehmer()) {
                  <span class="text-muted-foreground block text-xs font-normal">
                    <app-term key="kleinunternehmer" />
                  </span>
                }
              </dd>
            </div>
          </dl>

          <div class="flex flex-wrap items-center gap-2">
            @if (!tx.isPrivate) {
              <app-category-picker [current]="tx.booking" (picked)="pick($event)" />
            }
            @if (status === 'confirm') {
              <button
                hlmBtn
                size="lg"
                type="button"
                data-testid="confirm-booking"
                (click)="confirm()"
              >
                {{ 'payments.detail.booking.confirm' | transloco }}
              </button>
            }
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-muted-foreground text-sm">
              {{ 'payments.detail.booking.kind' | transloco }}
            </span>
            <div
              role="group"
              class="border-border bg-card flex overflow-hidden rounded-md border text-sm"
              [attr.aria-label]="'payments.detail.booking.kind' | transloco"
            >
              @for (isPrivate of [false, true]; track isPrivate) {
                <button
                  type="button"
                  class="border-border min-h-10 border-s px-4 py-2 first:border-s-0"
                  [class]="
                    tx.isPrivate === isPrivate
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  "
                  [attr.data-testid]="isPrivate ? 'kind-private' : 'kind-business'"
                  [attr.aria-pressed]="tx.isPrivate === isPrivate"
                  (click)="markPrivate(isPrivate)"
                >
                  {{
                    (isPrivate
                      ? 'payments.detail.booking.private'
                      : 'payments.detail.booking.business'
                    ) | transloco
                  }}
                </button>
              }
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-3" data-testid="bank-section">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.bank.title' | transloco }}
          </h2>
          <dl class="flex flex-col gap-3 text-sm">
            @if (account?.kind !== 'cash') {
              <div class="flex flex-col gap-0.5">
                <dt class="text-muted-foreground">{{ 'payments.detail.bank.iban' | transloco }}</dt>
                <dd class="font-medium">
                  <bdi dir="ltr"
                    ><span data-testid="bank-iban">{{ formatIban(tx.counterpartyIban) }}</span></bdi
                  >
                </dd>
              </div>
            }
            <div class="flex flex-col gap-0.5">
              <dt class="text-muted-foreground">
                {{ 'payments.detail.bank.reference' | transloco }}
              </dt>
              <dd class="font-medium wrap-break-word">
                <bdi dir="ltr"
                  ><span data-testid="bank-reference">{{ tx.reference }}</span></bdi
                >
              </dd>
            </div>
          </dl>
        </section>

        <section class="flex flex-col gap-3" data-testid="history-section">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.history.title' | transloco }}
          </h2>
          <app-payment-history [entries]="tx.history" [accounts]="accounts()" />
        </section>

        <a
          hlmBtn
          variant="outline"
          size="lg"
          data-testid="download-pdf"
          [routerLink]="['/print/payment', tx.id]"
        >
          <ng-icon name="lucideDownload" size="16" aria-hidden="true" />
          {{ 'payments.detail.download' | transloco }}
        </a>
      </article>
    }
  `,
})
export class PaymentDetailPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly accounts = computed(() => this.demo.business().accounts);
  protected readonly kleinunternehmer = computed(
    () => this.demo.business().taxProfile.kleinunternehmer,
  );

  /** The open payment; none when its id is unknown, belongs to another business, or no bank is connected yet. */
  protected readonly payment = computed<Transaction | null>(() => {
    if (!setupSteps(this.demo.setup()).bank) return null;
    return this.demo.business().transactions.find((tx) => tx.id === this.id()) ?? null;
  });

  protected readonly paymentStatus = paymentStatus;
  protected readonly formatIban = formatIban;

  constructor() {
    effect(() => {
      if (this.payment() === null) {
        untracked(() => void this.router.navigateByUrl('/payments', { replaceUrl: true }));
      }
    });
  }

  protected accountOf(tx: Transaction): Account | undefined {
    return this.accounts().find((account) => account.id === tx.accountId);
  }

  /** A small business never charges or reclaims VAT, whatever the category's usual rate is. */
  protected vatRate(tx: Transaction): number {
    return this.kleinunternehmer() ? 0 : (tx.booking?.vatRate ?? 0);
  }

  // Each action changes the payment only while it still applies, so a double tap never writes a second history line.

  protected confirm(): void {
    this.change((tx) => (paymentStatus(tx) === 'confirm' ? confirmBooking(tx) : tx));
  }

  protected noReceiptNeeded(): void {
    this.change((tx) => (tx.receipt === 'missing' ? markNoReceiptNeeded(tx) : tx));
  }

  protected pick(booking: Booking): void {
    this.change((tx) => (tx.booking?.skr03 === booking.skr03 ? tx : changeCategory(tx, booking)));
  }

  protected markPrivate(isPrivate: boolean): void {
    this.change((tx) => setPrivate(tx, isPrivate));
  }

  private change(action: (tx: Transaction) => Transaction): void {
    const id = this.payment()?.id;
    if (id) this.demo.updateTransaction(id, action);
  }
}
