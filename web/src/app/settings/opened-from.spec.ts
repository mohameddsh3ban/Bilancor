import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BACK_URLS, backUrlOf, fromOf, openedFrom, openedInvoiceId, type From } from './opened-from';

const ALL: readonly From[] = ['home', 'payments', 'settings'];

describe('fromOf', () => {
  it('is the page named by the parameter, when the page may be named', () => {
    expect(fromOf('home', ALL)).toBe('home');
    expect(fromOf('payments', ALL)).toBe('payments');
    expect(fromOf('settings', ALL)).toBe('settings');
  });

  it('is Settings when nothing is said, or something that is not a page', () => {
    expect(fromOf(null, ALL)).toBe('settings');
    expect(fromOf('', ALL)).toBe('settings');
    expect(fromOf('nonsense', ALL)).toBe('settings');
  });

  it('is Settings for a page that this page cannot come from', () => {
    expect(fromOf('payments', ['home', 'settings'])).toBe('settings');
    expect(fromOf('home', ['home', 'settings'])).toBe('home');
  });
});

describe('an invoice as the page it came from', () => {
  it('is the invoice when the page may be opened from one', () => {
    expect(fromOf('invoice', [...ALL, 'invoice'])).toBe('invoice');
  });

  it('is Settings for a page that cannot come from an invoice', () => {
    expect(fromOf('invoice', ALL)).toBe('settings');
  });
});

describe('BACK_URLS', () => {
  it('leads each page home to its own address, an invoice back to a new one', () => {
    expect(BACK_URLS).toEqual({
      home: '/',
      payments: '/payments',
      settings: '/settings',
      invoice: '/invoices/new',
    });
  });
});

describe('backUrlOf', () => {
  it('is the address of the page it came from', () => {
    expect(backUrlOf('home', null)).toBe('/');
    expect(backUrlOf('payments', null)).toBe('/payments');
    expect(backUrlOf('settings', null)).toBe('/settings');
  });

  it('is the edit page of the invoice that was open, and the new invoice when no invoice is named', () => {
    expect(backUrlOf('invoice', 'inv-weber-design-7')).toBe('/invoices/inv-weber-design-7/edit');
    expect(backUrlOf('invoice', null)).toBe('/invoices/new');
  });

  it('writes an invoice id that has odd characters as one safe part of the address', () => {
    expect(backUrlOf('invoice', 'a b/c')).toBe('/invoices/a%20b%2Fc/edit');
  });

  it('ignores an invoice id for a page that is not an invoice', () => {
    expect(backUrlOf('settings', 'inv-1')).toBe('/settings');
    expect(backUrlOf('home', 'inv-1')).toBe('/');
  });
});

@Component({
  template: '',
})
class Probe {
  readonly all = openedFrom(ALL);
  readonly some = openedFrom(['home', 'settings']);
  readonly withInvoice = openedFrom([...ALL, 'invoice']);
  readonly invoice = openedInvoiceId();
}

describe('openedFrom', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'page', component: Probe }])] });
  });

  it('reads the from parameter of the address the page opened with', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/page?from=payments', Probe);
    expect(page.all()).toBe('payments');
  });

  it('is Settings without the parameter, and for a page that is not allowed', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/page', Probe);
    expect(page.all()).toBe('settings');
    expect(page.some()).toBe('settings');
    const other = await harness.navigateByUrl('/page?from=payments&x=1', Probe);
    expect(other.some()).toBe('settings');
  });

  it('follows the parameter when the address changes on the same page', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/page?from=home', Probe);
    expect(page.all()).toBe('home');
    await TestBed.inject(Router).navigateByUrl('/page?from=payments');
    expect(page.all()).toBe('payments');
  });

  it('reads an invoice as the origin only for a page that allows it', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/page?from=invoice&invoice=inv-1', Probe);
    expect(page.withInvoice()).toBe('invoice');
    expect(page.all()).toBe('settings');
  });
});

describe('openedInvoiceId', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'page', component: Probe }])] });
  });

  it('reads the invoice parameter of the address', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/page?from=invoice&invoice=inv-weber-design-7', Probe);
    expect(page.invoice()).toBe('inv-weber-design-7');
  });

  it('is null without the parameter, or with an empty one', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/page?from=invoice', Probe);
    expect(page.invoice()).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/page?from=invoice&invoice=');
    expect(page.invoice()).toBeNull();
  });

  it('follows the parameter when the address changes on the same page', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/page?from=invoice&invoice=a', Probe);
    expect(page.invoice()).toBe('a');
    await TestBed.inject(Router).navigateByUrl('/page?from=invoice&invoice=b');
    expect(page.invoice()).toBe('b');
  });
});
