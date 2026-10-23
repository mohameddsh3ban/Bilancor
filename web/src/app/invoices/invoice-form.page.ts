import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck, lucideSearchX, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { map } from 'rxjs';
import { formatDate } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppMonthPipe } from '../core/format/month.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Term, type TermKey } from '../core/i18n/term';
import { DialogCard } from '../core/layout/dialog-card';
import { DEMO_TODAY } from '../data/demo-date';
import type { Invoice, ServicePeriod } from '../data/models';
import {
  canSendInvoice,
  dueDateOf,
  earlierLines,
  effectiveTaxNote,
  effectiveVatRate,
  invoiceChecklist,
  invoiceFileFormat,
  invoiceTotals,
  issueDateIsAllowed,
  issueDateLimits,
  nextInvoiceNumber,
  savedCustomers,
  type ChecklistItem,
} from '../domain/invoices';
import { focusAfterRender } from '../settings/form-helpers';
import { ChoiceCard, FieldError, INPUT_CLASS } from '../settings/form-parts';
import { PAYMENT_TERMS, termKey } from '../settings/invoice-form';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { CustomerFields } from './customer-fields';
import { InvoiceLines } from './invoice-lines';

/** Stands where a number or a date goes in a translated sentence, so it can sit in a left-to-right `<bdi>` of its own. */
const MARK = '\u0001';

/** How many months back "Work done in" offers, this month included. */
const MONTHS_BACK = 12;

const VAT_RATES = [19, 7] as const;

/** What the address asks for: a new invoice, a draft to edit, a sent invoice (which is not edited: its own page opens), or an invoice that is not there. */
type Target = 'new' | 'edit' | 'sent' | 'missing';

/** The `count` months up to and including the one of `today` ('YYYY-MM'), the latest first. */
function lastMonths(today: string, count: number): string[] {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return months;
}

/**
 * One screen to write an invoice (`/invoices/new`), also used to edit a draft (`/invoices/:id/edit`): the customer, what
 * you did, the dates, the language of the invoice, and "Ready to send" with what the law needs, ticking itself. On a
 * computer "Ready to send" sits beside the form.
 *
 * The draft is saved on the first change and on every change after; a new form that was only looked at saves nothing. The
 * cross goes back to the list and keeps the draft; "Delete draft" asks once. "Preview and send" (only when nothing is
 * missing) opens the send step of the invoice page. An invoice that was sent is not edited: its own page opens instead; one
 * that is not there (another business, an unknown id) says so. What is typed belongs to the open business: another business
 * or a reset starts the form over.
 */
