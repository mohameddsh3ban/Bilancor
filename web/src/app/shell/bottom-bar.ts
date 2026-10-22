import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { BOTTOM_BAR_ITEMS, MORE_ITEMS, SHELL_ICONS } from './menu';

/** Phone layout: fixed bar with a raised camera button in the centre and a "more" menu. */
@Component({
  selector: 'app-bottom-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmDropdownMenuImports, NgIcon, RouterLink, RouterLinkActive, TranslocoPipe],
  viewProviders: [provideIcons(SHELL_ICONS)],
  template: `
    <nav
      data-testid="bottom-bar"
      class="bg-background border-border fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-end border-t pb-[env(safe-area-inset-bottom)]"
      [attr.aria-label]="'shell.mainMenu' | transloco"
    >
      @for (item of items; track item.id) {
        @if (item.id === 'upload') {
          <a
            [routerLink]="item.route"
            [queryParams]="item.queryParams"
            class="bg-primary text-primary-foreground -mt-6 mb-2 flex size-14 items-center justify-center place-self-center rounded-full shadow-lg"
            [attr.aria-label]="'menu.upload' | transloco"
          >
            <ng-icon [name]="item.icon" size="26" aria-hidden="true" />
          </a>
        } @else if (item.route === null) {
          <button
            type="button"
            data-testid="more-button"
            class="text-muted-foreground flex flex-col items-center gap-0.5 py-2 text-xs"
            [hlmDropdownMenuTrigger]="moreMenu"
            side="top"
            align="end"
          >
            <ng-icon [name]="item.icon" size="22" aria-hidden="true" />
            {{ 'menu.more' | transloco }}
          </button>
        } @else {
          <a
            [routerLink]="item.route"
            routerLinkActive="text-primary font-medium"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: item.id === 'home' }"
            class="text-muted-foreground flex flex-col items-center gap-0.5 py-2 text-xs"
          >
            <ng-icon [name]="item.icon" size="22" aria-hidden="true" />
            {{ 'menu.' + item.id | transloco }}
          </a>
        }
      }
    </nav>

    <ng-template #moreMenu>
      <div hlmDropdownMenu class="w-48">
        @for (item of moreItems; track item.id) {
          <a hlmDropdownMenuItem [routerLink]="item.route">
            <ng-icon [name]="item.icon" aria-hidden="true" />
            {{ 'menu.' + item.id | transloco }}
          </a>
        }
      </div>
    </ng-template>
  `,
})
export class BottomBar {
  protected readonly items = BOTTOM_BAR_ITEMS;
  protected readonly moreItems = MORE_ITEMS;
}
