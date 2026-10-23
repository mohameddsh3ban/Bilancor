import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/** The pages a setup page can be opened from (`?from=home`, `payments` or `settings`), and so where it leads when it is done. */
export type From = 'home' | 'payments' | 'settings';

/** Where each page leads: its address. */
export const BACK_URLS: Record<From, string> = { home: '/', payments: '/payments', settings: '/settings' };

/** The page a `from` parameter names when this page can be opened from it; Settings for anything else, and when nothing is said. */
export function fromOf(param: string | null, allowed: readonly From[]): From {
  return allowed.find((from) => from === param) ?? 'settings';
}

/**
 * Where the page was opened from, read live from the `from` parameter of its address (call it in a field initialiser).
 * Only the pages in `allowed` count; Settings is the default.
 */
export function openedFrom(allowed: readonly From[]): Signal<From> {
  const route = inject(ActivatedRoute);
  return toSignal(route.queryParamMap.pipe(map((params) => fromOf(params.get('from'), allowed))), {
    initialValue: fromOf(route.snapshot.queryParamMap.get('from'), allowed),
  });
}
