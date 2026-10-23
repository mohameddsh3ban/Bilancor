import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { Term, TermText } from '../core/i18n/term';
import { GERMAN_STATES } from '../data/banks';
import { isVisitBusiness } from '../data/new-business-sample';
import { DemoStateService } from '../state/demo-state.service';
import { clearErrors, focusAfterRender } from './form-helpers';
import { ChoiceCard, FieldError, INPUT_CLASS, NotSureHint } from './form-parts';
import { backUrlOf, openedFrom, openedInvoiceId } from './opened-from';
import {
  demoKnowsState,
  demoStateNames,
  draftOf,
  emptyDraft,
  taxOfficeOf,
  validateDraft,
  type TaxDraft,
  type TaxErrors,
  type TaxQuestion,
} from './tax-form';

/** The revenue limits a Kleinunternehmer stays under, in cents: last year, and this year. */
const LIMIT_LAST_YEAR_CENTS = 2500000;
const LIMIT_THIS_YEAR_CENTS = 10000000;

/**
 * "Your tax details" (`/settings/tax`): the questions as cards, then Save. It opens empty until the tax step is done
 * (a business made during the visit has its kind of work chosen already) and shows the saved answers after. The VAT
 * questions show only after Yes; a No clears them. Save checks every visible question (and the tax number against the
 * sample tax-office table), names each problem next to its field and keeps all
 * answers; when all is well it stores them, ticks the tax step and goes back to where the page was opened from
 * (`?from=home`, `?from=invoice` with `&invoice=<id>` for the invoice that was open, or `?from=settings`, the
 * default). What is typed belongs to the business that is open: another business, a reset, or the toolbar's setup
 * shortcuts start the form over.
 */
