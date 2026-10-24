import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../data/banks';
import { ADVERTISING, OFFICE } from '../data/categories';
import type { Doc } from '../data/models';
import { READING_MS, newReadingDoc } from '../domain/document-upload';
import { PaymentDetailPage } from '../payments/payment-detail.page';
import { PaymentsPage } from '../payments/payments.page';
import { DemoStateService } from '../state/demo-state.service';
import { ReceiptService } from '../state/receipt.service';
import { UploadService } from '../state/upload.service';
import { DocumentDetailPage } from './document-detail.page';
import { DocumentsPage } from './documents.page';
import de from '../../../public/i18n/de.json';

const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068);
const POP_ISOLATE = String.fromCodePoint(0x2069);

describe('DocumentDetailPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let created = false;

  beforeEach(() => {
    created = false;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          {
            path: 'documents',
            component: DocumentsPage,
            children: [{ path: ':id', component: DocumentDetailPage }],
          },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
        ]),
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

  /** Connects the savings account of Weber Design and puts a payment on it, as the bank flow and a bank fetch would. */
  function onSavings(paymentId: string): void {
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    demo.updateTransaction(paymentId, (t) => ({ ...t, accountId: 'wd-savings' }));
  }

  /** Opens the page; a second call in one test goes to that address in the same app. */
  async function render(url: string): Promise<void> {
    if (created) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    created = true;
    await settle();
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** Text without the isolates that keep a name's direction (see PaymentHistory). */
  const plain = (node: Element | null | undefined) =>
    text(node).replaceAll(FIRST_STRONG_ISOLATE, '').replaceAll(POP_ISOLATE, '');
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const detail = () => q('document-detail')!;
  const d = (testId: string) =>
    detail()?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;
  const da = (testId: string) =>
    Array.from(detail().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const inside = (node: Element | null, testId: string) =>
    node?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;
  const onPayment = (testId: string) =>
    q('payment-detail')?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;
  const status = () => text(d('doc-status'));
  const historyTexts = () => da('history-item').map((item) => plain(inside(item, 'history-text')));
  const doc = (id: string): Doc => demo.documents().find((x) => x.id === id)!;
  const tx = (id: string) => demo.business().transactions.find((t) => t.id === id)!;
  const stepStates = () =>
    ['step-read', 'step-booked', 'step-paid'].map((id) => [
      text(inside(d(id), 'step-label')),
      d(id)!.getAttribute('data-state'),
    ]);

  async function click(node: HTMLElement | null): Promise<void> {
    node!.click();
    await settle();
  }

  async function typeIn(testId: string, value: string): Promise<void> {
    const input = d(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  // The category list and the payment list open in an overlay outside the page, so they are read from the document.
  const options = (testId: string) =>
    Array.from(document.body.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const inBody = (testId: string) =>
    document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  /** Makes some payments of Weber Design lack their receipt, so a document has more of them to choose from. */
  function loseReceipts(...ids: string[]): void {
    for (const id of ids) {
      demo.updateTransaction(id, (t) => ({ ...t, receipt: 'missing', receiptFile: null }));
    }
  }

  describe('header', () => {
    it('shows the name, what it is, the invoice number, the amount and the status', async () => {
      await render('/documents/wd-d2');
      expect(text(d('document-detail-name'))).toBe('Studio Kern');
      expect(d('document-detail-name')!.hasAttribute('dir')).toBe(false);
      expect(text(d('document-detail-name')!.querySelector('[dir="auto"]'))).toBe('Studio Kern');
      expect(text(d('document-detail-meta'))).toBe('Invoice you sent · RE-2026-044');
      expect(
        inside(d('document-detail-meta'), 'document-detail-invoice')!
          .closest('bdi')!
          .getAttribute('dir'),
      ).toBe('ltr');
      expect(text(d('document-detail-amount'))).toBe(formatMoney(238000, 'en'));
      expect(d('document-detail-amount')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(status()).toBe('Waiting for payment · due 30 Oct');
    });

    it('says Received for a bill, and names a document without a name by its file', async () => {
      await render('/documents/wd-d4');
      expect(text(d('document-detail-meta'))).toBe('Received · Q-8812');
      demo.updateDocument('wd-d4', (x) => ({ ...x, name: null }));
      await settle();
      expect(text(d('document-detail-name'))).toBe('boettcher-quittung.pdf');
      expect(d('document-detail-name')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
    });

    it('opens as a panel on computers and a full page on phones, each with a way back to the list', async () => {
      await render('/documents/wd-d2');
      const back = q('back-link')!;
      expect(back.getAttribute('href')).toBe('/documents');
      expect(back.classList).toContain('lg:hidden');
      expect(text(back)).toBe('Documents');
      expect(back.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
      const close = d('close-panel')!;
      expect(close.getAttribute('href')).toBe('/documents');
      expect(close.classList).toContain('hidden');
      expect(close.classList).toContain('lg:inline-flex');
      expect(close.getAttribute('aria-label')).toBe('Close');
    });

    it('an unknown document goes back to the list', async () => {
      await render('/documents/nope');
      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('switching business with a document open returns to the list', async () => {
      await render('/documents/wd-d2');
      expect(d('document-detail-name')).not.toBeNull();
      demo.setBusiness('sara-yoga');
      await settle();
      expect(TestBed.inject(Router).url).toBe('/documents');
      expect(q('document-detail')).toBeNull();
    });

    it('a document that is not shown in this setup state goes back to the list', async () => {
      demo.setSetup('new');
      await render('/documents/wd-d2');
      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('returns to the list when the open business changes, even if the other business has a document with the same id', async () => {
      await render('/documents/wd-d2');
      demo.addDocument('sara-yoga', { ...doc('wd-d2') });
      demo.setBusiness('sara-yoga');
      await settle();
      expect(TestBed.inject(Router).url).toBe('/documents');
    });
  });

  describe('names in the page direction', () => {
    /** The text of a name that sits on a line of its own: the block keeps the page direction and only the name inside is isolated (dir auto), so a Latin name in Arabic still starts on the start side. */
    function isolatesOnlyTheName(block: HTMLElement | null, name: string): void {
      expect(block).not.toBeNull();
      expect(block!.hasAttribute('dir')).toBe(false);
      const inner = block!.querySelector<HTMLElement>('[dir="auto"]');
      expect(inner).not.toBeNull();
      expect(text(inner)).toBe(name);
      expect(block!.querySelectorAll('[dir="auto"]')).toHaveLength(1);
    }

    it('the title, the drawn page, the linked payment and the picker rows', async () => {
      await render('/documents/wd-d4');
      isolatesOnlyTheName(d('document-detail-name'), 'Böttcher Bürobedarf');
      isolatesOnlyTheName(d('paper-name'), 'Böttcher Bürobedarf');
      // a long name still truncates, inside its own box, so the start of the name stays visible
      expect(d('paper-name')!.querySelector('[dir="auto"]')!.classList).toContain('truncate');

      await click(d('search-payments'));
      for (const row of options('payment-picker-option')) {
        isolatesOnlyTheName(inside(row, 'picker-name'), text(inside(row, 'picker-name')));
        expect(inside(row, 'picker-name')!.querySelector('[dir="auto"]')!.classList).toContain(
          'truncate',
        );
      }
      await click(inBody('payment-picker-option'));

      const linked = inside(d('linked-payment'), 'linked-name');
      isolatesOnlyTheName(linked, 'SCHREIBWAREN BOETTCHER');
      expect(linked!.querySelector('[dir="auto"]')!.classList).toContain('truncate');
    });
  });

  describe('paper', () => {
    it('draws the name, invoice number, date and total of the document', async () => {
      await render('/documents/wd-d2');
      expect(text(d('paper-name'))).toBe('Studio Kern');
      expect(d('paper-name')!.hasAttribute('dir')).toBe(false);
      expect(text(d('paper-invoice'))).toBe('RE-2026-044');
      expect(d('paper-invoice')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(d('paper-date'))).toBe(formatDate('2026-10-16', 'en', { year: true }));
      expect(text(d('paper-total'))).toBe(formatMoney(238000, 'en'));
      expect(d('paper-total')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(d('paper-missing')).toBeNull();
    });

    it('the missing amount is marked on the paper', async () => {
      await render('/documents/wd-d1');
      const missing = d('paper-missing')!;
      expect(missing.getAttribute('data-field')).toBe('amount');
      expect(text(missing)).toBe('?');
      expect(missing.className).toContain('outline-warning');
      expect(missing.closest('[data-testid="paper-total"]')).not.toBeNull();
      // the other three things are read
      expect(text(d('paper-name'))).toBe('Bürobedarf Schulz');
      expect(da('paper-missing')).toHaveLength(1);
    });

    it('marks every field that could not be read', async () => {
      await render('/documents/wd-d1');
      demo.updateDocument('wd-d1', (x) => ({ ...x, name: null, date: null }));
      await settle();
      expect(da('paper-missing').map((m) => m.getAttribute('data-field'))).toEqual([
        'name',
        'date',
        'amount',
      ]);
    });
  });

  describe('while the document is still being read', () => {
    /** A document the way an upload leaves it until its result comes. */
    function addReading(): void {
      demo.addDocument('weber-design', newReadingDoc('up-1', 'scan.pdf', 'file'));
    }

    it('shows no fix box and no ? marks, only a Reading… note on the paper', async () => {
      addReading();
      await render('/documents/up-1');
      expect(status()).toBe('Reading…');
      expect(d('fix-box')).toBeNull();
      expect(d('fix-input')).toBeNull();
      expect(da('paper-missing')).toHaveLength(0);
      expect(text(d('paper-reading'))).toBe('Reading…');
      expect(d('paper-name')).toBeNull();
      expect(d('paper-total')).toBeNull();
    });

    it('offers nothing to change yet: no Edit, category, This one, Search all payments or Remove', async () => {
      addReading();
      await render('/documents/up-1');
      for (const testId of [
        'edit-fields',
        'change-category',
        'confirm-booking',
        'link-payment',
        'search-payments',
        'remove-document',
      ]) {
        expect(d(testId), testId).toBeNull();
      }
      expect(da('payment-suggestion')).toHaveLength(0);
      expect(doc('up-1').history).toHaveLength(1);
    });

    it('still names the file, and the way back works', async () => {
      addReading();
      await render('/documents/up-1');
      expect(text(d('document-detail-name'))).toBe('scan.pdf');
      expect(q('back-link')!.getAttribute('href')).toBe('/documents');
    });

    it('after reading, the normal detail appears: the paper, the fields, Edit and the payment it was linked to', async () => {
      await render('/documents');
      vi.useFakeTimers();
      TestBed.inject(UploadService).add([new File(['x'], 'scan.pdf')], 'file');
      await harness.navigateByUrl('/documents/up-1');
      harness.detectChanges();
      expect(status()).toBe('Reading…');
      expect(d('edit-fields')).toBeNull();
      vi.advanceTimersByTime(READING_MS);
      vi.useRealTimers();
      await settle();
      // the first ready-made result of Weber Design is the receipt of Deutsche Bahn, which links itself
      expect(status()).toBe('Done');
      expect(d('paper-reading')).toBeNull();
      expect(text(d('paper-name'))).toBe('Deutsche Bahn');
      expect(da('paper-missing')).toHaveLength(0);
      expect(d('fix-box')).toBeNull();
      expect(d('edit-fields')).not.toBeNull();
      expect(d('change-category')).not.toBeNull();
      expect(text(inside(d('linked-payment'), 'linked-name'))).toBe('Deutsche Bahn');
    });

    it('after reading, a document that needs the person shows its fix box', async () => {
      addReading();
      await render('/documents/up-1');
      demo.updateDocument('up-1', (x) => ({
        ...x,
        reading: false,
        name: 'Copyshop',
        direction: 'received',
        date: '2026-10-21',
      }));
      await settle();
      expect(status()).toBe('Check amount');
      expect(d('fix-box')).not.toBeNull();
      expect(d('paper-reading')).toBeNull();
      expect(da('paper-missing')).toHaveLength(1);
    });
  });

  describe('fix box', () => {
    it('says what could not be read, with an amount field and Save', async () => {
      await render('/documents/wd-d1');
      expect(text(d('fix-text'))).toBe("We couldn't read the amount; it's marked on the scan.");
      expect(d('fix-input')!.getAttribute('type')).toBe('text');
      expect(d('fix-input')!.getAttribute('inputmode')).toBe('decimal');
      expect(text(d('fix-save'))).toBe('Save');
      expect(d('fix-error')).toBeNull();
    });

    it('is not there when nothing is missing', async () => {
      await render('/documents/wd-d2');
      expect(d('fix-box')).toBeNull();
    });

    it('typing 71,39 fills the amount and clears the problem', async () => {
      await render('/documents/wd-d1');
      expect(status()).toBe('Check amount');
      await typeIn('fix-input', '71,39');
      await click(d('fix-save'));
      expect(doc('wd-d1').amountCents).toBe(7139);
      expect(status()).toBe('Waiting for payment');
      expect(d('fix-box')).toBeNull();
      expect(d('paper-missing')).toBeNull();
      expect(text(d('paper-total'))).toBe(formatMoney(7139, 'en'));
      expect(text(d('document-detail-amount'))).toBe(formatMoney(7139, 'en'));
      expect(historyTexts()[0]).toBe('You corrected the details');
      expect(doc('wd-d1').history[0].key).toBe('docEdited');
    });

    it('also takes the amount with a dot, and the document leaves Needs you', async () => {
      await render('/documents/wd-d1');
      await typeIn('fix-input', '1.234,50');
      await click(d('fix-save'));
      expect(doc('wd-d1').amountCents).toBe(123450);
      expect(q('needs-you-box')).toBeNull();
    });

    it.each(['', '0', '0,00', 'abc', '-5'])(
      'an amount of "%s" shows what is wrong and saves nothing',
      async (typed) => {
        await render('/documents/wd-d1');
        const before = doc('wd-d1');
        await typeIn('fix-input', typed);
        await click(d('fix-save'));
        expect(text(d('fix-error'))).toBe('Type an amount above 0, like 71.39.');
        expect(d('fix-input')!.getAttribute('aria-invalid')).toBe('true');
        expect(doc('wd-d1')).toBe(before);
        expect(status()).toBe('Check amount');
      },
    );

    it('the error goes when the person types again', async () => {
      await render('/documents/wd-d1');
      await click(d('fix-save'));
      expect(d('fix-error')).not.toBeNull();
      await typeIn('fix-input', '5');
      expect(d('fix-error')).toBeNull();
    });

    it('a missing date is typed in with a date field', async () => {
      await render('/documents/wd-d1');
      demo.updateDocument('wd-d1', (x) => ({ ...x, amountCents: 7139, date: null }));
      await settle();
      expect(text(d('fix-text'))).toBe("We couldn't read the date; it's marked on the scan.");
      expect(d('fix-input')!.getAttribute('type')).toBe('date');
      await click(d('fix-save'));
      expect(text(d('fix-error'))).toBe('Pick the date.');
      expect(doc('wd-d1').date).toBeNull();
      await typeIn('fix-input', '2026-10-19');
      await click(d('fix-save'));
      expect(doc('wd-d1').date).toBe('2026-10-19');
      expect(d('fix-box')).toBeNull();
      expect(status()).toBe('Waiting for payment');
    });

    it('a missing name is typed in with a text field', async () => {
      await render('/documents/wd-d1');
      demo.updateDocument('wd-d1', (x) => ({ ...x, amountCents: 7139, name: null }));
      await settle();
      expect(text(d('fix-text'))).toBe("We couldn't read the name; it's marked on the scan.");
      expect(d('fix-input')!.getAttribute('dir')).toBe('auto');
      await typeIn('fix-input', '   ');
      await click(d('fix-save'));
      expect(text(d('fix-error'))).toBe('Type the name.');
      await typeIn('fix-input', '  Bürobedarf Schulz  ');
      await click(d('fix-save'));
      expect(doc('wd-d1').name).toBe('Bürobedarf Schulz');
      expect(text(d('document-detail-name'))).toBe('Bürobedarf Schulz');
    });

    it('moves on to the next field that could not be read', async () => {
      await render('/documents/wd-d1');
      demo.updateDocument('wd-d1', (x) => ({ ...x, date: null }));
      await settle();
      expect(text(d('fix-text'))).toBe("We couldn't read the amount; it's marked on the scan.");
      await typeIn('fix-input', '71,39');
      await click(d('fix-save'));
      expect(text(d('fix-text'))).toBe("We couldn't read the date; it's marked on the scan.");
      expect(d('fix-input')!.getAttribute('type')).toBe('date');
      expect(status()).toBe('Check date');
    });

    it('opens with the field ready to type in, and moves on to the next field once one is saved', async () => {
      await render('/documents/wd-d1');
      demo.updateDocument('wd-d1', (x) => ({ ...x, date: null }));
      await settle();
      expect(document.activeElement).toBe(d('fix-input'));
      await typeIn('fix-input', '71,39');
      await click(d('fix-save'));
      expect(d('fix-input')!.getAttribute('type')).toBe('date');
      expect(document.activeElement).toBe(d('fix-input'));
    });

    it('Enter in the field saves, like Save', async () => {
      await render('/documents/wd-d1');
      await typeIn('fix-input', '71,39');
      d('fix-box')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
      expect(doc('wd-d1').amountCents).toBe(7139);
    });

    it('Save writes one history line when tapped twice', async () => {
      await render('/documents/wd-d1');
      await typeIn('fix-input', '71,39');
      const save = d('fix-save')!;
      save.click();
      save.click();
      await settle();
      expect(doc('wd-d1').history.filter((h) => h.key === 'docEdited')).toHaveLength(1);
    });

    it('Save does not change a document whose field was filled in meanwhile', async () => {
      await render('/documents/wd-d1');
      await typeIn('fix-input', '71,39');
      demo.updateDocument('wd-d1', (x) => ({ ...x, amountCents: 5000 }));
      const before = doc('wd-d1');
      d('fix-save')!.click();
      await settle();
      expect(doc('wd-d1')).toBe(before);
    });
  });

  describe('steps', () => {
    it('Read, Booked and Paid for a bill: read, a booking to confirm, not paid', async () => {
      await render('/documents/wd-d4');
      expect(stepStates()).toEqual([
        ['Read', 'done'],
        ['Confirm', 'current'],
        ['Paid', 'todo'],
      ]);
    });

    it('a document that could not be read is still at the first step', async () => {
      await render('/documents/wd-d1');
      expect(stepStates()).toEqual([
        ['Read', 'current'],
        ['Confirm', 'todo'],
        ['Paid', 'todo'],
      ]);
    });

    it('a sent invoice waits for its payment', async () => {
      await render('/documents/wd-d2');
      expect(stepStates()).toEqual([
        ['Read', 'done'],
        ['Booked', 'done'],
        ['Waiting for payment', 'current'],
      ]);
    });

    it('confirming the booking ticks Booked and moves on to Paid', async () => {
      await render('/documents/wd-d4');
      await click(d('confirm-booking'));
      expect(stepStates()).toEqual([
        ['Read', 'done'],
        ['Booked', 'done'],
        ['Paid', 'current'],
      ]);
    });

    it('every step is a word, and a done one also says so for a screen reader', async () => {
      await render('/documents/wd-d2');
      const read = d('step-read')!;
      expect(read.querySelector('.sr-only')!.textContent).toBe('done');
      expect(d('step-paid')!.getAttribute('aria-current')).toBe('step');
      expect(read.hasAttribute('aria-current')).toBe(false);
    });

    it('a linked document is read, booked and paid; Booked follows the payment booking', async () => {
      await render('/documents/doc-wd-t1');
      // wd-t1 is booked but not confirmed yet: the step asks for the confirmation
      expect(stepStates()).toEqual([
        ['Read', 'done'],
        ['Confirm', 'current'],
        ['Paid', 'done'],
      ]);
      await click(d('confirm-booking'));
      expect(stepStates()).toEqual([
        ['Read', 'done'],
        ['Booked', 'done'],
        ['Paid', 'done'],
      ]);
    });

    it('linking a bill ticks Paid, and unlinking takes the tick away again', async () => {
      await render('/documents/wd-d4');
      await click(inside(da('payment-suggestion')[0], 'link-payment'));
      expect(stepStates()).toEqual([
        ['Read', 'done'],
        ['Booked', 'done'],
        ['Paid', 'done'],
      ]);
      await click(d('unlink-payment'));
      expect(stepStates()[2]).toEqual(['Paid', 'current']);
    });
  });

  describe('what we read', () => {
    it('lists type, from and to, invoice number, date, amount, VAT and due date', async () => {
      await render('/documents/wd-d2');
      expect(text(d('field-type'))).toBe('Sent (Ausgangsbeleg)');
      expect(text(inside(d('field-parties'), 'party-from'))).toBe('Weber Design');
      expect(text(inside(d('field-parties'), 'party-to'))).toBe('Studio Kern');
      expect(text(d('field-invoice'))).toBe('RE-2026-044');
      expect(text(d('field-date'))).toBe(formatDate('2026-10-16', 'en', { year: true }));
      expect(text(d('field-amount'))).toBe(formatMoney(238000, 'en'));
      expect(text(d('field-vat'))).toBe(`19% · ${formatMoney(38000, 'en')}`);
      expect(text(d('field-due'))).toBe(formatDate('2026-10-30', 'en', { year: true }));
    });

    it('shows the other party as the sender of a bill', async () => {
      await render('/documents/wd-d4');
      expect(text(d('field-type'))).toBe('Received (Eingangsbeleg)');
      expect(text(inside(d('field-parties'), 'party-from'))).toBe('Böttcher Bürobedarf');
      expect(text(inside(d('field-parties'), 'party-to'))).toBe('Weber Design');
      expect(inside(d('field-parties'), 'party-from')!.getAttribute('dir')).toBe('auto');
      expect(text(d('field-due'))).toBe('—');
    });

    it('shows a dash for what could not be read', async () => {
      await render('/documents/wd-d1');
      expect(text(d('field-amount'))).toBe('—');
      expect(text(d('field-vat'))).toBe('19%');
    });

    it('explains the German term on tap and keeps only the German word in German', async () => {
      await render('/documents/wd-d2');
      await click(d('field-type')!.querySelector('button'));
      expect(document.body.textContent).toContain('An invoice you issued to a customer.');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('field-type'))).toBe('Ausgangsbeleg');
    });

    it('says why the document is Sent, and why Received', async () => {
      await render('/documents/wd-d2');
      expect(text(d('why-note'))).toBe('We set Sent because the invoice comes from your business.');
      await render('/documents/wd-d4');
      expect(text(d('why-note'))).toBe(
        'We set Received because the document comes from someone else.',
      );
    });

    it('a document with no direction yet asks for it instead of saying why', async () => {
      await render('/documents/wd-d2');
      demo.updateDocument('wd-d2', (x) => ({ ...x, direction: null }));
      await settle();
      expect(d('why-note')).toBeNull();
      expect(text(d('field-type'))).toBe('—');
      expect(text(d('document-detail-meta'))).toBe('Received or sent? · RE-2026-044');
    });

    it("a Kleinunternehmer's sent invoice shows no VAT", async () => {
      demo.setBusiness('sara-yoga');
      await render('/documents/doc-sy-t2');
      expect(text(d('field-vat'))).toContain('No VAT');
      // even when the document was read with a rate, a Kleinunternehmer shows none
      demo.updateDocument('doc-sy-t2', (x) => ({ ...x, vatRate: 19 }));
      await settle();
      expect(text(d('field-vat'))).toContain('No VAT');
      expect(text(d('field-vat'))).not.toContain('19');
      expect(text(d('field-vat'))).toContain('Small business, no VAT (Kleinunternehmer)');
    });

    it('a business that charges VAT shows the VAT of a seven percent bill', async () => {
      await render('/documents/wd-d4');
      demo.updateDocument('wd-d4', (x) => ({ ...x, vatRate: 7, amountCents: 10700 }));
      await settle();
      expect(text(d('field-vat'))).toBe(`7% · ${formatMoney(700, 'en')}`);
      demo.updateDocument('wd-d4', (x) => ({ ...x, vatRate: 0 }));
      await settle();
      expect(text(d('field-vat'))).toBe('No VAT');
    });

    describe('Edit', () => {
      const edit = async () => click(d('edit-fields'));

      // The document of an invoice written in Invoices is locked (see 'an invoice written in Invoices'), so these invoices
      // of the sample stand for a sent invoice that was added from a file, which can be edited.
      beforeEach(() => {
        for (const id of ['wd-d2', 'wd-d3']) demo.updateDocument(id, (x) => ({ ...x, invoice: null }));
      });

      it('opens one form with every field, filled in', async () => {
        await render('/documents/wd-d2');
        await edit();
        expect(d('edit-form')).not.toBeNull();
        expect(d('edit-direction-sent')!.getAttribute('aria-pressed')).toBe('true');
        expect(d('edit-direction-received')!.getAttribute('aria-pressed')).toBe('false');
        expect((d('edit-name') as HTMLInputElement).value).toBe('Studio Kern');
        expect((d('edit-invoice') as HTMLInputElement).value).toBe('RE-2026-044');
        expect((d('edit-date') as HTMLInputElement).value).toBe('2026-10-16');
        expect((d('edit-amount') as HTMLInputElement).value).toBe('2380.00');
        expect((d('edit-vat') as HTMLSelectElement).value).toBe('19');
        expect((d('edit-due') as HTMLInputElement).value).toBe('2026-10-30');
        expect(text(d('edit-save'))).toBe('Save');
        expect(text(d('edit-cancel'))).toBe('Cancel');
        expect(d('edit-fields')).toBeNull();
      });

      it('the amount reads with the decimal comma in German', async () => {
        TestBed.inject(LanguageService).setLang('de');
        await render('/documents/wd-d2');
        await edit();
        expect((d('edit-amount') as HTMLInputElement).value).toBe('2380,00');
      });

      it('moves the cursor into the form, and back to Edit when it closes', async () => {
        await render('/documents/wd-d2');
        await edit();
        expect(detail().querySelector('form')!.contains(document.activeElement)).toBe(true);
        await click(d('edit-cancel'));
        expect(document.activeElement).toBe(d('edit-fields'));
      });

      it("never carries one document's values over to another document", async () => {
        await render('/documents/wd-d2');
        await edit();
        await typeIn('edit-name', 'Typed on Studio Kern');
        await typeIn('edit-invoice', 'RE-TYPED');
        await typeIn('edit-amount', '1,00');
        const studioKern = doc('wd-d2');
        const baeckerei = doc('wd-d3');
        // on a computer the panel stays: only the address changes, so the page is reused for the other document
        await render('/documents/wd-d3');
        expect(text(d('document-detail-name'))).toBe('Bäckerei Lange');
        expect(d('edit-form')).toBeNull();
        await edit();
        expect((d('edit-name') as HTMLInputElement).value).toBe('Bäckerei Lange');
        expect((d('edit-invoice') as HTMLInputElement).value).toBe('RE-2026-039');
        expect((d('edit-amount') as HTMLInputElement).value).toBe('1190.00');
        await click(d('edit-save'));
        expect(doc('wd-d3')).toBe(baeckerei);
        expect(doc('wd-d2')).toBe(studioKern);
      });

      it('Edit changes the direction, says so in the history, and the why-note goes because you chose it', async () => {
        await render('/documents/wd-d2');
        expect(d('why-note')).not.toBeNull();
        await edit();
        await click(d('edit-direction-received'));
        await click(d('edit-save'));
        expect(doc('wd-d2').direction).toBe('received');
        expect(text(d('field-type'))).toBe('Received (Eingangsbeleg)');
        expect(d('why-note')).toBeNull();
        expect(text(d('document-detail-meta'))).toBe('Received · RE-2026-044');
        expect(historyTexts().slice(0, 2)).toEqual([
          'You corrected the details',
          'You marked it as received',
        ]);
        expect(d('edit-form')).toBeNull();
      });

      it('Edit changing something else leaves the why-note and the history as they were', async () => {
        await render('/documents/wd-d2');
        await edit();
        await typeIn('edit-name', 'Studio Kern GmbH');
        await click(d('edit-save'));
        expect(text(d('why-note'))).toBe('We set Sent because the invoice comes from your business.');
        expect(doc('wd-d2').history.map((h) => h.key)).not.toContain('markedSent');
      });

      it('a linked document does not offer Received or Sent, and says how to change them', async () => {
        await render('/documents/doc-wd-t2');
        await edit();
        expect(d('edit-direction-received')).toBeNull();
        expect(d('edit-direction-sent')).toBeNull();
        expect(text(d('edit-direction-locked'))).toBe(
          'Linked to a payment — unlink it to change Received or Sent.',
        );
        // the rest of the form still works
        await typeIn('edit-name', 'Telekom Deutschland');
        await click(d('edit-save'));
        expect(doc('doc-wd-t2')).toMatchObject({
          name: 'Telekom Deutschland',
          direction: 'received',
          paymentId: 'wd-t2',
        });
        expect(doc('doc-wd-t2').history.map((h) => h.key)).not.toContain('markedReceived');
      });

      it('an unlinked document offers the choice again', async () => {
        await render('/documents/doc-wd-t2');
        await click(d('unlink-payment'));
        await edit();
        expect(d('edit-direction-locked')).toBeNull();
        expect(d('edit-direction-sent')).not.toBeNull();
        expect(d('edit-direction-received')!.getAttribute('aria-pressed')).toBe('true');
      });

      it('saves every field that was changed, in one history line', async () => {
        await render('/documents/wd-d2');
        await edit();
        await typeIn('edit-name', 'Studio Kern GmbH');
        await typeIn('edit-invoice', 'RE-2026-045');
        await typeIn('edit-date', '2026-10-15');
        await typeIn('edit-amount', '1.190,00');
        (d('edit-vat') as HTMLSelectElement).value = '7';
        d('edit-vat')!.dispatchEvent(new Event('change'));
        await typeIn('edit-due', '');
        await click(d('edit-save'));
        expect(doc('wd-d2')).toMatchObject({
          name: 'Studio Kern GmbH',
          invoiceNo: 'RE-2026-045',
          date: '2026-10-15',
          amountCents: 119000,
          vatRate: 7,
          dueDate: null,
          direction: 'sent',
        });
        expect(doc('wd-d2').history.filter((h) => h.key === 'docEdited')).toHaveLength(1);
        expect(text(d('document-detail-name'))).toBe('Studio Kern GmbH');
        expect(text(d('field-due'))).toBe('—');
        expect(status()).toBe('Waiting for payment');
      });

      it('saving with nothing changed writes no history line', async () => {
        await render('/documents/wd-d2');
        const before = doc('wd-d2');
        await edit();
        await click(d('edit-save'));
        expect(doc('wd-d2')).toBe(before);
        expect(d('edit-form')).toBeNull();
      });

      it('Cancel throws the changes away', async () => {
        await render('/documents/wd-d2');
        const before = doc('wd-d2');
        await edit();
        await typeIn('edit-name', 'Somebody else');
        await click(d('edit-cancel'));
        expect(doc('wd-d2')).toBe(before);
        expect(d('edit-form')).toBeNull();
        await edit();
        expect((d('edit-name') as HTMLInputElement).value).toBe('Studio Kern');
      });

      it('an amount that is not above 0 shows what is wrong and keeps the form open', async () => {
        await render('/documents/wd-d2');
        const before = doc('wd-d2');
        await edit();
        await typeIn('edit-amount', '0');
        await click(d('edit-save'));
        expect(text(d('edit-error-amount'))).toBe('Type an amount above 0, like 71.39.');
        expect(d('edit-amount')!.getAttribute('aria-invalid')).toBe('true');
        expect(d('edit-form')).not.toBeNull();
        expect(doc('wd-d2')).toBe(before);
      });

      it('a name or date that was there cannot be emptied', async () => {
        await render('/documents/wd-d2');
        const before = doc('wd-d2');
        await edit();
        await typeIn('edit-name', ' ');
        await typeIn('edit-date', '');
        await click(d('edit-save'));
        expect(text(d('edit-error-name'))).toBe('Type the name.');
        expect(text(d('edit-error-date'))).toBe('Pick the date.');
        expect(doc('wd-d2')).toBe(before);
      });

      it('a field that could not be read may stay empty', async () => {
        await render('/documents/wd-d1');
        await edit();
        await typeIn('edit-invoice', 'K-55121');
        await click(d('edit-save'));
        expect(doc('wd-d1')).toMatchObject({ invoiceNo: 'K-55121', amountCents: null });
        expect(status()).toBe('Check amount');
      });

      it('Save writes one history line when tapped twice', async () => {
        await render('/documents/wd-d2');
        await edit();
        await typeIn('edit-name', 'Studio Kern GmbH');
        const save = d('edit-save')!;
        save.click();
        save.click();
        await settle();
        expect(doc('wd-d2').history.filter((h) => h.key === 'docEdited')).toHaveLength(1);
      });

      it('a Kleinunternehmer is not asked for a VAT rate', async () => {
        demo.setBusiness('sara-yoga');
        demo.updateDocument('doc-sy-t2', (x) => ({ ...x, invoice: null })); // as if it was added from a file
        await render('/documents/doc-sy-t2');
        await edit();
        expect(d('edit-vat')).toBeNull();
        await typeIn('edit-name', 'Anna Keller');
        await click(d('edit-save'));
        expect(doc('doc-sy-t2').vatRate).toBe(0);
      });
    });
  });

  describe('booking', () => {
    it('shows the prepared booking of a document that has no payment yet', async () => {
      await render('/documents/wd-d4');
      expect(text(d('booking-label'))).toBe('Office supplies · 4930 Bürobedarf');
      expect(d('booking-hint')).toBeNull();
      expect(text(d('change-category'))).toBe('Change');
    });

    it('Confirm agrees with the suggested booking, and only while it is not confirmed', async () => {
      await render('/documents/wd-d4');
      expect(text(d('confirm-booking'))).toBe('Confirm');
      await click(d('confirm-booking'));
      expect(doc('wd-d4').bookingConfirmed).toBe(true);
      expect(d('confirm-booking')).toBeNull();
      expect(historyTexts()[0]).toBe('You confirmed Office supplies');
      expect(da('history-item')).toHaveLength(3);
    });

    it('Confirm writes one history line when tapped twice', async () => {
      await render('/documents/wd-d4');
      const confirm = d('confirm-booking')!;
      confirm.click();
      confirm.click();
      await settle();
      expect(doc('wd-d4').history.filter((h) => h.key === 'confirmed')).toHaveLength(1);
    });

    it('Change picks another category and confirms it', async () => {
      await render('/documents/wd-d4');
      await click(d('change-category'));
      await click(options('category-option').find((o) => text(o).startsWith('Advertising'))!);
      expect(doc('wd-d4').booking).toEqual(ADVERTISING);
      expect(doc('wd-d4').bookingConfirmed).toBe(true);
      expect(text(d('booking-label'))).toBe('Advertising · 4610 Werbekosten');
      expect(d('confirm-booking')).toBeNull();
      expect(historyTexts()[0]).toBe('You changed the category to Advertising');
    });

    it('picking the category it has confirms it once, and then changes nothing', async () => {
      await render('/documents/wd-d4');
      const pickOffice = async () => {
        await click(d('change-category'));
        await click(options('category-option').find((o) => text(o).startsWith('Office'))!);
      };
      await pickOffice();
      expect(doc('wd-d4').bookingConfirmed).toBe(true);
      expect(doc('wd-d4').history.filter((h) => h.key === 'confirmed')).toHaveLength(1);
      const before = doc('wd-d4');
      await pickOffice();
      expect(doc('wd-d4')).toBe(before);
    });

    it('a document with no category is asked for one', async () => {
      await render('/documents/wd-d4');
      demo.updateDocument('wd-d4', (x) => ({ ...x, booking: null, bookingConfirmed: false }));
      await settle();
      expect(text(d('booking-label'))).toBe('No category yet');
      expect(text(d('change-category'))).toBe('Choose');
      expect(d('confirm-booking')).toBeNull();
    });

    it('a linked document shows the booking of its payment, and Change changes that one', async () => {
      await render('/documents/wd-d4');
      await click(inside(da('payment-suggestion')[0], 'link-payment'));
      expect(text(d('booking-label'))).toBe('Office supplies · 4930 Bürobedarf');
      expect(text(d('booking-hint'))).toBe(
        'This is the booking of the linked payment. Changing it here changes it there too.',
      );
      await click(d('change-category'));
      await click(options('category-option').find((o) => text(o).startsWith('Advertising'))!);
      expect(tx('wd-t17').booking).toEqual(ADVERTISING);
      expect(tx('wd-t17').history[0].key).toBe('categoryChanged');
      expect(text(d('booking-label'))).toBe('Advertising · 4610 Werbekosten');
      // the booking the document prepared is left as it was until it is unlinked
      expect(doc('wd-d4').booking).toEqual(OFFICE);
      expect(historyTexts()[0]).toBe('You linked it to the SCHREIBWAREN BOETTCHER payment');
    });

    it('Confirm on a linked document confirms the booking of the payment, and the document stays Done', async () => {
      await render('/documents/doc-wd-t1');
      expect(tx('wd-t1').confirmed).toBe(false);
      expect(status()).toBe('Done');
      await click(d('confirm-booking'));
      expect(tx('wd-t1').confirmed).toBe(true);
      expect(tx('wd-t1').history[0].key).toBe('confirmed');
      expect(d('confirm-booking')).toBeNull();
      expect(status()).toBe('Done');
    });

    it('Confirm on a linked document writes one history line when tapped twice', async () => {
      await render('/documents/doc-wd-t1');
      const confirm = d('confirm-booking')!;
      confirm.click();
      confirm.click();
      await settle();
      expect(tx('wd-t1').history.filter((h) => h.key === 'confirmed')).toHaveLength(1);
    });
  });

  describe('payment', () => {
    it('suggests the payments it might be, best first, each with This one', async () => {
      await render('/documents/wd-d4');
      expect(text(d('payment-intro'))).toBe('No payment yet. These might be it:');
      const suggestions = da('payment-suggestion');
      expect(suggestions).toHaveLength(3); // the two payments with no receipt, and the APCOA parking (wd-t20) that has none either
      expect(text(inside(suggestions[0], 'suggestion-name'))).toBe('SCHREIBWAREN BOETTCHER');
      expect(inside(suggestions[0], 'suggestion-name')!.getAttribute('dir')).toBe('auto');
      expect(text(inside(suggestions[0], 'suggestion-amount'))).toBe(
        formatMoney(-2380, 'en', { signed: true }),
      );
      expect(inside(suggestions[0], 'suggestion-amount')!.closest('bdi')!.getAttribute('dir')).toBe(
        'ltr',
      );
      expect(text(inside(suggestions[0], 'suggestion-meta'))).toBe('8 Oct · Qonto');
      expect(text(inside(suggestions[0], 'suggestion-reference'))).toBe('Kartenzahlung 08.10.');
      expect(
        inside(suggestions[0], 'suggestion-reference')!.closest('bdi')!.getAttribute('dir'),
      ).toBe('ltr');
      expect(text(inside(suggestions[1], 'suggestion-name'))).toBe('Deutsche Bahn');
      expect(text(inside(suggestions[2], 'suggestion-name'))).toBe('APCOA Parking');
      expect(text(inside(suggestions[0], 'link-payment'))).toBe('This one');
    });

    it('suggests at most three, and Search all payments lists every one', async () => {
      loseReceipts('wd-t2', 'wd-t5', 'wd-t8');
      await render('/documents/wd-d4');
      expect(da('payment-suggestion')).toHaveLength(3);
      await click(d('search-payments'));
      expect(options('payment-picker-option')).toHaveLength(6); // wd-t17, wd-t3, wd-t20 and the three that lost their receipt
    });

    it("suggests Kern Studio Berlin's payment, which has no receipt yet, for Studio Kern's invoice", async () => {
      await render('/documents/wd-d2');
      expect(text(d('payment-intro'))).toBe('No payment yet. These might be it:');
      const suggestions = da('payment-suggestion');
      expect(suggestions).toHaveLength(1);
      expect(text(inside(suggestions[0], 'suggestion-name'))).toBe('Kern Studio Berlin');
    });

    it('says so when there is no matching payment, and keeps the other ways', async () => {
      // Kern Studio Berlin's payment (wd-t19) is the match for this invoice; with its receipt not needed, no payment is left.
      demo.updateTransaction('wd-t19', (t) => ({ ...t, receipt: 'notNeeded' }));
      await render('/documents/wd-d2');
      expect(text(d('payment-intro'))).toBe('No payment yet.');
      expect(text(d('payment-none'))).toBe('No matching payments yet');
      expect(da('payment-suggestion')).toHaveLength(0);
      expect(d('search-payments')).not.toBeNull();
      expect(d('pay-in-invoice')).not.toBeNull(); // wd-d2 is the document of an invoice, which has its own Mark as paid
    });

    it('suggests nothing while no bank is connected', async () => {
      demo.setSetup('new');
      demo.addDocument('weber-design', {
        ...doc('wd-d4'),
        id: 'up-1',
        fromUpload: true,
        name: 'Böttcher Bürobedarf',
      });
      await render('/documents/up-1');
      expect(da('payment-suggestion')).toHaveLength(0);
      expect(text(d('payment-none'))).toBe('No matching payments yet');
      expect(status()).toBe('Waiting for payment');
      await click(d('search-payments'));
      expect(options('payment-picker-option')).toHaveLength(0);
      expect(text(inBody('payment-picker-empty'))).toBe('No payments match');
    });

    it('This one links Böttcher and wd-t17 shows Booked', async () => {
      await render('/documents/wd-d4');
      const suggestions = da('payment-suggestion');
      expect(text(inside(suggestions[0], 'suggestion-name'))).toBe('SCHREIBWAREN BOETTCHER');
      await click(inside(suggestions[0], 'link-payment'));
      expect(doc('wd-d4').paymentId).toBe('wd-t17');
      expect(status()).toBe('Done');
      expect(da('payment-suggestion')).toHaveLength(0);
      expect(d('payment-intro')).toBeNull();
      expect(historyTexts()[0]).toBe('You linked it to the SCHREIBWAREN BOETTCHER payment');

      await harness.navigateByUrl('/payments/wd-t17');
      await settle();
      expect(text(onPayment('tx-status'))).toBe('Booked');
      expect(text(onPayment('receipt-state'))).toBe('boettcher-quittung.pdf');
      expect(plain(onPayment('history-text'))).toBe('You linked the document Böttcher Bürobedarf');
    });

    it('linking twice writes one history line', async () => {
      await render('/documents/wd-d4');
      const button = inside(da('payment-suggestion')[0], 'link-payment')!;
      // two taps before the page has redrawn, as a slow device repeats a click
      button.click();
      button.click();
      await settle();
      expect(doc('wd-d4').history.filter((h) => h.key === 'linked')).toHaveLength(1);
      expect(tx('wd-t17').history.filter((h) => h.key === 'receiptLinked')).toHaveLength(1);
      expect(historyTexts().filter((t) => t.startsWith('You linked it to'))).toHaveLength(1);
      expect(doc('wd-d4').history).toHaveLength(3);
      expect(tx('wd-t17').history).toHaveLength(3);
    });

    it('two taps on two different payments link only the first', async () => {
      await render('/documents/wd-d4');
      const [first, second] = da('payment-suggestion').map((s) => inside(s, 'link-payment')!);
      first.click();
      second.click();
      await settle();
      expect(doc('wd-d4').paymentId).toBe('wd-t17');
      expect(tx('wd-t3').receipt).toBe('missing');
      expect(tx('wd-t3').history.filter((h) => h.key === 'receiptLinked')).toHaveLength(0);
    });

    it('shows the linked payment with a way to open it, and Not this payment', async () => {
      await render('/documents/wd-d4');
      await click(inside(da('payment-suggestion')[0], 'link-payment'));
      const linked = d('linked-payment')!;
      expect(linked.getAttribute('href')).toBe('/payments/wd-t17');
      expect(text(inside(linked, 'linked-name'))).toBe('SCHREIBWAREN BOETTCHER');
      expect(text(inside(linked, 'linked-amount'))).toBe(
        formatMoney(-2380, 'en', { signed: true }),
      );
      expect(inside(linked, 'linked-amount')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(inside(linked, 'linked-meta'))).toBe('8 Oct · Qonto');
      expect(text(d('unlink-payment'))).toBe('Not this payment');
    });

    it('the linked payment of the cash box is named in the language of the page', async () => {
      await render('/documents/wd-d4');
      loseReceipts('wd-t15');
      demo.updateTransaction('wd-t15', (t) => ({ ...t, isPrivate: false }));
      await click(d('search-payments'));
      await click(options('payment-picker-option').find((o) => text(o).includes('Edeka'))!);
      expect(text(inside(d('linked-payment'), 'linked-meta'))).toBe('14 Aug · Cash box');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(inside(d('linked-payment'), 'linked-meta'))).toBe(
        `${formatDate('2026-08-14', 'de')} · Kasse`,
      );
    });

    it('names the account of a suggested, a linked and a searched payment by its bank and product, in every language', async () => {
      onSavings('wd-t17');
      await render('/documents/wd-d4');
      expect(text(inside(da('payment-suggestion')[0], 'suggestion-meta'))).toBe('8 Oct · Qonto · Savings');
      await click(d('search-payments'));
      expect(text(inside(options('payment-picker-option')[0], 'picker-meta'))).toBe('8 Oct · Qonto · Savings');
      await click(options('payment-picker-option')[0]);
      expect(text(inside(d('linked-payment'), 'linked-meta'))).toBe('8 Oct · Qonto · Savings');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(inside(d('linked-payment'), 'linked-meta'))).toBe(
        `${formatDate('2026-10-08', 'de')} · Qonto · Sparkonto`,
      );
    });

    it('Not this payment brings Receipt missing back', async () => {
      await render('/documents/wd-d4');
      await click(inside(da('payment-suggestion')[0], 'link-payment'));
      await click(d('unlink-payment'));
      expect(doc('wd-d4').paymentId).toBeNull();
      expect(status()).toBe('Waiting for payment');
      expect(d('linked-payment')).toBeNull();
      expect(da('payment-suggestion')).toHaveLength(3);
      expect(historyTexts()[0]).toBe('You unlinked it from the SCHREIBWAREN BOETTCHER payment');

      await harness.navigateByUrl('/payments/wd-t17');
      await settle();
      expect(text(onPayment('tx-status'))).toBe('Receipt missing');
      expect(text(onPayment('receipt-state'))).toBe('Receipt missing');
      expect(plain(onPayment('history-text'))).toBe(
        'You unlinked the document Böttcher Bürobedarf',
      );
    });

    it('Not this payment writes one history line when tapped twice', async () => {
      await render('/documents/wd-d4');
      await click(inside(da('payment-suggestion')[0], 'link-payment'));
      const unlink = d('unlink-payment')!;
      unlink.click();
      unlink.click();
      await settle();
      expect(doc('wd-d4').history.filter((h) => h.key === 'unlinked')).toHaveLength(1);
      expect(tx('wd-t17').history.filter((h) => h.key === 'receiptUnlinked')).toHaveLength(1);
    });

    describe('Paid in cash or with my own money', () => {
      const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
      const inDialog = (testId: string) =>
        dialog()?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;

      async function expectDialog(open: boolean): Promise<void> {
        await vi.waitFor(async () => {
          await settle();
          expect(dialog() !== null).toBe(open);
        });
      }

      /** Opens the pop-up, picks a way, and presses Done. */
      async function payAs(how: 'cash' | 'own'): Promise<void> {
        await click(d('cash-payment'));
        await expectDialog(true);
        inDialog(`paid-how-${how}`)!.querySelector('input')!.click();
        await settle();
        inDialog('paid-done')!.click();
        await expectDialog(false);
      }

      it('is a button for a received receipt that waits for its payment, and it opens the pop-up instead of a page of its own', async () => {
        await render('/documents/wd-d7');
        const cash = d('cash-payment')!;
        expect(cash.tagName).toBe('BUTTON');
        expect(text(cash)).toBe('Paid in cash or with my own money');
        expect(cash.getAttribute('aria-haspopup')).toBe('dialog');
        expect(d('pay-in-invoice')).toBeNull();
        await expectDialog(false);

        await click(cash);
        await expectDialog(true);
        expect(text(inDialog('paid-title'))).toBe('How was it paid?');
        expect(TestBed.inject(Router).url).toBe('/documents/wd-d7');
      });

      it('is offered for the other waiting receipts too, and not where it does not fit', async () => {
        await render('/documents/wd-d4'); // Böttcher: a received receipt with payments it might be
        expect(d('cash-payment')).not.toBeNull();

        await render('/documents/wd-d3'); // a sent document that is not an invoice written here
        expect(d('cash-payment')).toBeNull();
        await render('/documents/wd-d2'); // a sent invoice keeps its own Mark as paid, in Invoices
        expect(d('cash-payment')).toBeNull();
        expect(d('pay-in-invoice')!.getAttribute('href')).toBe('/invoices/inv-wd-044');
        await render('/documents/wd-d1'); // a photo whose amount is not read yet
        expect(d('cash-payment')).toBeNull();
        await render('/documents/doc-wd-t2'); // a receipt that has its payment
        expect(d('cash-payment')).toBeNull();
      });

      it("is offered for Sara's receipt too, and makes the payment with no VAT and a cash box of her own", async () => {
        demo.setBusiness('sara-yoga');
        await render('/documents/sy-d3');
        expect(d('cash-payment')).not.toBeNull();
        await payAs('cash');
        expect(tx('paid-sy-d3')).toMatchObject({ accountId: 'sara-yoga-cash', amountCents: -8900 });
        expect(tx('paid-sy-d3').booking!.vatRate).toBe(0);
        expect(text(inside(d('linked-payment'), 'linked-meta'))).toBe('12 Oct · Cash box');
      });

      it('in cash: the payment is on the cash box, the receipt is Done and linked, and the page says so with Undo', async () => {
        await render('/documents/wd-d7');
        await payAs('cash');

        expect(doc('wd-d7').paymentId).toBe('paid-wd-d7');
        expect(tx('paid-wd-d7')).toMatchObject({ accountId: 'wd-cash', amountCents: -1850, date: '2026-10-19', receipt: 'attached' });
        expect(status()).toBe('Done');
        expect(text(d('paid-undo-text'))).toBe('Marked as paid in cash');
        expect(text(d('undo-paid'))).toBe('Undo');
        expect(d('paid-undo')!.closest('[role="status"]')).not.toBeNull();
        expect(d('cash-payment')).toBeNull();
        const linked = d('linked-payment')!;
        expect(linked.getAttribute('href')).toBe('/payments/paid-wd-d7');
        expect(plain(inside(linked, 'linked-name'))).toBe('Copyshop Kreuzberg');
        expect(text(inside(linked, 'linked-meta'))).toBe('19 Oct · Cash box');
        expect(text(inside(linked, 'linked-amount'))).toBe(formatMoney(-1850, 'en', { signed: true }));
        expect(text(d('booking-label'))).toContain('4930');
        expect(d('confirm-booking')).toBeNull(); // confirmed with the payment
        expect(historyTexts()[0]).toBe('You linked it to the Copyshop Kreuzberg payment');
      });

      it('with my own money: the payment is on the Own money account, which the page names', async () => {
        await render('/documents/wd-d7');
        await payAs('own');

        expect(tx('paid-wd-d7').accountId).toBe('weber-design-own');
        expect(text(d('paid-undo-text'))).toBe('Marked as paid with your own money');
        expect(text(inside(d('linked-payment'), 'linked-meta'))).toBe('19 Oct · Own money');
        TestBed.inject(LanguageService).setLang('de');
        await settle();
        expect(text(inside(d('linked-payment'), 'linked-meta'))).toBe(`${formatDate('2026-10-19', 'de')} · Eigenes Geld`);
        expect(text(d('paid-undo-text'))).toBe('Als mit eigenem Geld bezahlt markiert');
        expect(text(d('undo-paid'))).toBe('Rückgängig');
      });

      it('the payment is locked to its receipt: no "Not this payment", and a line says why', async () => {
        await render('/documents/wd-d7');
        expect(d('payment-locked')).toBeNull();
        await payAs('cash');

        expect(d('unlink-payment')).toBeNull();
        expect(text(d('payment-locked'))).toBe('This payment was made from this receipt, so the two stay together.');
        // ... and not for an ordinary payment that was linked by hand
        await render('/documents/wd-d4');
        await click(inside(da('payment-suggestion')[0], 'link-payment'));
        expect(d('unlink-payment')).not.toBeNull();
        expect(d('payment-locked')).toBeNull();
      });

      it('the receipt stays with its payment after the 5 seconds are over: Undo goes, the lock stays', async () => {
        await render('/documents/wd-d7');
        // Fake timers only from here, and no waiting on the router: the offer and the page both follow signals, which draw at once.
        vi.useFakeTimers();
        TestBed.inject(ReceiptService).markPaid('wd-d7', 'cash', '2026-10-19');
        harness.detectChanges();
        expect(d('undo-paid')).not.toBeNull();

        vi.advanceTimersByTime(5000);
        harness.detectChanges();

        expect(d('paid-undo')).toBeNull();
        expect(d('undo-paid')).toBeNull();
        expect(d('unlink-payment')).toBeNull();
        expect(text(d('payment-locked'))).toContain('stay together');
        expect(doc('wd-d7').paymentId).toBe('paid-wd-d7');
      });

      it('Undo within 5 seconds takes the payment away and the receipt waits again, ready to be paid', async () => {
        await render('/documents/wd-d7');
        const payments = demo.business().transactions.length;
        await payAs('own');
        expect(demo.business().transactions).toHaveLength(payments + 1);

        await click(d('undo-paid'));

        expect(demo.business().transactions).toHaveLength(payments);
        expect(doc('wd-d7').paymentId).toBeNull();
        expect(status()).toBe('Waiting for payment');
        expect(d('paid-undo')).toBeNull();
        expect(d('linked-payment')).toBeNull();
        expect(d('cash-payment')).not.toBeNull();
        expect(historyTexts()).not.toContain('You linked it to the Copyshop Kreuzberg payment');
      });

      it('the Undo notice is only on the receipt that was paid', async () => {
        await render('/documents/wd-d7');
        await payAs('cash');
        await render('/documents/wd-d4');
        expect(d('paid-undo')).toBeNull();
        await render('/documents/wd-d7');
        expect(d('paid-undo')).not.toBeNull();
      });

      it('Cancel makes no payment, and Done makes one', async () => {
        await render('/documents/wd-d7');
        const payments = demo.business().transactions.length;
        await click(d('cash-payment'));
        await expectDialog(true);
        inDialog('paid-cancel')!.click();
        await expectDialog(false);
        expect(demo.business().transactions).toHaveLength(payments);

        await payAs('cash');
        expect(demo.business().transactions).toHaveLength(payments + 1);
      });
    });

    describe('Search all payments', () => {
      it('opens a searchable list of every payment it could be', async () => {
        await render('/documents/wd-d4');
        await click(d('search-payments'));
        expect(text(d('search-payments'))).toBe('Search all payments');
        const rows = options('payment-picker-option');
        expect(rows.map((r) => text(inside(r, 'picker-name')))).toEqual([
          'SCHREIBWAREN BOETTCHER',
          'Deutsche Bahn',
          'APCOA Parking',
        ]);
        expect(text(inside(rows[0], 'picker-amount'))).toBe(
          formatMoney(-2380, 'en', { signed: true }),
        );
        expect(inside(rows[0], 'picker-amount')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
        expect(text(inside(rows[0], 'picker-meta'))).toBe('8 Oct · Qonto');
      });

      it('finds a payment by its name', async () => {
        await render('/documents/wd-d4');
        await click(d('search-payments'));
        const search = inBody('payment-search') as HTMLInputElement;
        search.value = 'bahn';
        search.dispatchEvent(new Event('input'));
        await settle();
        expect(options('payment-picker-option').map((r) => text(inside(r, 'picker-name')))).toEqual(
          ['Deutsche Bahn'],
        );
      });

      it.each(['120', '120,00', '120.00'])(
        'finds a payment by its amount typed as %s',
        async (typed) => {
          await render('/documents/wd-d4');
          await click(d('search-payments'));
          const search = inBody('payment-search') as HTMLInputElement;
          search.value = typed;
          search.dispatchEvent(new Event('input'));
          await settle();
          expect(
            options('payment-picker-option').map((r) => text(inside(r, 'picker-name'))),
          ).toEqual(['Deutsche Bahn']);
        },
      );

      it('says so when nothing matches', async () => {
        await render('/documents/wd-d4');
        await click(d('search-payments'));
        const search = inBody('payment-search') as HTMLInputElement;
        search.value = 'zzz';
        search.dispatchEvent(new Event('input'));
        await settle();
        expect(options('payment-picker-option')).toHaveLength(0);
        expect(text(inBody('payment-picker-empty'))).toBe('No payments match');
      });

      it('choosing one links it, the same as This one', async () => {
        await render('/documents/wd-d4');
        await click(d('search-payments'));
        await click(
          options('payment-picker-option').find((r) => text(r).includes('Deutsche Bahn'))!,
        );
        expect(doc('wd-d4').paymentId).toBe('wd-t3');
        expect(status()).toBe('Done');
        expect(text(inside(d('linked-payment'), 'linked-name'))).toBe('Deutsche Bahn');
        expect(tx('wd-t3').receipt).toBe('attached');
        expect(tx('wd-t3').history[0].key).toBe('receiptLinked');
        expect(inBody('payment-picker-option')).toBeNull();
      });

      it('shows the whole list again the next time it opens', async () => {
        await render('/documents/wd-d4');
        await click(d('search-payments'));
        const search = inBody('payment-search') as HTMLInputElement;
        search.value = 'bahn';
        search.dispatchEvent(new Event('input'));
        await settle();
        await click(d('search-payments')); // closes it
        expect(inBody('payment-search')).toBeNull();
        await click(d('search-payments'));
        expect((inBody('payment-search') as HTMLInputElement).value).toBe('');
        expect(options('payment-picker-option')).toHaveLength(3);
      });
    });
  });

  describe('an invoice written in Invoices', () => {
    /** The text of a node with the marks that keep an amount or a number in its own direction taken out. */
    const bare = (node: Element | null | undefined) => plain(node).replace(/[⁦⁩]/g, '');

    it("an invoice's document is locked and opens the invoice", async () => {
      await render('/documents/wd-d2');
      expect(text(d('written-in-invoices'))).toContain('Written in Invoices');
      const open = d('open-invoice')!;
      expect(text(open)).toBe('Open invoice');
      expect(open.getAttribute('href')).toBe('/invoices/inv-wd-044');
      expect(d('edit-fields')).toBeNull();
      expect(d('remove-document')).toBeNull();
      expect(d('change-category')).toBeNull();

      // the same for a paid invoice, whose document is linked to the payment that paid it
      await render('/documents/doc-wd-t1');
      expect(d('open-invoice')!.getAttribute('href')).toBe('/invoices/inv-wd-041');
      expect(d('edit-fields')).toBeNull();
      expect(d('remove-document')).toBeNull();
      expect(d('change-category')).toBeNull();
      expect(d('linked-payment')!.getAttribute('href')).toBe('/payments/wd-t1');
      expect(d('unlink-payment')).toBeNull();
    });

    it('a document that was not written in Invoices keeps Edit, Remove and Change', async () => {
      await render('/documents/wd-d4');
      expect(d('written-in-invoices')).toBeNull();
      expect(d('open-invoice')).toBeNull();
      expect(d('edit-fields')).not.toBeNull();
      expect(d('remove-document')).not.toBeNull();
      expect(d('change-category')).not.toBeNull();
    });

    it('still confirms the booking of the payment that paid the invoice', async () => {
      await render('/documents/doc-wd-t1');
      expect(tx('wd-t1').confirmed).toBe(false);
      await click(d('confirm-booking'));
      expect(tx('wd-t1').confirmed).toBe(true);
    });

    it('a cancelled invoice and its cancellation invoice are Done, open their own invoices and need no payment', async () => {
      await render('/documents/wd-d5');
      expect(bare(d('doc-status'))).toBe('Done · Cancelled');
      expect(d('open-invoice')!.getAttribute('href')).toBe('/invoices/inv-wd-040');
      expect(text(d('payment-closed'))).toBe('This invoice was cancelled, so no payment is needed.');
      expect(da('payment-suggestion')).toHaveLength(0);
      expect(d('payment-intro')).toBeNull();
      expect(d('search-payments')).toBeNull();
      expect(d('cash-payment')).toBeNull();
      expect(d('edit-fields')).toBeNull();
      expect(d('remove-document')).toBeNull();

      await render('/documents/wd-d6');
      expect(bare(d('doc-status'))).toBe('Cancellation of RE-2026-040');
      expect(d('open-invoice')!.getAttribute('href')).toBe('/invoices/inv-wd-042');
      expect(text(d('payment-closed'))).toBe('A cancellation invoice needs no payment.');
      expect(d('search-payments')).toBeNull();
      expect(d('cash-payment')).toBeNull();
    });

    it('the steps of a cancelled invoice end as closed, not as waiting for a payment', async () => {
      await render('/documents/wd-d5');
      expect(stepStates()).toEqual([
        ['Read', 'done'],
        ['Booked', 'done'],
        ['Closed', 'done'],
      ]);
      await render('/documents/wd-d6');
      expect(stepStates()[2]).toEqual(['Closed', 'done']);
    });

    it('a partly paid invoice says what is left, and its payment section shows what came in instead of looking for a first payment', async () => {
      demo.setBusiness('sara-yoga');
      await render('/documents/sy-d2');
      expect(bare(d('doc-status'))).toBe(`Waiting for payment · ${formatMoney(30000, 'en')} left`);
      expect(d('open-invoice')!.getAttribute('href')).toBe('/invoices/inv-sy-021');
      expect(d('payment-closed')).toBeNull();

      // It does not say "No payment yet": the payment that came in is there, and no list of payments it might be.
      expect(text(d('payment-section'))).not.toContain('No payment yet');
      expect(d('payment-intro')).toBeNull();
      expect(text(d('payment-part'))).toBe('Part paid so far:');
      expect(da('payment-suggestion')).toHaveLength(0);
      expect(da('link-payment')).toHaveLength(0);
      const received = da('linked-payment');
      expect(received).toHaveLength(1);
      expect(received[0].getAttribute('href')).toBe('/payments/sy-t15');
      expect(plain(inside(received[0], 'linked-name'))).toBe('Physio Zentrum Mitte');
      expect(text(inside(received[0], 'linked-amount'))).toBe(formatMoney(30000, 'en', { signed: true }));
      expect(da('unlink-payment')).toHaveLength(0);

      // The rest can still be found by searching, and the invoice is where cash is marked.
      expect(d('search-payments')).not.toBeNull();
      expect(d('cash-payment')).toBeNull();
      expect(d('pay-in-invoice')!.getAttribute('href')).toBe('/invoices/inv-sy-021');
    });

    it('every payment that came in on a partly paid invoice is listed, the first one first', async () => {
      demo.setBusiness('sara-yoga');
      demo.addTransaction({ ...tx('sy-t15'), id: 'sy-more', amountCents: 10000, receipt: 'missing', receiptFile: null, history: [] });
      demo.linkInvoicePayment('inv-sy-021', 'sy-more', false);
      expect(doc('sy-d2').paymentId).toBeNull(); // 300 + 100 of 600: still part paid
      await render('/documents/sy-d2');
      expect(bare(d('doc-status'))).toBe(`Waiting for payment · ${formatMoney(20000, 'en')} left`);
      expect(da('linked-payment').map((link) => link.getAttribute('href'))).toEqual(['/payments/sy-t15', '/payments/sy-more']);
    });

    it('an invoice with nothing paid yet still offers the payments it might be, and leads to the invoice for cash', async () => {
      await render('/documents/wd-d2');
      expect(d('payment-part')).toBeNull();
      expect(text(d('payment-intro'))).toBe('No payment yet. These might be it:');
      expect(da('payment-suggestion').length).toBeGreaterThan(0);
      expect(d('search-payments')).not.toBeNull();
    });

    it("sent invoices keep their own Mark as paid link: Paid in cash or with my own money is not offered on an invoice's document, which links to its invoice", async () => {
      await render('/documents/wd-d2');
      expect(d('cash-payment')).toBeNull();
      const link = d('pay-in-invoice')!;
      expect(text(link)).toBe('Paid in cash? Mark it in the invoice');
      expect(link.getAttribute('href')).toBe('/invoices/inv-wd-044');

      // A cancelled invoice, a cancellation invoice and a paid one need no payment: neither is offered.
      for (const id of ['wd-d5', 'wd-d6', 'doc-wd-t1']) {
        await render(`/documents/${id}`);
        expect(d('cash-payment'), id).toBeNull();
        expect(d('pay-in-invoice'), id).toBeNull();
      }

      // A document that is not an invoice written here keeps it.
      await render('/documents/wd-d4');
      expect(text(d('cash-payment'))).toBe('Paid in cash or with my own money');
      expect(d('pay-in-invoice')).toBeNull();
    });

    it('the hint on an invoice document does not talk of cancelling: it fits an open, a paid, a cancelled and a cancellation invoice', async () => {
      const hint = "This document can't be changed or removed here. Open the invoice to work with it.";
      for (const id of ['wd-d2', 'doc-wd-t1', 'wd-d5', 'wd-d6']) {
        await render(`/documents/${id}`);
        expect(text(d('written-in-invoices')), id).toBe(`Written in Invoices ${hint} Open invoice`);
      }
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('written-in-invoices'))).toContain(de.documents.detail.written.hint);
      expect(de.documents.detail.written.hint).not.toMatch(/storn/i);
    });

    it('This one on the document of an open invoice pays the invoice, and the document is Done', async () => {
      await render('/documents/wd-d2');
      await click(inside(da('payment-suggestion')[0], 'link-payment'));
      expect(doc('wd-d2').paymentId).toBe('wd-t19');
      expect(demo.business().invoices.find((i) => i.id === 'inv-wd-044')!.paymentIds).toEqual(['wd-t19']);
      expect(status()).toBe('Done');
      expect(tx('wd-t19').history[0].key).toBe('paysInvoice');
      expect(d('linked-payment')!.getAttribute('href')).toBe('/payments/wd-t19');
      expect(d('unlink-payment')).toBeNull();
      expect(d('remove-document')).toBeNull();
    });
  });

  describe('a self-issued receipt', () => {
    /** Writes the self-issued receipt for the APCOA Parking payment, as the form does, and returns the id of its document. */
    function write(): string {
      return TestBed.inject(ReceiptService).createSelfIssued(
        'wd-t20',
        { purpose: 'Parking', reason: 'machine', reasonText: null, address: null },
        'payment',
      )!;
    }

    it('documents shows Self-issued, locked', async () => {
      const id = write();
      await render(`/documents/${id}`);

      expect(text(d('doc-status'))).toBe('Done · Self-issued');
      expect(text(d('self-issued-box'))).toBe(
        "Self-issued receipt (Eigenbeleg) You wrote this receipt, so it can't be changed or removed. Print it for your records or the tax office. Print",
      );
      const print = d('print-self-issued')!;
      expect(print.tagName).toBe('A');
      expect(text(print)).toBe('Print');
      expect(print.getAttribute('href')).toBe(`/print/self-issued/${id}`);
      expect(text(d('document-detail-name'))).toBe('APCOA Parking');
      expect(text(d('document-detail-invoice'))).toBe('EB-2026-001');

      // Locked like an invoice's document: nothing to edit, remove, re-categorise or unlink.
      expect(d('edit-fields')).toBeNull();
      expect(d('remove-document')).toBeNull();
      expect(d('change-category')).toBeNull();
      expect(d('unlink-payment')).toBeNull();
      expect(d('linked-payment')!.getAttribute('href')).toBe('/payments/wd-t20');
      expect(text(d('field-vat'))).toBe('No VAT');
      expect(historyTexts()).toEqual([
        `You linked it to the APCOA Parking payment`,
        'You wrote the self-issued receipt EB-2026-001',
      ]);
    });

    it('a document that is not self-issued has no such box, and keeps Print out', async () => {
      await render('/documents/wd-d4');
      expect(d('self-issued-box')).toBeNull();
      expect(d('print-self-issued')).toBeNull();
    });

    it('still confirms the category of the payment: writing the receipt did not', async () => {
      demo.updateTransaction('wd-t20', (t) => ({ ...t, confirmed: false }));
      const id = write();
      await render(`/documents/${id}`);
      expect(tx('wd-t20').confirmed).toBe(false);

      await click(d('confirm-booking'));

      expect(tx('wd-t20').confirmed).toBe(true);
      expect(tx('wd-t20').booking!.vatRate).toBe(0);
    });

    it('words follow the language', async () => {
      const id = write();
      TestBed.inject(LanguageService).setLang('de');
      await render(`/documents/${id}`);
      expect(text(d('doc-status'))).toBe(de.documents.status.doneSelfIssued);
      expect(text(d('self-issued-box'))).toBe(
        `Eigenbeleg ${de.documents.detail.selfIssued.hint} ${de.documents.detail.selfIssued.print}`,
      );
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(d('self-issued-box'))).not.toContain('selfIssued');
      expect(text(d('self-issued-box'))).toContain('Eigenbeleg');
    });

    describe('a real receipt that turns up later', () => {
      /** The receipt of the parking, scanned later: waiting, received, the payment's amount and name. */
      const turnUp = (): void =>
        demo.updateDocument('wd-d4', (doc) => ({ ...doc, name: 'APCOA Parking GmbH', amountCents: 650 }));

      it('a later real receipt says the payment already has one', async () => {
        write();
        turnUp();
        await render('/documents/wd-d4');

        expect(text(d('payment-self-issued'))).toBe(
          'This payment already has a self-issued receipt.',
        );
        expect(inside(d('payment-section'), 'linked-payment')!.getAttribute('href')).toBe(
          '/payments/wd-t20',
        );
        // It can't be linked to that payment: the payment is not offered as a match.
        expect(da('payment-suggestion').map((s) => text(inside(s, 'suggestion-name')))).not.toContain(
          'APCOA Parking',
        );
      });

      it('says nothing before the receipt is written, or for another document', async () => {
        turnUp();
        await render('/documents/wd-d4');
        expect(d('payment-self-issued')).toBeNull();
        // The APCOA payment is an ordinary match then.
        expect(da('payment-suggestion').map((s) => text(inside(s, 'suggestion-name')))).toContain(
          'APCOA Parking',
        );

        write();
        await render('/documents/wd-d1');
        expect(d('payment-self-issued')).toBeNull();
      });

      it('goes in German too', async () => {
        write();
        turnUp();
        TestBed.inject(LanguageService).setLang('de');
        await render('/documents/wd-d4');
        expect(text(d('payment-self-issued'))).toBe(de.documents.detail.payment.hasSelfIssued);
      });
    });
  });

  describe('history and Remove', () => {
    it('lists what happened, newest first', async () => {
      await render('/documents/wd-d4');
      expect(historyTexts()).toEqual([
        'Read automatically, suggested Office supplies',
        'File added',
      ]);
      expect(text(inside(da('history-item')[0], 'history-date'))).toBe('8 Oct');
    });

    it('history lines with a name follow the language', async () => {
      await render('/documents/wd-d4');
      await click(inside(da('payment-suggestion')[0], 'link-payment'));
      expect(historyTexts()[0]).toBe('You linked it to the SCHREIBWAREN BOETTCHER payment');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(historyTexts()[0]).toBe(
        de.history.linked.replace('{{name}}', 'SCHREIBWAREN BOETTCHER'),
      );
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      // a Latin name inside an Arabic sentence keeps its order
      expect(text(inside(da('history-item')[0], 'history-text'))).toContain(
        `${FIRST_STRONG_ISOLATE}SCHREIBWAREN BOETTCHER${POP_ISOLATE}`,
      );
    });

    it('Remove takes an unlinked document out and goes back to the list', async () => {
      await render('/documents/wd-d4');
      expect(text(d('remove-document'))).toBe('Remove');
      await click(d('remove-document'));
      expect(demo.documents().some((x) => x.id === 'wd-d4')).toBe(false);
      expect(TestBed.inject(Router).url).toBe('/documents');
      expect(q('document-detail')).toBeNull();
    });

    it('a linked document has no Remove, until it is unlinked', async () => {
      await render('/documents/doc-wd-t2');
      expect(d('remove-document')).toBeNull();
      await click(d('unlink-payment'));
      expect(d('remove-document')).not.toBeNull();
    });
  });

  describe('languages', () => {
    it.each(['de', 'ar'] as const)('has no missing translation in %s', async (lang) => {
      TestBed.inject(LanguageService).setLang(lang);
      for (const url of [
        '/documents/wd-d1',
        '/documents/wd-d4',
        '/documents/wd-d2',
        '/documents/doc-wd-t1',
        '/documents/wd-d5',
        '/documents/wd-d6',
      ]) {
        await render(url);
        if (d('edit-fields')) await click(d('edit-fields'));
        const shown = text(detail());
        expect(shown, url).not.toMatch(
          /\b(documents|payments|terms|history|booking|account)\.[a-z]/,
        );
      }
    });

    it('Arabic keeps amounts, invoice numbers and file names left-to-right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/documents/wd-d4');
      expect(d('document-detail-amount')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(d('field-type'))).toBe('مستلم (Eingangsbeleg)');
      expect(d('field-invoice')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(d('field-amount')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
    });
  });
});
