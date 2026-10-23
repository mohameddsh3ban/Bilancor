import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/**
 * The pages a setup page can be opened from (`?from=home`, `payments`, `settings` or `invoice`), and so where it leads
 * when it is done. An invoice is the one being written: `?invoice=<id>` names it, and without an id it is the new one.
 */
export type From = 'home' | 'payments' | 'settings' | 'invoice';

/** Where each page leads: its address. For an invoice, the page to start a new one; `backUrlOf` knows the one that was open. */
export const BACK_URLS: Record<From, string> = {
  home: '/',
  payments: '/payments',
  settings: '/settings',
  invoice: '/invoices/new',
};

/** The page a `from` parameter names when this page can be opened from it; Settings for anything else, and when nothing is said. */
export function fromOf(param: string | null, allowed: readonly From[]): From {
  return allowed.find((from) => from === param) ?? 'settings';
}

/** Where a page opened from `from` leads: its address, or for an invoice named by `invoiceId`, that invoice's edit page. */
export function backUrlOf(from: From, invoiceId: string | null): string {
  return from === 'invoice' && invoiceId ? `/invoices/${encodeURIComponent(invoiceId)}/edit` : BACK_URLS[from];
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

/** The invoice a page was opened from, read live from the `invoice` parameter of its address; null when none is named. */
export function openedInvoiceId(): Signal<string | null> {
  const route = inject(ActivatedRoute);
  const idOf = (params: { get(name: string): string | null }): string | null => params.get('invoice') || null;
  return toSignal(route.queryParamMap.pipe(map(idOf)), { initialValue: idOf(route.snapshot.queryParamMap) });
}
