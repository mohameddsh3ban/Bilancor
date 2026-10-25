import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HelpContextService } from './help-context.service';

describe('HelpContextService', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'old', redirectTo: 'taxes' },
          { path: '**', children: [] },
        ]),
      ],
    });
    router = TestBed.inject(Router);
  });

  it('has no last page until the person has been somewhere', () => {
    expect(TestBed.inject(HelpContextService).lastPage()).toBeNull();
  });

  it('is the last page opened, with its query and fragment', async () => {
    const help = TestBed.inject(HelpContextService);

    await router.navigateByUrl('/payments/wd-t3?tab=history#receipt');
    expect(help.lastPage()).toBe('/payments/wd-t3?tab=history#receipt');

    await router.navigateByUrl('/taxes');
    expect(help.lastPage()).toBe('/taxes');
  });

  it('does not count Help itself: its pages leave the last page as it was', async () => {
    const help = TestBed.inject(HelpContextService);
    await router.navigateByUrl('/taxes');

    for (const url of [
      '/help',
      '/help?topic=taxes',
      '/help/terms#ustva',
      '/help/vat-due',
      '/help/contact?q=x',
    ]) {
      await router.navigateByUrl(url);
      expect(help.lastPage(), url).toBe('/taxes');
    }

    await router.navigateByUrl('/helpful');
    expect(help.lastPage(), 'a page that only starts with the same letters').toBe('/helpful');
  });

  it('follows a redirect to where the page really is', async () => {
    const help = TestBed.inject(HelpContextService);
    await router.navigateByUrl('/old');
    expect(help.lastPage()).toBe('/taxes');
  });

  it('knows the page the person is on when the service starts late', async () => {
    await router.navigateByUrl('/documents');
    expect(TestBed.inject(HelpContextService).lastPage()).toBe('/documents');
  });

  it('has no last page when the service starts on a Help page', async () => {
    await router.navigateByUrl('/help/terms');
    expect(TestBed.inject(HelpContextService).lastPage()).toBeNull();
  });
});
