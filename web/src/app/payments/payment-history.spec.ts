import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Account, HistoryEntry } from '../data/models';
import { PaymentHistory } from './payment-history';
import ar from '../../../public/i18n/ar.json';

const ACCOUNTS: Account[] = [
  {
    id: 'bank',
    kind: 'bank',
    name: 'Qonto',
    balanceCents: 0,
    lastUpdate: '2026-10-21',
    connection: { kind: 'statement', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false },
    product: 'business',
    iban: null,
  },
  {
    id: 'cash',
    kind: 'cash',
    name: 'Cash box',
    balanceCents: 0,
    lastUpdate: '2026-10-21',
    connection: { kind: 'cash', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false },
    product: 'cash',
    iban: null,
  },
];

const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068);
const POP_ISOLATE = String.fromCodePoint(0x2069);
const withoutIsolates = (text: string) => text.replaceAll(FIRST_STRONG_ISOLATE, '').replaceAll(POP_ISOLATE, '');

describe('PaymentHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  function lines(entries: HistoryEntry[]): string[] {
    const fixture = TestBed.createComponent(PaymentHistory);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('accounts', ACCOUNTS);
    fixture.detectChanges();
    const items = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="history-text"]')) as HTMLElement[];
    return items.map((item) => withoutIsolates(item.textContent!).replace(/\s+/g, ' ').trim());
  }

  const entry = (key: HistoryEntry['key'], params: Record<string, string> = {}): HistoryEntry => ({ date: '2026-10-22', key, params });

  it('a receiptLinked line shows the document name', () => {
    expect(lines([entry('receiptLinked', { name: 'Böttcher Bürobedarf' })])).toEqual(['You linked the document Böttcher Bürobedarf']);
  });

  it('the other lines that name something show the name', () => {
    expect(
      lines([
        entry('receiptLinkedAuto', { name: 'Deutsche Bahn' }),
        entry('receiptUnlinked', { name: 'scan.pdf' }),
        entry('linked', { name: 'Telekom' }),
        entry('linkedAuto', { name: 'Telekom' }),
        entry('unlinked', { name: 'Telekom' }),
      ]),
    ).toEqual([
      'The document Deutsche Bahn was linked automatically',
      'You unlinked the document scan.pdf',
      'You linked it to the Telekom payment',
      'Linked automatically to the Telekom payment',
      'You unlinked it from the Telekom payment',
    ]);
  });

  it('wraps a name in first-strong isolates, so a Latin name keeps its order inside an Arabic sentence', () => {
    TestBed.inject(LanguageService).setLang('ar');
    const fixture = TestBed.createComponent(PaymentHistory);
    fixture.componentRef.setInput('entries', [entry('receiptLinked', { name: 'Böttcher Bürobedarf' }), entry('imported', { account: 'Qonto' })]);
    fixture.componentRef.setInput('accounts', ACCOUNTS);
    fixture.detectChanges();
    const [linked, imported] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="history-text"]')) as HTMLElement[];
    expect(linked.textContent).toContain(`${FIRST_STRONG_ISOLATE}Böttcher Bürobedarf${POP_ISOLATE}`);
    expect(linked.textContent!.trim()).toBe(ar.history.receiptLinked.replace('{{name}}', `${FIRST_STRONG_ISOLATE}Böttcher Bürobedarf${POP_ISOLATE}`));
    expect(imported.textContent).not.toContain(FIRST_STRONG_ISOLATE);
  });

  it('a bookedByRule line shows the category as its label, in every language', () => {
    expect(lines([entry('bookedByRule', { category: 'office' })])).toEqual(['Booked as Office supplies by your rule']);
    TestBed.inject(LanguageService).setLang('de');
    expect(lines([entry('bookedByRule', { category: 'office' })])).toEqual(['Nach deiner Regel als Bürobedarf gebucht']);
    TestBed.inject(LanguageService).setLang('ar');
    expect(lines([entry('bookedByRule', { category: 'office' })])).toEqual(['تم الترحيل كـ مستلزمات مكتبية حسب قاعدتك']);
  });

  it('still shows the category as its label and the cash box by its name', () => {
    expect(
      lines([entry('confirmed', { category: 'travel' }), entry('imported', { account: 'Cash box' }), entry('imported', { account: 'Qonto' })]),
    ).toEqual(['You confirmed Travel', 'Imported from Cash box', 'Imported from Qonto']);
  });
});
