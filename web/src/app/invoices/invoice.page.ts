import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, linkedSignal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideDownload, lucidePencil, lucideSearchX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { map } from 'rxjs';
import { formatDate } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Term, type TermKey } from '../core/i18n/term';
import {
  canSendInvoice,
  dueDateOf,
  invoiceFileFormat,
  invoiceRowOf,
  invoiceTotals,
  reminderSummary,
} from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { InvoiceActions } from './invoice-actions';
import { InvoiceHistory } from './invoice-history';
import type { SendKind } from './invoice-mail';
import { InvoicePaper } from './invoice-paper';
import { InvoiceSendDialog } from './invoice-send-dialog';
import { InvoiceStatusChip } from './invoice-status-chip';

/** Stands where the number goes in a translated sentence, so the number can be a link of its own. */
const NUMBER_MARK = '\u0001';

/** What the main button of an invoice does. */
type Primary = 'send' | 'edit' | 'remind1' | 'remind2' | 'copy' | 'correct' | 'download';

/** The send step that is open, and for which invoice. */
interface SendFor {
  id: string;
  kind: SendKind;
}

/**
 * One invoice written in the app (`/invoices/:id`): who it is for and where it stands, the invoice as the customer sees it,
 * what happened so far, and the next step. A draft is sent from here (Preview and send opens the send step) or edited; a
 * sent invoice can be downloaded as a PDF (a print view), and an overdue one is reminded from here. `?send=1` opens the
 * send step of a draft that is ready, and `?remind=1` the reminder an overdue invoice is offered; the address is cleaned
 * afterwards. From `lg` the paper sits beside what happened and the next step. An invoice that is not there (another
 * business, an unknown id, or one the list does not show in this setup state) says so and leads back to the list.
 */
