import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEllipsis } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { DialogCard } from '../core/layout/dialog-card';
import { DEMO_TODAY } from '../data/demo-date';
import { invoiceStatus } from '../domain/invoices';
import { isolateText } from '../payments/payment-history';
import { INPUT_CLASS } from '../settings/form-parts';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';

/** Where a sent invoice stands as far as cancelling goes: it can be cancelled, or it has had money and needs a credit note (which comes later). */
type CancelRow = 'cancel' | 'paid' | 'partlyPaid';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What can still be done with a sent invoice, besides its main button: mark it as paid in cash (asks for the day), a
 * ⋯ menu with Duplicate and Cancel invoice (asks once), and for the demo a control that lets the customer pay. A cancelled
 * invoice, a cancellation invoice and a draft have none of these. A paid invoice has only the explanation that cancelling
 * it needs a credit note, which comes later; a part-paid one the same, and Duplicate. The menu never repeats the main
 * button: a paid invoice's main button is Duplicate already, so its menu has only the explanation.
 *
 * The demo control looks like the demo bar, and is only there while a bank that works can receive the payment.
 */
@Component({
  selector: 'app-invoice-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogCard, HlmButton, HlmDialogImports, HlmDropdownMenuImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideEllipsis })],
  // The page's column takes the buttons and the demo control as its own items, and nothing when there are none.
  host: { class: 'contents' },
  template: `
    @if (canPay() || hasMenu()) {
      <div class="flex flex-wrap items-center gap-2" data-testid="invoice-actions">
        @if (canPay()) {
          <button
            hlmBtn
            type="button"
            variant="outline"
            class="min-h-10"
            data-testid="mark-paid"
            (click)="payOpen.set(true)"
          >
            {{ 'invoices.actions.markPaid' | transloco }}
          </button>
        }
        @if (hasMenu()) {
          <button
            hlmBtn
            type="button"
            variant="outline"
            size="icon-lg"
            align="end"
            data-testid="more-actions"
            [hlmDropdownMenuTrigger]="menu"
            [attr.aria-label]="'invoices.actions.more' | transloco"
          >
            <ng-icon name="lucideEllipsis" size="20" aria-hidden="true" />
          </button>
          <ng-template #menu>
            <div hlmDropdownMenu class="w-64">
              @if (canPay()) {
                <button
                  hlmDropdownMenuItem
                  type="button"
                  class="min-h-10"
                  data-testid="menu-duplicate"
                  (triggered)="duplicate()"
                >
                  {{ 'invoices.actions.duplicate' | transloco }}
                </button>
              }
              @switch (cancelRow()) {
                @case ('cancel') {
                  <button
                    hlmDropdownMenuItem
                    type="button"
                    variant="destructive"
                    class="min-h-10"
                    data-testid="menu-cancel"
                    (triggered)="cancelOpen.set(true)"
                  >
                    {{ 'invoices.actions.cancel' | transloco }}
                  </button>
                }
                @case ('paid') {
                  <!-- Words, not a button: the sentence stays readable although nothing can be done. -->
                  <div
                    hlmDropdownMenuItem
                    disabled
                    class="text-muted-foreground h-auto py-2 whitespace-normal data-disabled:opacity-100"
                    data-testid="menu-cancel-paid"
                  >
                    {{ 'invoices.actions.cancelPaid' | transloco }}
                  </div>
                }
                @case ('partlyPaid') {
                  <div
                    hlmDropdownMenuItem
                    disabled
                    class="text-muted-foreground h-auto py-2 whitespace-normal data-disabled:opacity-100"
                    data-testid="menu-cancel-paid"
                  >
                    {{ 'invoices.actions.cancelPartlyPaid' | transloco }}
                  </div>
                }
              }
            </div>
          </ng-template>
        }
      </div>
    }

    @if (canSimulate()) {
      <div
        class="bg-primary text-primary-foreground flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2 text-xs"
        data-testid="demo-control"
      >
        <span
          class="bg-primary-foreground text-primary rounded-sm px-1.5 py-0.5 font-semibold uppercase"
          data-testid="demo-label"
        >
          {{ 'demo.label' | transloco }}
        </span>
        <button
          type="button"
          class="min-h-8 rounded-sm border border-current px-2 py-1"
          data-testid="demo-payment"
          (click)="simulate()"
        >
          {{ 'invoices.actions.demo' | transloco }}
        </button>
      </div>
    }

    @if (invoice(); as invoice) {
      <!-- The dialogs show through the overlay: nothing of them belongs in the page's column. -->
      <div hidden>
        <hlm-dialog
          [state]="payOpen() ? 'open' : 'closed'"
          autoFocus="dialog"
          (stateChanged)="payOpen.set($event === 'open')"
        >
          <hlm-dialog-content
            *hlmDialogPortal
            appDialogCard
            data-testid="pay-dialog"
            [closeLabel]="'invoices.actions.payDialog.close' | transloco"
          >
            <hlm-dialog-header class="pe-8">
              <h2 hlmDialogTitle class="text-lg leading-snug font-semibold" data-testid="pay-title">
                {{
                  'invoices.actions.payDialog.title'
                    | transloco: { number: isolate(invoice.number ?? '') }
                }}
              </h2>
            </hlm-dialog-header>

            <label class="flex flex-col gap-1 text-sm" data-testid="pay-body">
              <span class="text-muted-foreground">
                {{ 'invoices.actions.payDialog.body' | transloco }}
              </span>
              <input
                type="date"
                dir="ltr"
                data-testid="pay-date"
                [class]="inputClass"
                [min]="invoice.issueDate"
                [max]="today"
                [value]="payDate()"
                [attr.aria-invalid]="payDateOk() ? null : 'true'"
                [attr.aria-describedby]="payDateOk() ? 'pay-hint' : 'pay-error pay-hint'"
                (input)="onPayDate($event)"
              />
            </label>
            @if (!payDateOk()) {
              <p
                id="pay-error"
                class="text-negative -mt-2 text-xs"
                role="alert"
                data-testid="pay-error"
              >
                {{ 'invoices.actions.payDialog.error' | transloco }}
              </p>
            }
            <p id="pay-hint" class="text-muted-foreground text-sm" data-testid="pay-hint">
              {{ 'invoices.actions.payDialog.hint' | transloco }}
            </p>

            <hlm-dialog-footer>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="pay-cancel"
                (click)="payOpen.set(false)"
              >
                {{ 'invoices.actions.payDialog.cancel' | transloco }}
              </button>
              <button
                hlmBtn
                type="button"
                class="min-h-10"
                data-testid="pay-confirm"
                [disabled]="!payDateOk()"
                (click)="markPaid()"
              >
                {{ 'invoices.actions.payDialog.confirm' | transloco }}
              </button>
            </hlm-dialog-footer>
          </hlm-dialog-content>
        </hlm-dialog>

        <hlm-dialog
          [state]="cancelOpen() ? 'open' : 'closed'"
          autoFocus="dialog"
          (stateChanged)="cancelOpen.set($event === 'open')"
        >
          <hlm-dialog-content
            *hlmDialogPortal
            appDialogCard
            data-testid="cancel-dialog"
            [closeLabel]="'invoices.actions.cancelDialog.close' | transloco"
          >
            <hlm-dialog-header class="pe-8">
              <h2
                hlmDialogTitle
                class="text-lg leading-snug font-semibold"
                data-testid="cancel-title"
              >
                {{
                  'invoices.actions.cancelDialog.title'
                    | transloco: { number: isolate(invoice.number ?? '') }
                }}
              </h2>
            </hlm-dialog-header>
            <p data-testid="cancel-body">
              {{ 'invoices.actions.cancelDialog.body' | transloco }}
            </p>
            <hlm-dialog-footer>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="cancel-keep"
                (click)="cancelOpen.set(false)"
              >
                {{ 'invoices.actions.cancelDialog.keep' | transloco }}
              </button>
              <button
                hlmBtn
                type="button"
                variant="destructive"
                class="min-h-10"
                data-testid="cancel-confirm"
                (click)="cancelInvoice()"
              >
                {{ 'invoices.actions.cancelDialog.confirm' | transloco }}
              </button>
            </hlm-dialog-footer>
          </hlm-dialog-content>
        </hlm-dialog>
      </div>
    }
  `,
})
export class InvoiceActions {
  private readonly demo = inject(DemoStateService);
  private readonly invoices = inject(InvoiceService);
  private readonly router = inject(Router);

