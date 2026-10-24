import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HelpContextService } from '../state/help-context.service';
import { ReviewService } from '../state/review.service';
import { BottomBar } from './bottom-bar';
import { DemoToolbar } from './demo-toolbar';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

/**
 * The frame every page sits in: demo bar, top bar, sidebar (from lg) or bottom bar (below lg), and the tax reminder that
 * pops up over whatever page the app opened on.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomBar, DemoToolbar, RouterOutlet, Sidebar, TopBar],
  template: `
    <div class="bg-surface flex min-h-dvh flex-col">
      <app-demo-toolbar />
      <div class="flex min-w-0 flex-1">
        <app-sidebar class="sticky top-0 hidden h-dvh shrink-0 self-start lg:block" />
        <div class="flex min-w-0 flex-1 flex-col">
          <app-top-bar />
          <main class="flex-1 p-4 pb-28 lg:p-6 lg:pb-6">
            <router-outlet />
          </main>
        </div>
      </div>
      <app-bottom-bar class="lg:hidden" />
    </div>
  `,
})
export class AppShell {
  constructor() {
    // The review inbox sends the person back to the page they came from. Start its service here, with the app, so it
    // has seen that page before the first visit to /review.
    inject(ReviewService);

    // Help offers the questions for the page the client came from. Start its service here too, so it has seen that page
    // before the first visit to /help.
    inject(HelpContextService);

    // The tax reminder pops up over whatever page the app opened on. It is loaded as the app starts, not with it: its
    // dialog code would otherwise weigh on every start (and the build's size budget).
    const container = inject(ViewContainerRef);
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => (destroyed = true));
    void import('./tax-reminder').then(({ TaxReminder }) => {
      if (!destroyed) container.createComponent(TaxReminder);
    });
  }
}
