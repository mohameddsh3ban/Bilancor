import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideDownload, lucidePencil, lucideSearchX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { map } from 'rxjs';
import { formatDate } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Term, type TermKey } from '../core/i18n/term';
import { dueDateOf, invoiceFileFormat, invoiceRowOf, invoiceTotals } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceHistory } from './invoice-history';
import { InvoicePaper } from './invoice-paper';
import { InvoiceStatusChip } from './invoice-status-chip';

/**
 * One invoice written in the app (`/invoices/:id`): who it is for and where it stands, the invoice as the customer sees it,
 * what happened so far, and the next step. A draft can be edited; a sent invoice can be downloaded as a PDF (a print view).
 * From `lg` the paper sits beside what happened and the next step. An invoice that is not there (another business, an
 * unknown id, or one the list does not show in this setup state) says so and leads back to the list.
 */
@Component({
  selector: 'app-invoice-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmButton,
    InvoiceHistory,
    InvoicePaper,
    InvoiceStatusChip,
    MoneyPipe,
    NgIcon,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideDownload, lucidePencil, lucideSearchX })],
  host: { class: 'block' },
  template: `
    <div class="flex max-w-5xl flex-col gap-4" data-testid="invoice-page">
      @if (row(); as found) {
        @let invoice = found.invoice;
        <a
          class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium"
          data-testid="back-link"
          routerLink="/invoices"
        >
          <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
          {{ 'invoices.detail.back' | transloco }}
        </a>

        <header class="flex flex-col gap-1">
          <div class="flex items-start justify-between gap-3">
            <h1
              class="min-w-0 text-xl font-semibold wrap-break-word"
              dir="auto"
              data-testid="invoice-customer"
            >
              {{ name() ?? ('invoices.row.noCustomer' | transloco) }}
            </h1>
            <app-invoice-status-chip class="mt-1 shrink-0" [row]="found" />
          </div>
          <p class="text-muted-foreground text-sm" data-testid="invoice-meta">
            <app-term [key]="documentTerm()" />
            @if (invoice.number; as number) {
              &ngsp;<bdi dir="ltr">{{ number }}</bdi>
            }
            &ngsp;·&ngsp;<bdi dir="ltr">{{ gross() | money }}</bdi>
            @if (due(); as due) {
              &ngsp;·&ngsp;{{ 'invoices.detail.due' | transloco: { date: due } }}
            }
          </p>
        </header>

        <div class="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section [attr.aria-label]="'invoices.detail.paper' | transloco">
            <app-invoice-paper [invoice]="invoice" [business]="business()" />
          </section>

          <div class="flex flex-col gap-6">
            <section class="flex flex-col gap-3" data-testid="history-section">
              <h2 class="text-muted-foreground text-sm font-medium">
                {{ 'invoices.detail.history.title' | transloco }}
              </h2>
              <app-invoice-history [invoice]="invoice" [business]="business()" />
            </section>

            <!--
              The next step: the main button first, then smaller ones. What a sent invoice can still do (a reminder,
              marking it paid, copying or cancelling it) goes into this area, and only as buttons that work.
            -->
            <section class="flex flex-col gap-3" data-testid="next-step">
              <h2 class="sr-only">{{ 'invoices.detail.next.title' | transloco }}</h2>
              @if (fileFormat(); as format) {
                <p class="text-muted-foreground text-sm" data-testid="invoice-format">
                  {{ 'invoices.detail.format' | transloco }} <app-term key="eRechnung" /> ·
                  <app-term [key]="format" />
                </p>
              }
              @if (found.status === 'draft') {
                <a
                  hlmBtn
                  size="lg"
                  data-testid="edit-invoice"
                  [routerLink]="['/invoices', invoice.id, 'edit']"
                >
                  <ng-icon name="lucidePencil" size="16" aria-hidden="true" />
                  {{ 'invoices.detail.edit' | transloco }}
                </a>
              } @else {
                <a
                  hlmBtn
                  size="lg"
                  data-testid="download-pdf"
                  [routerLink]="['/print/invoice', invoice.id]"
                >
                  <ng-icon name="lucideDownload" size="16" aria-hidden="true" />
                  {{ 'invoices.detail.download' | transloco }}
                </a>
              }
            </section>
          </div>
        </div>
      } @else {
        <div
          class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
          data-testid="invoice-not-found"
        >
          <ng-icon
            name="lucideSearchX"
            size="32"
            class="text-muted-foreground"
            aria-hidden="true"
          />
          <h1 class="text-lg font-semibold">{{ 'invoices.detail.notFound.title' | transloco }}</h1>
          <p class="text-muted-foreground max-w-sm">
            {{ 'invoices.detail.notFound.body' | transloco }}
          </p>
          <a hlmBtn variant="outline" data-testid="not-found-back" routerLink="/invoices">
            {{ 'invoices.detail.notFound.back' | transloco }}
          </a>
        </div>
      }
    </div>
  `,
})
export class InvoicePage {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly business = this.demo.business;

  /** The invoice as the list shows it, with its status; none when the id is unknown, another business's, or not shown in this setup state. */
  protected readonly row = computed(() => {
    const id = this.id();
    return id === null ? null : invoiceRowOf(this.demo.business(), this.demo.setup(), id);
  });

  /** The customer's name, or null for a draft that has none yet. */
  protected readonly name = computed(() => {
    const name = this.row()?.invoice.customer.name.trim() ?? '';
    return name === '' ? null : name;
  });

  /** What the header calls the document: an invoice, or a cancellation invoice. */
  protected readonly documentTerm = computed<TermKey>(() =>
    this.row()?.invoice.cancels === null ? 'rechnung' : 'stornorechnung',
  );

  /** The amount of the invoice, gross (negative for a cancellation invoice). */
  protected readonly gross = computed(() => {
    const invoice = this.row()?.invoice;
    return invoice ? invoiceTotals(invoice, this.business().taxProfile).grossCents : 0;
  });

  /** The due date as the person reads it; none for a cancellation invoice, which asks for nothing. */
  protected readonly due = computed(() => {
    const invoice = this.row()?.invoice;
    if (!invoice || invoice.cancels !== null) return null;
    return formatDate(dueDateOf(invoice), this.language.lang());
  });

  /** The e-invoice format of the file, when it is one: ZUGFeRD or XRechnung; a plain PDF has none to name. */
  protected readonly fileFormat = computed<'zugferd' | 'xrechnung' | null>(() => {
    const invoice = this.row()?.invoice;
    if (!invoice) return null;
    const format = invoiceFileFormat(invoice, this.business().taxProfile);
    return format === 'pdf' ? null : format;
  });
}
