import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { TermText } from '../core/i18n/term';
import { DialogCard } from '../core/layout/dialog-card';
import { DEMO_TODAY } from '../data/demo-date';
import type { Doc } from '../data/models';
import { payDayAllowed } from '../domain/cash-payments';
import { focusAfterRender } from '../settings/form-helpers';
import { ChoiceCard, FieldError, INPUT_CLASS } from '../settings/form-parts';
import { ReceiptService, type PaidHow } from '../state/receipt.service';

let nextDialogId = 0;

/** Stands where the term goes in a translated sentence, so the term can sit in the label with its own explanation button. */
const TERM_MARK = '\u0001';

/**
 * The pop-up that says how a received receipt was paid when no payment of the bank shows it: **In cash, from the cash box** (with the
 * German word explained) or **With my own money** (a private card, or cash of the person's own), and **Paid on**, a day from the
 * receipt's date up to today (the receipt's date to begin with). **Done** makes the payment through `ReceiptService.markPaid` and
 * closes the pop-up; the page then offers Undo for a few seconds. An answer that is not chosen is asked for under its field when Done
 * is pressed, and a day outside the allowed ones is named at once; the cursor goes to the first thing wrong. Cancel, the cross, Escape
 * and a tap outside close it and change nothing. It opens with nothing chosen each time.
 */
