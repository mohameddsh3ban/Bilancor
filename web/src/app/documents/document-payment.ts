import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { Account, Doc, Transaction } from '../data/models';
import { accountName } from '../domain/bank-connection';
import { paymentCandidates } from '../domain/document-matching';
import { isClosedInvoice } from '../domain/document-status';
import { invoiceDocNote, invoicePayments } from '../domain/invoices';
import { selfIssuedPaymentFor } from '../domain/self-issued';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentPicker } from './payment-picker';

/** How many suggested payments show before the person has to search. */
const SUGGESTIONS = 3;

/**
 * The payment of a document. Not linked yet: the payments it might be (best first, at most three) each with "This
 * one", a search over all of them, and the way out for a payment that has no bank line. Linked: the payment, which
 * opens in Payments, and "Not this payment" to take the link away. While the document is still being read there is
 * nothing to link yet, so only "No payment yet." shows. For a cancelled invoice and a cancellation invoice no payment is
 * looked for: it says none is needed. The document of an invoice written in Invoices cannot be unlinked ("Not this
 * payment" is not there): the payment is the invoice's. Neither can a self-issued receipt: the payment keeps its 0 % VAT. A waiting
 * receipt that is probably the real one of a payment that has a self-issued receipt says so, and can't be linked to it (the payment
 * has a receipt already). Once part of the invoice is paid it lists the payments that came
 * in instead of looking for a first one, and in place of "Paid in cash or privately" (which is coming soon) it leads to the
 * invoice, where Mark as paid works. Each action does something only while it still applies, so a double tap writes one
 * history line on each side.
 */