@Component({
  selector: 'app-invoice-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMonthPipe,
    ChoiceCard,
    CustomerFields,
    DialogCard,
    FieldError,
    HlmButton,
    HlmCardImports,
    HlmDialogImports,
    InvoiceLines,
    MoneyPipe,
    NgIcon,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideCircleAlert, lucideCircleCheck, lucideSearchX, lucideX })],
  host: { class: 'block' },
  template: `
    @if (gone()) {
      <!-- The draft was deleted and the list is opening. -->
    } @else if (draft(); as invoice) {
      <div class="mx-auto flex max-w-5xl flex-col gap-4" data-testid="invoice-form">
        <header class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-2xl font-semibold" data-testid="form-title">
              {{ (id() === null ? 'invoices.new' : 'invoiceForm.titleEdit') | transloco }}
            </h1>
            <p
              role="status"
              class="text-muted-foreground text-sm empty:-mt-1"
              data-testid="draft-saved"
            >
              @if (isSaved()) {
                {{ 'invoiceForm.saved' | transloco }}
              }
            </p>
          </div>
          <a
            hlmBtn
            variant="ghost"
            size="icon-lg"
            class="shrink-0"
            routerLink="/invoices"
            data-testid="close-form"
            [attr.aria-label]="'invoiceForm.close' | transloco"
          >
            <ng-icon name="lucideX" size="20" aria-hidden="true" />
          </a>
        </header>

        <div
          class="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6"
        >
          <div class="flex min-w-0 flex-col gap-4">
            <section hlmCard size="sm" data-testid="q-customer">
              <header hlmCardHeader>
                <h2 hlmCardTitle>{{ 'invoiceForm.customer.title' | transloco }}</h2>
              </header>
              <div hlmCardContent>
                <app-customer-fields
                  [customer]="invoice.customer"
                  [saved]="customers()"
                  [needsVatId]="needsVatId()"
                  [resetKey]="formKey()"
                  (customerChange)="change({ customer: $event })"
                />
              </div>
            </section>

            <section hlmCard size="sm" data-testid="q-lines">
              <header hlmCardHeader>
                <h2 hlmCardTitle>{{ 'invoiceForm.lines.title' | transloco }}</h2>
              </header>
              <div hlmCardContent class="flex flex-col gap-4">
                <p class="text-muted-foreground text-sm" data-testid="lines-hint">
                  {{
                    (note() === null ? 'invoiceForm.lines.hintNet' : 'invoiceForm.lines.hintGross')
                      | transloco
                  }}
                </p>
                <app-invoice-lines
                  [lines]="invoice.lines"
                  [suggestions]="earlier()"
                  [resetKey]="formKey()"
                  (linesChange)="change({ lines: $event })"
                />

                @if (note(); as note) {
                  <div
                    class="bg-muted/50 flex flex-col gap-1 rounded-lg p-3 text-sm"
                    data-testid="vat-note"
                  >
                    <p>{{ 'invoiceForm.vat.note.' + note | transloco }}</p>
                    @if (noteTerm(); as term) {
                      <p class="text-muted-foreground"><app-term [key]="term" /></p>
                    }
                  </div>
                } @else {
                  <div class="flex flex-col gap-2">
                    <p class="text-muted-foreground text-sm" id="vat-title">
                      {{ 'invoiceForm.vat.title' | transloco }}
                    </p>
                    <div
                      role="radiogroup"
                      class="grid gap-2 sm:grid-cols-2"
                      aria-labelledby="vat-title"
                    >
                      @for (rate of vatRates; track rate) {
                        <app-choice-card
                          name="vat"
                          [attr.data-testid]="'vat-' + rate"
                          [checked]="invoice.vatRate === rate"
                          [hint]="
                            'invoiceForm.vat.' + (rate === 19 ? 'standard' : 'reduced') | transloco
                          "
                          (changed)="change({ vatRate: rate })"
                        >
                          {{ 'invoiceForm.vat.rate' | transloco: { rate } }}
                        </app-choice-card>
                      }
                    </div>
                  </div>
                }

                <dl class="flex flex-col gap-1 border-t pt-3 text-sm" data-testid="totals">
                  @if (note() === null) {
                    <div class="flex justify-between gap-3">
                      <dt class="text-muted-foreground">{{ 'invoiceForm.vat.net' | transloco }}</dt>
                      <dd data-testid="total-net">
                        <bdi dir="ltr">{{ totals().netCents | money }}</bdi>
                      </dd>
                    </div>
                    <div class="flex justify-between gap-3">
                      <dt class="text-muted-foreground" data-testid="total-vat-label">
                        {{ 'invoiceForm.vat.vat' | transloco: { rate: vatRate() } }}
                      </dt>
                      <dd data-testid="total-vat">
                        <bdi dir="ltr">{{ totals().vatCents | money }}</bdi>
                      </dd>
                    </div>
                  }
                  <div class="flex justify-between gap-3 text-base font-semibold">
                    <dt>{{ 'invoiceForm.vat.total' | transloco }}</dt>
                    <dd data-testid="total-gross">
                      <bdi dir="ltr">{{ totals().grossCents | money }}</bdi>
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section hlmCard size="sm" data-testid="q-dates">
              <header hlmCardHeader>
                <h2 hlmCardTitle>{{ 'invoiceForm.dates.title' | transloco }}</h2>
              </header>
              <div hlmCardContent class="flex flex-col gap-4">
                <div class="flex flex-col gap-1 text-sm">
                  <label class="flex flex-col gap-1">
                    <span class="text-muted-foreground">{{
                      'invoiceForm.dates.issueDate' | transloco
                    }}</span>
                    <input
                      type="date"
                      dir="ltr"
                      data-testid="issue-date"
                      [class]="inputClass"
                      [value]="invoice.issueDate"
                      [attr.min]="issueLimits.min"
                      [attr.max]="issueLimits.max"
                      [attr.aria-invalid]="issueDateOk() ? null : 'true'"
                      [attr.aria-describedby]="issueDateOk() ? null : 'issue-date-error'"
                      (change)="onIssueDate($event)"
                    />
                  </label>
                  @if (!issueDateOk()) {
                    <p
                      appFieldError="invoiceForm.dates.issueDateError"
                      id="issue-date-error"
                      data-testid="issue-date-error"
                    ></p>
                  }
                </div>

                <div class="flex flex-col gap-2">
                  <p class="text-muted-foreground text-sm" id="work-title">
                    {{ 'invoiceForm.dates.workDone' | transloco }}
                  </p>
                  <div
                    role="radiogroup"
                    class="grid gap-2 sm:grid-cols-2"
                    aria-labelledby="work-title"
                  >
                    <app-choice-card
                      name="service-kind"
                      data-testid="service-kind-month"
                      [checked]="invoice.servicePeriod.kind === 'month'"
                      (changed)="setServiceKind('month')"
                    >
                      {{ 'invoiceForm.dates.month' | transloco }}
                    </app-choice-card>
                    <app-choice-card
                      name="service-kind"
                      data-testid="service-kind-date"
                      [checked]="invoice.servicePeriod.kind === 'date'"
                      (changed)="setServiceKind('date')"
                    >
                      {{ 'invoiceForm.dates.day' | transloco }}
                    </app-choice-card>
                  </div>
                  @if (servicePeriod().kind === 'date') {
                    <input
                      type="date"
                      dir="ltr"
                      data-testid="service-date"
                      aria-labelledby="work-title"
                      [class]="inputClass"
                      [value]="serviceDate()"
                      (change)="onServiceDate($event)"
                    />
                  } @else {
                    <select
                      data-testid="service-month"
                      aria-labelledby="work-title"
                      [class]="inputClass"
                      (change)="onServiceMonth($event)"
                    >
                      @if (serviceMonth() === '') {
                        <option value="" selected>
                          {{ 'invoiceForm.dates.chooseMonth' | transloco }}
                        </option>
                      }
                      @for (month of months(); track month) {
                        <option [value]="month" [selected]="month === serviceMonth()">
                          {{ month | appMonth }}
                        </option>
                      }
                    </select>
                  }
                </div>

                <div class="flex flex-col gap-2">
                  <p class="text-muted-foreground text-sm" id="term-title">
                    {{ 'invoiceForm.dates.term' | transloco }}
                  </p>
                  <div
                    role="radiogroup"
                    class="grid gap-2 sm:grid-cols-3"
                    aria-labelledby="term-title"
                  >
                    @for (days of terms; track days) {
                      <app-choice-card
                        name="term"
                        [attr.data-testid]="'term-' + days"
                        [checked]="invoice.paymentTermDays === days"
                        (changed)="change({ paymentTermDays: days })"
                      >
                        {{ termKey(days) | transloco }}
                      </app-choice-card>
                    }
                  </div>
                  @let due = ('invoiceForm.dates.due' | transloco: { date: mark }).split(mark);
                  <p class="text-sm" data-testid="due-date">
                    {{ due[0] }}<bdi dir="ltr">{{ dueDate() }}</bdi
                    >{{ due[1] }}
                  </p>
                </div>
              </div>
            </section>

            <section hlmCard size="sm" data-testid="q-language">
              <header hlmCardHeader>
                <h2 hlmCardTitle id="language-title">
                  {{ 'invoiceDetails.language.title' | transloco }}
                </h2>
              </header>
              <div hlmCardContent class="flex flex-col gap-3">
                <div
                  role="radiogroup"
                  class="grid gap-2 sm:grid-cols-2"
                  aria-labelledby="language-title"
                >
                  @for (language of languages; track language) {
                    <app-choice-card
                      name="language"
                      [attr.data-testid]="'lang-' + language"
                      [checked]="invoice.language === language"
                      (changed)="change({ language })"
                    >
                      {{ 'invoiceDetails.language.' + language | transloco }}
                    </app-choice-card>
                  }
                </div>
                <p class="text-muted-foreground text-xs">
                  {{ 'invoiceDetails.language.hint' | transloco }}
                </p>
              </div>
            </section>
          </div>

          <section hlmCard size="sm" class="lg:sticky lg:top-4" data-testid="q-ready">
            <header hlmCardHeader>
              <h2 hlmCardTitle>{{ 'invoiceForm.ready.title' | transloco }}</h2>
            </header>
            <div hlmCardContent class="flex flex-col gap-4">
              <ul class="flex flex-col gap-1" data-testid="checklist">
                @for (item of checklist(); track item.key) {
                  <li
                    class="flex items-start gap-2 text-sm"
                    [attr.data-testid]="'check-' + item.key"
                    [attr.data-ok]="item.ok"
                  >
                    @if (item.ok) {
                      <ng-icon
                        name="lucideCircleCheck"
                        size="18"
                        class="text-positive mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span class="py-1">{{
                        'invoiceForm.check.' + item.key + '.ok' | transloco
                      }}</span>
                    } @else {
                      <ng-icon
                        name="lucideCircleAlert"
                        size="18"
                        class="text-negative mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      @switch (item.fixAt) {
                        @case ('settingsInvoice') {
                          <a
                            class="text-primary min-h-8 py-1 text-start font-medium underline underline-offset-4"
                            routerLink="/settings/invoice"
                            [queryParams]="settingsParams()"
                            [attr.data-testid]="'check-fix-' + item.key"
                          >
                            {{ 'invoiceForm.check.' + item.key + '.missing' | transloco }}
                          </a>
                        }
                        @case ('settingsTax') {
                          <a
                            class="text-primary min-h-8 py-1 text-start font-medium underline underline-offset-4"
                            routerLink="/settings/tax"
                            [queryParams]="settingsParams()"
                            [attr.data-testid]="'check-fix-' + item.key"
                          >
                            {{ 'invoiceForm.check.' + item.key + '.missing' | transloco }}
                          </a>
                        }
                        @default {
                          <button
                            type="button"
                            class="text-primary min-h-8 py-1 text-start font-medium underline underline-offset-4"
                            [attr.data-testid]="'check-fix-' + item.key"
                            (click)="fix(item)"
                          >
                            {{ 'invoiceForm.check.' + item.key + '.missing' | transloco }}
                          </button>
                        }
                      }
                    }
                  </li>
                }
              </ul>

              <p class="text-muted-foreground text-sm" data-testid="format">
                {{ 'invoiceForm.ready.format' | transloco }}
                @if (eFormat(); as format) {
                  <app-term key="eRechnung" /> · <app-term [key]="format" />
                } @else {
                  {{ 'invoiceForm.ready.pdf' | transloco }}
                }
              </p>

              @let numbered =
                ('invoiceForm.ready.number' | transloco: { number: mark }).split(mark);
              <p class="text-sm" data-testid="next-number">
                {{ numbered[0] }}<bdi dir="ltr" class="font-medium">{{ nextNumber() }}</bdi
                >{{ numbered[1] }}
              </p>

              <div class="flex flex-col gap-2">
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  data-testid="preview-send"
                  [disabled]="!canSend()"
                  [attr.aria-describedby]="canSend() ? null : 'send-blocked'"
                  (click)="send()"
                >
                  {{ 'invoices.detail.send' | transloco }}
                </button>
                @if (!canSend()) {
                  <p
                    class="text-muted-foreground text-sm"
                    id="send-blocked"
                    data-testid="send-blocked"
                  >
                    {{ 'invoiceForm.ready.blocked' | transloco }}
                  </p>
                }
              </div>

              @if (canDelete()) {
                <button
                  hlmBtn
                  variant="ghost"
                  type="button"
                  class="text-destructive min-h-10 self-start"
                  data-testid="delete-draft"
                  (click)="deleteOpen.set(true)"
                >
                  {{ 'invoiceForm.delete.button' | transloco }}
                </button>
              }
            </div>
          </section>
        </div>

        <!-- The question shows through the overlay: nothing of it belongs in the page. -->
        <div hidden>
          <hlm-dialog
            [state]="deleteOpen() ? 'open' : 'closed'"
            autoFocus="dialog"
            (stateChanged)="deleteOpen.set($event === 'open')"
          >
            <hlm-dialog-content
              *hlmDialogPortal
              appDialogCard
              data-testid="delete-dialog"
              [closeLabel]="'invoiceForm.delete.close' | transloco"
            >
              <hlm-dialog-header class="pe-8">
                <h2
                  hlmDialogTitle
                  class="text-lg leading-snug font-semibold"
                  data-testid="delete-title"
                >
                  {{ 'invoiceForm.delete.title' | transloco }}
                </h2>
              </hlm-dialog-header>
              <p data-testid="delete-body">{{ 'invoiceForm.delete.body' | transloco }}</p>
              <hlm-dialog-footer>
                <button
                  hlmBtn
                  type="button"
                  variant="outline"
                  class="min-h-10"
                  data-testid="delete-keep"
                  (click)="deleteOpen.set(false)"
                >
                  {{ 'invoiceForm.delete.keep' | transloco }}
                </button>
                <button
                  hlmBtn
                  type="button"
                  variant="destructive"
                  class="min-h-10"
                  data-testid="delete-confirm"
                  (click)="deleteDraft()"
                >
                  {{ 'invoiceForm.delete.confirm' | transloco }}
                </button>
              </hlm-dialog-footer>
            </hlm-dialog-content>
          </hlm-dialog>
        </div>
      </div>
    } @else if (target() === 'missing') {
      <div
        class="bg-card border-border mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
        data-testid="form-not-found"
      >
        <ng-icon name="lucideSearchX" size="32" class="text-muted-foreground" aria-hidden="true" />
        <h1 class="text-lg font-semibold">{{ 'invoices.detail.notFound.title' | transloco }}</h1>
        <p class="text-muted-foreground max-w-sm">
          {{ 'invoices.detail.notFound.body' | transloco }}
        </p>
        <a hlmBtn variant="outline" data-testid="not-found-back" routerLink="/invoices">
          {{ 'invoices.detail.notFound.back' | transloco }}
        </a>
      </div>
    }
  `,
})
export class InvoiceFormPage {
  private readonly demo = inject(DemoStateService);
  private readonly invoices = inject(InvoiceService);
  private readonly language = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly customerFields = viewChild(CustomerFields);
  private readonly invoiceLines = viewChild(InvoiceLines);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly mark = MARK;
  protected readonly vatRates = VAT_RATES;
  /** The days the invoice date can be: from 1 January of this year up to today. */
  protected readonly issueLimits = issueDateLimits();
  protected readonly terms = PAYMENT_TERMS;
  protected readonly termKey = termKey;
  protected readonly languages = ['de', 'en'] as const;
  protected readonly deleteOpen = signal(false);

