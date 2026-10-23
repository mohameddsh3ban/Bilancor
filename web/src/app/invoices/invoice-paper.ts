import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  countryName,
  formatDate,
  formatIban,
  formatMoney,
  formatMonth,
  formatNumber,
} from '../core/format/format';
import type { Business, Invoice, InvoiceUnit, TaxNote } from '../data/models';
import { invoiceText, type InvoiceTextKey } from '../domain/invoice-texts';
import {
  dueDateOf,
  effectiveTaxNote,
  effectiveVatRate,
  invoiceFileFormat,
  invoiceTotals,
} from '../domain/invoices';

const UNIT_TEXT: Record<InvoiceUnit, InvoiceTextKey> = {
  piece: 'unitPiece',
  hour: 'unitHour',
  day: 'unitDay',
  flat: 'unitFlat',
};

const NOTE_TEXT: Record<TaxNote, InvoiceTextKey> = {
  kleinunternehmer: 'noteKleinunternehmer',
  reverseCharge: 'noteReverseCharge',
  notTaxable: 'noteNotTaxable',
};

const filled = (text: string | null): text is string => text !== null && text.trim() !== '';

/** One row of the sums: a label with its amount. */
interface Sum {
  id: 'net' | 'vat' | 'total';
  label: string;
  value: string;
}

/**
 * The invoice as the customer sees it: one white sheet with the seller and a "Your logo" placeholder, the customer, the
 * title, number and dates, the lines, the sums (or the note that stands in place of VAT), how to pay, and the tax details
 * and file format of the seller. A draft says "Draft" where the number will be; a cancellation invoice is titled
 * Stornorechnung and names the invoice it cancels.
 *
 * Everything on it is the invoice's own: the words come from `invoiceText` in the invoice's language (German or English),
 * and so do the amounts, dates and the name of the customer's country. It is always laid out left to right, also in the
 * Arabic app, and says what language it is in (`lang`). A sent invoice shows the VAT and note it was sent with, not what
 * the tax details say today.
 */
