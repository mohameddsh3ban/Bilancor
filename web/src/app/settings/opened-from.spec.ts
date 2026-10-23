import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BACK_URLS, fromOf, openedFrom, type From } from './opened-from';

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

describe('BACK_URLS', () => {
  it('leads each page home to its own address', () => {
    expect(BACK_URLS).toEqual({ home: '/', payments: '/payments', settings: '/settings' });
  });
});

@Component({
  template: '',
})
class Probe {
  readonly all = openedFrom(ALL);
  readonly some = openedFrom(['home', 'settings']);
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
});
