import { Component, signal, viewChild } from '@angular/core';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { InvoiceLine } from '../data/models';
import {
  InvoiceLines,
  linesOf,
  newLine,
  parseQuantity,
  rowOf,
  suggestLines,
} from './invoice-lines';

const EARLIER: InvoiceLine[] = [
  { description: 'Design-Beratung', quantity: 2, unit: 'hour', unitPriceCents: 8000 },
  { description: 'Logo-Überarbeitung', quantity: 1, unit: 'flat', unitPriceCents: 34000 },
  { description: 'Webdesign, Stunden', quantity: 11, unit: 'hour', unitPriceCents: 8500 },
  { description: 'Beratung vor Ort', quantity: 1, unit: 'day', unitPriceCents: 60000 },
  { description: 'Telefonische Beratung', quantity: 1, unit: 'hour', unitPriceCents: 7000 },
];

describe('parseQuantity', () => {
  it.each([
    ['2', 2],
    ['10', 10],
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['0,25', 0.25],
    [' 3 ', 3],
  ])('reads %j as %d', (typed, quantity) => {
    expect(parseQuantity(typed)).toBe(quantity);
  });

  it.each(['', ' ', '0', '0,00', '-1', 'abc'])('refuses %j', (typed) => {
    expect(parseQuantity(typed)).toBeNull();
  });

  // A quantity has at most two decimals. Three digits after a lone mark are not read as a thousands separator:
  // 0,125 would be 125 and 1.333 would be 1333, silently.
  it.each(['0,125', '0.125', '.125', '1.333', '1,333', '2,5555', '1.500', '10.000'])(
    'refuses %j: more than two decimals, or a thousands separator it cannot tell from one',
    (typed) => {
      expect(parseQuantity(typed)).toBeNull();
    },
  );

  it.each([
    ['2,50', 2.5],
    ['0.75', 0.75],
    ['1.500,5', 1500.5],
    ['1,500.5', 1500.5],
    ['1500', 1500],
  ])('still reads %j as %d', (typed, quantity) => {
    expect(parseQuantity(typed)).toBe(quantity);
  });
});

describe('newLine', () => {
  it('is one piece at no price yet, and a fresh object each time', () => {
    expect(newLine()).toEqual({ description: '', quantity: 1, unit: 'piece', unitPriceCents: 0 });
    expect(newLine()).not.toBe(newLine());
  });
});

describe('suggestLines', () => {
  it('finds earlier lines that contain what is typed, in any case, the ones that begin with it first', () => {
    expect(suggestLines('beratung', EARLIER).map((l) => l.description)).toEqual([
      'Beratung vor Ort',
      'Design-Beratung',
      'Telefonische Beratung',
    ]);
  });

  it('offers nothing for nothing typed, or for what no line has', () => {
    expect(suggestLines('', EARLIER)).toEqual([]);
    expect(suggestLines('   ', EARLIER)).toEqual([]);
    expect(suggestLines('zzz', EARLIER)).toEqual([]);
  });

  it('offers at most four', () => {
    expect(suggestLines('e', EARLIER)).toHaveLength(4);
  });
});

describe('rowOf and linesOf', () => {
  it('writes the numbers of a line as a field shows them, in the decimal mark of the language', () => {
    const line: InvoiceLine = {
      description: 'Webdesign',
      quantity: 2.5,
      unit: 'hour',
      unitPriceCents: 8550,
    };
    expect(rowOf(line, 'en')).toEqual({
      description: 'Webdesign',
      quantity: '2.5',
      unit: 'hour',
      price: '85.50',
    });
    expect(rowOf(line, 'de')).toEqual({
      description: 'Webdesign',
      quantity: '2,5',
      unit: 'hour',
      price: '85,50',
    });
  });

  it('a line that was never filled in has no price in its field', () => {
    expect(rowOf(newLine(), 'en')).toEqual({
      description: '',
      quantity: '1',
      unit: 'piece',
      price: '',
    });
  });

  it('reads the fields back, and leaves out a row with no description and no price', () => {
    const rows = [
      { description: 'Webdesign', quantity: '2,5', unit: 'hour' as const, price: '49,90' },
      { description: '', quantity: '1', unit: 'piece' as const, price: '' },
      { description: '', quantity: '3', unit: 'day' as const, price: '' },
      { description: 'Hosting', quantity: '1', unit: 'flat' as const, price: '49.90' },
    ];
    expect(linesOf(rows)).toEqual([
      { description: 'Webdesign', quantity: 2.5, unit: 'hour', unitPriceCents: 4990 },
      { description: 'Hosting', quantity: 1, unit: 'flat', unitPriceCents: 4990 },
    ]);
  });

  it('a field that cannot be read counts as 0, so the line is not complete', () => {
    const [line] = linesOf([{ description: 'x', quantity: 'abc', unit: 'piece', price: '-3' }]);
    expect(line).toMatchObject({ quantity: 0, unitPriceCents: 0 });
  });
});

