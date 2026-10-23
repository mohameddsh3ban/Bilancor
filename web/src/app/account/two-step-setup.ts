import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { isAppCode } from '../domain/people';
import { focusAfterRender } from '../settings/form-helpers';
import { FieldError, INPUT_CLASS } from '../settings/form-parts';
import { DEMO_BOX } from './demo-email';

let nextSetupId = 0;

/** The key a real app would hold, as the demo shows it for people who can't scan: made up, like everything here. */
const DEMO_KEY = 'DEMO 4F7K 2Q9X 8MZP';

const QR_SIZE = 25;

/**
 * A picture that looks like a QR code and is only a pattern: the three corner squares of a real one, and the rest drawn
 * from a fixed formula so it never changes. Nothing can scan it; the demo box next to it says so. One SVG path of the
 * dark squares.
 */
const QR_PATH = (() => {
  const corners = [
    [0, 0],
    [QR_SIZE - 7, 0],
    [0, QR_SIZE - 7],
  ];
  const dark = (x: number, y: number): boolean => {
    for (const [cx, cy] of corners) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const middle = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        return ring || middle;
      }
      // The empty line around a corner square.
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return false;
    }
    return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 7 < 3;
  };
  let path = '';
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (dark(x, y)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return path;
})();

/**
 * Setting up the second step of signing in (the code of an authenticator app), as one block that the pages around it
 * share: sign-up and joining (with the first set of backup codes), and My account (with new ones, in a dialog). It shows
 * a QR picture and the key to type for a phone that can't scan, the field for the app's 6-digit code (any 6 digits work in
 * the demo), and the backup codes to save. **I've saved them** needs the 6 digits, says so when they are not, and then
 * tells the page (`done`): the block is finished and keeps its code and its words, so the page can go on.
 */
@Component({
  selector: 'app-two-step-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldError, HlmButton, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck })],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <p class="text-sm" [id]="uid + '-scan'">{{ 'auth.twoStep.scan' | transloco }}</p>

    <div class="flex flex-col items-center gap-2">
      <svg
        viewBox="-1 -1 27 27"
        class="bg-background border-border size-36 rounded-md border"
        shape-rendering="crispEdges"
        aria-hidden="true"
        focusable="false"
        data-testid="two-step-qr"
      >
        <path class="fill-foreground" [attr.d]="qrPath" />
      </svg>
      <p class="text-muted-foreground text-center text-xs">
        {{ 'auth.twoStep.keyIntro' | transloco }}
        <bdi dir="ltr" class="text-foreground font-mono font-medium" data-testid="two-step-key">{{
          key
        }}</bdi>
      </p>
    </div>

    <div class="flex flex-col gap-1">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">{{ 'auth.twoStep.code' | transloco }}</span>
        <input
          type="text"
          dir="ltr"
          inputmode="numeric"
          autocomplete="one-time-code"
          spellcheck="false"
          data-testid="two-step-code"
          [class]="inputClass"
          [value]="code()"
          [readOnly]="saved()"
          [attr.aria-invalid]="codeError() ? 'true' : null"
          [attr.aria-describedby]="codeError() ? uid + '-error ' + uid + '-scan' : uid + '-scan'"
          (input)="setCode($event)"
          (keydown.enter)="enter($event)"
        />
      </label>
      @if (codeError(); as messageKey) {
        <p [appFieldError]="messageKey" [id]="uid + '-error'" data-testid="two-step-error"></p>
      }
    </div>

    <p [class]="demoBox" data-testid="two-step-demo">{{ 'auth.twoStep.demo' | transloco }}</p>

    <section class="flex flex-col gap-2" [attr.aria-labelledby]="uid + '-codes'">
      <h3 class="text-sm font-semibold" [id]="uid + '-codes'">
        {{ 'auth.twoStep.codesTitle' | transloco }}
      </h3>
      <p class="text-muted-foreground text-sm">{{ 'auth.twoStep.codesHint' | transloco }}</p>
      <ul class="grid grid-cols-2 gap-2" data-testid="two-step-backup">
        @for (backup of codes(); track backup) {
          <li class="border-border rounded-md border px-3 py-2 text-center font-mono text-sm">
            <bdi dir="ltr">{{ backup }}</bdi>
          </li>
        }
      </ul>
    </section>

    <div role="status">
      @if (saved()) {
        <p
          class="text-positive flex items-center gap-2 text-sm outline-none"
          tabindex="-1"
          data-testid="two-step-saved"
        >
          <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
          {{ 'auth.twoStep.saved' | transloco }}
        </p>
      } @else {
        <button
          hlmBtn
          type="button"
          variant="outline"
          size="lg"
          class="w-full"
          data-testid="two-step-done"
          (click)="save()"
        >
          {{ 'auth.twoStep.save' | transloco }}
        </button>
      }
    </div>
  `,
})
export class TwoStepSetup {
  /** The backup codes to show (and the person to save): the page makes them. */
  readonly codes = input.required<string[]>();
  /** The 6-digit code is right and the backup codes are saved. */
  readonly done = output<void>();

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly inputClass = INPUT_CLASS;
  protected readonly demoBox = DEMO_BOX;
  protected readonly key = DEMO_KEY;
  protected readonly qrPath = QR_PATH;
  protected readonly uid = `two-step-${nextSetupId++}`;

  protected readonly code = signal('');
  protected readonly codeError = signal<string | null>(null);
  protected readonly saved = signal(false);

  protected setCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
    this.codeError.set(null);
  }

  /** Enter in the field is the button: a form around the block must not take it for its own Finish. */
  protected enter(event: Event): void {
    event.preventDefault();
    this.save();
  }

  protected save(): void {
    if (this.saved()) return;
    if (!isAppCode(this.code())) {
      this.codeError.set('auth.twoStep.error.digits');
      focusAfterRender(this.injector, this.host, '[data-testid="two-step-code"]');
      return;
    }
    this.saved.set(true);
    // The button the cursor was on is gone: the cursor goes to the words that took its place.
    focusAfterRender(this.injector, this.host, '[data-testid="two-step-saved"]');
    this.done.emit();
  }
}
