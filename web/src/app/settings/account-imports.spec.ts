import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { SUPPLIES } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { SampleStatement, StatementImport } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { findSampleStatement } from '../data/sample-statements';
import { changeCategory } from '../domain/payment-actions';
import { statementText } from '../domain/statement-import';
import { DemoStateService } from '../state/demo-state.service';
import { IMPORT_MS, StatementImportService } from '../state/statement-import.service';
import { AccountImports } from './account-imports';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';

/** A statement with one payment in September, a month the Q3 VAT return closes. */
const SEPTEMBER: SampleStatement = {
  id: 'test-september',
  fileName: 'september.csv',
  format: 'bankCsv',
  bankLabel: 'Test CSV',
  header: ['Datum', 'Name', 'Betrag'],
  cells: [['12.09.2026', 'Testzahlung', '-10,00']],
  mapping: { roles: ['date', 'who', 'amount'], moneyOut: 'minus' },
  meta: [{ booking: 'bankFees', confirmed: true, receipt: 'notNeeded' }],
};

/** The import record of a file that is not Café's own (no payments), for the cases that need only the list. */
const record = (patch: Partial<StatementImport>): StatementImport => ({
  id: 'imp-x',
  accountId: 'cl-sparkasse',
  statementId: 'cl-sparkasse-oktober',
  fileName: 'sparkasse-oktober.csv',
  importedOn: DEMO_TODAY,
  paymentIds: [],
  skippedCount: 0,
  ...patch,
});

