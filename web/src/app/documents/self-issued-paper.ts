import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatDate, formatMoney } from '../core/format/format';
import type { Business, Doc, SelfIssuedReason } from '../data/models';
import { PAPER_SHEET_CLASS } from '../invoices/invoice-paper';

/** Why there is no receipt, as the paper says it. "Something else" is the person's own text. */
const REASON_TEXT: Record<Exclude<SelfIssuedReason, 'other'>, string> = {
  lost: 'Der Beleg ist verloren gegangen.',
  machine: 'Der Automat hat keinen Beleg ausgegeben.',
  tip: 'Trinkgeld: Dafür gibt es keinen Beleg.',
  sellerNone: 'Der Verkäufer hat keinen Beleg ausgestellt.',
};

/** One row of the receipt: a label and what it says. */
interface Fact {
  id: string;
  label: string;
  value: string;
}

/**
 * The self-issued receipt (Eigenbeleg) as the tax office reads it: one white sheet like the invoice's, with who writes it, the title and
 * number, what was paid (date, amount, payee and address when known, what it was for), why there is no receipt, that no input VAT is
 * claimed, and when and by whom it was confirmed true. It is for the tax office, so it is always German and always laid out left to right,
 * also in the Arabic app, and says what language it is in (`lang`). Nothing is drawn for a document that is not a self-issued receipt.
 */
@Component({
  selector: 'app-self-issued-paper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (view(); as v) {
      <article dir="ltr" lang="de" [class]="sheetClass" data-testid="self-issued-paper">
        <header class="flex flex-col" data-testid="paper-issuer">
          @for (line of v.issuer; track $index) {
            <p class="wrap-break-word" [class.font-semibold]="$first">
              <bdi>{{ line }}</bdi>
            </p>
          }
        </header>

        <section class="flex flex-col gap-1">
          <p class="text-xl font-semibold" data-testid="paper-title">{{ v.title }}</p>
          <dl class="mt-2 flex flex-col gap-1.5">
            @for (row of v.facts; track row.id) {
              <div class="flex gap-3" [attr.data-testid]="'paper-' + row.id">
                <dt class="w-32 shrink-0 text-neutral-500 sm:w-52">{{ row.label }}</dt>
                <dd class="min-w-0 font-medium wrap-break-word">{{ row.value }}</dd>
              </div>
            }
          </dl>
        </section>

        <p class="font-medium" data-testid="paper-vat">{{ v.noVat }}</p>

        <dl class="flex flex-col gap-1.5 border-t border-neutral-200 pt-3">
          @for (row of v.confirmation; track row.id) {
            <div class="flex gap-3" [attr.data-testid]="'paper-' + row.id">
              <dt class="w-32 shrink-0 text-neutral-500 sm:w-52">{{ row.label }}</dt>
              <dd class="min-w-0 font-medium wrap-break-word">{{ row.value }}</dd>
            </div>
          }
        </dl>
      </article>
    }
  `,
})
export class SelfIssuedPaper {
  /** The document of a self-issued receipt. */
  readonly doc = input.required<Doc>();
  /** The business that writes it: its name and address are at the top of the sheet. */
  readonly business = input.required<Business>();

  protected readonly sheetClass = PAPER_SHEET_CLASS;

  /** Every word and figure on the sheet, in German; null for a document that is not a self-issued receipt. */
  protected readonly view = computed(() => {
    const doc = this.doc();
    const receipt = doc.selfIssued;
    if (receipt === null) return null;
    const profile = this.business().invoiceProfile;
    const date = (iso: string) => formatDate(iso, 'de', { year: true });
    const filled = (text: string | null): text is string => text !== null && text.trim() !== '';

    const facts: Fact[] = [
      { id: 'date', label: 'Datum der Zahlung', value: doc.date === null ? '' : date(doc.date) },
      { id: 'amount', label: 'Betrag', value: formatMoney(doc.amountCents ?? 0, 'de') },
      { id: 'payee', label: 'Zahlungsempfänger', value: doc.name ?? '' },
    ];
    if (filled(receipt.address))
      facts.push({ id: 'address', label: 'Anschrift', value: receipt.address });
    facts.push(
      { id: 'purpose', label: 'Verwendungszweck', value: receipt.purpose },
      {
        id: 'reason',
        label: 'Grund für den fehlenden Beleg',
        value:
          receipt.reason === 'other' ? (receipt.reasonText ?? '') : REASON_TEXT[receipt.reason],
      },
    );

    return {
      issuer: [
        filled(profile.name) ? profile.name : this.business().name,
        profile.street,
        `${profile.postcode} ${profile.city}`.trim(),
      ].filter((line) => line.trim() !== ''),
      title: `Eigenbeleg ${receipt.number}`,
      facts,
      noVat: 'Keine Vorsteuer',
      confirmation: [
        { id: 'issued', label: 'Ausgestellt am', value: date(receipt.issuedOn) },
        { id: 'confirmed', label: 'Bestätigt von', value: receipt.confirmedBy },
      ] satisfies Fact[],
    };
  });
}
