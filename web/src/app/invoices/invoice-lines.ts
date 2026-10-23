import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import type { InvoiceLine, InvoiceUnit, Lang } from '../data/models';
import { amountInput, parseDocAmount } from '../domain/amount-input';
import { lineNetCents } from '../domain/invoices';
import { parseAmountQuery } from '../domain/payment-filters';
import { focusAfterRender } from '../settings/form-helpers';
import { FieldError, INPUT_CLASS } from '../settings/form-parts';

/** The units a line can be in, as the choice lists them. */
export const UNITS: readonly InvoiceUnit[] = ['piece', 'hour', 'day', 'flat'];

/** What one line of the form holds: every number as the text of its field. */
export interface LineRow {
  description: string;
  quantity: string;
  unit: InvoiceUnit;
  price: string;
}

/** A line nothing is written in yet: one piece, at no price. */
export function newLine(): InvoiceLine {
  return { description: '', quantity: 1, unit: 'piece', unitPriceCents: 0 };
}

/** The quantity typed in a field, or null unless it is a number above 0. `1,5` and `1.5` read alike. */
export function parseQuantity(text: string): number | null {
  const amount = parseAmountQuery(text);
  return amount !== null && !amount.negative && amount.cents > 0 ? amount.cents / 100 : null;
}

/** The earlier lines that contain what is typed, in any case, the ones that begin with it first (otherwise the most recent first, as given), at most `limit`. Nothing for nothing typed. */
export function suggestLines(
  typed: string,
  earlier: readonly InvoiceLine[],
  limit = 4,
): InvoiceLine[] {
  const query = typed.trim().toLowerCase();
  if (query === '') return [];
  const found = earlier.filter((line) => line.description.toLowerCase().includes(query));
  const beginning = found.filter((line) => line.description.toLowerCase().startsWith(query));
  return [...beginning, ...found.filter((line) => !beginning.includes(line))].slice(0, limit);
}

/** A line as its fields show it: a quantity or price that is not there yet is an empty field, and numbers use the decimal mark of the language. */
export function rowOf(line: InvoiceLine, lang: Lang): LineRow {
  const quantity = String(line.quantity);
  return {
    description: line.description,
    quantity: line.quantity > 0 ? (lang === 'de' ? quantity.replace('.', ',') : quantity) : '',
    unit: line.unit,
    price: line.unitPriceCents > 0 ? amountInput(line.unitPriceCents, lang) : '',
  };
}

/** A row read back as a line: a quantity or price that cannot be read is 0, so the line is not complete. */
function lineOf(row: LineRow): InvoiceLine {
  return {
    description: row.description,
    quantity: parseQuantity(row.quantity) ?? 0,
    unit: row.unit,
    unitPriceCents: parseDocAmount(row.price) ?? 0,
  };
}

/** A row with no description and no price is still waiting for its line (its quantity and unit alone make no line). */
const isBlank = (row: LineRow): boolean => row.description.trim() === '' && row.price.trim() === '';

/** The lines the rows make: every row that has a description or a price. */
export function linesOf(rows: readonly LineRow[]): InvoiceLine[] {
  return rows.filter((row) => !isBlank(row)).map(lineOf);
}

