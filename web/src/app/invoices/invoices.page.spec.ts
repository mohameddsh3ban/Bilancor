import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { SEND_MS, InvoiceService } from '../state/invoice.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { InvoicesPage } from './invoices.page';

describe('InvoicesPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness;
  let created = false;
  let el: HTMLElement;

  beforeEach(() => {
    created = false;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([{ path: 'invoices', component: InvoicesPage }]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Opens the page; a test that opens it again (another business, another filter) navigates the harness it has. */
  async function render(url = '/invoices'): Promise<void> {
    if (created) await harness.navigateByUrl(url);
    else {
      harness = await RouterTestingHarness.create(url);
      created = true;
    }
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function click(node: HTMLElement | null): Promise<void> {
    node!.click();
    await settle();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  /** The words of a node on one line; the marks that keep an amount left-to-right are not words. */
  const text = (node: Element | null) =>
    node?.textContent
      ?.replace(/[\u2066-\u2069]/g, '')
      .replace(/\s+/g, ' ')
      .trim() ?? '';
  const inside = (node: Element | null, testId: string) =>
    node?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;
  const names = () => qa('invoice-row').map((row) => text(inside(row, 'invoice-name')));
  const rowOf = (name: string) =>
    qa('invoice-row').find((row) => text(inside(row, 'invoice-name')) === name)!;

  describe('top of the page', () => {
    it('has the title and + New invoice as the main button, a link to the new invoice', async () => {
      await render();
      expect(text(q('invoices-page')!.querySelector('h1'))).toBe('Invoices');
      const add = q('new-invoice')!;
      expect(add.tagName).toBe('A');
      expect(text(add)).toBe('New invoice');
      expect(add.getAttribute('href')).toBe('/invoices/new');
    });

    it('weber: owed €3,570.00, €1,190.00 overdue', async () => {
      await render();
      expect(text(q('owed-card'))).toContain('Owed to you');
      expect(text(q('owed-total'))).toBe('€3,570.00 · 2 invoices');
      expect(text(q('owed-overdue'))).toBe('€1,190.00 overdue · 1 invoice');
    });

    it('the Owed to you card comes before the filters, and the filters before the rows', async () => {
      await render();
      const order = [q('owed-card')!, q('invoice-filters')!, q('invoice-list')!];
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
          `${i}`,
        ).toBeTruthy();
      }
    });
  });

  describe('the rows', () => {
    it('weber: the draft first, then overdue, then open, then paid and cancelled, newest first', async () => {
      await render();
      expect(names()).toEqual([
        'Bezirksamt Pankow',
        'Bäckerei Lange',
        'Studio Kern',
        'Atelier Sommer GmbH',
        'Agentur Nord', // the cancellation invoice RE-2026-042
        'Müller GmbH',
        'Agentur Nord', // the cancelled RE-2026-040
        'Müller GmbH',
        'Atelier Sommer GmbH',
        'Müller GmbH',
      ]);
      expect(text(inside(rowOf('Studio Kern'), 'invoice-status'))).toBe('Due 30 Oct');
    });

    it('overdue filter shows Bäckerei Lange with Send reminder linking to remind', async () => {
      await render('/invoices?filter=overdue');
      expect(names()).toEqual(['Bäckerei Lange']);
      const remind = inside(rowOf('Bäckerei Lange'), 'invoice-remind')!;
      expect(text(remind)).toBe('Send reminder');
      expect(remind.getAttribute('href')).toBe('/invoices/inv-wd-039?remind=1');
      expect(text(inside(rowOf('Bäckerei Lange'), 'invoice-status'))).toBe('Overdue 22 days');
    });

    it('drafts filter shows Bezirksamt Pankow', async () => {
      await render('/invoices?filter=drafts');
      expect(names()).toEqual(['Bezirksamt Pankow']);
      expect(text(inside(rowOf('Bezirksamt Pankow'), 'invoice-status'))).toBe('Draft');
      expect(inside(rowOf('Bezirksamt Pankow'), 'invoice-link')!.getAttribute('href')).toBe(
        '/invoices/inv-wd-draft',
      );
    });

    it('open filter shows what is still owed, the overdue invoice included, as many as the card counts', async () => {
      await render('/invoices?filter=open');
      expect(names()).toEqual(['Bäckerei Lange', 'Studio Kern']);
      expect(qa('invoice-row')).toHaveLength(2);
    });

    it('paid filter shows the paid invoices only', async () => {
      await render('/invoices?filter=paid');
      expect(names()).toEqual([
        'Atelier Sommer GmbH',
        'Müller GmbH',
        'Müller GmbH',
        'Atelier Sommer GmbH',
        'Müller GmbH',
      ]);
      expect(qa('invoice-status').every((chip) => text(chip).startsWith('Paid '))).toBe(true);
    });

    it('café row shows Send formal reminder', async () => {
      demo.setBusiness('cafe-linde');
      await render();
      const row = rowOf('Kanzlei Hoffmann');
      expect(text(inside(row, 'invoice-remind'))).toBe('Send formal reminder');
      expect(inside(row, 'invoice-remind')!.getAttribute('href')).toBe(
        '/invoices/inv-cl-053?remind=1',
      );
      expect(text(inside(row, 'invoice-reminded'))).toBe('Reminded 12 Oct');
    });

    it('sara row shows Partly paid · €300.00 left', async () => {
      demo.setBusiness('sara-yoga');
      await render();
      expect(text(inside(rowOf('Physio Zentrum Mitte'), 'invoice-status'))).toBe(
        'Partly paid · €300.00 left',
      );
      expect(text(q('owed-total'))).toBe('€300.00 · 1 invoice');
      expect(q('owed-overdue')).toBeNull();
    });

    it('a row opens its invoice', async () => {
      await render();
      expect(inside(rowOf('Studio Kern'), 'invoice-link')!.getAttribute('href')).toBe(
        '/invoices/inv-wd-044',
      );
    });

    it('follows the open business', async () => {
      await render();
      demo.setBusiness('sara-yoga');
      await settle();
      expect(names()).toContain('Physio Zentrum Mitte');
      expect(names()).not.toContain('Studio Kern');
    });
  });

  describe('the filter lives in the address', () => {
    const chip = (name: string) => q(`filter-chip-${name}`)!;

    it('has the five chips, with a count on Overdue and Drafts', async () => {
      await render();
      expect(qa('invoice-filters')).toHaveLength(1);
      expect(Array.from(q('invoice-filters')!.querySelectorAll('a')).map((a) => text(a))).toEqual([
        'All',
        'Open',
        'Overdue 1',
        'Drafts 1',
        'Paid',
      ]);
    });

    it('has no count on a chip with nothing in it', async () => {
      demo.setBusiness('sara-yoga');
      await render();
      expect(text(chip('overdue'))).toBe('Overdue');
      expect(text(chip('drafts'))).toBe('Drafts');
    });

    it('every chip is a link that sets ?filter=, and All takes it away', async () => {
      await render();
      expect(chip('all').getAttribute('href')).toBe('/invoices');
      expect(chip('open').getAttribute('href')).toBe('/invoices?filter=open');
      expect(chip('overdue').getAttribute('href')).toBe('/invoices?filter=overdue');
      expect(chip('drafts').getAttribute('href')).toBe('/invoices?filter=drafts');
      expect(chip('paid').getAttribute('href')).toBe('/invoices?filter=paid');
    });

    it('filter in the URL: the chip of the address is the current one, and tapping another one changes both', async () => {
      await render('/invoices?filter=open');
      expect(chip('open').getAttribute('aria-current')).toBe('true');
      expect(chip('all').hasAttribute('aria-current')).toBe(false);
      expect(names()).toEqual(['Bäckerei Lange', 'Studio Kern']);

      await click(chip('overdue'));
      expect(TestBed.inject(Router).url).toBe('/invoices?filter=overdue');
      expect(chip('overdue').getAttribute('aria-current')).toBe('true');
      expect(chip('open').hasAttribute('aria-current')).toBe(false);
      expect(names()).toEqual(['Bäckerei Lange']);

      await click(chip('all'));
      expect(TestBed.inject(Router).url).toBe('/invoices');
      expect(chip('all').getAttribute('aria-current')).toBe('true');
      expect(names()).toHaveLength(10);
    });

    it('a filter the page does not know shows everything, with All current', async () => {
      await render('/invoices?filter=nonsense');
      expect(chip('all').getAttribute('aria-current')).toBe('true');
      expect(names()).toHaveLength(10);
    });

    it('the Owed to you card links land on the filter they name', async () => {
      await render();
      await click(q('owed-overdue'));
      expect(TestBed.inject(Router).url).toBe('/invoices?filter=overdue');
      expect(names()).toEqual(['Bäckerei Lange']);
      await click(q('owed-total'));
      expect(TestBed.inject(Router).url).toBe('/invoices?filter=open');
      expect(names()).toEqual(['Bäckerei Lange', 'Studio Kern']);
    });

    it('the Owed to you card stays when a filter is on', async () => {
      await render('/invoices?filter=paid');
      expect(text(q('owed-total'))).toBe('€3,570.00 · 2 invoices');
    });
  });

  describe('when there is nothing to show', () => {
    it('a business with no invoices yet gets a way to write the first one', async () => {
      demo.setBusiness('sara-yoga');
      demo.setSetup('new');
      await render();
      const empty = q('empty-none')!;
      expect(text(empty.querySelector('h2'))).toBe('No invoices yet');
      expect(empty.textContent).toContain('Write your first invoice');
      expect(inside(empty, 'empty-new-invoice')!.getAttribute('href')).toBe('/invoices/new');
      expect(q('invoice-list')).toBeNull();
      expect(q('invoice-filters')).toBeNull();
      expect(q('owed-card')).toBeNull();
    });

    it('a filter with nothing in it names itself and offers Show all', async () => {
      demo.setBusiness('sara-yoga');
      await render('/invoices?filter=overdue');
      const empty = q('empty-filter')!;
      expect(text(empty.querySelector('h2'))).toBe('No overdue invoices');
      expect(q('invoice-list')).toBeNull();
      expect(q('invoice-filters')).not.toBeNull();
      const all = inside(empty, 'show-all')!;
      expect(text(all)).toBe('Show all');
      expect(all.getAttribute('href')).toBe('/invoices');
      await click(all);
      expect(TestBed.inject(Router).url).toBe('/invoices');
      expect(names()).toContain('Physio Zentrum Mitte');
      expect(q('empty-filter')).toBeNull();
    });

    it('says which filter is empty, for each of them', async () => {
      demo.setBusiness('sara-yoga');
      const expected: Record<string, string> = {
        overdue: 'No overdue invoices',
        drafts: 'No drafts',
      };
      for (const [filter, title] of Object.entries(expected)) {
        await render(`/invoices?filter=${filter}`);
        expect(text(q('empty-filter')!.querySelector('h2')), filter).toBe(title);
      }
    });

    it('an empty open filter and an empty paid filter say so too', async () => {
      demo.setBusiness('sara-yoga');
      TestBed.inject(InvoiceService).markPaidInCash('inv-sy-021', '2026-10-22');
      await render('/invoices?filter=open');
      expect(text(q('empty-filter')!.querySelector('h2'))).toBe('No open invoices');

      demo.setBusiness('weber-design');
      demo.setSetup('new');
      await render('/invoices?filter=paid');
      expect(text(q('empty-filter')!.querySelector('h2'))).toBe('No paid invoices yet');
    });
  });

  describe('a new client', () => {
    it('new client state shows only drafts and written invoices', async () => {
      demo.setSetup('new');
      demo.completeStep('tax');
      await render();
      // the sample invoices wait behind the bank; the draft is the client's own work and shows
      expect(names()).toEqual(['Bezirksamt Pankow']);
      expect(q('owed-card')).toBeNull();
      expect(text(q('invoice-filters')!)).toContain('Drafts 1');
      expect(text(q('invoice-filters')!)).not.toContain('Overdue 1');

      // an invoice written and sent here shows, with the bank still not connected
      vi.useFakeTimers();
      const sent = TestBed.inject(InvoiceService).send('inv-wd-draft', {
        to: 'x@y.example',
        subject: 's',
        body: 'b',
      });
      vi.advanceTimersByTime(SEND_MS);
      await sent;
      vi.useRealTimers();
      await settle();
      expect(names()).toEqual(['Bezirksamt Pankow']);
      const row = rowOf('Bezirksamt Pankow');
      expect(text(inside(row, 'invoice-meta'))).toBe('RE-2026-045 · 22 Oct');
      expect(text(inside(row, 'invoice-status'))).toBe('Due 5 Nov');
      expect(text(q('owed-total'))).toBe('€4,165.00 · 1 invoice');
    });

    it('before the bank, a business with no draft has an empty page', async () => {
      demo.setBusiness('cafe-linde');
      demo.setSetup('new');
      await render();
      expect(q('empty-none')).not.toBeNull();
    });
  });

  describe('Arabic', () => {
    it('amounts, numbers and dates stay left-to-right, and the page mirrors', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render();
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(q('invoices-page')!.querySelector('h1'))).not.toBe('Invoices');
      expect(qa('invoice-amount').length).toBeGreaterThan(0);
      for (const amount of qa('invoice-amount')) {
        expect(amount.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      }
      for (const meta of qa('invoice-meta')) {
        const bdi = meta.querySelector('bdi');
        if (bdi) expect(bdi.getAttribute('dir')).toBe('ltr');
      }
      for (const total of ['owed-total', 'owed-overdue']) {
        expect(q(total)!.querySelector('bdi')!.getAttribute('dir'), total).toBe('ltr');
      }
      for (const name of qa('invoice-name')) expect(name.getAttribute('dir')).toBe('auto');
    });
  });
});

describe('Invoices in the menu', () => {
  let harness: RouterTestingHarness;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  it('menu and bottom bar open /invoices', async () => {
    harness = await RouterTestingHarness.create('/');
    const el = harness.routeNativeElement as HTMLElement;

    const side = Array.from(el.querySelectorAll<HTMLAnchorElement>('aside nav a')).find(
      (a) => a.textContent?.trim() === 'Invoices',
    )!;
    const bottom = Array.from(
      el.querySelectorAll<HTMLAnchorElement>('[data-testid="bottom-bar"] a'),
    ).find((a) => a.textContent?.trim() === 'Invoices')!;
    expect(side.getAttribute('href')).toBe('/invoices');
    expect(bottom.getAttribute('href')).toBe('/invoices');

    side.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/invoices');
    expect(el.querySelector('[data-testid="invoices-page"] h1')?.textContent?.trim()).toBe(
      'Invoices',
    );
  });

  it('/soon/invoices is not a coming-soon page any more', async () => {
    harness = await RouterTestingHarness.create('/soon/invoices');
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('This page');
  });
});
