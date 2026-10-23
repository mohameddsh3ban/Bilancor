import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppTaxPeriodPipe } from '../core/format/tax-period.pipe';
import { Term } from '../core/i18n/term';
import { resultWording, sentPeriod } from '../domain/vat-return';
import { DemoStateService } from '../state/demo-state.service';
import { printOnceRendered } from './print-once';

/**
 * The receipt (Übertragungsprotokoll) of a VAT return the open business sent to the tax office, as a clean page for the
 * browser's print dialog (which can also save a PDF): business, period, the VAT charged and paid, the result, the day
 * it was sent, the tax office it went to and the transfer ticket. It shows what was stored when the return was sent
 * (the office too, whatever the tax number is by now) and never calculates it again. The period comes from the address (`/print/vat-return/2026-09-01`, the first day of the period). It sits
 * outside the app shell and opens the print dialog once after it first renders. A period that was not sent says so and
 * does not print.
 */
@Component({
  selector: 'app-vat-receipt-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, AppTaxPeriodPipe, MoneyPipe, NgIcon, RouterLink, Term, TranslocoPipe],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8 print:p-0' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium print:hidden"
      data-testid="print-back"
      routerLink="/taxes"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'print.back' | transloco }}
    </a>

    @if (receipt(); as receipt) {
      <!-- The terms are plain words on paper: no dotted underline that points at a tap that is not there. -->
      <article
        class="flex flex-col gap-6 print:[&_button]:no-underline"
        data-testid="print-article"
      >
        <header class="border-border flex flex-col gap-1 border-b pb-4">
          <p class="text-muted-foreground text-sm font-medium" data-testid="print-business">
            <bdi>{{ business().name }}</bdi>
          </p>
          <h1 class="text-2xl font-semibold" data-testid="receipt-title">
            <app-term key="uebertragungsprotokoll" />
          </h1>
          <p class="text-lg font-medium" data-testid="receipt-kind"><app-term key="ustva" /></p>
        </header>

        <dl class="flex flex-col text-sm sm:text-base">
          <div class="border-border flex items-baseline justify-between gap-4 border-b py-2">
            <dt class="text-muted-foreground">{{ 'taxes.send.period' | transloco }}</dt>
            <dd class="font-medium" data-testid="receipt-period">
              {{ receipt.period | appTaxPeriod }}
            </dd>
          </div>
          <div class="border-border flex items-baseline justify-between gap-4 border-b py-2">
            <dt class="text-muted-foreground">{{ 'taxes.receipt.sentOn' | transloco }}</dt>
            <dd class="font-medium">
              <bdi dir="ltr" data-testid="receipt-sent-on">{{
                receipt.sent.sentOn | appDate: { year: true }
              }}</bdi>
            </dd>
          </div>
          @if (receipt.sent.taxOffice; as name) {
            <div
              class="border-border flex items-baseline justify-between gap-4 border-b py-2"
              data-testid="receipt-office"
            >
              <dt class="text-muted-foreground"><app-term key="finanzamt" /></dt>
              <dd class="min-w-0 text-end font-medium wrap-break-word">
                <bdi dir="auto">{{ name }}</bdi>
              </dd>
            </div>
          }
          <div
            class="border-border flex items-baseline justify-between gap-4 border-b py-2"
            data-testid="receipt-charged"
          >
            <dt class="text-muted-foreground"><app-term key="umsatzsteuer" /></dt>
            <dd class="font-medium">
              <bdi dir="ltr" data-testid="receipt-charged-amount">{{
                receipt.sent.chargedCents | money
              }}</bdi>
            </dd>
          </div>
          <div
            class="border-border flex items-baseline justify-between gap-4 border-b py-2"
            data-testid="receipt-paid"
          >
            <dt class="text-muted-foreground"><app-term key="vorsteuer" /></dt>
            <dd class="font-medium">
              <bdi dir="ltr" data-testid="receipt-paid-amount">{{
                receipt.sent.paidCents | money
              }}</bdi>
            </dd>
          </div>
          <div
            class="border-border flex items-baseline justify-between gap-4 border-b py-2 font-semibold"
            data-testid="receipt-result"
          >
            <dt data-testid="receipt-result-label">
              {{ 'taxes.how.' + receipt.result.key | transloco }}
            </dt>
            <dd>
              <bdi dir="ltr" data-testid="receipt-result-amount">{{
                receipt.result.cents | money
              }}</bdi>
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2">
            <dt class="text-muted-foreground">{{ 'taxes.send.ticket' | transloco }}</dt>
            <dd class="font-medium">
              <bdi dir="ltr" data-testid="receipt-ticket">{{ receipt.sent.ticket }}</bdi>
            </dd>
          </div>
        </dl>
      </article>
    } @else {
      <p class="text-muted-foreground" role="status" data-testid="print-nothing">
        {{ 'print.nothing' | transloco }}
      </p>
    }
  `,
})
export class VatReceiptPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);

  private readonly periodStart = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('periodStart'))),
    { initialValue: this.route.snapshot.paramMap.get('periodStart') },
  );

  protected readonly business = this.demo.business;

  /** The stored return to print, with its period and how its result reads; none when that period was never sent by the open business. */
  protected readonly receipt = computed(() => {
    const sent = this.business().vatReturns.find((r) => r.periodStart === this.periodStart());
    return sent ? { sent, period: sentPeriod(sent), result: resultWording(sent) } : null;
  });

  constructor() {
    printOnceRendered(() => this.receipt() !== null);
  }
}
