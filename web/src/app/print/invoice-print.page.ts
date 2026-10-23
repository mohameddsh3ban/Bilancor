import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { InvoicePaper } from '../invoices/invoice-paper';
import { invoiceRowOf } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { printOnceRendered } from './print-once';

/**
 * One invoice of the open business as a clean page for the browser's print dialog (which can also save a PDF): the paper
 * alone, in the language of the invoice, with nothing of the app around it. It sits outside the app shell and opens the
 * print dialog once after it first renders. An invoice that is not there (an unknown id, another business, or one the list
 * does not show in this setup state) says so and does not print.
 */
@Component({
  selector: 'app-invoice-print-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InvoicePaper, NgIcon, RouterLink, TranslocoPipe],
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

    @if (row(); as found) {
      <app-invoice-paper [invoice]="found.invoice" [business]="business()" />
    } @else {
      <p class="text-muted-foreground" role="status" data-testid="print-nothing">
        {{ 'print.nothing' | transloco }}
      </p>
    }
  `,
})
export class InvoicePrintPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly business = this.demo.business;

  /** The invoice to print, as the list shows it; none when the id is unknown, another business's, or not shown in this setup state. */
  protected readonly row = computed(() => {
    const id = this.id();
    return id === null ? null : invoiceRowOf(this.demo.business(), this.demo.setup(), id);
  });

  /** Back to the invoice, or to the list when there is no such invoice. */
  protected readonly backLink = computed(() => {
    const found = this.row();
    return found ? ['/invoices', found.invoice.id] : ['/invoices'];
  });

  constructor() {
    printOnceRendered(() => this.row() !== null);
  }
}
