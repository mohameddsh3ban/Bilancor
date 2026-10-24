import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { ComingSoonPage } from './coming-soon.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

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

  it('documents, upload, decisions, the bank notices, the bank flow, the tax details, Invoices, Taxes, Reports, Settings, the statement import and the self-issued receipt are built, so they are no longer coming-soon features', async () => {
    const harness = await RouterTestingHarness.create('/soon/home');
    for (const feature of ['documents', 'upload', 'decisions', 'bankExpiry', 'bankEnded', 'bank', 'tax', 'invoices', 'taxes', 'reports', 'settings', 'statementImport', 'selfReceipt']) {
      await harness.navigateByUrl(`/soon/${feature}`);
      harness.detectChanges();
      const title = (harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent;
      expect(title, feature).toContain('This page');
    }
  });

  it('coming soon no longer lists selfReceipt: the self-issued receipt is built, so its title is gone and its link lands on the default page', async () => {
    const el = await render('/soon/selfReceipt');
    expect(el.querySelector('h1')?.textContent).toContain('This page');
    for (const lang of [en, de, ar]) expect(lang.soon).not.toHaveProperty('selfReceipt');
  });

  it('coming soon no longer lists cashPayment: Paid in cash or with my own money is built, so its title is gone and its link lands on the default page', async () => {
    const el = await render('/soon/cashPayment');
    expect(el.querySelector('h1')?.textContent).toContain('This page');
    for (const lang of [en, de, ar]) expect(lang.soon).not.toHaveProperty('cashPayment');
  });

  it('has a title for every feature a link uses', async () => {
    const features = [
      'home',
      'payments',
      'help',
      'more',
      'terms',
      'unreadable',
      'revenueLimit',
      'receipt',
      'account',
      'photo',
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
