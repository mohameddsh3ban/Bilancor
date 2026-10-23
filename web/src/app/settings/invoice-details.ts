import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatIban } from '../core/format/format';
import { DemoStateService } from '../state/demo-state.service';
import { LABEL_CLASS, ROW_CLASS, VALUE_CLASS } from './answer-rows';
import { nextNumberFor, termKey } from './invoice-form';

/** Where Edit leads: the invoice details page, which comes back here when it is saved. */
const INVOICE_PAGE = '/settings/invoice';

/**
 * Settings › Invoice details: what the business prints on its invoices in plain words (name and address, bank account,
 * number pattern with the number the next invoice gets, payment term and invoice language), and Edit. A part that is not
 * filled in says "Not given"; a new invoice's checklist asks for what it needs.
 */
@Component({
  selector: 'app-invoice-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, RouterLink, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="settings-invoice">
      <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
        <h2 hlmCardTitle>{{ 'settings.invoice.title' | transloco }}</h2>
        <a
          hlmBtn
          variant="outline"
          size="sm"
          data-testid="invoice-edit"
          [routerLink]="invoicePage"
          [queryParams]="{ from: 'settings' }"
          [attr.aria-label]="'settings.invoice.editLabel' | transloco"
        >
          {{ 'settings.invoice.edit' | transloco }}
        </a>
      </header>
      <div hlmCardContent class="flex flex-col gap-3">
        <dl class="flex flex-col gap-3 text-sm">
          <div [class]="rowClass" data-testid="invoice-address">
            <dt [class]="labelClass">{{ 'settings.invoice.address' | transloco }}</dt>
            <dd [class]="valueClass">
              @for (line of addressLines(); track $index) {
                <bdi dir="auto" class="block">{{ line }}</bdi>
              } @empty {
                {{ 'settings.invoice.notGiven' | transloco }}
              }
            </dd>
          </div>

          <div [class]="rowClass" data-testid="invoice-iban">
            <dt [class]="labelClass">{{ 'settings.invoice.iban' | transloco }}</dt>
            <dd [class]="valueClass">
              @if (iban(); as iban) {
                <bdi dir="ltr">{{ iban }}</bdi>
              } @else {
                {{ 'settings.invoice.notGiven' | transloco }}
              }
            </dd>
          </div>

          <div [class]="rowClass" data-testid="invoice-numbers">
            <dt [class]="labelClass">{{ 'settings.invoice.numbers' | transloco }}</dt>
            <dd [class]="valueClass">
              <bdi dir="ltr" data-testid="invoice-pattern">{{ profile().numberPattern }}</bdi>
              <span class="text-muted-foreground block" data-testid="invoice-next">
                {{ 'invoiceDetails.pattern.next' | transloco }}
                <bdi dir="ltr">{{ nextNumber() }}</bdi>
              </span>
            </dd>
          </div>

          <div [class]="rowClass" data-testid="invoice-term">
            <dt [class]="labelClass">{{ 'settings.invoice.term' | transloco }}</dt>
            <dd [class]="valueClass">
              {{ term().key | transloco: { days: term().days } }}
            </dd>
          </div>

          <div [class]="rowClass" data-testid="invoice-language">
            <dt [class]="labelClass">{{ 'settings.invoice.language' | transloco }}</dt>
            <dd [class]="valueClass">{{ 'invoiceDetails.language.' + profile().language | transloco }}</dd>
          </div>
        </dl>
      </div>
    </section>
  `,
})
export class InvoiceDetails {
  private readonly demo = inject(DemoStateService);

  protected readonly invoicePage = INVOICE_PAGE;
  protected readonly rowClass = ROW_CLASS;
  protected readonly labelClass = LABEL_CLASS;
  protected readonly valueClass = VALUE_CLASS;

  protected readonly profile = computed(() => this.demo.business().invoiceProfile);
  /** The name and the address, a line each, leaving out what is empty. */
  protected readonly addressLines = computed(() => {
    const { name, street, postcode, city } = this.profile();
    return [name, street, `${postcode} ${city}`].map((line) => line.trim()).filter((line) => line !== '');
  });
  protected readonly iban = computed(() => {
    const iban = this.profile().iban;
    return iban === null ? null : formatIban(iban);
  });
  /** The number the next invoice gets, from the numbers so far. */
  protected readonly nextNumber = computed(() => nextNumberFor(this.demo.business()));
  protected readonly term = computed(() => {
    const days = this.profile().paymentTermDays;
    return { key: termKey(days), days };
  });
}
