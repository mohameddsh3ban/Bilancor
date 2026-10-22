import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { DemoStateService } from '../../state/demo-state.service';
import { SetupChecklist } from './setup-checklist';

describe('SetupChecklist', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(SetupChecklist);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const link = (el: HTMLElement, id: string) =>
    el.querySelector<HTMLAnchorElement>(`[data-testid="step-action-${id}"]`)!;

  it('the setup step Upload your first receipt links to the Add menu', () => {
    TestBed.inject(DemoStateService).setSetup('new');
    const el = render();
    expect(el.querySelector('[data-testid="step-receipt"]')!.textContent).toContain(
      'Upload your first receipt',
    );
    expect(link(el, 'receipt').getAttribute('href')).toBe('/documents?add=1');
  });

  it('the other steps still open their coming-soon pages', () => {
    TestBed.inject(DemoStateService).setSetup('new');
    const el = render();
    expect(link(el, 'bank').getAttribute('href')).toBe('/soon/bank');
    expect(link(el, 'tax').getAttribute('href')).toBe('/soon/tax');
  });

  it('a receipt step that is done only shows the documents', () => {
    TestBed.inject(DemoStateService).setSetup('active');
    const el = render();
    expect(link(el, 'receipt').textContent?.trim()).toBe('View');
    expect(link(el, 'receipt').getAttribute('href')).toBe('/documents');
  });
});
