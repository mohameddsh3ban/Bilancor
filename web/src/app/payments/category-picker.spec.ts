import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CATEGORIES, PHONE, TRAVEL } from '../data/categories';
import { Booking } from '../data/models';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { CategoryPicker } from './category-picker';

@Component({
  imports: [CategoryPicker],
  template: `<app-category-picker [current]="current()" (picked)="picked.push($event)" />`,
})
class Host {
  readonly current = signal<Booking | null>(TRAVEL);
  readonly picked: Booking[] = [];
}

describe('CategoryPicker', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const trigger = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="change-category"]',
    )!;
  // The list opens in an overlay outside the component, so it is read from the document.
  const options = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('[data-testid="category-option"]'));
  const optionText = (option: HTMLElement) => option.textContent?.replace(/\s+/g, ' ').trim();
  const search = () =>
    document.body.querySelector<HTMLInputElement>('[data-testid="category-search"]')!;

  async function open(): Promise<void> {
    trigger().click();
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(value: string): Promise<void> {
    search().value = value;
    search().dispatchEvent(new Event('input'));
    await settle();
  }

  it('says Change, or Choose while there is no category yet', () => {
    expect(trigger().textContent?.trim()).toBe('Change');
    fixture.componentInstance.current.set(null);
    fixture.detectChanges();
    expect(trigger().textContent?.trim()).toBe('Choose');
  });

  it('lists every category with its label and SKR03 account', async () => {
    expect(options()).toHaveLength(0);
    await open();
    expect(options()).toHaveLength(CATEGORIES.length);
    expect(options().map(optionText)).toContain('Travel · 4670 Reisekosten Unternehmer');
    expect(options().map(optionText)).toContain('Phone & internet · 4920 Telefon');
  });

  it('category picker filters by typed text', async () => {
    await open();
    await type('reise');
    expect(options().map(optionText)).toEqual(['Travel · 4670 Reisekosten Unternehmer']);
  });

  it('finds a category by its translated label, SKR03 number or German name, ignoring case and spaces', async () => {
    await open();
    await type('  PHONE ');
    expect(options().map(optionText)).toEqual(['Phone & internet · 4920 Telefon']);
    await type('4920');
    expect(options().map(optionText)).toEqual(['Phone & internet · 4920 Telefon']);
    await type('telefon');
    expect(options().map(optionText)).toEqual(['Phone & internet · 4920 Telefon']);
  });

  it('matches the label in the language of the page', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await open();
    expect(options().map(optionText)).toContain('4670 Reisekosten Unternehmer');
    await type('reisen');
    expect(options().map(optionText)).toEqual(['4670 Reisekosten Unternehmer']);
  });

  it('says so when no category matches', async () => {
    await open();
    await type('zzzz');
    expect(options()).toHaveLength(0);
    expect(document.body.querySelector('[data-testid="category-empty"]')?.textContent).toContain(
      'No category matches',
    );
  });

  it('choosing a category emits it and closes the list', async () => {
    await open();
    await type('telefon');
    options()[0].click();
    await settle();
    expect(fixture.componentInstance.picked).toEqual([PHONE]);
    expect(options()).toHaveLength(0);
    expect(document.body.querySelector('[data-testid="category-search"]')).toBeNull();
  });

  it('marks the current category, and choosing it only closes the list', async () => {
    await open();
    const current = options().find((o) => optionText(o)?.startsWith('Travel'))!;
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(options().filter((o) => o.hasAttribute('aria-current'))).toHaveLength(1);
    current.click();
    await settle();
    expect(fixture.componentInstance.picked).toEqual([]);
    expect(options()).toHaveLength(0);
  });

  it('starts with an empty search each time it opens', async () => {
    await open();
    await type('reise');
    trigger().click();
    await settle();
    expect(options()).toHaveLength(0);
    await open();
    expect(search().value).toBe('');
    expect(options()).toHaveLength(CATEGORIES.length);
  });

  it('the search box is labelled and the list scrolls inside the panel', async () => {
    await open();
    expect(search().getAttribute('aria-label')).toBe('Search categories');
    expect(search().getAttribute('placeholder')).toBe('Name or number');
    const list = options()[0].closest('ul')!;
    expect(list.classList).toContain('overflow-y-auto');
  });
});