@Component({
  imports: [InvoiceLines],
  template: `<app-invoice-lines
    [lines]="lines()"
    [suggestions]="suggestions"
    [resetKey]="key()"
    (linesChange)="emitted.push($event); lines.set($event)"
  />`,
})
class Host {
  readonly lines = signal<InvoiceLine[]>([]);
  readonly key = signal('a');
  readonly suggestions = EARLIER;
  readonly emitted: InvoiceLine[][] = [];
  readonly child = viewChild.required(InvoiceLines);
}

describe('InvoiceLines', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(lines: InvoiceLine[] = []): Promise<void> {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.lines.set(lines);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const field = (testId: string) => q(testId) as HTMLInputElement;
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const rowCount = () => el().querySelectorAll('[data-testid^="line-row-"]').length;
  const last = () => host.emitted.at(-1);

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function choose(testId: string, value: string): Promise<void> {
    const select = q(testId) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  describe('the rows', () => {
    it('starts with one empty line: quantity 1, pieces, nothing else, and nothing to remove', async () => {
      await render();
      expect(rowCount()).toBe(1);
      expect(field('line-description-0').value).toBe('');
      expect(field('line-quantity-0').value).toBe('1');
      expect((q('line-unit-0') as HTMLSelectElement).value).toBe('piece');
      expect(field('line-price-0').value).toBe('');
      expect(q('line-remove-0')).toBeNull();
      expect(host.emitted).toEqual([]);
    });

    it('shows the lines it was given, with the numbers written the way the language writes them', async () => {
      await render([
        { description: 'Design-Beratung', quantity: 2, unit: 'hour', unitPriceCents: 8000 },
        { description: 'Logo-Überarbeitung', quantity: 1, unit: 'flat', unitPriceCents: 34000 },
      ]);
      expect(rowCount()).toBe(2);
      expect(field('line-description-1').value).toBe('Logo-Überarbeitung');
      expect(field('line-price-0').value).toBe('80.00');
      expect((q('line-unit-1') as HTMLSelectElement).value).toBe('flat');
      expect(text(q('line-net-0'))).toBe('€160.00');
      expect(text(q('line-net-1'))).toBe('€340.00');
    });

    it('writes the price with the decimal mark of the language', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render([
        { description: 'Design-Beratung', quantity: 2.5, unit: 'hour', unitPriceCents: 8000 },
      ]);
      expect(field('line-price-0').value).toBe('80,00');
      expect(field('line-quantity-0').value).toBe('2,5');
    });

    it('the units are pieces, hours, days and flat rate', async () => {
      await render();
      const options = Array.from(q('line-unit-0')!.querySelectorAll('option')).map((o) => [
        o.value,
        text(o),
      ]);
      expect(options).toEqual([
        ['piece', 'Pieces'],
        ['hour', 'Hours'],
        ['day', 'Days'],
        ['flat', 'Flat rate'],
      ]);
    });

    it('the amount accepts 49,90 and 49.90 alike', async () => {
      await render();
      await type('line-description-0', 'Hosting');
      await type('line-price-0', '49,90');
      expect(last()).toEqual([
        { description: 'Hosting', quantity: 1, unit: 'piece', unitPriceCents: 4990 },
      ]);
      expect(text(q('line-net-0'))).toBe('€49.90');
      await type('line-price-0', '49.90');
      expect(last()).toEqual([
        { description: 'Hosting', quantity: 1, unit: 'piece', unitPriceCents: 4990 },
      ]);
      expect(q('line-error-price-0')).toBeNull();
    });

    it('keeps what is typed as it is typed, however far the amount is from a finished number', async () => {
      await render();
      await type('line-price-0', '49,');
      expect(field('line-price-0').value).toBe('49,');
      expect(last()![0].unitPriceCents).toBe(4900);
      await type('line-description-0', 'x');
      expect(field('line-price-0').value).toBe('49,');
      expect(last()![0].unitPriceCents).toBe(4900);
    });

    it('a quantity may have decimals, and the line amount follows quantity times price', async () => {
      await render();
      await type('line-description-0', 'Beratung');
      await type('line-quantity-0', '1,5');
      await type('line-price-0', '80');
      expect(last()).toEqual([
        { description: 'Beratung', quantity: 1.5, unit: 'piece', unitPriceCents: 8000 },
      ]);
      expect(text(q('line-net-0'))).toBe('€120.00');
      await choose('line-unit-0', 'hour');
      expect(last()![0].unit).toBe('hour');
    });

    it('says what is wrong with an amount or a quantity that cannot be read, and only while it is typed', async () => {
      await render();
      await type('line-description-0', 'x');
      expect(q('line-error-quantity-0')).toBeNull();
      expect(q('line-error-price-0')).toBeNull();

      await type('line-price-0', 'abc');
      expect(text(q('line-error-price-0'))).toBe('Enter an amount above 0, like 49.90.');
      expect(field('line-price-0').getAttribute('aria-invalid')).toBe('true');
      expect(last()![0].unitPriceCents).toBe(0);

      await type('line-quantity-0', '0');
      expect(text(q('line-error-quantity-0'))).toBe(
        'Enter a number above 0 with up to two decimals, like 1 or 2.5.',
      );
      expect(last()![0].quantity).toBe(0);

      await type('line-price-0', '10');
      await type('line-quantity-0', '2');
      expect(q('line-error-price-0')).toBeNull();
      expect(q('line-error-quantity-0')).toBeNull();
      expect(field('line-price-0').getAttribute('aria-invalid')).toBeNull();
      expect(last()).toEqual([
        { description: 'x', quantity: 2, unit: 'piece', unitPriceCents: 1000 },
      ]);
    });

    it('a quantity with three decimals is named, not silently read as a thousand times more', async () => {
      await render();
      await type('line-description-0', 'Beratung');
      await type('line-price-0', '80');
      for (const typed of ['0,125', '1.333']) {
        await type('line-quantity-0', typed);
        expect(text(q('line-error-quantity-0')), typed).toBe(
          'Enter a number above 0 with up to two decimals, like 1 or 2.5.',
        );
        expect(field('line-quantity-0').getAttribute('aria-invalid'), typed).toBe('true');
        expect(last()![0].quantity, typed).toBe(0);
      }
      await type('line-quantity-0', '0,25');
      expect(q('line-error-quantity-0')).toBeNull();
      expect(last()![0].quantity).toBe(0.25);
    });

    it('an empty field is not an error (the checklist says what is missing)', async () => {
      await render();
      await type('line-description-0', 'x');
      await type('line-quantity-0', '');
      expect(q('line-error-quantity-0')).toBeNull();
      expect(last()![0].quantity).toBe(0);
    });

    it('a row that is still empty is not part of the lines', async () => {
      await render();
      await type('line-quantity-0', '3');
      expect(host.emitted).toEqual([]); // nothing to save yet
      await type('line-description-0', 'Hosting');
      expect(last()).toHaveLength(1);
      await type('line-description-0', '');
      expect(last()).toEqual([]);
      expect(host.emitted).toHaveLength(2);
    });

    it('says nothing when a change leaves the lines as they were: adding an empty row, or changing its unit', async () => {
      await render();
      q('add-line')!.click();
      await settle();
      await choose('line-unit-1', 'day');
      expect(host.emitted).toEqual([]);
      await type('line-description-0', 'Hosting');
      expect(host.emitted).toHaveLength(1);
      q('add-line')!.click();
      await settle();
      expect(host.emitted).toHaveLength(1);
    });
  });

  describe('the layout of a row', () => {
    it('follows the width of the list, not of the screen: the list is a container and no class inside it asks for `lg:`', async () => {
      await render([
        { description: 'Design-Beratung', quantity: 2, unit: 'hour', unitPriceCents: 8000 },
      ]);
      expect(q('lines')!.classList).toContain('@container');
      const viewportClasses = Array.from(q('lines')!.querySelectorAll('[class]')).flatMap((node) =>
        Array.from(node.classList).filter((name) => /^(sm|md|lg|xl|2xl):/.test(name)),
      );
      expect(viewportClasses).toEqual([]);
    });

    it('the description has a row of its own, over quantity, unit, price, amount and remove', async () => {
      await render([
        { description: 'Design-Beratung', quantity: 2, unit: 'hour', unitPriceCents: 8000 },
        { description: 'Logo', quantity: 1, unit: 'flat', unitPriceCents: 34000 },
      ]);
      const row = q('line-row-0')!;
      const description = field('line-description-0').closest('div')!;
      expect(description.classList).toContain('col-span-2');
      expect(description.classList).toContain('@lg:col-span-5');
      // The five small fields come after it, in this order.
      const order = [
        'line-quantity-0',
        'line-unit-0',
        'line-price-0',
        'line-net-0',
        'line-remove-0',
      ].map((id) => Array.from(row.children).findIndex((cell) => cell.contains(q(id))));
      expect(order).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('adding and removing', () => {
    it('Add a line puts one more row below, with the cursor in its description', async () => {
      await render();
      expect(text(q('add-line'))).toBe('Add a line');
      q('add-line')!.click();
      await settle();
      TestBed.inject(ApplicationRef).tick();
      expect(rowCount()).toBe(2);
      expect(document.activeElement).toBe(q('line-description-1'));
      expect(field('line-quantity-1').value).toBe('1');
      expect(q('line-remove-0')).not.toBeNull();
      expect(q('line-remove-1')).not.toBeNull();
    });

    it('Remove takes that row away and keeps the others as they were typed, with the cursor on the next one', async () => {
      await render();
      q('add-line')!.click();
      await settle();
      q('add-line')!.click();
      await settle();
      await type('line-description-0', 'One');
      await type('line-description-1', 'Two');
      await type('line-price-1', '2,50');
      await type('line-description-2', 'Three');
      await type('line-price-2', '3');

      expect(q('line-remove-1')!.getAttribute('aria-label')).toBe('Remove line 2');
      q('line-remove-1')!.click();
      await settle();
      TestBed.inject(ApplicationRef).tick();
      expect(rowCount()).toBe(2);
      expect(field('line-description-0').value).toBe('One');
      expect(field('line-description-1').value).toBe('Three');
      expect(field('line-price-1').value).toBe('3');
      expect(last()!.map((l) => l.description)).toEqual(['One', 'Three']);
      expect(document.activeElement).toBe(q('line-description-1'));
    });

    it('the last row cannot be removed, so there is always a line to write in', async () => {
      await render();
      q('add-line')!.click();
      await settle();
      q('line-remove-0')!.click();
      await settle();
      expect(rowCount()).toBe(1);
      expect(q('line-remove-0')).toBeNull();
    });
  });

  describe('suggestions from earlier lines', () => {
    it('typing a description offers earlier lines with their price and unit', async () => {
      await render();
      expect(q('suggestions-0')).toBeNull();
      await type('line-description-0', 'Design-');
      expect(text(q('suggestions-0'))).toBe('Design-Beratung €80.00 · Hours');
      expect(q('suggestions-0')!.getAttribute('aria-label')).toBe('Earlier lines');
      expect(q('suggestions-0')!.querySelectorAll('button')).toHaveLength(1);
      expect(q('suggestions-0')!.querySelector('bdi[dir="ltr"]')).not.toBeNull();
    });

    it('choosing one fills the description, the unit and the price, and keeps the quantity', async () => {
      await render();
      await type('line-quantity-0', '3');
      await type('line-description-0', 'Design');
      q('suggestion-0-0')!.click();
      await settle();
      TestBed.inject(ApplicationRef).tick();
      expect(field('line-description-0').value).toBe('Design-Beratung');
      expect((q('line-unit-0') as HTMLSelectElement).value).toBe('hour');
      expect(field('line-price-0').value).toBe('80.00');
      expect(field('line-quantity-0').value).toBe('3');
      expect(text(q('line-net-0'))).toBe('€240.00');
      expect(last()).toEqual([
        { description: 'Design-Beratung', quantity: 3, unit: 'hour', unitPriceCents: 8000 },
      ]);
      expect(q('suggestions-0')).toBeNull();
      expect(document.activeElement).toBe(q('line-quantity-0'));
    });

    it('the price is written with the decimal mark of the language', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render();
      await type('line-description-0', 'Webdesign');
      q('suggestion-0-0')!.click();
      await settle();
      expect(field('line-price-0').value).toBe('85,00');
    });

    it('offers nothing for what no earlier line says, and they go away when the cursor leaves the row', async () => {
      await render();
      await type('line-description-0', 'zzz');
      expect(q('suggestions-0')).toBeNull();
      await type('line-description-0', 'Beratung');
      expect(q('suggestions-0')).not.toBeNull();
      field('line-description-0').dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: field('line-price-0') }),
      );
      await settle();
      expect(q('suggestions-0')).toBeNull();
    });

    it('a tap on a suggestion does not take the cursor from the description first (it would close the list)', async () => {
      await render();
      await type('line-description-0', 'Design');
      const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      q('suggestion-0-0')!.dispatchEvent(press);
      expect(press.defaultPrevented).toBe(true);
    });
  });

  describe('the cursor', () => {
    it('focusFirstIncomplete goes to the first thing a line still needs', async () => {
      await render();
      q('add-line')!.click();
      await settle();
      await type('line-description-0', 'One');
      await type('line-price-0', '10');
      await type('line-description-1', 'Two');
      host.child().focusFirstIncomplete();
      TestBed.inject(ApplicationRef).tick();
      expect(document.activeElement).toBe(q('line-price-1'));

      await type('line-price-1', '10');
      await type('line-quantity-1', '');
      host.child().focusFirstIncomplete();
      TestBed.inject(ApplicationRef).tick();
      expect(document.activeElement).toBe(q('line-quantity-1'));

      await type('line-description-1', '');
      host.child().focusFirstIncomplete();
      TestBed.inject(ApplicationRef).tick();
      expect(document.activeElement).toBe(q('line-description-1'));
    });

    it('focusFirstIncomplete with nothing written goes to the first description', async () => {
      await render();
      host.child().focusFirstIncomplete();
      TestBed.inject(ApplicationRef).tick();
      expect(document.activeElement).toBe(q('line-description-0'));
    });
  });

  describe('a form of its own', () => {
    it('what the parent hands back after every change does not start the rows over', async () => {
      await render();
      await type('line-description-0', 'Hosting');
      await type('line-price-0', '49,');
      expect(host.lines()).toHaveLength(1);
      expect(field('line-price-0').value).toBe('49,');
    });

    it('starts over for another invoice (another reset key) from the lines it is given then', async () => {
      await render([{ description: 'Old', quantity: 1, unit: 'flat', unitPriceCents: 100 }]);
      host.lines.set([{ description: 'New', quantity: 2, unit: 'hour', unitPriceCents: 250 }]);
      host.key.set('b');
      await settle();
      expect(field('line-description-0').value).toBe('New');
      expect(field('line-price-0').value).toBe('2.50');
      expect(rowCount()).toBe(1);
    });

    it('Arabic: the form mirrors, the numbers and the description of a line keep their own direction', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render([
        { description: 'Design-Beratung', quantity: 2, unit: 'hour', unitPriceCents: 8000 },
      ]);
      expect(document.documentElement.dir).toBe('rtl');
      expect(field('line-quantity-0').getAttribute('dir')).toBe('ltr');
      expect(field('line-price-0').getAttribute('dir')).toBe('ltr');
      expect(field('line-description-0').getAttribute('dir')).toBe('auto');
      expect(q('line-net-0')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(q('add-line'))).toBe('إضافة بند');
    });
  });
});