  /** The invoice of the address (`/invoices/:id/edit`); null on `/invoices/new`. */
  protected readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  private readonly business = this.demo.business;

  protected readonly target = computed<Target>(() => {
    const id = this.id();
    if (id === null) return 'new';
    const found = this.business().invoices.find((invoice) => invoice.id === id);
    if (!found) return 'missing';
    return found.sentOn === null ? 'edit' : 'sent';
  });

  /** What is typed belongs to the open business, its data and the invoice of the address: another one, or a reset, starts the form over. */
  protected readonly formKey = computed(
    () => `${this.business().id}|${this.demo.dataGeneration()}|${this.id() ?? ''}`,
  );

  /** The draft as typed so far: a new one (not saved until something changes), or the stored draft; null for an invoice that cannot be edited. */
  protected readonly draft = linkedSignal<string, Invoice | null>({
    source: this.formKey,
    computation: () =>
      untracked(() => {
        switch (this.target()) {
          case 'new':
            return this.invoices.newDraft();
          case 'edit':
            return this.business().invoices.find((invoice) => invoice.id === this.id()) ?? null;
          default:
            return null;
        }
      }),
  });

  /** Set once the draft is deleted, until the list has opened. */
  protected readonly gone = linkedSignal<string, boolean>({
    source: this.formKey,
    computation: () => false,
  });

