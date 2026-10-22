import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { Account, HistoryEntry } from '../data/models';
import { accountName } from '../domain/bank-connection';

/** Unicode first-strong isolate and its end: what is between them keeps its own direction and does not reorder the sentence around it. */
const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068);
const POP_ISOLATE = String.fromCodePoint(0x2069);

/** A name set apart from the sentence around it, so it keeps its own direction and does not reorder the sentence. */
export function isolateText(text: string): string {
  return `${FIRST_STRONG_ISOLATE}${text}${POP_ISOLATE}`;
}

/**
 * What happened to a payment, newest line first. Lines are stored as keys with parameters, so they read in
 * the language of the page: a category parameter is a label key, and an account is named as everywhere else (the cash
 * box and the products of a bank in that language).
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
        @let account = accountOf(entry.params['account']);
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
                      account: account
                        ? nameOf(account, ('settings.bank.product.' + account.product | transloco))
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
  /** The open business's accounts, to name the one a line speaks of. */
  readonly accounts = input.required<readonly Account[]>();
  /** Show the year in each line's date (for a printout). */
  readonly withYear = input(false);

  protected readonly nameOf = accountName;

  protected isolate(text: string | undefined): string | undefined {
    return text === undefined ? undefined : isolateText(text);
  }

  /** The account a line names by its stored name, if the business has it. */
  protected accountOf(name: string | undefined): Account | undefined {
    return name === undefined ? undefined : this.accounts().find((account) => account.name === name);
  }
}
