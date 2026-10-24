import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { formatDate, formatMoney, formatMonth } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { CATEGORIES } from '../data/categories';
import type { Doc } from '../data/models';
import { groupDocsByMonth } from '../domain/document-search';
import { docNeedsYou } from '../domain/document-status';
import { READING_MS, newReadingDoc } from '../domain/document-upload';
import { DemoStateService } from '../state/demo-state.service';
import { signInAsSara } from '../state/account.testing';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { UploadService } from '../state/upload.service';
import { DocumentDetailPage } from './document-detail.page';
import { DocumentsPage } from './documents.page';

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
};

describe('DocumentsPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let originalMatchMedia: PropertyDescriptor | undefined;

  beforeEach(() => {
    localStorage.clear();
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          {
            path: 'documents',
            component: DocumentsPage,
            children: [{ path: ':id', component: DocumentDetailPage }],
          },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    else delete (window as { matchMedia?: unknown }).matchMedia;
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** jsdom has no media queries; a computer is a screen where `(min-width: 64rem)` (Tailwind's lg) matches. */
  function screenIs(computer: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: computer && query === '(min-width: 64rem)',
        media: query,
      }),
    });
  }

  async function render(url = '/documents'): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const inside = (node: Element | null, testId: string) =>
    node?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;
  const rowOf = (name: string) => qa('document-row').find((r) => r.textContent?.includes(name))!;
  const cardOf = (name: string) => qa('needs-card').find((c) => c.textContent?.includes(name))!;

  async function click(node: HTMLElement | null): Promise<void> {
    node!.click();
    await settle();
  }

  /** The clipboard answers after a moment; wait for it, then show what the page made of it. */
  async function clipboardAnswers(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve));
    await settle();
  }

  async function type(value: string): Promise<void> {
    const input = q('document-search') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  /** Adds a document to Weber Design the way an upload leaves it. */
  function addDoc(patch: Partial<Doc>): Doc {
    const doc = { ...base, ...patch };
    demo.addDocument('weber-design', doc);
    return doc;
  }

  /** Drops `count` files and waits until they are read; the pool gives Deutsche Bahn, Telekom (duplicate), Krause & Partner (no direction). */
  function upload(count: number): void {
    vi.useFakeTimers();
    const files = Array.from({ length: count }, (_, i) => new File(['x'], `scan-${i + 1}.pdf`));
    TestBed.inject(UploadService).add(files, 'file');
    vi.advanceTimersByTime(READING_MS);
    vi.useRealTimers();
  }

  describe('menu', () => {
    it('menu Documents opens the page', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
      });
      signInAsSara();
      harness = await RouterTestingHarness.create('/');
      el = harness.routeNativeElement as HTMLElement;
      const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('aside nav a')).find(
        (a) => a.textContent?.trim() === 'Documents',
      )!;
      expect(link.getAttribute('href')).toBe('/documents');
      link.click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/documents');
      expect(text(q('documents-list')!.querySelector('h1'))).toBe('Documents');
    });
  });

  describe('top of the page', () => {
    it('has the title, the Add button and the address to forward receipts to', async () => {
      await render();
      expect(text(q('documents-list')!.querySelector('h1'))).toBe('Documents');
      expect(text(q('add-button'))).toContain('Add');
      expect(text(q('inbox-line'))).toContain('Or forward receipts to');
      const email = q('inbox-email')!;
      expect(email.textContent?.trim()).toBe('weber-design@inbox.example');
      expect(email.tagName).toBe('BDI');
      expect(email.getAttribute('dir')).toBe('ltr');
    });

    it('Copy shows Copied', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      try {
        await render();
        const copy = inside(q('inbox-line'), 'copy-button')!;
        expect(text(copy)).toBe('Copy');
        copy.click();
        await clipboardAnswers();
        expect(writeText).toHaveBeenCalledWith('weber-design@inbox.example');
        expect(text(copy)).toBe('Copied');
        expect(text(inside(q('inbox-line'), 'copy-status'))).toBe('Copied');
      } finally {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    });

    it('Copy does not say Copied where the clipboard is not available, such as a demo opened over plain http', async () => {
      expect(navigator.clipboard).toBeUndefined();
      await render();
      const copy = inside(q('inbox-line'), 'copy-button')!;
      expect(() => copy.click()).not.toThrow();
      await clipboardAnswers();
      expect(text(copy)).toBe('Copy');
      expect(text(inside(q('inbox-line'), 'copy-status'))).toBe(
        "Couldn't copy — select the address",
      );
      expect(inside(q('inbox-line'), 'inbox-email')!.classList).toContain('select-all');
    });

    it('Copy says so too when the clipboard refuses', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      try {
        await render();
        inside(q('inbox-line'), 'copy-button')!.click();
        await clipboardAnswers();
        expect(writeText).toHaveBeenCalled();
        expect(text(inside(q('inbox-line'), 'copy-button'))).toBe('Copy');
        expect(text(inside(q('inbox-line'), 'copy-status'))).toBe(
          "Couldn't copy — select the address",
        );
      } finally {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    });

    it('shows the address of the business that is open', async () => {
      await render();
      demo.setBusiness('cafe-linde');
      await settle();
      expect(q('inbox-email')!.textContent?.trim()).toBe('cafe-linde@inbox.example');
    });
  });

  describe('Needs-you box', () => {
    it('the Needs-you box shows the unreadable receipt with Type it in', async () => {
      await render();
      expect(text(q('needs-you-title'))).toBe('Needs you · 1');
      const cards = qa('needs-card');
      expect(cards).toHaveLength(1);
      expect(text(inside(cards[0], 'needs-name'))).toBe('Bürobedarf Schulz');
      expect(text(cards[0])).toContain(formatDate('2026-10-20', 'en'));
      expect(text(inside(cards[0], 'needs-sentence'))).toBe("We couldn't read the amount.");
      const fix = inside(cards[0], 'type-it-in')!;
      expect(fix.textContent?.trim()).toBe('Type it in');
      expect(fix.getAttribute('href')).toBe('/documents/wd-d1');
    });

    it('has a Start link that opens the review inbox', async () => {
      await render();
      const start = inside(q('needs-you-box'), 'needs-you-start')!;
      expect(text(start)).toBe('Start');
      expect(start.tagName).toBe('A');
      expect(start.getAttribute('href')).toBe('/review');
      // Beside the title, not inside it and not inside a card.
      expect(start.closest('[data-testid="needs-you-title"]')).toBeNull();
      expect(start.closest('[data-testid="needs-card"]')).toBeNull();
      expect(text(q('needs-you-title'))).toBe('Needs you · 1');
    });

    it('is hidden when no document needs you', async () => {
      demo.setBusiness('sara-yoga');
      await render();
      expect(q('needs-you-box')).toBeNull();
      expect(q('needs-you-start')).toBeNull();
      demo.setBusiness('weber-design');
      await settle();
      expect(q('needs-you-box')).not.toBeNull();
    });

    it('lists the cards newest first, with the date and the amount that were read', async () => {
      upload(3);
      await render();
      expect(qa('needs-card').map((c) => text(inside(c, 'needs-name')))).toEqual([
        'Krause & Partner',
        'Bürobedarf Schulz',
        'Telekom',
      ]);
      expect(text(q('needs-you-title'))).toBe('Needs you · 3');
      const krause = text(cardOf('Krause'));
      expect(krause).toContain(formatDate('2026-10-21', 'en'));
      expect(krause).toContain(formatMoney(45000, 'en'));
      expect(text(inside(cardOf('Krause'), 'needs-sentence'))).toBe(
        'Is this a bill you received or an invoice you sent?',
      );
    });

    it('the name on a card keeps the page direction, and only the name inside is isolated', async () => {
      upload(3);
      await render();
      expect(qa('needs-name').length).toBe(3);
      for (const name of qa('needs-name')) {
        expect(name.hasAttribute('dir')).toBe(false);
        const inner = name.querySelectorAll<HTMLElement>('[dir="auto"]');
        expect(inner).toHaveLength(1);
        expect(inner[0].classList).toContain('truncate');
        expect(text(inner[0])).toBe(text(name));
      }
    });

    it('a document that is not read yet is called by its file name', async () => {
      addDoc({ id: 'x1', name: null, fileName: 'IMG_9.jpg', amountCents: null });
      await render();
      const card = cardOf('IMG_9.jpg');
      const name = inside(card, 'needs-name')!;
      expect(name.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(inside(card, 'needs-sentence'))).toBe("We couldn't read the amount.");
    });

    it('the amount on a card is a left-to-right bdi', async () => {
      addDoc({ id: 'x1', date: null, amountCents: 4500 });
      await render();
      const bdi = cardOf('Test GmbH').querySelector('bdi')!;
      expect(bdi.getAttribute('dir')).toBe('ltr');
      expect(bdi.textContent?.trim()).toBe(formatMoney(4500, 'en'));
    });

    it('a card says which field it could not read', async () => {
      addDoc({ id: 'x1', name: 'No Date', date: null });
      addDoc({ id: 'x2', name: null, fileName: 'scan.pdf' });
      await render();
      expect(text(inside(cardOf('No Date'), 'needs-sentence'))).toBe("We couldn't read the date.");
      expect(text(inside(cardOf('scan.pdf'), 'needs-sentence'))).toBe("We couldn't read the name.");
      expect(inside(cardOf('No Date'), 'type-it-in')!.getAttribute('href')).toBe('/documents/x1');
    });

    it('Received on the direction card moves the document into the list', async () => {
      upload(3);
      await render();
      expect(qa('needs-card')).toHaveLength(3);
      expect(qa('document-row').some((r) => r.textContent?.includes('Krause'))).toBe(false);

      const card = cardOf('Krause');
      expect(inside(card, 'direction-received')!.textContent?.trim()).toBe('Received');
      expect(inside(card, 'direction-sent')!.textContent?.trim()).toBe('Sent');
      await click(inside(card, 'direction-received'));

      expect(qa('needs-card').map((c) => text(inside(c, 'needs-name')))).toEqual([
        'Bürobedarf Schulz',
        'Telekom',
      ]);
      expect(text(q('needs-you-title'))).toBe('Needs you · 2');
      const row = rowOf('Krause');
      expect(text(inside(row, 'document-meta'))).toBe(
        `Received · ${formatDate('2026-10-21', 'en')}`,
      );
      expect(text(inside(row, 'doc-status'))).toBe('Waiting for payment');
      expect(demo.documents().find((d) => d.name === 'Krause & Partner')!.history[0].key).toBe(
        'markedReceived',
      );
    });

    it('after an answer on the direction card the detail does not say "We set" it', async () => {
      upload(3);
      await render();
      await click(inside(cardOf('Krause'), 'direction-sent'));
      const krause = demo.documents().find((d) => d.name === 'Krause & Partner')!;
      await harness.navigateByUrl(`/documents/${krause.id}`);
      await settle();
      expect(text(q('field-type'))).toBe('Sent (Ausgangsbeleg)');
      expect(q('why-note')).toBeNull();
    });

    it('Sent on the direction card moves the document into the list as sent', async () => {
      upload(3);
      await render();
      await click(inside(cardOf('Krause'), 'direction-sent'));
      expect(qa('needs-card')).toHaveLength(2);
      expect(text(inside(rowOf('Krause'), 'document-meta'))).toBe('Sent · 2026-117');
    });

    it('the duplicate card says which document it looks like', async () => {
      upload(2);
      await render();
      const original = demo.documents().find((d) => d.id === 'doc-wd-t2')!;
      expect(text(inside(cardOf('Telekom'), 'needs-sentence'))).toBe(
        `Looks like the one you added on ${formatDate(original.addedOn, 'en')}.`,
      );
      expect(inside(cardOf('Telekom'), 'keep-both')!.textContent?.trim()).toBe('Keep both');
      expect(inside(cardOf('Telekom'), 'remove-doc')!.textContent?.trim()).toBe('Remove');
    });

    it('a duplicate that is linked to a payment can only be kept, not removed', async () => {
      addDoc({ id: 'x1', name: 'Verknüpft', duplicateOf: 'doc-wd-t2', paymentId: 'wd-t3' });
      await render();
      expect(inside(cardOf('Verknüpft'), 'keep-both')).not.toBeNull();
      expect(inside(cardOf('Verknüpft'), 'remove-doc')).toBeNull();
    });

    it('a duplicate of a document that is gone still says what is wrong', async () => {
      addDoc({ id: 'x1', name: 'Alt', duplicateOf: 'gone' });
      await render();
      expect(text(inside(cardOf('Alt'), 'needs-sentence'))).toBe(
        'Looks like a document you added before.',
      );
    });

    it('Keep both and Remove clear a duplicate card', async () => {
      addDoc({ id: 'x1', name: 'Erste Kopie', duplicateOf: 'doc-wd-t2', date: '2026-10-19' });
      addDoc({ id: 'x2', name: 'Zweite Kopie', duplicateOf: 'doc-wd-t2', date: '2026-10-18' });
      await render();
      expect(qa('needs-card')).toHaveLength(3);

      await click(inside(cardOf('Erste Kopie'), 'keep-both'));
      expect(qa('needs-card').map((c) => text(inside(c, 'needs-name')))).toEqual([
        'Bürobedarf Schulz',
        'Zweite Kopie',
      ]);
      expect(text(inside(rowOf('Erste Kopie'), 'doc-status'))).toBe('Waiting for payment');
      expect(demo.documents().find((d) => d.id === 'x1')!.history[0].key).toBe('keptDuplicate');

      await click(inside(cardOf('Zweite Kopie'), 'remove-doc'));
      expect(qa('needs-card').map((c) => text(inside(c, 'needs-name')))).toEqual([
        'Bürobedarf Schulz',
      ]);
      expect(demo.documents().some((d) => d.id === 'x2')).toBe(false);
      expect(el.textContent).not.toContain('Zweite Kopie');
    });

    it('fixing the last card hides the box', async () => {
      demo.updateDocument('wd-d1', (d) => ({ ...d, amountCents: 3000 }));
      await render();
      expect(q('needs-you-box')).toBeNull();
      expect(text(rowOf('Bürobedarf Schulz'))).toContain(formatMoney(3000, 'en'));
    });

    it('needs-you sentences follow the language', async () => {
      await render();
      expect(text(inside(cardOf('Schulz'), 'needs-sentence'))).toBe("We couldn't read the amount.");
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(inside(cardOf('Schulz'), 'needs-sentence'))).toBe(
        'Wir konnten den Betrag nicht lesen.',
      );
      expect(text(q('needs-you-title'))).toBe('Braucht dich · 1');
      expect(text(inside(cardOf('Schulz'), 'type-it-in'))).toBe('Eintippen');
    });

    it('the duplicate sentence and its date follow the language', async () => {
      upload(2);
      await render();
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      const original = demo.documents().find((d) => d.id === 'doc-wd-t2')!;
      expect(text(inside(cardOf('Telekom'), 'needs-sentence'))).toBe(
        `Sieht aus wie der Beleg, den du am ${formatDate(original.addedOn, 'de')} hinzugefügt hast.`,
      );
    });

    it('the search does not filter the Needs-you box', async () => {
      await render();
      await type('studio kern');
      expect(qa('document-row')).toHaveLength(1);
      expect(qa('needs-card')).toHaveLength(1);
      await type('zzz');
      expect(q('empty-no-match')).not.toBeNull();
      expect(qa('needs-card')).toHaveLength(1);
    });
  });

  describe('the list', () => {
    it('the list hides Needs-you documents and shows Studio Kern as Waiting for payment · due 30 Oct', async () => {
      await render();
      const total = demo.documents().length;
      expect(qa('document-row')).toHaveLength(total - 1);
      expect(qa('document-table-row')).toHaveLength(total - 1);
      expect(qa('document-row').some((r) => r.textContent?.includes('Schulz'))).toBe(false);

      const row = rowOf('Studio Kern');
      expect(text(inside(row, 'doc-status'))).toBe('Waiting for payment · due 30 Oct');
      expect(text(inside(row, 'document-meta'))).toBe('Sent · RE-2026-044');
      expect(text(inside(row, 'document-amount'))).toBe(formatMoney(238000, 'en'));
    });

    it('Bäckerei Lange shows Overdue since 30 Sep', async () => {
      await render();
      const status = text(inside(rowOf('Bäckerei Lange'), 'doc-status'));
      expect(status).toMatch(/^Overdue since 30 Sep/);
      expect(status).toBe(`Overdue since ${formatDate('2026-09-30', 'en')}`);
      expect(inside(rowOf('Bäckerei Lange'), 'doc-status')!.classList).toContain('text-negative');
      const tableRow = qa('document-table-row').find((r) => r.textContent?.includes('Lange'))!;
      expect(text(inside(tableRow, 'doc-status'))).toBe(status);
    });

    it('a received document shows its date and a linked one is Done', async () => {
      await render();
      const row = rowOf('Böttcher');
      expect(text(inside(row, 'document-meta'))).toBe(
        `Received · ${formatDate('2026-10-08', 'en')}`,
      );
      expect(text(inside(row, 'doc-status'))).toBe('Waiting for payment');
      const done = qa('document-row').filter((r) => text(inside(r, 'doc-status')) === 'Done');
      expect(done.length).toBeGreaterThan(0);
    });

    it('groups by month, newest first, with the month names', async () => {
      await render();
      const months = groupDocsByMonth(demo.documents().filter((d) => !docNeedsYou(d))).map(
        (g) => g.month,
      );
      expect(months.slice(0, 2)).toEqual(['2026-10', '2026-09']);
      const titles = qa('document-month-title').map((t) => text(t));
      expect(titles).toEqual(months.map((m) => formatMonth(m, 'en')));
      expect(titles[0]).toBe('October 2026');
      expect(qa('document-table-month-title').map((t) => text(t))).toEqual(titles);
      const first = qa('document-month-group')[0];
      expect(first.querySelectorAll('[data-testid="document-row"]').length).toBeGreaterThan(1);
    });

    it('amounts have no sign and no colour, and a document that is still read shows a dash', async () => {
      demo.addDocument('weber-design', newReadingDoc('up-9', 'scan.pdf', 'file'));
      await render();
      const row = rowOf('Studio Kern');
      const amount = inside(row, 'document-amount')!;
      expect(amount.textContent).not.toContain('+');
      expect(amount.textContent).not.toContain('-');
      expect(amount.className).not.toMatch(/text-(positive|negative|warning)/);
      expect(amount.closest('bdi')!.getAttribute('dir')).toBe('ltr');

      const reading = rowOf('scan.pdf');
      expect(text(inside(reading, 'document-amount'))).toBe('—');
      expect(text(inside(reading, 'doc-status'))).toBe('Reading…');
      expect(text(inside(reading, 'document-name'))).toBe('scan.pdf');
      expect(inside(reading, 'document-name')!.querySelector('bdi')!.getAttribute('dir')).toBe(
        'ltr',
      );
    });

    it('names truncate with dir auto, and invoice numbers and amounts are left-to-right', async () => {
      await render();
      for (const name of qa('document-name')) {
        expect(name.classList).toContain('truncate');
        expect(name.getAttribute('dir')).toBe('auto');
      }
      // in the table a name has a cell to itself: the cell keeps the page direction, only the name inside is isolated
      expect(qa('document-table-name').length).toBeGreaterThan(0);
      for (const cell of qa('document-table-name')) {
        expect(cell.hasAttribute('dir')).toBe(false);
        const inner = cell.querySelector<HTMLElement>('[dir="auto"]')!;
        expect(inner.classList).toContain('truncate');
        expect(cell.textContent?.trim()).toBe(inner.textContent?.trim());
      }
      const invoice = inside(rowOf('Studio Kern'), 'document-meta')!.querySelector('bdi')!;
      expect(invoice.getAttribute('dir')).toBe('ltr');
      expect(invoice.textContent?.trim()).toBe('RE-2026-044');
      for (const amount of qa('document-table-amount')) {
        expect(amount.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      }
    });

    it('the table has date, name, type, status and amount, and shows Received or Sent', async () => {
      await render();
      const heads = Array.from(q('document-table')!.querySelectorAll('thead th')).map((th) =>
        text(th),
      );
      expect(heads).toEqual(['Date', 'Name', 'Type', 'Status', 'Amount']);
      const row = qa('document-table-row').find((r) => r.textContent?.includes('Studio Kern'))!;
      expect(text(inside(row, 'document-table-type'))).toBe('Sent');
      expect(text(row)).toContain(formatDate('2026-10-16', 'en'));
      const bahn = qa('document-table-row').find((r) => r.textContent?.includes('Böttcher'))!;
      expect(text(inside(bahn, 'document-table-type'))).toBe('Received');
    });

    it('shows the phone list and the computer table, each hidden where the other shows', async () => {
      await render();
      expect(q('document-table')!.parentElement!.classList).toContain('lg:block');
      expect(q('document-table')!.parentElement!.classList).toContain('hidden');
      expect(qa('document-row')[0].closest('app-document-list')!.classList).toContain('lg:hidden');
    });

    it('search finds by name, invoice number and amount', async () => {
      await render();
      await type('böttcher');
      expect(qa('document-row').map((r) => text(inside(r, 'document-name')))).toEqual([
        'Böttcher Bürobedarf',
      ]);
      await type('RE-2026-039');
      expect(qa('document-row').map((r) => text(inside(r, 'document-name')))).toEqual([
        'Bäckerei Lange',
      ]);
      await type('2.380,00');
      expect(qa('document-row').map((r) => text(inside(r, 'document-name')))).toEqual([
        'Studio Kern',
      ]);
      expect(qa('document-table-row')).toHaveLength(1);
    });

    it('a search with no match says so and Clear search brings the list back', async () => {
      await render();
      const total = qa('document-row').length;
      await type('zzz');
      expect(qa('document-row')).toHaveLength(0);
      expect(qa('document-table-row')).toHaveLength(0);
      expect(text(q('empty-no-match'))).toContain('No documents match your search');
      expect(text(q('clear-search'))).toBe('Clear search');
      await click(q('clear-search'));
      expect(q('empty-no-match')).toBeNull();
      expect(qa('document-row')).toHaveLength(total);
      expect((q('document-search') as HTMLInputElement).value).toBe('');
    });

    it('starts the search over when another business opens', async () => {
      await render();
      await type('zzz');
      demo.setBusiness('cafe-linde');
      await settle();
      expect(q('empty-no-match')).toBeNull();
      expect((q('document-search') as HTMLInputElement).value).toBe('');
      expect(qa('document-row').length).toBeGreaterThan(0);
    });

    it('Café Linde has no Needs-you box, and everything is Done but the invoice to Kanzlei Hoffmann, overdue', async () => {
      demo.setBusiness('cafe-linde');
      await render();
      expect(q('needs-you-box')).toBeNull();
      const statuses = qa('document-row').map((r) => text(inside(r, 'doc-status')));
      expect(statuses.length).toBeGreaterThan(0);
      expect(new Set(statuses)).toEqual(new Set(['Done', 'Overdue since 9 Oct']));
      expect(statuses.filter((status) => status !== 'Done')).toEqual(['Overdue since 9 Oct']);
    });
  });

  describe('setup states', () => {
    it('new-client state shows the ways to add', async () => {
      demo.setSetup('new');
      await render();
      const empty = q('empty-new')!;
      expect(text(empty)).toContain('Add your first document');
      const ways = qa('empty-new-way');
      expect(ways.map((w) => text(inside(w, 'add-way-title')))).toEqual([
        'Take a photo',
        'Choose a file',
        'Forward by email',
      ]);
      // Taking a photo is for phones; a computer is offered the other two.
      expect(ways.map((w) => w.classList.contains('lg:hidden'))).toEqual([true, false, false]);
      expect(text(ways[0])).toContain('Several pages become one document');
      expect(text(ways[1])).toContain('PDF, JPG, PNG or e-invoice (XML), up to 20 MB');
      const email = ways[2].querySelector('bdi')!;
      expect(email.getAttribute('dir')).toBe('ltr');
      expect(email.textContent?.trim()).toBe('weber-design@inbox.example');
      expect(qa('document-row')).toHaveLength(0);
      expect(qa('document-table-row')).toHaveLength(0);
      expect(q('needs-you-box')).toBeNull();
      expect(q('empty-no-match')).toBeNull();
      expect(q('add-button')).not.toBeNull();
      expect(q('inbox-line')).not.toBeNull();
    });

    it('a document added in the new-client state shows, and the empty state goes', async () => {
      demo.setSetup('new');
      addDoc({ id: 'up-1', fromUpload: true, name: 'Copyshop Mitte', invoiceNo: 'B-1' });
      await render();
      expect(q('empty-new')).toBeNull();
      expect(qa('document-row')).toHaveLength(1);
      expect(text(inside(qa('document-row')[0], 'doc-status'))).toBe('Waiting for payment');
    });

    it('a document that needs you shows in the box in the new-client state', async () => {
      demo.setSetup('new');
      addDoc({ id: 'up-1', fromUpload: true, name: 'Krause', direction: null });
      await render();
      expect(qa('needs-card')).toHaveLength(1);
      expect(q('empty-new')).toBeNull();
      expect(qa('document-row')).toHaveLength(0);
      expect(q('empty-no-match')).toBeNull();
    });

    it('halfway client sees the sample documents', async () => {
      demo.setSetup('halfway');
      await render();
      expect(q('empty-new')).toBeNull();
      expect(qa('document-row').length).toBeGreaterThan(0);
    });
  });

  describe('opened document', () => {
    it('rows open the document', async () => {
      await render();
      const row = rowOf('Studio Kern');
      expect(row.getAttribute('href')).toBe('/documents/wd-d2');
      const link = qa('document-table-name').find((r) => r.textContent?.includes('Studio Kern'))!;
      expect(link.getAttribute('href')).toBe('/documents/wd-d2');
      expect(link.classList).toContain('after:absolute');
      expect(link.closest('tr')!.classList).toContain('relative');

      await click(row);
      expect(TestBed.inject(Router).url).toBe('/documents/wd-d2');
      expect(text(q('document-detail-name'))).toBe('Studio Kern');
    });

    it('Type it in opens the document', async () => {
      await render();
      await click(inside(cardOf('Schulz'), 'type-it-in'));
      expect(TestBed.inject(Router).url).toBe('/documents/wd-d1');
      expect(text(q('document-detail-name'))).toBe('Bürobedarf Schulz');
    });

    it('highlights the selected row in list and table and hides the list below lg', async () => {
      await render('/documents/wd-d2');
      const selected = [...qa('document-row'), ...qa('document-table-row')].filter(
        (r) => r.getAttribute('aria-current') === 'true',
      );
      expect(selected).toHaveLength(2);
      for (const row of selected) expect(row.textContent).toContain('Studio Kern');
      expect(q('documents-list')!.classList).toContain('hidden');
      expect(q('documents-list')!.classList).toContain('lg:flex');
      expect(q('documents-detail')!.classList).not.toContain('hidden');
    });

    it('keeps the list visible when no document is open', async () => {
      await render();
      expect(
        [...qa('document-row'), ...qa('document-table-row')].some((r) =>
          r.hasAttribute('aria-current'),
        ),
      ).toBe(false);
      expect(q('documents-list')!.classList).not.toContain('hidden');
      expect(q('documents-detail')!.classList).toContain('hidden');
    });

    it('moves the highlight when another document opens', async () => {
      await render('/documents/wd-d2');
      await harness.navigateByUrl('/documents/wd-d3');
      await settle();
      const selected = qa('document-row').filter((r) => r.getAttribute('aria-current') === 'true');
      expect(selected).toHaveLength(1);
      expect(selected[0].textContent).toContain('Bäckerei Lange');
    });

    it('keeps the search while a document is open and after going back', async () => {
      await render();
      await type('studio');
      await click(qa('document-row')[0]);
      expect((q('document-search') as HTMLInputElement).value).toBe('studio');
      await click(q('back-link'));
      expect(TestBed.inject(Router).url).toBe('/documents');
      expect((q('document-search') as HTMLInputElement).value).toBe('studio');
      expect(qa('document-row')).toHaveLength(1);
    });

    it('an unknown document goes back to the list', async () => {
      await render('/documents/nope');
      await settle();
      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('keeps the panel in view on computers: sticky, and scrolling on its own when taller than the screen', async () => {
      await render('/documents/wd-d2');
      const panel = q('documents-detail')!.classList;
      for (const name of [
        'lg:sticky',
        'lg:top-6',
        'lg:max-h-[calc(100dvh-3rem)]',
        'lg:overflow-y-auto',
      ]) {
        expect(panel, name).toContain(name);
      }
    });
  });

  describe('adding documents', () => {
    const MB_25 = 25 * 1024 * 1024;
    const inBody = (testId: string) =>
      document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

    /** A file as the browser hands it over; only its name and size matter here. */
    function file(name: string, size = 1000): File {
      return Object.defineProperty(new File(['x'], name), 'size', { value: size });
    }

    /** Hands files to one of the hidden file inputs the way the browser does once the person has picked them. */
    function choose(testId: string, files: File[]): void {
      const input = q(testId) as HTMLInputElement;
      Object.defineProperty(input, 'files', { configurable: true, value: files });
      input.dispatchEvent(new Event('change'));
    }

    /** Sends a drag event for files from the computer, as a browser does. */
    function dragFiles(type: 'dragenter' | 'drop', files: File[]): Event {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { types: ['Files'], items: files.map(() => ({ kind: 'file' })), files },
      });
      document.body.dispatchEvent(event);
      harness.detectChanges();
      return event;
    }

    /** Opens the page the way the sidebar's and the phone bar's Upload receipt do: through the real routes. */
    async function renderShell(): Promise<void> {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
      });
      signInAsSara();
      harness = await RouterTestingHarness.create('/');
      el = harness.routeNativeElement as HTMLElement;
    }

    it('+ Add opens the ways to add: Choose a file and the address on a computer', async () => {
      await render();
      expect(inBody('add-ways')).toBeNull();
      await click(q('add-button'));
      expect(inBody('add-ways')).not.toBeNull();
      expect(text(inBody('add-file'))).toContain('Choose a file');
      expect(inBody('add-email')!.querySelector('bdi')!.textContent?.trim()).toBe(
        'weber-design@inbox.example',
      );
    });

    it('the menu and the empty state offer the same ways, from one source', async () => {
      demo.setSetup('new');
      await render();
      const titles = (nodes: Element[]) =>
        nodes.map((n) => text(n.querySelector('[data-testid="add-way-title"]')));
      const onPage = titles(qa('empty-new-way'));
      await click(q('add-button'));
      const inMenu = titles(Array.from(inBody('add-ways')!.querySelectorAll('li')));
      expect(inMenu).toEqual(onPage);
      expect(inMenu).toEqual(['Take a photo', 'Choose a file', 'Forward by email']);
    });

    it('?add=1 opens the menu on arrival and then leaves the address', async () => {
      await render('/documents?add=1');
      await settle();
      expect(inBody('add-ways')).not.toBeNull();
      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('Upload receipt opens Documents with the Add menu open', async () => {
      await renderShell();
      const link = el.querySelector<HTMLAnchorElement>('aside a[href="/documents?add=1"]')!;
      expect(link.textContent).toContain('Upload receipt');
      link.click();
      await settle();
      await settle();
      expect(text(q('documents-list')!.querySelector('h1'))).toBe('Documents');
      expect(inBody('add-ways')).not.toBeNull();
      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('the phone bar Upload receipt opens it too, also when Documents is already open', async () => {
      await renderShell();
      const camera = () =>
        el.querySelector<HTMLAnchorElement>(
          '[data-testid="bottom-bar"] a[aria-label="Upload receipt"]',
        )!;
      camera().click();
      await settle();
      await settle();
      expect(inBody('add-ways')).not.toBeNull();

      // Close it and ask again from the bar.
      el.querySelector<HTMLElement>('[data-testid="add-button"]')!.click();
      await settle();
      expect(inBody('add-ways')).toBeNull();
      camera().click();
      await settle();
      await settle();
      expect(inBody('add-ways')).not.toBeNull();
      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('choosing two files shows Reading… then the summary', async () => {
      await render();
      await click(q('add-button'));
      await click(inBody('add-file'));
      vi.useFakeTimers();
      choose('file-input', [file('a.pdf'), file('b.pdf')]);
      harness.detectChanges();

      expect(text(q('upload-line'))).toBe('Reading 2 documents…');
      expect(demo.documents().filter((d) => d.reading)).toHaveLength(2);
      vi.advanceTimersByTime(READING_MS);
      harness.detectChanges();
      // Deutsche Bahn links itself to its payment; the Telekom duplicate waits for the person.
      expect(text(q('upload-line'))).toBe('2 documents added · 1 needs you');
      expect(demo.documents().filter((d) => d.reading)).toHaveLength(0);
    });

    it('a photo is added like a file', async () => {
      await render();
      vi.useFakeTimers();
      choose('photo-input', [file('IMG_1.jpg')]);
      harness.detectChanges();
      expect(demo.documents().find((d) => d.fileName === 'IMG_1.jpg')!.source).toBe('photo');
      vi.advanceTimersByTime(READING_MS);
      harness.detectChanges();
      expect(text(q('upload-line'))).toBe('1 document added · all sorted');
    });

    it('dropping mixed files adds the good ones and lists the rest', async () => {
      screenIs(true);
      await render();
      vi.useFakeTimers();
      const before = demo.documents().length;
      const dropped = dragFiles('drop', [
        file('notes.docx'),
        file('big.pdf', MB_25),
        file('a.pdf'),
        file('b.pdf'),
      ]);

      expect(dropped.defaultPrevented).toBe(true);
      expect(demo.documents()).toHaveLength(before + 2);
      expect(
        demo
          .documents()
          .filter((d) => d.fromUpload)
          .map((d) => d.fileName)
          .sort(),
      ).toEqual(['a.pdf', 'b.pdf']);
      expect(text(q('upload-line'))).toBe('Reading 2 documents…');
      expect(qa('upload-refused').map((line) => text(line))).toEqual([
        'notes.docx — only PDF, JPG, PNG or XML',
        'big.pdf — over 20 MB',
      ]);

      vi.advanceTimersByTime(READING_MS);
      harness.detectChanges();
      expect(text(q('upload-line'))).toBe('2 documents added · 1 needs you');
      expect(qa('upload-refused')).toHaveLength(2);
    });

    it('dragging files over the page shows the drop overlay on a computer', async () => {
      screenIs(true);
      await render();
      expect(q('drop-overlay')).toBeNull();
      dragFiles('dragenter', [file('a.pdf'), file('b.pdf'), file('c.pdf')]);
      expect(text(q('drop-overlay'))).toContain('Drop to add 3 files');
    });

    it('the message sits at the top of the list, above the Needs-you box', async () => {
      await render();
      vi.useFakeTimers();
      choose('file-input', [file('a.pdf')]);
      harness.detectChanges();
      const position = q('upload-message')!.compareDocumentPosition(q('needs-you-box')!);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('the cross closes the message', async () => {
      await render();
      vi.useFakeTimers();
      choose('file-input', [file('notes.docx')]);
      harness.detectChanges();
      expect(q('upload-message')).not.toBeNull();
      q('upload-dismiss')!.click();
      harness.detectChanges();
      expect(q('upload-message')).toBeNull();
    });

    it('Reset demo clears the message', async () => {
      await render();
      vi.useFakeTimers();
      choose('file-input', [file('a.pdf'), file('notes.docx')]);
      harness.detectChanges();
      vi.advanceTimersByTime(READING_MS);
      harness.detectChanges();
      expect(q('upload-message')).not.toBeNull();

      demo.resetData();
      harness.detectChanges();
      expect(q('upload-message')).toBeNull();
      expect(demo.documents().some((d) => d.fromUpload)).toBe(false);
    });
  });

  describe('scrolling when a document opens', () => {
    const root = () => document.documentElement;

    beforeEach(() => {
      root().scrollTop = 600;
    });

    afterEach(() => {
      root().scrollTop = 0;
    });

    it('on a phone, a document opens at the top of the page', async () => {
      screenIs(false);
      await render();
      expect(root().scrollTop).toBe(600);
      await click(rowOf('Studio Kern'));
      expect(root().scrollTop).toBe(0);
    });

    it('on a computer, the page stays where it is when a document opens', async () => {
      screenIs(true);
      await render();
      await click(rowOf('Studio Kern'));
      expect(root().scrollTop).toBe(600);
    });
  });
});