const sameLines = (a: readonly InvoiceLine[], b: readonly InvoiceLine[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * "What you did": the lines of an invoice, one block each with description, quantity, unit, price per unit and what the
 * line comes to, and a button to add one more. It starts from the `lines` it is given (one empty row when there are none)
 * and from then on keeps what is typed as it is typed (`49,` stays `49,` until it is finished), so the lines it gives back
 * through `linesChange` do not start it over; it starts over only for another `resetKey`. A row with no description and no
 * price is not a line, and a change that leaves the lines as they were gives nothing back: looking around saves nothing.
 *
 * Typing a description offers earlier lines (`suggestions`) with their price and unit; choosing one fills description, unit
 * and price and puts the cursor in the quantity. Prices and quantities accept `49,90` and `49.90`; one that cannot be read
 * is named under its field. The last row cannot be removed, so there is always a line to write in.
 *
 * Layout: the description has a row of its own; below it quantity, unit, price, amount and remove are two by two while the
 * list is narrow, and one row of five once the list itself is 32rem wide (a container query on the list, not the screen:
 * on a computer the list sits beside the "Ready to send" card and is narrower than the screen suggests).
 */
@Component({
  selector: 'app-invoice-lines',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldError, HlmButton, MoneyPipe, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucidePlus, lucideTrash2 })],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <ul class="@container flex flex-col gap-3" data-testid="lines">
      @for (row of rows(); track $index; let i = $index) {
        <li
          role="group"
          class="border-border grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border p-3 @lg:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] @lg:items-start"
          [attr.aria-label]="'invoiceForm.lines.line' | transloco: { n: i + 1 }"
          [attr.data-testid]="'line-row-' + i"
        >
          <div
            class="col-span-2 flex flex-col gap-1 text-sm @lg:col-span-5"
            (focusin)="activeRow.set(i)"
            (focusout)="leaveRow($event, i)"
          >
            <label class="flex flex-col gap-1">
              <span class="text-muted-foreground">{{
                'invoiceForm.lines.description' | transloco
              }}</span>
              <input
                type="text"
                dir="auto"
                autocomplete="off"
                [class]="inputClass"
                [attr.data-testid]="'line-description-' + i"
                [value]="row.description"
                (input)="onDescription(i, $event)"
              />
            </label>
            @let hints = suggestionsFor(i);
            @if (hints.length > 0) {
              <ul
                class="border-border bg-card flex flex-col overflow-hidden rounded-md border text-sm"
                [attr.aria-label]="'invoiceForm.lines.suggestions' | transloco"
                [attr.data-testid]="'suggestions-' + i"
                (mousedown)="$event.preventDefault()"
              >
                @for (hint of hints; track hint.description; let j = $index) {
                  <li class="border-border border-b last:border-b-0">
                    <button
                      type="button"
                      class="hover:bg-muted flex min-h-10 w-full flex-wrap items-center justify-between gap-x-3 px-3 py-1.5 text-start"
                      [attr.data-testid]="'suggestion-' + i + '-' + j"
                      (click)="pick(i, hint)"
                    >
                      <span dir="auto">{{ hint.description }}</span
                      >&ngsp;<span class="text-muted-foreground"
                        ><bdi dir="ltr">{{ hint.unitPriceCents | money }}</bdi> ·
                        {{ 'invoiceForm.unit.' + hint.unit | transloco }}</span
                      >
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="flex flex-col gap-1 text-sm">
            <label class="flex flex-col gap-1">
              <span class="text-muted-foreground">{{
                'invoiceForm.lines.quantity' | transloco
              }}</span>
              <input
                type="text"
                inputmode="decimal"
                dir="ltr"
                autocomplete="off"
                [class]="inputClass"
                [attr.data-testid]="'line-quantity-' + i"
                [value]="row.quantity"
                [attr.aria-invalid]="quantityInvalid(row) ? 'true' : null"
                [attr.aria-describedby]="quantityInvalid(row) ? 'line-error-quantity-' + i : null"
                (input)="onQuantity(i, $event)"
              />
            </label>
            @if (quantityInvalid(row)) {
              <p
                appFieldError="invoiceForm.lines.quantityError"
                [id]="'line-error-quantity-' + i"
                [attr.data-testid]="'line-error-quantity-' + i"
              ></p>
            }
          </div>

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'invoiceForm.lines.unit' | transloco }}</span>
            <select
              [class]="inputClass"
              [attr.data-testid]="'line-unit-' + i"
              (change)="onUnit(i, $event)"
            >
              @for (unit of units; track unit) {
                <option [value]="unit" [selected]="row.unit === unit">
                  {{ 'invoiceForm.unit.' + unit | transloco }}
                </option>
              }
            </select>
          </label>

          <div class="flex flex-col gap-1 text-sm">
            <label class="flex flex-col gap-1">
              <span class="text-muted-foreground">{{ 'invoiceForm.lines.price' | transloco }}</span>
              <input
                type="text"
                inputmode="decimal"
                dir="ltr"
                autocomplete="off"
                [class]="inputClass"
                [attr.data-testid]="'line-price-' + i"
                [value]="row.price"
                [attr.aria-invalid]="priceInvalid(row) ? 'true' : null"
                [attr.aria-describedby]="priceInvalid(row) ? 'line-error-price-' + i : null"
                (input)="onPrice(i, $event)"
              />
            </label>
            @if (priceInvalid(row)) {
              <p
                appFieldError="invoiceForm.lines.priceError"
                [id]="'line-error-price-' + i"
                [attr.data-testid]="'line-error-price-' + i"
              ></p>
            }
          </div>

          <div class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'invoiceForm.lines.net' | transloco }}</span>
            <span class="flex h-10 items-center font-medium" [attr.data-testid]="'line-net-' + i">
              @if (netOf(row); as net) {
                <bdi dir="ltr">{{ net | money }}</bdi>
              } @else {
                <span class="text-muted-foreground" aria-hidden="true">—</span>
              }
            </span>
          </div>

          @if (rows().length > 1) {
            <button
              hlmBtn
              type="button"
              variant="ghost"
              size="icon-lg"
              class="col-span-2 justify-self-end @lg:col-span-1 @lg:mt-6 @lg:justify-self-auto"
              [attr.aria-label]="'invoiceForm.lines.remove' | transloco: { n: i + 1 }"
              [attr.data-testid]="'line-remove-' + i"
              (click)="remove(i)"
            >
              <ng-icon name="lucideTrash2" size="16" aria-hidden="true" />
            </button>
          }
        </li>
      }
    </ul>

    <button
      hlmBtn
      type="button"
      variant="outline"
      size="lg"
      class="self-start"
      data-testid="add-line"
      (click)="add()"
    >
      <ng-icon name="lucidePlus" size="16" aria-hidden="true" />
      {{ 'invoiceForm.lines.add' | transloco }}
    </button>
  `,
})
export class InvoiceLines {
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The lines the form starts from; the lines it gives back are not read again until `resetKey` changes. */
  readonly lines = input.required<readonly InvoiceLine[]>();
  /** The lines written before, most recent first, to suggest from. */
  readonly suggestions = input<readonly InvoiceLine[]>([]);
  /** Another key starts the rows over from `lines`: another invoice, another business, a reset. */
  readonly resetKey = input<string>('');
  /** The lines now: whenever a change makes other lines than the ones the form was given. */
  readonly linesChange = output<InvoiceLine[]>();

  protected readonly units = UNITS;
  protected readonly inputClass = INPUT_CLASS;

  protected readonly rows = linkedSignal<string, LineRow[]>({
    source: this.resetKey,
    computation: () =>
      untracked(() => {
        const lang = this.language.lang();
        const rows = this.lines().map((line) => rowOf(line, lang));
        return rows.length > 0 ? rows : [rowOf(newLine(), lang)];
      }),
  });

  /** The row whose description has the cursor (or the suggestions), whose earlier lines are offered. */
  protected readonly activeRow = signal<number | null>(null);

  /** The earlier lines offered for a row while its description is being written; one that is already exactly what the row says is not offered again. */
  protected suggestionsFor(index: number): InvoiceLine[] {
    if (this.activeRow() !== index) return [];
    const row = this.rows()[index];
    if (!row) return [];
    const now = lineOf(row);
    return suggestLines(row.description, this.suggestions()).filter(
      (line) =>
        !(
          line.description === now.description &&
          line.unit === now.unit &&
          line.unitPriceCents === now.unitPriceCents
        ),
    );
  }

  protected quantityInvalid(row: LineRow): boolean {
    return row.quantity.trim() !== '' && parseQuantity(row.quantity) === null;
  }

  protected priceInvalid(row: LineRow): boolean {
    return row.price.trim() !== '' && parseDocAmount(row.price) === null;
  }

  /** What the line comes to; 0 for a row that cannot be read yet. */
  protected netOf(row: LineRow): number {
    return lineNetCents(lineOf(row));
  }

  protected onDescription(index: number, event: Event): void {
    this.activeRow.set(index);
    this.edit(index, { description: (event.target as HTMLInputElement).value });
  }

  protected onQuantity(index: number, event: Event): void {
    this.edit(index, { quantity: (event.target as HTMLInputElement).value });
  }

  protected onUnit(index: number, event: Event): void {
    this.edit(index, { unit: (event.target as HTMLSelectElement).value as InvoiceUnit });
  }

  protected onPrice(index: number, event: Event): void {
    this.edit(index, { price: (event.target as HTMLInputElement).value });
  }

  /** The cursor left the description and its suggestions: they go away. */
  protected leaveRow(event: FocusEvent, index: number): void {
    const inside = (event.currentTarget as HTMLElement).contains(
      event.relatedTarget as Node | null,
    );
    if (!inside && this.activeRow() === index) this.activeRow.set(null);
  }

  /** An earlier line was chosen: its description, unit and price go into the row (the quantity stays), and the cursor goes to the quantity. */
  protected pick(index: number, line: InvoiceLine): void {
    this.activeRow.set(null);
    this.edit(index, {
      description: line.description,
      unit: line.unit,
      price: amountInput(line.unitPriceCents, this.language.lang()),
    });
    this.focus(`line-quantity-${index}`);
  }

  protected add(): void {
    const rows = [...this.rows(), rowOf(newLine(), this.language.lang())];
    this.commit(rows);
    this.focus(`line-description-${rows.length - 1}`);
  }

  protected remove(index: number): void {
    const rows = this.rows();
    if (rows.length < 2) return;
    this.commit(rows.filter((_, i) => i !== index));
    this.focus(`line-description-${Math.min(index, rows.length - 2)}`);
  }

  /** Puts the cursor in the first thing a line still needs: its description, then its quantity, then its price; the first description when every line is complete or nothing is written. */
  focusFirstIncomplete(): void {
    const rows = this.rows();
    let target = 'line-description-0';
    for (const [i, row] of rows.entries()) {
      if (row.description.trim() === '') target = `line-description-${i}`;
      else if (parseQuantity(row.quantity) === null) target = `line-quantity-${i}`;
      else if (parseDocAmount(row.price) === null) target = `line-price-${i}`;
      else continue;
      break;
    }
    this.focus(target);
  }

  private edit(index: number, patch: Partial<LineRow>): void {
    this.commit(this.rows().map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  /** Keeps the rows, and gives the lines back when they are other lines than the ones the form was given. */
  private commit(rows: LineRow[]): void {
    this.rows.set(rows);
    const lines = linesOf(rows);
    if (!sameLines(lines, this.lines())) this.linesChange.emit(lines);
  }

  private focus(testId: string): void {
    focusAfterRender(this.injector, this.host.nativeElement, `[data-testid="${testId}"]`);
  }
}
