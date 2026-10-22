import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircle, lucideCircleCheck } from '@ng-icons/lucide';
import { Params, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { setupSteps } from '../../domain/home-cards';
import { DemoStateService } from '../../state/demo-state.service';

type StepId = 'bank' | 'tax' | 'receipt';
const STEP_IDS: readonly StepId[] = ['bank', 'tax', 'receipt'];

/**
 * The three setup steps with a tick on the finished ones. Uploading the first receipt opens Documents with the
 * Add choices open; the other steps link to their (coming soon) pages.
 */
@Component({
  selector: 'app-setup-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCircle, lucideCircleCheck })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="setup-checklist">
      <header hlmCardHeader>
        <h2 hlmCardTitle>{{ 'home.checklist.title' | transloco }}</h2>
      </header>
      <ul hlmCardContent class="flex flex-col gap-3">
        @for (step of steps(); track step.id) {
          <li class="flex items-center gap-3" [attr.data-testid]="'step-' + step.id" [attr.data-done]="step.done">
            @if (step.done) {
              <ng-icon
                name="lucideCircleCheck"
                size="22"
                class="text-positive shrink-0"
                role="img"
                [attr.aria-label]="'home.checklist.done' | transloco"
              />
            } @else {
              <ng-icon name="lucideCircle" size="22" class="text-muted-foreground shrink-0" aria-hidden="true" />
            }
            <span class="min-w-0 flex-1" [class.text-muted-foreground]="step.done">
              {{ 'home.checklist.' + step.id | transloco }}
            </span>
            <a
              hlmBtn
              size="sm"
              class="shrink-0"
              [variant]="step.done ? 'ghost' : 'outline'"
              [routerLink]="step.link"
              [queryParams]="step.queryParams"
              [attr.data-testid]="'step-action-' + step.id"
            >
              {{ (step.done ? 'home.checklist.view' : 'home.checklist.start') | transloco }}
            </a>
          </li>
        }
      </ul>
    </section>
  `,
})
export class SetupChecklist {
  private readonly demo = inject(DemoStateService);

  protected readonly steps = computed(() => {
    const done = setupSteps(this.demo.setup());
    return STEP_IDS.map((id) => ({ id, done: done[id], ...this.target(id, done[id]) }));
  });

  /** Where a step leads: the Add menu for a receipt that is still to do, Documents once it is done, else its coming-soon page. */
  private target(id: StepId, done: boolean): { link: string[]; queryParams: Params | undefined } {
    if (id !== 'receipt') return { link: ['/soon', id], queryParams: undefined };
    return { link: ['/documents'], queryParams: done ? undefined : { add: '1' } };
  }
}
