import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SetupState } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { NoticeService } from '../state/notice.service';

/** Demo-only strip at the very top: lets the owner compare the three setup states. */
@Component({
  selector: 'app-demo-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div
      data-testid="demo-toolbar"
      class="bg-primary text-primary-foreground flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1 text-xs"
    >
      <span class="bg-primary-foreground text-primary rounded-sm px-1.5 py-0.5 font-semibold uppercase">
        {{ 'demo.label' | transloco }}
      </span>
      <span>{{ 'demo.setup' | transloco }}</span>
      <div class="flex gap-1" role="group" [attr.aria-label]="'demo.setup' | transloco">
        @for (state of states; track state) {
          <button
            type="button"
            class="rounded-sm border border-current px-2 py-0.5"
            [class.bg-primary-foreground]="demo.setup() === state"
            [class.text-primary]="demo.setup() === state"
            [attr.aria-pressed]="demo.setup() === state"
            (click)="demo.setSetup(state)"
          >
            {{ 'demo.' + state | transloco }}
          </button>
        }
      </div>
      <button
        type="button"
        class="rounded-sm border border-current px-2 py-0.5"
        data-testid="demo-reset"
        (click)="notices.resetDismissals()"
      >
        {{ 'demo.reset' | transloco }}
      </button>
    </div>
  `,
})
export class DemoToolbar {
  protected readonly demo = inject(DemoStateService);
  protected readonly notices = inject(NoticeService);
  protected readonly states: readonly SetupState[] = ['new', 'halfway', 'active'];
}
