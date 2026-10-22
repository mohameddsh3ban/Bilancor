import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../i18n/language.service';
import { formatMonth } from './format';

/** A 'YYYY-MM' month as its name and year. Impure on purpose: it must re-run when the language signal changes. */
@Pipe({ name: 'appMonth', pure: false })
export class AppMonthPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(month: string): string {
    return formatMonth(month, this.language.lang());
  }
}