@Component({
  selector: 'app-invoice-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmButton,
    InvoiceActions,
    InvoiceHistory,
    InvoicePaper,
    InvoiceSendDialog,
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
              The next step: the main button first, then smaller ones. The main button follows where the invoice
              stands: a draft is sent, a late invoice is reminded, a paid one is written again, a cancelled one is
              corrected; any other sent invoice is downloaded. What else can be done (mark as paid, copy, cancel) is
              in the actions after it.
            -->
            <section class="flex flex-col gap-3" data-testid="next-step">
              <h2 class="sr-only">{{ 'invoices.detail.next.title' | transloco }}</h2>
              @if (fileFormat(); as format) {
                <p class="text-muted-foreground text-sm" data-testid="invoice-format">
                  {{ 'invoices.detail.format' | transloco }} <app-term key="eRechnung" /> ·
                  <app-term [key]="format" />
                </p>
              }

              @switch (primary()) {
                @case ('send') {
                  <button
                    hlmBtn
                    size="lg"
                    type="button"
                    data-testid="preview-send"
                    [disabled]="invoices.sending() !== null"
                    (click)="openSend('invoice')"
                  >
                    {{ (sendingThis() ? 'invoices.detail.sending' : 'invoices.detail.send') | transloco }}
                  </button>
                  <a
                    hlmBtn
                    variant="outline"
                    class="min-h-10"
                    data-testid="edit-invoice"
                    [routerLink]="['/invoices', invoice.id, 'edit']"
                  >
                    <ng-icon name="lucidePencil" size="16" aria-hidden="true" />
                    {{ 'invoices.detail.edit' | transloco }}
                  </a>
                }
                @case ('edit') {
                  <a
                    hlmBtn
                    size="lg"
                    data-testid="edit-invoice"
                    [routerLink]="['/invoices', invoice.id, 'edit']"
                  >
                    <ng-icon name="lucidePencil" size="16" aria-hidden="true" />
                    {{ 'invoices.detail.edit' | transloco }}
                  </a>
                  <p class="text-muted-foreground text-sm" data-testid="not-ready">
                    {{ 'invoices.detail.notReady' | transloco }}
                  </p>
                }
                @case ('remind1') {
                  <button
                    hlmBtn
                    size="lg"
                    type="button"
                    data-testid="send-reminder"
                    [disabled]="invoices.sending() !== null"
                    (click)="openSend('reminder1')"
                  >
                    {{ (sendingThis() ? 'invoices.detail.sending' : 'invoices.detail.remind') | transloco }}
                  </button>
                }
                @case ('remind2') {
                  <button
                    hlmBtn
                    size="lg"
                    type="button"
                    data-testid="send-reminder"
                    [disabled]="invoices.sending() !== null"
                    (click)="openSend('reminder2')"
                  >
                    {{
                      (sendingThis() ? 'invoices.detail.sending' : 'invoices.detail.remindFormal') | transloco
                    }}
                  </button>
                }
                @case ('copy') {
                  <button
                    hlmBtn
                    size="lg"
                    type="button"
                    data-testid="duplicate-invoice"
                    (click)="copy()"
                  >
                    {{ 'invoices.detail.duplicate' | transloco }}
                  </button>
                }
                @case ('correct') {
                  @if (cancellation(); as cancellation) {
                    @let note = ('invoices.detail.cancelledNote' | transloco: { number: numberMark }).split(numberMark);
                    <p class="text-muted-foreground text-sm" data-testid="cancelled-note">
                      {{ note[0] }}<a
                        class="text-primary underline-offset-4 hover:underline"
                        [routerLink]="['/invoices', cancellation.id]"
                        ><bdi dir="ltr">{{ cancellation.number }}</bdi></a
                      >{{ note[1] }}
                    </p>
                  }
                  <button
                    hlmBtn
                    size="lg"
                    type="button"
                    data-testid="correct-copy"
                    (click)="copy()"
                  >
                    {{ 'invoices.detail.correctCopy' | transloco }}
                  </button>
                }
              }

              <!-- Between the levels there is nothing to send: this says when the next one can go. -->
              @if (reminders(); as reminded) {
                @if (reminded.lastSentOn) {
                  <p class="text-muted-foreground text-sm" data-testid="invoice-reminded">
                    {{
                      (reminded.availableFrom ? 'invoices.row.remindedLater' : 'invoices.row.reminded')
                        | transloco: reminderWords()
                    }}
                  </p>
                }
              }

              @if (found.status !== 'draft') {
                <a
                  hlmBtn
                  class="min-h-10"
                  data-testid="download-pdf"
                  [size]="primary() === 'download' ? 'lg' : 'default'"
                  [variant]="primary() === 'download' ? 'default' : 'outline'"
                  [routerLink]="['/print/invoice', invoice.id]"
                >
                  <ng-icon name="lucideDownload" size="16" aria-hidden="true" />
                  {{ 'invoices.detail.download' | transloco }}
                </a>
              }

              <app-invoice-actions [invoiceId]="invoice.id" />
            </section>

            <app-invoice-send-dialog
              [invoiceId]="invoice.id"
              [kind]="sendKind()"
              [open]="sendOpen()"
              (openChange)="closeSend()"
            />
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
  protected readonly invoices = inject(InvoiceService);
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly business = this.demo.business;
  protected readonly numberMark = NUMBER_MARK;

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

  /** What the page can do for the invoice: whether a draft has all it needs to be sent. */
  private readonly canSend = computed(() => {
    const invoice = this.row()?.invoice;
    return invoice !== undefined && canSendInvoice(invoice, this.business(), this.demo.setup());
  });

  /** What a late invoice says about its reminders (see `reminderSummary`); null for an invoice that is not late. */
  protected readonly reminders = computed(() => {
    const invoice = this.row()?.invoice;
    return invoice ? reminderSummary(invoice, this.business()) : null;
  });
  protected readonly reminderWords = computed(() => {
    const reminders = this.reminders();
    const lang = this.language.lang();
    return {
      date: reminders?.lastSentOn ? formatDate(reminders.lastSentOn, lang) : '',
      from: reminders?.availableFrom ? formatDate(reminders.availableFrom, lang) : '',
    };
  });

  /** The main button, by where the invoice stands (see the next step in the template). */
  protected readonly primary = computed<Primary>(() => {
    switch (this.row()?.status) {
      case 'draft':
        return this.canSend() ? 'send' : 'edit';
      case 'paid':
        return 'copy';
      case 'cancelled':
        return 'correct';
      case 'open':
      case 'overdue':
      case 'partlyPaid': {
        const next = this.reminders()?.next;
        return next === 1 ? 'remind1' : next === 2 ? 'remind2' : 'download';
      }
      default:
        return 'download';
    }
  });

  /** The cancellation invoice of a cancelled invoice, to lead to it. */
  protected readonly cancellation = computed(() => {
    const cancelledBy = this.row()?.invoice.cancelledBy ?? null;
    const found = cancelledBy === null ? undefined : this.business().invoices.find((i) => i.id === cancelledBy);
    return found ? { id: found.id, number: found.number ?? '' } : null;
  });

  /** This invoice is the one on its way to the customer (the button says so; any other on its way only switches it off). */
  protected readonly sendingThis = computed(() => {
    const id = this.row()?.invoice.id;
    return id !== undefined && this.invoices.sending() === id;
  });

  /** The open business's id, a signal of its own: any edit of the business makes a new business object, but not a new id. */
  private readonly businessId = computed(() => this.business().id);

  /** The send step that is open and for which invoice; none when another business is opened. */
  private readonly sendFor = linkedSignal<string, SendFor | null>({
    source: this.businessId,
    computation: () => null,
  });
  /** The send step is open for this invoice, and for no other the page may show next. */
  protected readonly sendOpen = computed(() => {
    const open = this.sendFor();
    return open !== null && open.id === this.row()?.invoice.id;
  });
  protected readonly sendKind = computed<SendKind>(() => this.sendFor()?.kind ?? 'invoice');

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      if (this.openFromAddress(params)) {
        // The address was only a way to open the step: take it off, so a reload or going back does not open it again.
        queueMicrotask(() => {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { send: null, remind: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        });
      }
    });
  }

  protected openSend(kind: SendKind): void {
    const id = this.row()?.invoice.id;
    if (id !== undefined) this.sendFor.set({ id, kind });
  }

  protected closeSend(): void {
    this.sendFor.set(null);
  }

  /** Makes a new draft from the invoice (a copy of a paid one, or the corrected copy of a cancelled one) and goes to its edit page. */
  protected copy(): void {
    const id = this.row()?.invoice.id;
    if (id !== undefined) void this.router.navigate(['/invoices', this.invoices.duplicate(id), 'edit']);
  }

  /**
   * Opens the send step when the address asks for it: `?send=1` for a draft that can be sent, `?remind=1` for the reminder
   * an overdue invoice is offered now. Anything else opens nothing. Gives back whether the address asked for either, so it can be cleaned.
   * The invoice is the one of the address as it is going to be (the id of the page follows a moment later).
   */
  private openFromAddress(params: ParamMap): boolean {
    const wantsSend = params.get('send') === '1';
    const wantsRemind = params.get('remind') === '1';
    if (!wantsSend && !wantsRemind) return false;
    const id = this.route.snapshot.paramMap.get('id');
    const row = id === null ? null : invoiceRowOf(this.demo.business(), this.demo.setup(), id);
    if (row !== null) {
      const next = reminderSummary(row.invoice, this.demo.business())?.next;
      const kind: SendKind | null = wantsSend
        ? canSendInvoice(row.invoice, this.demo.business(), this.demo.setup()) ? 'invoice' : null
        : next === 1 ? 'reminder1' : next === 2 ? 'reminder2' : null;
      if (kind !== null) this.sendFor.set({ id: row.invoice.id, kind });
    }
    return true;
  }
}
