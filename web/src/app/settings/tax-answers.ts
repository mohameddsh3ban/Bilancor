import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { Term } from '../core/i18n/term';
import { DEMO_TODAY } from '../data/demo-date';
import { findTaxOffice } from '../domain/tax-details';
import { DemoStateService } from '../state/demo-state.service';
import { CALENDAR_YEAR } from './tax-form';

/** Where Edit and Add your tax details lead: the tax page, which comes back here when it is saved. */
const TAX_PAGE = '/settings/tax';

/**
 * Settings › Business and tax: the saved tax answers in plain words, each German term next to its translation and
 * explained, with the tax office the number belongs to, and Edit. Until the tax step is done there are no answers to
 * show: a short line and "Add your tax details" take their place. Both open the same page as the setup step.
 */
@Component({
  selector: 'app-tax-answers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, HlmCardImports, RouterLink, Term, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="settings-tax">
      <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
        <h2 hlmCardTitle>{{ 'settings.tax.title' | transloco }}</h2>
        @if (done()) {
          <a
            hlmBtn
            variant="outline"
            size="sm"
            data-testid="tax-edit"
            [routerLink]="taxPage"
            [queryParams]="{ from: 'settings' }"
            [attr.aria-label]="'settings.tax.editLabel' | transloco"
          >
            {{ 'settings.tax.edit' | transloco }}
          </a>
        }
      </header>
      <div hlmCardContent class="flex flex-col gap-3">
        @if (done()) {
          <dl class="flex flex-col gap-3 text-sm">
            <div [class]="rowClass" data-testid="tax-kind">
              <dt [class]="labelClass">{{ 'settings.tax.kind' | transloco }}</dt>
              <dd [class]="valueClass">
                <app-term [key]="profile().businessKind === 'trade' ? 'gewerbe' : 'freiberufler'" />
              </dd>
            </div>

            <div [class]="rowClass" data-testid="tax-vat">
              <dt [class]="labelClass">{{ 'settings.tax.vat' | transloco }}</dt>
              <dd [class]="valueClass">
                @if (profile().kleinunternehmer) {
                  {{ 'settings.tax.vatNo' | transloco }} · <app-term key="kleinunternehmer" />
                } @else {
                  {{ 'settings.tax.vatYes' | transloco }}
                }
              </dd>
            </div>

            @if (!profile().kleinunternehmer) {
              @if (profile().vatPeriod; as period) {
                <div [class]="rowClass" data-testid="tax-returns">
                  <dt [class]="labelClass"><app-term key="ustva" /></dt>
                  <dd [class]="valueClass">
                    {{ 'taxDetails.period.' + period | transloco }}
                    @if (profile().permanentExtension) {
                      · <app-term key="dauerfristverlaengerung" />
                    }
                  </dd>
                </div>
              }
              @if (profile().vatBasis; as basis) {
                <div [class]="rowClass" data-testid="tax-basis">
                  <dt [class]="labelClass">{{ 'settings.tax.basis' | transloco }}</dt>
                  <dd [class]="valueClass">
                    <app-term [key]="basis === 'soll' ? 'sollVersteuerung' : 'istVersteuerung'" />
                  </dd>
                </div>
              }
            }

            <div [class]="rowClass" data-testid="tax-number">
              <dt [class]="labelClass"><app-term key="steuernummer" /></dt>
              <dd [class]="valueClass">
                @if (profile().taxNumber; as taxNumber) {
                  <bdi dir="ltr">{{ taxNumber }}</bdi>
                } @else {
                  {{ 'settings.tax.notGiven' | transloco }}
                }
              </dd>
            </div>

            @if (office(); as name) {
              <div [class]="rowClass" data-testid="tax-office">
                <dt [class]="labelClass"><app-term key="finanzamt" /></dt>
                <dd [class]="valueClass">
                  <bdi dir="auto">{{ name }}</bdi>
                </dd>
              </div>
            }

            <div [class]="rowClass" data-testid="tax-vat-id">
              <dt [class]="labelClass"><app-term key="ustIdNr" /></dt>
              <dd [class]="valueClass">
                @if (profile().vatId; as vatId) {
                  <bdi dir="ltr">{{ vatId }}</bdi>
                } @else {
                  {{ 'settings.tax.notGiven' | transloco }}
                }
              </dd>
            </div>

            <div [class]="rowClass" data-testid="tax-year">
              <dt [class]="labelClass">{{ 'taxDetails.year.title' | transloco }}</dt>
              <dd [class]="valueClass">
                @if (ownYearStart(); as start) {
                  {{ 'settings.tax.yearFrom' | transloco: { date: (start | appDate) } }}
                } @else {
                  {{ 'taxDetails.year.calendar' | transloco }}
                }
              </dd>
            </div>
          </dl>
        } @else {
          <p class="text-muted-foreground text-sm" data-testid="tax-empty">
            {{ 'settings.tax.empty' | transloco }}
          </p>
          <a
            hlmBtn
            class="self-start"
            data-testid="tax-add"
            [routerLink]="taxPage"
            [queryParams]="{ from: 'settings' }"
          >
            {{ 'settings.tax.add' | transloco }}
          </a>
        }
      </div>
    </section>
  `,
})
export class TaxAnswers {
  private readonly demo = inject(DemoStateService);

  protected readonly taxPage = TAX_PAGE;
  /** A label above its answer on a phone, beside it from `sm`. */
  protected readonly rowClass =
    'flex flex-col gap-0.5 sm:grid sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4';
  protected readonly labelClass = 'text-muted-foreground';
  protected readonly valueClass = 'min-w-0 [overflow-wrap:anywhere]';

  /** The answers exist only once the tax step is done; the sample profiles are not "saved" before that. */
  protected readonly done = computed(() => this.demo.setup().tax);
  protected readonly profile = computed(() => this.demo.business().taxProfile);
  /** The tax office of the saved number, from the sample table. */
  protected readonly office = computed(() => {
    const { taxState, taxNumber } = this.profile();
    return taxState !== null && taxNumber !== null ? findTaxOffice(taxState, taxNumber) : null;
  });
  /** The day the financial year starts, as a date of the demo year; null for the calendar year. */
  protected readonly ownYearStart = computed(() => {
    const start = this.profile().fiscalYearStart;
    return start === CALENDAR_YEAR ? null : `${DEMO_TODAY.slice(0, 4)}-${start}`;
  });
}
