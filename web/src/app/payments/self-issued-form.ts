import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucideTriangleAlert } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { Term } from '../core/i18n/term';
import { DEMO_TODAY } from '../data/demo-date';
import type { SelfIssuedReason, Transaction } from '../data/models';
import {
  SELF_ISSUED_NOTE_CENTS,
  purposeSuggestion,
  selfIssuedProblems,
  type SelfIssuedInput,
} from '../domain/self-issued';
import { vatRateShown } from '../domain/tax-rules';
import { clearErrors, focusAfterRender } from '../settings/form-helpers';
import { ChoiceCard, FieldError, INPUT_CLASS } from '../settings/form-parts';
import { DemoStateService } from '../state/demo-state.service';

let nextFormId = 0;

/** The reasons for having no receipt, in the order they are asked; "something else" comes with a text of the person's own. */
const REASONS: readonly SelfIssuedReason[] = ['lost', 'machine', 'tip', 'sellerNone', 'other'];

type Field = 'purpose' | 'reason' | 'reasonText' | 'confirm';

/** What is filled in. */
interface Draft {
  purpose: string;
  reason: SelfIssuedReason | null;
  reasonText: string;
  address: string;
  confirmed: boolean;
}

/** The message under each field that was refused: a translation key. */
type Errors = Partial<Record<Field, string>>;

/** Where the cursor goes for a refused field. */
const FIELD_SELECTORS: Record<Field, string> = {
  purpose: '[data-testid="form-purpose"]',
  reason: '[data-testid="reason-lost"] input',
  reasonText: '[data-testid="form-reason-text"]',
  confirm: '[data-testid="form-confirm"] input',
};

/**
 * The one screen that writes a self-issued receipt (Eigenbeleg) for a payment with no receipt: the payment (fixed), what it was for
 * (prefilled in German, like the receipt, from the booking's name and the payment's reference), why there is no receipt (five choices,
 * and "Something else…" asks for a text), who was paid (the payee, with an optional address above €150), the notes that apply (no VAT
 * can be claimed back; ask the seller for a copy of a larger amount), the tick that says it is true, and **Create receipt**.
 *
 * It asks for what is still missing when Create is pressed, names it under its field and puts the cursor on the first one. Only a
 * complete form is handed over (`created`, with what the person filled in): the page that holds it writes the receipt, because the
 * payment page and the review card write it in different ways (see `ReceiptService`). `cancelled` says the person gave up. The
 * title is the form's own unless the page puts its own in (`appSelfIssuedTitle`, a pop-up's title). What is filled in starts over
 * for another payment.
 */
