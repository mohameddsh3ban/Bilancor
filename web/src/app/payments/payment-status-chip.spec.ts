import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { TxStatus } from '../data/models';
import { PaymentStatusChip } from './payment-status-chip';

@Component({
  imports: [PaymentStatusChip],
  template: `<app-payment-status-chip [status]="status" />`,
})
class Host {
  status: TxStatus = 'booked';
}

describe('PaymentStatusChip', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  function render(status: TxStatus): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.status = status;
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[data-testid="tx-status"]') as HTMLElement;
  }

  it('status chip shows a word, not only an icon', () => {
    expect(render('booked').textContent?.trim()).toBe('Booked');
    expect(render('confirm').textContent?.trim()).toBe('Please confirm');
    expect(render('noReceipt').textContent?.trim()).toBe('Receipt missing');
    expect(render('unclear').textContent?.trim()).toBe('Unclear');
  });

  it('uses the status colour tokens and never wraps', () => {
    expect(render('booked').className).toContain('text-positive');
    expect(render('confirm').className).toContain('text-warning');
    expect(render('unclear').className).toContain('text-warning');
    expect(render('noReceipt').className).toContain('text-negative');
    expect(render('booked').classList).toContain('whitespace-nowrap');
  });

  it('shows the word in the current language', () => {
    TestBed.inject(LanguageService).setLang('de');
    expect(render('booked').textContent?.trim()).toBe('Gebucht');
  });
});
