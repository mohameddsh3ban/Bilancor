import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCircleX, lucideTriangleAlert } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { formatMonth, formatMonthRange } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { pluralKey } from '../core/i18n/plural-key';
import { Term } from '../core/i18n/term';
import { DialogCard } from '../core/layout/dialog-card';
import { accountName } from '../domain/bank-connection';
import { closeCheck } from '../domain/months';
import { DemoStateService } from '../state/demo-state.service';

/** Stands where the term goes in a translated sentence, so the term can be a button of its own with its explanation. */
const TERM_MARK = '\u0001';

/** What the pop-up tells the page when it goes: the month was closed, or the person put it off (Not yet, the cross, Escape, a tap outside). */
export type CloseResult = 'closed' | 'dismissed';

/**
 * The pop-up that closes a finished month: what closing does (its bookings can't be changed any more), the check that was
 * made (the payments of the month, possible duplicates, each bank account) and **Close <month>**, which is off while a
 * payment of the month still needs the person. A possible duplicate and an account to check against the statement only
 * warn. **Start** and **Show** leave the pop-up behind on their way to the review inbox and to Documents.
 *
 * The page that opens it learns how it went (`finished`) so it can put the cursor back where it belongs. Only a person who
 * may close a month gets here (see `canCloseMonths`); when the state refuses all the same, the pop-up stays open.
 */