  /** The draft is saved in the open business (a new form is, from its first change). */
  protected readonly isSaved = computed(() => {
    const draft = this.draft();
    return draft !== null && this.business().invoices.some((invoice) => invoice.id === draft.id);
  });
  protected readonly canDelete = computed(
    () => this.isSaved() && this.invoices.sending() !== this.draft()?.id,
  );

  private readonly profile = computed(() => this.business().taxProfile);
  private readonly others = computed(() => ({
    ...this.business(),
    invoices: this.business().invoices.filter((invoice) => invoice.id !== this.draft()?.id),
  }));

  /** The customers an invoice was sent to, the most recent first (a draft's customer, this one's too, is not among them). */
  protected readonly customers = computed(() => savedCustomers(this.business()));
  /** The lines of the other invoices, the most recent first, to suggest from. */
  protected readonly earlier = computed(() => earlierLines(this.others()));

  protected readonly note = computed(() => {
    const draft = this.draft();
    return draft === null ? null : effectiveTaxNote(draft, this.profile());
  });
  protected readonly noteTerm = computed<TermKey | null>(() => {
    switch (this.note()) {
      case 'kleinunternehmer':
        return 'kleinunternehmer';
      case 'reverseCharge':
        return 'reverseCharge';
      default:
        return null;
    }
  });
  protected readonly needsVatId = computed(() => this.note() === 'reverseCharge');
  protected readonly vatRate = computed(() => {
    const draft = this.draft();
    return draft === null ? 0 : effectiveVatRate(draft, this.profile());
  });
  protected readonly totals = computed(() => {
    const draft = this.draft();
    return draft === null
      ? { lineNets: [], netCents: 0, vatCents: 0, grossCents: 0 }
      : invoiceTotals(draft, this.profile());
  });

