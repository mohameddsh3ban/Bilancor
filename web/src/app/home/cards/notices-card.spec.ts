import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import type { Notice } from '../../data/models';
import { DemoStateService } from '../../state/demo-state.service';
import { NoticeService } from '../../state/notice.service';
import { NoticesCard } from './notices-card';

describe('NoticesCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  function render() {
    const fixture = TestBed.createComponent(NoticesCard);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const q = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it('shows the open notices with an action link each', () => {
    const { el } = render();
    expect(q(el, 'notice-wd-n1')?.textContent).toContain('New terms from our bank-connection provider');
    expect(q(el, 'notice-wd-n3')?.textContent).toContain('Receipts that could not be read: 1');
    expect(q(el, 'notice-wd-n2')).toBeNull();
    expect(q(el, 'notice-action-wd-n1')?.getAttribute('href')).toBe('/soon/terms');
  });

  it('Fix opens Documents', () => {
    const { el } = render();
    expect(q(el, 'notice-action-wd-n3')?.textContent?.trim()).toBe('Fix');
    expect(q(el, 'notice-action-wd-n3')?.getAttribute('href')).toBe('/documents');
  });

  it('blocking notice has no dismiss', () => {
    const { el } = render();
    expect(q(el, 'notice-dismiss-wd-n1')).toBeNull();
    expect(q(el, 'notice-dismiss-wd-n3')).not.toBeNull();
  });

  it('dismiss removes the notice and keeps the blocking one', () => {
    const { fixture, el } = render();
    q(el, 'notice-dismiss-wd-n3')!.click();
    fixture.detectChanges();
    expect(q(el, 'notice-wd-n3')).toBeNull();
    expect(q(el, 'notice-wd-n1')).not.toBeNull();
  });

  it('"+N more" opens the bell panel', () => {
    // Weber Design has no stored bank notice any more, so no real notice overflows: a stand-in service has one.
    const extra: Notice = { id: 'extra', kind: 'bankExpiry', urgency: 4, blocking: false, params: { bank: 'Qonto', days: 5 }, date: '2026-10-19' };
    const bellOpen = signal(false);
    TestBed.overrideProvider(NoticeService, {
      useValue: { shown: signal<Notice[]>([]), overflow: signal([extra]), bellOpen, dismiss: () => undefined },
    });
    const { fixture, el } = render();
    const more = q(el, 'notices-more')!;
    expect(more.textContent?.trim()).toBe('+1 more');
    more.click();
    fixture.detectChanges();
    expect(bellOpen()).toBe(true);
  });

  it('has no more link when everything fits', () => {
    TestBed.inject(DemoStateService).setBusiness('cafe-linde');
    const { el } = render();
    expect(q(el, 'notices-more')).toBeNull();
  });
});
