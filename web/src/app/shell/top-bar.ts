import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { LanguageService } from '../core/i18n/language.service';
import { Lang } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { BellPanel } from './bell-panel';
import { SHELL_ICONS } from './menu';

/** Greeting, business switcher, notifications bell and language switcher. */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BellPanel, HlmButton, HlmDropdownMenuImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons(SHELL_ICONS)],
  template: `
    <header
      class="bg-background border-border flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2 lg:px-6"
    >
      <p class="w-full truncate text-sm font-medium lg:w-auto lg:flex-1">
        {{ 'shell.greeting' | transloco: { name: demo.person.firstName } }}
      </p>

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
        <div hlmDropdownMenu class="w-56">
          @for (business of demo.businesses; track business.id) {
            <button hlmDropdownMenuItem type="button" (triggered)="demo.setBusiness(business.id)">
              <span class="flex-1 truncate text-start">{{ business.name }}</span>
              @if (business.id === demo.business().id) {
                <ng-icon name="lucideCheck" aria-hidden="true" />
              }
            </button>
          }
        </div>
      </ng-template>

      <app-bell-panel />

      <div
        class="border-border flex overflow-hidden rounded-md border"
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
            (click)="language.setLang(option.lang)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </header>
  `,
})
export class TopBar {
  protected readonly demo = inject(DemoStateService);
  protected readonly language = inject(LanguageService);
  protected readonly languages: { lang: Lang; label: string }[] = [
    { lang: 'en', label: 'EN' },
    { lang: 'de', label: 'DE' },
    { lang: 'ar', label: 'عربي' },
  ];
}
