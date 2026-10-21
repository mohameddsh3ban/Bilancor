import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
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

  it('shows the two most urgent notices with an action link each', () => {
    const { el } = render();
    expect(q(el, 'notice-wd-n1')?.textContent).toContain('New terms from our bank-connection provider');
    expect(q(el, 'notice-wd-n2')?.textContent).toContain('Your Qonto connection expires in 5 days');
    expect(q(el, 'notice-wd-n3')).toBeNull();
    expect(q(el, 'notice-action-wd-n1')?.getAttribute('href')).toBe('/soon/terms');
    expect(q(el, 'notice-action-wd-n2')?.getAttribute('href')).toBe('/soon/bankExpiry');
  });

  it('blocking notice has no dismiss', () => {
    const { el } = render();
    expect(q(el, 'notice-dismiss-wd-n1')).toBeNull();
    expect(q(el, 'notice-dismiss-wd-n2')).not.toBeNull();
  });

  it('dismiss removes the notice and the next one moves up', () => {
    const { fixture, el } = render();
    q(el, 'notice-dismiss-wd-n2')!.click();
    fixture.detectChanges();
    expect(q(el, 'notice-wd-n2')).toBeNull();
    expect(q(el, 'notice-wd-n3')).not.toBeNull();
  });

  it('"+N more" opens the bell panel', () => {
    const { fixture, el } = render();
    const more = q(el, 'notices-more')!;
    expect(more.textContent?.trim()).toBe('+1 more');
    more.click();
    fixture.detectChanges();
    expect(TestBed.inject(NoticeService).bellOpen()).toBe(true);
  });

  it('has no more link when everything fits', () => {
    TestBed.inject(DemoStateService).setBusiness('cafe-linde');
    const { el } = render();
    expect(q(el, 'notices-more')).toBeNull();
  });
});
