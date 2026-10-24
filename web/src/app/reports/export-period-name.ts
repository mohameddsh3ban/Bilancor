import { formatMonth, formatMonthRange, formatTaxPeriod } from '../core/format/format';
import type { Lang } from '../data/models';
import type { ExportPeriod } from '../domain/exports';

/** The name of an export period: its month and year ("October 2026"), its quarter and year ("Q4 2026") or its year ("2026"). */
export function exportPeriodName(period: ExportPeriod, lang: Lang): string {
  switch (period.kind) {
    case 'month':
      return formatMonth(period.key, lang);
    case 'quarter':
      return formatTaxPeriod({ start: period.start, kind: 'quarterly' }, lang);
    case 'year':
      return period.key;
  }
}

/** The name of an export period for a line that already sits in its year: the month alone ("October"), else as `exportPeriodName`. */
export function exportPeriodShortName(period: ExportPeriod, lang: Lang): string {
  return period.kind === 'month'
    ? formatMonthRange(period.key, period.key, lang)
    : exportPeriodName(period, lang);
}
