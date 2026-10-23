import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Doc } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { DocumentEditForm } from './document-edit-form';

@Component({
  imports: [DocumentEditForm],
  template: `<app-document-edit-form [doc]="doc()" (done)="finished = finished + 1" />`,
})
class Host {
  readonly doc = signal<Doc>(undefined as unknown as Doc);
  finished = 0;
}

describe('DocumentEditForm', () => {
  let demo: DemoStateService;
  let fixture: ComponentFixture<Host>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(testId: string) =>
    el().querySelector<T>(`[data-testid="${testId}"]`)!;
  const doc = (id: string): Doc => demo.documents().find((d) => d.id === id)!;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    demo = TestBed.inject(DemoStateService);
    fixture = TestBed.createComponent(Host);
    show('wd-d2');
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  /** Shows the form for a document of Weber Design, the way the page hands it over. */
  function show(id: string): void {
    fixture.componentInstance.doc.set(doc(id));
    fixture.detectChanges();
  }

  function type(testId: string, value: string): void {
    const input = q<HTMLInputElement>(testId);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(): void {
    q('edit-form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('starts from the values of the document', () => {
    expect(q<HTMLInputElement>('edit-name').value).toBe('Studio Kern');
    expect(q<HTMLInputElement>('edit-invoice').value).toBe('RE-2026-044');
    expect(q<HTMLInputElement>('edit-date').value).toBe('2026-10-16');
    expect(q<HTMLInputElement>('edit-amount').value).toBe('2380.00');
    expect(q<HTMLInputElement>('edit-due').value).toBe('2026-10-30');
  });

  it('shows the values of the other document when the document shown changes, and not what was typed for the first', () => {
    type('edit-name', 'Typed for Studio Kern');
    type('edit-amount', '1,00');
    show('wd-d3');
    expect(q<HTMLInputElement>('edit-name').value).toBe('Bäckerei Lange');
    expect(q<HTMLInputElement>('edit-invoice').value).toBe('RE-2026-039');
    expect(q<HTMLInputElement>('edit-amount').value).toBe('1190.00');
  });

  it('after the document changed, saving what was typed for the first changes neither document', () => {
    const studioKern = doc('wd-d2');
    const baeckerei = doc('wd-d3');
    type('edit-name', 'Typed for Studio Kern');
    type('edit-invoice', 'RE-TYPED');
    show('wd-d3');
    submit();
    expect(doc('wd-d2')).toBe(studioKern);
    expect(doc('wd-d3')).toBe(baeckerei);
  });

  it('after the document changed, what is typed and saved goes into the document shown only', () => {
    const studioKern = doc('wd-d2');
    type('edit-name', 'Typed for Studio Kern');
    show('wd-d3');
    type('edit-name', 'Bäckerei Lange GmbH');
    submit();
    expect(doc('wd-d3').name).toBe('Bäckerei Lange GmbH');
    expect(doc('wd-d3').invoiceNo).toBe('RE-2026-039');
    expect(doc('wd-d2')).toBe(studioKern);
  });

  it('the problems of one document do not show on the next', () => {
    type('edit-name', ' ');
    submit();
    expect(el().querySelector('[data-testid="edit-error-name"]')).not.toBeNull();
    show('wd-d3');
    expect(el().querySelector('[data-testid="edit-error-name"]')).toBeNull();
  });

  it('saves what changed in one history line and says it is done', () => {
    type('edit-name', 'Studio Kern GmbH');
    submit();
    expect(doc('wd-d2').name).toBe('Studio Kern GmbH');
    expect(doc('wd-d2').history.filter((h) => h.key === 'docEdited')).toHaveLength(1);
    expect(fixture.componentInstance.finished).toBe(1);
  });

  it('a document that gets linked while the form is open loses the choice, and saving flips nothing', () => {
    const before = doc('wd-d2');
    q('edit-direction-received').click();
    fixture.detectChanges();
    expect(q('edit-direction-received').getAttribute('aria-pressed')).toBe('true');

    fixture.componentInstance.doc.set({ ...before, paymentId: 'wd-t17' });
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="edit-direction-received"]')).toBeNull();
    expect(q('edit-direction-locked').textContent?.trim()).toBe(
      'Linked to a payment — unlink it to change Received or Sent.',
    );

    submit();
    expect(doc('wd-d2')).toBe(before);
    expect(fixture.componentInstance.finished).toBe(1);
  });

  it('saving twice before the form has closed writes one history line', () => {
    type('edit-name', 'Studio Kern GmbH');
    submit();
    submit();
    expect(doc('wd-d2').history.filter((h) => h.key === 'docEdited')).toHaveLength(1);
    expect(fixture.componentInstance.finished).toBe(1);
  });

  it('saving with nothing changed writes no history line but is done', () => {
    const before = doc('wd-d2');
    submit();
    expect(doc('wd-d2')).toBe(before);
    expect(fixture.componentInstance.finished).toBe(1);
  });

  it('a field that cannot be saved is named and the form stays open', () => {
    const before = doc('wd-d2');
    type('edit-amount', '0');
    submit();
    expect(q('edit-error-amount').textContent?.trim()).toBe('Type an amount above 0, like 71.39.');
    expect(doc('wd-d2')).toBe(before);
    expect(fixture.componentInstance.finished).toBe(0);
  });

  it('Cancel says it is done and saves nothing', () => {
    const before = doc('wd-d2');
    type('edit-name', 'Somebody else');
    q('edit-cancel').click();
    expect(doc('wd-d2')).toBe(before);
    expect(fixture.componentInstance.finished).toBe(1);
  });

  it('puts the cursor into the form when it opens', async () => {
    await fixture.whenStable();
    expect(el().contains(document.activeElement)).toBe(true);
  });
});