@Component({
  selector: 'app-invoice-paper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let v = view();
    <article
      dir="ltr"
      class="flex flex-col gap-6 rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-900 shadow-sm sm:p-8 sm:text-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
      data-testid="invoice-paper"
      [attr.lang]="v.lang"
    >
      <header class="flex items-start justify-between gap-4">
        <div class="flex min-w-0 flex-col" data-testid="paper-seller">
          @for (line of v.seller; track $index) {
            <p class="wrap-break-word" [class.font-semibold]="$first">
              <bdi>{{ line }}</bdi>
            </p>
          }
        </div>
        <div
          class="flex h-12 w-24 shrink-0 items-center justify-center rounded border border-dashed border-neutral-300 text-[10px] text-neutral-400 sm:w-32"
          data-testid="paper-logo"
        >
          {{ v.logo }}
        </div>
      </header>

      <div class="flex flex-col" data-testid="paper-customer">
        <p class="mb-1 text-neutral-500">{{ v.recipient }}</p>
        @for (line of v.customer; track $index) {
          <p class="wrap-break-word" [class.font-semibold]="$first">
            <bdi>{{ line }}</bdi>
          </p>
        }
        @if (v.customerVatId; as vatId) {
          <p class="wrap-break-word" data-testid="paper-customer-vat-id">{{ vatId }}</p>
        }
      </div>

      <section class="flex flex-col gap-1">
        <p class="text-xl font-semibold" data-testid="paper-title">{{ v.title }}</p>
        @if (v.cancellation; as reference) {
          <p class="text-neutral-600" data-testid="paper-cancellation">{{ reference }}</p>
        }
        <dl class="mt-2 flex flex-col gap-0.5">
          @for (row of v.facts; track row.id) {
            <div class="flex gap-3" [attr.data-testid]="'paper-' + row.id">
              <dt class="w-32 shrink-0 text-neutral-500 sm:w-44">{{ row.label }}</dt>
              <dd class="min-w-0 font-medium">{{ row.value }}</dd>
            </div>
          }
        </dl>
      </section>

      <table class="w-full table-fixed border-collapse" data-testid="paper-lines">
        <thead>
          <tr class="border-b border-neutral-300 text-neutral-500">
            <th scope="col" class="py-1.5 pe-2 text-start font-medium">{{ v.columns[0] }}</th>
            <th scope="col" class="w-16 px-1 py-1.5 text-end font-medium sm:w-24">
              {{ v.columns[1] }}
            </th>
            <th scope="col" class="w-20 px-1 py-1.5 text-end font-medium sm:w-28">
              {{ v.columns[2] }}
            </th>
            <th scope="col" class="w-20 py-1.5 ps-1 text-end font-medium sm:w-28">
              {{ v.columns[3] }}
            </th>
          </tr>
        </thead>
        <tbody>
          @for (line of v.lines; track $index) {
            <tr class="border-b border-neutral-100 align-top" data-testid="paper-line">
              <td class="py-1.5 pe-2 wrap-break-word">
                <bdi>{{ line.description }}</bdi>
              </td>
              <td class="px-1 py-1.5 text-end">{{ line.quantity }}</td>
              <td class="px-1 py-1.5 text-end">{{ line.unitPrice }}</td>
              <td class="py-1.5 ps-1 text-end">{{ line.amount }}</td>
            </tr>
          }
        </tbody>
      </table>

      <dl class="ms-auto flex w-full max-w-xs flex-col gap-1">
        @for (sum of v.sums; track sum.id) {
          <div
            class="flex justify-between gap-4"
            [attr.data-testid]="'paper-' + sum.id"
            [class]="sum.id === 'total' ? 'border-t border-neutral-300 pt-1 font-semibold' : ''"
          >
            <dt [class]="sum.id === 'total' ? '' : 'text-neutral-600'">{{ sum.label }}</dt>
            <dd class="text-end">{{ sum.value }}</dd>
          </div>
        }
      </dl>

      @if (v.note; as note) {
        <p data-testid="paper-note">{{ note }}</p>
      }
      @if (v.payment; as payment) {
        <p data-testid="paper-payment">{{ payment }}</p>
        <p data-testid="paper-thanks">{{ v.thanks }}</p>
      }

      <footer class="flex flex-col gap-0.5 border-t border-neutral-200 pt-3 text-neutral-500">
        @if (v.taxIds; as taxIds) {
          <p data-testid="paper-tax-ids">{{ taxIds }}</p>
        }
        @if (v.format; as format) {
          <p data-testid="paper-format">{{ format }}</p>
        }
      </footer>
    </article>
  `,
})
export class InvoicePaper {
  /** The invoice to show: a draft, a sent invoice, or a cancellation invoice. */
  readonly invoice = input.required<Invoice>();
  /** The business that wrote it: its address, bank account and tax details, and the invoice a cancellation invoice cancels. */
  readonly business = input.required<Business>();

  /** Every word and figure on the sheet, already in the language of the invoice. */
  protected readonly view = computed(() => {
    const invoice = this.invoice();
    const business = this.business();
    const lang = invoice.language;
    const t = (key: InvoiceTextKey, params: Record<string, string | number> = {}) =>
      invoiceText(lang, key, params);
    const money = (cents: number) => formatMoney(cents, lang);
    const date = (iso: string) => formatDate(iso, lang, { year: true });

    const seller = business.invoiceProfile;
    const tax = business.taxProfile;
    const customer = invoice.customer;
    const totals = invoiceTotals(invoice, tax);
    const note = effectiveTaxNote(invoice, tax);
    const cancellation = invoice.cancels !== null;
    const original = business.invoices.find((other) => other.id === invoice.cancels);

    const format = invoiceFileFormat(invoice, tax);
    const formatText =
      format === 'pdf' ? null : t(format === 'zugferd' ? 'formatZugferd' : 'formatXrechnung');
    const leitweg =
      format === 'xrechnung' && filled(customer.leitwegId)
        ? `${t('leitwegId')} ${customer.leitwegId}`
        : null;

    const sums: Sum[] = [];
    if (note !== 'kleinunternehmer')
      sums.push({ id: 'net', label: t('net'), value: money(totals.netCents) });
    if (note === null) {
      sums.push({
        id: 'vat',
        label: t('vat', { rate: effectiveVatRate(invoice, tax) }),
        value: money(totals.vatCents),
      });
    }
    sums.push({ id: 'total', label: t('total'), value: money(totals.grossCents) });

    const service =
      invoice.servicePeriod.kind === 'date'
        ? { label: t('serviceDate'), value: date(invoice.servicePeriod.date) }
        : { label: t('servicePeriod'), value: formatMonth(invoice.servicePeriod.month, lang) };

    const iban = seller.iban;
    const due = date(dueDateOf(invoice));

    return {
      lang,
      logo: t('logoPlaceholder'),
      seller: [
        seller.name,
        seller.street,
        `${seller.postcode} ${seller.city}`.trim(),
        seller.email,
      ].filter((line) => line.trim() !== ''),
      recipient: t('recipient'),
      customer: [
        customer.name,
        customer.street,
        `${customer.postcode} ${customer.city}`.trim(),
        countryName(customer.country, lang),
      ].filter((line) => line.trim() !== ''),
      customerVatId: filled(customer.vatId) ? `${t('customerVatId')} ${customer.vatId}` : null,
      title: t(cancellation ? 'cancellationTitle' : 'title'),
      cancellation:
        cancellation && original?.number
          ? t('cancellationRef', { number: original.number, date: date(original.issueDate) })
          : null,
      facts: [
        { id: 'number', label: t('invoiceNumber'), value: invoice.number ?? t('draft') },
        { id: 'date', label: t('invoiceDate'), value: date(invoice.issueDate) },
        { id: 'service', ...service },
      ],
      columns: [t('colDescription'), t('colQuantity'), t('colUnitPrice'), t('colAmount')],
      lines: invoice.lines.map((line, index) => ({
        description: line.description,
        quantity: `${formatNumber(line.quantity, lang)} ${t(UNIT_TEXT[line.unit])}`,
        unitPrice: money(line.unitPriceCents),
        amount: money(totals.lineNets[index]),
      })),
      sums,
      note: note === null ? null : t(NOTE_TEXT[note]),
      // A cancellation invoice asks for nothing: no way to pay and no thanks.
      payment: cancellation
        ? null
        : iban
          ? t('paymentLine', { date: due, iban: formatIban(iban) })
          : t('paymentLineNoIban', { date: due }),
      thanks: t('thanks'),
      taxIds:
        [
          filled(tax.taxNumber) ? `${t('taxNumber')} ${tax.taxNumber}` : null,
          filled(tax.vatId) ? `${t('vatId')} ${tax.vatId}` : null,
        ]
          .filter((part) => part !== null)
          .join(' · ') || null,
      format:
        formatText === null
          ? null
          : [formatText, leitweg].filter((part) => part !== null).join(' · '),
    };
  });
}
