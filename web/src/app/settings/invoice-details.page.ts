import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatIban } from '../core/format/format';
import type { Account, InvoiceProfile } from '../data/models';
import { accountName, maskIban } from '../domain/bank-connection';
import { DemoStateService } from '../state/demo-state.service';
import { ChoiceCard, FieldError, INPUT_CLASS } from './form-parts';
import {
  PAYMENT_TERMS,
  draftOf,
  nextNumberFor,
  normalizeIban,
  patternError,
  termKey,
  validateDraft,
  type InvoiceDraft,
  type InvoiceErrors,
  type InvoiceQuestion,
} from './invoice-form';
import { backUrlOf, openedFrom, openedInvoiceId } from './opened-from';

/** A text field of the name and address card: the draft field it edits, its label, and how its text is written. */
interface AddressField {
  field: 'name' | 'street' | 'postcode' | 'city';
  dir: 'auto' | 'ltr';
  inputmode: 'text' | 'numeric';
}

/** A bank account that has an IBAN, for the list of accounts to take it from. */
type AccountWithIban = Account & { iban: string };

/**
 * "Invoice details" (`/settings/invoice`): what the business prints on its invoices, as cards, then Save. It shows the
 * saved details: the name and address, the bank account (taken from the connected accounts, or typed), the sender email
 * (shown only), the number pattern with the number the next invoice gets, the payment term and the invoice language.
 * Save checks the IBAN (when there is one, it must be shaped like one) and the pattern (it must have the running number
 * `{NNN}`), names each problem next to its field and keeps all that was typed; when all is well it stores the details
 * and goes back to where the page was opened from (`?from=settings`, the default, or `?from=invoice`, with
 * `&invoice=<id>` for the invoice that was open). What is typed belongs to the business that is open: another business
 * or a reset starts the form over.
 */
