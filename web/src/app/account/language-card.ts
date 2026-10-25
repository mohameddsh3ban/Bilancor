import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { LanguageService } from '../core/i18n/language.service';
import type { Lang } from '../data/models';
import { PersonLanguageService } from '../state/person-language.service';

/** The three languages, each named in itself: a person who can't read the page's language still finds theirs. */
const OPTIONS: readonly { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'de', label: 'Deutsch' },
  { lang: 'ar', label: 'عربي' },
];

/**
 * My account › Language: English, Deutsch or عربي, the person's own language. The choice is saved for the person and the
 * app follows at once; the language buttons in the top bar change the same setting. The card says which papers follow it
 * (a VAT return's transfer receipt, an export's Print summary) and which keep their own language (a self-issued receipt
 * is always German, an invoice German or English), as Help's answer about the language does.
 */
@Component({
  selector: 'app-language-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="language-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle id="language-title" tabindex="-1" class="outline-none">
          {{ 'account.language.title' | transloco }}
        </h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-3">
        <div
          class="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="language-title"
          data-testid="language-buttons"
        >
          @for (option of options; track option.lang) {
            <button
              type="button"
              class="focus-visible:ring-ring/50 min-h-10 min-w-24 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-3"
              [lang]="option.lang"
              [class]="
                language.lang() === option.lang
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-muted'
              "
              [attr.aria-pressed]="language.lang() === option.lang"
              [attr.data-testid]="'language-' + option.lang"
              (click)="personLanguage.set(option.lang)"
            >
              {{ option.label }}
            </button>
          }
        </div>
        <p class="text-muted-foreground text-sm" data-testid="language-hint">
          {{ 'account.language.hint' | transloco }}
          {{ 'account.language.buttons' | transloco }}
        </p>
      </div>
    </section>
  `,
})
export class LanguageCard {
  protected readonly language = inject(LanguageService);
  protected readonly personLanguage = inject(PersonLanguageService);
  protected readonly options = OPTIONS;
}
