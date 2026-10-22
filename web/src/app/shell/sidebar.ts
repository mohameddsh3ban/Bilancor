import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { MENU_ITEMS, SHELL_ICONS, UPLOAD_ITEM } from './menu';

/** Computer layout: logo placeholder, "Upload receipt" and the full menu, on the start side. */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, RouterLink, RouterLinkActive, TranslocoPipe],
  viewProviders: [provideIcons(SHELL_ICONS)],
  template: `
    <aside class="bg-card border-border flex h-full w-60 flex-col gap-4 border-e p-4">
      <div class="flex items-center gap-2 px-2">
        <span class="bg-primary size-8 rounded-md" aria-hidden="true"></span>
        <span class="text-muted-foreground text-sm">{{ 'shell.logo' | transloco }}</span>
      </div>

      <a
        hlmBtn
        size="lg"
        class="w-full"
        [routerLink]="upload.route"
        [queryParams]="upload.queryParams"
      >
        <ng-icon [name]="upload.icon" aria-hidden="true" />
        {{ 'menu.upload' | transloco }}
      </a>

      <nav class="flex flex-col gap-1" [attr.aria-label]="'shell.mainMenu' | transloco">
        @for (item of items; track item.id) {
          <a
            [routerLink]="item.route"
            routerLinkActive="bg-muted text-foreground font-medium"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: item.id === 'home' }"
            class="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm"
          >
            <ng-icon [name]="item.icon" size="18" aria-hidden="true" />
            {{ 'menu.' + item.id | transloco }}
          </a>
        }
      </nav>
    </aside>
  `,
})
export class Sidebar {
  protected readonly items = MENU_ITEMS;
  protected readonly upload = UPLOAD_ITEM;
}
