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
import {
  lucideArrowLeft,
  lucideDownload,
  lucideFileText,
  lucideLock,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmTooltip } from '@spartan-ng/helm/tooltip';
import { map } from 'rxjs';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatIban, formatMonthRange } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Term } from '../core/i18n/term';
import { Account, Booking, Doc, Invoice, Transaction } from '../data/models';
import { accountName } from '../domain/bank-connection';
import {
  changeCategory,
  confirmBooking,
  markNoReceiptNeeded,
  setPrivate,
} from '../domain/payment-actions';
import { invoiceOfPayment } from '../domain/invoices';
import { isClosedDate } from '../domain/months';
import { paymentStatus } from '../domain/payment-status';
import { vatRateShown } from '../domain/tax-rules';
import { DemoStateService } from '../state/demo-state.service';
import { UploadService } from '../state/upload.service';
import { BookingLabel } from './booking-label';
import { CategoryPicker } from './category-picker';
import { DocumentPicker } from './document-picker';
import { PaymentHistory, isolateText } from './payment-history';
import { PaymentStatusChip } from './payment-status-chip';

/**
 * One payment of the open business: what it is, its receipt, its booking, the other party's bank details and
 * what happened to it. Confirming, "no receipt needed", picking a document as the receipt, changing the category
 * and business/private really change the sample data (Take photo shows Reading…, then links a receipt made from the payment).
 * A payment that pays an invoice written in Invoices says so, with a link to it; picking the document of such an invoice as
 * the receipt pays the invoice (see `DemoStateService.link`). A payment that pays an invoice stays business, and says why;
 * a payment that another document links to can't be marked private either (the document has to be unlinked first). Below `lg` it is a page of its own; from `lg` it is the panel beside
 * the list.
 * A payment dated in a closed month (see `isClosedDate`) keeps everything it shows and offers none of these actions;
 * it says why instead.
 * When the payment is not there (another business opened, an unknown id, no bank yet) it goes back to the list.
 */
