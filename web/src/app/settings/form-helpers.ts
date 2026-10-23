import { Injector, afterNextRender, type WritableSignal } from '@angular/core';

/**
 * Takes the errors of the named fields away from a form's `errors` signal, so a field's message goes as soon as the
 * field is changed. Nothing changes (no new object, so nothing is drawn again) when none of them has an error.
 */
export function clearErrors<E extends object>(
  errors: WritableSignal<E>,
  ...fields: (keyof E)[]
): void {
  if (!fields.some((field) => errors()[field] !== undefined)) return;
  errors.update((current) => {
    const next = { ...current };
    for (const field of fields) delete next[field];
    return next;
  });
}

/** Puts the cursor in the first element of `host` that matches `selector`, once the page has been drawn again. */
export function focusAfterRender(injector: Injector, host: HTMLElement, selector: string): void {
  afterNextRender(() => host.querySelector<HTMLElement>(selector)?.focus(), { injector });
}