/** The words of a node, the spaces being one. */
const text = (node: Element | null | undefined): string =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('AccountImports', () => {
  let fixture: ComponentFixture<AccountImports>;
  let demo: DemoStateService;
  let service: StatementImportService;
  let language: LanguageService;

  /** What the last "Download the file" handed to the browser: the file's name, its type and its text. */
  let saved: { fileName: string; type: string; text: string } | null;
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    saved = null;
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    demo = TestBed.inject(DemoStateService);
    service = TestBed.inject(StatementImportService);
    language = TestBed.inject(LanguageService);
    demo.setBusiness('cafe-linde');

    // jsdom has no object URLs and does not follow a link: take the file at the moment the link is clicked.
    let blob: Blob | null = null;
    URL.createObjectURL = vi.fn((made: Blob | MediaSource) => {
      blob = made as Blob;
      return 'blob:demo';
    });
    URL.revokeObjectURL = vi.fn();
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved = { fileName: this.download, type: blob!.type, text: '' };
      void blob!.text().then((text) => (saved = { ...saved!, text }));
    });
  });

  afterEach(() => {
    click.mockRestore();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    fixture?.destroy();
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    vi.useRealTimers();
  });

  /** Imports a sample statement into an account, the way the import screen does. */
  async function importStatement(
    accountId: string,
    statement = service.nextSample(accountId),
  ): Promise<void> {
    vi.useFakeTimers();
    const done = service.import(accountId, statement, statement.mapping!);
    await vi.advanceTimersByTimeAsync(IMPORT_MS);
    await done;
    vi.useRealTimers();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(accountId = 'cl-sparkasse'): Promise<void> {
    fixture = TestBed.createComponent(AccountImports);
    fixture.componentRef.setInput('accountId', accountId);
    await settle();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const lines = () =>
    Array.from(el().querySelectorAll('[data-testid^="import-line-"]')).map((line) => text(line));
  const lineIds = () =>
    Array.from(el().querySelectorAll('[data-testid^="import-line-"]')).map((line) =>
      line.getAttribute('data-testid')!.slice('import-line-'.length),
    );

  async function press(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
    await new Promise<void>((resolve) => setTimeout(resolve)); // the file's text is read after a moment
  }

  async function open(accountId = 'cl-sparkasse'): Promise<void> {
    await press(`imports-toggle-${accountId}`);
  }

  describe('the list', () => {
    it('an account with imports shows them, newest first', async () => {
      await importStatement('cl-sparkasse');
      // Recorded last, so it comes first in the business's own list: the list puts the newest in front by date.
      demo.recordImport(
        record({
          id: 'imp-old',
          fileName: 'sparkasse-september.csv',
          importedOn: '2026-09-30',
          paymentIds: ['a', 'b'],
        }),
      );
      await render();

      expect(text(q('imports-toggle-cl-sparkasse'))).toBe('Imports (2)');
      await open();
      expect(lineIds()).toEqual(['imp-1', 'imp-old']);
      expect(lines()).toEqual([
        '22 Oct · sparkasse-oktober.csv · 5 payments',
        `${formatDate('2026-09-30', 'en')} · sparkasse-september.csv · 2 payments`,
      ]);
    });

    it('starts closed, and the toggle opens and closes it', async () => {
      demo.recordImport(record({}));
      await render();
      const toggle = q('imports-toggle-cl-sparkasse')!;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(q('imports-list-cl-sparkasse')).toBeNull();

      await open();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.getAttribute('aria-controls')).toBe(q('imports-list-cl-sparkasse')!.id);

      await open();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(q('imports-list-cl-sparkasse')).toBeNull();
    });

    it('says one payment in the singular', async () => {
      demo.recordImport(record({ paymentIds: ['a'] }));
      await render();
      await open();
      expect(lines()).toEqual(['22 Oct · sparkasse-oktober.csv · 1 payment']);
    });

    it('lists the imports of this account only', async () => {
      demo.recordImport(record({ id: 'imp-a', accountId: 'cl-qonto', fileName: 'qonto.csv' }));
      demo.recordImport(record({ id: 'imp-b' }));
      await render('cl-sparkasse');
      await open();
      expect(lineIds()).toEqual(['imp-b']);
    });

    it('accounts without imports show no imports area', async () => {
      await importStatement('cl-sparkasse');
      await render('cl-qonto');
      expect(q('imports-cl-qonto')).toBeNull();
      expect(q('imports-toggle-cl-qonto')).toBeNull();
      expect(text(el())).toBe('');

      fixture.destroy();
      await render('cl-cash');
      expect(el().querySelector('button')).toBeNull();
      expect(text(el())).toBe('');
    });

    it('follows the open business', async () => {
      demo.recordImport(record({}));
      await render();
      expect(q('imports-toggle-cl-sparkasse')).not.toBeNull();
      demo.setBusiness('weber-design');
      await settle();
      expect(q('imports-toggle-cl-sparkasse')).toBeNull();
    });
  });

  describe('Download the file', () => {
    it('download gives the original file’s text, named after the file', async () => {
      await importStatement('cl-sparkasse');
      await render();
      await open();
      q('import-download-imp-1')!.click();
      // The address is given back after the browser has had its turn: some browsers (Safari, iOS) cancel a download whose address is revoked at once.
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      await settle();

      const original = statementText(findSampleStatement(demo.business(), 'cl-sparkasse-oktober')!);
      expect(saved).toEqual({
        fileName: 'sparkasse-oktober.csv',
        type: 'text/csv;charset=utf-8',
        text: original,
      });
      expect(original).toContain('Metro Großmarkt');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:demo');
    });

    it('a CAMT file is an XML file', async () => {
      demo.setBusiness('weber-design');
      demo.recordImport(
        record({
          id: 'imp-w',
          accountId: 'wd-qonto',
          statementId: 'wd-volksbank-oktober',
          fileName: 'volksbank-oktober.xml',
        }),
      );
      await render('wd-qonto');
      await open('wd-qonto');
      await press('import-download-imp-w');

      expect(saved?.fileName).toBe('volksbank-oktober.xml');
      expect(saved?.type).toBe('application/xml;charset=utf-8');
      expect(saved?.text).toContain('camt.053');
    });

    it('offers no download when the original file is not there any more', async () => {
      demo.recordImport(record({ statementId: 'gone' }));
      await render();
      await open();
      expect(q('import-download-imp-x')).toBeNull();
      expect(q('import-undo-imp-x')).not.toBeNull();
    });

    it('each button says which import it is for', async () => {
      demo.recordImport(record({}));
      await render();
      await open();
      const download = q('import-download-imp-x')!;
      const undo = q('import-undo-imp-x')!;
      const line = q('import-line-imp-x')!;
      for (const [button, words] of [
        [download, 'Download the file'],
        [undo, 'Undo import'],
      ] as const) {
        const names = button.getAttribute('aria-labelledby')!.split(' ');
        expect(names).toEqual([button.id, line.id]);
        expect(names.map((id) => text(el().querySelector(`[id="${id}"]`))).join(' ')).toBe(
          `${words} ${text(line)}`,
        );
      }
    });
  });

  describe('Undo import', () => {
    it('undo from settings removes the payments', async () => {
      await importStatement('cl-sparkasse');
      const cafe = BUSINESSES.find((b) => b.id === 'cafe-linde')!;
      expect(demo.business().transactions).toHaveLength(cafe.transactions.length + 5);
      await render();
      await open();
      await press('import-undo-imp-1');

      expect(demo.business().imports).toEqual([]);
      expect(demo.business().transactions).toHaveLength(cafe.transactions.length);
      expect(demo.business().history[0].key).toBe('importUndone');
      expect(q('imports-toggle-cl-sparkasse')).toBeNull();
    });

    it('says Import undone in a status line and puts the cursor on it', async () => {
      await importStatement('cl-sparkasse');
      await render();
      await open();
      await press('import-undo-imp-1');
      await vi.waitFor(() => expect(document.activeElement).toBe(q('imports-status-cl-sparkasse')));

      const status = q('imports-status-cl-sparkasse')!;
      expect(status.getAttribute('role')).toBe('status');
      expect(status.getAttribute('tabindex')).toBe('-1');
      expect(text(status)).toBe('Import undone. 5 payments were taken out again.');
    });

    it('with other imports left the list stays open and the cursor goes to the status line', async () => {
      await importStatement('cl-sparkasse');
      demo.recordImport(
        record({ id: 'imp-old', fileName: 'sparkasse-september.csv', importedOn: '2026-09-30' }),
      );
      await render();
      await open();
      await press('import-undo-imp-old');
      await vi.waitFor(() => expect(document.activeElement).toBe(q('imports-status-cl-sparkasse')));

      expect(lineIds()).toEqual(['imp-1']);
      expect(text(q('imports-toggle-cl-sparkasse'))).toBe('Imports (1)');
      expect(text(q('imports-status-cl-sparkasse'))).toBe(
        'Import undone. 0 payments were taken out again.',
      );
    });

    it('the status line of a business goes with the business', async () => {
      await importStatement('cl-sparkasse');
      await render();
      await open();
      await press('import-undo-imp-1');
      expect(q('imports-status-cl-sparkasse')).not.toBeNull();

      demo.setBusiness('weber-design');
      await settle();
      demo.setBusiness('cafe-linde');
      await settle();
      expect(q('imports-status-cl-sparkasse')).toBeNull();
    });

    it('undo refused after answering a payment', async () => {
      await importStatement('cl-sparkasse');
      demo.updateTransaction('imp-1-r1', (tx) => changeCategory(tx, SUPPLIES));
      await render();
      await open();

      expect(q('import-undo-imp-1')).toBeNull();
      expect(text(q('import-blocked-imp-1'))).toBe("Can't be undone: some payments were worked on");
      expect(q('import-download-imp-1')).not.toBeNull();
      expect(demo.business().imports).toHaveLength(1);
    });

    it('undo refused once a month is closed', async () => {
      await importStatement('cl-sparkasse', SEPTEMBER);
      await render();
      await open();
      expect(q('import-undo-imp-1')).not.toBeNull();
      expect(q('import-blocked-imp-1')).toBeNull();

      // Café's third-quarter return is sent: July to September are closed from then on.
      demo.recordSentReturn({
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        sentOn: DEMO_TODAY,
        chargedCents: 0,
        paidCents: 0,
        resultCents: 0,
        ticket: 'ET-2026-1022-00001',
        taxOffice: null,
      });
      await settle();

      expect(q('import-undo-imp-1')).toBeNull();
      expect(text(q('import-blocked-imp-1'))).toBe("Can't be undone: a month it touches is closed");
      expect(demo.business().imports).toHaveLength(1);
    });

    it('says a payment that was worked on before a month that is closed', async () => {
      await importStatement('cl-sparkasse', SEPTEMBER);
      demo.updateTransaction('imp-1-r0', (tx) => changeCategory(tx, SUPPLIES));
      demo.recordSentReturn({
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        sentOn: DEMO_TODAY,
        chargedCents: 0,
        paidCents: 0,
        resultCents: 0,
        ticket: 'ET-2026-1022-00001',
        taxOffice: null,
      });
      await render();
      await open();
      expect(text(q('import-blocked-imp-1'))).toBe("Can't be undone: some payments were worked on");
    });
  });

  describe('in German and Arabic', () => {
    it('speaks German', async () => {
      language.setLang('de');
      await importStatement('cl-sparkasse');
      demo.updateTransaction('imp-1-r1', (tx) => changeCategory(tx, SUPPLIES));
      demo.recordImport(record({ id: 'imp-old', importedOn: '2026-09-30' }));
      await render();
      expect(text(q('imports-toggle-cl-sparkasse'))).toBe('Importe (2)');
      await open();
      expect(text(q('import-line-imp-1'))).toBe(
        `${formatDate('2026-10-22', 'de')} · sparkasse-oktober.csv · 5 Zahlungen`,
      );
      expect(text(q('import-download-imp-1'))).toBe(de.settings.bank.imports.download);
      expect(text(q('import-blocked-imp-1'))).toBe(de.settings.bank.imports.blocked.worked);
      expect(text(q('import-undo-imp-old'))).toBe(de.settings.bank.imports.undo);
    });

    it('mirrors in Arabic, keeping the dates, the file names and the counts left to right', async () => {
      language.setLang('ar');
      await importStatement('cl-sparkasse');
      await render();
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(q('imports-toggle-cl-sparkasse'))).toBe(`${ar.settings.bank.imports.title} (1)`);
      await open();

      const line = q('import-line-imp-1')!;
      const ltr = Array.from(line.querySelectorAll('bdi[dir="ltr"]')).map((bdi) => text(bdi));
      expect(ltr).toEqual([formatDate('2026-10-22', 'ar'), 'sparkasse-oktober.csv', '5']);
      expect(text(q('imports-toggle-cl-sparkasse')!.querySelector('bdi[dir="ltr"]'))).toBe('1');
      expect(text(q('import-download-imp-1'))).toBe(ar.settings.bank.imports.download);
      expect(text(q('import-undo-imp-1'))).toBe(ar.settings.bank.imports.undo);
    });
  });
});
