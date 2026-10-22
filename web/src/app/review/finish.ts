import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewService } from '../state/review.service';

/**
 * What the review inbox says when nothing is left: a check, "All done", one line about what was done (decisions, and
 * receipts added and duplicates removed when there were any), the next VAT return for a business that has one, and Back.
 */
@Component({
  selector: 'app-review-finish',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck })],
  host: {
    class: 'flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center',
    'data-testid': 'review-finish',
  },
  template: `
    <span
      class="bg-positive text-positive-foreground flex size-24 items-center justify-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.3,1.6,0.6,1)] starting:scale-20 motion-reduce:transition-none"
      data-testid="finish-check"
      aria-hidden="true"
    >
      <ng-icon name="lucideCheck" size="52" />
    </span>
    <h1 class="text-xl font-bold" data-testid="finish-title">
      {{ 'review.finish.title' | transloco }}
    </h1>
    @if (parts().length > 0) {
      <p class="text-muted-foreground" data-testid="finish-summary">
        @for (part of parts(); track part.key) {
          @if (!$first) {
            ·
          }
          {{ part.key | transloco: { count: part.count } }}
        }
      </p>
    }
    @if (vatDue(); as vat) {
      <p class="text-sm font-medium" data-testid="finish-vat">
        {{ 'review.finish.vat' | transloco: { date: (vat.dueDate | appDate) } }}
      </p>
    }
    <button hlmBtn size="lg" class="mt-2 min-w-32" data-testid="finish-back" (click)="back.emit()">
      {{ 'review.finish.back' | transloco }}
    </button>
  `,
})
export class ReviewFinish {
  private readonly demo = inject(DemoStateService);
  private readonly review = inject(ReviewService);

  /** The person is done and wants to leave. */
  readonly back = output<void>();

  protected readonly vatDue = computed(() => this.demo.business().vatDue);

  /**
   * The line "6 decisions · 1 receipt added · 1 duplicate removed" as its parts (a translation key and a count). A part
   * that is zero is left out, and so is the whole line when nothing was done.
   */
  protected readonly parts = computed(() => {
    const { decisions, receiptsAdded, duplicatesRemoved } = this.review.summary();
    return [
      { kind: 'decisions', count: decisions },
      { kind: 'receipts', count: receiptsAdded },
      { kind: 'duplicates', count: duplicatesRemoved },
    ]
      .filter(({ count }) => count > 0)
      .map(({ kind, count }) => ({
        key: `review.finish.${kind}.${count === 1 ? 'one' : 'many'}`,
        count,
      }));
  });
}
