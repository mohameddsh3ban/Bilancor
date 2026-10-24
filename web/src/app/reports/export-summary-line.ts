import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../core/i18n/language.service';
import { pluralKey } from '../core/i18n/plural-key';
import type { ExportPeriod, ExportState, ExportSummary } from '../domain/exports';
import { exportPeriodShortName } from './export-period-name';

/** Stands where the period goes in the translated sentence, so the period can sit in a `<bdi>` of its own. */
const PERIOD_MARK = '\u0001';

/** The colours of the word that says where a period stands. */
const STATE_CLASSES: Record<ExportState, string> = {
  closed: 'bg-positive/10 text-positive',
  notClosed: 'bg-warning/10 text-warning',
  running: 'bg-muted text-muted-foreground',
  partly: 'bg-warning/10 text-warning',
};

/**
 * What one export holds, in one line: "October: 11 bookings, 8 receipts · Running · 6 payments still need you". The state is
 * a word (Closed, Not closed, Running, Partly closed), and the payments that still need the person are named only when
 * there are some. The export card and its printable summary both show it, so the two always agree.
 */
@Component({
  selector: 'app-export-summary-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'block' },
  template: `
    @let s = summary();
    @let counts =
      (
        'reports.export.counts'
        | transloco
          : {
              period: periodMark,
              bookings:
                (plural('reports.export.bookings', s.bookings) | transloco: { count: s.bookings }),
              receipts:
                (plural('reports.export.receipts', s.receipts) | transloco: { count: s.receipts }),
            }
      ).split(periodMark);
    <p aria-live="polite" data-testid="export-summary">
      <span data-testid="export-counts"
        >{{ counts[0] }}<bdi>{{ name() }}</bdi
        >{{ counts[1] }}</span
      >
      <span aria-hidden="true"> · </span>
      <span
        class="inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
        [class]="stateClass()"
        data-testid="export-state"
        >{{ 'reports.export.state.' + s.state | transloco }}</span
      >
      @if (s.needsYou > 0) {
        <span aria-hidden="true"> · </span>
        <span id="export-needs" class="font-medium" data-testid="export-needs">{{
          plural('reports.needs.title', s.needsYou) | transloco: { count: s.needsYou }
        }}</span>
      }
    </p>
  `,
})
export class ExportSummaryLine {
  private readonly language = inject(LanguageService);

  readonly period = input.required<ExportPeriod>();
  readonly summary = input.required<ExportSummary>();

  protected readonly periodMark = PERIOD_MARK;
  protected readonly plural = pluralKey;

  /** "October", "Q4 2026" or "2026". */
  protected readonly name = computed(() =>
    exportPeriodShortName(this.period(), this.language.lang()),
  );
  protected readonly stateClass = computed(() => STATE_CLASSES[this.summary().state]);
}
