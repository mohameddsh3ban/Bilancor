import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../i18n/language.service';
import { formatMoney } from './format';

/** Impure on purpose: it must re-run when the language signal changes. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(cents: number, opts?: { signed?: boolean; whole?: boolean }): string {
    return formatMoney(cents, this.language.lang(), opts);
  }
}
