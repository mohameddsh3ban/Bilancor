import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { translateSignal } from '@jsverse/transloco';
import { decisionCount } from '../domain/home-figures';
import { DemoStateService } from '../state/demo-state.service';

/** Stands in for the number while the text is translated, so the number can go in an element of its own. */
const COUNT = '\uE000';

/**
 * "Needs you · N" in the top bar: one tap to the review inbox from every screen. N is the same count the homepage
 * shows (`decisionCount`), so the button follows the data and is not there when nothing needs the person.
 */
@Component({
  selector: 'app-needs-you-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  // No box of its own: while the button is hidden, it leaves no empty gap in the top bar.
  host: { class: 'contents' },
  template: `
    @if (count() > 0) {
      <a
        class="bg-warning text-warning-foreground hover:bg-warning/95 focus-visible:ring-ring/50 inline-block h-10 shrink-0 rounded-full px-4 text-sm leading-10 font-medium whitespace-nowrap outline-none focus-visible:ring-3"
        data-testid="needs-you-button"
        routerLink="/review"
      >
        {{ text().before }}<bdi dir="ltr">{{ count() }}</bdi
        >{{ text().after }}
      </a>
    }
  `,
})
export class NeedsYouButton {
  private readonly demo = inject(DemoStateService);

  protected readonly count = computed(() => decisionCount(this.demo.business(), this.demo.setup()));
  private readonly translated = translateSignal('review.needsYouButton', { count: COUNT });
  /** The text around the number, wherever the language puts it. */
  protected readonly text = computed(() => {
    const [before, after = ''] = this.translated().split(COUNT);
    return { before, after };
  });
}
