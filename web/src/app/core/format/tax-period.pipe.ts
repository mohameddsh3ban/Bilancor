import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../i18n/language.service';
import { formatTaxPeriod } from './format';

/** A VAT period (a `TaxPeriod`) as its name: "October 2026" or "Q3 2026". Impure on purpose: it must re-run when the language signal changes. */
@Pipe({ name: 'appTaxPeriod', pure: false })
export class AppTaxPeriodPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(period: { start: string; kind: 'monthly' | 'quarterly' }): string {
    return formatTaxPeriod(period, this.language.lang());
  }
}
