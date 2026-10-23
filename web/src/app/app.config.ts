import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { LanguageService } from './core/i18n/language.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // A link to a place on a page (/settings#bank-accounts) scrolls to it.
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    // Create LanguageService at startup so a stored language is applied to <html lang dir> on first load.
    provideAppInitializer(() => {
      inject(LanguageService);
    }),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['en', 'de', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
