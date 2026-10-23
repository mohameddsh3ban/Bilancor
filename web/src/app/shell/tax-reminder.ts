import { ChangeDetectionStrategy, Component, inject, linkedSignal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { AppDatePipe } from '../core/format/date.pipe';
import { AppTaxPeriodPipe } from '../core/format/tax-period.pipe';
import { Term } from '../core/i18n/term';
import { TaxReminderService, type TaxReminderItem } from '../state/tax-reminder.service';

/**
 * The pop-up that opens with the app when a VAT return is due soon or overdue: one block for each business, so the
 * client knows which business it is about. Got it keeps those reminders away until their next deadline; Not now (the
 * button, the cross, Escape, a tap outside) shows them again at the next start.
 */
@Component({
  selector: 'app-tax-reminder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, AppTaxPeriodPipe, HlmButton, HlmDialogImports, Term, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <hlm-dialog
      [state]="reminder.open() ? 'open' : 'closed'"
      autoFocus="dialog"
      (stateChanged)="onStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        data-testid="tax-reminder"
        class="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto"
        [closeLabel]="'taxReminder.close' | transloco"
      >
        <hlm-dialog-header class="pe-8">
          <h2 hlmDialogTitle class="text-lg leading-snug font-semibold">
            {{
              (items().length === 1 ? 'taxReminder.titleOne' : 'taxReminder.title')
                | transloco: { count: items().length }
            }}
          </h2>
        </hlm-dialog-header>

        <ul
          class="-mx-1 -my-1 flex max-h-[min(24rem,45dvh)] flex-col gap-3 overflow-y-auto px-1 py-1"
          data-testid="tax-reminder-list"
        >
          @for (item of items(); track item.businessId) {
            @let overdue = item.view.daysLeft < 0;
            <li
              class="border-border flex flex-col items-start gap-3 rounded-lg border p-3"
              [attr.data-testid]="'tax-reminder-item-' + item.businessId"
            >
              <div class="flex min-w-0 flex-col gap-1">
                <p class="font-medium wrap-break-word" data-testid="tax-reminder-name">{{ item.name }}</p>
                <p class="text-sm">
                  <app-term key="ustva" />
                  {{ 'taxReminder.forPeriod' | transloco: { period: (item.view.period | appTaxPeriod) } }}
                </p>
                <p
                  class="text-sm"
                  [class]="overdue ? 'text-negative font-medium' : 'text-muted-foreground'"
                  data-testid="tax-reminder-due"
                >
                  @if (overdue) {
                    {{ 'taxReminder.overdueSince' | transloco }}
                    <bdi dir="ltr">{{ item.view.dueDate | appDate }}</bdi>
                  } @else {
                    {{ 'taxReminder.due' | transloco }}
                    <bdi dir="ltr">{{ item.view.dueDate | appDate }}</bdi>
                    · {{ daysTextKey(item.view.daysLeft) | transloco: { days: item.view.daysLeft } }}
                  }
                </p>
              </div>
              <button
                hlmBtn
                type="button"
                variant="outline"
                data-testid="tax-reminder-open"
                (click)="reminder.openTaxes(item.businessId)"
              >
                {{ 'taxReminder.openTaxes' | transloco }}
              </button>
            </li>
          }
        </ul>

        <hlm-dialog-footer>
          <button
            hlmBtn
            type="button"
            variant="outline"
            class="h-auto min-h-10 py-1.5 whitespace-normal"
            data-testid="tax-reminder-not-now"
            (click)="reminder.notNow()"
          >
            {{ 'taxReminder.notNow' | transloco }}
          </button>
          <button
            hlmBtn
            type="button"
            class="h-auto min-h-10 py-1.5 whitespace-normal"
            data-testid="tax-reminder-got-it"
            (click)="reminder.gotIt()"
          >
            {{ 'taxReminder.gotIt' | transloco }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class TaxReminder {
  protected readonly reminder = inject(TaxReminderService);

  /**
   * The returns the pop-up lists: those that were due when it opened. Got it empties the service's list at once, and the
   * pop-up keeps its words until it has faded out instead of announcing "0 tax returns".
   */
  protected readonly items = linkedSignal<boolean, TaxReminderItem[]>({
    source: this.reminder.open,
    computation: (open, previous) => (open ? untracked(this.reminder.due) : (previous?.value ?? [])),
  });

  /** The cross, Escape and a tap outside close the dialog by themselves; that counts as Not now. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') this.reminder.notNow();
  }

  /** "in 19 days", "in 1 day" or "today". */
  protected daysTextKey(daysLeft: number): string {
    if (daysLeft === 0) return 'taxReminder.today';
    return daysLeft === 1 ? 'taxReminder.inOneDay' : 'taxReminder.inDays';
  }
}