@Component({
  selector: 'app-self-issued-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, ChoiceCard, FieldError, HlmButton, MoneyPipe, NgIcon, Term, TranslocoPipe],
  viewProviders: [provideIcons({ lucideInfo, lucideTriangleAlert })],
  host: { class: 'block' },
  template: `
    <form class="flex flex-col gap-4" novalidate (submit)="submit($event)">
      <ng-content select="[appSelfIssuedTitle]">
        <h1 class="text-2xl font-semibold [&_button]:text-start" data-testid="form-title">
          <app-term key="eigenbeleg" />
        </h1>
      </ng-content>
      <p class="text-muted-foreground text-sm" data-testid="form-intro">
        {{ 'selfIssued.intro' | transloco }}
      </p>

      <div
        class="bg-muted/50 border-border flex flex-col gap-0.5 rounded-lg border p-3"
        data-testid="form-payment"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 font-medium wrap-break-word" dir="auto" data-testid="form-payee">{{
            payment().counterparty
          }}</span>
          <bdi dir="ltr" class="text-negative shrink-0 font-semibold">
            <span data-testid="form-amount">{{
              payment().amountCents | money: { signed: true }
            }}</span>
          </bdi>
        </div>
        <bdi dir="ltr" class="text-muted-foreground self-start text-sm">
          <span data-testid="form-date">{{ payment().date | appDate: { year: true } }}</span>
        </bdi>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-muted-foreground text-sm" [attr.for]="uid + '-purpose'">
          {{ 'selfIssued.purpose.label' | transloco }}
        </label>
        <input
          type="text"
          dir="auto"
          autocomplete="off"
          data-testid="form-purpose"
          [id]="uid + '-purpose'"
          [class]="inputClass"
          [value]="draft().purpose"
          [attr.aria-invalid]="errors().purpose ? 'true' : null"
          [attr.aria-describedby]="errors().purpose ? uid + '-error-purpose' : null"
          (input)="setPurpose($event)"
        />
        @if (errors().purpose; as key) {
          <p
            [appFieldError]="key"
            [id]="uid + '-error-purpose'"
            data-testid="form-error-purpose"
          ></p>
        }
      </div>

      <div class="flex flex-col gap-2">
        <p class="text-muted-foreground text-sm" [id]="uid + '-reason-label'">
          {{ 'selfIssued.reason.label' | transloco }}
        </p>
        <div
          role="radiogroup"
          class="grid gap-2"
          [attr.aria-labelledby]="uid + '-reason-label'"
          [attr.aria-invalid]="errors().reason ? 'true' : null"
        >
          @for (reason of reasons; track reason) {
            <app-choice-card
              [name]="uid + '-reason'"
              [attr.data-testid]="'reason-' + reason"
              [checked]="draft().reason === reason"
              (changed)="setReason(reason)"
            >
              {{ 'selfIssued.reason.' + reason | transloco }}
            </app-choice-card>
          }
        </div>
        @if (errors().reason; as key) {
          <p [appFieldError]="key" data-testid="form-error-reason"></p>
        }
        @if (draft().reason === 'other') {
          <div class="flex flex-col gap-1">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{
                'selfIssued.reason.otherLabel' | transloco
              }}</span>
              <input
                type="text"
                dir="auto"
                autocomplete="off"
                data-testid="form-reason-text"
                [class]="inputClass"
                [value]="draft().reasonText"
                [attr.aria-invalid]="errors().reasonText ? 'true' : null"
                [attr.aria-describedby]="errors().reasonText ? uid + '-error-reason-text' : null"
                (input)="setReasonText($event)"
              />
            </label>
            @if (errors().reasonText; as key) {
              <p
                [appFieldError]="key"
                [id]="uid + '-error-reason-text'"
                data-testid="form-error-reason-text"
              ></p>
            }
          </div>
        }
      </div>

      <div class="flex flex-col gap-1" data-testid="form-paid-to">
        <span class="text-muted-foreground text-sm">{{
          'selfIssued.paidTo.label' | transloco
        }}</span>
        <span class="text-sm font-medium wrap-break-word" dir="auto">{{
          payment().counterparty
        }}</span>
      </div>
      @if (asksAddress()) {
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground" data-testid="form-address-label">{{
            'selfIssued.paidTo.address' | transloco
          }}</span>
          <input
            type="text"
            dir="auto"
            autocomplete="off"
            data-testid="form-address"
            [class]="inputClass"
            [value]="draft().address"
            (input)="setAddress($event)"
          />
        </label>
      }

      @if (vatNote()) {
        <p
          class="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-md p-3 text-sm"
          data-testid="note-no-vat"
        >
          <ng-icon name="lucideInfo" size="16" class="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{{ 'selfIssued.note.noVat' | transloco }}</span>
        </p>
      }
      @if (asksAddress()) {
        <p
          class="bg-warning/10 flex items-start gap-2 rounded-md p-3 text-sm"
          data-testid="note-large"
        >
          <ng-icon
            name="lucideTriangleAlert"
            size="16"
            class="text-warning mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{{ 'selfIssued.note.large' | transloco }}</span>
        </p>
      }

      <div class="flex flex-col gap-1">
        <app-choice-card
          type="checkbox"
          data-testid="form-confirm"
          [name]="uid + '-confirm'"
          [checked]="draft().confirmed"
          (changed)="setConfirmed($event)"
        >
          {{ 'selfIssued.confirm.text' | transloco }} · <bdi dir="auto">{{ fullName() }}</bdi
          >,
          <bdi dir="ltr">{{ today | appDate: { year: true } }}</bdi>
        </app-choice-card>
        @if (errors().confirm; as key) {
          <p [appFieldError]="key" data-testid="form-error-confirm"></p>
        }
      </div>

      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          hlmBtn
          type="button"
          variant="outline"
          size="lg"
          data-testid="form-cancel"
          (click)="cancelled.emit()"
        >
          {{ 'selfIssued.cancel' | transloco }}
        </button>
        <button hlmBtn type="submit" size="lg" data-testid="form-create">
          {{ 'selfIssued.create' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class SelfIssuedForm {
  private readonly demo = inject(DemoStateService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The payment the receipt is for. */
  readonly payment = input.required<Transaction>();
  /** The form is complete and the person pressed Create receipt: what they filled in. */
  readonly created = output<SelfIssuedInput>();
  /** The person gave up. */
  readonly cancelled = output<void>();

  protected readonly uid = `si-${nextFormId++}`;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly reasons = REASONS;
  protected readonly today = DEMO_TODAY;

  /** What is filled in, and which fields were refused: both start over for another payment. */
  protected readonly draft = linkedSignal<string, Draft>({
    source: () => this.payment().id,
    computation: () =>
      untracked(() => {
        const tx = this.payment();
        return {
          purpose: purposeSuggestion(tx, tx.booking?.nameDe ?? null),
          reason: null,
          reasonText: '',
          address: '',
          confirmed: false,
        };
      }),
  });
  protected readonly errors = linkedSignal<string, Errors>({
    source: () => this.payment().id,
    computation: () => ({}),
  });

  /** Above 150 € the form asks for the payee's address, and says to get a copy from the seller first. */
  protected readonly asksAddress = computed(
    () => Math.abs(this.payment().amountCents) > SELF_ISSUED_NOTE_CENTS,
  );
  /** Whether the payment's category has VAT the receipt can't claim back (never for a business that charges none). */
  protected readonly vatNote = computed(() => {
    const booking = this.payment().booking;
    return booking !== null && vatRateShown(this.demo.business().taxProfile, booking) !== null;
  });
  /** The signed-in person, who confirms it is true. */
  protected readonly fullName = computed(
    () => `${this.demo.person.firstName} ${this.demo.person.lastName}`,
  );

  protected setPurpose(event: Event): void {
    this.draft.update((draft) => ({ ...draft, purpose: (event.target as HTMLInputElement).value }));
    clearErrors(this.errors, 'purpose');
  }

  protected setReason(reason: SelfIssuedReason): void {
    this.draft.update((draft) => ({ ...draft, reason }));
    clearErrors(this.errors, 'reason', 'reasonText');
  }

  protected setReasonText(event: Event): void {
    this.draft.update((draft) => ({
      ...draft,
      reasonText: (event.target as HTMLInputElement).value,
    }));
    clearErrors(this.errors, 'reasonText');
  }

  protected setAddress(event: Event): void {
    this.draft.update((draft) => ({ ...draft, address: (event.target as HTMLInputElement).value }));
  }

  protected setConfirmed(confirmed: boolean): void {
    this.draft.update((draft) => ({ ...draft, confirmed }));
    clearErrors(this.errors, 'confirm');
  }

  /** Create receipt: names what is missing and keeps all that was typed, or hands the complete form over. */
  protected submit(event: Event): void {
    event.preventDefault();
    const draft = this.draft();
    const input: SelfIssuedInput = {
      purpose: draft.purpose,
      // A reason that is not chosen yet is asked for on its own, below; "lost" only stands in for it here.
      reason: draft.reason ?? 'lost',
      reasonText: draft.reason === 'other' ? draft.reasonText : null,
      address: this.asksAddress() ? draft.address : null,
    };
    const problems = selfIssuedProblems(input, draft.confirmed);
    const errors: Errors = {};
    if (problems.includes('purpose')) errors.purpose = 'selfIssued.purpose.error';
    if (draft.reason === null) errors.reason = 'selfIssued.reason.error';
    if (problems.includes('reasonText')) errors.reasonText = 'selfIssued.reason.otherError';
    if (problems.includes('confirm')) errors.confirm = 'selfIssued.confirm.error';

    const first = (['purpose', 'reason', 'reasonText', 'confirm'] as const).find(
      (field) => errors[field],
    );
    this.errors.set(errors);
    if (first) {
      focusAfterRender(this.injector, this.host.nativeElement, FIELD_SELECTORS[first]);
      return;
    }
    this.created.emit({
      ...input,
      purpose: input.purpose.trim(),
      reasonText: input.reasonText?.trim() ?? null,
      address: input.address?.trim() || null,
    });
  }
}
