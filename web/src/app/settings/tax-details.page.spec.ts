import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DEMO_TODAY } from '../data/demo-date';
import type { TaxProfile } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentDetailPage } from '../payments/payment-detail.page';
import { PaymentsPage } from '../payments/payments.page';
import { TaxDetailsPage } from './tax-details.page';
import { demoStateNames } from './tax-form';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

@Component({ template: '' })
class Stub {}

describe('TaxDetailsPage', () => {
  let demo: DemoStateService;
  let router: Router;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: '', pathMatch: 'full', component: Stub },
          { path: 'settings', component: Stub },
          { path: 'settings/tax', component: TaxDetailsPage },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  /** Goes to another page of the same test (the harness is made once per test). */
  async function navigate(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const field = (testId: string) => q(testId) as HTMLInputElement;
  /** The radio or checkbox inside an option card. */
  const box = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;
  const isChecked = (testId: string) => box(testId).checked;
  const questions = () =>
    Array.from(el.querySelectorAll('[data-testid^="q-"]')).map((card) =>
      card.getAttribute('data-testid'),
    );

  async function choose(testId: string): Promise<void> {
    box(testId).click();
    await settle();
  }

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function pickState(stateId: string): Promise<void> {
    field('state').value = stateId;
    field('state').dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  /** Answers every question with a valid answer (a quarterly VAT business in Berlin). */
  async function fillAll(): Promise<void> {
    await choose('kind-freelance');
    await choose('vat-yes');
    await choose('period-quarterly');
    await choose('basis-soll');
    await pickState('berlin');
    await type('number', '27/123/45678');
  }

  /** Text without the isolates that keep a name's direction. */
  const plain = (value: string) => value.replace(/[\u2066-\u2069]/g, '');
  const demoNote = (lang: 'en' | 'de' | 'ar' = 'en') => ({
    en: en.taxDetails.number.demoNote,
    de: de.taxDetails.number.demoNote,
    ar: ar.taxDetails.number.demoNote,
  })[lang].replace('{{states}}', plain(demoStateNames(lang)));
  const savedProfile = (): TaxProfile => demo.business().taxProfile;
  const historyKeys = () => demo.business().history.map((entry) => entry.key);

  describe('the page', () => {
    it('has the title, the intro line and the questions in order', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      expect(text(el.querySelector('h1'))).toBe('Your tax details');
      expect(text(q('intro'))).toBe(en.taxDetails.intro);
      expect(questions()).toEqual(['q-kind', 'q-vat', 'q-number', 'q-vat-id', 'q-year']);
      await choose('vat-yes');
      expect(questions()).toEqual([
        'q-kind',
        'q-vat',
        'q-period',
        'q-basis',
        'q-number',
        'q-vat-id',
        'q-year',
      ]);
    });

    it('opens empty before the tax step is done: no answer chosen, nothing typed', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      for (const id of ['kind-freelance', 'kind-trade', 'vat-yes', 'vat-no']) {
        expect(isChecked(id), id).toBe(false);
      }
      expect(field('state').value).toBe('');
      expect(field('number').value).toBe('');
      expect(field('vat-id').value).toBe('');
      expect(q('office')).toBeNull();
      expect(q('year-day')).toBeNull();
      expect(text(q('year-calendar-text'))).toContain('Calendar year');
    });

    it('opens with the saved answers once the tax step is done', async () => {
      await render('/settings/tax');
      expect(demo.setup().tax).toBe(true);
      expect(isChecked('kind-freelance')).toBe(true);
      expect(isChecked('vat-yes')).toBe(true);
      expect(isChecked('period-monthly')).toBe(true);
      expect(isChecked('extension')).toBe(false);
      expect(isChecked('basis-ist')).toBe(true);
      expect(field('state').value).toBe('berlin');
      expect(field('number').value).toBe('27/123/45678');
      expect(text(q('office'))).toContain('Berlin Friedrichshain-Kreuzberg');
    });

    it("shows a Kleinunternehmer's saved answers without the VAT questions", async () => {
      demo.setBusiness('sara-yoga');
      await render('/settings/tax');
      expect(isChecked('vat-no')).toBe(true);
      expect(q('q-period')).toBeNull();
      expect(q('q-basis')).toBeNull();
    });

    it('opens on the business that is open now, and starts over for another one', async () => {
      await render('/settings/tax');
      expect(field('number').value).toBe('27/123/45678');
      demo.setBusiness('cafe-linde');
      await settle();
      expect(field('number').value).toBe('41/234/56789');
      expect(field('state').value).toBe('hamburg');
      expect(isChecked('kind-trade')).toBe(true);
      expect(isChecked('period-quarterly')).toBe(true);
      expect(isChecked('basis-soll')).toBe(true);
    });

    it('is empty again when the demo toolbar sets the business back to new', async () => {
      await render('/settings/tax');
      demo.setSetup('new');
      await settle();
      expect(isChecked('kind-freelance')).toBe(false);
      expect(field('number').value).toBe('');
    });

    it('names the German terms next to their translations, each explained', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      await choose('vat-yes');
      await pickState('berlin');
      await type('number', '27/123/45678');
      const terms = text(el);
      for (const label of [
        'Freelance work (Freiberufler)',
        'A trade (Gewerbe)',
        '(Kleinunternehmer)',
        'VAT return (UStVA)',
        'Permanent extension (Dauerfristverlängerung)',
        'When my customer pays (Ist-Versteuerung)',
        'When I send the invoice (Soll-Versteuerung)',
        'Tax number (Steuernummer)',
        'VAT ID (USt-IdNr.)',
        'Tax office (Finanzamt)',
      ]) {
        expect(terms, label).toContain(label);
      }
      expect(el.querySelectorAll('app-term').length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('the questions', () => {
    it('the VAT questions appear only after Yes', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      expect(q('q-period')).toBeNull();
      expect(q('q-basis')).toBeNull();
      await choose('vat-no');
      expect(q('q-period')).toBeNull();
      expect(q('q-basis')).toBeNull();
      await choose('vat-yes');
      expect(q('q-period')).not.toBeNull();
      expect(q('q-basis')).not.toBeNull();
      expect(box('period-monthly')).toBeTruthy();
      expect(box('period-quarterly')).toBeTruthy();
      expect(box('period-yearly')).toBeTruthy();
      expect(box('extension').type).toBe('checkbox');
      expect(box('basis-ist')).toBeTruthy();
      expect(box('basis-soll')).toBeTruthy();
      // Nothing is chosen for the person.
      for (const id of ['period-monthly', 'period-quarterly', 'period-yearly', 'extension', 'basis-ist', 'basis-soll']) {
        expect(isChecked(id), id).toBe(false);
      }
    });

    it('the No answer names the limits', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      const limits = text(q('vat-no'));
      expect(limits).toContain(formatMoney(2500000, 'en', { whole: true }));
      expect(limits).toContain(formatMoney(10000000, 'en', { whole: true }));
      expect(limits).toContain('Kleinunternehmer');
    });

    it('offers the three return periods and the permanent extension under them', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      await choose('vat-yes');
      expect(text(q('period-monthly'))).toContain('Monthly');
      expect(text(q('period-quarterly'))).toContain('Quarterly');
      expect(text(q('period-yearly'))).toContain('Only once a year');
      await choose('extension');
      expect(isChecked('extension')).toBe(true);
      await choose('extension');
      expect(isChecked('extension')).toBe(false);
    });

    it('a hint says where the answer is written, next to the VAT questions', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      await choose('vat-yes');
      for (const id of ['q-vat', 'q-period', 'q-basis']) {
        expect(text(q(id)), id).toContain('Not sure?');
        expect(text(q(id)), id).toContain('Fragebogen zur steuerlichen Erfassung');
      }
    });

    it('answering No clears the VAT answers', async () => {
      // The saved answers: Yes, monthly, Ist. Add the extension, then say No.
      await render('/settings/tax');
      await choose('extension');
      expect(isChecked('extension')).toBe(true);
      await choose('vat-no');
      expect(q('q-period')).toBeNull();
      expect(q('q-basis')).toBeNull();

      // Switching back to Yes starts them empty.
      await choose('vat-yes');
      for (const id of ['period-monthly', 'period-quarterly', 'period-yearly', 'extension', 'basis-ist', 'basis-soll']) {
        expect(isChecked(id), id).toBe(false);
      }

      // Say No again and save: nothing of the VAT answers is stored.
      await choose('vat-no');
      await click('save');
      expect(savedProfile()).toMatchObject({
        kleinunternehmer: true,
        vatPeriod: null,
        permanentExtension: false,
        vatBasis: null,
      });
      expect(historyKeys()).toEqual(['taxChanged']);

      // Opening the page again shows them empty after Yes.
      await navigate('/settings/tax');
      expect(isChecked('vat-no')).toBe(true);
      await choose('vat-yes');
      for (const id of ['period-monthly', 'period-quarterly', 'period-yearly', 'extension', 'basis-ist', 'basis-soll']) {
        expect(isChecked(id), id).toBe(false);
      }
    });

    it('a federal state is chosen from all sixteen, none pre-selected', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      const options = Array.from(field('state').querySelectorAll('option'));
      expect(options.map((o) => o.value)).toHaveLength(17);
      expect(options[0].value).toBe('');
      expect(options.map((o) => text(o))).toContain('Nordrhein-Westfalen');
      expect(options.map((o) => text(o))).toContain('Baden-Württemberg');
    });

    it('a valid Berlin number shows its tax office', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      await pickState('berlin');
      expect(q('office')).toBeNull();
      await type('number', '27/123');
      expect(q('office')).toBeNull();
      await type('number', '27/123/45678');
      expect(text(q('office'))).toContain('Tax office');
      expect(text(q('office'))).toContain('Berlin Friedrichshain-Kreuzberg');
      expect(q('office')!.closest('[role="status"]')).not.toBeNull();
      // The line is under the number, and it goes again when the number stops being valid.
      expect(
        q('number')!.compareDocumentPosition(q('office')!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      await type('number', '27/123/4567');
      expect(q('office')).toBeNull();
    });

    it('picking a state the demo knows no tax offices for shows a demo note before Save', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      expect(q('state-note')).toBeNull();
      await pickState('hessen');
      expect(plain(text(q('state-note')))).toBe(demoNote());
      expect(plain(text(q('state-note')))).toBe(
        'In this demo, tax offices are only known for Bayern, Berlin, Bremen, Hamburg and Nordrhein-Westfalen.',
      );
      // The note sits right under the state select, and the select points to it.
      expect(
        field('state').closest('label')!.compareDocumentPosition(q('state-note')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        q('state-note')!.compareDocumentPosition(q('number')!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(field('state').getAttribute('aria-describedby')).toBe(q('state-note')!.id);
      // It is a note, not an error: nothing was saved or refused yet.
      expect(q('state-note')!.getAttribute('role')).toBeNull();
      expect(q('error-number')).toBeNull();

      await pickState('bayern');
      expect(q('state-note')).toBeNull();
      expect(field('state').getAttribute('aria-describedby')).toBeNull();
      await pickState('hessen');
      expect(q('state-note')).not.toBeNull();
      await pickState('');
      expect(q('state-note')).toBeNull();
    });

    it('the demo note names the states in the language of the page', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      await pickState('hessen');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(plain(text(q('state-note')))).toBe(demoNote('de'));
      expect(plain(text(q('state-note')))).toContain('Hamburg und Nordrhein-Westfalen');
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(plain(text(q('state-note')))).toBe(demoNote('ar'));
    });

    it('a number written for another state shows no tax office', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      await type('number', '27/123/45678');
      await pickState('bayern');
      expect(q('office')).toBeNull();
      await pickState('berlin');
      expect(text(q('office'))).toContain('Berlin Friedrichshain-Kreuzberg');
    });

    it('puts the tax number and the VAT ID in left-to-right text', async () => {
      await render('/settings/tax');
      expect(field('number').getAttribute('dir')).toBe('ltr');
      expect(field('vat-id').getAttribute('dir')).toBe('ltr');
      expect(q('office')!.querySelector('bdi')).not.toBeNull();
    });
  });

  describe('the financial year', () => {
    it('is the calendar year, with a Mine is different link that shows a day and a month field', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      expect(text(q('year-calendar-text'))).toContain('Calendar year');
      expect(q('year-day')).toBeNull();
      await click('year-different');
      expect(q('year-day')).not.toBeNull();
      expect(q('year-month')).not.toBeNull();
      expect(q('year-different')).toBeNull();
      await click('year-calendar');
      expect(q('year-day')).toBeNull();
      expect(q('year-different')).not.toBeNull();
    });

    it('Mine is different stores 07-01', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await click('year-different');
      await type('year-day', '1');
      await type('year-month', '7');
      await click('save');
      expect(savedProfile().fiscalYearStart).toBe('07-01');
    });

    it('opens with the own year when one was saved', async () => {
      demo.saveTaxProfile({ ...savedProfile(), fiscalYearStart: '07-01' });
      await render('/settings/tax');
      expect(q('year-day')).not.toBeNull();
      expect(field('year-day').value).toBe('1');
      expect(field('year-month').value).toBe('7');
    });

    it('names a day or month that does not exist, and keeps what was typed', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await click('year-different');
      await type('year-day', '31');
      await type('year-month', '4');
      await click('save');
      expect(text(q('error-year'))).toBe(en.taxDetails.year.error);
      expect(field('year-day').value).toBe('31');
      expect(field('year-month').value).toBe('4');
      expect(demo.setup().tax).toBe(false);
      await type('year-day', '30');
      expect(q('error-year')).toBeNull();
      await click('save');
      expect(savedProfile().fiscalYearStart).toBe('04-30');
    });

    it('goes back to the calendar year (01-01) even after day and month were typed', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await click('year-different');
      await type('year-day', '1');
      await type('year-month', '7');
      await click('year-calendar');
      await click('save');
      expect(savedProfile().fiscalYearStart).toBe('01-01');
    });
  });

  describe('Save', () => {
    it('Save with a wrong number shows the error and keeps the answers', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await type('number', '99/999/99999');
      const history = demo.business().history;
      await click('save');

      expect(text(q('error-number'))).toBe(
        "We couldn't find a tax office for this number. Please check it.",
      );
      expect(q('error-number')!.getAttribute('role')).toBe('alert');
      expect(field('number').getAttribute('aria-invalid')).toBe('true');
      expect(field('number').getAttribute('aria-describedby')).toContain(q('error-number')!.id);
      // The error is next to the field, the answers stay, nothing was saved and the page did not move.
      expect(q('q-number')!.contains(q('error-number'))).toBe(true);
      expect(field('number').value).toBe('99/999/99999');
      expect(field('state').value).toBe('berlin');
      expect(isChecked('kind-freelance')).toBe(true);
      expect(isChecked('vat-yes')).toBe(true);
      expect(isChecked('period-quarterly')).toBe(true);
      expect(isChecked('basis-soll')).toBe(true);
      expect(demo.business().history).toBe(history);
      expect(demo.setup().tax).toBe(false);
      expect(router.url).toBe('/settings/tax?from=home');

      // Typing a new number takes the error away; the next Save goes through.
      await type('number', '27/123/45678');
      expect(q('error-number')).toBeNull();
      expect(field('number').getAttribute('aria-invalid')).toBeNull();
      await click('save');
      expect(router.url).toBe('/');
    });

    it('Save with Hessen shows the demo message, not "Please check it"', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await pickState('hessen');
      expect(q('state-note')).not.toBeNull();
      await click('save');

      expect(plain(text(q('error-number')))).toBe(demoNote());
      expect(text(q('error-number'))).not.toContain('Please check it');
      expect(q('error-number')!.getAttribute('role')).toBe('alert');
      expect(q('q-number')!.contains(q('error-number'))).toBe(true);
      expect(field('number').getAttribute('aria-invalid')).toBe('true');
      expect(field('number').getAttribute('aria-describedby')).toContain(q('error-number')!.id);
      // The sentence is on the page once: the error stands in for the note.
      expect(q('state-note')).toBeNull();
      expect(plain(text(q('q-number'))).split('In this demo').length).toBe(2);
      // The answers stay, and nothing was saved.
      expect(field('state').value).toBe('hessen');
      expect(field('number').value).toBe('27/123/45678');
      expect(demo.setup().tax).toBe(false);
      expect(router.url).toBe('/settings/tax?from=home');

      // Choosing a state the demo knows takes the error away; the next Save goes through.
      await pickState('berlin');
      expect(q('error-number')).toBeNull();
      expect(q('state-note')).toBeNull();
      await click('save');
      expect(router.url).toBe('/');
    });

    it('Save with Hessen and no number says it is the demo too', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await pickState('hessen');
      await type('number', '');
      await click('save');
      expect(plain(text(q('error-number')))).toBe(demoNote());
    });

    it('a wrong Berlin number still shows "Please check it", with no demo note', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await type('number', '99/999/99999');
      await click('save');
      expect(text(q('error-number'))).toBe(
        "We couldn't find a tax office for this number. Please check it.",
      );
      expect(text(q('error-number'))).not.toContain('In this demo');
      expect(q('state-note')).toBeNull();
    });

    it('Save with nothing answered names every question that is missing, next to it', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await click('save');
      expect(text(q('error-kind'))).toBe(en.taxDetails.kind.error);
      expect(text(q('error-vat'))).toBe(en.taxDetails.vat.error);
      expect(text(q('error-state'))).toBe(en.taxDetails.number.errorState);
      expect(text(q('error-number'))).toBe(en.taxDetails.number.errorEmpty);
      expect(q('error-period')).toBeNull();
      expect(q('error-vat-id')).toBeNull();
      expect(q('q-kind')!.contains(q('error-kind'))).toBe(true);
      expect(q('q-vat')!.contains(q('error-vat'))).toBe(true);
      expect(demo.setup().tax).toBe(false);
      expect(router.url).toBe('/settings/tax?from=home');

      // Answering takes the error of that question away, and only that one.
      await choose('kind-trade');
      expect(q('error-kind')).toBeNull();
      expect(q('error-vat')).not.toBeNull();
      await choose('vat-yes');
      expect(q('error-vat')).toBeNull();
    });

    it('names the return period and Ist/Soll when VAT is charged and they are missing', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await choose('kind-freelance');
      await choose('vat-yes');
      await pickState('berlin');
      await type('number', '27/123/45678');
      await click('save');
      expect(text(q('error-period'))).toBe(en.taxDetails.period.error);
      expect(text(q('error-basis'))).toBe(en.taxDetails.basis.error);
      expect(q('q-period')!.contains(q('error-period'))).toBe(true);
      const group = q('q-period')!.querySelector('[role="radiogroup"]')!;
      expect(group.getAttribute('aria-invalid')).toBe('true');
      expect(group.getAttribute('aria-describedby')).toBe(q('error-period')!.id);
      await choose('period-monthly');
      expect(q('error-period')).toBeNull();
      expect(q('error-basis')).not.toBeNull();
    });

    it('puts the cursor on the first question with an error', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await choose('kind-freelance');
      await choose('vat-no');
      await click('save');
      await settle();
      expect(document.activeElement).toBe(field('state'));
    });

    it('Save stores the answers, ticks the tax step and returns home', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      expect(demo.setup().tax).toBe(false);
      await click('save');

      expect(savedProfile()).toEqual({
        businessKind: 'freelance',
        kleinunternehmer: false,
        vatPeriod: 'quarterly',
        permanentExtension: false,
        vatBasis: 'soll',
        taxState: 'berlin',
        taxNumber: '27/123/45678',
        vatId: null,
        fiscalYearStart: '01-01',
      });
      expect(demo.business().history).toEqual([{ date: DEMO_TODAY, key: 'taxChanged', params: {} }]);
      expect(demo.setup()).toEqual({ bank: false, tax: true, receipt: false });
      expect(router.url).toBe('/');
    });

    it('Save returns to Settings when the page was opened from there, and by default', async () => {
      await render('/settings/tax?from=settings');
      await click('save');
      expect(router.url).toBe('/settings');

      await navigate('/settings/tax');
      await click('save');
      expect(router.url).toBe('/settings');
    });

    it('goes back with replaceUrl, so the browser Back button does not return to the form', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      const navigate = vi.spyOn(router, 'navigateByUrl');
      await click('save');
      expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
    });

    it('stores a VAT ID upper-cased and without spaces', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await type('vat-id', ' de 123 456 789 ');
      await click('save');
      expect(savedProfile().vatId).toBe('DE123456789');
    });

    it('stores no VAT ID when the field is empty', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await click('save');
      expect(savedProfile().vatId).toBeNull();
    });

    it('names a VAT ID that is not DE and nine digits, and keeps what was typed', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await type('vat-id', 'DE12345');
      await click('save');
      expect(text(q('error-vat-id'))).toBe(en.taxDetails.vatId.error);
      expect(q('q-vat-id')!.contains(q('error-vat-id'))).toBe(true);
      expect(field('vat-id').value).toBe('DE12345');
      expect(field('vat-id').getAttribute('aria-invalid')).toBe('true');
      expect(demo.setup().tax).toBe(false);
      await type('vat-id', 'DE123456789');
      expect(q('error-vat-id')).toBeNull();
    });

    it('saving the same answers twice adds one history line', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await click('save');
      expect(historyKeys()).toEqual(['taxChanged']);

      // Open the page again: it shows the saved answers. Saving them again changes nothing.
      await navigate('/settings/tax?from=home');
      expect(field('number').value).toBe('27/123/45678');
      await click('save');
      expect(historyKeys()).toEqual(['taxChanged']);
      expect(router.url).toBe('/');
    });

    it('a double tap on Save saves once', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      q('save')!.click();
      q('save')!.click();
      await settle();
      expect(historyKeys()).toEqual(['taxChanged']);
    });

    it('a Kleinunternehmer save makes the payment detail show No VAT', async () => {
      demo.setSetup('halfway');
      // Before: a VAT business shows the rate of the booking.
      await render('/payments/wd-t1');
      expect(text(q('booking-vat'))).toContain('19%');
      expect(text(q('booking-vat'))).not.toContain('No VAT');

      await navigate('/settings/tax?from=home');
      await choose('kind-freelance');
      await choose('vat-no');
      await pickState('berlin');
      await type('number', '27/123/45678');
      await click('save');
      expect(savedProfile().kleinunternehmer).toBe(true);

      await navigate('/payments/wd-t1');
      expect(text(q('booking-vat'))).toContain('No VAT');
      expect(text(q('booking-vat'))).not.toContain('19%');

      // Saying Yes again brings the rate back.
      await navigate('/settings/tax?from=home');
      await choose('vat-yes');
      await choose('period-monthly');
      await choose('basis-ist');
      await click('save');
      await navigate('/payments/wd-t1');
      expect(text(q('booking-vat'))).toContain('19%');
    });

    it('a Kleinunternehmer who switches to charging VAT stores the VAT answers', async () => {
      demo.setBusiness('sara-yoga');
      await render('/settings/tax?from=home');
      await choose('vat-yes');
      await choose('period-monthly');
      await choose('basis-ist');
      await click('save');
      expect(savedProfile().kleinunternehmer).toBe(false);
      expect(savedProfile().vatPeriod).toBe('monthly');
    });
  });

  describe('going back', () => {
    it('has a back link to the homepage, or to Settings by default', async () => {
      await render('/settings/tax?from=home');
      expect(q('back-link')!.getAttribute('href')).toBe('/');
      expect(text(q('back-link'))).toBe('Back to home');
      expect(q('back-link')!.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');

      await navigate('/settings/tax?from=settings');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
      expect(text(q('back-link'))).toBe('Back to Settings');

      await navigate('/settings/tax');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');

      await navigate('/settings/tax?from=somewhere');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
    });
  });

  describe('languages', () => {
    it('the form keeps its answers when the language changes', async () => {
      await render('/settings/tax');
      // Half-fill the saved form: change many answers and leave the number unfinished.
      await choose('kind-trade');
      await choose('period-quarterly');
      await choose('extension');
      await choose('basis-soll');
      await pickState('hamburg');
      await type('number', '41/234');
      await type('vat-id', 'de12');
      await click('year-different');
      await type('year-day', '1');
      await type('year-month', '7');

      const snapshot = () => ({
        kindTrade: isChecked('kind-trade'),
        kindFreelance: isChecked('kind-freelance'),
        vatYes: isChecked('vat-yes'),
        quarterly: isChecked('period-quarterly'),
        monthly: isChecked('period-monthly'),
        extension: isChecked('extension'),
        soll: isChecked('basis-soll'),
        ist: isChecked('basis-ist'),
        state: field('state').value,
        number: field('number').value,
        vatId: field('vat-id').value,
        day: field('year-day').value,
        month: field('year-month').value,
        office: q('office') === null,
      });
      const before = snapshot();
      expect(before).toMatchObject({
        kindTrade: true,
        quarterly: true,
        extension: true,
        soll: true,
        state: 'hamburg',
        number: '41/234',
        vatId: 'de12',
        day: '1',
        month: '7',
      });

      const language = TestBed.inject(LanguageService);
      language.setLang('de');
      await settle();
      expect(text(el.querySelector('h1'))).toBe(de.taxDetails.title);
      expect(snapshot()).toEqual(before);

      language.setLang('ar');
      await settle();
      expect(text(el.querySelector('h1'))).toBe(ar.taxDetails.title);
      expect(snapshot()).toEqual(before);

      language.setLang('en');
      await settle();
      expect(text(el.querySelector('h1'))).toBe(en.taxDetails.title);
      expect(snapshot()).toEqual(before);
    });

    it('keeps an error on screen, in the new language, when the language changes', async () => {
      demo.setSetup('new');
      await render('/settings/tax?from=home');
      await fillAll();
      await type('number', '99/999/99999');
      await click('save');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(q('error-number'))).toBe(de.taxDetails.number.errorUnknown);
      expect(field('number').value).toBe('99/999/99999');
    });

    it('shows only the German term in German, and the German original next to the translation in Arabic', async () => {
      demo.setSetup('new');
      await render('/settings/tax');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(q('q-kind'))).toContain('Freiberufler');
      expect(text(q('q-kind'))).not.toContain('(Freiberufler)');
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(q('q-kind'))).toContain('(Freiberufler)');
    });

    it('mirrors in Arabic: the back arrow turns, the tax number stays left-to-right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/settings/tax?from=home');
      expect(document.documentElement.dir).toBe('rtl');
      expect(q('back-link')!.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
      expect(text(el.querySelector('h1'))).toBe(ar.taxDetails.title);
      expect(field('number').getAttribute('dir')).toBe('ltr');
    });
  });

  describe('the route', () => {
    it('settings/tax is a lazy page inside the shell', () => {
      const shell = routes.find((route) => route.path === '' && route.children)!;
      const route = shell.children!.find((child) => child.path === 'settings/tax')!;
      expect(route).toBeDefined();
      expect(route.loadComponent).toBeTypeOf('function');
      expect(route.component).toBeUndefined();
    });

    it('loads the page', async () => {
      const loaded = await routes
        .find((route) => route.path === '' && route.children)!
        .children!.find((child) => child.path === 'settings/tax')!
        .loadComponent!();
      expect(loaded).toBe(TaxDetailsPage);
    });
  });
});
