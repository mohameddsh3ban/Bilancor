import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { UploadService } from '../state/upload.service';
import { DropOverlay } from './drop-overlay';

interface DragOptions {
  /** What the drag carries; `Files` for files from the computer. */
  types?: string[];
  /** How many items the drag carries (from `dataTransfer.items`). */
  items?: number;
  /** The files a drop hands over. */
  files?: File[];
}

describe('DropOverlay', () => {
  let fixture: ComponentFixture<DropOverlay>;
  let add: MockInstance<UploadService['add']>;
  let originalMatchMedia: PropertyDescriptor | undefined;

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

  beforeEach(() => {
    localStorage.clear();
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    screenIs(true);
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    add = vi.spyOn(TestBed.inject(UploadService), 'add').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(DropOverlay);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    else delete (window as { matchMedia?: unknown }).matchMedia;
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const overlay = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="drop-overlay"]',
    );
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  /** Sends a drag event the way a browser does; jsdom has no DragEvent or DataTransfer, so the transfer is made up. */
  function drag(
    type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
    { types = ['Files'], items = 1, files = [] }: DragOptions = {},
    target: EventTarget = document.body,
  ): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types,
        items: Array.from({ length: items }, () => ({ kind: 'file' })),
        files,
        dropEffect: 'none',
      },
    });
    target.dispatchEvent(event);
    if (!fixture.componentRef.hostView.destroyed) fixture.detectChanges();
    return event;
  }

  const escape = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
  };

  it('shows nothing until files are dragged over the page', () => {
    expect(overlay()).toBeNull();
  });

  it('dragging files over the page shows Drop to add N files, N from the items being dragged', () => {
    drag('dragenter', { items: 3 });
    expect(text(overlay())).toContain('Drop to add 3 files');
    expect(text(overlay())).toContain("We'll sort out bills and invoices for you");
  });

  it('says file for one', () => {
    drag('dragenter', { items: 1 });
    expect(text(overlay())).toContain('Drop to add 1 file');
    expect(text(overlay())).not.toContain('1 files');
  });

  it('covers the whole page with a dashed border and does not catch the pointer itself', () => {
    drag('dragenter');
    expect(overlay()!.classList).toContain('fixed');
    expect(overlay()!.classList).toContain('inset-0');
    expect(overlay()!.classList).toContain('pointer-events-none');
    expect(overlay()!.querySelector('.border-dashed')).not.toBeNull();
  });

  it('does not show for a drag that carries no files, such as selected text', () => {
    drag('dragenter', { types: ['text/plain'], items: 1 });
    expect(overlay()).toBeNull();
  });

  it('works at any width: below lg a drag of files still shows the overlay and a drop is added, not opened by the browser', () => {
    screenIs(false);
    const entered = drag('dragenter', { items: 2 });
    expect(entered.defaultPrevented).toBe(true);
    expect(text(overlay())).toContain('Drop to add 2 files');
    expect(drag('dragover').defaultPrevented).toBe(true);

    const files = [new File(['x'], 'a.pdf'), new File(['x'], 'b.jpg')];
    const dropped = drag('drop', { items: 2, files });
    expect(dropped.defaultPrevented).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(files, 'file');
    expect(overlay()).toBeNull();
  });

  it('below lg a drag without files is still left alone', () => {
    screenIs(false);
    expect(drag('dragenter', { types: ['text/plain'] }).defaultPrevented).toBe(false);
    expect(overlay()).toBeNull();
    expect(drag('drop', { types: ['text/plain'], files: [] }).defaultPrevented).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });

  it('keeps showing while the drag moves from one element to another on the page', () => {
    const child = document.createElement('div');
    document.body.append(child);
    try {
      drag('dragenter', { items: 2 }, document.body);
      drag('dragenter', { items: 2 }, child);
      drag('dragleave', { items: 2 }, document.body);
      expect(overlay()).not.toBeNull();
      drag('dragleave', { items: 2 }, child);
      expect(overlay()).toBeNull();
    } finally {
      child.remove();
    }
  });

  it('hides when the drag leaves the page', () => {
    drag('dragenter');
    drag('dragleave');
    expect(overlay()).toBeNull();
  });

  it('hides on Esc', () => {
    drag('dragenter');
    expect(overlay()).not.toBeNull();
    escape();
    expect(overlay()).toBeNull();
  });

  it('shows again for the next drag after Esc, and leave events after Esc do not hide it', () => {
    drag('dragenter');
    escape();
    drag('dragleave');
    drag('dragenter', { items: 4 });
    expect(text(overlay())).toContain('Drop to add 4 files');
  });

  it('dragging over the page lets it be dropped on, and not opened by the browser', () => {
    drag('dragenter');
    const over = drag('dragover');
    expect(over.defaultPrevented).toBe(true);
    expect(
      (over as unknown as { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect,
    ).toBe('copy');
  });

  it('dropping files adds them as files, hides the overlay and keeps the browser from opening them', () => {
    const files = [new File(['x'], 'a.pdf'), new File(['x'], 'b.jpg')];
    drag('dragenter', { items: 2 });
    const dropped = drag('drop', { items: 2, files });
    expect(dropped.defaultPrevented).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(files, 'file');
    expect(overlay()).toBeNull();
  });

  it('a drop without files does nothing', () => {
    const dropped = drag('drop', { types: ['text/plain'], files: [] });
    expect(dropped.defaultPrevented).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });

  it('a drop of files that cannot be read adds nothing and still hides the overlay', () => {
    drag('dragenter');
    const dropped = drag('drop', { files: [] });
    expect(dropped.defaultPrevented).toBe(true);
    expect(add).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
  });

  it('the next drag starts clean after a drop', () => {
    drag('dragenter');
    drag('dragenter');
    drag('drop', { files: [new File(['x'], 'a.pdf')] });
    drag('dragenter');
    drag('dragleave');
    expect(overlay()).toBeNull();
  });

  it('stops listening to the page when it goes away', () => {
    fixture.destroy();
    const entered = drag('dragenter');
    expect(entered.defaultPrevented).toBe(false);
    const dropped = drag('drop', { files: [new File(['x'], 'a.pdf')] });
    expect(dropped.defaultPrevented).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });

  it('follows the language', () => {
    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    drag('dragenter', { items: 2 });
    expect(text(overlay())).toContain('Loslassen, um 2 Dateien hinzuzufügen');
    expect(text(overlay())).toContain('Wir sortieren Rechnungen und Belege für dich');
  });
});
