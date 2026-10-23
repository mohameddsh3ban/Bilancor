import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { countryName } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { Term } from '../core/i18n/term';
import type { CustomerKind, InvoiceCustomer, Lang } from '../data/models';
import { EU_COUNTRIES, type ChecklistKey } from '../domain/invoices';
import { focusAfterRender } from '../settings/form-helpers';
import { ChoiceCard, INPUT_CLASS } from '../settings/form-parts';

let nextFieldsId = 0;

/** The countries outside the EU a business customer may be in, besides the EU's own: the ones a freelancer in Germany is likely to invoice. */
const OTHER_COUNTRIES: readonly string[] = [
  'GB',
  'CH',
  'NO',
  'IS',
  'LI',
  'US',
  'CA',
  'AU',
  'NZ',
  'AE',
  'SA',
  'QA',
  'KW',
  'BH',
  'OM',
  'EG',
  'JO',
  'LB',
  'MA',
  'TN',
  'DZ',
  'IQ',
  'SY',
  'TR',
  'UA',
  'IL',
  'IN',
  'CN',
  'SG',
  'BR',
];

const KINDS: readonly CustomerKind[] = ['business', 'private', 'public'];

/** A customer with nothing filled in: a business in Germany. */
export function blankCustomer(): InvoiceCustomer {
  return {
    name: '',
    street: '',
    postcode: '',
    city: '',
    country: 'DE',
    email: '',
    kind: 'business',
    vatId: null,
    leitwegId: null,
  };
}

const isBlank = (customer: InvoiceCustomer): boolean =>
  [customer.name, customer.street, customer.postcode, customer.city, customer.email].every(
    (text) => text.trim() === '',
  ) &&
  customer.country === 'DE' &&
  customer.kind === 'business' &&
  customer.vatId === null &&
  customer.leitwegId === null;

/** Whether two customers are the same one: the same name (whatever the case or the spaces) in the same country, as `savedCustomers` counts them. A customer with no name is nobody. */
export function sameCustomer(a: InvoiceCustomer, b: InvoiceCustomer): boolean {
  const key = (customer: InvoiceCustomer): string =>
    `${customer.name.trim().toLowerCase()}|${customer.country}`;
  return a.name.trim() !== '' && key(a) === key(b);
}

export interface CountryOption {
  code: string;
  name: string;
}

/** The countries to choose from, named in the language: Germany first, then the other EU countries and some outside it by name. A country the customer is in that the list does not have is added. */
export function countryOptions(lang: Lang, current: string): CountryOption[] {
  const others = [...EU_COUNTRIES.filter((code) => code !== 'DE'), ...OTHER_COUNTRIES];
  if (current !== '' && current !== 'DE' && !others.includes(current)) others.push(current);
  const named = others
    .map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
  return [{ code: 'DE', name: countryName('DE', lang) }, ...named];
}

/** Which of the three things the section shows: the fields (a new customer, or details being edited), a customer chosen from the list, or the list alone with nothing chosen yet. */
type View = 'fields' | 'picked' | 'choose';

/**
 * "Customer": the customers an invoice was sent to, most recent first, as cards to tap, with "New customer" last; the fields of a
 * new customer (name, address, email and what kind of customer, with a country to choose only for a business); and what
 * only some customers need, the VAT ID of a customer who owes the VAT (`needsVatId`) and the Leitweg-ID of a public office.
 *
 * With no customers saved it shows the fields at once. A customer that is chosen shows no fields, only "Edit details"; typing in
 * the fields keeps them open. A customer abroad is a business: a private person or an office has the country Germany and
 * no country to choose (switching to one resets it), and the form says why; one that is abroad already, from before, keeps
 * its country field so it can be put right. It gives the whole customer back through `customerChange`, and only when it
 * changes: tapping "New customer" on an empty form changes nothing. `resetKey` starts the section over (the fields close).
 */
