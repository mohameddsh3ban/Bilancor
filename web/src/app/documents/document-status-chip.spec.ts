import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { CATEGORIES } from '../data/categories';
import type { Doc } from '../data/models';
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
});
