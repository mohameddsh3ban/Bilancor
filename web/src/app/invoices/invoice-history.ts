import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import type { Business, HistoryEntry, Invoice } from '../data/models';
import { isolateText } from '../payments/payment-history';

/** One line of "What happened": the stored entry, the words' blanks, and where the line leads (none: it is plain text). */
interface HistoryLine {
  entry: HistoryEntry;
  params: Record<string, string>;
  link: string[] | null;
}

const isPayment = (entry: HistoryEntry): boolean =>
  entry.key === 'invoicePaid' || entry.key === 'invoicePartlyPaid';

/**
 * What happened to an invoice, newest line first: created, sent by email, reminded, paid, cancelled. A line that speaks of
 * another record leads to it: a payment line to the payment it names (`params.paymentId`; a line written before that
 * was kept leads to the payment in the same place of the list: the payments are in the order they were linked, so the
 * oldest payment line is the first payment), "cancelled with RE-… " to the cancellation invoice, "created to cancel
 * RE-…" to the original, and "copied from RE-…" to the invoice it was copied from. Email addresses and numbers keep
 * their own direction inside an Arabic sentence.
 */
@Component({
  selector: 'app-invoice-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, RouterLink, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <ol class="flex flex-col gap-2 text-sm" data-testid="history">
      @for (line of lines(); track $index) {
        @let text = 'history.' + line.entry.key | transloco: line.params;
        <li class="flex gap-3" data-testid="history-item">
          <time
            class="text-muted-foreground w-14 shrink-0"
            data-testid="history-date"
            [attr.datetime]="line.entry.date"
          >
            {{ line.entry.date | appDate }}
          </time>
          <span class="min-w-0" data-testid="history-text">
            @if (line.link; as link) {
              <a
                class="text-primary underline-offset-4 hover:underline"
                data-testid="history-link"
                [routerLink]="link"
              >
                {{ text }}
              </a>
            } @else {
              {{ text }}
            }
          </span>
        </li>
      }
    </ol>
  `,
})
export class InvoiceHistory {
  readonly invoice = input.required<Invoice>();
  /** The open business, to tell which payments and invoices a line can lead to. */
  readonly business = input.required<Business>();

  protected readonly lines = computed<HistoryLine[]>(() => {
    const invoice = this.invoice();
    const business = this.business();
    const paymentIds = new Set(business.transactions.map((tx) => tx.id));
    // The lines run newest first, so the first payment line is the last payment: count back from there.
    let nextPayment = invoice.history.filter(isPayment).length - 1;

    return invoice.history.map((entry) => {
      const { email, number } = entry.params;
      const params = {
        ...entry.params,
        ...(email === undefined ? {} : { email: isolateText(email) }),
        ...(number === undefined ? {} : { number: isolateText(number) }),
      };
      const paymentIndex = isPayment(entry) ? nextPayment-- : -1;
      return {
        entry,
        params,
        link: this.linkOf(entry, invoice, business, paymentIds, paymentIndex),
      };
    });
  });

  /** Where a line leads: the payment (the one it names, else the one at `paymentIndex`, its place among the payments, oldest first), the cancellation invoice, the original, or the invoice it was copied from. */
  private linkOf(
    entry: HistoryEntry,
    invoice: Invoice,
    business: Business,
    paymentIds: ReadonlySet<string>,
    paymentIndex: number,
  ): string[] | null {
    switch (entry.key) {
      case 'invoicePaid':
      case 'invoicePartlyPaid': {
        const id = entry.params['paymentId'] ?? invoice.paymentIds[paymentIndex];
        return id !== undefined && paymentIds.has(id) ? ['/payments', id] : null;
      }
      case 'invoiceCancelled':
        return invoice.cancelledBy === null ? null : ['/invoices', invoice.cancelledBy];
      case 'invoiceCancellation':
        return invoice.cancels === null ? null : ['/invoices', invoice.cancels];
      case 'invoiceDuplicated': {
        const source = business.invoices.find((other) => other.number === entry.params['number']);
        return source ? ['/invoices', source.id] : null;
      }
      default:
        return null;
    }
  }
}
