import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { CATEGORIES } from '../data/categories';
import type { Doc } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { DocumentStatusChip } from './document-status-chip';

const base: Doc = {
  id: 'd',
  fileName: 'beleg.pdf',
  source: 'file',
  addedOn: '2026-10-20',
  fromUpload: false,
  reading: false,
  name: 'Test GmbH',
  direction: 'received',
  invoiceNo: 'R-1',
  date: '2026-10-20',
  dueDate: null,
  amountCents: 1000,
  vatRate: 19,
  duplicateOf: null,
  booking: CATEGORIES[0],
  bookingConfirmed: false,
  paymentId: null,
  history: [],
  invoice: null,
  selfIssued: null,
};
const doc = (patch: Partial<Doc>): Doc => ({ ...base, ...patch });

@Component({
  imports: [DocumentStatusChip],
  template: `<app-document-status-chip [doc]="doc" />`,
})
class Host {
  doc: Doc = base;
}

describe('DocumentStatusChip', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  function render(d: Doc): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.doc = d;
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[data-testid="doc-status"]') as HTMLElement;
  }
  const word = (d: Doc) => render(d).textContent?.trim();

  it('every status shows a word, not only an icon', () => {
    expect(word(doc({ reading: true }))).toBe('Reading…');
    expect(word(doc({ duplicateOf: 'doc-wd-t2' }))).toBe('Possible duplicate');
    expect(word(doc({ direction: null }))).toBe('Received or sent?');
    expect(word(doc({ amountCents: null }))).toBe('Check amount');
    expect(word(doc({ date: null }))).toBe('Check date');
    expect(word(doc({ name: null }))).toBe('Check name');
    expect(word(doc({}))).toBe('Waiting for payment');
    expect(word(doc({ paymentId: 'wd-t2' }))).toBe('Done');
  });

  it('waiting shows the due date when there is one', () => {
    expect(word(doc({ dueDate: '2026-10-30' }))).toBe('Waiting for payment · due 30 Oct');
    expect(word(doc({ dueDate: null }))).toBe('Waiting for payment');
  });

  it('overdue says since when', () => {
    expect(word(doc({ dueDate: '2026-09-30' }))).toMatch(/^Overdue since 30 Sep/);
    expect(word(doc({ dueDate: '2026-09-30' }))).toBe(
      `Overdue since ${formatDate('2026-09-30', 'en')}`,
    );
  });

  it('a linked document is Done even when its due date has passed', () => {
    expect(word(doc({ dueDate: '2026-09-30', paymentId: 'wd-t2' }))).toBe('Done');
  });

  it('uses the status colour tokens, and reading is muted and italic', () => {
    const reading = render(doc({ reading: true })).classList;
    expect(reading).toContain('text-muted-foreground');
    expect(reading).toContain('italic');

    for (const patch of [
      { duplicateOf: 'x' },
      { direction: null },
      { amountCents: null },
      { date: null },
      { name: null },
    ]) {
      const chip = render(doc(patch)).classList;
      expect(chip, JSON.stringify(patch)).toContain('text-warning');
      expect(chip).not.toContain('italic');
    }

    const waiting = render(doc({ dueDate: '2026-10-30' })).classList;
    expect(waiting).toContain('text-muted-foreground');
    expect(waiting).not.toContain('italic');
    expect(render(doc({ dueDate: '2026-09-30' })).classList).toContain('text-negative');
    expect(render(doc({ paymentId: 'wd-t2' })).classList).toContain('text-positive');
  });

  it('never leaves the cell it sits in', () => {
    expect(render(doc({ dueDate: '2026-10-30' })).classList).toContain('max-w-full');
  });

  it('shows the word and the date in the current language', () => {
    TestBed.inject(LanguageService).setLang('de');
    expect(word(doc({ dueDate: '2026-10-30' }))).toBe(
      `Wartet auf Zahlung · fällig ${formatDate('2026-10-30', 'de')}`,
    );
    expect(word(doc({ paymentId: 'wd-t2' }))).toBe('Erledigt');
  });

  it('follows the language while it is shown', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.doc = doc({ dueDate: '2026-10-30' });
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('[data-testid="doc-status"]') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('Waiting for payment · due 30 Oct');
    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(chip.textContent?.trim()).toContain('fällig');
  });

  describe("the document of an invoice written in Invoices", () => {
    /** Text without the marks that keep an amount or a number in its own direction inside a sentence. */
    const plain = (d: Doc) => word(d)!.replace(/[\u2066\u2068\u2069]/g, '');

    const sample = (businessId: string, id: string): Doc => {
      const demo = TestBed.inject(DemoStateService);
      demo.setBusiness(businessId);
      return demo.documents().find((d) => d.id === id)!;
    };

    it("partly paid chip shows what's left", () => {
      const partly = sample('sara-yoga', 'sy-d2'); // RE-2026-021: 300,00 € of 600,00 € paid, due 13 Nov
      expect(plain(partly)).toBe(`Waiting for payment · ${formatMoney(30000, 'en')} left`);
      expect(render(partly).classList).toContain('text-muted-foreground');
    });

    it('a partly paid invoice that is past its due date says since when, and what is left', () => {
      const partly = { ...sample('sara-yoga', 'sy-d2'), dueDate: '2026-10-20' };
      expect(plain(partly)).toBe(`Overdue since ${formatDate('2026-10-20', 'en')} · ${formatMoney(30000, 'en')} left`);
      expect(render(partly).classList).toContain('text-negative');
    });

    it('an invoice that was not paid shows its usual chip', () => {
      expect(plain(sample('weber-design', 'wd-d2'))).toBe('Waiting for payment · due 30 Oct');
      expect(plain(sample('weber-design', 'wd-d3'))).toBe(`Overdue since ${formatDate('2026-09-30', 'en')}`);
      expect(plain(sample('weber-design', 'doc-wd-t1'))).toBe('Done');
    });

    it('cancelled and cancellation chips', () => {
      const cancelled = sample('weber-design', 'wd-d5'); // RE-2026-040
      const cancellation = sample('weber-design', 'wd-d6'); // RE-2026-042 cancels it
      expect(plain(cancelled)).toBe('Done · Cancelled');
      expect(plain(cancellation)).toBe('Cancellation of RE-2026-040');
      expect(render(cancelled).classList).toContain('text-positive');
      expect(render(cancellation).classList).toContain('text-positive');
    });

    it('follow the language', () => {
      TestBed.inject(LanguageService).setLang('de');
      expect(plain(sample('sara-yoga', 'sy-d2'))).toBe(`Wartet auf Zahlung · ${formatMoney(30000, 'de')} offen`);
      expect(plain(sample('weber-design', 'wd-d5'))).toBe('Erledigt · Storniert');
      expect(plain(sample('weber-design', 'wd-d6'))).toBe('Stornorechnung zu RE-2026-040');
    });
  });
});