@Component({
  selector: 'app-payment-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    BookingLabel,
    CategoryPicker,
    DocumentPicker,
    HlmButton,
    HlmTooltip,
    MoneyPipe,
    NgIcon,
    PaymentHistory,
    PaymentStatusChip,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  viewProviders: [
    provideIcons({ lucideArrowLeft, lucideDownload, lucideFileText, lucideLock, lucideX }),
  ],
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
            {{ account ? nameOf(account, 'settings.bank.product.' + account.product | transloco) : '' }}
          </p>
          @if (paidInvoice(); as invoice) {
            <a
              class="text-primary inline-flex min-h-10 items-center self-start text-sm font-medium hover:underline"
              data-testid="pays-invoice"
              [routerLink]="['/invoices', invoice.id]"
            >
              {{ 'payments.detail.paysInvoice' | transloco: { number: isolate(invoice.number ?? '') } }}
            </a>
          }
          @if (closed()) {
            @let closedNote =
              ('payments.closedNote' | transloco: { month: monthMark }).split(monthMark);
            <p
              class="bg-muted/50 text-muted-foreground mt-1 flex items-start gap-2 rounded-md p-3 text-sm"
              data-testid="closed-note"
            >
              <ng-icon name="lucideLock" size="16" class="mt-0.5 shrink-0" aria-hidden="true" />
              <span
                >{{ closedNote[0] }}<bdi>{{ monthName() }}</bdi
                >{{ closedNote[1] }}</span
              >
            </p>
          }
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
              @if (linkedDoc(); as linked) {
                <a
                  hlmBtn
                  variant="outline"
                  size="lg"
                  class="self-start"
                  data-testid="open-document"
                  [routerLink]="['/documents', linked.id]"
                >
                  {{ 'payments.detail.receipt.openDocument' | transloco }}
                </a>
              }
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
              @if (!tx.isPrivate && !closed()) {
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
                  <button
                    hlmBtn
                    variant="outline"
                    size="lg"
                    type="button"
                    data-testid="take-photo"
                    [disabled]="photoReading()"
                    (click)="takePhoto()"
                  >
                    {{
                      (photoReading()
                        ? 'payments.detail.receipt.reading'
                        : 'payments.detail.receipt.takePhoto'
                      ) | transloco
                    }}
                  </button>
                  <app-document-picker [payment]="tx" (picked)="pickDocument($event)" />
                  <a
                    hlmBtn
                    variant="outline"
                    size="lg"
                    data-testid="self-receipt"
                    [routerLink]="['/soon', 'selfReceipt']"
                    [hlmTooltip]="'terms.eigenbeleg.explain' | transloco"
                  >
                    <span>
                      {{ 'terms.eigenbeleg.label' | transloco }}
                      @if (showGerman()) {
                        (<bdi dir="ltr">{{ 'terms.eigenbeleg.de' | transloco }}</bdi
                        >)
                      }
                    </span>
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
                @if (tx.booking; as booking) {
                  @if (vatRate(booking); as rate) {
                    {{ 'payments.detail.booking.vatRate' | transloco: { rate } }}
                  } @else {
                    {{ 'payments.detail.booking.noVat' | transloco }}
                  }
                } @else {
                  —
                }
                @if (kleinunternehmer()) {
                  <span class="text-muted-foreground block text-xs font-normal">
                    <app-term key="kleinunternehmer" />
                  </span>
                }
              </dd>
            </div>
          </dl>

          @if (!closed()) {
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

            @if (paidInvoice()) {
              <p class="text-muted-foreground text-sm" data-testid="private-blocked">
                {{ 'payments.detail.booking.privateBlockedInvoice' | transloco }}
              </p>
            } @else if (linkedDoc()) {
              <p class="text-muted-foreground text-sm" data-testid="private-blocked">
                {{ 'payments.detail.booking.privateBlocked' | transloco }}
              </p>
            } @else {
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
            }
          }
        </section>

        <section class="flex flex-col gap-3" data-testid="bank-section">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.bank.title' | transloco }}
          </h2>
          <dl class="flex flex-col gap-3 text-sm">
            @if (account?.kind !== 'cash' && tx.counterpartyIban) {
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
  protected readonly nameOf = accountName;

  private readonly demo = inject(DemoStateService);
  private readonly upload = inject(UploadService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly accounts = computed(() => this.demo.business().accounts);
  /** German keeps only its own term; the other languages put the German original next to the translation. */
  protected readonly showGerman = computed(() => this.language.lang() !== 'de');
  protected readonly kleinunternehmer = computed(
    () => this.demo.business().taxProfile.kleinunternehmer,
  );

  /** The open payment; none when its id is unknown, belongs to another business, or no bank is connected yet. */
  protected readonly payment = computed<Transaction | null>(() => {
    if (!this.demo.bankConnected()) return null;
    return this.demo.business().transactions.find((tx) => tx.id === this.id()) ?? null;
  });

  /** The document linked to the open payment, if there is one. */
  protected readonly linkedDoc = computed<Doc | null>(() => {
    const id = this.payment()?.id;
    return id ? (this.demo.documents().find((doc) => doc.paymentId === id) ?? null) : null;
  });

  /** The invoice the open payment pays (it is one of the invoice's payments), if any: a part payment of it as well. */
  protected readonly paidInvoice = computed<Invoice | null>(() => {
    const id = this.payment()?.id;
    return id ? invoiceOfPayment(this.demo.business(), id) : null;
  });

  /** Whether a photo is being read for the open payment. */
  protected readonly photoReading = computed(() => {
    const id = this.payment()?.id;
    return id !== undefined && this.upload.readingFor() === id;
  });

  /** Whether the open payment is dated in a closed month: it keeps what it shows and loses its actions. */
  protected readonly closed = computed(() => {
    const tx = this.payment();
    return tx !== null && isClosedDate(this.demo.business(), tx.date);
  });
  /** The month of the open payment by name in the language of the page ("September"), for the line about it being closed. */
  protected readonly monthName = computed(() => {
    const month = this.payment()?.date.slice(0, 7) ?? '';
    return month ? formatMonthRange(month, month, this.language.lang()) : '';
  });
  /** Stands where the month goes in the translated line, so the month can sit in a `<bdi>` of its own. */
  protected readonly monthMark = '\u0001';

  protected readonly paymentStatus = paymentStatus;
  protected readonly formatIban = formatIban;
  /** An invoice number set apart from the sentence around it, so it keeps its left-to-right order in Arabic. */
  protected readonly isolate = isolateText;

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

  /** The VAT rate to show for the booking, none when there is no VAT (always so for a small business). */
  protected vatRate(booking: Booking): number | null {
    return vatRateShown(this.demo.business().taxProfile, booking);
  }

  // Each action changes the payment only while it still applies, so a double tap never writes a second history line.

  protected confirm(): void {
    this.change((tx) => (paymentStatus(tx) === 'confirm' ? confirmBooking(tx) : tx));
  }

  protected noReceiptNeeded(): void {
    this.change((tx) => (tx.receipt === 'missing' ? markNoReceiptNeeded(tx) : tx));
  }

  /** Another category changes it; the one it already has confirms it when it still waits for confirmation. */
  protected pick(booking: Booking): void {
    this.change((tx) => {
      if (tx.booking?.skr03 !== booking.skr03) return changeCategory(tx, booking);
      return paymentStatus(tx) === 'confirm' ? confirmBooking(tx) : tx;
    });
  }

  protected markPrivate(isPrivate: boolean): void {
    this.change((tx) => setPrivate(tx, isPrivate));
  }

  /** The service links only while the receipt is still missing and the document is not linked, so a double tap links once. */
  protected pickDocument(docId: string): void {
    const id = this.payment()?.id;
    if (id) this.demo.link(docId, id);
  }

  /** Simulates a photo of the receipt: Reading… for a moment, then a receipt made from the payment is linked to it. */
  protected takePhoto(): void {
    const id = this.payment()?.id;
    if (id) void this.upload.addPhotoFor(id);
  }

  private change(action: (tx: Transaction) => Transaction): void {
    const id = this.payment()?.id;
    if (id) this.demo.updateTransaction(id, action);
  }
}
