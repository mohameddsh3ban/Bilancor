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

  it("the setup checklist's bank and tax steps open the flows", () => {
    TestBed.inject(DemoStateService).setSetup('new');
    const el = render();
    expect(link(el, 'bank').getAttribute('href')).toBe('/settings/bank/connect?from=home');
    expect(link(el, 'tax').getAttribute('href')).toBe('/settings/tax?from=home');
    expect(link(el, 'receipt').getAttribute('href')).toBe('/documents?add=1');
  });

  it('a bank step or a tax step that is done links to its place in Settings', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setSetup('halfway'); // bank done, tax and receipt to do
    let el = render();
    expect(link(el, 'bank').getAttribute('href')).toBe('/settings');
    expect(link(el, 'bank').textContent?.trim()).toBe('View');
    expect(link(el, 'tax').getAttribute('href')).toBe('/settings/tax?from=home');

    demo.completeStep('tax');
    el = render();
    expect(link(el, 'tax').getAttribute('href')).toBe('/settings');
    expect(link(el, 'receipt').getAttribute('href')).toBe('/documents?add=1');
  });

  it('the steps are separate: a done tax step with no bank still starts the bank flow', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setSetup('new');
    demo.completeStep('tax');
    const el = render();
    expect(link(el, 'bank').getAttribute('href')).toBe('/settings/bank/connect?from=home');
    expect(link(el, 'tax').getAttribute('href')).toBe('/settings');
  });

  it('a receipt step that is done only shows the documents', () => {
    TestBed.inject(DemoStateService).setSetup('active');
    const el = render();
    expect(link(el, 'receipt').textContent?.trim()).toBe('View');
    expect(link(el, 'receipt').getAttribute('href')).toBe('/documents');
    expect(link(el, 'bank').getAttribute('href')).toBe('/settings');
    expect(link(el, 'tax').getAttribute('href')).toBe('/settings');
  });
});