@Component({
  selector: 'app-paid-privately-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, ChoiceCard, DialogCard, FieldError, HlmButton, HlmDialogImports, MoneyPipe, TermText, TranslocoPipe],
  // Not displayed: the dialog shows through the overlay, so nothing of this element belongs in the page.
  host: { hidden: '' },
  template: `
    <hlm-dialog
      [state]="open() ? 'open' : 'closed'"
      autoFocus="dialog"
      (stateChanged)="onStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        appDialogCard
        data-testid="paid-dialog"
        [closeLabel]="'documents.detail.paidDialog.close' | transloco"
      >
        <form class="flex flex-col gap-4" novalidate (submit)="submit($event)">
          <hlm-dialog-header class="pe-8">
            <h2 hlmDialogTitle class="text-lg leading-snug font-semibold" data-testid="paid-title">
              {{ 'documents.detail.paidDialog.title' | transloco }}
            </h2>
          </hlm-dialog-header>

          <div
            class="bg-muted/50 border-border flex flex-col gap-0.5 rounded-lg border p-3"
            data-testid="paid-receipt"
          >
            <div class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 font-medium wrap-break-word" dir="auto" data-testid="paid-name">{{
                doc().name
              }}</span>
              <bdi dir="ltr" class="shrink-0 font-semibold">
                <span data-testid="paid-amount">{{ doc().amountCents ?? 0 | money }}</span>
              </bdi>
            </div>
            @if (doc().date; as date) {
              <bdi dir="ltr" class="text-muted-foreground self-start text-sm">
                <span data-testid="paid-receipt-date">{{ date | appDate: { year: true } }}</span>
              </bdi>
            }
          </div>

          <div class="flex flex-col gap-2">
            <div
              role="radiogroup"
              class="grid gap-2"
              [attr.aria-label]="'documents.detail.paidDialog.title' | transloco"
              [attr.aria-invalid]="howMissing() ? 'true' : null"
            >
              @let cash = ('documents.detail.paidDialog.cash' | transloco: { term: termMark }).split(termMark);
              <app-choice-card
                data-testid="paid-how-cash"
                [name]="uid + '-how'"
                [checked]="how() === 'cash'"
                (changed)="pick('cash')"
              >
                {{ cash[0] }}<app-term-text key="kasse" />{{ cash[1] }}
              </app-choice-card>
              <app-choice-card
                data-testid="paid-how-own"
                [name]="uid + '-how'"
                [checked]="how() === 'own'"
                [hint]="'documents.detail.paidDialog.ownHint' | transloco"
                (changed)="pick('own')"
              >
                {{ 'documents.detail.paidDialog.own' | transloco }}
              </app-choice-card>
            </div>
            @if (howMissing()) {
              <p appFieldError="documents.detail.paidDialog.howError" data-testid="paid-how-error"></p>
            }
          </div>

          <div class="flex flex-col gap-1">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{ 'documents.detail.paidDialog.date' | transloco }}</span>
              <input
                type="date"
                dir="ltr"
                data-testid="paid-date"
                [class]="inputClass"
                [attr.min]="doc().date"
                [attr.max]="today"
                [value]="day()"
                [attr.aria-invalid]="dayOk() ? null : 'true'"
                [attr.aria-describedby]="dayOk() ? uid + '-hint' : uid + '-error ' + uid + '-hint'"
                (input)="setDay($event)"
              />
            </label>
            @if (!dayOk()) {
              <p
                appFieldError="documents.detail.paidDialog.dateError"
                data-testid="paid-date-error"
                [id]="uid + '-error'"
              ></p>
            }
          </div>

          <p class="text-muted-foreground text-sm" data-testid="paid-hint" [id]="uid + '-hint'">
            {{ 'documents.detail.paidDialog.hint' | transloco }}
          </p>

          <hlm-dialog-footer>
            <button
              hlmBtn
              type="button"
              variant="outline"
              class="min-h-10"
              data-testid="paid-cancel"
              (click)="open.set(false)"
            >
              {{ 'documents.detail.paidDialog.cancel' | transloco }}
            </button>
            <button hlmBtn type="submit" class="min-h-10" data-testid="paid-done">
              {{ 'documents.detail.paidDialog.done' | transloco }}
            </button>
          </hlm-dialog-footer>
        </form>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class PaidPrivatelyDialog {
  private readonly receipts = inject(ReceiptService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** The received receipt that was paid: shown in the pop-up, and the one the payment is made from. */
  readonly doc = input.required<Doc>();
  /** Whether the pop-up is open. */
  readonly open = model.required<boolean>();

  protected readonly uid = `paid-${nextDialogId++}`;
  protected readonly termMark = TERM_MARK;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly today = DEMO_TODAY;

  /** What is chosen and typed: nothing chosen and the receipt's date each time the pop-up opens (and for another receipt). */
  private readonly fresh = computed(() => `${this.open()}|${this.doc().id}`);
  protected readonly how = linkedSignal<string, PaidHow | null>({
    source: this.fresh,
    computation: () => null,
  });
  protected readonly day = linkedSignal<string, string>({
    source: this.fresh,
    computation: () => untracked(() => this.doc().date ?? DEMO_TODAY),
  });
  /** Whether Done was pressed with no way chosen: the message under the choices. */
  protected readonly howMissing = linkedSignal<string, boolean>({
    source: this.fresh,
    computation: () => false,
  });

  /** A day from the receipt's date up to today. */
  protected readonly dayOk = computed(() => payDayAllowed(this.doc(), this.day(), DEMO_TODAY));

  protected pick(how: PaidHow): void {
    this.how.set(how);
    this.howMissing.set(false);
  }

  protected setDay(event: Event): void {
    this.day.set((event.target as HTMLInputElement).value);
  }

  /** The cross, Escape and a tap outside close the pop-up by themselves; it follows. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') this.open.set(false);
  }

  /** Done: names what is missing and puts the cursor on it, or makes the payment and closes. When the state refuses all the same, the pop-up stays. */
  protected submit(event: Event): void {
    event.preventDefault();
    const how = this.how();
    if (how === null || !this.dayOk()) {
      this.howMissing.set(how === null);
      // The pop-up is drawn in the overlay, outside this element: the cursor is looked for in the whole page.
      focusAfterRender(
        this.injector,
        this.document.body,
        how === null
          ? '[data-testid="paid-dialog"] [role="radiogroup"] input'
          : '[data-testid="paid-dialog"] [data-testid="paid-date"]',
      );
      return;
    }
    if (this.receipts.markPaid(this.doc().id, how, this.day()) === null) return;
    this.open.set(false);
  }
}
