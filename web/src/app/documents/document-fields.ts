import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Term, TermKey } from '../core/i18n/term';
import { Booking, Doc, DocDirection, Lang, Transaction } from '../data/models';
import { editDocument } from '../domain/document-actions';
import { parseAmountQuery } from '../domain/payment-filters';
import { vatRateShown } from '../domain/tax-rules';
import { DemoStateService } from '../state/demo-state.service';

/** The amount typed in a field as cents, or null unless it is a number above 0 (a document is never worth nothing or less). */
export function parseDocAmount(text: string): number | null {
  const amount = parseAmountQuery(text);
  return amount !== null && !amount.negative && amount.cents > 0 ? amount.cents : null;
}

/** An amount as a field shows it: no thousands separator, the decimal mark of the language. */
export function amountInput(cents: number, lang: Lang): string {
  const plain = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
  return lang === 'de' ? plain.replace('.', ',') : plain;
}

/** What the person can change in a document: the fields `editDocument` takes. */
export type DocChanges = Parameters<typeof editDocument>[1];
type FieldErrors = Partial<Record<'name' | 'date' | 'amount', true>>;

/** What the Edit form holds: every field as the text of its input. */
interface Draft {
  direction: DocDirection | null;
  name: string;
  invoiceNo: string;
  date: string;
  amount: string;
  vatRate: string;
  dueDate: string;
}

const DIRECTIONS: readonly DocDirection[] = ['received', 'sent'];
const VAT_RATES: readonly (0 | 7 | 19)[] = [0, 7, 19];

const EMPTY_DRAFT: Draft = {
  direction: null,
  name: '',
  invoiceNo: '',
  date: '',
  amount: '',
  vatRate: '0',
  dueDate: '',
};

/** A booking with no category, to ask what VAT to show for a document that has none yet. */
const NO_BOOKING: Booking = { skr03: '', nameDe: '', labelKey: '', vatRate: 0 };

const INPUT_CLASS =
  'border-input bg-background placeholder:text-muted-foreground h-10 w-full rounded-md border px-3 text-sm aria-invalid:border-negative';

/**
 * What reading found in a document (type, from and to, invoice number, date, amount, VAT, due date), the note on why
 * it was filed as received or sent, and Edit: one form for all of it. Saving writes one history line, and none when
 * nothing changed. A name, date or amount that was read cannot be emptied; one that could not be read may stay empty.
 */
