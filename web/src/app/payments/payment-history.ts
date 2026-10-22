import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { Account, HistoryEntry } from '../data/models';

/** Unicode first-strong isolate and its end: what is between them keeps its own direction and does not reorder the sentence around it. */
const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068);
const POP_ISOLATE = String.fromCodePoint(0x2069);

/**
 * What happened to a payment, newest line first. Lines are stored as keys with parameters, so they read in
 * the language of the page: a category parameter is a label key, and the cash box is named in that language.
 * Every other parameter goes to the text as it is, except a name (a payment or document name, or a file name): it is
 * isolated, so a Latin name inside an Arabic sentence (or the other way round) keeps its order.
 */
@Component({
  selector: 'app-payment-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <ol class="flex flex-col gap-2 text-sm" data-testid="history">
      @for (entry of entries(); track entry) {
        <li class="flex gap-3" data-testid="history-item">
          <time
            class="text-muted-foreground shrink-0"
            data-testid="history-date"
            [class.w-14]="!withYear()"
            [class.w-28]="withYear()"
            [attr.datetime]="entry.date"
          >
            {{ entry.date | appDate: { year: withYear() } }}
          </time>
          <span class="min-w-0" data-testid="history-text">
            {{
              'history.' + entry.key
                | transloco
                  : {
                      ...entry.params,
                      name: isolate(entry.params['name']),
                      category: entry.params['category']
                        ? ('booking.' + entry.params['category'] | transloco)
                        : '',
                      account: isCashBox(entry.params['account'])
                        ? ('account.cash' | transloco)
                        : entry.params['account'],
                    }
            }}
          </span>
        </li>
      }
    </ol>
  `,
})
export class PaymentHistory {
  readonly entries = input.required<readonly HistoryEntry[]>();
  /** The open business's accounts, to tell the cash box from a bank. */
  readonly accounts = input.required<readonly Account[]>();
  /** Show the year in each line's date (for a printout). */
  readonly withYear = input(false);

  protected isolate(text: string | undefined): string | undefined {
    return text === undefined ? undefined : `${FIRST_STRONG_ISOLATE}${text}${POP_ISOLATE}`;
  }

  protected isCashBox(name: string | undefined): boolean {
    return this.accounts().some((account) => account.kind === 'cash' && account.name === name);
  }
}