@Component({
  selector: 'app-close-month-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogCard, HlmButton, HlmDialogImports, NgIcon, RouterLink, Term, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideCircleX, lucideTriangleAlert })],
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
        data-testid="close-dialog"
        [closeLabel]="'reports.close.cross' | transloco"
      >
        <hlm-dialog-header class="pe-8">
          <h2 hlmDialogTitle class="text-lg leading-snug font-semibold" data-testid="close-title">
            {{ 'reports.close.title' | transloco: { month: monthName() } }}
          </h2>
        </hlm-dialog-header>

        @let locks = ('reports.close.locks' | transloco: { term: termMark }).split(termMark);
        <p data-testid="close-locks">
          {{ locks[0] }}<app-term key="festschreibung" />{{ locks[1] }}
        </p>

        <ul class="flex flex-col" id="close-checks" data-testid="close-checks">
          <li
            class="border-border flex items-center gap-3 border-t py-2.5 first:border-t-0 first:pt-0"
            data-testid="close-check-payments"
          >
            @if (check().blocked) {
              <ng-icon
                name="lucideCircleX"
                size="18"
                class="text-negative shrink-0"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 font-medium">
                @for (part of blocking(); track part.key) {
                  <span
                    >{{ part.key | transloco: { count: part.count }
                    }}{{ part.last ? '' : ('reports.close.check.join' | transloco) }}</span
                  >
                }
              </span>
              <a
                hlmBtn
                size="sm"
                variant="outline"
                class="shrink-0"
                routerLink="/review"
                data-testid="close-check-start"
                (click)="leave()"
              >
                {{ 'reports.close.check.start' | transloco }}
              </a>
            } @else {
              <ng-icon
                name="lucideCircleCheck"
                size="18"
                class="text-positive shrink-0"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">{{ 'reports.close.check.paid' | transloco }}</span>
            }
          </li>

          <li
            class="border-border flex items-center gap-3 border-t py-2.5"
            data-testid="close-check-duplicates"
          >
            @let duplicates = check().duplicateDocIds.length;
            @if (duplicates > 0) {
              <ng-icon
                name="lucideTriangleAlert"
                size="18"
                class="text-warning shrink-0"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">{{
                plural('reports.close.check.duplicates', duplicates)
                  | transloco: { count: duplicates }
              }}</span>
              <a
                hlmBtn
                size="sm"
                variant="outline"
                class="shrink-0"
                routerLink="/documents"
                data-testid="close-check-show"
                (click)="leave()"
              >
                {{ 'reports.close.check.show' | transloco }}
              </a>
            } @else {
              <ng-icon
                name="lucideCircleCheck"
                size="18"
                class="text-positive shrink-0"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">{{
                'reports.close.check.noDuplicates' | transloco
              }}</span>
            }
          </li>

          @for (item of accounts(); track item.account.id) {
            <li
              class="border-border flex items-center gap-3 border-t py-2.5"
              [attr.data-testid]="'close-check-account-' + item.account.id"
            >
              <ng-icon
                [name]="item.result === 'matches' ? 'lucideCircleCheck' : 'lucideTriangleAlert'"
                size="18"
                class="shrink-0"
                [class]="item.result === 'matches' ? 'text-positive' : 'text-warning'"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1"
                ><bdi class="font-medium">{{
                  nameOf(item.account, 'settings.bank.product.' + item.account.product | transloco)
                }}</bdi
                >: {{ 'reports.close.check.' + item.result | transloco }}</span
              >
            </li>
          }
        </ul>

        <hlm-dialog-footer>
          <button
            hlmBtn
            type="button"
            variant="outline"
            class="min-h-10"
            data-testid="close-not-yet"
            (click)="notYet()"
          >
            {{ 'reports.close.notYet' | transloco }}
          </button>
          <button
            hlmBtn
            type="button"
            class="min-h-10"
            aria-describedby="close-checks"
            data-testid="close-confirm"
            [disabled]="check().blocked"
            (click)="confirm()"
          >
            {{ 'reports.close.confirm' | transloco: { month: shortName() } }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class CloseMonthDialog {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  /** The month to close ('YYYY-MM'). Kept while the pop-up fades out, so its words never change in front of the eyes. */
  readonly month = input.required<string>();
  /** Whether the pop-up is open. */
  readonly open = model.required<boolean>();
  /** How it went, when the person closed the month or put it off (not when they left for the review inbox or Documents). */
  readonly finished = output<CloseResult>();

  protected readonly termMark = TERM_MARK;
  protected readonly plural = pluralKey;
  protected readonly nameOf = accountName;

  protected readonly check = computed(() => closeCheck(this.demo.business(), this.month()));
  /** "September 2026", for the question. */
  protected readonly monthName = computed(() => formatMonth(this.month(), this.language.lang()));
  /** "September", for the button. */
  protected readonly shortName = computed(() =>
    formatMonthRange(this.month(), this.month(), this.language.lang()),
  );

  /** What still needs the person, kind by kind, in the order a payment is dealt with; `last` ends the list. */
  protected readonly blocking = computed(() => {
    const { unclear, confirm, noReceipt } = this.check();
    const parts = [
      { key: pluralKey('reports.close.check.unclear', unclear), count: unclear },
      { key: 'reports.close.check.confirm', count: confirm },
      { key: pluralKey('reports.close.check.noReceipt', noReceipt), count: noReceipt },
    ].filter((part) => part.count > 0);
    return parts.map((part, i) => ({ ...part, last: i === parts.length - 1 }));
  });

  /** The accounts the check looked at, each with its account, so the pop-up can name it. */
  protected readonly accounts = computed(() => {
    const accounts = this.demo.business().accounts;
    return this.check().accounts.flatMap(({ accountId, result }) => {
      const account = accounts.find((a) => a.id === accountId);
      return account ? [{ account, result }] : [];
    });
  });

  /** The cross, Escape and a tap outside close the pop-up by themselves; it follows. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed' && this.open()) this.notYet();
  }

  protected notYet(): void {
    this.open.set(false);
    this.finished.emit('dismissed');
  }

  /** Start and Show: the pop-up goes with the page it came from. */
  protected leave(): void {
    this.open.set(false);
  }

  /** Closes the month. When the state refuses (a person who may not close, a month that cannot be closed), nothing happens and the pop-up stays. */
  protected confirm(): void {
    if (!this.demo.closeMonth(this.month())) return;
    this.open.set(false);
    this.finished.emit('closed');
  }
}
