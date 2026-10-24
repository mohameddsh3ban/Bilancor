import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { formatDate, formatMoney } from '../core/format/format';
import { DEMO_TODAY } from '../data/demo-date';
import type { Doc } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { ReceiptService } from '../state/receipt.service';
import { PaidPrivatelyDialog } from './paid-privately-dialog';

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';
/** A sentence as it reads: the term button inside it ends with a space that a browser drops at the end of its line. */
const sentence = (node: Element | null | undefined) => text(node).replace(/\s+([,.])/g, '$1');
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const q = <T extends HTMLElement = HTMLElement>(testId: string) =>
  dialog()?.querySelector<T>(`[data-testid="${testId}"]`) ?? null;

describe('PaidPrivatelyDialog', () => {
  let demo: DemoStateService;
  let fixture: ComponentFixture<PaidPrivatelyDialog>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const doc = (id: string): Doc => demo.documents().find((d) => d.id === id)!;

  /** Opens the pop-up for a receipt of a business. */
  async function open(docId: string, businessId = 'weber-design'): Promise<void> {
    demo.setBusiness(businessId);
    fixture = TestBed.createComponent(PaidPrivatelyDialog);
    fixture.componentRef.setInput('doc', doc(docId));
    fixture.componentRef.setInput('open', false);
    await settle();
    fixture.componentRef.setInput('open', true);
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
  }

  /** Opens it again after it closed itself: the page sets the input back to false first, as it does when it opens the pop-up the next time. */
  async function reopen(): Promise<void> {
    fixture.componentRef.setInput('open', false);
    await settle();
    fixture.componentRef.setInput('open', true);
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
  }

  async function expectClosed(): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).toBeNull();
    });
  }

  const radio = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;
  async function choose(testId: string): Promise<void> {
    radio(testId).click();
    await settle();
  }
  async function typeDay(day: string): Promise<void> {
    const date = q<HTMLInputElement>('paid-date')!;
    date.value = day;
    date.dispatchEvent(new Event('input'));
    await settle();
  }
  async function done(): Promise<void> {
    q<HTMLButtonElement>('paid-done')!.click();
    await settle();
  }

  it('asks "How was it paid?" and shows the receipt: its name, its amount and its date', async () => {
    await open('wd-d7');
    expect(text(q('paid-title'))).toBe('How was it paid?');
    expect(text(q('paid-name'))).toBe('Copyshop Kreuzberg');
    expect(text(q('paid-amount'))).toBe(formatMoney(1850, 'en'));
    expect(text(q('paid-receipt-date'))).toBe(formatDate('2026-10-19', 'en', { year: true }));
  });

  it('offers two ways, nothing chosen: in cash from the cash box with the German word explained, and with my own money', async () => {
    await open('wd-d7');
    expect(sentence(q('paid-how-cash'))).toBe('In cash, from the cash box (Kasse)');
    expect(q('paid-how-cash')!.querySelector('app-term-info')).not.toBeNull();
    expect(text(q('paid-how-own'))).toBe('With my own money A private card, or cash of your own');
    expect(radio('paid-how-cash').type).toBe('radio');
    expect(radio('paid-how-cash').name).toBe(radio('paid-how-own').name);
    expect(radio('paid-how-cash').checked).toBe(false);
    expect(radio('paid-how-own').checked).toBe(false);
    expect(q('paid-dialog')!.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('How was it paid?');
  });

  it('Paid on starts at the receipt\'s date and reaches from there up to today', async () => {
    await open('wd-d7');
    const date = q<HTMLInputElement>('paid-date')!;
    expect(text(date.closest('label'))).toBe('Paid on');
    expect(date.value).toBe('2026-10-19');
    expect(date.min).toBe('2026-10-19');
    expect(date.max).toBe(DEMO_TODAY);
    expect(date.getAttribute('dir')).toBe('ltr');
    expect(q('paid-date-error')).toBeNull();
  });

  it('has Done and Cancel, and says how it is recorded', async () => {
    await open('wd-d7');
    expect(text(q('paid-done'))).toBe('Done');
    expect(text(q('paid-cancel'))).toBe('Cancel');
    expect(text(q('paid-hint'))).toBe("It's recorded as a payment that counts like any other in your books.");
  });

  describe('Done', () => {
    it('with nothing chosen asks for a way under the choices, puts the cursor there and changes nothing', async () => {
      await open('wd-d7');
      const before = demo.business();

      await done();

      expect(text(q('paid-how-error'))).toBe('Choose how it was paid.');
      expect(q('paid-how-error')!.getAttribute('role')).toBe('alert');
      expect(dialog()).not.toBeNull();
      expect(demo.business()).toBe(before);
      await vi.waitFor(() => expect(document.activeElement).toBe(radio('paid-how-cash')));

      await choose('paid-how-own');
      expect(q('paid-how-error')).toBeNull();
    });

    it('in cash makes the payment on the cash box, on the day, and closes the pop-up', async () => {
      await open('wd-d7');
      await choose('paid-how-cash');
      await typeDay('2026-10-21');

      await done();
      await expectClosed();

      const tx = demo.business().transactions[0];
      expect(tx).toMatchObject({ id: 'paid-wd-d7', date: '2026-10-21', amountCents: -1850, accountId: 'wd-cash' });
      expect(doc('wd-d7').paymentId).toBe('paid-wd-d7');
      expect(TestBed.inject(ReceiptService).justPaid()).toEqual({ txId: 'paid-wd-d7', docId: 'wd-d7', how: 'cash' });
    });

    it('with my own money makes the payment on the Own money account', async () => {
      await open('wd-d7');
      await choose('paid-how-own');

      await done();
      await expectClosed();

      expect(demo.business().transactions[0]).toMatchObject({ id: 'paid-wd-d7', date: '2026-10-19', accountId: 'weber-design-own' });
      expect(TestBed.inject(ReceiptService).justPaid()?.how).toBe('own');
    });

    it('a day before the receipt, after today or none is named at once and is not paid; the cursor goes to the day', async () => {
      await open('wd-d7');
      await choose('paid-how-cash');
      const date = q<HTMLInputElement>('paid-date')!;
      const before = demo.business();

      for (const day of ['2026-10-18', '2026-10-23', '']) {
        await typeDay(day);
        expect(text(q('paid-date-error')), day).toBe('Pick a day from the date of the receipt up to today.');
        expect(q('paid-date-error')!.getAttribute('role')).toBe('alert');
        expect(date.getAttribute('aria-invalid')).toBe('true');
        expect(date.getAttribute('aria-describedby')).toContain(q('paid-date-error')!.id);

        await done();
        expect(dialog(), day).not.toBeNull();
        expect(demo.business(), day).toBe(before);
        await vi.waitFor(() => expect(document.activeElement).toBe(date));
      }

      await typeDay('2026-10-20');
      expect(q('paid-date-error')).toBeNull();
      expect(date.getAttribute('aria-invalid')).toBeNull();
      await done();
      await expectClosed();
      expect(demo.business().transactions[0].date).toBe('2026-10-20');
    });

    it('a Kleinunternehmer pays the whole amount with no VAT', async () => {
      await open('sy-d3', 'sara-yoga');
      expect(text(q('paid-name'))).toBe('Yogamatten-Shop');
      await choose('paid-how-own');
      await done();
      await expectClosed();
      expect(demo.business().transactions[0]).toMatchObject({ id: 'paid-sy-d3', amountCents: -8900, booking: { skr03: '4980', vatRate: 0 } });
    });
  });

  describe('closing without paying', () => {
    it('Cancel changes nothing, and it opens again with nothing chosen and the receipt\'s date', async () => {
      await open('wd-d7');
      const before = demo.business();
      await choose('paid-how-cash');
      await typeDay('2026-10-21');

      q<HTMLButtonElement>('paid-cancel')!.click();
      await expectClosed();
      expect(demo.business()).toBe(before);

      await reopen();
      expect(radio('paid-how-cash').checked).toBe(false);
      expect(radio('paid-how-own').checked).toBe(false);
      expect(q<HTMLInputElement>('paid-date')!.value).toBe('2026-10-19');
      expect(q('paid-how-error')).toBeNull();
    });

    it('the cross and Escape close it like Cancel and change nothing', async () => {
      await open('wd-d7');
      const before = demo.business();
      for (const close of [
        () => dialog()!.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!.click(),
        () => dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
      ]) {
        close();
        await expectClosed();
        expect(demo.business()).toBe(before);
        expect(fixture.componentInstance.open()).toBe(false);
        await reopen();
      }
    });
  });

  describe('in other languages', () => {
    it('says the same in German, with the German word alone', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await open('wd-d7');
      expect(text(q('paid-title'))).toBe('Wie wurde bezahlt?');
      expect(sentence(q('paid-how-cash'))).toBe('Bar, aus der Kasse');
      expect(text(q('paid-how-own'))).toContain('Mit eigenem Geld');
      expect(text(q('paid-done'))).toBe('Fertig');
      expect(text(q('paid-cancel'))).toBe('Abbrechen');
    });

    it('Arabic: the dialog is right to left, the amount, the dates and the German word left to right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await open('wd-d7');
      expect(dialog()!.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
      expect(text(q('paid-title'))).toBe('كيف دُفع المبلغ؟');
      expect(q('paid-amount')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(q('paid-receipt-date')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(q<HTMLInputElement>('paid-date')!.getAttribute('dir')).toBe('ltr');
      expect(q('paid-how-cash')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(q('paid-how-cash'))).toContain('Kasse');
      expect(text(q('paid-done'))).toBe('تم');
    });
  });
});
