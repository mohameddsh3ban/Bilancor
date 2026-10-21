import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideListChecks } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { decisionMinutes } from '../../domain/home-figures';
import { DemoStateService } from '../../state/demo-state.service';

/** How many things wait for the person's decision, with a time estimate and a Start button. */
@Component({
  selector: 'app-decisions-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideListChecks })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="decisions-card">
      <div class="flex items-center gap-3 px-(--card-spacing)">
        @if (count() > 0) {
          <ng-icon name="lucideListChecks" size="22" class="text-primary shrink-0" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="font-medium">
              {{ (count() === 1 ? 'home.decisions.one' : 'home.decisions.many') | transloco: { count: count() } }}
            </p>
            <p class="text-muted-foreground text-xs">
              {{
                (minutes() === 1 ? 'home.decisions.minutesOne' : 'home.decisions.minutes')
                  | transloco: { count: minutes() }
              }}
            </p>
          </div>
          <a hlmBtn size="sm" class="shrink-0" [routerLink]="['/soon', 'decisions']">
            {{ 'home.decisions.start' | transloco }}
          </a>
        } @else {
          <ng-icon name="lucideCircleCheck" size="22" class="text-positive shrink-0" aria-hidden="true" />
          <p class="min-w-0 flex-1 font-medium">{{ 'home.decisions.allClear' | transloco }}</p>
        }
      </div>
    </section>
  `,
})
export class DecisionsCard {
  private readonly demo = inject(DemoStateService);

  protected readonly count = computed(() => this.demo.business().decisionsOpen);
  protected readonly minutes = computed(() => decisionMinutes(this.count()));
}
