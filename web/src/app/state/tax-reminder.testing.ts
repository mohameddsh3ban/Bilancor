import type { Provider } from '@angular/core';
import { TaxReminderService } from './tax-reminder.service';

/**
 * For tests that mount the real shell (with the real routes) but are about something else: the tax reminder would pop
 * up over the page a moment after the shell starts, since the sample returns are due. This stands in for the service
 * with one that has nothing due and never opens. The reminder's own tests and the shell's reminder tests use the real one.
 */
export function provideNoTaxReminder(): Provider {
  return { provide: TaxReminderService, useValue: { due: () => [], open: () => false } };
}
