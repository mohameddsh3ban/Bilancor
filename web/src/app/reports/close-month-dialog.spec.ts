import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Doc, Transaction } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { withConnection, withRole } from '../state/demo-state.testing';
import { CloseMonthDialog } from './close-month-dialog';

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** A sentence as it reads: the term button inside it ends with a space that a browser drops at the end of its line. */
const sentence = (node: Element | null | undefined) => text(node).replace(/\s+([,.])/g, '$1');
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const q = <T extends HTMLElement = HTMLElement>(testId: string) =>
  dialog()?.querySelector<T>(`[data-testid="${testId}"]`) ?? null;

describe('CloseMonthDialog', () => {
  let demo: DemoStateService;
  let fixture: ComponentFixture<CloseMonthDialog>;
  let finished: string[];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
    finished = [];
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

  /** Opens the pop-up of a month of a business. */
  async function open(businessId: string, month: string): Promise<void> {
    demo.setBusiness(businessId);
    fixture = TestBed.createComponent(CloseMonthDialog);
    fixture.componentRef.setInput('month', month);
    fixture.componentRef.setInput('open', false);
    fixture.componentInstance.finished.subscribe((result) => finished.push(result));
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

  const edit = (id: string, change: (tx: Transaction) => Transaction) =>
    demo.updateTransaction(id, change);
  const button = (testId: string) => q<HTMLButtonElement>(testId)!;

  it('asks "Close September 2026?" and says what closing does, with the German word explained', async () => {
    await open('sara-yoga', '2026-09');
    expect(text(q('close-title'))).toBe('Close September 2026?');
    expect(sentence(q('close-locks'))).toBe(
      "Closing locks its bookings: they can't be changed any more. This is called Locking the books (Festschreibung).",
    );
    expect(q('close-locks')!.querySelector('app-term')).not.toBeNull();
  });

  it('a month that passes says so for the payments, the documents and the account, and Close is on', async () => {
    await open('sara-yoga', '2026-09');
    expect(text(q('close-check-payments'))).toBe('Every payment is booked and has its receipt');
    expect(text(q('close-check-duplicates'))).toBe('Nothing looks like a duplicate');
    // Sara Weber Yoga's Qonto consent ended on 20 Oct, so September is checked against the statement.
    expect(text(q('close-check-account-sy-qonto'))).toBe('Qonto: Check it against your statement');
    expect(q('close-check-start')).toBeNull();
    expect(button('close-confirm').disabled).toBe(false);
    expect(text(button('close-confirm'))).toBe('Close September');
    expect(text(button('close-not-yet'))).toBe('Not yet');
  });

  it('a connection that works matches the bank, a statement account says to check it, and the cash box is left out', async () => {
    await open('cafe-linde', '2026-09');
    expect(text(q('close-check-account-cl-qonto'))).toBe('Qonto: Matches the bank');
    expect(text(q('close-check-account-cl-sparkasse'))).toBe(
      'Sparkasse: Check it against your statement',
    );
    expect(q('close-check-account-cl-cash')).toBeNull();
  });

  it('a connection that ends or breaks is checked against the statement', async () => {
    demo.setBusiness('cafe-linde');
    withConnection(demo, 'cl-qonto', { broken: true });
    await open('cafe-linde', '2026-09');
    expect(text(q('close-check-account-cl-qonto'))).toBe('Qonto: Check it against your statement');
  });

  it('a blocked month says what is missing, with Start, and Close is off', async () => {
    demo.setBusiness('sara-yoga');
    edit('sy-t10', (tx) => ({ ...tx, confirmed: false }));
    edit('sy-t11', (tx) => ({ ...tx, confirmed: false }));
    edit('sy-t9', (tx) => ({ ...tx, receipt: 'missing', receiptFile: null }));
    await open('sara-yoga', '2026-09');

    expect(text(q('close-check-payments'))).toBe('2 to confirm, 1 receipt missing Start');
    expect(q('close-check-start')!.getAttribute('href')).toBe('/review');
    expect(button('close-confirm').disabled).toBe(true);

    button('close-confirm').click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(demo.business().closedMonths).toHaveLength(1);
    expect(finished).toEqual([]);
  });

  it('names every kind that blocks, in the order a payment is dealt with: no category, confirmation, receipt', async () => {
    demo.setBusiness('sara-yoga');
    edit('sy-t10', (tx) => ({ ...tx, booking: null }));
    edit('sy-t11', (tx) => ({ ...tx, confirmed: false }));
    edit('sy-t9', (tx) => ({ ...tx, receipt: 'missing', receiptFile: null }));
    edit('sy-t6', (tx) => ({ ...tx, receipt: 'missing', receiptFile: null }));
    await open('sara-yoga', '2026-09');
    expect(text(q('close-check-payments'))).toBe(
      '1 unclear, 1 to confirm, 2 receipts missing Start',
    );
  });

  it('a possible duplicate only warns: it names how many and Show opens Documents, and Close stays on', async () => {
    demo.setBusiness('sara-yoga');
    const base = demo.business().documents[0];
    const duplicate: Doc = {
      ...base,
      id: 'sy-dup',
      duplicateOf: demo.business().documents[1].id,
      date: '2026-09-12',
    };
    demo.addDocument('sara-yoga', duplicate);
    await open('sara-yoga', '2026-09');
    expect(text(q('close-check-duplicates'))).toBe('1 document looks like a duplicate Show');
    expect(q('close-check-show')!.getAttribute('href')).toBe('/documents');
    expect(button('close-confirm').disabled).toBe(false);

    demo.addDocument('sara-yoga', { ...duplicate, id: 'sy-dup-2' });
    await settle();
    expect(text(q('close-check-duplicates'))).toBe('2 documents look like duplicates Show');
  });

  it('Close closes the month for the person, tells the page, and the pop-up goes', async () => {
    await open('sara-yoga', '2026-09');
    button('close-confirm').click();
    await expectClosed();
    expect(demo.business().closedMonths.at(-1)).toEqual({
      month: '2026-09',
      on: '2026-10-22',
      by: 'Sara Weber',
    });
    expect(finished).toEqual(['closed']);
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('Not yet changes nothing and tells the page it was put off', async () => {
    await open('sara-yoga', '2026-09');
    button('close-not-yet').click();
    await expectClosed();
    expect(demo.business().closedMonths).toHaveLength(1);
    expect(finished).toEqual(['dismissed']);
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('the cross, Escape and a tap outside close it like Not yet, once', async () => {
    const closers = {
      cross: () => dialog()!.querySelector<HTMLElement>('[data-slot="dialog-close"]')!.click(),
      escape: () =>
        dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
      outside: () => document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click(),
    };
    for (const [how, close] of Object.entries(closers)) {
      finished = [];
      await open('sara-yoga', '2026-09');
      close();
      await expectClosed();
      expect(finished, how).toEqual(['dismissed']);
      expect(demo.business().closedMonths, how).toHaveLength(1);
      fixture.destroy();
    }
  });

  it('Start and Show leave the pop-up behind without a word to the page', async () => {
    demo.setBusiness('sara-yoga');
    edit('sy-t10', (tx) => ({ ...tx, confirmed: false }));
    await open('sara-yoga', '2026-09');
    q('close-check-start')!.click();
    await expectClosed();
    expect(finished).toEqual([]);
  });

  it('stays open when the month can not be closed after all (a person who may not close)', async () => {
    demo.setBusiness('sara-yoga');
    withRole(demo, 'sara-yoga', 'receipts');
    await open('sara-yoga', '2026-09');
    button('close-confirm').click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(finished).toEqual([]);
    expect(demo.business().closedMonths).toHaveLength(1);
  });

  it('speaks German, with the month in German', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await open('sara-yoga', '2026-09');
    expect(text(q('close-title'))).toBe('September 2026 abschließen?');
    expect(text(q('close-check-payments'))).toBe('Jede Zahlung ist gebucht und hat ihren Beleg');
    expect(text(q('close-check-account-sy-qonto'))).toBe('Qonto: Prüfe es mit deinem Kontoauszug');
    expect(text(button('close-confirm'))).toBe('September abschließen');
    expect(text(button('close-not-yet'))).toBe('Noch nicht');
  });
});
