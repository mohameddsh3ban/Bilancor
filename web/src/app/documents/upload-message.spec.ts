import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { READING_MS } from '../domain/document-upload';
import { DemoStateService } from '../state/demo-state.service';
import { UploadService } from '../state/upload.service';
import { UploadMessage } from './upload-message';

/** A file as the browser hands it over; only its name and size matter here. */
function file(name: string, size = 1000): File {
  return Object.defineProperty(new File(['x'], name), 'size', { value: size });
}

const MB_25 = 25 * 1024 * 1024;

describe('UploadMessage', () => {
  let fixture: ComponentFixture<UploadMessage>;
  let upload: UploadService;
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    upload = TestBed.inject(UploadService);
    demo = TestBed.inject(DemoStateService);
    fixture = TestBed.createComponent(UploadMessage);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const host = () => fixture.nativeElement as HTMLElement;
  const q = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(host().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function add(...files: File[]): void {
    upload.add(files, 'file');
    fixture.detectChanges();
  }

  function read(): void {
    vi.advanceTimersByTime(READING_MS);
    fixture.detectChanges();
  }

  it('shows nothing before anything was added, and is a polite live region either way', () => {
    expect(q('upload-message')).toBeNull();
    expect(host().getAttribute('aria-live')).toBe('polite');
  });

  it('says Reading N documents… while the files are read, and never 0 documents added', () => {
    add(file('a.pdf'), file('b.pdf'));
    expect(text(q('upload-line'))).toBe('Reading 2 documents…');
    expect(host().textContent).not.toContain('added');
    expect(host().textContent).not.toContain('0 documents');
  });

  it('says Reading 1 document… for one', () => {
    add(file('a.pdf'));
    expect(text(q('upload-line'))).toBe('Reading 1 document…');
  });

  it('counts the documents that are being read, so the number goes down as they are done', () => {
    add(file('a.pdf'));
    vi.advanceTimersByTime(1000);
    add(file('b.pdf'), file('c.pdf'));
    expect(text(q('upload-line'))).toBe('Reading 3 documents…');
    vi.advanceTimersByTime(1000); // the first drop is read; the message belongs to the second
    fixture.detectChanges();
    expect(text(q('upload-line'))).toBe('Reading 2 documents…');
  });

  it('says how many were added and how many need you once they are read', () => {
    add(file('a.pdf'), file('b.pdf'), file('c.pdf'));
    read();
    // Deutsche Bahn links itself; the Telekom duplicate and the Krause direction wait for the person.
    expect(text(q('upload-line'))).toBe('3 documents added · 2 need you');
  });

  it('says 1 needs you for one', () => {
    add(file('a.pdf'), file('b.pdf'));
    read();
    expect(text(q('upload-line'))).toBe('2 documents added · 1 needs you');
  });

  it('says all sorted when nothing needs the person', () => {
    add(file('a.pdf'));
    read();
    expect(text(q('upload-line'))).toBe('1 document added · all sorted');
  });

  it('names each file that was not added with the reason, one line each', () => {
    add(file('notes.docx'), file('big.pdf', MB_25), file('a.pdf'));
    const lines = qa('upload-refused');
    expect(lines.map((line) => text(line))).toEqual([
      'notes.docx — only PDF, JPG, PNG or XML',
      'big.pdf — over 20 MB',
    ]);
    expect(text(q('upload-refused-title'))).toBe('Not added:');
    expect(text(q('upload-line'))).toBe('Reading 1 document…');
    read();
    expect(text(q('upload-line'))).toBe('1 document added · all sorted');
    expect(qa('upload-refused')).toHaveLength(2);
  });

  it('when every file is refused it only lists them, with no count of added documents', () => {
    add(file('notes.docx'));
    expect(q('upload-line')).toBeNull();
    expect(qa('upload-refused')).toHaveLength(1);
    expect(host().textContent).not.toMatch(/\d+ documents? added/);
  });

  it('shows file names left to right', () => {
    add(file('notes.docx'));
    const name = q('upload-refused')!.querySelector('bdi')!;
    expect(name.getAttribute('dir')).toBe('ltr');
    expect(name.textContent?.trim()).toBe('notes.docx');
  });

  it('the cross removes the message, and a drop that is still being read does not bring it back', () => {
    add(file('a.pdf'));
    expect(q('upload-dismiss')!.getAttribute('aria-label')).toBe('Dismiss');
    q('upload-dismiss')!.click();
    fixture.detectChanges();
    expect(q('upload-message')).toBeNull();
    read();
    expect(q('upload-message')).toBeNull();
  });

  it('Reset demo clears the message', () => {
    add(file('a.pdf'), file('notes.docx'));
    read();
    expect(q('upload-message')).not.toBeNull();
    demo.resetData();
    fixture.detectChanges();
    expect(q('upload-message')).toBeNull();
  });

  it('Reset demo while a drop is being read clears the message and nothing comes back', () => {
    add(file('a.pdf'));
    demo.resetData();
    fixture.detectChanges();
    expect(q('upload-message')).toBeNull();
    read();
    expect(q('upload-message')).toBeNull();
  });

  it('follows the language', () => {
    TestBed.inject(LanguageService).setLang('de');
    add(file('a.pdf'), file('b.pdf'), file('notes.docx'));
    expect(text(q('upload-line'))).toBe('2 Dokumente werden gelesen…');
    read();
    expect(text(q('upload-line'))).toBe('2 Dokumente hinzugefügt · 1 braucht dich');
    expect(text(q('upload-refused-title'))).toBe('Nicht hinzugefügt:');
    expect(text(q('upload-refused'))).toBe('notes.docx — nur PDF, JPG, PNG oder XML');
  });
});
