import { TestBed } from '@angular/core/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Business, Doc } from '../data/models';
import type { SelfIssuedInput } from '../domain/self-issued';
import { DemoStateService } from '../state/demo-state.service';
import { ReceiptService } from '../state/receipt.service';
import { SelfIssuedPaper } from './self-issued-paper';

const INPUT: SelfIssuedInput = {
  purpose: 'Parkgebühr beim Kundentermin',
  reason: 'machine',
  reasonText: null,
  address: null,
};

describe('SelfIssuedPaper', () => {
  let demo: DemoStateService;
  let receipts: ReceiptService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    demo = TestBed.inject(DemoStateService);
    receipts = TestBed.inject(ReceiptService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** The self-issued receipt written for the APCOA Parking payment, as Documents holds it. */
  function written(input: SelfIssuedInput = INPUT): Doc {
    const id = receipts.createSelfIssued('wd-t20', input, 'payment')!;
    return demo.documents().find((doc) => doc.id === id)!;
  }

  function render(doc: Doc, business: Business = demo.business()): HTMLElement {
    const fixture = TestBed.createComponent(SelfIssuedPaper);
    fixture.componentRef.setInput('doc', doc);
    fixture.componentRef.setInput('business', business);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** The words of a node on one line. */
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** What its parts say, each part on its own, so a label and its value never run into one word. */
  const parts = (node: Element | null | undefined) =>
    Array.from(node?.children ?? [])
      .map((child) => text(child))
      .join(' ');
  const q = (el: HTMLElement, testId: string) =>
    el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const money = (cents: number) => formatMoney(cents, 'de').replace(/\s+/g, ' ');

  it('paper shows every field in German', () => {
    const el = render(
      written({
        purpose: 'Parkgebühr beim Kundentermin',
        reason: 'machine',
        reasonText: null,
        address: 'Parkstraße 1, 10115 Berlin',
      }),
    );

    expect(parts(q(el, 'paper-issuer'))).toBe('Weber Design Lindenstr. 5 10969 Berlin');
    expect(text(q(el, 'paper-title'))).toBe('Eigenbeleg EB-2026-001');
    expect(parts(q(el, 'paper-date'))).toBe(
      `Datum der Zahlung ${formatDate('2026-10-20', 'de', { year: true })}`,
    );
    expect(parts(q(el, 'paper-amount'))).toBe(`Betrag ${money(650)}`);
    expect(money(650)).toBe('6,50 €');
    expect(parts(q(el, 'paper-payee'))).toBe('Zahlungsempfänger APCOA Parking');
    expect(parts(q(el, 'paper-address'))).toBe('Anschrift Parkstraße 1, 10115 Berlin');
    expect(parts(q(el, 'paper-purpose'))).toBe('Verwendungszweck Parkgebühr beim Kundentermin');
    expect(parts(q(el, 'paper-reason'))).toBe(
      'Grund für den fehlenden Beleg Der Automat hat keinen Beleg ausgegeben.',
    );
    expect(text(q(el, 'paper-vat'))).toBe('Keine Vorsteuer');
    expect(parts(q(el, 'paper-issued'))).toBe(
      `Ausgestellt am ${formatDate('2026-10-22', 'de', { year: true })}`,
    );
    expect(parts(q(el, 'paper-confirmed'))).toBe('Bestätigt von Sara Weber');
  });

  it('has no address row when the person gave none', () => {
    const el = render(written());
    expect(q(el, 'paper-address')).toBeNull();
  });

  it('says the reason in German, whichever was chosen, and "something else" in the person\'s own words', () => {
    vi.useFakeTimers();
    const reasonOf = (input: SelfIssuedInput): string => {
      const reason = parts(q(render(written(input)), 'paper-reason'));
      receipts.undoWritten(); // so the next receipt is written for the same payment again
      return reason;
    };
    expect(reasonOf({ ...INPUT, reason: 'lost' })).toBe(
      'Grund für den fehlenden Beleg Der Beleg ist verloren gegangen.',
    );
    expect(reasonOf({ ...INPUT, reason: 'machine' })).toBe(
      'Grund für den fehlenden Beleg Der Automat hat keinen Beleg ausgegeben.',
    );
    expect(reasonOf({ ...INPUT, reason: 'tip' })).toBe(
      'Grund für den fehlenden Beleg Trinkgeld: Dafür gibt es keinen Beleg.',
    );
    expect(reasonOf({ ...INPUT, reason: 'sellerNone' })).toBe(
      'Grund für den fehlenden Beleg Der Verkäufer hat keinen Beleg ausgestellt.',
    );
    expect(
      reasonOf({ ...INPUT, reason: 'other', reasonText: 'Der Zettel ist nass geworden' }),
    ).toBe('Grund für den fehlenden Beleg Der Zettel ist nass geworden');
  });

  it('shows the amount as the receipt holds it, positive, with a thousands dot', () => {
    demo.updateTransaction('wd-t20', (tx) => ({ ...tx, amountCents: -123456 }));
    const el = render(written());
    expect(parts(q(el, 'paper-amount'))).toBe(`Betrag ${money(123456)}`);
    expect(money(123456)).toBe('1.234,56 €');
  });

  it('shows the issuer the invoice details give, and the business name when they are blank', () => {
    const doc = written();
    const business: Business = {
      ...demo.business(),
      invoiceProfile: {
        ...demo.business().invoiceProfile,
        name: '',
        street: '',
        postcode: '',
        city: '',
      },
    };
    expect(parts(q(render(doc, business), 'paper-issuer'))).toBe('Weber Design');
  });

  it('shows nothing for a document that is not a self-issued receipt', () => {
    const ordinary = demo.documents().find((doc) => doc.selfIssued === null)!;
    expect(q(render(ordinary), 'self-issued-paper')).toBeNull();
  });

  describe('left to right, in German', () => {
    it('paper is ltr in Arabic', () => {
      const doc = written({ ...INPUT, address: 'Parkstraße 1, 10115 Berlin' });
      TestBed.inject(LanguageService).setLang('ar');
      expect(document.documentElement.dir).toBe('rtl');
      const el = render(doc);
      const paper = q(el, 'self-issued-paper')!;
      expect(paper.getAttribute('dir')).toBe('ltr');
      expect(paper.getAttribute('lang')).toBe('de');
      // The words are the receipt's, not the app's.
      expect(text(q(el, 'paper-title'))).toBe('Eigenbeleg EB-2026-001');
      expect(parts(q(el, 'paper-amount'))).toBe(`Betrag ${money(650)}`);
      expect(parts(q(el, 'paper-date'))).toBe(
        `Datum der Zahlung ${formatDate('2026-10-20', 'de', { year: true })}`,
      );
      expect(text(q(el, 'paper-vat'))).toBe('Keine Vorsteuer');
    });

    it('is ltr and German in every language of the app', () => {
      const doc = written();
      for (const lang of ['en', 'de', 'ar'] as const) {
        TestBed.inject(LanguageService).setLang(lang);
        const paper = q(render(doc), 'self-issued-paper')!;
        expect(paper.getAttribute('dir'), lang).toBe('ltr');
        expect(paper.getAttribute('lang'), lang).toBe('de');
      }
    });
  });

  it('looks like the invoice paper: the same white sheet, borderless when printed', () => {
    const paper = q(render(written()), 'self-issued-paper')!;
    for (const name of ['bg-white', 'border-neutral-200', 'print:border-0', 'print:shadow-none']) {
      expect(paper.classList.contains(name), name).toBe(true);
    }
  });
});
