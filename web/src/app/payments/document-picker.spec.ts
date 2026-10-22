import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { Doc } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { DemoStateService } from '../state/demo-state.service';
import { DocumentPicker, matchDocuments } from './document-picker';

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
const docs = weber.documents;
const doc = (id: string): Doc => docs.find((d) => d.id === id)!;

describe('matchDocuments', () => {
  const candidates = [doc('wd-d4'), doc('wd-d1'), doc('wd-d2')];

  it('keeps every document, in the given order, while nothing is typed', () => {
    expect(matchDocuments(candidates, '').map((d) => d.id)).toEqual(['wd-d4', 'wd-d1', 'wd-d2']);
    expect(matchDocuments(candidates, '   ').map((d) => d.id)).toEqual(['wd-d4', 'wd-d1', 'wd-d2']);
  });

  it('finds a document by a part of its name, in any case, with outer spaces ignored', () => {
    expect(matchDocuments(candidates, ' BÖTTCHER ').map((d) => d.id)).toEqual(['wd-d4']);
    expect(matchDocuments(candidates, 'bürobedarf').map((d) => d.id)).toEqual(['wd-d4', 'wd-d1']);
  });

  it('finds a document by its amount typed with a comma, a point or a minus', () => {
    for (const typed of ['23,80', '23.80', '-23,80', '23,8']) {
      expect(
        matchDocuments(candidates, typed).map((d) => d.id),
        typed,
      ).toEqual(['wd-d4']);
    }
    // 2380 euros is the invoice to Studio Kern, not the receipt of 23.80 euros.
    expect(matchDocuments(candidates, '2380').map((d) => d.id)).toEqual(['wd-d2']);
  });

  it('names a document whose name is unknown by its file name', () => {
    const unnamed = { ...doc('wd-d4'), name: null };
    expect(matchDocuments([unnamed], 'boettcher-quittung')).toEqual([unnamed]);
  });

  it('never finds a document whose amount is unknown by an amount', () => {
    expect(matchDocuments([doc('wd-d1')], '0')).toEqual([]);
  });
});