  /** The invoice of the open business these actions are for. */
  readonly invoiceId = input.required<string>();

  protected readonly invoice = computed(
    () => this.demo.business().invoices.find((i) => i.id === this.invoiceId()) ?? null,
  );
  private readonly status = computed(() => {
    const invoice = this.invoice();
    return invoice ? invoiceStatus(invoice, this.demo.business()) : null;
  });

  /** Something is left to pay: the invoice is open, overdue or part paid. */
  protected readonly canPay = computed(() => {
    const status = this.status();
    return status === 'open' || status === 'overdue' || status === 'partlyPaid';
  });
  /** What the menu says about cancelling: Cancel invoice, or why it cannot be done; nothing for an invoice that is a draft, cancelled, or a cancellation invoice. */
  protected readonly cancelRow = computed<CancelRow | null>(() => {
    switch (this.status()) {
      case 'open':
      case 'overdue':
        return 'cancel';
      case 'partlyPaid':
        return 'partlyPaid';
      case 'paid':
        return 'paid';
      default:
        return null;
    }
  });
  protected readonly hasMenu = computed(() => this.canPay() || this.cancelRow() !== null);
  protected readonly canSimulate = computed(() =>
    this.invoices.canSimulatePayment(this.invoiceId()),
  );

  protected readonly payOpen = signal(false);
  protected readonly cancelOpen = signal(false);
  /** The day in the mark-as-paid field: today each time the dialog opens, then what the person picked. */
  protected readonly payDate = linkedSignal<boolean, string>({
    source: this.payOpen,
    computation: () => DEMO_TODAY,
  });
  /** A day from the invoice date up to today. */
  protected readonly payDateOk = computed(() => {
    const day = this.payDate();
    const invoice = this.invoice();
    return invoice !== null && ISO_DAY.test(day) && day >= invoice.issueDate && day <= DEMO_TODAY;
  });

  protected readonly today = DEMO_TODAY;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly isolate = isolateText;

  protected onPayDate(event: Event): void {
    this.payDate.set((event.target as HTMLInputElement).value);
  }

  protected markPaid(): void {
    if (!this.payDateOk()) return;
    this.invoices.markPaidInCash(this.invoiceId(), this.payDate());
    this.payOpen.set(false);
  }

  /** Cancels the invoice and closes the question. Nothing is said when it could not be cancelled (it was paid meanwhile): the page shows how it stands. */
  protected cancelInvoice(): void {
    this.invoices.cancel(this.invoiceId());
    this.cancelOpen.set(false);
  }

  protected duplicate(): void {
    void this.router.navigate(['/invoices', this.invoices.duplicate(this.invoiceId()), 'edit']);
  }

  protected simulate(): void {
    this.invoices.simulatePayment(this.invoiceId());
  }
}
