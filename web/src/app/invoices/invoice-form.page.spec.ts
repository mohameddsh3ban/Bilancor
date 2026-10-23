import { Location } from '@angular/common';
import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DEMO_TODAY } from '../data/demo-date';
import type { Invoice } from '../data/models';
import { canSendInvoice } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { InvoiceFormPage } from './invoice-form.page';

/** Stands in for the pages the form leads to. */
@Component({ template: '' })
class Stub {}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = (testId: string) =>
  dialog()?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;

describe('InvoiceFormPage', () => {
  let demo: DemoStateService;
  let invoices: InvoiceService;
  let router: Router;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    harness = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: 'invoices', component: Stub },
          { path: 'invoices/new', component: InvoiceFormPage },
          { path: 'invoices/:id/edit', component: InvoiceFormPage },
          { path: 'invoices/:id', component: Stub },
          { path: 'settings/invoice', component: Stub },
          { path: 'settings/tax', component: Stub },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    invoices = TestBed.inject(InvoiceService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
  }

  const tick = () => TestBed.inject(ApplicationRef).tick();
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (selector: string) => Array.from(el.querySelectorAll<HTMLElement>(selector));
  const field = (testId: string) => q(testId) as HTMLInputElement;
  const radio = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;
  /** The words of a node on one line; the marks that keep an amount left-to-right are not words. */
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';
  const business = () => demo.business();
  const draftOf = (id?: string): Invoice =>
    id ? business().invoices.find((i) => i.id === id)! : business().invoices.at(-1)!;

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  /** A field that is committed when it is left (a date), not on every keystroke. */
  async function commit(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  async function select(testId: string, value: string): Promise<void> {
    const control = q(testId) as HTMLSelectElement;
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  async function choose(testId: string): Promise<void> {
    radio(testId).click();
    await settle();
  }

  async function press(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  async function pickCustomer(name: string): Promise<void> {
    const card = qa('[data-testid^="customer-saved-"]').find((c) => text(c).startsWith(name));
    expect(card, `a saved customer ${name}`).toBeDefined();
    card!.querySelector<HTMLInputElement>('input')!.click();
    await settle();
  }

  /** The checklist as it reads: the key of each item, and whether it is ok. */
  const checklist = () =>
    Object.fromEntries(
      qa('li[data-testid^="check-"]').map((li) => [
        li.dataset['testid']!.slice(6),
        li.dataset['ok'] === 'true',
      ]),
    );
  const missing = () =>
    Object.entries(checklist())
      .filter(([, ok]) => !ok)
      .map(([key]) => key);
  const canPress = () => !(q('preview-send') as HTMLButtonElement).disabled;

  /** A new invoice with a customer of Weber Design and one line, which is all it needs. */
  async function fillNew(customer = 'Agentur Nord'): Promise<void> {
    await pickCustomer(customer);
    await type('line-description-0', 'Design');
    await press('suggestion-0-0');
  }

  describe('a new invoice', () => {
    it('a new invoice to Agentur Nord with 2 lines totals €2,380.00 and can be sent', async () => {
      await render('/invoices/new');
      expect(text(q('form-title'))).toBe('New invoice');
      expect(canPress()).toBe(false);

      await pickCustomer('Agentur Nord');
      await type('line-description-0', 'Design');
      await press('suggestion-0-0'); // Design-Beratung, hours, 80.00
      await type('line-quantity-0', '10');
      await press('add-line');
      await type('line-description-1', 'Logo-Ü');
      await press('suggestion-1-0'); // Logo-Überarbeitung, flat, 340.00
      await type('line-price-1', '1200');

      expect(text(q('total-net'))).toBe('€2,000.00');
      expect(text(q('total-vat'))).toBe('€380.00');
      expect(text(q('total-gross'))).toBe('€2,380.00');
      expect(missing()).toEqual([]);
      expect(canPress()).toBe(true);

      const draft = draftOf();
      expect(draft.customer).toMatchObject({
        name: 'Agentur Nord',
        city: 'Kiel',
        country: 'DE',
        kind: 'business',
      });
      expect(draft.lines).toEqual([
        { description: 'Design-Beratung', quantity: 10, unit: 'hour', unitPriceCents: 8000 },
        { description: 'Logo-Überarbeitung', quantity: 1, unit: 'flat', unitPriceCents: 120000 },
      ]);
      expect(canSendInvoice(draft, business(), demo.setup())).toBe(true);

      await press('preview-send');
      expect(router.url).toBe(`/invoices/${draft.id}?send=1`);
    });

    it('starts with one empty line, today as the invoice date, this month, 14 days and the invoice language of Settings', async () => {
      await render('/invoices/new');
      expect(qa('[data-testid^="line-row-"]')).toHaveLength(1);
      expect(field('line-description-0').value).toBe('');
      expect(field('issue-date').value).toBe(DEMO_TODAY);
      expect(radio('service-kind-month').checked).toBe(true);
      expect((q('service-month') as HTMLSelectElement).value).toBe('2026-10');
      expect(radio('term-14').checked).toBe(true);
      expect(text(q('due-date'))).toBe('Due on 5 Nov 2026');
      expect(radio('lang-de').checked).toBe(true);
      expect(radio('vat-19').checked).toBe(true);
    });

    it('takes the term and the language from the invoice details', async () => {
      demo.saveInvoiceProfile({
        ...business().invoiceProfile,
        paymentTermDays: 30,
        language: 'en',
      });
      await render('/invoices/new');
      expect(radio('term-30').checked).toBe(true);
      expect(radio('lang-en').checked).toBe(true);
      expect(text(q('due-date'))).toBe('Due on 21 Nov 2026');
    });

    it('the customers come as saved, the most recent first, and one is chosen with a tap', async () => {
      await render('/invoices/new');
      const cards = qa('[data-testid^="customer-saved-"]').map((card) => text(card));
      expect(cards).toHaveLength(5);
      expect(cards[0]).toContain('Studio Kern');
      expect(cards[1]).toContain('Atelier Sommer GmbH');
      expect(cards[2]).toContain('Agentur Nord');
      expect(text(q('customer-new'))).toBe('New customer');
      expect(q('customer-name')).toBeNull();
    });

    it('only customers that were sent an invoice are offered: not the customer of a draft, the sample one or a half-typed one', async () => {
      const typing = invoices.newDraft();
      invoices.saveDraft({ ...typing, customer: { ...typing.customer, name: 'Agentur S' } });
      await render('/invoices/new');
      const cards = qa('[data-testid^="customer-saved-"]').map((card) => text(card));
      expect(cards).toHaveLength(5);
      expect(cards.join(' ')).not.toContain('Agentur S');
      expect(cards.join(' ')).not.toContain('Bezirksamt Pankow');
    });

    it('a customer that is typed is not offered in its own list', async () => {
      await render('/invoices/new');
      const before = qa('[data-testid^="customer-saved-"]').length;
      await choose('customer-new');
      await type('customer-name', 'Agentur Süd');
      expect(qa('[data-testid^="customer-saved-"]')).toHaveLength(before);
      expect(radio('customer-new').checked).toBe(true);
      expect(field('customer-name').value).toBe('Agentur Süd');
    });

    it('a new customer is typed in, and saved with the draft', async () => {
      await render('/invoices/new');
      await choose('customer-new');
      await type('customer-name', 'Agentur Süd');
      await type('customer-street', 'Hauptstr. 1');
      await type('customer-postcode', '80331');
      await type('customer-city', 'München');
      await type('customer-email', 'info@agentur-sued.example');
      expect(draftOf().customer).toEqual({
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
      expect(missing()).toEqual(['lines']);
    });
  });

  describe('what you did', () => {
    it('line suggestions fill price and unit', async () => {
      await render('/invoices/new');
      await type('line-description-0', 'Design');
      expect(text(q('suggestions-0'))).toContain('Design-Beratung €80.00 · Hours');
      await press('suggestion-0-0');
      expect(field('line-description-0').value).toBe('Design-Beratung');
      expect((q('line-unit-0') as HTMLSelectElement).value).toBe('hour');
      expect(field('line-price-0').value).toBe('80.00');
      expect(text(q('total-net'))).toBe('€80.00');
      expect(draftOf().lines).toEqual([
        { description: 'Design-Beratung', quantity: 1, unit: 'hour', unitPriceCents: 8000 },
      ]);
    });

    it('the suggestions are earlier lines of this business, not the draft being written', async () => {
      await render('/invoices/new');
      await type('line-description-0', 'Mein eigener Text');
      await press('add-line');
      await type('line-description-1', 'Mein');
      expect(q('suggestions-1')).toBeNull();
    });

    it('amount accepts 49,90 and 49.90', async () => {
      await render('/invoices/new');
      await type('line-description-0', 'Hosting');
      await type('line-price-0', '49,90');
      expect(text(q('total-net'))).toBe('€49.90');
      expect(draftOf().lines[0].unitPriceCents).toBe(4990);
      await type('line-price-0', '49.90');
      expect(text(q('total-net'))).toBe('€49.90');
      expect(draftOf().lines[0].unitPriceCents).toBe(4990);
      expect(q('line-error-price-0')).toBeNull();
    });

    it('net, VAT and total follow every change', async () => {
      await render('/invoices/new');
      await type('line-description-0', 'Beratung');
      await type('line-price-0', '100');
      expect([text(q('total-net')), text(q('total-vat')), text(q('total-gross'))]).toEqual([
        '€100.00',
        '€19.00',
        '€119.00',
      ]);
      await type('line-quantity-0', '3');
      expect([text(q('total-net')), text(q('total-vat')), text(q('total-gross'))]).toEqual([
        '€300.00',
        '€57.00',
        '€357.00',
      ]);
      expect(text(q('total-vat-label'))).toBe('VAT 19 %');
    });

    it('the VAT rate is 19 % or 7 %', async () => {
      await render('/invoices/new');
      await type('line-description-0', 'Beratung');
      await type('line-price-0', '100');
      await choose('vat-7');
      expect(draftOf().vatRate).toBe(7);
      expect([text(q('total-vat')), text(q('total-gross'))]).toEqual(['€7.00', '€107.00']);
      expect(text(q('total-vat-label'))).toBe('VAT 7 %');
      expect(radio('vat-19').checked).toBe(false);
    });

    it('Remove line takes one away', async () => {
      await render('/invoices/new');
      await type('line-description-0', 'One');
      await press('add-line');
      await type('line-description-1', 'Two');
      await press('line-remove-0');
      expect(qa('[data-testid^="line-row-"]')).toHaveLength(1);
      expect(field('line-description-0').value).toBe('Two');
      expect(draftOf().lines.map((l) => l.description)).toEqual(['Two']);
    });

    it('a line that is left empty is not saved, so it does not stop the invoice from being sent', async () => {
      await render('/invoices/new');
      await fillNew();
      await press('add-line');
      expect(qa('[data-testid^="line-row-"]')).toHaveLength(2);
      expect(draftOf().lines).toHaveLength(1);
      expect(missing()).toEqual([]);
    });
  });

  describe('a Kleinunternehmer', () => {
    it('KU business shows no VAT and the § 19 note', async () => {
      demo.setBusiness('sara-yoga');
      await render('/invoices/new');
      expect(q('vat-19')).toBeNull();
      expect(q('vat-7')).toBeNull();
      expect(text(q('vat-note'))).toContain('§ 19');
      expect(q('vat-note')!.querySelector('button')).not.toBeNull(); // the term, explained
      expect(text(q('vat-note'))).toContain('Kleinunternehmer');

      await pickCustomer('Studio Mitte');
      await type('line-description-0', 'Yogakurs');
      await type('line-price-0', '120');
      expect(q('total-vat')).toBeNull();
      expect(q('total-net')).toBeNull();
      expect(text(q('total-gross'))).toBe('€120.00');
      expect(text(q('format'))).toContain('PDF');
      expect(q('format')!.querySelector('button')).toBeNull();
    });
  });

  describe('a customer abroad', () => {
    async function newCustomerAbroad(country: string): Promise<void> {
      await render('/invoices/new');
      await choose('customer-new');
      await type('customer-name', 'Maison Lyon');
      await type('customer-street', 'Rue de la Paix 1');
      await type('customer-postcode', '69001');
      await type('customer-city', 'Lyon');
      await type('customer-email', 'compta@maison-lyon.example');
      await select('customer-country', country);
      await type('line-description-0', 'Beratung');
      await type('line-price-0', '500');
    }

    it('EU business needs a VAT number before sending', async () => {
      await newCustomerAbroad('FR');
      // No German VAT: the customer pays it, and says so. Both IDs are needed on the invoice.
      expect(q('vat-19')).toBeNull();
      expect(text(q('vat-note'))).toContain('Your customer pays the VAT');
      expect(text(q('vat-note'))).toContain('Reverse charge');
      expect(text(q('total-gross'))).toBe('€500.00');
      expect(missing()).toEqual(['sellerVatId', 'customerVatId']);
      expect(canPress()).toBe(false);
      expect(text(q('check-customerVatId'))).toContain("Add the customer's VAT ID");

      await type('customer-vat-id', 'FR12345678901');
      expect(missing()).toEqual(['sellerVatId']);
      expect(draftOf().customer.vatId).toBe('FR12345678901');
      expect(canPress()).toBe(false);

      // The seller's own VAT ID is added in the tax details, which lead back to this invoice.
      const id = draftOf().id;
      expect(q('check-fix-sellerVatId')!.getAttribute('href')).toBe(
        `/settings/tax?from=invoice&invoice=${id}`,
      );
      demo.saveTaxProfile({ ...business().taxProfile, vatId: 'DE123456789' });
      await settle();
      expect(missing()).toEqual([]);
      expect(canPress()).toBe(true);
      expect(text(q('format'))).toContain('PDF');
    });

    it('a business outside the EU: no VAT and no VAT ID asked for', async () => {
      await newCustomerAbroad('US');
      expect(q('vat-19')).toBeNull();
      expect(text(q('vat-note'))).toContain('not taxable in Germany');
      expect(missing()).toEqual([]);
      expect(canPress()).toBe(true);
    });

    it("private abroad can't be sent", async () => {
      invoices.saveDraft({
        ...invoices.newDraft(),
        customer: {
          name: 'Marie Dupont',
          street: 'Rue 2',
          postcode: '75001',
          city: 'Paris',
          country: 'FR',
          email: 'marie@mail.example',
          kind: 'private',
          vatId: null,
          leitwegId: null,
        },
        lines: [{ description: 'Beratung', quantity: 1, unit: 'flat', unitPriceCents: 10000 }],
      });
      const id = draftOf().id;
      await render(`/invoices/${id}/edit`);
      expect(missing()).toEqual(['privateAbroad']);
      expect(text(q('check-privateAbroad'))).toContain(
        'Customers abroad are businesses only for now',
      );
      expect(canPress()).toBe(false);
      expect(text(q('customer-abroad-note'))).toBe('Customers abroad are businesses only for now.');

      // Putting the country right is enough.
      await select('customer-country', 'DE');
      expect(missing()).toEqual([]);
      expect(canPress()).toBe(true);
    });

    it('a private person has no country to choose, and a business that was abroad goes back to Germany', async () => {
      await newCustomerAbroad('AT');
      await choose('customer-kind-private');
      expect(q('customer-country')).toBeNull();
      expect(draftOf().customer).toMatchObject({ kind: 'private', country: 'DE' });
      expect(missing()).toEqual([]);
    });
  });

  describe('a public office', () => {
    it('public office asks for the Leitweg-ID and shows XRechnung', async () => {
      await render('/invoices/new');
      await choose('customer-new');
      await choose('customer-kind-public');
      await type('customer-name', 'Bezirksamt Mitte');
      await type('customer-street', 'Karl-Marx-Allee 31');
      await type('customer-postcode', '10178');
      await type('customer-city', 'Berlin');
      await type('customer-email', 'rechnung@bezirksamt-mitte.example');
      await type('line-description-0', 'Gestaltung');
      await type('line-price-0', '1000');

      expect(q('customer-leitweg-id')).not.toBeNull();
      expect(text(q('format'))).toContain('XRechnung');
      expect(q('format')!.querySelector('button')).not.toBeNull();
      expect(missing()).toEqual(['leitwegId']);
      expect(canPress()).toBe(false);

      await type('customer-leitweg-id', '11001-01234-56');
      expect(missing()).toEqual([]);
      expect(canPress()).toBe(true);
      expect(draftOf().customer).toMatchObject({
        kind: 'public',
        leitwegId: '11001-01234-56',
        country: 'DE',
      });
    });

    it('a business in Germany gets a ZUGFeRD e-invoice, a private person a plain PDF', async () => {
      await render('/invoices/new');
      await fillNew();
      expect(text(q('format'))).toContain('ZUGFeRD');
      await press('customer-edit');
      await choose('customer-kind-private');
      expect(text(q('format'))).toContain('PDF');
      expect(text(q('format'))).not.toContain('ZUGFeRD');
    });
  });

  describe('dates', () => {
    it('the invoice date is changed, and the due date follows', async () => {
      await render('/invoices/new');
      await commit('issue-date', '2026-10-01');
      expect(draftOf().issueDate).toBe('2026-10-01');
      expect(text(q('due-date'))).toBe('Due on 15 Oct 2026');
    });

    it('a date that is cleared goes back to the one the invoice has', async () => {
      await render('/invoices/new');
      await commit('issue-date', '2026-10-01');
      await commit('issue-date', '');
      expect(field('issue-date').value).toBe('2026-10-01');
      expect(draftOf().issueDate).toBe('2026-10-01');
    });

    it('pay within 7, 14 or 30 days', async () => {
      await render('/invoices/new');
      await choose('term-7');
      expect(draftOf().paymentTermDays).toBe(7);
      expect(text(q('due-date'))).toBe('Due on 29 Oct 2026');
      await choose('term-30');
      expect(draftOf().paymentTermDays).toBe(30);
      expect(text(q('due-date'))).toBe('Due on 21 Nov 2026');
    });

    it('the work was done in a month, or on one day', async () => {
      await render('/invoices/new');
      expect(
        Array.from((q('service-month') as HTMLSelectElement).options)
          .map((o) => o.value)
          .slice(0, 3),
      ).toEqual(['2026-10', '2026-09', '2026-08']);
      expect(text((q('service-month') as HTMLSelectElement).options[0])).toBe('October 2026');
      await select('service-month', '2026-09');
      expect(draftOf().servicePeriod).toEqual({ kind: 'month', month: '2026-09' });

      await choose('service-kind-date');
      expect(q('service-month')).toBeNull();
      expect(draftOf().servicePeriod).toEqual({ kind: 'date', date: '2026-09-01' });
      expect(field('service-date').value).toBe('2026-09-01');
      await commit('service-date', '2026-09-17');
      expect(draftOf().servicePeriod).toEqual({ kind: 'date', date: '2026-09-17' });

      await choose('service-kind-month');
      expect(draftOf().servicePeriod).toEqual({ kind: 'month', month: '2026-09' });
    });

    it('a day in the month of the invoice date is that day when it is picked first', async () => {
      await render('/invoices/new');
      await choose('service-kind-date');
      expect(draftOf().servicePeriod).toEqual({ kind: 'date', date: DEMO_TODAY });
    });

    it('a month that the draft has but the list does not is still there to choose', async () => {
      invoices.saveDraft({
        ...invoices.newDraft(),
        servicePeriod: { kind: 'month', month: '2024-03' },
      });
      await render(`/invoices/${draftOf().id}/edit`);
      expect((q('service-month') as HTMLSelectElement).value).toBe('2024-03');
    });

    it('the invoice language is German or English', async () => {
      await render('/invoices/new');
      expect(text(q('q-language'))).toContain('Invoice language');
      await choose('lang-en');
      expect(draftOf().language).toBe('en');
      expect(radio('lang-de').checked).toBe(false);
    });
  });

  describe('ready to send', () => {
    it('lists what the law needs, and ticks what is there', async () => {
      await render('/invoices/new');
      expect(checklist()).toEqual({
        sellerAddress: true,
        taxNumber: true,
        customerName: false,
        customerAddress: false,
        customerEmail: false,
        lines: false,
        servicePeriod: true,
      });
      expect(text(q('check-sellerAddress'))).toBe('Your name and address');
      expect(text(q('check-customerName'))).toBe('Choose or add a customer');
      expect(text(q('check-customerAddress'))).toBe("Add the customer's full address");
      expect(text(q('check-customerEmail'))).toBe("Add the customer's email");
      expect(text(q('check-lines'))).toBe(
        'Finish your lines: each needs a description, a quantity and a price',
      );
    });

    it('says what the invoice goes out as, as a German term, and which number it will get', async () => {
      await render('/invoices/new');
      expect(text(q('format'))).toBe(
        'Format E-invoice (E-Rechnung) · PDF with data inside (ZUGFeRD)',
      );
      expect(q('format')!.querySelectorAll('button')).toHaveLength(2);
      expect(text(q('next-number'))).toBe('Number RE-2026-045 is given when you send.');
      expect(q('next-number')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
    });

    it('the main button waits until nothing is missing, and says why', async () => {
      await render('/invoices/new');
      expect((q('preview-send') as HTMLButtonElement).disabled).toBe(true);
      expect(text(q('preview-send'))).toBe('Preview and send');
      expect(text(q('send-blocked'))).toBe('Fix what is marked above, then you can send.');
      expect(q('preview-send')!.getAttribute('aria-describedby')).toBe('send-blocked');
      await fillNew();
      expect(q('send-blocked')).toBeNull();
      expect(canPress()).toBe(true);
    });

    it('a missing name and address, or tax number, leads to Settings and back to this invoice', async () => {
      demo.saveInvoiceProfile({ ...business().invoiceProfile, street: '' });
      demo.setSetup('halfway'); // the tax step is not done
      await render('/invoices/new');
      expect(missing()).toEqual(expect.arrayContaining(['sellerAddress', 'taxNumber']));
      expect(text(q('check-sellerAddress'))).toBe('Add your name and address in Settings');
      expect(text(q('check-taxNumber'))).toBe('Add your tax number in Settings');
      // Nothing is written yet, so there is no draft to name.
      expect(q('check-fix-sellerAddress')!.getAttribute('href')).toBe(
        '/settings/invoice?from=invoice',
      );
      expect(q('check-fix-taxNumber')!.getAttribute('href')).toBe('/settings/tax?from=invoice');

      await fillNew();
      const id = draftOf().id;
      expect(q('check-fix-sellerAddress')!.getAttribute('href')).toBe(
        `/settings/invoice?from=invoice&invoice=${id}`,
      );
      expect(q('check-fix-taxNumber')!.getAttribute('href')).toBe(
        `/settings/tax?from=invoice&invoice=${id}`,
      );
    });

    it('a missing field of the customer is a button that puts the cursor in it', async () => {
      invoices.saveDraft({
        ...invoices.newDraft(),
        customer: {
          name: 'Agentur Süd',
          street: 'Hauptstr. 1',
          postcode: '80331',
          city: 'München',
          country: 'DE',
          email: '',
          kind: 'business',
          vatId: null,
          leitwegId: null,
        },
        lines: [{ description: 'Beratung', quantity: 1, unit: 'flat', unitPriceCents: 10000 }],
      });
      await render(`/invoices/${draftOf().id}/edit`);
      expect(missing()).toEqual(['customerEmail']);
      expect(q('check-fix-customerEmail')!.tagName).toBe('BUTTON');
      await press('check-fix-customerEmail');
      tick();
      expect(document.activeElement).toBe(q('customer-email'));
    });

    it('unfinished lines lead to the line, and a missing month to the date', async () => {
      invoices.saveDraft({
        ...invoices.newDraft(),
        servicePeriod: { kind: 'month', month: '' },
        lines: [{ description: 'Beratung', quantity: 1, unit: 'flat', unitPriceCents: 0 }],
      });
      await render(`/invoices/${draftOf().id}/edit`);
      expect(missing()).toEqual(expect.arrayContaining(['lines', 'servicePeriod']));
      await press('check-fix-lines');
      tick();
      expect(document.activeElement).toBe(q('line-price-0'));
      await press('check-fix-servicePeriod');
      tick();
      expect(document.activeElement).toBe(q('service-month'));
    });

    it('Preview and send opens the send step of the draft', async () => {
      await render('/invoices/inv-wd-draft/edit');
      expect(canPress()).toBe(true);
      await press('preview-send');
      expect(router.url).toBe('/invoices/inv-wd-draft?send=1');
    });
  });

  describe('saving as you go', () => {
    it('an untouched new form saves nothing; a change saves a draft', async () => {
      const count = business().invoices.length;
      await render('/invoices/new');
      expect(business().invoices).toHaveLength(count);
      expect(text(q('draft-saved'))).toBe('');
      expect(q('delete-draft')).toBeNull();

      // Looking around changes nothing either.
      await choose('customer-new');
      await press('add-line');
      expect(business().invoices).toHaveLength(count);

      await type('customer-name', 'A');
      expect(business().invoices).toHaveLength(count + 1);
      expect(text(q('draft-saved'))).toBe('Saved as a draft. You can leave any time.');
      expect(draftOf().customer.name).toBe('A');
      expect(draftOf().sentOn).toBeNull();

      await type('customer-name', 'Agentur Süd');
      expect(business().invoices).toHaveLength(count + 1);
      expect(draftOf().customer.name).toBe('Agentur Süd');
    });

    it('after the first change the address is the address of the draft, so the Back button returns to it', async () => {
      const location = TestBed.inject(Location);
      await render('/invoices/new');
      expect(location.path()).toBe('/invoices/new');
      await choose('customer-new');
      expect(location.path()).toBe('/invoices/new');

      await type('customer-name', 'A');
      const id = draftOf().id;
      expect(location.path()).toBe(`/invoices/${id}/edit`);
      const input = q('customer-name');
      await type('customer-name', 'Agentur Süd');
      expect(location.path()).toBe(`/invoices/${id}/edit`);
      expect(q('customer-name')).toBe(input); // the page stays as it is: no new page, so the cursor stays too

      // Opening that address shows the draft as it was left.
      await render(`/invoices/${id}/edit`);
      expect(field('customer-name').value).toBe('Agentur Süd');
    });

    it('the cross goes back to the list and keeps the draft', async () => {
      const count = business().invoices.length;
      await render('/invoices/new');
      await choose('customer-new');
      await type('customer-name', 'Agentur Süd');
      expect(q('close-form')!.getAttribute('href')).toBe('/invoices');
      expect(q('close-form')!.getAttribute('aria-label')).toBe('Close');
      await press('close-form');
      expect(router.url).toBe('/invoices');
      expect(business().invoices).toHaveLength(count + 1);
    });

    it('a second new form is another draft, and two in a row never share an id', async () => {
      await render('/invoices/new');
      await choose('customer-new');
      await type('customer-name', 'One');
      const first = draftOf().id;
      await render('/invoices');
      await render('/invoices/new');
      await choose('customer-new');
      await type('customer-name', 'Two');
      const second = draftOf().id;
      expect(second).not.toBe(first);
      expect(
        business().invoices.filter(
          (i) => i.sentOn === null && ['One', 'Two'].includes(i.customer.name),
        ),
      ).toHaveLength(2);
    });

    it('a form that is open keeps its own draft when another one is made meanwhile', async () => {
      await render('/invoices/new');
      const copyId = invoices.duplicate('inv-wd-044');
      await choose('customer-new');
      await type('customer-name', 'Agentur Süd');
      expect(draftOf(copyId).customer.name).toBe('Studio Kern');
      expect(business().invoices.filter((i) => i.customer.name === 'Agentur Süd')).toHaveLength(1);
    });

    it('editing a draft changes that draft', async () => {
      await render('/invoices/inv-wd-draft/edit');
      expect(text(q('form-title'))).toBe('Edit draft');
      expect(field('customer-name').value).toBe('Bezirksamt Pankow');
      expect(field('customer-leitweg-id').value).toBe('11001-01234-56');
      expect(field('line-description-0').value).toBe('Gestaltung und Satz Jahresbericht 2026');
      expect(field('line-price-0').value).toBe('3500.00');
      expect(text(q('total-gross'))).toBe('€4,165.00');
      expect(text(q('format'))).toContain('XRechnung');
      const count = business().invoices.length;

      await type('line-price-0', '4000');
      expect(business().invoices).toHaveLength(count);
      expect(draftOf('inv-wd-draft').lines[0].unitPriceCents).toBe(400000);
      expect(draftOf('inv-wd-draft').customer.name).toBe('Bezirksamt Pankow');
      expect(draftOf('inv-wd-draft').number).toBeNull();
    });

    it('a draft shows the lines it has, and a button to add more', async () => {
      await render('/invoices/inv-wd-draft/edit');
      expect(qa('[data-testid^="line-row-"]')).toHaveLength(1);
      expect(q('add-line')).not.toBeNull();
    });

    it('a draft with no lines shows one empty line, and saves nothing until something is typed', async () => {
      invoices.saveDraft(invoices.newDraft());
      const stored = draftOf();
      await render(`/invoices/${stored.id}/edit`);
      expect(qa('[data-testid^="line-row-"]')).toHaveLength(1);
      expect(draftOf(stored.id)).toBe(stored);
    });
  });

  describe('Delete draft', () => {
    it('delete draft asks once, and then removes the draft and goes to the list', async () => {
      await render('/invoices/inv-wd-draft/edit');
      expect(text(q('delete-draft'))).toBe('Delete draft');
      await press('delete-draft');
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).not.toBeNull();
      });
      expect(text(inDialog('delete-title'))).toBe('Delete this draft?');
      expect(business().invoices.some((i) => i.id === 'inv-wd-draft')).toBe(true);

      inDialog('delete-confirm')!.click();
      await settle();
      expect(business().invoices.some((i) => i.id === 'inv-wd-draft')).toBe(false);
      expect(router.url).toBe('/invoices');
    });

    it('Keep draft closes the question and changes nothing', async () => {
      await render('/invoices/inv-wd-draft/edit');
      await press('delete-draft');
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).not.toBeNull();
      });
      inDialog('delete-keep')!.click();
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).toBeNull();
      });
      expect(business().invoices.some((i) => i.id === 'inv-wd-draft')).toBe(true);
      expect(router.url).toBe('/invoices/inv-wd-draft/edit');
    });

    it('delete draft after a new form was started removes that one', async () => {
      await render('/invoices/new');
      await choose('customer-new');
      await type('customer-name', 'Agentur Süd');
      const id = draftOf().id;
      await press('delete-draft');
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).not.toBeNull();
      });
      inDialog('delete-confirm')!.click();
      await settle();
      expect(business().invoices.some((i) => i.id === id)).toBe(false);
      expect(router.url).toBe('/invoices');
    });
  });

  describe('invoices that cannot be edited', () => {
    it('a sent invoice opens read-only: its page, not the form', async () => {
      await render('/invoices/inv-wd-044/edit');
      await vi.waitFor(() => expect(router.url).toBe('/invoices/inv-wd-044'));
      expect(document.body.querySelector('[data-testid="invoice-form"]')).toBeNull();
    });

    it('a cancelled or cancellation invoice does too', async () => {
      await render('/invoices/inv-wd-042/edit');
      await vi.waitFor(() => expect(router.url).toBe('/invoices/inv-wd-042'));
    });

    it('an unknown invoice says so and leads back to the list', async () => {
      await render('/invoices/inv-nope/edit');
      expect(text(q('form-not-found'))).toContain('Invoice not found');
      expect(q('invoice-form')).toBeNull();
      expect(q('not-found-back')!.getAttribute('href')).toBe('/invoices');
    });

    it("another business's draft is not found either", async () => {
      demo.setBusiness('sara-yoga');
      await render('/invoices/inv-wd-draft/edit');
      expect(q('form-not-found')).not.toBeNull();
    });

    it("switching to another business with a form open starts that business's form", async () => {
      await render('/invoices/new');
      expect(radio('vat-19').checked).toBe(true);
      demo.setBusiness('sara-yoga');
      await settle();
      expect(q('vat-19')).toBeNull();
      expect(q('vat-note')).not.toBeNull();
    });

    it('Reset demo starts the form over', async () => {
      await render('/invoices/new');
      await choose('customer-new');
      await type('customer-name', 'Agentur Süd');
      expect(text(q('draft-saved'))).not.toBe('');
      demo.resetData();
      await settle();
      // A new form again: nothing typed, nothing saved, and the customers of the sample data to choose from.
      expect(q('customer-name')).toBeNull();
      expect(text(q('draft-saved'))).toBe('');
      expect(business().invoices.some((i) => i.customer.name === 'Agentur Süd')).toBe(false);
      expect(qa('[data-testid^="customer-saved-"]')).toHaveLength(5);
    });
  });

  describe('languages', () => {
    it('German', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('/invoices/new');
      expect(text(q('form-title'))).toBe('Neue Rechnung');
      expect(text(q('preview-send'))).toBe('Ansehen und senden');
      expect(text(q('check-customerName'))).toBe('Kunden auswählen oder hinzufügen');
    });

    it('Arabic form rtl with ltr amounts', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/invoices/inv-wd-draft/edit');
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(q('form-title'))).toBe('تعديل المسودة');
      expect(field('line-price-0').getAttribute('dir')).toBe('ltr');
      expect(field('line-quantity-0').getAttribute('dir')).toBe('ltr');
      expect(field('issue-date').getAttribute('dir')).toBe('ltr');
      expect(field('customer-postcode').getAttribute('dir')).toBe('ltr');
      expect(field('customer-email').getAttribute('dir')).toBe('ltr');
      for (const id of ['total-net', 'total-vat', 'total-gross', 'line-net-0']) {
        expect(q(id)!.querySelector('bdi')!.getAttribute('dir'), id).toBe('ltr');
      }
      expect(q('next-number')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(q('due-date')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
    });
  });
});

describe('the routes of the form', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  it('/invoices/new is the form, not an invoice called "new"', async () => {
    const harness = await RouterTestingHarness.create('/invoices/new');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="invoice-form"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="invoice-not-found"]')).toBeNull();
  });

  it('/invoices/:id/edit is the form of that draft', async () => {
    const harness = await RouterTestingHarness.create('/invoices/inv-wd-draft/edit');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="invoice-form"]')).not.toBeNull();
    expect((el.querySelector('[data-testid="customer-name"]') as HTMLInputElement).value).toBe(
      'Bezirksamt Pankow',
    );
  });

  it('/invoices/:id is still the invoice', async () => {
    const harness = await RouterTestingHarness.create('/invoices/inv-wd-044');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="invoice-page"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="invoice-form"]')).toBeNull();
  });
});
