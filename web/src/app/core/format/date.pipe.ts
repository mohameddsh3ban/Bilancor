import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../i18n/language.service';
import { formatDate } from './format';

/** Impure on purpose: it must re-run when the language signal changes. */
@Pipe({ name: 'appDate', pure: false })
export class AppDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  /** `{ year: true }` adds the year, for dates that leave the app (a printout). */
  transform(iso: string, opts: { year?: boolean } = {}): string {
    return formatDate(iso, this.language.lang(), opts);
  }
}
