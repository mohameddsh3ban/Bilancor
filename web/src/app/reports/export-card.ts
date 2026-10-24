import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { DEMO_BOX } from '../account/demo-email';
import { LanguageService } from '../core/i18n/language.service';
import { pluralKey } from '../core/i18n/plural-key';
import { DEMO_TODAY } from '../data/demo-date';
import {
  exportFileName,
  exportPeriods,
  exportSummary,
  type ExportKind,
  type ExportPeriod,
} from '../domain/exports';
import { ChoiceCard } from '../settings/form-parts';
import { DemoStateService } from '../state/demo-state.service';
import { exportPeriodName } from './export-period-name';
import { ExportSummaryLine } from './export-summary-line';

/** Stands where a link or a name goes in a translated sentence, so it can be an element of its own. */
const MARK = '\u0001';

/** Which file a download would be. */
type ExportFile = 'datev' | 'csv';

/**
 * "Export for your tax advisor": the bookings and receipts of a month, a quarter or the year, in the format tax advisors
 * read (DATEV) or as a spreadsheet. The period is a segmented choice of Month, Quarter or Year and a select of the periods
 * that can be exported; a line says what the export holds and where it stands. When some payments still need the person,
 * the export can go ahead with them marked as open (chosen first) or wait while the person fixes them: that choice turns
 * the downloads off, and Start opens the review inbox. A period with no payments has nothing to export and no downloads.
 *
 * No file is made in the demo: a download shows a dashed box with the file's made-up name and **Print summary**, which
 * opens the printable summary. The choice starts over when the period or the business changes, and the box goes with
 * them and with a change of choice. The last line names the tax advisor who can download it too, or points to where to
 * invite one.
 */