@Component({
  selector: 'app-tax-details-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChoiceCard,
    FieldError,
    HlmButton,
    HlmCardImports,
    NgIcon,
    NotSureHint,
    RouterLink,
    Term,
    TermText,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideCheck })],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium"
      data-testid="back-link"
      [routerLink]="backUrl()"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'taxDetails.back.' + from() | transloco }}
    </a>

    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold">{{ 'taxDetails.title' | transloco }}</h1>
      <p class="text-muted-foreground text-sm" data-testid="intro">
        {{ 'taxDetails.intro' | transloco }}
      </p>
    </header>

    <form class="flex flex-col gap-4" novalidate (submit)="save($event)">
      <section hlmCard size="sm" data-testid="q-kind" [attr.data-invalid]="errors().kind ? '' : null">
        <header hlmCardHeader>
          <h2 hlmCardTitle id="kind-title">{{ 'taxDetails.kind.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <div
            role="radiogroup"
            class="grid gap-2 sm:grid-cols-2"
            aria-labelledby="kind-title"
            [attr.aria-invalid]="errors().kind ? 'true' : null"
            [attr.aria-describedby]="errors().kind ? 'error-kind' : null"
          >
            <app-choice-card
              name="kind"
              data-testid="kind-freelance"
              [checked]="draft().businessKind === 'freelance'"
              (changed)="set({ businessKind: 'freelance' }, 'kind')"
            >
              <app-term-text key="freiberufler" />
            </app-choice-card>
            <app-choice-card
              name="kind"
              data-testid="kind-trade"
              [checked]="draft().businessKind === 'trade'"
              (changed)="set({ businessKind: 'trade' }, 'kind')"
            >
              <app-term-text key="gewerbe" />
            </app-choice-card>
          </div>
          @if (errors().kind; as key) {
            <p [appFieldError]="key" id="error-kind" data-testid="error-kind"></p>
          }
        </div>
      </section>

      <section hlmCard size="sm" data-testid="q-vat" [attr.data-invalid]="errors().vat ? '' : null">
        <header hlmCardHeader>
          <h2 hlmCardTitle id="vat-title">{{ 'taxDetails.vat.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <div
            role="radiogroup"
            class="grid gap-2 sm:grid-cols-2"
            aria-labelledby="vat-title"
            [attr.aria-invalid]="errors().vat ? 'true' : null"
            [attr.aria-describedby]="errors().vat ? 'error-vat' : null"
          >
            <app-choice-card
              name="vat"
              data-testid="vat-yes"
              [checked]="draft().chargesVat === true"
              (changed)="set({ chargesVat: true }, 'vat')"
            >
              {{ 'taxDetails.vat.yes' | transloco }}
            </app-choice-card>
            <app-choice-card
              name="vat"
              data-testid="vat-no"
              [checked]="draft().chargesVat === false"
              [hint]="
                'taxDetails.vat.limits'
                  | transloco: { last: limit(limitLastYear), current: limit(limitThisYear) }
              "
              (changed)="answerNo()"
            >
              {{ 'taxDetails.vat.no' | transloco }}
              <span class="block font-normal"><app-term-text key="kleinunternehmer" /></span>
            </app-choice-card>
          </div>
          @if (errors().vat; as key) {
            <p [appFieldError]="key" id="error-vat" data-testid="error-vat"></p>
          }
          <p appNotSure></p>
        </div>
      </section>

      @if (draft().chargesVat === true) {
        <section
          hlmCard
          size="sm"
          data-testid="q-period"
          [attr.data-invalid]="errors().period ? '' : null"
        >
          <header hlmCardHeader>
            <h2 hlmCardTitle id="period-title">
              {{ 'taxDetails.period.titleBefore' | transloco }}<app-term key="ustva" />{{
                'taxDetails.period.titleAfter' | transloco
              }}
            </h2>
          </header>
          <div hlmCardContent class="flex flex-col gap-3">
            <div
              role="radiogroup"
              class="flex flex-col gap-2"
              aria-labelledby="period-title"
              [attr.aria-invalid]="errors().period ? 'true' : null"
              [attr.aria-describedby]="errors().period ? 'error-period' : null"
            >
              @for (period of periods; track period) {
                <app-choice-card
                  name="period"
                  [attr.data-testid]="'period-' + period"
                  [checked]="draft().vatPeriod === period"
                  (changed)="set({ vatPeriod: period }, 'period')"
                >
                  {{ 'taxDetails.period.' + period | transloco }}
                </app-choice-card>
              }
            </div>
            @if (errors().period; as key) {
              <p [appFieldError]="key" id="error-period" data-testid="error-period"></p>
            }
            <app-choice-card
              type="checkbox"
              name="extension"
              data-testid="extension"
              [checked]="draft().permanentExtension"
              [hint]="'taxDetails.extension.hint' | transloco"
              (changed)="set({ permanentExtension: $event })"
            >
              <app-term-text key="dauerfristverlaengerung" />
            </app-choice-card>
            <p appNotSure></p>
          </div>
        </section>

        <section
          hlmCard
          size="sm"
          data-testid="q-basis"
          [attr.data-invalid]="errors().basis ? '' : null"
        >
          <header hlmCardHeader>
            <h2 hlmCardTitle id="basis-title">{{ 'taxDetails.basis.title' | transloco }}</h2>
          </header>
          <div hlmCardContent class="flex flex-col gap-3">
            <div
              role="radiogroup"
              class="flex flex-col gap-2"
              aria-labelledby="basis-title"
              [attr.aria-invalid]="errors().basis ? 'true' : null"
              [attr.aria-describedby]="errors().basis ? 'error-basis' : null"
            >
              <app-choice-card
                name="basis"
                data-testid="basis-ist"
                [checked]="draft().vatBasis === 'ist'"
                (changed)="set({ vatBasis: 'ist' }, 'basis')"
              >
                <app-term-text key="istVersteuerung" />
              </app-choice-card>
              <app-choice-card
                name="basis"
                data-testid="basis-soll"
                [checked]="draft().vatBasis === 'soll'"
                (changed)="set({ vatBasis: 'soll' }, 'basis')"
              >
                <app-term-text key="sollVersteuerung" />
              </app-choice-card>
            </div>
            @if (errors().basis; as key) {
              <p [appFieldError]="key" id="error-basis" data-testid="error-basis"></p>
            }
            <p appNotSure></p>
          </div>
        </section>
      }

      <section
        hlmCard
        size="sm"
        data-testid="q-number"
        [attr.data-invalid]="errors().state || errors().number ? '' : null"
      >
        <header hlmCardHeader>
          <h2 hlmCardTitle id="number-title"><app-term key="steuernummer" /></h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'taxDetails.number.state' | transloco }}</span>
            <select
              data-testid="state"
              [class]="inputClass"
              [attr.aria-invalid]="errors().state ? 'true' : null"
              [attr.aria-describedby]="stateDescribedBy()"
              (change)="setState($event)"
            >
              <option value="" [selected]="draft().taxState === ''">
                {{ 'taxDetails.number.statePlaceholder' | transloco }}
              </option>
              @for (state of states; track state.id) {
                <option [value]="state.id" [selected]="draft().taxState === state.id">
                  {{ state.name }}
                </option>
              }
            </select>
          </label>
          @if (errors().state; as key) {
            <p [appFieldError]="key" id="error-state" data-testid="error-state"></p>
          }
          <div aria-live="polite" class="empty:-mt-3">
            @if (showStateNote()) {
              <p
                class="text-muted-foreground -mt-2 text-xs"
                id="state-note"
                data-testid="state-note"
              >
                {{ 'taxDetails.number.demoNote' | transloco: { states: demoStates() } }}
              </p>
            }
          </div>

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground" id="number-label">{{
              'taxDetails.number.number' | transloco
            }}</span>
            <input
              type="text"
              dir="ltr"
              autocomplete="off"
              spellcheck="false"
              data-testid="number"
              aria-labelledby="number-title number-label"
              [class]="inputClass"
              [value]="draft().taxNumber"
              [attr.aria-invalid]="errors().number ? 'true' : null"
              [attr.aria-describedby]="errors().number ? 'error-number number-hint' : 'number-hint'"
              (input)="setNumber($event)"
            />
          </label>
          <p class="text-muted-foreground -mt-2 text-xs" id="number-hint">
            {{ 'taxDetails.number.hint' | transloco }}
          </p>
          @if (errors().number; as key) {
            <p
              [appFieldError]="key"
              [appFieldErrorParams]="{ states: demoStates() }"
              id="error-number"
              data-testid="error-number"
            ></p>
          }
          <div role="status" class="empty:-mt-3">
            @if (office(); as name) {
              <p class="text-positive flex items-center gap-2 text-sm" data-testid="office">
                <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
                <span>
                  <app-term key="finanzamt" />: <bdi dir="auto">{{ name }}</bdi>
                </span>
              </p>
            }
          </div>
        </div>
      </section>

      <section
        hlmCard
        size="sm"
        data-testid="q-vat-id"
        [attr.data-invalid]="errors().vatId ? '' : null"
      >
        <header hlmCardHeader>
          <h2 hlmCardTitle id="vat-id-title"><app-term key="ustIdNr" /></h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground" id="vat-id-label">{{
              'taxDetails.vatId.optional' | transloco
            }}</span>
            <input
              type="text"
              dir="ltr"
              autocomplete="off"
              spellcheck="false"
              data-testid="vat-id"
              aria-labelledby="vat-id-title vat-id-label"
              [class]="inputClass + ' uppercase'"
              [value]="draft().vatId"
              [attr.aria-invalid]="errors().vatId ? 'true' : null"
              [attr.aria-describedby]="errors().vatId ? 'error-vat-id vat-id-hint' : 'vat-id-hint'"
              (input)="setVatId($event)"
            />
          </label>
          <p class="text-muted-foreground -mt-2 text-xs" id="vat-id-hint">
            {{ 'taxDetails.vatId.hint' | transloco }}
          </p>
          @if (errors().vatId; as key) {
            <p [appFieldError]="key" id="error-vat-id" data-testid="error-vat-id"></p>
          }
        </div>
      </section>

      <section hlmCard size="sm" data-testid="q-year" [attr.data-invalid]="errors().year ? '' : null">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'taxDetails.year.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          @if (!draft().ownFiscalYear) {
            <p class="text-sm" data-testid="year-calendar-text">
              <span class="font-medium">{{ 'taxDetails.year.calendar' | transloco }}</span>
              <span class="text-muted-foreground">
                · {{ 'taxDetails.year.calendarRange' | transloco }}</span
              >
            </p>
            <button
              type="button"
              class="text-primary min-h-10 self-start text-sm font-medium underline underline-offset-4"
              data-testid="year-different"
              (click)="useOwnYear(true)"
            >
              {{ 'taxDetails.year.different' | transloco }}
            </button>
          } @else {
            <fieldset class="flex flex-col gap-2">
              <legend class="text-sm font-medium">{{ 'taxDetails.year.startsOn' | transloco }}</legend>
              <div class="flex gap-3">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{ 'taxDetails.year.day' | transloco }}</span>
                  <input
                    type="text"
                    inputmode="numeric"
                    maxlength="2"
                    dir="ltr"
                    autocomplete="off"
                    data-testid="year-day"
                    [class]="inputClass + ' w-20'"
                    [value]="draft().fiscalDay"
                    [attr.aria-invalid]="errors().year ? 'true' : null"
                    [attr.aria-describedby]="errors().year ? 'error-year' : null"
                    (input)="setYearPart('fiscalDay', $event)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{ 'taxDetails.year.month' | transloco }}</span>
                  <input
                    type="text"
                    inputmode="numeric"
                    maxlength="2"
                    dir="ltr"
                    autocomplete="off"
                    data-testid="year-month"
                    [class]="inputClass + ' w-20'"
                    [value]="draft().fiscalMonth"
                    [attr.aria-invalid]="errors().year ? 'true' : null"
                    [attr.aria-describedby]="errors().year ? 'error-year' : null"
                    (input)="setYearPart('fiscalMonth', $event)"
                  />
                </label>
              </div>
            </fieldset>
            @if (errors().year; as key) {
              <p [appFieldError]="key" id="error-year" data-testid="error-year"></p>
            }
            <button
              type="button"
              class="text-primary min-h-10 self-start text-sm font-medium underline underline-offset-4"
              data-testid="year-calendar"
              (click)="useOwnYear(false)"
            >
              {{ 'taxDetails.year.useCalendar' | transloco }}
            </button>
          }
        </div>
      </section>

      <button
        hlmBtn
        size="lg"
        type="submit"
        class="w-full lg:w-auto lg:self-start"
        data-testid="save"
      >
        {{ 'taxDetails.save' | transloco }}
      </button>
    </form>
  `,
})
export class TaxDetailsPage {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly periods = ['monthly', 'quarterly', 'yearly'] as const;
  protected readonly states = GERMAN_STATES;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly limitLastYear = LIMIT_LAST_YEAR_CENTS;
  protected readonly limitThisYear = LIMIT_THIS_YEAR_CENTS;

  /** Where the page was opened from: the homepage's setup step, the invoice being written, or Settings (also when nothing is said). */
  protected readonly from = openedFrom(['home', 'settings', 'invoice']);
  private readonly invoiceId = openedInvoiceId();
  protected readonly backUrl = computed(() => backUrlOf(this.from(), this.invoiceId()));

  /**
   * What is typed and chosen, and which questions were refused. Both belong to the open business and its setup: empty
   * before its tax step is done, the saved answers after. They start over when another business opens, when the demo
   * is reset or when the tax step flips.
   */
  private readonly formKey = computed(
    () => `${this.demo.business().id}|${this.demo.dataGeneration()}|${this.demo.setup().tax}`,
  );
  protected readonly draft = linkedSignal<string, TaxDraft>({
    source: this.formKey,
    computation: () => untracked(() => this.startingDraft()),
  });
  protected readonly errors = linkedSignal<string, TaxErrors>({
    source: this.formKey,
    computation: () => ({}),
  });

  /** The tax office for the number typed, once it is valid. */
  protected readonly office = computed(() => taxOfficeOf(this.draft()));

  /** The states the demo has tax offices for, in the language of the page. */
  protected readonly demoStates = computed(() => demoStateNames(this.language.lang()));
  /** A state is chosen that the demo has no tax offices for. */
  private readonly unknownToDemo = computed(() => {
    const state = this.draft().taxState;
    return state !== '' && !demoKnowsState(state);
  });
  /** The note under the state says so; once Save refuses the number for the same reason, the error says it instead. */
  protected readonly showStateNote = computed(
    () => this.unknownToDemo() && this.errors().number !== 'taxDetails.number.demoNote',
  );
  protected readonly stateDescribedBy = computed(() => {
    if (this.errors().state) return 'error-state';
    if (!this.unknownToDemo()) return null;
    return this.showStateNote() ? 'state-note' : 'error-number';
  });

  /**
   * What the form starts with: the saved answers once the tax step is done. Before that it is empty, except for a business
   * made during the visit, which already knows its kind of work from the sign-up.
   */
  private startingDraft(): TaxDraft {
    const business = this.demo.business();
    if (this.demo.setup().tax) return draftOf(business.taxProfile);
    return isVisitBusiness(business.id)
      ? { ...emptyDraft(), businessKind: business.taxProfile.businessKind }
      : emptyDraft();
  }

  /** Set from a successful Save until the page has gone, so a second tap saves nothing more. */
  private saving = false;

  /** An amount for a sentence, in whole euros; it keeps its own left-to-right order inside an Arabic sentence. */
  protected limit(cents: number): string {
    return `\u2066${formatMoney(cents, this.language.lang(), { whole: true })}\u2069`;
  }

  /** Changes some answers, and takes the errors of the questions they answer away. */
  protected set(patch: Partial<TaxDraft>, ...answered: TaxQuestion[]): void {
    this.draft.update((draft) => ({ ...draft, ...patch }));
    clearErrors(this.errors, ...answered);
  }

  /** No, a Kleinunternehmer: the VAT answers go, so that choosing Yes again starts them empty. */
  protected answerNo(): void {
    this.set(
      { chargesVat: false, vatPeriod: null, permanentExtension: false, vatBasis: null },
      'vat',
      'period',
      'basis',
    );
  }

  protected setState(event: Event): void {
    this.set({ taxState: (event.target as HTMLSelectElement).value }, 'state', 'number');
  }

  protected setNumber(event: Event): void {
    this.set({ taxNumber: (event.target as HTMLInputElement).value }, 'number');
  }

  protected setVatId(event: Event): void {
    this.set({ vatId: (event.target as HTMLInputElement).value }, 'vatId');
  }

  protected setYearPart(part: 'fiscalDay' | 'fiscalMonth', event: Event): void {
    this.set({ [part]: (event.target as HTMLInputElement).value }, 'year');
  }

  /** Mine is different (the day and month fields, the cursor in the first), or back to the calendar year. */
  protected useOwnYear(own: boolean): void {
    this.set({ ownFiscalYear: own }, 'year');
    if (own) focusAfterRender(this.injector, this.host.nativeElement, '[data-testid="year-day"]');
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.saving) return;
    const result = validateDraft(this.draft());
    if ('errors' in result) {
      this.errors.set(result.errors);
      focusAfterRender(
        this.injector,
        this.host.nativeElement,
        '[data-invalid] input, [data-invalid] select',
      );
      return;
    }
    this.saving = true;
    this.demo.saveTaxProfile(result.profile);
    // Replacing the page in the history: the browser's Back button must not return to a form that is already saved.
    void this.router
      .navigateByUrl(this.backUrl(), { replaceUrl: true })
      .finally(() => (this.saving = false));
  }
}
