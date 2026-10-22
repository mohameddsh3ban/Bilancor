import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';

/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;

/** "Or forward receipts to <address>" with a Copy button that says "Copied" for a moment. */
@Component({
  selector: 'app-inbox-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck, lucideCopy })],
  host: {
    class: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm',
    'data-testid': 'inbox-line',
  },
  template: `
    <p class="text-muted-foreground min-w-0">
      {{ 'documents.inbox.text' | transloco }}
      <bdi dir="ltr" class="text-foreground font-medium break-all" data-testid="inbox-email">{{
        email()
      }}</bdi>
    </p>
    <button
      hlmBtn
      variant="outline"
      size="sm"
      type="button"
      aria-live="polite"
      data-testid="inbox-copy"
      (click)="copy()"
    >
      <ng-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" size="14" aria-hidden="true" />
      {{ (copied() ? 'documents.inbox.copied' : 'documents.inbox.copy') | transloco }}
    </button>
  `,
})
export class InboxLine {
  readonly email = input.required<string>();

  protected readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /**
   * Puts the address on the clipboard. Where there is no clipboard (a demo opened over plain http) or it refuses,
   * nothing is lost: the address stays on the page to select. "Copied" shows either way.
   */
  protected copy(): void {
    try {
      navigator.clipboard.writeText(this.email()).catch(() => undefined);
    } catch {
      // No clipboard here.
    }
    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), COPIED_MS);
  }
}
