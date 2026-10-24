import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { SampleStatement } from '../data/models';
import { sampleStatementFor } from '../data/sample-statements';
import { isClosedDate } from '../domain/months';
import { DemoStateService } from '../state/demo-state.service';
import { IMPORT_MS, StatementImportService } from '../state/statement-import.service';
import { PaymentDetailPage } from './payment-detail.page';
import { PaymentsPage } from './payments.page';
import { StatementImportPage } from './statement-import.page';

@Component({ template: '<p data-testid="stub">stub</p>' })
class Stub {}

describe('StatementImportPage', () => {
  let demo: DemoStateService;
  let service: StatementImportService;
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
          { path: 'payments/import', component: StatementImportPage },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
          { path: 'review', component: Stub },
          { path: 'settings', component: Stub },
          { path: '', pathMatch: 'full', component: Stub },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    service = TestBed.inject(StatementImportService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
  }

  async function settle(): Promise<void> {
    const open = harness!;
    open.detectChanges();
    await open.fixture.whenStable();
    open.detectChanges();
    el = open.routeNativeElement as HTMLElement;
  }

  /** The text of a node, its pieces separated by one space. */
  const text = (node: Element | null | undefined): string => {
    const pieces: string[] = [];
    const walk = (current: Node): void => {
      if (current.nodeType === Node.TEXT_NODE) pieces.push(current.textContent ?? '');
      else current.childNodes.forEach(walk);
    };
    if (node) walk(node);
    return pieces.join(' ').replace(/\s+/g, ' ').trim();
  };
  /** The text as it reads in a sentence: a German term inside it keeps its brackets together ("bank statement (Kontoauszug)"). */
  const flat = (node: Element | null | undefined): string =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const button = (testId: string) => q(testId) as HTMLButtonElement;
  const payments = () => demo.business().transactions;

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  }

  async function choose(testId: string, value: string): Promise<void> {
    const select = q(testId) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  async function type(testId: string, value: string): Promise<void> {
    const field = q(testId) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  /** A drop of files the way a browser sends it; jsdom has no DragEvent or DataTransfer, so the transfer is made up. */
  function drop(target: Element, files: File[]): Event {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { types: ['Files'], files, items: files.map(() => ({ kind: 'file' })) },
    });
    target.dispatchEvent(event);
    return event;
  }

  /** Opens the import of an account of Café Linde, reads its sample file and imports it. */
  async function importCafe(): Promise<void> {
    vi.useFakeTimers();
    demo.setBusiness('cafe-linde');
    await render('/payments/import?account=cl-sparkasse&from=payments');
    await click('use-sample');
    await click('import-button');
    await advance(IMPORT_MS);
  }

  describe('one screen for an account', () => {
    beforeEach(() => demo.setBusiness('cafe-linde'));

    it('starts with the account, the drop zone and nothing read yet', async () => {
      await render('/payments/import?account=cl-sparkasse&from=payments');
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(text(q('step-title'))).toBe('Import a bank statement');
      expect(text(q('into'))).toMatch(/^Into: Sparkasse · Business account · DE\d\d … \d{4}$/);
      expect(text(q('into-iban'))).toMatch(/^DE\d\d … \d{4}$/);
      expect(text(q('drop-zone'))).toContain('Drop the file from your online banking here');
      expect(text(q('choose-file'))).toBe('choose a file');
      expect(text(q('use-sample'))).toBe('Use a sample statement');
      expect(q('read')).toBeNull();
      expect(q('import-button')).toBeNull();
    });

    it('names a bank statement with its German word, which explains itself', async () => {
      await render('/payments/import?account=cl-sparkasse&from=payments');
      const intro = q('intro')!;
      expect(flat(intro)).toBe(
        'Add payments from the bank statement (Kontoauszug) of your online banking. Payments that are here already are skipped.',
      );
      expect(intro.querySelector('app-term')).not.toBeNull();
    });

    it('cafe import screen shows Sparkasse CSV, 5 new, 2 already here, see which', async () => {
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      expect(text(q('read-file'))).toBe('File sparkasse-oktober.csv');
      expect(text(q('format-chip'))).toBe('Recognised: Sparkasse CSV');
      expect(text(q('read-count'))).toBe('7 payments in the file');
      expect(text(q('read-range'))).toBe('5 Oct – 21 Oct');
      expect(text(q('count-new'))).toBe('New 5');
      expect(text(q('count-already'))).toBe('Already here, skipped 2');
      expect(q('count-closed')).toBeNull();
      expect(q('columns')).toBeNull();
      expect(text(button('import-button'))).toBe('Import 5 payments');
      expect(button('import-button').disabled).toBe(false);

      expect(q('which-list')).toBeNull();
      expect(button('see-which').getAttribute('aria-expanded')).toBe('false');
      await click('see-which');
      expect(button('see-which').getAttribute('aria-expanded')).toBe('true');
      const rows = qa('which-row');
      expect(rows.map((row) => text(row.querySelector('[data-testid="which-file"]')))).toEqual([
        'Stadtwerke Hamburg 15 Oct ' + formatMoney(-28740, 'en', { signed: true }),
        'Hausverwaltung Lindenallee 10 Oct ' + formatMoney(-185000, 'en', { signed: true }),
      ]);
      // Each skipped row sits beside the payment it matches, which opens from there.
      expect(rows.map((row) => row.querySelector('a')!.getAttribute('href'))).toEqual([
        '/payments/cl-t3',
        '/payments/cl-t4',
      ]);
      expect(rows.map((row) => text(row.querySelector('[data-testid="which-match"]')))).toEqual([
        'Stadtwerke Hamburg 15 Oct ' + formatMoney(-28740, 'en', { signed: true }),
        'Hausverwaltung Lindenallee 10 Oct ' + formatMoney(-185000, 'en', { signed: true }),
      ]);
      await click('see-which');
      expect(q('which-list')).toBeNull();
    });

    it('shows the first payments as they will appear: name, date and signed amount', async () => {
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      const rows = qa('first-row');
      expect(rows).toHaveLength(5);
      expect(text(rows[0].querySelector('[data-testid="row-name"]'))).toBe('Kartenumsätze SumUp');
      expect(text(rows[0].querySelector('[data-testid="row-date"]'))).toBe('21 Oct');
      expect(text(rows[0].querySelector('[data-testid="row-amount"]'))).toBe(
        formatMoney(128450, 'en', { signed: true }),
      );
      expect(rows[0].querySelector('[data-testid="row-amount"]')!.className).toContain(
        'text-positive',
      );
      expect(rows[1].querySelector('[data-testid="row-amount"]')!.className).toContain(
        'text-negative',
      );
      // A row the app has already says so.
      expect(text(rows[3].querySelector('[data-testid="row-tag"]'))).toBe('Already here');
      expect(rows[0].querySelector('[data-testid="row-tag"]')).toBeNull();
    });

    it('leaves the payments of a closed month out and says how many', async () => {
      demo.setBusiness('sara-yoga'); // its August is closed
      const [first] = [sampleStatementFor(demo.business(), demo.business().accounts[0], 0)];
      const withAugust: SampleStatement = {
        ...first,
        cells: [
          ...first.cells,
          ['12.08.2026', '12.08.2026', 'DE00', 'Alt GmbH', 'Alte Rechnung', '-10,00', 'S'],
        ],
        meta: [...first.meta, first.meta[0]],
      };
      expect(isClosedDate(demo.business(), '2026-08-12')).toBe(true);
      vi.spyOn(service, 'nextSample').mockReturnValue(withAugust);
      await render('/payments/import?account=sy-qonto&from=payments');
      await click('use-sample');
      expect(text(q('count-new'))).toBe('New 4');
      expect(text(q('count-closed'))).toBe('In a closed month, not imported 1');
      expect(text(button('import-button'))).toBe('Import 4 payments');
    });

    it('Use a sample statement and a dropped file both read the next sample', async () => {
      const next = vi.spyOn(service, 'nextSample');
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenLastCalledWith('cl-sparkasse');

      const event = drop(q('drop-zone')!, [new File(['x'], 'my-bank.csv')]);
      await settle();
      expect(event.defaultPrevented).toBe(true); // the browser must not open the file instead
      expect(next).toHaveBeenCalledTimes(2);

      const input = q('file-input') as HTMLInputElement;
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['y'], 'other.csv')],
      });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(next).toHaveBeenCalledTimes(3);
      expect(text(q('format-chip'))).toBe('Recognised: Sparkasse CSV');
    });

    it('a drop that carries no file is left alone', async () => {
      const next = vi.spyOn(service, 'nextSample');
      await render('/payments/import?account=cl-sparkasse&from=payments');
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { types: ['text/plain'], files: [], items: [] },
      });
      q('drop-zone')!.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });

    it('goes back to where it was opened from, Payments, Settings or home', async () => {
      await render('/payments/import?account=cl-sparkasse&from=payments');
      expect(text(q('back-link'))).toBe('Back to Payments');
      expect(q('back-link')!.getAttribute('href')).toBe('/payments');
      await render('/payments/import?account=cl-sparkasse&from=settings');
      expect(text(q('back-link'))).toBe('Back to Settings');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
      await render('/payments/import?account=cl-sparkasse&from=home');
      expect(text(q('back-link'))).toBe('Back to home');
      expect(q('back-link')!.getAttribute('href')).toBe('/');
    });

    it('lets the person change the account, which starts the file over', async () => {
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      expect(q('read')).not.toBeNull();
      expect(q('change-account')!.getAttribute('href')).toBe('/payments/import?from=payments');
      await render('/payments/import?from=payments');
      expect(q('chooser')).not.toBeNull();
      await render('/payments/import?account=cl-qonto&from=payments');
      expect(q('read')).toBeNull();
    });
  });

  describe('the summary', () => {
    it('import shows the summary with Start and See the payments', async () => {
      vi.useFakeTimers();
      demo.setBusiness('cafe-linde');
      const before = payments().length;
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      await click('import-button');
      // Importing takes a moment: the button says so and cannot be tapped again.
      expect(text(button('import-button'))).toBe('Importing…');
      expect(button('import-button').disabled).toBe(true);
      expect(text(q('import-status'))).toBe('Importing…');
      expect(q('summary')).toBeNull();
      expect(payments()).toHaveLength(before);

      await advance(IMPORT_MS);
      expect(payments()).toHaveLength(before + 5);
      expect(text(q('summary-line'))).toBe('5 added · 3 booked automatically · 2 need you');
      expect(text(q('summary-skipped'))).toBe('2 payments were here already and were skipped.');
      expect(text(q('summary-start'))).toBe('Start');
      expect(q('summary-start')!.getAttribute('href')).toBe('/review');
      expect(text(q('summary-payments'))).toBe('See the payments');
      expect(q('summary-payments')!.getAttribute('href')).toBe('/payments?account=cl-sparkasse');
      expect(text(q('summary-undo'))).toBe('Undo import');
      expect(q('drop-zone')).toBeNull();
      expect(q('import-button')).toBeNull();
      // The cursor is on the summary, so a screen reader reads it out.
      expect(document.activeElement).toBe(q('summary-title'));
    });

    it('Start opens the review inbox', async () => {
      await importCafe();
      vi.useRealTimers(); // the import is done: the page change needs no fake clock
      await click('summary-start');
      expect(router.url).toBe('/review');
    });

    it('See the payments opens Payments with the account chosen', async () => {
      await importCafe();
      vi.useRealTimers();
      await click('summary-payments');
      await vi.waitFor(() => expect(router.url).toBe('/payments'));
      await settle();
      expect((q('filter-account') as HTMLSelectElement).value).toBe('cl-sparkasse');
      expect(text(q('chip-account'))).toContain('Sparkasse');
    });

    it('offers no Start when nothing needs the person', async () => {
      vi.useFakeTimers();
      demo.setBusiness('sara-yoga');
      const sara = sampleStatementFor(demo.business(), demo.business().accounts[0], 0);
      // Her insurance and the bank fee: each has a category and needs no receipt, so both book themselves.
      const booked: SampleStatement = {
        ...sara,
        cells: [sara.cells[1], sara.cells[3]],
        meta: [sara.meta[1], sara.meta[3]],
      };
      vi.spyOn(service, 'nextSample').mockReturnValue(booked);
      await render('/payments/import?account=sy-qonto&from=payments');
      await click('use-sample');
      await click('import-button');
      await advance(IMPORT_MS);
      expect(text(q('summary-line'))).toBe('2 added · 2 booked automatically · 0 need you');
      expect(q('summary-start')).toBeNull();
      // See the payments is then the main button.
      expect(q('summary-payments')!.className).toContain('bg-primary');
    });

    it('undo on the summary removes the import', async () => {
      await importCafe();
      const imported = payments().filter((tx) => tx.id.startsWith('imp-1-'));
      expect(imported).toHaveLength(5);
      expect(demo.business().imports).toHaveLength(1);

      await click('summary-undo');
      expect(payments().filter((tx) => tx.id.startsWith('imp-1-'))).toHaveLength(0);
      expect(demo.business().imports).toHaveLength(0);
      expect(q('summary')).toBeNull();
      expect(text(q('undone'))).toBe('Import undone. 5 payments were taken out again.');
      // Back to the file as it was read: it can be imported again.
      expect(text(q('count-new'))).toBe('New 5');
      expect(text(button('import-button'))).toBe('Import 5 payments');
    });

    it('says so when an import can not be undone any more, and keeps the summary', async () => {
      await importCafe();
      // Someone answers one of the new payments meanwhile.
      demo.updateTransaction('imp-1-r1', (tx) => ({
        ...tx,
        history: [{ date: '2026-10-22', key: 'confirmed', params: {} }, ...tx.history],
      }));
      await click('summary-undo');
      expect(q('summary')).not.toBeNull();
      expect(text(q('undo-blocked'))).toBe(
        "This import can't be undone any more: some payments were worked on.",
      );
      expect(payments().filter((tx) => tx.id.startsWith('imp-1-'))).toHaveLength(5);
    });

    it('shows no summary after a reset during the import', async () => {
      vi.useFakeTimers();
      demo.setBusiness('cafe-linde');
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      await click('import-button');
      demo.resetData();
      await advance(IMPORT_MS);
      expect(q('summary')).toBeNull();
      expect(payments().some((tx) => tx.id.startsWith('imp-'))).toBe(false);
      expect(q('read')).toBeNull(); // the screen starts over with the demo
    });

    it('offers no Undo and no Start for an import that added nothing', async () => {
      demo.setBusiness('cafe-linde');
      // The file's rows were all added behind the page's back, so the import finds nothing new.
      vi.spyOn(service, 'import').mockResolvedValue({
        importId: '',
        added: 0,
        bookedAutomatically: 0,
        needsYou: 0,
        skipped: 7,
      });
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      await click('import-button');
      expect(text(q('summary-line'))).toBe(
        'Nothing was added: every payment in the file was here already.',
      );
      expect(q('summary-undo')).toBeNull();
      expect(q('summary-start')).toBeNull();
      expect(q('summary-skipped')).toBeNull();
      expect(q('summary-payments')).not.toBeNull();
    });

    it('shows no summary, and leaves the screen as it was, when the import comes back with nothing (it was dropped)', async () => {
      demo.setBusiness('cafe-linde');
      vi.spyOn(service, 'import').mockResolvedValue(null);
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      await click('import-button');
      expect(q('summary')).toBeNull();
      expect(q('undone')).toBeNull();
      expect(text(q('count-new'))).toBe('New 5');
      expect(text(button('import-button'))).toBe('Import 5 payments');
      expect(button('import-button').disabled).toBe(false);
    });
  });

  describe('Import is disabled when there is nothing to import', () => {
    it('a file the account has in full says so, with the counts still shown', async () => {
      vi.useFakeTimers();
      demo.setBusiness('cafe-linde');
      const statement = service.nextSample('cl-sparkasse');
      const done = service.import('cl-sparkasse', statement, statement.mapping!);
      await vi.advanceTimersByTimeAsync(IMPORT_MS);
      await done;

      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      expect(text(q('count-new'))).toBe('New 0');
      expect(text(q('count-already'))).toBe('Already here, skipped 7');
      expect(button('import-button').disabled).toBe(true);
      expect(text(q('import-reason'))).toBe('Every payment in this file is here already.');
    });
  });

  describe('an unknown layout', () => {
    beforeEach(() => demo.setBusiness('sara-yoga'));

    const roleOf = (index: number) => (q(`column-select-${index}`) as HTMLSelectElement).value;
    const roles = () => Array.from({ length: 7 }, (_, i) => roleOf(i));

    it("sara's unknown layout needs columns; Import disabled until date, amount and who are matched", async () => {
      vi.useFakeTimers();
      await render('/payments/import?account=sy-qonto&from=payments');
      await click('use-sample');
      expect(text(q('format-chip'))).toBe('Unknown layout');
      expect(q('columns')).not.toBeNull();
      expect(text(q('columns-title'))).toBe('Match the columns');

      // Guessed first: the dates, the name, the text and the signed amount; the rest is ignored.
      const columns = qa('column');
      expect(columns).toHaveLength(7);
      expect(roles()).toEqual(['date', 'ignore', 'ignore', 'who', 'purpose', 'amount', 'ignore']);
      expect(text(columns[0])).toContain('Wertstellung');
      expect(text(columns[0])).toContain('20.10.2026');
      expect(text(columns[5])).toContain('60,00');
      expect(text(q('count-new'))).toBe('New 4');
      expect(button('import-button').disabled).toBe(false);
      expect(q('columns-need')).toBeNull();

      // Without a Who column nothing can be imported, and nothing is counted.
      await choose('column-select-3', 'ignore');
      expect(button('import-button').disabled).toBe(true);
      expect(text(q('columns-need'))).toBe(
        'Choose which column holds the date, the amount and who was paid.',
      );
      expect(q('count-new')).toBeNull();
      expect(q('first-row')).toBeNull();

      await choose('column-select-3', 'who');
      expect(button('import-button').disabled).toBe(false);
      expect(text(q('count-new'))).toBe('New 4');

      // The same for the date and the amount.
      await choose('column-select-0', 'ignore');
      expect(button('import-button').disabled).toBe(true);
      await choose('column-select-1', 'date'); // Valuta holds the same dates
      expect(button('import-button').disabled).toBe(false);
      await choose('column-select-5', 'ignore');
      expect(button('import-button').disabled).toBe(true);
      await choose('column-select-5', 'amount');
      expect(button('import-button').disabled).toBe(false);
    });

    it('updates the first payments when a column changes meaning', async () => {
      await render('/payments/import?account=sy-qonto&from=payments');
      await click('use-sample');
      expect(text(qa('first-row')[0].querySelector('[data-testid="row-name"]'))).toBe(
        'Bettina Schulz',
      );
      // What for as the name: the preview follows.
      await choose('column-select-4', 'who');
      expect(roleOf(3)).toBe('ignore'); // one column for each meaning
      expect(text(qa('first-row')[0].querySelector('[data-testid="row-name"]'))).toBe(
        'Privatstunde 18.10.',
      );
    });

    it('reads money out from its own column when told so, and needs that column', async () => {
      await render('/payments/import?account=sy-qonto&from=payments');
      await click('use-sample');
      expect(q('money-out-minus')!.querySelector('input')!.checked).toBe(true);
      expect(
        Array.from((q('column-select-0') as HTMLSelectElement).options).map((o) => o.value),
      ).toEqual(['date', 'amount', 'who', 'purpose', 'ignore']);

      q('money-out-column')!.querySelector('input')!.click();
      await settle();
      expect(
        Array.from((q('column-select-0') as HTMLSelectElement).options).map((o) => o.value),
      ).toEqual(['date', 'amount', 'amountOut', 'who', 'purpose', 'ignore']);
      expect(text((q('column-select-5') as HTMLSelectElement).selectedOptions[0])).toBe('Money in');
      expect(button('import-button').disabled).toBe(true);
      expect(text(q('columns-need'))).toBe('Choose the column that holds money out too.');

      // Money out is the Name column here, which makes no sense, but proves the setting: the cell with text cannot be read.
      await choose('column-select-2', 'amountOut');
      expect(button('import-button').disabled).toBe(false);

      q('money-out-minus')!.querySelector('input')!.click();
      await settle();
      expect(roleOf(2)).toBe('ignore'); // a money out column has no use with a minus sign
      expect(button('import-button').disabled).toBe(false);
      expect(text(q('count-new'))).toBe('New 4');
    });

    it('imports with the columns the person matched', async () => {
      vi.useFakeTimers();
      await render('/payments/import?account=sy-qonto&from=payments');
      await click('use-sample');
      await click('import-button');
      await advance(IMPORT_MS);
      expect(text(q('summary-line'))).toMatch(/^4 added · \d booked automatically · \d need you$/);
      expect(
        payments().filter((tx) => tx.accountId === 'sy-qonto' && tx.id.startsWith('imp-1-')),
      ).toHaveLength(4);
    });
  });

  describe('which account', () => {
    it('lists the statement accounts, the connected ones with Add older months, and A new account', async () => {
      demo.setBusiness('cafe-linde');
      await render('/payments/import?from=payments');
      expect(text(q('step-title'))).toBe('Import a bank statement');
      expect(text(q('chooser-title'))).toBe('Which account is it for?');
      expect(qa('chooser-row').map((row) => row.getAttribute('data-account'))).toEqual([
        'cl-sparkasse',
        'cl-qonto',
      ]);
      expect(text(q('choose-cl-sparkasse'))).toContain('Sparkasse · Business account');
      expect(text(q('choose-cl-sparkasse'))).toContain('Payments come from statements');
      expect(text(q('choose-cl-qonto'))).toContain('Qonto · Business account');
      expect(text(q('choose-cl-qonto'))).toContain('Add older months');
      expect(text(q('choose-new'))).toContain('A new account…');
      expect(q('choose-cl-sparkasse')!.getAttribute('href')).toBe(
        '/payments/import?account=cl-sparkasse&from=payments',
      );
      expect(q('choose-new')!.getAttribute('href')).toBe('/payments/import?new=1&from=payments');
      expect(q('choose-cl-cash')).toBeNull(); // the cash box has no statement
      expect(q('drop-zone')).toBeNull();
    });

    it('opens the import of the account that is tapped, a connected one too', async () => {
      demo.setBusiness('cafe-linde');
      await render('/payments/import?from=payments');
      await click('choose-cl-qonto');
      expect(router.url).toBe('/payments/import?account=cl-qonto&from=payments');
      expect(text(q('into'))).toContain('Qonto · Business account');
      expect(q('drop-zone')).not.toBeNull();
    });

    it('lists only A new account while the bank is not connected, and the accounts of a business made here: none', async () => {
      demo.setBusiness('weber-design');
      demo.setSetup('new');
      await render('/payments/import?from=payments');
      expect(qa('chooser-row')).toHaveLength(0);
      expect(q('choose-new')).not.toBeNull();
    });

    it('an account that is not one of the open business starts the account choice, and so does the cash box', async () => {
      demo.setBusiness('cafe-linde');
      await render('/payments/import?account=wd-qonto&from=payments');
      expect(q('chooser')).not.toBeNull();
      await render('/payments/import?account=cl-cash&from=payments');
      expect(q('chooser')).not.toBeNull();
    });
  });

  describe('a new account', () => {
    beforeEach(() => demo.setBusiness('weber-design'));

    it("my bank isn't listed asks for name and IBAN, creates a statement account and opens its import", async () => {
      await render('/payments/import?new=1&from=settings');
      expect(text(q('step-title'))).toBe('Import a bank statement');
      expect(text(q('new-title'))).toBe('A new account');
      expect(q('new-iban')!.getAttribute('dir')).toBe('ltr');
      const before = demo.business().accounts.map((a) => a.id);

      await type('new-name', 'Volksbank');
      await type('new-iban', 'de02 1203 0000 0000 2020 51');
      await click('new-continue');

      const added = demo.business().accounts.filter((a) => !before.includes(a.id));
      expect(added).toHaveLength(1);
      expect(added[0]).toMatchObject({
        id: 'weber-design-statement-1',
        kind: 'bank',
        name: 'Volksbank',
        product: 'business',
        iban: 'DE02120300000000202051',
        balanceCents: 0,
        connection: {
          kind: 'statement',
          consentUntil: null,
          lastFetched: null,
          fetchFrom: null,
          broken: false,
        },
      });
      expect(demo.business().accounts.at(-1)!.kind).toBe('cash'); // in front of the cash box
      expect(router.url).toBe('/payments/import?account=weber-design-statement-1&from=settings');
      expect(q('new-account-form')).toBeNull();
      expect(text(q('into'))).toBe('Into: Volksbank · Business account · DE02 … 2051');

      // Its import: a CAMT file, which needs no matching.
      await click('use-sample');
      expect(flat(q('format-chip'))).toBe('Recognised: Bank standard (CAMT)');
      expect(q('format-chip')!.querySelector('app-term')).not.toBeNull();
      expect(q('columns')).toBeNull();
      expect(text(q('read-count'))).toBe('4 payments in the file');
      expect(text(q('count-new'))).toBe('New 4');
    });

    it('creates the account once, however often Continue is tapped', async () => {
      await render('/payments/import?new=1&from=settings');
      await type('new-name', 'Volksbank');
      await type('new-iban', 'DE02120300000000202051');
      const before = demo.business().accounts.length;
      (q('new-account-form') as HTMLFormElement).dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      (q('new-account-form') as HTMLFormElement).dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await settle();
      expect(demo.business().accounts).toHaveLength(before + 1);
    });

    it('asks for a name and an IBAN that is shaped like one, and keeps what was typed', async () => {
      await render('/payments/import?new=1&from=settings');
      const before = demo.business().accounts.length;
      await click('new-continue');
      expect(text(q('new-error-name'))).toBe('Give the account a name.');
      expect(text(q('new-error-iban'))).toBe(
        "This doesn't look like an IBAN. Check it and try again.",
      );
      expect(q('new-name')!.getAttribute('aria-invalid')).toBe('true');
      expect(q('new-iban')!.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(q('new-name'));
      expect(demo.business().accounts).toHaveLength(before);

      await type('new-name', '  Volksbank ');
      expect(q('new-error-name')).toBeNull(); // the message goes as soon as the field is changed
      await type('new-iban', 'DE12 3456');
      await click('new-continue');
      expect(q('new-error-name')).toBeNull();
      expect(text(q('new-error-iban'))).toContain("doesn't look like an IBAN");
      expect(document.activeElement).toBe(q('new-iban'));
      expect((q('new-name') as HTMLInputElement).value).toBe('  Volksbank ');
      expect(demo.business().accounts).toHaveLength(before);

      await type('new-iban', 'DE02 1203 0000 0000 2020 51');
      await click('new-continue');
      expect(demo.business().accounts).toHaveLength(before + 1);
      expect(demo.business().accounts.find((a) => a.name === 'Volksbank')).toBeDefined(); // trimmed
    });

    it('gives a second account of the business an id of its own', async () => {
      await render('/payments/import?new=1&from=settings');
      await type('new-name', 'Volksbank');
      await type('new-iban', 'DE02120300000000202051');
      await click('new-continue');
      await render('/payments/import?new=1&from=settings');
      await type('new-name', 'Sparda-Bank');
      await type('new-iban', 'DE02120300000000202051');
      await click('new-continue');
      expect(
        demo
          .business()
          .accounts.filter((a) => a.connection.kind === 'statement')
          .map((a) => a.id),
      ).toEqual(['weber-design-statement-1', 'weber-design-statement-2']);
    });

    it('imports into the new account: its payments are there and the bank step is done', async () => {
      demo.setSetup('new');
      await render('/payments/import?new=1&from=settings');
      await type('new-name', 'Volksbank');
      await type('new-iban', 'DE02120300000000202051');
      await click('new-continue');
      expect(demo.setup().bank).toBe(false); // making the account does not tick it: importing does
      vi.useFakeTimers(); // the page change is done: the import needs a clock to wait on
      await click('use-sample');
      await click('import-button');
      await advance(IMPORT_MS);
      expect(demo.setup().bank).toBe(true);
      expect(text(q('summary-line'))).toBe('4 added · 3 booked automatically · 1 needs you');
      expect(payments().filter((tx) => tx.accountId === 'weber-design-statement-1')).toHaveLength(
        4,
      );
    });
  });

  describe('start over', () => {
    it('forgets the file when another business opens', async () => {
      demo.setBusiness('cafe-linde');
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      expect(q('read')).not.toBeNull();
      demo.setBusiness('sara-yoga');
      await settle();
      expect(q('read')).toBeNull();
      expect(q('chooser')).not.toBeNull(); // cl-sparkasse is not an account of Sara's business
    });
  });

  describe('in Arabic', () => {
    it('amounts, dates and IBAN are ltr in Arabic', async () => {
      demo.setBusiness('cafe-linde');
      await render('/payments/import?from=payments');
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(document.documentElement.dir).toBe('rtl');
      for (const iban of qa('chooser-iban'))
        expect(iban.closest('bdi[dir="ltr"]'), text(iban)).not.toBeNull();
      expect(qa('chooser-iban').length).toBeGreaterThan(0);

      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      await click('see-which');
      const ltr = (node: Element | null) =>
        node?.closest('bdi[dir="ltr"]') !== null && node !== null;
      expect(ltr(q('into-iban'))).toBe(true);
      expect(ltr(q('read-range'))).toBe(true);
      expect(qa('row-date').length).toBeGreaterThan(0);
      for (const date of qa('row-date')) expect(ltr(date), text(date)).toBe(true);
      expect(qa('row-amount').length).toBeGreaterThan(0);
      for (const amount of qa('row-amount')) expect(ltr(amount), text(amount)).toBe(true);
      expect(qa('which-row')).toHaveLength(2);
      for (const part of [
        ...qa('which-date'),
        ...qa('which-amount'),
        ...qa('which-match-date'),
        ...qa('which-match-amount'),
      ]) {
        expect(ltr(part), text(part)).toBe(true);
      }
      // The file's name and the cells of a column are left-to-right too.
      expect(ltr(q('read-file-name'))).toBe(true);
    });

    it("an unknown layout's cells and headers stay left-to-right in Arabic", async () => {
      demo.setBusiness('sara-yoga');
      await render('/payments/import?account=sy-qonto&from=payments');
      TestBed.inject(LanguageService).setLang('ar');
      await click('use-sample');
      for (const cell of qa('column-sample'))
        expect(cell.closest('bdi[dir="ltr"]'), text(cell)).not.toBeNull();
      expect(qa('column-sample').length).toBeGreaterThan(0);
    });

    it('amounts on the summary and in the new account form are ltr, and every text is translated', async () => {
      vi.useFakeTimers();
      demo.setBusiness('cafe-linde');
      TestBed.inject(LanguageService).setLang('ar');
      await render('/payments/import?account=cl-sparkasse&from=payments');
      await click('use-sample');
      await click('import-button');
      await advance(IMPORT_MS);
      expect(text(q('summary-line'))).not.toMatch(/statementImport\./);
      expect(text(q('summary'))).not.toMatch(/[A-Za-z]{4,}/); // nothing is left in English
      await render('/payments/import?new=1&from=payments');
      expect(q('new-iban')!.getAttribute('dir')).toBe('ltr');
    });
  });
});