describe('DocumentPicker', () => {
  let demo: DemoStateService;
  let fixture: ComponentFixture<DocumentPicker>;
  let picked: string[];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const inBody = (testId: string) =>
    document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const options = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[data-testid="document-picker-option"]'),
    );
  const inside = (node: Element, testId: string) =>
    node.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const names = () => options().map((o) => text(inside(o, 'picker-name')));

  async function render(paymentId: string): Promise<void> {
    const payment = demo.business().transactions.find((t) => t.id === paymentId)!;
    fixture = TestBed.createComponent(DocumentPicker);
    fixture.componentRef.setInput('payment', payment);
    picked = [];
    fixture.componentInstance.picked.subscribe((id) => picked.push(id));
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(): Promise<void> {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-testid="pick-document"]')!
      .click();
    await settle();
  }

  async function search(value: string): Promise<void> {
    const input = inBody('document-picker-search') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  it('opens from a button named Pick from Documents', async () => {
    await render('wd-t17');
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="pick-document"]',
    )!;
    expect(trigger.tagName).toBe('BUTTON');
    expect(text(trigger)).toBe('Pick from Documents');
    expect(options()).toHaveLength(0);
    await open();
    expect(options().length).toBeGreaterThan(0);
  });

  it('lists the documents that fit, the one with the same amount first', async () => {
    await render('wd-t17');
    await open();
    expect(names()).toEqual(['Böttcher Bürobedarf', 'Bürobedarf Schulz']);
  });

  it('shows each document with its name, date, amount and file name', async () => {
    await render('wd-t17');
    await open();
    const [first, second] = options();
    expect(inside(first, 'picker-name')!.getAttribute('dir')).toBe('auto');
    expect(text(inside(first, 'picker-meta'))).toBe('8 Oct');
    expect(text(inside(first, 'picker-amount'))).toBe(formatMoney(2380, 'en'));
    expect(inside(first, 'picker-amount')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
    expect(text(inside(first, 'picker-file'))).toBe('boettcher-quittung.pdf');
    expect(inside(first, 'picker-file')!.closest('bdi')!.getAttribute('dir')).toBe('ltr');
    expect(text(inside(second, 'picker-file'))).toBe('IMG_2041.jpg');
  });

  it('says in words what reading could not find, and says nothing about a document that was read', async () => {
    await render('wd-t17');
    await open();
    const [read, unread] = options();
    expect(text(inside(unread, 'picker-amount'))).toBe('—');
    expect(text(inside(unread, 'doc-status'))).toBe('Check amount');
    expect(inside(read, 'doc-status')).toBeNull();
  });

  it('shows the file name once for a document whose name is unknown', async () => {
    demo.updateDocument('wd-d4', (d) => ({ ...d, name: null }));
    await render('wd-t17');
    await open();
    const row = options().find((o) => text(inside(o, 'picker-name')) === 'boettcher-quittung.pdf')!;
    expect(inside(row, 'picker-name')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
    expect(inside(row, 'picker-file')).toBeNull();
  });

  it('offers only received documents for money out, and only sent ones for money in', async () => {
    await render('wd-t3');
    await open();
    expect(names()).toEqual(['Bürobedarf Schulz', 'Böttcher Bürobedarf']);
    fixture.destroy();

    await render('wd-t1');
    await open();
    expect(names()).toEqual(['Studio Kern', 'Bäckerei Lange']);
  });

  it('leaves out documents that are linked, being read, or possible duplicates', async () => {
    demo.updateDocument('wd-d1', (d) => ({ ...d, reading: true }));
    demo.updateDocument('wd-d4', (d) => ({ ...d, duplicateOf: 'doc-wd-t2' }));
    await render('wd-t3');
    await open();
    // Nothing is left: the documents linked to other payments are not offered either.
    expect(options()).toHaveLength(0);
    expect(inBody('document-picker-empty')).not.toBeNull();
  });

  it('finds a document by its name', async () => {
    await render('wd-t17');
    await open();
    await search('schulz');
    expect(names()).toEqual(['Bürobedarf Schulz']);
  });

  it.each(['23,80', '23.80'])('finds a document by its amount typed as %s', async (typed) => {
    await render('wd-t17');
    await open();
    await search(typed);
    expect(names()).toEqual(['Böttcher Bürobedarf']);
  });

  it('says so when the search finds nothing, and the search stays', async () => {
    await render('wd-t17');
    await open();
    await search('zzz');
    expect(options()).toHaveLength(0);
    expect(text(inBody('document-picker-no-match'))).toBe('No document matches');
    expect(inBody('document-picker-empty')).toBeNull();
    expect((inBody('document-picker-search') as HTMLInputElement).value).toBe('zzz');
  });

  it('with no document that fits, says so and offers to add one', async () => {
    demo.updateDocument('wd-d1', (d) => ({ ...d, paymentId: 'wd-t2' }));
    demo.updateDocument('wd-d4', (d) => ({ ...d, paymentId: 'wd-t2' }));
    await render('wd-t17');
    await open();
    expect(
      text(inBody('document-picker-empty')).startsWith('No unlinked documents fit this payment'),
    ).toBe(true);
    const add = inBody('document-picker-add')!;
    expect(add.getAttribute('href')).toBe('/documents?add=1');
    expect(text(add)).toBe('Add a document');
  });

  it('offers nothing for a document that nobody has added while no bank is connected', async () => {
    demo.setSetup('new');
    await render('wd-t17');
    await open();
    expect(options()).toHaveLength(0);
    expect(inBody('document-picker-empty')).not.toBeNull();
  });

  it('shows documents added in the demo while no bank is connected', async () => {
    demo.setSetup('new');
    demo.addDocument('weber-design', { ...doc('wd-d4'), id: 'up-1', fromUpload: true });
    await render('wd-t17');
    await open();
    expect(options()).toHaveLength(1);
  });

  it('emits the id of the chosen document and closes', async () => {
    await render('wd-t17');
    await open();
    options()[0].click();
    await settle();
    expect(picked).toEqual(['wd-d4']);
    expect(options()).toHaveLength(0);
  });

  it('forgets the search when it closes', async () => {
    await render('wd-t17');
    await open();
    await search('schulz');
    options()[0].click();
    await settle();
    await open();
    expect((inBody('document-picker-search') as HTMLInputElement).value).toBe('');
    expect(options()).toHaveLength(2);
  });

  it('is named in the language of the page', async () => {
    await render('wd-t17');
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    await open();
    const searchBox = inBody('document-picker-search') as HTMLInputElement;
    expect(searchBox.placeholder).toBe('Name oder Betrag');
    expect(searchBox.getAttribute('aria-label')).toBe('Dokumente durchsuchen');
    expect(text(inside(options()[0], 'picker-meta'))).toBe(formatDate('2026-10-08', 'de'));
  });
});
