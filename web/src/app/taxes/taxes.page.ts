import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { map } from 'rxjs';
import { LanguageService } from '../core/i18n/language.service';
import { RevenueTracker } from '../home/cards/revenue-tracker';
import { DemoStateService } from '../state/demo-state.service';
import { VatReturnTab } from './vat-return-tab';
import { YearTab } from './year-tab';

type TaxesTab = 'vat' | 'year';

const TABS: readonly TaxesTab[] = ['vat', 'year'];

/** The tab an address asks for: the year for `year`, the VAT return for anything else. */
const tabOf = (value: string | null): TaxesTab => (value === 'year' ? 'year' : 'vat');

/**
 * Taxes (`/taxes`): for a business that charges VAT, two tabs, the VAT return (the first) and the year (`?tab=year`);
 * for a Kleinunternehmer no tabs, the revenue-limit tracker and "No VAT return needed" above the year. Until the
 * business has set its tax details there are no figures, only a way to add them.
 */
@Component({
  selector: 'app-taxes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmButton,
    HlmCardImports,
    RevenueTracker,
    RouterLink,
    TranslocoPipe,
    VatReturnTab,
    YearTab,
  ],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <h1 class="text-2xl font-semibold">{{ 'taxes.title' | transloco }}</h1>

    @if (missing()) {
      <section hlmCard size="sm" data-testid="taxes-missing">
        <div hlmCardContent class="flex flex-col items-start gap-3">
          <p class="font-medium">{{ 'taxes.missing' | transloco }}</p>
          <a hlmBtn routerLink="/settings/tax" data-testid="taxes-missing-link">
            {{ 'settings.tax.add' | transloco }}
          </a>
        </div>
      </section>
    } @else if (chargesVat()) {
      <div
        role="tablist"
        class="border-border bg-card flex overflow-hidden rounded-md border text-sm"
        [attr.aria-label]="'taxes.tabs.label' | transloco"
        (keydown)="onKeydown($event)"
      >
        @for (name of tabs; track name) {
          <button
            type="button"
            role="tab"
            class="border-border min-w-0 flex-1 border-s px-3 py-2.5 font-medium first:border-s-0"
            [class]="
              tab() === name
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted'
            "
            [id]="'taxes-tab-' + name"
            [tabindex]="tab() === name ? 0 : -1"
            [attr.aria-selected]="tab() === name"
            aria-controls="taxes-panel"
            [attr.data-testid]="'tab-' + name"
            (click)="show(name)"
          >
            {{ 'taxes.tabs.' + name | transloco }}
          </button>
        }
      </div>
      <div role="tabpanel" id="taxes-panel" [attr.aria-labelledby]="'taxes-tab-' + tab()">
        @if (tab() === 'year') {
          <app-year-tab />
        } @else {
          <app-vat-return-tab />
        }
      </div>
    } @else {
      <section hlmCard size="sm">
        <div hlmCardContent class="flex flex-col gap-3">
          <app-revenue-tracker />
          <p class="border-border border-t pt-3 text-sm font-medium" data-testid="taxes-no-vat">
            {{ 'taxes.noVat' | transloco }}
          </p>
        </div>
      </section>
      <app-year-tab />
    }
  `,
})
export class TaxesPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  protected readonly tabs = TABS;

  /** The tab the address asks for (`?tab=year`); the VAT return otherwise. */
  protected readonly tab = toSignal(
    this.route.queryParamMap.pipe(map((params) => tabOf(params.get('tab')))),
    { initialValue: tabOf(this.route.snapshot.queryParamMap.get('tab')) },
  );

  private readonly profile = computed(() => this.demo.business().taxProfile);
  protected readonly chargesVat = computed(() => !this.profile().kleinunternehmer);
  /** The figures need the tax details: a business that has not set them, or charges VAT with no return period, has none to show. */
  protected readonly missing = computed(
    () => !this.demo.setup().tax || (this.chargesVat() && this.profile().vatPeriod === null),
  );

  /** Arrow keys (mirrored in Arabic), Home and End move to another tab, as tabs do. */
  protected onKeydown(event: KeyboardEvent): void {
    const rtl = this.language.dir() === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: TaxesTab | null = null;
    if (event.key === forward || event.key === 'End') next = 'year';
    else if (event.key === backward || event.key === 'Home') next = 'vat';
    if (next === null) return;
    event.preventDefault();
    this.show(next);
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`#taxes-tab-${next}`)?.focus();
  }

  /** Shows a tab: the address follows (`?tab=year`, none for the VAT return), replacing the entry so Back leaves the page. */
  protected show(tab: TaxesTab): void {
    void this.router.navigate([], {
      queryParams: { tab: tab === 'vat' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
