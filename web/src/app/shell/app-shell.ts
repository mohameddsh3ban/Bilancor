import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomBar } from './bottom-bar';
import { DemoToolbar } from './demo-toolbar';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

/** The frame every page sits in: demo bar, top bar, sidebar (from lg) or bottom bar (below lg). */
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
export class AppShell {}
