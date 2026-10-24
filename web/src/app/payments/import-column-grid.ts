import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ColumnMapping, ColumnRole, SampleStatement } from '../data/models';
import { mappingComplete } from '../domain/statement-import';
import { ChoiceCard, INPUT_CLASS } from '../settings/form-parts';
import { columnSamples, roleChoices, withMoneyOut, withRole } from './column-matching';

/**
 * "Match the columns", for a statement whose layout is not known: how money out is shown, and one card for each column of the
 * file with its header, its first cells and a choice of what it holds. The mapping is the guessed one to begin with; every change
 * is handed back through `mapping`, and the page's preview follows. The columns are cards in one column, not a table, so a file with
 * many columns needs no sideways scrolling on a phone.
 */
@Component({
  selector: 'app-import-column-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceCard, TranslocoPipe],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <h2 class="text-lg font-semibold" id="columns-title" data-testid="columns-title">
      {{ 'statementImport.columns.title' | transloco }}
    </h2>
    <p class="text-muted-foreground text-sm">{{ 'statementImport.columns.intro' | transloco }}</p>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-sm font-medium">
        {{ 'statementImport.columns.moneyOut' | transloco }}
      </legend>
      <div class="grid gap-2 sm:grid-cols-2">
        <app-choice-card
          name="money-out"
          data-testid="money-out-minus"
          [checked]="mapping().moneyOut === 'minus'"
          (changed)="setMoneyOut('minus')"
        >
          {{ 'statementImport.columns.minus' | transloco }}
        </app-choice-card>
        <app-choice-card
          name="money-out"
          data-testid="money-out-column"
          [checked]="mapping().moneyOut === 'column'"
          (changed)="setMoneyOut('column')"
        >
          {{ 'statementImport.columns.column' | transloco }}
        </app-choice-card>
      </div>
    </fieldset>

    <ul class="flex flex-col gap-2" aria-labelledby="columns-title">
      @for (role of mapping().roles; track $index; let i = $index) {
        <li
          class="border-border bg-card flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          data-testid="column"
        >
          <div class="flex min-w-0 flex-col gap-0.5">
            <label
              class="font-medium [overflow-wrap:anywhere]"
              dir="auto"
              [attr.for]="'column-' + i"
              >{{
                statement().header[i] ||
                  ('statementImport.columns.unnamed' | transloco: { number: i + 1 })
              }}</label
            >
            <p class="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
              @for (cell of samples()[i]; track $index) {
                <bdi dir="ltr" class="[overflow-wrap:anywhere]" data-testid="column-sample">{{
                  cell
                }}</bdi>
              }
            </p>
          </div>
          <select
            [id]="'column-' + i"
            [class]="inputClass + ' sm:w-48 sm:shrink-0'"
            [attr.data-testid]="'column-select-' + i"
            (change)="setRole(i, $event)"
          >
            @for (choice of choices(); track choice) {
              <option [value]="choice" [selected]="role === choice">
                {{ 'statementImport.columns.role.' + labelOf(choice) | transloco }}
              </option>
            }
          </select>
        </li>
      }
    </ul>

    @if (!complete()) {
      <p class="text-warning text-sm" role="status" data-testid="columns-need">
        {{
          (needsOut() ? 'statementImport.columns.needOut' : 'statementImport.columns.need')
            | transloco
        }}
      </p>
    }
  `,
})
export class ImportColumnGrid {
  /** The file whose columns are matched. */
  readonly statement = input.required<SampleStatement>();
  /** What each column holds and how money out is shown: the guess to begin with, then what the person made of it. */
  readonly mapping = model.required<ColumnMapping>();

  protected readonly inputClass = INPUT_CLASS;
  protected readonly choices = computed(() => roleChoices(this.mapping().moneyOut));
  protected readonly complete = computed(() => mappingComplete(this.mapping()));
  /** The only thing missing is the column of money out, which has its own column. */
  protected readonly needsOut = computed(() => {
    const { roles, moneyOut } = this.mapping();
    return (
      moneyOut === 'column' &&
      !roles.includes('amountOut') &&
      ['date', 'who', 'amount'].every((role) => roles.includes(role as ColumnRole))
    );
  });
  /** The first cells of each column, for the person to tell it by. */
  protected readonly samples = computed(() =>
    this.mapping().roles.map((_, i) => columnSamples(this.statement(), i)),
  );

  /** With its own column, the amount is the money that comes in. */
  protected labelOf(role: ColumnRole): ColumnRole | 'amountIn' {
    return role === 'amount' && this.mapping().moneyOut === 'column' ? 'amountIn' : role;
  }

  protected setRole(index: number, event: Event): void {
    this.mapping.update((mapping) =>
      withRole(mapping, index, (event.target as HTMLSelectElement).value as ColumnRole),
    );
  }

  protected setMoneyOut(moneyOut: ColumnMapping['moneyOut']): void {
    this.mapping.update((mapping) => withMoneyOut(mapping, moneyOut));
  }
}
