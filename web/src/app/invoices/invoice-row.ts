import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatDate } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { docName } from '../domain/document-status';
import { invoiceTotals, reminderSummary, type InvoiceRow } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceStatusChip } from './invoice-status-chip';

/** What a row of the list is called in a `@for`: an invoice by its id, a document from a file by its id. */
export const rowKey = (row: InvoiceRow): string =>
  row.kind === 'invoice' ? row.invoice.id : `file-${row.doc.id}`;

/**
 * One row of the Invoices list: the customer, the number (or "Draft") and date, the amount and the status chip, as one
 * link to the invoice (an invoice added from a file opens its document on Documents). A late invoice that was written
 * here carries its next reminder under it, as a link to the invoice with the reminder open (`?remind=1`), or says when it
 * was reminded.
 */
@Component({
  selector: 'li[app-invoice-row]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    HlmButton,
    InvoiceStatusChip,
    MoneyPipe,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'border-border block border-t first:border-t-0', 'data-testid': 'invoice-row' },
  template: `
    <a
      class="hover:bg-muted flex items-start gap-3 px-4 py-3"
      data-testid="invoice-link"
      [routerLink]="link()"
    >
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="flex items-baseline justify-between gap-3">
          <span
            class="min-w-0 truncate font-medium"
            dir="auto"
            data-testid="invoice-name"
            [id]="nameId()"
          >
            {{ name() ?? ('invoices.row.noCustomer' | transloco) }}
          </span>
          <bdi dir="ltr" class="shrink-0 font-medium">
            <span data-testid="invoice-amount">{{ amount() | money }}</span>
          </bdi>
        </span>
        <span class="text-muted-foreground text-xs" data-testid="invoice-meta">
          @if (number(); as no) {
            <bdi dir="ltr">{{ no }}</bdi>
            ·
          }
          @if (row().status === 'draft') {
            {{ 'invoices.row.draft' | transloco }} ·
          }
          {{ date() | appDate }}
          @if (row().kind === 'file') {
            · {{ 'invoices.row.fromFile' | transloco }}
          }
        </span>
        <app-invoice-status-chip class="self-start" [row]="row()" />
      </span>
      <ng-icon
        name="lucideChevronRight"
        size="16"
        class="text-muted-foreground mt-4 shrink-0 rtl:rotate-180"
        aria-hidden="true"
      />
    </a>
    @if (reminder(); as next) {
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3">
        @if (next.sentOn) {
          <p class="text-muted-foreground min-w-0 text-xs" data-testid="invoice-reminded">
            {{
              (next.from ? 'invoices.row.remindedLater' : 'invoices.row.reminded')
                | transloco: reminderWords()
            }}
          </p>
        }
        @if (next.level) {
          <a
            hlmBtn
            variant="outline"
            class="ms-auto"
            data-testid="invoice-remind"
            [routerLink]="['/invoices', next.invoiceId]"
            [queryParams]="{ remind: 1 }"
            [attr.aria-describedby]="nameId()"
          >
            {{
              (next.level === 2 ? 'invoices.row.remindFormal' : 'invoices.row.remind') | transloco
            }}
          </a>
        }
      </div>
    }
  `,
})
export class InvoiceListRow {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  readonly row = input.required<InvoiceRow>();

  private readonly invoice = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? row.invoice : null;
  });

  /** Where the row leads: the invoice, or for one added from a file its document. */
  protected readonly link = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? ['/invoices', row.invoice.id] : ['/documents', row.doc.id];
  });
  protected readonly nameId = computed(() => `invoice-name-${rowKey(this.row())}`);

  /** The customer's name, or null for a draft that has none yet. */
  protected readonly name = computed(() => {
    const row = this.row();
    const name = row.kind === 'invoice' ? row.invoice.customer.name.trim() : docName(row.doc);
    return name === '' ? null : name;
  });
  protected readonly number = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? row.invoice.number : row.doc.invoiceNo;
  });
  protected readonly date = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? row.invoice.issueDate : (row.doc.date ?? row.doc.addedOn);
  });
  /** The amount of the invoice (gross; negative for a cancellation invoice), whatever has been paid. */
  protected readonly amount = computed(() => {
    const row = this.row();
    return row.kind === 'invoice'
      ? invoiceTotals(row.invoice, this.demo.business().taxProfile).grossCents
      : (row.doc.amountCents ?? 0);
  });

  /**
   * What goes under a late invoice written here: the reminder that can be sent now (`level`), and when it was last
   * reminded (`sentOn`) with the day the formal one becomes possible (`from`); null when there is nothing to say.
   */
  protected readonly reminder = computed(() => {
    const invoice = this.invoice();
    if (invoice === null) return null;
    const summary = reminderSummary(invoice, this.demo.business());
    if (summary === null) return null;
    return { invoiceId: invoice.id, level: summary.next, sentOn: summary.lastSentOn, from: summary.availableFrom };
  });
  protected readonly reminderWords = computed(() => {
    const next = this.reminder();
    const lang = this.language.lang();
    return {
      date: next?.sentOn ? formatDate(next.sentOn, lang) : '',
      from: next?.from ? formatDate(next.from, lang) : '',
    };
  });
}
