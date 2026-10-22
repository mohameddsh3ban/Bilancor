import { DestroyRef, Injector, afterNextRender, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

/**
 * Opens the browser's print dialog once, after the page first renders, when `ready` says there is something
 * to print. A page opened directly has no translations at its first render, so this waits for the language
 * file and one more render, or the printout would have no labels. Nothing prints if the page is left in the
 * meantime. Call it from a constructor (it needs an injection context). Later changes to the page never open
 * the dialog again.
 */
export function printOnceRendered(ready: () => boolean): void {
  const transloco = inject(TranslocoService);
  const injector = inject(Injector);
  let left = false;
  inject(DestroyRef).onDestroy(() => (left = true));
  afterNextRender(() => {
    if (!ready()) return;
    void firstValueFrom(transloco.load(transloco.getActiveLang())).then(() => {
      if (!left) afterNextRender(() => window.print(), { injector });
    });
  });
}
