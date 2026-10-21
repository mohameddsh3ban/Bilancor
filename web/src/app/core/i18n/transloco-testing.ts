import { importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import ar from '../../../../public/i18n/ar.json';
import de from '../../../../public/i18n/de.json';
import en from '../../../../public/i18n/en.json';

/** Synchronous, network-free translations for unit tests. */
export function provideTranslocoTesting() {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { en, de, ar },
      preloadLangs: true,
      translocoConfig: {
        availableLangs: ['en', 'de', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
      },
    }),
  );
}
