import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SetupState } from '../data/models';
import { presetOf } from '../domain/home-cards';
import { AccountService } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { NoticeService } from '../state/notice.service';
import { PersonLanguageService } from '../state/person-language.service';

/** Demo-only strip at the very top: lets the owner compare the three setup states, and start the demo over. */
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
            [class.bg-primary-foreground]="pressed() === state"
            [class.text-primary]="pressed() === state"
            [attr.aria-pressed]="pressed() === state"
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
        (click)="reset()"
      >
        {{ 'demo.reset' | transloco }}
      </button>
    </div>
  `,
})
export class DemoToolbar {
  protected readonly accounts = inject(AccountService);
  protected readonly demo = inject(DemoStateService);
  protected readonly router = inject(Router);
  protected readonly notices = inject(NoticeService);
  private readonly personLanguage = inject(PersonLanguageService);
  protected readonly states: readonly SetupState[] = ['new', 'halfway', 'active'];
  /** The shortcut that matches the open business's steps exactly; none for a mixed set. */
  protected readonly pressed = computed(() => presetOf(this.demo.setup()));

  /**
   * Starts the demo over: signs out, puts the sample data back and opens the sign-in page. The order matters: signing out
   * comes first, so the person is Sara when the dismissed notices are cleared (they are kept per person and business), and
   * the sample data never goes back under a signed-in account made in the demo, which has no business in it.
   */
  protected reset(): void {
    this.accounts.reset();
    this.demo.resetData();
    this.notices.resetDismissals();
    this.personLanguage.forgetPick();
    void this.router.navigateByUrl('/sign-in');
  }
}
