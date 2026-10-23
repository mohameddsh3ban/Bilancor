import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BANKS } from '../data/banks';
import { BankTile } from './bank-tile';

@Component({
  imports: [BankTile],
  template: `<app-bank-tile [name]="name" [size]="size" />`,
})
class Host {
  name = 'Qonto';
  size: 'md' | 'lg' = 'md';
}

describe('BankTile', () => {
  function render(name: string, size: 'md' | 'lg' = 'md') {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.name = name;
    fixture.componentInstance.size = size;
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('app-bank-tile') as HTMLElement;
    const letters = tile.querySelector('span') as HTMLElement;
    return { tile, letters };
  }

  it('shows two letters and is hidden from screen readers: the name is always written beside it', () => {
    const { tile, letters } = render('Deutsche Bank');
    expect(letters.textContent?.trim()).toBe('DB');
    expect(tile.getAttribute('aria-hidden')).toBe('true');
  });

  it('has the same colours every time for the same bank, and only project colours, never a logo or a fixed colour', () => {
    const colours = new Set<string>();
    for (const bank of BANKS) {
      const first = render(bank.name).letters.className;
      expect(render(bank.name).letters.className).toBe(first);
      expect(first).toMatch(/\b(bg-primary|bg-primary\/10|bg-accent)\b/);
      expect(first).not.toMatch(/#|\[|rgb|hsl|oklch/);
      colours.add(first);
    }
    expect(colours.size).toBeGreaterThan(1);
    expect(render('Qonto').tile.querySelectorAll('img, svg')).toHaveLength(0);
  });

  it('is bigger on the sign-in screen', () => {
    expect(render('Qonto', 'md').letters.className).toContain('size-10');
    expect(render('Qonto', 'lg').letters.className).toContain('size-16');
  });
});