@Component({
  selector: 'app-customer-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceCard, NgIcon, Term, TranslocoPipe],
  viewProviders: [provideIcons({ lucidePlus })],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (saved().length > 0) {
      <div
        role="radiogroup"
        class="grid gap-2 sm:grid-cols-2"
        data-testid="customer-picker"
        [attr.aria-label]="'invoiceForm.customer.title' | transloco"
      >
        @for (option of saved(); track $index; let i = $index) {
          <app-choice-card
            name="customer"
            [attr.data-testid]="'customer-saved-' + i"
            [checked]="pickedIndex() === i"
            (changed)="pick(option)"
          >
            <bdi dir="auto">{{ option.name }}</bdi>
            @if (where(option); as place) {
              &ngsp;<span class="text-muted-foreground block text-xs font-normal">
                <bdi dir="auto">{{ place }}</bdi>
                @if (option.kind !== 'business') {
                  · {{ 'invoiceForm.customer.kind.' + option.kind | transloco }}
                }
              </span>
            }
          </app-choice-card>
        }
        <app-choice-card
          name="customer"
          data-testid="customer-new"
          [checked]="newChecked()"
          (changed)="startNew()"
        >
          <ng-icon
            name="lucidePlus"
            size="14"
            class="me-1 inline align-text-bottom"
            aria-hidden="true"
          />
          {{ 'invoiceForm.customer.new' | transloco }}
        </app-choice-card>
      </div>
    }

    @if (view() === 'picked') {
      <button
        type="button"
        class="text-primary min-h-10 self-start text-sm font-medium underline underline-offset-4"
        data-testid="customer-edit"
        (click)="edit()"
      >
        {{ 'invoiceForm.customer.edit' | transloco }}
      </button>
    }

    @if (view() === 'fields') {
      <div class="flex flex-col gap-3" data-testid="customer-form">
        <div class="flex flex-col gap-2">
          <p class="text-muted-foreground text-sm" [id]="uid + '-kind'">
            {{ 'invoiceForm.customer.kind.title' | transloco }}
          </p>
          <div
            role="radiogroup"
            class="grid gap-2 sm:grid-cols-3"
            [attr.aria-labelledby]="uid + '-kind'"
          >
            @for (kind of kinds; track kind) {
              <app-choice-card
                name="customer-kind"
                [attr.data-testid]="'customer-kind-' + kind"
                [checked]="customer().kind === kind"
                (changed)="setKind(kind)"
              >
                {{ 'invoiceForm.customer.kind.' + kind | transloco }}
              </app-choice-card>
            }
          </div>
          @if (customer().kind !== 'business') {
            <p
              class="text-xs"
              data-testid="customer-abroad-note"
              [class]="abroadProblem() ? 'text-negative' : 'text-muted-foreground'"
            >
              {{ 'invoiceForm.customer.abroadNote' | transloco }}
            </p>
          }
        </div>

        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">{{ 'invoiceForm.customer.name' | transloco }}</span>
          <input
            type="text"
            dir="auto"
            autocomplete="off"
            data-testid="customer-name"
            [class]="inputClass"
            [value]="customer().name"
            (input)="setText('name', $event)"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">{{ 'invoiceForm.customer.street' | transloco }}</span>
          <input
            type="text"
            dir="auto"
            autocomplete="off"
            data-testid="customer-street"
            [class]="inputClass"
            [value]="customer().street"
            (input)="setText('street', $event)"
          />
        </label>
        <div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'invoiceForm.customer.postcode' | transloco
            }}</span>
            <input
              type="text"
              dir="ltr"
              inputmode="numeric"
              autocomplete="off"
              data-testid="customer-postcode"
              [class]="inputClass"
              [value]="customer().postcode"
              (input)="setText('postcode', $event)"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{ 'invoiceForm.customer.city' | transloco }}</span>
            <input
              type="text"
              dir="auto"
              autocomplete="off"
              data-testid="customer-city"
              [class]="inputClass"
              [value]="customer().city"
              (input)="setText('city', $event)"
            />
          </label>
        </div>
        @if (showCountry()) {
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'invoiceForm.customer.country' | transloco
            }}</span>
            <select
              data-testid="customer-country"
              [class]="inputClass"
              (change)="setCountry($event)"
            >
              @for (option of countries(); track option.code) {
                <option [value]="option.code" [selected]="option.code === customer().country">
                  {{ option.name }}
                </option>
              }
            </select>
          </label>
        }
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">{{ 'invoiceForm.customer.email' | transloco }}</span>
          <input
            type="email"
            dir="ltr"
            inputmode="email"
            autocomplete="off"
            spellcheck="false"
            data-testid="customer-email"
            [class]="inputClass"
            [attr.aria-describedby]="uid + '-email-hint'"
            [value]="customer().email"
            (input)="setText('email', $event)"
          />
        </label>
        <p class="text-muted-foreground -mt-2 text-xs" [id]="uid + '-email-hint'">
          {{ 'invoiceForm.customer.emailHint' | transloco }}
        </p>
      </div>
    }

    @if (view() !== 'choose' && needsVatId()) {
      <div class="flex flex-col gap-1 text-sm">
        <span
          class="text-muted-foreground"
          data-testid="customer-vat-id-label"
          [id]="uid + '-vat-label'"
        >
          <app-term key="ustIdNr" />
        </span>
        <input
          type="text"
          dir="ltr"
          autocomplete="off"
          spellcheck="false"
          data-testid="customer-vat-id"
          [class]="inputClass + ' uppercase'"
          [attr.aria-labelledby]="uid + '-vat-label'"
          [attr.aria-describedby]="uid + '-vat-hint'"
          [value]="customer().vatId ?? ''"
          (input)="setExtra('vatId', $event)"
        />
        <p class="text-muted-foreground text-xs" [id]="uid + '-vat-hint'">
          {{ 'invoiceForm.customer.vatIdHint' | transloco }}
        </p>
      </div>
    }

    @if (view() !== 'choose' && customer().kind === 'public') {
      <div class="flex flex-col gap-1 text-sm">
        <span
          class="text-muted-foreground"
          data-testid="customer-leitweg-label"
          [id]="uid + '-leitweg-label'"
        >
          <app-term key="leitwegId" />
        </span>
        <input
          type="text"
          dir="ltr"
          autocomplete="off"
          spellcheck="false"
          data-testid="customer-leitweg-id"
          [class]="inputClass"
          [attr.aria-labelledby]="uid + '-leitweg-label'"
          [attr.aria-describedby]="uid + '-leitweg-hint'"
          [value]="customer().leitwegId ?? ''"
          (input)="setExtra('leitwegId', $event)"
        />
        <p class="text-muted-foreground text-xs" [id]="uid + '-leitweg-hint'">
          {{ 'invoiceForm.customer.leitwegHint' | transloco }}
        </p>
      </div>
    }
  `,
})
export class CustomerFields {
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The customer of the invoice as it is now. */
  readonly customer = input.required<InvoiceCustomer>();
  /** The customers to choose from, most recent first (those an invoice was sent to: no draft's customer is among them). */
  readonly saved = input<readonly InvoiceCustomer[]>([]);
  /** The invoice says the customer owes the VAT, so the customer's VAT ID is asked for. */
  readonly needsVatId = input(false);
  /** Another key starts the section over: another invoice, another business, a reset. */
  readonly resetKey = input<string>('');
  /** The customer now, whenever a change makes another one. */
  readonly customerChange = output<InvoiceCustomer>();

  protected readonly kinds = KINDS;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly uid = `customer-fields-${nextFieldsId++}`;

  /** The person is writing the customer's details (a new customer, or Edit details): the fields stay open whatever is typed. */
  protected readonly editing = linkedSignal<string, boolean>({
    source: this.resetKey,
    computation: () => false,
  });

  /** Which saved customer the invoice's customer is, or -1. */
  protected readonly pickedIndex = computed(() => {
    const customer = this.customer();
    return this.saved().findIndex((option) => sameCustomer(option, customer));
  });

  protected readonly view = computed<View>(() => {
    if (this.editing() || this.saved().length === 0) return 'fields';
    if (this.pickedIndex() >= 0) return 'picked';
    return this.customer().name.trim() !== '' ? 'fields' : 'choose';
  });

  /** "New customer" is the chosen card: the fields are open for a customer that is not one of the saved ones. */
  protected readonly newChecked = computed(
    () => this.view() === 'fields' && this.pickedIndex() < 0,
  );

  /** A country to choose: for a business, and for anyone who is abroad already (from before), so it can be put right. */
  protected readonly showCountry = computed(
    () => this.customer().kind === 'business' || this.customer().country !== 'DE',
  );
  /** A private person or an office that is abroad: the invoice cannot be sent. */
  protected readonly abroadProblem = computed(
    () => this.customer().kind !== 'business' && this.customer().country !== 'DE',
  );

  protected readonly countries = computed(() =>
    countryOptions(this.language.lang(), this.customer().country),
  );

  /** Where a customer is, for its card: street, postcode and town, and the country when it is not Germany. */
  protected where(customer: InvoiceCustomer): string {
    const town = [customer.postcode.trim(), customer.city.trim()]
      .filter((part) => part !== '')
      .join(' ');
    const address = [customer.street.trim(), town].filter((part) => part !== '').join(', ');
    return customer.country === 'DE'
      ? address
      : [address, countryName(customer.country, this.language.lang())]
          .filter((part) => part !== '')
          .join(' · ');
  }

  /** A saved customer was chosen: its details are copied in, and the fields close. */
  protected pick(option: InvoiceCustomer): void {
    this.editing.set(false);
    this.customerChange.emit({ ...option });
  }

  /** "New customer": the fields open empty, with the cursor in the name. Nothing changes (and nothing is saved) when the customer is empty already. */
  protected startNew(): void {
    this.editing.set(true);
    if (!isBlank(this.customer())) this.customerChange.emit(blankCustomer());
    this.focus('customer-name');
  }

  /** "Edit details": the fields open with what the customer has. */
  protected edit(): void {
    this.editing.set(true);
    this.focus('customer-name');
  }

  protected setText(field: 'name' | 'street' | 'postcode' | 'city' | 'email', event: Event): void {
    this.change({ [field]: (event.target as HTMLInputElement).value });
  }

  /** The kind changes what goes with it: a business may be abroad, a private person or an office is in Germany; the VAT ID belongs to a business and the Leitweg-ID to an office. */
  protected setKind(kind: CustomerKind): void {
    const customer = this.customer();
    this.change({
      kind,
      country: kind === 'business' ? customer.country : 'DE',
      vatId: kind === 'business' ? customer.vatId : null,
      leitwegId: kind === 'public' ? customer.leitwegId : null,
    });
  }

  protected setCountry(event: Event): void {
    this.change({ country: (event.target as HTMLSelectElement).value });
  }

  /** The VAT ID or the Leitweg-ID, which show beside a chosen customer too: typing there does not open the fields. */
  protected setExtra(field: 'vatId' | 'leitwegId', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customerChange.emit({ ...this.customer(), [field]: value === '' ? null : value });
  }

  /** Puts the cursor where the checklist item `key` is fixed, opening the fields when it is in them; for a customer not chosen yet, on the list. */
  focusField(key: ChecklistKey): void {
    if (this.view() === 'choose') {
      focusAfterRender(
        this.injector,
        this.host.nativeElement,
        '[data-testid="customer-saved-0"] input',
      );
      return;
    }
    const customer = this.customer();
    const firstEmpty =
      (['street', 'postcode', 'city'] as const).find((part) => customer[part].trim() === '') ??
      'street';
    const targets: Partial<Record<ChecklistKey, string>> = {
      customerName: 'customer-name',
      customerAddress: `customer-${firstEmpty}`,
      customerEmail: 'customer-email',
      customerVatId: 'customer-vat-id',
      leitwegId: 'customer-leitweg-id',
      privateAbroad: 'customer-country',
    };
    // The VAT ID and the Leitweg-ID show beside a chosen customer; everything else is in the fields.
    if (key !== 'customerVatId' && key !== 'leitwegId' && this.view() !== 'fields')
      this.editing.set(true);
    this.focus(targets[key] ?? 'customer-name');
  }

  /** The person changed something in the fields: they are open from now on. */
  private change(patch: Partial<InvoiceCustomer>): void {
    this.editing.set(true);
    this.customerChange.emit({ ...this.customer(), ...patch });
  }

  private focus(testId: string): void {
    focusAfterRender(this.injector, this.host.nativeElement, `[data-testid="${testId}"]`);
  }
}
