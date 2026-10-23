import { ApplicationRef, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { InvoiceCustomer } from '../data/models';
import { EU_COUNTRIES } from '../domain/invoices';
import { CustomerFields, blankCustomer, countryOptions, sameCustomer } from './customer-fields';

const customer = (patch: Partial<InvoiceCustomer> = {}): InvoiceCustomer => ({
  ...blankCustomer(),
  name: 'Agentur Nord',
  street: 'Hafenstr. 9',
  postcode: '24103',
  city: 'Kiel',
  email: 'buero@agentur-nord.example',
  ...patch,
});

const KERN = customer({
  name: 'Studio Kern',
  street: 'Torstr. 112',
  postcode: '10119',
  city: 'Berlin',
  email: 'kontakt@studio-kern.example',
});
const NORD = customer();
const PANKOW = customer({
  name: 'Bezirksamt Pankow',
  kind: 'public',
  leitwegId: '11001-01234-56',
  city: 'Berlin',
});
const SAVED = [KERN, NORD, PANKOW];

describe('blankCustomer', () => {
  it('is a business in Germany with nothing filled in, a fresh object each time', () => {
    expect(blankCustomer()).toEqual({
      name: '',
      street: '',
      postcode: '',
      city: '',
      country: 'DE',
      email: '',
      kind: 'business',
      vatId: null,
      leitwegId: null,
    });
    expect(blankCustomer()).not.toBe(blankCustomer());
  });
});

describe('sameCustomer', () => {
  it('is the same name in the same country, whatever the case or the spaces', () => {
    expect(sameCustomer(NORD, customer({ name: ' agentur nord ', street: 'elsewhere' }))).toBe(
      true,
    );
    expect(sameCustomer(NORD, customer({ country: 'AT' }))).toBe(false);
    expect(sameCustomer(NORD, KERN)).toBe(false);
  });

  it('a customer with no name is nobody', () => {
    expect(sameCustomer(blankCustomer(), blankCustomer())).toBe(false);
  });
});

describe('countryOptions', () => {
  it('lists Germany first, then the other countries by their name in the language', () => {
    const options = countryOptions('en', 'DE');
    expect(options[0]).toEqual({ code: 'DE', name: 'Germany' });
    const names = options.slice(1).map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(options.find((o) => o.code === 'AT')!.name).toBe('Austria');
    expect(options.find((o) => o.code === 'US')!.name).toBe('United States');
    expect(options.find((o) => o.code === 'AE')!.name).toBe('United Arab Emirates');
  });

  it('has every EU country, each once', () => {
    const codes = countryOptions('en', 'DE').map((o) => o.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of EU_COUNTRIES) expect(codes).toContain(code);
  });

  it('names them in German and in Arabic', () => {
    expect(countryOptions('de', 'DE')[0]).toEqual({ code: 'DE', name: 'Deutschland' });
    expect(countryOptions('de', 'DE').find((o) => o.code === 'AT')!.name).toBe('Österreich');
    expect(countryOptions('ar', 'DE')[0].code).toBe('DE');
    expect(countryOptions('ar', 'DE')[0].name).toMatch(/[؀-ۿ]/);
  });

  it('adds a country the list does not have when the customer is in it', () => {
    expect(countryOptions('en', 'DE').some((o) => o.code === 'JP')).toBe(false);
    expect(countryOptions('en', 'JP').find((o) => o.code === 'JP')).toEqual({
      code: 'JP',
      name: 'Japan',
    });
  });
});

@Component({
  imports: [CustomerFields],
  template: `<app-customer-fields
    [customer]="customer()"
    [saved]="saved()"
    [needsVatId]="needsVatId()"
    [resetKey]="key()"
    (customerChange)="emitted.push($event); customer.set($event)"
  />`,
})
class Host {
  readonly customer = signal<InvoiceCustomer>(blankCustomer());
  readonly saved = signal<InvoiceCustomer[]>([]);
  readonly needsVatId = signal(false);
  readonly key = signal('a');
  readonly emitted: InvoiceCustomer[] = [];
  readonly child = viewChild.required(CustomerFields);
}

describe('CustomerFields', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(
    current: InvoiceCustomer = blankCustomer(),
    saved: InvoiceCustomer[] = [],
  ): Promise<void> {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.customer.set(current);
    host.saved.set(saved);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const field = (testId: string) => q(testId) as HTMLInputElement;
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const radio = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;
  const last = () => host.emitted.at(-1);
  const tick = () => TestBed.inject(ApplicationRef).tick();

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function press(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  async function choose(testId: string): Promise<void> {
    radio(testId).click();
    await settle();
  }

  const shownFields = () =>
    ['name', 'street', 'postcode', 'city', 'country', 'email', 'vat-id', 'leitweg-id'].filter(
      (f) => q(`customer-${f}`) !== null,
    );

  describe('with no customers saved yet', () => {
    it('shows the fields at once, as a business in Germany, and no list to choose from', async () => {
      await render();
      expect(q('customer-picker')).toBeNull();
      expect(shownFields()).toEqual(['name', 'street', 'postcode', 'city', 'country', 'email']);
      expect(radio('customer-kind-business').checked).toBe(true);
      expect((q('customer-country') as HTMLSelectElement).value).toBe('DE');
      expect(host.emitted).toEqual([]);
    });

    it('labels every field, and writes the postcode and the email left to right', async () => {
      await render();
      const labels = Array.from(el().querySelectorAll('label')).map((label) =>
        text(label.querySelector('span')),
      );
      expect(labels).toEqual(
        expect.arrayContaining([
          'Name',
          'Street and number',
          'Postcode',
          'Town',
          'Country',
          'Email',
        ]),
      );
      expect(field('customer-postcode').getAttribute('dir')).toBe('ltr');
      expect(field('customer-email').getAttribute('dir')).toBe('ltr');
      expect(field('customer-name').getAttribute('dir')).toBe('auto');
      expect(field('customer-email').getAttribute('type')).toBe('email');
    });

    it('every change gives the whole customer, with what was typed in it', async () => {
      await render();
      await type('customer-name', 'Agentur Süd');
      await type('customer-street', 'Hauptstr. 1');
      await type('customer-postcode', '80331');
      await type('customer-city', 'München');
      await type('customer-email', 'info@agentur-sued.example');
      expect(last()).toEqual({
        name: 'Agentur Süd',
        street: 'Hauptstr. 1',
        postcode: '80331',
        city: 'München',
        country: 'DE',
        email: 'info@agentur-sued.example',
        kind: 'business',
        vatId: null,
        leitwegId: null,
      });
      expect(host.emitted).toHaveLength(5);
    });
  });

  describe('with customers saved', () => {
    it('lists them as they come, with a New customer choice last; nothing is chosen and no fields show yet', async () => {
      await render(blankCustomer(), SAVED);
      expect(el().querySelectorAll('[data-testid^="customer-saved-"]')).toHaveLength(3);
      expect(text(q('customer-saved-0'))).toContain('Studio Kern');
      expect(text(q('customer-saved-1'))).toContain('Agentur Nord');
      expect(text(q('customer-saved-2'))).toContain('Bezirksamt Pankow');
      expect(text(q('customer-new'))).toBe('New customer');
      const order = Array.from(q('customer-picker')!.children).map((c) =>
        c.getAttribute('data-testid'),
      );
      expect(order).toEqual([
        'customer-saved-0',
        'customer-saved-1',
        'customer-saved-2',
        'customer-new',
      ]);
      for (const id of [
        'customer-saved-0',
        'customer-saved-1',
        'customer-saved-2',
        'customer-new',
      ]) {
        expect(radio(id).checked, id).toBe(false);
      }
      expect(shownFields()).toEqual([]);
      expect(q('customer-edit')).toBeNull();
    });

    it('a card says where the customer is: street, postcode and town, and the country when it is not Germany', async () => {
      await render(blankCustomer(), [
        KERN,
        customer({
          name: 'Maison Lyon',
          country: 'FR',
          city: 'Lyon',
          street: 'Rue 1',
          postcode: '69001',
        }),
      ]);
      expect(text(q('customer-saved-0'))).toBe('Studio Kern Torstr. 112, 10119 Berlin');
      expect(text(q('customer-saved-1'))).toBe('Maison Lyon Rue 1, 69001 Lyon · France');
    });

    it('a public office says so on its card', async () => {
      await render(blankCustomer(), [PANKOW]);
      expect(text(q('customer-saved-0'))).toContain('Public office');
    });

    it('choosing one gives a copy of it, checks its card, hides the fields and offers Edit details', async () => {
      await render(blankCustomer(), SAVED);
      await choose('customer-saved-1');
      expect(last()).toEqual(NORD);
      expect(last()).not.toBe(NORD);
      expect(radio('customer-saved-1').checked).toBe(true);
      expect(radio('customer-new').checked).toBe(false);
      expect(shownFields()).toEqual([]);
      expect(text(q('customer-edit'))).toBe('Edit details');
    });

    it('a customer that is in the list when the form opens is already chosen', async () => {
      await render(customer({ name: 'agentur nord' }), SAVED);
      expect(radio('customer-saved-1').checked).toBe(true);
      expect(shownFields()).toEqual([]);
    });

    it('New customer clears the customer and shows the empty fields with the cursor in the name', async () => {
      await render(NORD, SAVED);
      await choose('customer-new');
      tick();
      expect(last()).toEqual(blankCustomer());
      expect(radio('customer-new').checked).toBe(true);
      expect(shownFields()).toEqual(['name', 'street', 'postcode', 'city', 'country', 'email']);
      expect(field('customer-name').value).toBe('');
      expect(document.activeElement).toBe(q('customer-name'));
    });

    it('New customer on an empty form changes nothing, so nothing is saved', async () => {
      await render(blankCustomer(), SAVED);
      await choose('customer-new');
      expect(host.emitted).toEqual([]);
      expect(shownFields()).toEqual(['name', 'street', 'postcode', 'city', 'country', 'email']);
    });

    it('Edit details opens the fields with what the customer has, and the customer stays chosen', async () => {
      await render(NORD, SAVED);
      await press('customer-edit');
      tick();
      expect(shownFields()).toEqual(['name', 'street', 'postcode', 'city', 'country', 'email']);
      expect(field('customer-street').value).toBe('Hafenstr. 9');
      expect(radio('customer-saved-1').checked).toBe(true);
      expect(document.activeElement).toBe(q('customer-name'));
      await type('customer-email', 'neu@agentur-nord.example');
      expect(last()!.email).toBe('neu@agentur-nord.example');
      expect(shownFields()).toContain('name'); // typing does not close it
      expect(host.emitted).toHaveLength(1);
    });

    it('a customer that is not in the list shows its fields, with New customer chosen', async () => {
      await render(customer({ name: 'Agentur Süd' }), SAVED);
      expect(radio('customer-new').checked).toBe(true);
      expect(field('customer-name').value).toBe('Agentur Süd');
    });

    it('starts over for another invoice (another reset key): the fields close for a customer that is chosen', async () => {
      await render(NORD, SAVED);
      await press('customer-edit');
      host.key.set('b');
      await settle();
      expect(shownFields()).toEqual([]);
      expect(radio('customer-saved-1').checked).toBe(true);
    });
  });

  describe('the kind of customer', () => {
    it('offers business, private person and public office', async () => {
      await render();
      expect(text(q('customer-kind-business'))).toBe('Business');
      expect(text(q('customer-kind-private'))).toBe('Private person');
      expect(text(q('customer-kind-public'))).toBe('Public office');
    });

    it('a business may be abroad: the country list has Germany first, then the other countries by name', async () => {
      await render();
      const options = Array.from(q('customer-country')!.querySelectorAll('option')).map((o) => [
        o.value,
        text(o),
      ]);
      expect(options[0]).toEqual(['DE', 'Germany']);
      expect(options).toContainEqual(['FR', 'France']);
      expect(options).toContainEqual(['GB', 'United Kingdom']);
      expect(q('customer-abroad-note')).toBeNull();
      const select = q('customer-country') as HTMLSelectElement;
      select.value = 'FR';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(last()).toMatchObject({ country: 'FR', kind: 'business' });
    });

    it('a private person or a public office has no country to choose: Germany, and the form says why', async () => {
      await render();
      await choose('customer-kind-private');
      expect(q('customer-country')).toBeNull();
      expect(text(q('customer-abroad-note'))).toBe('Customers abroad are businesses only for now.');
      expect(last()).toMatchObject({ kind: 'private', country: 'DE' });
      await choose('customer-kind-public');
      expect(q('customer-country')).toBeNull();
      expect(text(q('customer-abroad-note'))).toBe('Customers abroad are businesses only for now.');
      expect(last()).toMatchObject({ kind: 'public', country: 'DE' });
    });

    it('switching to a private person or an office resets the country; switching back leaves it Germany', async () => {
      await render(customer({ country: 'AT', vatId: 'ATU12345678' }));
      await choose('customer-kind-private');
      expect(last()).toMatchObject({ kind: 'private', country: 'DE', vatId: null });
      await choose('customer-kind-business');
      expect(last()).toMatchObject({ kind: 'business', country: 'DE' });
      expect(q('customer-country')).not.toBeNull();
    });

    it('a private person or an office that is abroad already (from before) keeps its country field, so it can be put right, and the note names the problem', async () => {
      await render(customer({ kind: 'private', country: 'AT' }));
      expect(q('customer-country')).not.toBeNull();
      expect((q('customer-country') as HTMLSelectElement).value).toBe('AT');
      expect(q('customer-abroad-note')!.className).toContain('text-negative');
    });
  });

  describe('what only some customers need', () => {
    it('a VAT ID, when the invoice says the customer owes the VAT', async () => {
      await render(customer({ country: 'FR' }));
      expect(q('customer-vat-id')).toBeNull();
      host.needsVatId.set(true);
      await settle();
      expect(field('customer-vat-id').getAttribute('dir')).toBe('ltr');
      await type('customer-vat-id', 'FR12345678901');
      expect(last()!.vatId).toBe('FR12345678901');
      await type('customer-vat-id', '');
      expect(last()!.vatId).toBeNull();
    });

    it('the VAT ID shows for a customer that is chosen, without opening the fields', async () => {
      await render(customer({ name: 'Maison Lyon', country: 'FR' }), [
        customer({ name: 'Maison Lyon', country: 'FR' }),
      ]);
      host.needsVatId.set(true);
      await settle();
      expect(shownFields()).toEqual(['vat-id']);
    });

    it('a Leitweg-ID, for a public office, with its term to explain it', async () => {
      await render(customer({ kind: 'public' }));
      expect(shownFields()).toContain('leitweg-id');
      expect(text(q('customer-leitweg-label'))).toBe('Routing ID for public offices (Leitweg-ID)');
      expect(q('customer-leitweg-label')!.querySelector('button')).not.toBeNull();
      await type('customer-leitweg-id', '11001-01234-56');
      expect(last()!.leitwegId).toBe('11001-01234-56');
    });

    it('no Leitweg-ID for a business or a private person; leaving "public office" forgets it', async () => {
      await render(customer({ kind: 'public', leitwegId: '11001-01234-56' }));
      await choose('customer-kind-business');
      expect(q('customer-leitweg-id')).toBeNull();
      expect(last()!.leitwegId).toBeNull();
    });
  });

  describe('the cursor', () => {
    it('focusField opens the fields if they are closed and goes to the field that is meant', async () => {
      await render(customer({ email: '' }), SAVED.concat(customer({ email: '' })));
      expect(shownFields()).toEqual([]);
      host.child().focusField('customerEmail');
      await settle();
      tick();
      expect(shownFields()).toContain('email');
      expect(document.activeElement).toBe(q('customer-email'));
    });

    it('for the address it goes to the first part that is empty', async () => {
      await render(customer({ postcode: '', city: '' }));
      host.child().focusField('customerAddress');
      tick();
      expect(document.activeElement).toBe(q('customer-postcode'));
      await type('customer-postcode', '24103');
      host.child().focusField('customerAddress');
      tick();
      expect(document.activeElement).toBe(q('customer-city'));
    });

    it('goes to the name, the VAT ID and the Leitweg-ID, and for a customer abroad that is not a business, to the country', async () => {
      await render(customer({ name: '', kind: 'public' }));
      host.child().focusField('customerName');
      tick();
      expect(document.activeElement).toBe(q('customer-name'));
      host.child().focusField('leitwegId');
      tick();
      expect(document.activeElement).toBe(q('customer-leitweg-id'));
      host.needsVatId.set(true);
      await settle();
      host.child().focusField('customerVatId');
      tick();
      expect(document.activeElement).toBe(q('customer-vat-id'));
      host.customer.set(customer({ kind: 'private', country: 'AT' }));
      await settle();
      host.child().focusField('privateAbroad');
      tick();
      expect(document.activeElement).toBe(q('customer-country'));
    });

    it('with nothing chosen yet it goes to the list', async () => {
      await render(blankCustomer(), SAVED);
      host.child().focusField('customerName');
      tick();
      expect(document.activeElement).toBe(radio('customer-saved-0'));
    });
  });

  describe('other languages', () => {
    it('German: the country list and the labels', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render();
      expect(text((q('customer-country') as HTMLSelectElement).options[0])).toBe('Deutschland');
      expect(text(q('customer-kind-private'))).toBe('Privatperson');
    });

    it('Arabic: a right-to-left form, with the numbers and the email left to right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render(customer());
      expect(document.documentElement.dir).toBe('rtl');
      expect(text((q('customer-country') as HTMLSelectElement).options[0])).toMatch(/[؀-ۿ]/);
      expect(field('customer-postcode').getAttribute('dir')).toBe('ltr');
      expect(field('customer-email').getAttribute('dir')).toBe('ltr');
    });
  });
});