@Component({
  selector: 'app-document-payment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    HlmButton,
    MoneyPipe,
    NgIcon,
    NgTemplateOutlet,
    PaymentPicker,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-3" data-testid="payment-section">
      <h2 class="text-muted-foreground text-sm font-medium">
        {{ 'documents.detail.payment.title' | transloco }}
      </h2>

      <ng-template #paymentRow let-linked>
        @let account = accountOf(linked);
        <a
          class="bg-muted/50 hover:bg-muted border-border flex items-center gap-3 rounded-lg border p-3"
          data-testid="linked-payment"
          [routerLink]="['/payments', linked.id]"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="block font-medium" data-testid="linked-name"
              ><span class="inline-block max-w-full truncate align-bottom" dir="auto">{{
                linked.counterparty
              }}</span></span
            >
            <span class="text-muted-foreground text-xs" data-testid="linked-meta">
              {{ linked.date | appDate }} ·
              {{ account ? nameOf(account, 'settings.bank.product.' + account.product | transloco) : '' }}
            </span>
          </span>
          <bdi dir="ltr" class="shrink-0 font-medium">
            <span
              data-testid="linked-amount"
              [class]="linked.amountCents >= 0 ? 'text-positive' : 'text-negative'"
              >{{ linked.amountCents | money: { signed: true } }}</span
            >
          </bdi>
          <ng-icon
            name="lucideChevronRight"
            size="16"
            class="text-muted-foreground shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
        </a>
      </ng-template>

      @if (payment(); as linked) {
        <ng-container *ngTemplateOutlet="paymentRow; context: { $implicit: linked }" />
        @if (doc().invoice === null && doc().selfIssued === null) {
          <div class="flex flex-wrap gap-2">
            <button
              hlmBtn
              variant="outline"
              size="lg"
              type="button"
              data-testid="unlink-payment"
              (click)="unlink()"
            >
              {{ 'documents.detail.payment.notThis' | transloco }}
            </button>
          </div>
        }
      } @else if (doc().reading) {
        <p class="text-sm" data-testid="payment-intro">
          {{ 'documents.detail.payment.none' | transloco }}
        </p>
      } @else if (closedKey(); as closed) {
        <p class="text-sm" data-testid="payment-closed">
          {{ 'documents.detail.payment.' + closed | transloco }}
        </p>
      } @else {
        @if (selfIssuedPayment(); as covered) {
          <p class="text-sm" data-testid="payment-self-issued">
            {{ 'documents.detail.payment.hasSelfIssued' | transloco }}
          </p>
          <ng-container *ngTemplateOutlet="paymentRow; context: { $implicit: covered }" />
        }
        @if (received(); as paid) {
          <p class="text-sm" data-testid="payment-part">
            {{ 'documents.detail.payment.partPaid' | transloco }}
          </p>
          <ul class="flex flex-col gap-2">
            @for (item of paid; track item.id) {
              <li>
                <ng-container *ngTemplateOutlet="paymentRow; context: { $implicit: item }" />
              </li>
            }
          </ul>
        } @else if (suggestions().length > 0) {
          <p class="text-sm" data-testid="payment-intro">
            {{ 'documents.detail.payment.intro' | transloco }}
          </p>
          <ul class="flex flex-col gap-2">
            @for (suggested of suggestions(); track suggested.id) {
              @let account = accountOf(suggested);
              <li
                class="border-border flex flex-col gap-2 rounded-lg border p-3"
                data-testid="payment-suggestion"
              >
                <div class="flex items-baseline justify-between gap-3">
                  <span
                    class="min-w-0 truncate font-medium"
                    dir="auto"
                    data-testid="suggestion-name"
                    [id]="'suggested-' + suggested.id"
                    >{{ suggested.counterparty }}</span
                  >
                  <bdi dir="ltr" class="shrink-0 font-medium">
                    <span data-testid="suggestion-amount">{{
                      suggested.amountCents | money: { signed: true }
                    }}</span>
                  </bdi>
                </div>
                <div class="text-muted-foreground flex min-w-0 flex-col gap-0.5 text-xs">
                  <span data-testid="suggestion-meta">
                    {{ suggested.date | appDate }} ·
                    {{ account ? nameOf(account, 'settings.bank.product.' + account.product | transloco) : '' }}
                  </span>
                  <span class="truncate">
                    <bdi dir="ltr"
                      ><span data-testid="suggestion-reference">{{
                        suggested.reference
                      }}</span></bdi
                    >
                  </span>
                </div>
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  class="self-start"
                  data-testid="link-payment"
                  [attr.aria-describedby]="'suggested-' + suggested.id"
                  (click)="link(suggested)"
                >
                  {{ 'documents.detail.payment.thisOne' | transloco }}
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="text-sm" data-testid="payment-intro">
            {{ 'documents.detail.payment.none' | transloco }}
          </p>
          <p class="text-muted-foreground text-sm" data-testid="payment-none">
            {{ 'documents.detail.payment.noMatch' | transloco }}
          </p>
        }
        <div class="flex flex-wrap items-center gap-2">
          <app-payment-picker [payments]="candidates()" (picked)="link($event)" />
          @if (doc().invoice; as written) {
            <a
              hlmBtn
              variant="outline"
              size="lg"
              data-testid="pay-in-invoice"
              [routerLink]="['/invoices', written.id]"
            >
              {{ 'documents.detail.payment.payInInvoice' | transloco }}
            </a>
          } @else {
            <a
              hlmBtn
              variant="outline"
              size="lg"
              data-testid="cash-payment"
              [routerLink]="['/soon', 'cashPayment']"
            >
              {{ 'documents.detail.payment.cash' | transloco }}
            </a>
          }
        </div>
      }
    </section>
  `,
})
export class DocumentPayment {
  protected readonly nameOf = accountName;

  private readonly demo = inject(DemoStateService);

  readonly doc = input.required<Doc>();
  /** The payment the document is linked to, if any. */
  readonly payment = input<Transaction | null>(null);

  /** Every payment the document could be linked to, best first; none while no bank is connected, since no payment shows then. */
  protected readonly candidates = computed<Transaction[]>(() =>
    this.demo.bankConnected()
      ? paymentCandidates(this.doc(), this.demo.business().transactions)
      : [],
  );
  protected readonly suggestions = computed(() => this.candidates().slice(0, SUGGESTIONS));
  /** The payments that came in on a part-paid invoice written in Invoices, the first one first; otherwise null. */
  protected readonly received = computed<Transaction[] | null>(() => {
    const doc = this.doc();
    const business = this.demo.business();
    const invoice = business.invoices.find((i) => i.id === doc.invoice?.id);
    if (!invoice || invoiceDocNote(doc, business)?.kind !== 'left') return null;
    const payments = invoicePayments(invoice, business);
    return payments.length > 0 ? payments : null;
  });
  /** The payment that already has a self-issued receipt and that this waiting document is probably the real receipt of; otherwise null. */
  protected readonly selfIssuedPayment = computed<Transaction | null>(() =>
    selfIssuedPaymentFor(this.demo.business(), this.doc()),
  );
  /** For a cancelled invoice and a cancellation invoice, the text that says no payment is needed (no payment is looked for); otherwise null. */
  protected readonly closedKey = computed(() => {
    const doc = this.doc();
    if (!isClosedInvoice(doc)) return null;
    return doc.invoice?.role === 'cancellation' ? 'closedCancellation' : 'closedCancelled';
  });

  protected accountOf(payment: Transaction): Account | undefined {
    return this.demo.business().accounts.find((account) => account.id === payment.accountId);
  }

  // The service links only a document that has no payment yet and a payment whose receipt is missing, and unlinks only a
  // linked one, so a double tap changes nothing the second time.

  protected link(payment: Transaction): void {
    this.demo.link(this.doc().id, payment.id);
  }

  protected unlink(): void {
    this.demo.unlink(this.doc().id);
  }
}