@Component({
  selector: 'app-document-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, MoneyPipe, Term, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-3" data-testid="fields-section">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-muted-foreground text-sm font-medium">
          {{ 'documents.detail.fields.title' | transloco }}
        </h2>
        @if (!editing()) {
          <button
            #editButton
            hlmBtn
            variant="outline"
            size="sm"
            type="button"
            data-testid="edit-fields"
            (click)="startEdit()"
          >
            {{ 'documents.detail.fields.edit' | transloco }}
          </button>
        }
      </div>

      @if (editing()) {
        <form
          #editForm
          class="flex flex-col gap-3"
          data-testid="edit-form"
          novalidate
          (submit)="save($event)"
        >
          <div class="flex flex-col gap-1">
            <span class="text-muted-foreground text-sm" id="edit-direction-label">
              {{ 'documents.detail.fields.direction' | transloco }}
            </span>
            <div
              role="group"
              class="border-border bg-card flex self-start overflow-hidden rounded-md border text-sm"
              aria-labelledby="edit-direction-label"
            >
              @for (direction of directions; track direction) {
                <button
                  type="button"
                  class="border-border min-h-10 border-s px-4 py-2 first:border-s-0"
                  [class]="
                    draft().direction === direction
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  "
                  [attr.data-testid]="'edit-direction-' + direction"
                  [attr.aria-pressed]="draft().direction === direction"
                  (click)="setDirection(direction)"
                >
                  {{ 'documents.direction.' + direction | transloco }}
                </button>
              }
            </div>
          </div>

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'documents.detail.fields.name' | transloco
            }}</span>
            <input
              type="text"
              dir="auto"
              data-testid="edit-name"
              [class]="inputClass"
              [value]="draft().name"
              [attr.aria-invalid]="errors().name ? 'true' : null"
              [attr.aria-describedby]="errors().name ? 'edit-error-name' : null"
              (input)="set('name', $event)"
            />
          </label>
          @if (errors().name) {
            <p
              class="text-negative -mt-2 text-xs"
              id="edit-error-name"
              role="alert"
              data-testid="edit-error-name"
            >
              {{ 'documents.detail.fix.nameError' | transloco }}
            </p>
          }

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'documents.detail.fields.invoiceNo' | transloco
            }}</span>
            <input
              type="text"
              dir="ltr"
              data-testid="edit-invoice"
              [class]="inputClass"
              [value]="draft().invoiceNo"
              (input)="set('invoiceNo', $event)"
            />
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'documents.detail.fields.date' | transloco
            }}</span>
            <input
              type="date"
              dir="ltr"
              data-testid="edit-date"
              [class]="inputClass"
              [value]="draft().date"
              [attr.aria-invalid]="errors().date ? 'true' : null"
              [attr.aria-describedby]="errors().date ? 'edit-error-date' : null"
              (input)="set('date', $event)"
            />
          </label>
          @if (errors().date) {
            <p
              class="text-negative -mt-2 text-xs"
              id="edit-error-date"
              role="alert"
              data-testid="edit-error-date"
            >
              {{ 'documents.detail.fix.dateError' | transloco }}
            </p>
          }

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'documents.detail.fields.amount' | transloco
            }}</span>
            <input
              type="text"
              inputmode="decimal"
              dir="ltr"
              data-testid="edit-amount"
              [class]="inputClass"
              [value]="draft().amount"
              [attr.aria-invalid]="errors().amount ? 'true' : null"
              [attr.aria-describedby]="errors().amount ? 'edit-error-amount' : null"
              (input)="set('amount', $event)"
            />
          </label>
          @if (errors().amount) {
            <p
              class="text-negative -mt-2 text-xs"
              id="edit-error-amount"
              role="alert"
              data-testid="edit-error-amount"
            >
              {{ 'documents.detail.fix.amountError' | transloco }}
            </p>
          }

          @if (!kleinunternehmer()) {
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{
                'documents.detail.fields.vat' | transloco
              }}</span>
              <select data-testid="edit-vat" [class]="inputClass" (change)="setVat($event)">
                @for (rate of vatRates; track rate) {
                  <option [value]="rate" [selected]="draft().vatRate === '' + rate">
                    @if (rate === 0) {
                      {{ 'payments.detail.booking.noVat' | transloco }}
                    } @else {
                      {{ 'payments.detail.booking.vatRate' | transloco: { rate } }}
                    }
                  </option>
                }
              </select>
            </label>
          }

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'documents.detail.fields.dueDate' | transloco
            }}</span>
            <input
              type="date"
              dir="ltr"
              data-testid="edit-due"
              [class]="inputClass"
              [value]="draft().dueDate"
              (input)="set('dueDate', $event)"
            />
          </label>

          <div class="flex flex-wrap gap-2">
            <button hlmBtn size="lg" type="submit" data-testid="edit-save">
              {{ 'documents.detail.fields.save' | transloco }}
            </button>
            <button
              hlmBtn
              variant="outline"
              size="lg"
              type="button"
              data-testid="edit-cancel"
              (click)="cancel()"
            >
              {{ 'documents.detail.fields.cancel' | transloco }}
            </button>
          </div>
        </form>
      } @else {
        <dl class="flex flex-col gap-3 text-sm">
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.direction' | transloco }}
            </dt>
            <dd class="font-medium" data-testid="field-type">
              @if (doc().direction) {
                <app-term [key]="termKey()" />
              } @else {
                —
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.parties' | transloco }}
            </dt>
            <dd class="flex flex-wrap items-center gap-x-2 font-medium" data-testid="field-parties">
              @if (parties(); as pair) {
                <span class="min-w-0 wrap-break-word" dir="auto" data-testid="party-from">{{
                  pair.from
                }}</span>
                <span class="text-muted-foreground inline-block rtl:rotate-180" aria-hidden="true"
                  >→</span
                >
                <span class="min-w-0 wrap-break-word" dir="auto" data-testid="party-to">{{
                  pair.to
                }}</span>
              } @else {
                <span class="min-w-0 wrap-break-word" dir="auto" data-testid="party-from">{{
                  doc().name ?? '—'
                }}</span>
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.invoiceNo' | transloco }}
            </dt>
            <dd class="font-medium wrap-break-word">
              <bdi dir="ltr"
                ><span data-testid="field-invoice">{{ doc().invoiceNo || '—' }}</span></bdi
              >
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">{{ 'documents.detail.fields.date' | transloco }}</dt>
            <dd class="font-medium" data-testid="field-date">
              @if (doc().date; as date) {
                {{ date | appDate: { year: true } }}
              } @else {
                —
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.amount' | transloco }}
            </dt>
            <dd class="font-medium">
              <bdi dir="ltr">
                <span data-testid="field-amount">
                  @let amount = doc().amountCents;
                  @if (amount !== null) {
                    {{ amount | money }}
                  } @else {
                    —
                  }
                </span>
              </bdi>
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">{{ 'documents.detail.fields.vat' | transloco }}</dt>
            <dd class="font-medium" data-testid="field-vat">
              @if (vat(); as shown) {
                <bdi dir="ltr">{{
                  'payments.detail.booking.vatRate' | transloco: { rate: shown.rate }
                }}</bdi>
                @if (shown.cents !== null) {
                  ·
                  <bdi dir="ltr">{{ shown.cents | money }}</bdi>
                }
              } @else {
                {{ 'payments.detail.booking.noVat' | transloco }}
              }
              @if (kleinunternehmer()) {
                <span class="text-muted-foreground block text-xs font-normal">
                  <app-term key="kleinunternehmer" />
                </span>
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.dueDate' | transloco }}
            </dt>
            <dd class="font-medium" data-testid="field-due">
              @if (doc().dueDate; as due) {
                {{ due | appDate: { year: true } }}
              } @else {
                —
              }
            </dd>
          </div>
        </dl>
        @if (doc().direction; as direction) {
          <p class="text-muted-foreground text-xs" data-testid="why-note">
            {{ 'documents.detail.why.' + direction | transloco }}
          </p>
        }
      }
    </section>
  `,
})
export class DocumentFields {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);

  readonly doc = input.required<Doc>();
  /** The payment the document is linked to, if any: its booking is the one the document is booked with. */
  readonly payment = input<Transaction | null>(null);

  private readonly editButton = viewChild<ElementRef<HTMLElement>>('editButton');
  private readonly editForm = viewChild<ElementRef<HTMLElement>>('editForm');

  protected readonly directions = DIRECTIONS;
  protected readonly vatRates = VAT_RATES;
  protected readonly inputClass = INPUT_CLASS;

  protected readonly editing = signal(false);
  protected readonly draft = signal<Draft>(EMPTY_DRAFT);
  protected readonly errors = signal<FieldErrors>({});

  protected readonly kleinunternehmer = computed(
    () => this.demo.business().taxProfile.kleinunternehmer,
  );
  protected readonly termKey = computed<TermKey>(() =>
    this.doc().direction === 'received' ? 'eingangsbeleg' : 'ausgangsbeleg',
  );

  /** Who it is from and to: the other party and the person's own business, in the order of the direction. */
  protected readonly parties = computed(() => {
    const doc = this.doc();
    const other = doc.name ?? '—';
    const own = this.demo.business().name;
    if (doc.direction === 'received') return { from: other, to: own };
    return doc.direction === 'sent' ? { from: own, to: other } : null;
  });

  /** The VAT to show, or null for "no VAT" (always so for a Kleinunternehmer). The amount is the share of the gross total. */
  protected readonly vat = computed(() => {
    const doc = this.doc();
    const booking = this.payment()?.booking ?? doc.booking ?? NO_BOOKING;
    const rate = vatRateShown(this.demo.business().taxProfile, {
      ...booking,
      vatRate: doc.vatRate,
    });
    if (rate === null) return null;
    const cents =
      doc.amountCents === null ? null : Math.round((doc.amountCents * rate) / (100 + rate));
    return { rate, cents };
  });

  protected startEdit(): void {
    this.draft.set(this.draftOf(this.doc()));
    this.errors.set({});
    this.editing.set(true);
    afterNextRender(
      () =>
        this.editForm()?.nativeElement.querySelector<HTMLElement>('button, input, select')?.focus(),
      { injector: this.injector },
    );
  }

  protected cancel(): void {
    this.close();
  }

  protected setDirection(direction: DocDirection): void {
    this.draft.update((draft) => ({ ...draft, direction }));
  }

  protected set(field: 'name' | 'invoiceNo' | 'date' | 'amount' | 'dueDate', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    if (field === 'name' || field === 'date' || field === 'amount') {
      this.errors.update((errors) => {
        const next = { ...errors };
        delete next[field];
        return next;
      });
    }
  }

  protected setVat(event: Event): void {
    const vatRate = (event.target as HTMLSelectElement).value;
    this.draft.update((draft) => ({ ...draft, vatRate }));
  }

  /**
   * Saves what changed as one history line. It does nothing once the form is closed, so a double tap writes one line;
   * a field that cannot be saved is named and the form stays open.
   */
  protected save(event: Event): void {
    event.preventDefault();
    if (!this.editing()) return;
    const result = this.changesFor(this.doc(), this.draft());
    if ('errors' in result) {
      this.errors.set(result.errors);
      return;
    }
    const { changes } = result;
    if (Object.keys(changes).length > 0) {
      this.demo.updateDocument(this.doc().id, (doc) => editDocument(doc, changes));
    }
    this.close();
  }

  /** What the form changes in the document, or the fields that cannot be saved as typed. */
  private changesFor(doc: Doc, draft: Draft): { changes: DocChanges } | { errors: FieldErrors } {
    const changes: DocChanges = {};
    const errors: FieldErrors = {};

    if (draft.direction !== null && draft.direction !== doc.direction) {
      changes.direction = draft.direction;
    }

    const name = draft.name.trim();
    if (name === '' ? doc.name !== null : name !== doc.name) {
      if (name === '') errors.name = true;
      else changes.name = name;
    }

    const invoiceNo = draft.invoiceNo.trim();
    if (invoiceNo !== doc.invoiceNo) changes.invoiceNo = invoiceNo;

    if (draft.date === '' ? doc.date !== null : draft.date !== doc.date) {
      if (draft.date === '') errors.date = true;
      else changes.date = draft.date;
    }

    const amount = draft.amount.trim();
    if (amount === '') {
      if (doc.amountCents !== null) errors.amount = true;
    } else {
      const cents = parseDocAmount(amount);
      if (cents === null) errors.amount = true;
      else if (cents !== doc.amountCents) changes.amountCents = cents;
    }

    if (!this.kleinunternehmer()) {
      const vatRate = Number(draft.vatRate) as 0 | 7 | 19;
      if (vatRate !== doc.vatRate) changes.vatRate = vatRate;
    }

    const dueDate = draft.dueDate === '' ? null : draft.dueDate;
    if (dueDate !== doc.dueDate) changes.dueDate = dueDate;

    return Object.keys(errors).length > 0 ? { errors } : { changes };
  }

  private close(): void {
    this.editing.set(false);
    this.errors.set({});
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }

  /** The form's fields as they are for a document now. */
  private draftOf(doc: Doc): Draft {
    return {
      direction: doc.direction,
      name: doc.name ?? '',
      invoiceNo: doc.invoiceNo,
      date: doc.date ?? '',
      amount: doc.amountCents === null ? '' : amountInput(doc.amountCents, this.language.lang()),
      vatRate: String(doc.vatRate),
      dueDate: doc.dueDate ?? '',
    };
  }
}