  protected readonly checklist = computed(() => {
    const draft = this.draft();
    return draft === null ? [] : invoiceChecklist(draft, this.business(), this.demo.setup());
  });
  protected readonly canSend = computed(() => {
    const draft = this.draft();
    return draft !== null && canSendInvoice(draft, this.business(), this.demo.setup());
  });

  /** The e-invoice format the invoice goes out in, when it is one (ZUGFeRD or XRechnung); a plain PDF has none to name. */
  protected readonly eFormat = computed<'zugferd' | 'xrechnung' | null>(() => {
    const draft = this.draft();
    const format = draft === null ? 'pdf' : invoiceFileFormat(draft, this.profile());
    return format === 'pdf' ? null : format;
  });
  protected readonly nextNumber = computed(() =>
    nextInvoiceNumber(this.business(), DEMO_TODAY.slice(0, 4)),
  );
  protected readonly dueDate = computed(() => {
    const draft = this.draft();
    return draft === null ? '' : formatDate(dueDateOf(draft), this.language.lang(), { year: true });
  });

  protected readonly issueDateOk = computed(() => {
    const draft = this.draft();
    return draft === null || issueDateIsAllowed(draft.issueDate);
  });

  protected readonly servicePeriod = computed<ServicePeriod>(
    () => this.draft()?.servicePeriod ?? { kind: 'month', month: DEMO_TODAY.slice(0, 7) },
  );
  protected readonly serviceMonth = computed(() => {
    const period = this.servicePeriod();
    return period.kind === 'month' ? period.month : '';
  });
  protected readonly serviceDate = computed(() => {
    const period = this.servicePeriod();
    return period.kind === 'date' ? period.date : '';
  });
  /** The months to choose from, this month first; a month the draft has that is not among them is added. */
  protected readonly months = computed(() => {
    const months = lastMonths(DEMO_TODAY, MONTHS_BACK);
    const month = this.serviceMonth();
    return month === '' || months.includes(month) ? months : [...months, month];
  });