@Component({
  selector: 'app-invoice-details-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceCard, FieldError, HlmButton, HlmCardImports, NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium"
      data-testid="back-link"
      [routerLink]="backUrl()"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'invoiceDetails.back.' + from() | transloco }}
    </a>

    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold">{{ 'invoiceDetails.title' | transloco }}</h1>
      <p class="text-muted-foreground text-sm" data-testid="intro">
        {{ 'invoiceDetails.intro' | transloco }}
      </p>
    </header>

    <form class="flex flex-col gap-4" novalidate (submit)="save($event)">
      <section hlmCard size="sm" data-testid="q-address">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'invoiceDetails.address.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          @for (part of addressFields; track part.field) {
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{
                'invoiceDetails.address.' + part.field | transloco
              }}</span>
              <input
                type="text"
                autocomplete="off"
                [attr.data-testid]="part.field"
                [attr.dir]="part.dir"
                [attr.inputmode]="part.inputmode"
                [class]="inputClass"
                [value]="draft()[part.field]"
                (input)="setText(part.field, $event)"
              />
            </label>
          }
        </div>
      </section>

      <section hlmCard size="sm" data-testid="q-iban" [attr.data-invalid]="errors().iban ? '' : null">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'invoiceDetails.iban.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          @if (accounts().length > 0) {
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{ 'invoiceDetails.iban.account' | transloco }}</span>
              <select data-testid="iban-account" [class]="inputClass" (change)="pickAccount($event)">
                @for (account of accounts(); track account.id) {
                  <option [value]="account.id" [selected]="pickedAccount() === account.id">
                    {{ accountLabel(account, ('settings.bank.product.' + account.product | transloco)) }}
                  </option>
                }
                <option value="" [selected]="pickedAccount() === ''">
                  {{ 'invoiceDetails.iban.other' | transloco }}
                </option>
              </select>
            </label>
          }
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'invoiceDetails.iban.label' | transloco }}</span>
            <input
              type="text"
              dir="ltr"
              autocomplete="off"
              spellcheck="false"
              data-testid="iban"
              [class]="inputClass"
              [value]="draft().iban"
              [attr.aria-invalid]="errors().iban ? 'true' : null"
              [attr.aria-describedby]="errors().iban ? 'error-iban iban-hint' : 'iban-hint'"
              (input)="setIban($event)"
            />
          </label>
          <p class="text-muted-foreground -mt-2 text-xs" id="iban-hint">
            {{ 'invoiceDetails.iban.hint' | transloco }}
          </p>
          @if (errors().iban; as key) {
            <p [appFieldError]="key" id="error-iban" data-testid="error-iban"></p>
          }
        </div>
      </section>

      <section hlmCard size="sm" data-testid="q-email">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'invoiceDetails.email.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-1 text-sm">
          <bdi dir="ltr" class="font-medium [overflow-wrap:anywhere]" data-testid="sender-email">{{
            email()
          }}</bdi>
          <p class="text-muted-foreground text-xs">{{ 'invoiceDetails.email.hint' | transloco }}</p>
        </div>
      </section>

      <section
        hlmCard
        size="sm"
        data-testid="q-numbering"
        [attr.data-invalid]="errors().pattern ? '' : null"
      >
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'invoiceDetails.pattern.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'invoiceDetails.pattern.label' | transloco }}</span>
            <input
              type="text"
              dir="ltr"
              autocomplete="off"
              spellcheck="false"
              maxlength="30"
              data-testid="pattern"
              [class]="inputClass"
              [value]="draft().numberPattern"
              [attr.aria-invalid]="errors().pattern ? 'true' : null"
              [attr.aria-describedby]="errors().pattern ? 'error-pattern pattern-hint' : 'pattern-hint'"
              (input)="setPattern($event)"
            />
          </label>
          <p class="text-muted-foreground -mt-2 text-xs" id="pattern-hint">
            {{ 'invoiceDetails.pattern.hint' | transloco }}
          </p>
          @if (errors().pattern; as key) {
            <p [appFieldError]="key" id="error-pattern" data-testid="error-pattern"></p>
          }
          <p role="status" class="text-sm empty:-mt-3" data-testid="next-number">
            @if (nextNumber(); as number) {
              {{ 'invoiceDetails.pattern.next' | transloco }}
              <bdi dir="ltr" class="font-medium">{{ number }}</bdi>
            }
          </p>
        </div>
      </section>

      <section hlmCard size="sm" data-testid="q-term">
        <header hlmCardHeader>
          <h2 hlmCardTitle id="term-title">{{ 'invoiceDetails.term.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <div role="radiogroup" class="grid gap-2 sm:grid-cols-3" aria-labelledby="term-title">
            @for (days of terms; track days) {
              <app-choice-card
                name="term"
                [attr.data-testid]="'term-' + days"
                [checked]="draft().paymentTermDays === days"
                (changed)="set({ paymentTermDays: days })"
              >
                {{ termKey(days) | transloco }}
              </app-choice-card>
            }
          </div>
          <p class="text-muted-foreground text-xs">{{ 'invoiceDetails.term.hint' | transloco }}</p>
        </div>
      </section>

      <section hlmCard size="sm" data-testid="q-language">
        <header hlmCardHeader>
          <h2 hlmCardTitle id="language-title">{{ 'invoiceDetails.language.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <div role="radiogroup" class="grid gap-2 sm:grid-cols-2" aria-labelledby="language-title">
            @for (language of languages; track language) {
              <app-choice-card
                name="language"
                [attr.data-testid]="'lang-' + language"
                [checked]="draft().language === language"
                (changed)="set({ language })"
              >
                {{ 'invoiceDetails.language.' + language | transloco }}
              </app-choice-card>
            }
          </div>
          <p class="text-muted-foreground text-xs">{{ 'invoiceDetails.language.hint' | transloco }}</p>
        </div>
      </section>

      <button
        hlmBtn
        size="lg"
        type="submit"
        class="w-full lg:w-auto lg:self-start"
        data-testid="save"
      >
        {{ 'invoiceDetails.save' | transloco }}
      </button>
    </form>
  `,
})
export class InvoiceDetailsPage {
  private readonly demo = inject(DemoStateService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly terms = PAYMENT_TERMS;
  protected readonly languages: readonly InvoiceProfile['language'][] = ['de', 'en'];
  protected readonly termKey = termKey;
  protected readonly addressFields: readonly AddressField[] = [
    { field: 'name', dir: 'auto', inputmode: 'text' },
    { field: 'street', dir: 'auto', inputmode: 'text' },
    { field: 'postcode', dir: 'ltr', inputmode: 'numeric' },
    { field: 'city', dir: 'auto', inputmode: 'text' },
  ];

  /** Where the page was opened from: Settings (also when nothing is said), or the invoice being written. */
  protected readonly from = openedFrom(['settings', 'invoice']);
  private readonly invoiceId = openedInvoiceId();
  protected readonly backUrl = computed(() => backUrlOf(this.from(), this.invoiceId()));

  /**
   * What is typed and chosen, and which fields were refused. Both belong to the open business and its data: the saved
   * details to begin with, and they start over when another business opens or the demo is reset.
   */
  private readonly formKey = computed(() => `${this.demo.business().id}|${this.demo.dataGeneration()}`);
  protected readonly draft = linkedSignal<string, InvoiceDraft>({
    source: this.formKey,
    computation: () => untracked(() => draftOf(this.demo.business().invoiceProfile)),
  });
  protected readonly errors = linkedSignal<string, InvoiceErrors>({
    source: this.formKey,
    computation: () => ({}),
  });

  /** The email the invoices are sent from: shown, not edited. */
  protected readonly email = computed(() => this.demo.business().invoiceProfile.email);

  /** The accounts to take the IBAN from: the connected bank accounts, once the bank step is done. */
  protected readonly accounts = computed<AccountWithIban[]>(() =>
    this.demo.bankConnected()
      ? this.demo.business().accounts.filter((account): account is AccountWithIban => account.iban !== null)
      : [],
  );
  /** The account whose IBAN is in the field, or '' when it is another one (typed). */
  protected readonly pickedAccount = computed(() => {
    const typed = normalizeIban(this.draft().iban);
    return this.accounts().find((account) => account.iban === typed)?.id ?? '';
  });

  /** The number the next invoice gets with the pattern as typed; null while the pattern cannot be used. */
  protected readonly nextNumber = computed(() => {
    const pattern = this.draft().numberPattern.trim();
    return patternError(pattern) === null ? nextNumberFor(this.demo.business(), pattern) : null;
  });

  /** Set from a successful Save until the page has gone, so a second tap saves nothing more. */
  private saving = false;

  /** "Qonto · DE08 … 3650": the account as the person knows it, and which IBAN it has. */
  protected accountLabel(account: AccountWithIban, product: string): string {
    return `${accountName(account, product)} · ${maskIban(account.iban)}`;
  }

  /** Changes some details, and takes the errors of the fields they answer away. */
  protected set(patch: Partial<InvoiceDraft>, ...answered: InvoiceQuestion[]): void {
    this.draft.update((draft) => ({ ...draft, ...patch }));
    this.clearErrors(...answered);
  }

  protected setText(field: AddressField['field'], event: Event): void {
    this.set({ [field]: (event.target as HTMLInputElement).value });
  }

  protected setIban(event: Event): void {
    this.set({ iban: (event.target as HTMLInputElement).value }, 'iban');
  }

  protected setPattern(event: Event): void {
    this.set({ numberPattern: (event.target as HTMLInputElement).value }, 'pattern');
  }

  /** An account of the list puts its IBAN in the field; "another account" empties the field and puts the cursor in it. */
  protected pickAccount(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const account = this.accounts().find((candidate) => candidate.id === id);
    this.set({ iban: account ? formatIban(account.iban) : '' }, 'iban');
    if (!account) this.focusAfterRender('[data-testid="iban"]');
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.saving) return;
    const result = validateDraft(this.draft(), this.demo.business().invoiceProfile);
    if ('errors' in result) {
      this.errors.set(result.errors);
      this.focusAfterRender('[data-invalid] input');
      return;
    }
    this.saving = true;
    this.demo.saveInvoiceProfile(result.profile);
    // Replacing the page in the history: the browser's Back button must not return to a form that is already saved.
    void this.router
      .navigateByUrl(this.backUrl(), { replaceUrl: true })
      .finally(() => (this.saving = false));
  }

  private clearErrors(...questions: InvoiceQuestion[]): void {
    if (!questions.some((question) => this.errors()[question] !== undefined)) return;
    this.errors.update((errors) => {
      const next = { ...errors };
      for (const question of questions) delete next[question];
      return next;
    });
  }

  /** Puts the cursor in the first element that matches, once the page has been drawn again. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
