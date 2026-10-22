import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { Account, HistoryEntry } from '../data/models';

/**
 * What happened to a payment, newest line first. Lines are stored as keys with parameters, so they read in
 * the language of the page: a category parameter is a label key, and the cash box is named in that language.
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

  protected isCashBox(name: string | undefined): boolean {
    return this.accounts().some((account) => account.kind === 'cash' && account.name === name);
  }
}
