import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { LanguageService } from '../core/i18n/language.service';
import { Doc, DocDirection, Lang } from '../data/models';
import { editDocument } from '../domain/document-actions';
import { parseAmountQuery } from '../domain/payment-filters';
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

/** What the form holds: every field as the text of its input. */
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

const INPUT_CLASS =
  'border-input bg-background placeholder:text-muted-foreground h-10 w-full rounded-md border px-3 text-sm aria-invalid:border-negative';

/**
 * The form that edits what was read in a document: direction, name, invoice number, date, amount, VAT rate and due
 * date. What is typed belongs to the document it was opened for: it starts from that document's values and starts over
 * when the document shown is another one, so one document's values can never be saved into another.
 * Saving writes one history line, and none when nothing changed; a name, date or amount that was read cannot be
 * emptied, one that could not be read may stay empty. `done` says the form is finished (saved, or cancelled).
 */
@Component({
  selector: 'app-document-edit-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, TranslocoPipe],
  template: `
    <form class="flex flex-col gap-3" data-testid="edit-form" novalidate (submit)="save($event)">
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
        <span class="text-muted-foreground">{{ 'documents.detail.fields.name' | transloco }}</span>
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
        <span class="text-muted-foreground">{{ 'documents.detail.fields.date' | transloco }}</span>
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
          <span class="text-muted-foreground">{{ 'documents.detail.fields.vat' | transloco }}</span>
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
          (click)="done.emit()"
        >
          {{ 'documents.detail.fields.cancel' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class DocumentEditForm {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The document the form edits. */
  readonly doc = input.required<Doc>();
  /** The form is finished: its changes were saved, or it was cancelled. */
  readonly done = output<void>();

  protected readonly directions = DIRECTIONS;
  protected readonly vatRates = VAT_RATES;
  protected readonly inputClass = INPUT_CLASS;

  /** What is typed, and which fields were refused: both start from the document shown, and start over for another one. */
  protected readonly draft = linkedSignal<string, Draft>({
    source: () => this.doc().id,
    computation: () => untracked(() => this.draftOf(this.doc())),
  });
  protected readonly errors = linkedSignal<string, FieldErrors>({
    source: () => this.doc().id,
    computation: () => ({}),
  });

  protected readonly kleinunternehmer = computed(
    () => this.demo.business().taxProfile.kleinunternehmer,
  );

  /** Set once the changes are saved, so a second tap before the form has closed saves nothing more. */
  private saved = false;

  constructor() {
    // The cursor goes into the form when it opens.
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLElement>('button, input, select')?.focus(),
    );
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
   * Saves what changed as one history line, and says the form is done. A field that cannot be saved is named and the
   * form stays open.
   */
  protected save(event: Event): void {
    event.preventDefault();
    if (this.saved) return;
    const doc = this.doc();
    const result = this.changesFor(doc, this.draft());
    if ('errors' in result) {
      this.errors.set(result.errors);
      return;
    }
    const { changes } = result;
    this.saved = true;
    if (Object.keys(changes).length > 0) {
      this.demo.updateDocument(doc.id, (current) => editDocument(current, changes));
    }
    this.done.emit();
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
