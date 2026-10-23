import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { LanguageService } from '../core/i18n/language.service';
import { Lang } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { PersonLanguageService } from '../state/person-language.service';
import { BellPanel } from './bell-panel';
import { SHELL_ICONS } from './menu';
import { NeedsYouButton } from './needs-you-button';
import { PersonMenu } from './person-menu';

/**
 * Greeting, the "Needs you" button, notifications bell, business switcher (with the person's role in each business, and
 * Add a business), language switcher and the person menu.
 * On a phone it is two rows: what wants the person on top, the settings below. On a computer it is one row.
 */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BellPanel,
    HlmButton,
    HlmDropdownMenuImports,
    NeedsYouButton,
    NgIcon,
    PersonMenu,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons(SHELL_ICONS)],
  template: `
    <header
      class="bg-background border-border flex flex-col gap-1 border-b px-4 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-6"
    >
      <div class="flex items-center gap-2 lg:contents">
        <p class="min-w-0 flex-1 truncate text-sm font-medium">
          {{ 'shell.greeting' | transloco: { name: demo.person.firstName } }}
        </p>

        <app-needs-you-button />

        <app-bell-panel />
      </div>

      <div class="flex items-center gap-2 lg:contents">
        <button
          hlmBtn
          variant="outline"
          class="min-w-0 flex-1 justify-between lg:flex-none"
          data-testid="business-switcher"
          [hlmDropdownMenuTrigger]="businessMenu"
          align="start"
          [attr.aria-label]="'shell.switchBusiness' | transloco"
        >
          <span class="truncate">{{ demo.business().name }}</span>
          <ng-icon name="lucideChevronDown" aria-hidden="true" />
        </button>
        <ng-template #businessMenu>
          <div hlmDropdownMenu class="w-64">
            @for (business of demo.businesses; track business.id) {
              <button hlmDropdownMenuItem type="button" (triggered)="demo.setBusiness(business.id)">
                <span class="flex min-w-0 flex-1 items-center gap-1.5">
                  <span class="truncate text-start">{{ business.name }}</span>
                  @if (business.id === demo.business().id) {
                    <ng-icon name="lucideCheck" aria-hidden="true" />
                  }
                </span>
                @if (demo.roleIn(business.id); as role) {
                  <span class="text-muted-foreground shrink-0 text-xs" data-testid="business-role">
                    {{ 'roles.' + role + '.name' | transloco }}
                  </span>
                }
              </button>
            }
            <div hlmDropdownMenuSeparator></div>
            <a hlmDropdownMenuItem routerLink="/businesses/new" data-testid="add-business">
              <ng-icon name="lucidePlus" aria-hidden="true" />
              {{ 'shell.addBusiness' | transloco }}
            </a>
          </div>
        </ng-template>

        <div
          class="border-border flex shrink-0 overflow-hidden rounded-md border"
          role="group"
          data-testid="lang-switcher"
          [attr.aria-label]="'shell.language' | transloco"
        >
          @for (option of languages; track option.lang) {
            <button
              type="button"
              class="px-2.5 py-1.5 text-xs font-medium"
              [lang]="option.lang"
              [class.bg-primary]="language.lang() === option.lang"
              [class.text-primary-foreground]="language.lang() === option.lang"
              [attr.aria-pressed]="language.lang() === option.lang"
              (click)="personLanguage.set(option.lang)"
            >
              {{ option.label }}
            </button>
          }
        </div>

        <app-person-menu />
      </div>
    </header>
  `,
})
export class TopBar {
  protected readonly demo = inject(DemoStateService);
  protected readonly language = inject(LanguageService);
  protected readonly personLanguage = inject(PersonLanguageService);
  protected readonly languages: { lang: Lang; label: string }[] = [
    { lang: 'en', label: 'EN' },
    { lang: 'de', label: 'DE' },
    { lang: 'ar', label: 'عربي' },
  ];
}
