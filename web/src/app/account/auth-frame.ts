import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { LanguageService } from '../core/i18n/language.service';
import type { Lang } from '../data/models';

/**
 * The frame of every page for people who are not in yet (sign in, forgotten password, sign up, joining): a card in the
 * middle of the page, with the app's name and the language buttons above it. There is no app shell and no demo bar here;
 * the demo's help sits in dashed boxes on the pages themselves.
 *
 * The buttons only set the browser's language (nobody is signed in, so there is no person to save it for) and tell the
 * page that one was picked: signing in then keeps that language instead of the person's own.
 */
@Component({
  selector: 'app-auth-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, TranslocoPipe],
  host: { class: 'bg-surface flex min-h-dvh flex-col items-center justify-center gap-4 p-4' },
  template: `
    <div class="flex w-full max-w-md items-center justify-between gap-3">
      <p class="flex min-w-0 items-center gap-2" data-testid="auth-brand">
        <span class="bg-primary size-8 shrink-0 rounded-md" aria-hidden="true"></span>
        <span class="text-muted-foreground truncate text-sm">{{ 'shell.logo' | transloco }}</span>
      </p>
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
            (click)="pick(option.lang)"
          >
            {{ option.label }}
          </button>
        }
      </div>
    </div>

    <main hlmCard class="w-full max-w-md">
      <div hlmCardContent class="flex flex-col gap-4">
        <ng-content />
      </div>
    </main>
  `,
})
export class AuthFrame {
  protected readonly language = inject(LanguageService);
  protected readonly languages: { lang: Lang; label: string }[] = [
    { lang: 'en', label: 'EN' },
    { lang: 'de', label: 'DE' },
    { lang: 'ar', label: 'عربي' },
  ];

  /** A language button was pressed (the language is already set). */
  readonly langPicked = output<Lang>();

  protected pick(lang: Lang): void {
    this.language.setLang(lang);
    this.langPicked.emit(lang);
  }
}
