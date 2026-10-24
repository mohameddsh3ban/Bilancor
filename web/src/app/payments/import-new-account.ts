import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, Business } from '../data/models';
import { noConnection } from '../domain/bank-connection';
import { clearErrors, focusAfterRender } from '../settings/form-helpers';
import { FieldError, INPUT_CLASS } from '../settings/form-parts';
import { isIban, normalizeIban } from '../settings/invoice-form';
import type { From } from '../settings/opened-from';
import { DemoStateService } from '../state/demo-state.service';

/** The fields of the form that can be refused. */
type NewAccountField = 'name' | 'iban';
type NewAccountErrors = Partial<Record<NewAccountField, string>>;

/** The id of the next statement account of a business: `<business>-statement-<n>`, the first number it has not got yet. */
function nextStatementAccountId(business: Business): string {
  const taken = new Set(business.accounts.map((account) => account.id));
  let n = 1;
  while (taken.has(`${business.id}-statement-${n}`)) n += 1;
  return `${business.id}-statement-${n}`;
}

/**
 * "A new account": the name of the bank and the IBAN of an account the app cannot connect (the person tapped "My bank isn't listed", or
 * A new account… in the choice). Continue makes a statement account (no bank connection, payments from statements) and opens its import.
 * The name must not be empty and the IBAN must be shaped like one (as Invoice details checks its IBAN); each problem is named next to its
 * field, what was typed is kept, and the message goes as soon as the field is changed. What is typed belongs to the open business and its
 * data: another business, or a reset, starts the form over.
 */
@Component({
  selector: 'app-import-new-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldError, HlmButton, HlmCardImports, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form
      class="flex flex-col gap-4"
      novalidate
      data-testid="new-account-form"
      (submit)="submit($event)"
    >
      <section hlmCard size="sm">
        <header hlmCardHeader>
          <h2 hlmCardTitle data-testid="new-title">
            {{ 'statementImport.new.title' | transloco }}
          </h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <p class="text-muted-foreground text-sm">{{ 'statementImport.new.intro' | transloco }}</p>

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'statementImport.new.name' | transloco }}</span>
            <input
              type="text"
              autocomplete="off"
              dir="auto"
              data-testid="new-name"
              [class]="inputClass"
              [placeholder]="'statementImport.new.namePlaceholder' | transloco"
              [value]="name()"
              [attr.aria-invalid]="errors().name ? 'true' : null"
              [attr.aria-describedby]="errors().name ? 'new-error-name' : null"
              (input)="setName($event)"
            />
          </label>
          @if (errors().name; as key) {
            <p [appFieldError]="key" id="new-error-name" data-testid="new-error-name"></p>
          }

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'statementImport.new.iban' | transloco }}</span>
            <input
              type="text"
              dir="ltr"
              autocomplete="off"
              spellcheck="false"
              data-testid="new-iban"
              [class]="inputClass"
              [value]="iban()"
              [attr.aria-invalid]="errors().iban ? 'true' : null"
              [attr.aria-describedby]="
                errors().iban ? 'new-error-iban new-iban-hint' : 'new-iban-hint'
              "
              (input)="setIban($event)"
            />
          </label>
          <p class="text-muted-foreground -mt-2 text-xs" id="new-iban-hint">
            {{ 'statementImport.new.ibanHint' | transloco }}
          </p>
          @if (errors().iban; as key) {
            <p [appFieldError]="key" id="new-error-iban" data-testid="new-error-iban"></p>
          }
        </div>
      </section>

      <button
        hlmBtn
        size="lg"
        type="submit"
        class="w-full lg:w-auto lg:self-start"
        data-testid="new-continue"
      >
        {{ 'statementImport.new.continue' | transloco }}
      </button>
    </form>
  `,
})
export class ImportNewAccount {
  private readonly demo = inject(DemoStateService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The page the person came from, so the import leads back to it. */
  readonly from = input.required<From>();

  protected readonly inputClass = INPUT_CLASS;

  /** What is typed and which fields were refused: both start over with the open business and its data. */
  private readonly formKey = computed(
    () => `${this.demo.business().id}|${this.demo.dataGeneration()}`,
  );
  protected readonly name = linkedSignal<string, string>({
    source: this.formKey,
    computation: () => '',
  });
  protected readonly iban = linkedSignal<string, string>({
    source: this.formKey,
    computation: () => '',
  });
  protected readonly errors = linkedSignal<string, NewAccountErrors>({
    source: this.formKey,
    computation: () => ({}),
  });

  /** Set from a good Continue until the import has opened, so a second tap makes no second account. */
  private creating = false;

  protected setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    clearErrors(this.errors, 'name');
  }

  protected setIban(event: Event): void {
    this.iban.set((event.target as HTMLInputElement).value);
    clearErrors(this.errors, 'iban');
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.creating) return;
    const name = this.name().trim();
    const iban = normalizeIban(this.iban());
    const errors: NewAccountErrors = {};
    if (name === '') errors.name = 'statementImport.new.nameError';
    if (!isIban(iban)) errors.iban = 'statementImport.new.ibanError';
    if (errors.name || errors.iban) {
      this.errors.set(errors);
      focusAfterRender(this.injector, this.host.nativeElement, '[aria-invalid="true"]');
      return;
    }

    this.creating = true;
    const account: Account = {
      id: nextStatementAccountId(this.demo.business()),
      kind: 'bank',
      name,
      balanceCents: 0,
      lastUpdate: DEMO_TODAY,
      connection: noConnection('statement'),
      product: 'business',
      iban,
    };
    this.demo.addAccount(account);
    // The form is not a page to come back to: Back leaves for where the import was opened from.
    void this.router
      .navigate(['/payments/import'], {
        queryParams: { account: account.id, from: this.from() },
        replaceUrl: true,
      })
      .finally(() => (this.creating = false));
  }
}
