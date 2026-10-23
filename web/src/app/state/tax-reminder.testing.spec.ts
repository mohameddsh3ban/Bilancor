import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TaxReminderService } from './tax-reminder.service';
import { provideNoTaxReminder } from './tax-reminder.testing';

describe('provideNoTaxReminder', () => {
  beforeEach(() => localStorage.clear());

  it('the real service has the sample returns due and opens the pop-up, which the stand-in never does', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const real = TestBed.inject(TaxReminderService);
    expect(real.due().length).toBeGreaterThan(0);
    expect(real.open()).toBe(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoTaxReminder()] });
    const standIn = TestBed.inject(TaxReminderService);
    expect(standIn.due()).toEqual([]);
    expect(standIn.open()).toBe(false);
  });
});
