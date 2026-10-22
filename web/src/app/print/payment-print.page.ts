import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatIban } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Account, Booking, Transaction } from '../data/models';
import { accountName } from '../domain/bank-connection';
import { paymentStatus } from '../domain/payment-status';
import { vatRateShown } from '../domain/tax-rules';
import { BookingLabel } from '../payments/booking-label';
import { PaymentHistory } from '../payments/payment-history';
import { PaymentStatusChip } from '../payments/payment-status-chip';
import { DemoStateService } from '../state/demo-state.service';
import { printOnceRendered } from './print-once';

/**
 * One payment of the open business as a clean page for the browser's print dialog (which can also save a
 * PDF): business, amount and status, receipt, booking, the other party's bank details and the history.
 * It sits outside the app shell and opens the print dialog once after it first renders. When the payment is
 * not there it says so and does not print.
 */
@Component({
  selector: 'app-payment-print-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    BookingLabel,
    MoneyPipe,
    NgIcon,
    PaymentHistory,
    PaymentStatusChip,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8 print:p-0' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium print:hidden"
      data-testid="print-back"
      [routerLink]="backLink()"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'print.back' | transloco }}
    </a>

    @if (payment(); as tx) {
      @let account = accountOf(tx);
      <article class="flex flex-col gap-6" data-testid="print-article">
        <header class="border-border flex flex-col gap-1 border-b pb-4">
          <p class="text-muted-foreground text-sm font-medium" data-testid="print-business">
            <bdi>{{ business().name }}</bdi>
          </p>
          <div class="flex items-start justify-between gap-3">
            <bdi dir="ltr" class="text-3xl font-semibold">
              <span
                data-testid="print-amount"
                [class]="tx.amountCents >= 0 ? 'text-positive' : 'text-negative'"
              >
                {{ tx.amountCents | money: { signed: true } }}
              </span>
            </bdi>
            <app-payment-status-chip [status]="status(tx)" />
          </div>
          <h1
            class="text-lg font-medium wrap-break-word"
            dir="auto"
            data-testid="print-counterparty"
          >
            {{ tx.counterparty }}
          </h1>
          <p class="text-muted-foreground text-sm" data-testid="print-meta">
            {{ tx.date | appDate: { year: true } }} ·
            {{ account ? nameOf(account, 'settings.bank.product.' + account.product | transloco) : '' }}
          </p>
        </header>

        <section class="flex flex-col gap-3 break-inside-avoid">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.receipt.title' | transloco }}
          </h2>
          @switch (tx.receipt) {
            @case ('attached') {
              <bdi dir="ltr" class="text-sm font-medium wrap-break-word">
                <span data-testid="print-receipt">{{ tx.receiptFile }}</span>
              </bdi>
            }
            @case ('notNeeded') {
              <p class="text-sm" data-testid="print-receipt">
                {{ 'payments.detail.receipt.notNeeded' | transloco }}
              </p>
            }
            @case ('missing') {
              <p class="text-negative text-sm font-medium" data-testid="print-receipt">
                {{ 'payments.detail.receipt.missing' | transloco }}
              </p>
            }
          }
        </section>

        <section class="flex flex-col gap-3 break-inside-avoid">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.booking.title' | transloco }}
          </h2>
          <dl class="flex flex-col gap-3 text-sm">
            <div class="flex flex-col gap-0.5">
              <dt class="text-muted-foreground">
                {{ 'terms.skr03.label' | transloco }}
                @if (showGerman()) {
                  (<bdi dir="ltr">{{ 'terms.skr03.de' | transloco }}</bdi
                  >)
                }
              </dt>
              <dd class="font-medium wrap-break-word" data-testid="print-booking">
                @if (tx.booking; as booking) {
                  <app-booking-label [booking]="booking" />
                } @else {
                  {{ 'payments.detail.booking.none' | transloco }}
                }
              </dd>
            </div>
            <div class="flex flex-col gap-0.5">
              <dt class="text-muted-foreground">{{ 'payments.detail.booking.vat' | transloco }}</dt>
              <dd class="font-medium" data-testid="print-vat">
                @if (tx.booking; as booking) {
                  @if (vatRate(booking); as rate) {
                    {{ 'payments.detail.booking.vatRate' | transloco: { rate } }}
                  } @else {
                    {{ 'payments.detail.booking.noVat' | transloco }}
                  }
                } @else {
                  —
                }
              </dd>
            </div>
          </dl>
        </section>

        <section class="flex flex-col gap-3 break-inside-avoid">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.bank.title' | transloco }}
          </h2>
          <dl class="flex flex-col gap-3 text-sm">
            @if (account?.kind !== 'cash') {
              <div class="flex flex-col gap-0.5">
                <dt class="text-muted-foreground">{{ 'payments.detail.bank.iban' | transloco }}</dt>
                <dd class="font-medium">
                  <bdi dir="ltr"
                    ><span data-testid="print-iban">{{
                      formatIban(tx.counterpartyIban)
                    }}</span></bdi
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
                  ><span data-testid="print-reference">{{ tx.reference }}</span></bdi
                >
              </dd>
            </div>
          </dl>
        </section>

        <section class="flex flex-col gap-3">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.history.title' | transloco }}
          </h2>
          <app-payment-history [entries]="tx.history" [accounts]="accounts()" [withYear]="true" />
        </section>
      </article>
    } @else {
      <p class="text-muted-foreground" role="status" data-testid="print-nothing">
        {{ 'print.nothing' | transloco }}
      </p>
    }
  `,
})
export class PaymentPrintPage {
  protected readonly nameOf = accountName;

  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(LanguageService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly business = this.demo.business;
  protected readonly accounts = computed(() => this.business().accounts);

  /** The payment to print; none when its id is unknown, belongs to another business, or no bank is connected yet. */
  protected readonly payment = computed<Transaction | null>(() => {
    if (!this.demo.bankConnected()) return null;
    return this.business().transactions.find((tx) => tx.id === this.id()) ?? null;
  });

  protected readonly backLink = computed(() => {
    const id = this.id();
    return id ? ['/payments', id] : ['/payments'];
  });
  /** German keeps only the SKR03 name; the other languages put the German original next to the translation. */
  protected readonly showGerman = computed(() => this.language.lang() !== 'de');

  protected readonly status = paymentStatus;
  protected readonly formatIban = formatIban;

  constructor() {
    printOnceRendered(() => this.payment() !== null);
  }

  protected accountOf(tx: Transaction): Account | undefined {
    return this.accounts().find((account) => account.id === tx.accountId);
  }

  /** The VAT rate to show for the booking, none when there is no VAT (always so for a small business). */
  protected vatRate(booking: Booking): number | null {
    return vatRateShown(this.business().taxProfile, booking);
  }
}
