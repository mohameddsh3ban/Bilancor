import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { UploadService } from '../state/upload.service';
import { AddMenu } from './add-menu';

const ADDRESS = 'weber-design@inbox.example';

describe('AddMenu', () => {
  let fixture: ComponentFixture<AddMenu>;
  let el: HTMLElement;
  let add: MockInstance<UploadService['add']>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    add = vi.spyOn(TestBed.inject(UploadService), 'add').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(AddMenu);
    fixture.componentRef.setInput('email', ADDRESS);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const inBody = (testId: string) =>
    document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const trigger = () => el.querySelector<HTMLButtonElement>('[data-testid="add-button"]')!;
  const fileInput = () => el.querySelector<HTMLInputElement>('[data-testid="file-input"]')!;
  const photoInput = () => el.querySelector<HTMLInputElement>('[data-testid="photo-input"]')!;
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function openMenu(): Promise<void> {
    trigger().click();
    await settle();
  }

  function pick(input: HTMLInputElement, files: File[]): void {
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new Event('change'));
  }

  it('has a + Add button and the menu is closed', () => {
    expect(text(trigger())).toBe('Add');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(inBody('add-ways')).toBeNull();
  });

  it('Add opens the three ways, each with its hint', async () => {
    await openMenu();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const ways = inBody('add-ways')!;
    expect(
      Array.from(ways.querySelectorAll('[data-testid="add-way-title"]')).map((t) => text(t)),
    ).toEqual(['Take a photo', 'Choose a file', 'Forward by email']);
    expect(text(inBody('add-photo'))).toContain('Several pages become one document');
    expect(text(inBody('add-file'))).toContain('PDF, JPG, PNG or e-invoice (XML), up to 20 MB');
  });

  it('Take a photo is for phones only', async () => {
    await openMenu();
    expect(inBody('add-photo')!.closest('li')!.classList).toContain('lg:hidden');
    expect(inBody('add-file')!.closest('li')!.classList).not.toContain('lg:hidden');
    expect(inBody('add-email')!.closest('li')!.classList).not.toContain('lg:hidden');
  });

  it('Forward by email shows the address, left to right, with a Copy button', async () => {
    await openMenu();
    const address = inBody('add-email')!.querySelector('bdi')!;
    expect(address.getAttribute('dir')).toBe('ltr');
    expect(address.textContent?.trim()).toBe(ADDRESS);
    expect(text(inBody('add-email')!.querySelector('[data-testid="copy-button"]'))).toBe('Copy');
  });

  it('the Copy button in the menu says Copied only after the clipboard took the address', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      await openMenu();
      inBody('add-email')!.querySelector<HTMLElement>('[data-testid="copy-button"]')!.click();
      await new Promise<void>((resolve) => setTimeout(resolve)); // the clipboard answers after a moment
      await settle();
      expect(writeText).toHaveBeenCalledWith(ADDRESS);
      expect(text(inBody('add-email')!.querySelector('[data-testid="copy-button"]'))).toBe(
        'Copied',
      );
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('opens on arrival when asked to, and stays open when the request goes away', async () => {
    fixture.componentRef.setInput('open', true);
    await settle();
    expect(inBody('add-ways')).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    fixture.componentRef.setInput('open', false);
    await settle();
    expect(inBody('add-ways')).not.toBeNull();
  });

  it('opens again when it is asked to once more after being closed', async () => {
    fixture.componentRef.setInput('open', true);
    await settle();
    trigger().click();
    await settle();
    expect(inBody('add-ways')).toBeNull();
    fixture.componentRef.setInput('open', false);
    await settle();
    fixture.componentRef.setInput('open', true);
    await settle();
    expect(inBody('add-ways')).not.toBeNull();
  });

  it('Choose a file opens the file picker for PDF, JPG, PNG and XML, several at a time, and closes the menu', async () => {
    const picker = vi.fn();
    fileInput().addEventListener('click', picker);
    expect(fileInput().type).toBe('file');
    expect(fileInput().multiple).toBe(true);
    expect(fileInput().getAttribute('accept')).toBe('.pdf,.jpg,.jpeg,.png,.xml');

    await openMenu();
    inBody('add-file')!.click();
    await settle();
    expect(picker).toHaveBeenCalledTimes(1);
    expect(inBody('add-ways')).toBeNull();
  });

  it('Take a photo opens the camera picker', async () => {
    const picker = vi.fn();
    photoInput().addEventListener('click', picker);
    expect(photoInput().type).toBe('file');
    expect(photoInput().getAttribute('accept')).toBe('image/*');
    expect(photoInput().getAttribute('capture')).toBe('environment');
    expect(photoInput().multiple).toBe(false);

    await openMenu();
    inBody('add-photo')!.click();
    await settle();
    expect(picker).toHaveBeenCalledTimes(1);
    expect(inBody('add-ways')).toBeNull();
  });

  it('the files that were chosen are added as files, a photo as a photo', () => {
    const files = [new File(['x'], 'a.pdf'), new File(['x'], 'b.png')];
    pick(fileInput(), files);
    expect(add).toHaveBeenCalledWith(files, 'file');

    const photo = [new File(['x'], 'IMG_1.jpg')];
    pick(photoInput(), photo);
    expect(add).toHaveBeenLastCalledWith(photo, 'photo');
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('resets the picker after reading it, so the same file can be chosen twice', () => {
    const writes: string[] = [];
    Object.defineProperty(fileInput(), 'value', {
      configurable: true,
      get: () => '',
      set: (value: string) => writes.push(value),
    });
    const files = [new File(['x'], 'a.pdf')];
    pick(fileInput(), files);
    expect(writes).toEqual(['']);
    expect(add).toHaveBeenCalledWith(files, 'file');
  });

  it('adds nothing when the picker was closed without a file', () => {
    pick(fileInput(), []);
    expect(add).not.toHaveBeenCalled();
  });

  it('follows the language', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await openMenu();
    expect(text(trigger())).toBe('Hinzufügen');
    expect(text(inBody('add-file'))).toContain('Datei auswählen');
    expect(text(inBody('add-photo'))).toContain('Foto aufnehmen');
  });
});
