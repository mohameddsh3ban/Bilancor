import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { ComingSoonPage } from './coming-soon.page';

describe('ComingSoonPage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([{ path: 'soon/:feature', component: ComingSoonPage }]),
      ],
    });
  });

  async function render(url: string): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('shows the feature name and the next-step text', async () => {
    const el = await render('/soon/payments');
    expect(el.querySelector('h1')?.textContent).toContain('Payments');
    expect(el.textContent).toContain('We design this page next');
  });

  it('links back home', async () => {
    const el = await render('/soon/payments');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });

  it('falls back to a generic title for an unknown feature', async () => {
    const el = await render('/soon/nonsense');
    expect(el.querySelector('h1')?.textContent).toContain('This page');
  });

  it('documents, upload, decisions, the bank notices, the bank flow, the tax details and Settings are built, so they are no longer coming-soon features', async () => {
    const harness = await RouterTestingHarness.create('/soon/home');
    for (const feature of ['documents', 'upload', 'decisions', 'bankExpiry', 'bankEnded', 'bank', 'tax', 'settings']) {
      await harness.navigateByUrl(`/soon/${feature}`);
      harness.detectChanges();
      const title = (harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent;
      expect(title, feature).toContain('This page');
    }
  });

  it('has a title for every feature a link uses', async () => {
    const features = [
      'home',
      'payments',
      'invoices',
      'taxes',
      'reports',
      'help',
      'more',
      'terms',
      'unreadable',
      'revenueLimit',
      'receipt',
      'account',
      'photo',
      'selfReceipt',
      'cashPayment',
      'statementImport',
    ];
    const harness = await RouterTestingHarness.create('/soon/home');
    for (const feature of features) {
      await harness.navigateByUrl(`/soon/${feature}`);
      harness.detectChanges();
      const title = (harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent;
      expect(title, feature).not.toContain('This page');
    }
  });
});