  /** Where Settings leads back to: this draft when it is saved, otherwise a new invoice. */
  protected readonly settingsParams = computed(() => {
    const draft = this.draft();
    return draft !== null && this.isSaved()
      ? { from: 'invoice', invoice: draft.id }
      : { from: 'invoice' };
  });

  constructor() {
    // A draft that was sent meanwhile (from the send step, which went on while this page was open) is not edited: its page opens.
    effect(() => {
      if (this.target() !== 'sent') return;
      const id = untracked(() => this.id());
      untracked(() => void this.router.navigate(['/invoices', id], { replaceUrl: true }));
    });
  }

  /**
   * Changes the draft and saves it: the first change of a new form saves the draft, every one after replaces it. The
   * first save also gives the history entry of the page the address of the draft (without leaving the page, so the cursor
   * stays where it is): the browser's Back button, from Settings or from the invoice, then returns to this draft and not
   * to an empty new form.
   */
  protected change(patch: Partial<Invoice>): void {
    const current = this.draft();
    if (current === null) return;
    const firstSave = this.id() === null && !this.isSaved();
    const next = { ...current, ...patch };
    this.draft.set(next);
    this.invoices.saveDraft(next);
    if (firstSave && this.isSaved())
      this.location.replaceState(`/invoices/${encodeURIComponent(next.id)}/edit`);
  }