@Component({
  selector: 'app-export-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceCard, ExportSummaryLine, HlmButton, HlmCardImports, RouterLink, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="export-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle data-testid="export-title">{{ 'reports.export.title' | transloco }}</h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-3">
        <p class="text-muted-foreground" data-testid="export-body">
          {{ 'reports.export.body' | transloco }}
        </p>

        <div class="flex flex-col gap-2">
          <div
            role="group"
            class="border-border bg-card flex max-w-full self-start overflow-hidden rounded-md border text-sm"
            [attr.aria-label]="'reports.export.period' | transloco"
          >
            @for (option of kinds; track option) {
              <button
                type="button"
                class="border-border min-h-10 min-w-0 border-s px-3 py-2 whitespace-nowrap first:border-s-0"
                [class]="
                  kind() === option
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                "
                [attr.data-testid]="'export-kind-' + option"
                [attr.aria-pressed]="kind() === option"
                (click)="kind.set(option)"
              >
                {{ 'reports.export.kind.' + option | transloco }}
              </button>
            }
          </div>
          <select
            class="border-input bg-background h-10 w-full min-w-0 rounded-md border px-3 text-sm"
            data-testid="export-period"
            [attr.aria-label]="'reports.export.pick.' + kind() | transloco"
            (change)="onPick($event)"
          >
            @for (option of periods(); track option.key) {
              <option [value]="option.key" [selected]="option.key === period()?.key">
                {{ nameOf(option) }}
              </option>
            }
          </select>
        </div>

        @if (view(); as v) {
          @let s = v.summary;
          @if (s.empty) {
            <p class="text-muted-foreground" role="status" data-testid="export-nothing">
              {{ 'reports.export.nothing' | transloco }}
            </p>
          } @else {
            <app-export-summary-line [period]="v.period" [summary]="s" />

            @if (s.needsYou > 0) {
              <div
                role="radiogroup"
                class="flex flex-col gap-2"
                aria-labelledby="export-needs"
                data-testid="export-choices"
              >
                <app-choice-card
                  name="export-choice"
                  data-testid="export-choice-open"
                  [checked]="!fixing()"
                  (changed)="choice.set('open')"
                >
                  {{ plural('reports.export.choice.open', s.needsYou) | transloco }}
                </app-choice-card>
                <div class="flex items-stretch gap-2">
                  <app-choice-card
                    class="min-w-0 flex-1"
                    name="export-choice"
                    data-testid="export-choice-fix"
                    [checked]="fixing()"
                    (changed)="choice.set('fix')"
                  >
                    {{ plural('reports.export.choice.fix', s.needsYou) | transloco }}
                  </app-choice-card>
                  <a
                    hlmBtn
                    variant="outline"
                    class="h-auto min-h-12 shrink-0 self-stretch"
                    routerLink="/review"
                    data-testid="export-start"
                  >
                    {{ 'reports.needs.start' | transloco }}
                  </a>
                </div>
              </div>
            }

            @if (fixing()) {
              <p
                class="text-muted-foreground text-xs"
                id="export-fix-off"
                data-testid="export-fix-off"
              >
                {{ 'reports.export.fixOff' | transloco }}
              </p>
            }

            <div class="flex flex-wrap gap-2">
              <button
                hlmBtn
                type="button"
                class="min-h-10"
                data-testid="export-download-datev"
                [disabled]="fixing()"
                [attr.aria-describedby]="fixing() ? 'export-fix-off' : null"
                (click)="asked.set('datev')"
              >
                {{ 'reports.export.datev' | transloco }}
              </button>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="export-download-csv"
                [disabled]="fixing()"
                [attr.aria-describedby]="fixing() ? 'export-fix-off' : null"
                (click)="asked.set('csv')"
              >
                {{ 'reports.export.csv' | transloco }}
              </button>
            </div>

            <div aria-live="polite">
              @if (fileName(); as name) {
                <div
                  [class]="demoBox"
                  role="group"
                  aria-labelledby="export-demo-label"
                  data-testid="export-demo"
                >
                  <p class="text-warning text-xs font-semibold" id="export-demo-label">
                    {{ 'reports.demo.label' | transloco }}
                  </p>
                  <p>
                    {{ 'reports.demo.noFile' | transloco }}
                    <bdi dir="ltr" class="font-medium break-all" data-testid="export-file">{{
                      name
                    }}</bdi>
                  </p>
                  <a
                    hlmBtn
                    size="sm"
                    variant="outline"
                    class="min-h-10 self-start"
                    data-testid="export-print"
                    [routerLink]="['/print/export', v.period.key]"
                  >
                    {{ 'reports.export.print' | transloco }}
                  </a>
                </div>
              }
            </div>
          }
        }

        @for (advisor of advisors(); track advisor.id) {
          @let sentence = ('reports.export.advisor' | transloco: { name: mark }).split(mark);
          <p class="text-muted-foreground text-xs" data-testid="export-advisor">
            {{ sentence[0] }}<bdi class="font-medium">{{ advisor.name ?? advisor.email }}</bdi
            >{{ sentence[1] }}
          </p>
        } @empty {
          @let invite = ('reports.export.invite' | transloco: { link: mark }).split(mark);
          <p class="text-muted-foreground text-xs" data-testid="export-invite">
            {{ invite[0]
            }}<a
              class="text-primary underline-offset-4 hover:underline"
              routerLink="/settings"
              fragment="people"
              data-testid="export-invite-link"
              >{{ 'menu.settings' | transloco }} › {{ 'people.title' | transloco }}</a
            >{{ invite[1] }}
          </p>
        }
      </div>
    </section>
  `,
})
export class ExportCard {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly demoBox = DEMO_BOX;
  protected readonly mark = MARK;
  protected readonly plural = pluralKey;
  protected readonly kinds: readonly ExportKind[] = ['month', 'quarter', 'year'];

  private readonly business = this.demo.business;
  private readonly businessId = computed(() => this.business().id);

  /** Month, Quarter or Year; it starts at Month again when another business opens. */
  protected readonly kind = linkedSignal<string, ExportKind>({
    source: this.businessId,
    computation: () => 'month',
  });

  /** The periods of that kind that can be exported, newest first. */
  protected readonly periods = computed(() =>
    exportPeriods(this.business(), this.kind(), DEMO_TODAY),
  );

  /** The key of the period the person picked; none (so the newest) after a change of kind or business. */
  private readonly picked = linkedSignal<{ business: string; kind: ExportKind }, string | null>({
    source: computed(() => ({ business: this.businessId(), kind: this.kind() })),
    computation: () => null,
  });

  /** The period shown: the one picked, else the newest. */
  protected readonly period = computed<ExportPeriod | undefined>(
    () => this.periods().find((p) => p.key === this.picked()) ?? this.periods()[0],
  );

  /** The period shown with what its export holds; none when no period can be exported. */
  protected readonly view = computed(() => {
    const period = this.period();
    return period ? { period, summary: exportSummary(this.business(), period, DEMO_TODAY) } : null;
  });

  /** One period of one business: what the choice and the file belong to. */
  private readonly scope = computed(() => `${this.businessId()}/${this.period()?.key}`);

  /** What the person chose to do about the payments that still need them; it starts over with another period. */
  protected readonly choice = linkedSignal<string, 'open' | 'fix'>({
    source: this.scope,
    computation: () => 'open',
  });

  /** Whether the person is fixing the open payments first: only while there are some, so the downloads can never stay off for good. */
  protected readonly fixing = computed(
    () => this.choice() === 'fix' && (this.view()?.summary.needsYou ?? 0) > 0,
  );

  /** The download that was asked for; it goes with the period, the business and a change of choice. */
  protected readonly asked = linkedSignal<string, ExportFile | null>({
    source: computed(() => `${this.scope()}/${this.fixing()}`),
    computation: () => null,
  });

  /** The made-up name of the file that was asked for. */
  protected readonly fileName = computed(() => {
    const period = this.period();
    const file = this.asked();
    return period && file ? exportFileName(this.businessId(), period, file) : null;
  });

  /** The people with a login who joined as tax advisor. */
  protected readonly advisors = computed(() =>
    this.business().people.filter((m) => m.role === 'advisor' && m.status === 'joined'),
  );

  protected nameOf(period: ExportPeriod): string {
    return exportPeriodName(period, this.language.lang());
  }

  protected onPick(event: Event): void {
    this.picked.set((event.target as HTMLSelectElement).value);
  }
}