  /** The invoice date is committed (a date field gives its value when it is complete): an emptied field goes back to the date the invoice has. */
  protected onIssueDate(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value === '') input.value = this.draft()?.issueDate ?? '';
    else this.change({ issueDate: input.value });
  }

  protected onServiceDate(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value === '') input.value = this.serviceDate();
    else this.change({ servicePeriod: { kind: 'date', date: input.value } });
  }

  protected onServiceMonth(event: Event): void {
    this.change({
      servicePeriod: { kind: 'month', month: (event.target as HTMLSelectElement).value },
    });
  }

  /**
   * Work done in a month, or on one day. Changing over keeps what was chosen as far as it goes: a month becomes the invoice
   * date when that is in it, otherwise the first of the month; a day becomes its month.
   */
  protected setServiceKind(kind: 'month' | 'date'): void {
    const draft = this.draft();
    const period = this.servicePeriod();
    if (draft === null || period.kind === kind) return;
    if (period.kind === 'month') {
      const date =
        period.month !== '' && !draft.issueDate.startsWith(period.month)
          ? `${period.month}-01`
          : draft.issueDate;
      this.change({ servicePeriod: { kind: 'date', date } });
    } else {
      this.change({ servicePeriod: { kind: 'month', month: period.date.slice(0, 7) } });
    }
  }

  /** A checklist item that is fixed in the form: the cursor goes to the field it is about. */
  protected fix(item: ChecklistItem): void {
    switch (item.fixAt) {
      case 'customer':
        this.customerFields()?.focusField(item.key);
        break;
      case 'lines':
        this.invoiceLines()?.focusFirstIncomplete();
        break;
      case 'dates':
        focusAfterRender(
          this.injector,
          this.host.nativeElement,
          item.key === 'issueDate'
            ? '[data-testid="issue-date"]'
            : '[data-testid="service-month"], [data-testid="service-date"]',
        );
        break;
    }
  }

  /** Opens the send step of the draft (on the invoice page); only a draft that has everything it needs. */
  protected send(): void {
    const draft = this.draft();
    if (draft === null || !this.canSend()) return;
    this.invoices.saveDraft(draft);
    void this.router.navigate(['/invoices', draft.id], { queryParams: { send: 1 } });
  }

  /** The draft is removed for good and the list opens (replacing this page in the history: Back must not return to a draft that is gone). */
  protected deleteDraft(): void {
    const draft = this.draft();
    if (draft === null) return;
    this.deleteOpen.set(false);
    this.gone.set(true);
    this.demo.removeInvoice(draft.id);
    void this.router.navigate(['/invoices'], { replaceUrl: true });
  }
}
