import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { DialogCard } from '../core/layout/dialog-card';
import { isNewPassword } from '../domain/people';
import { clearErrors, focusAfterRender } from '../settings/form-helpers';
import { FieldError, INPUT_CLASS } from '../settings/form-parts';
import { AccountService, BACKUP_CODES } from '../state/account.service';
import { DEMO_BOX } from './demo-email';
import { TwoStepSetup } from './two-step-setup';

/** The pop-ups of this card: they share one window and the answer the person gives in it. */
type Pop = 'password' | 'phone' | 'codes';

/** The password the demo says is the current one (nothing checks it: the sign-in password only has to be filled in). */
const DEMO_PASSWORD = 'demo-password';

/** The button each pop-up was opened from: the cursor goes back to it. */
const OPENER: Record<Pop, string> = {
  password: 'password-change',
  phone: 'new-phone',
  codes: 'new-codes',
};

/** The messages under the password fields (translation keys). */
interface PasswordErrors {
  current?: string;
  next?: string;
}

/**
 * My account › Signing in: the password, two-step login and the backup codes, each a row with its button.
 *
 * - **Change** the password opens a pop-up with the current password filled in and the new one (at least 10 characters).
 *   Saving signs out every other device and says so.
 * - Two-step login is always **On**: it can't be switched off. **Use a new phone** shows the authenticator step again
 *   (QR picture, the 6-digit code, new backup codes) in a pop-up; its own "I've saved them" ends it, and only then do the
 *   new codes count ("8 of 8 left"): Cancel leaves the old ones.
 * - **Make new codes** gives 8 new backup codes at once (the old ones stop counting, "8 of 8 left") and shows them in a
 *   pop-up. They are shown only then: there is no other way to see them again.
 *
 * When a pop-up closes the cursor goes back to the button it came from, or to the line that says what happened when that
 * line took the button's place.
 */
@Component({
  selector: 'app-signing-in-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogCard,
    FieldError,
    HlmButton,
    HlmCardImports,
    HlmDialogImports,
    NgIcon,
    TranslocoPipe,
    TwoStepSetup,
  ],
  viewProviders: [provideIcons({ lucideCheck })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="signing-in-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle tabindex="-1" class="outline-none" data-testid="signing-in-title">
          {{ 'account.signingIn.title' | transloco }}
        </h2>
      </header>
      <div hlmCardContent class="flex flex-col">
        <div
          class="border-border flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0"
          data-testid="password-row"
        >
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p class="min-w-0 flex-1 basis-48 font-medium">
              {{ 'auth.field.password' | transloco }}
            </p>
            <button
              hlmBtn
              type="button"
              variant="outline"
              size="sm"
              class="min-h-10 shrink-0"
              data-testid="password-change"
              [attr.aria-label]="'account.signingIn.password.changeLabel' | transloco"
              (click)="openPassword()"
            >
              {{ 'account.change' | transloco }}
            </button>
          </div>
          <div role="status">
            @if (passwordChanged()) {
              <p
                class="text-positive flex items-center gap-1 text-sm outline-none"
                tabindex="-1"
                data-testid="password-changed"
              >
                <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
                {{ 'account.signingIn.password.changed' | transloco }}
              </p>
            }
          </div>
        </div>

        <div
          class="border-border flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0"
          data-testid="two-step-row"
        >
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div class="min-w-0 flex-1 basis-48">
              <p class="font-medium">
                {{ 'account.signingIn.twoStep.label' | transloco }}
                <span class="text-positive ps-1 font-semibold" data-testid="two-step-status">{{
                  'account.signingIn.twoStep.on' | transloco
                }}</span>
              </p>
              <p class="text-muted-foreground text-sm" data-testid="two-step-hint">
                {{ 'account.signingIn.twoStep.hint' | transloco }}
              </p>
            </div>
            <button
              hlmBtn
              type="button"
              variant="outline"
              size="sm"
              class="min-h-10 shrink-0"
              data-testid="new-phone"
              (click)="openPhone()"
            >
              {{ 'account.signingIn.twoStep.newPhone' | transloco }}
            </button>
          </div>
          <div role="status">
            @if (phoneDone()) {
              <p
                class="text-positive flex items-center gap-1 text-sm outline-none"
                tabindex="-1"
                data-testid="phone-done"
              >
                <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
                {{ 'account.signingIn.twoStep.done' | transloco }}
              </p>
            }
          </div>
        </div>

        <div
          class="border-border flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
          data-testid="backup-row"
        >
          <div class="min-w-0 flex-1 basis-48">
            <p class="font-medium">{{ 'account.signingIn.backup.label' | transloco }}</p>
            <p class="text-muted-foreground text-sm" data-testid="backup-left">
              {{
                'account.signingIn.backup.left' | transloco: { left: backupLeft(), total: total }
              }}
            </p>
          </div>
          <button
            hlmBtn
            type="button"
            variant="outline"
            size="sm"
            class="min-h-10 shrink-0"
            data-testid="new-codes"
            (click)="openCodes()"
          >
            {{ 'account.signingIn.backup.make' | transloco }}
          </button>
        </div>
      </div>
    </section>

    <!-- The pop-ups show through the overlay: nothing of them belongs in the card. -->
    <div hidden>
      <hlm-dialog
        [state]="dialogOpen() ? 'open' : 'closed'"
        autoFocus="dialog"
        (stateChanged)="onDialogState($event)"
      >
        <hlm-dialog-content
          *hlmDialogPortal
          appDialogCard
          data-testid="signing-dialog"
          [closeLabel]="'account.close' | transloco"
        >
          @switch (pop()) {
            @case ('password') {
              <form class="grid gap-6" novalidate (submit)="savePassword($event)">
                <hlm-dialog-header class="pe-8">
                  <h2
                    hlmDialogTitle
                    class="text-lg leading-snug font-semibold"
                    data-testid="signing-dialog-title"
                  >
                    {{ 'account.signingIn.password.dialog.title' | transloco }}
                  </h2>
                </hlm-dialog-header>

                <p [class]="demoBox" data-testid="password-demo">
                  {{ 'account.signingIn.password.dialog.demo' | transloco }}
                </p>

                <div class="flex flex-col gap-1">
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="text-muted-foreground">{{
                      'account.signingIn.password.dialog.current' | transloco
                    }}</span>
                    <input
                      type="password"
                      dir="ltr"
                      autocomplete="current-password"
                      data-testid="password-current"
                      [class]="inputClass"
                      [value]="current()"
                      [attr.aria-invalid]="errors().current ? 'true' : null"
                      [attr.aria-describedby]="errors().current ? 'password-error-current' : null"
                      (input)="setCurrent($event)"
                    />
                  </label>
                  @if (errors().current; as key) {
                    <p
                      [appFieldError]="key"
                      id="password-error-current"
                      data-testid="password-error-current"
                    ></p>
                  }
                </div>

                <div class="flex flex-col gap-1">
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="text-muted-foreground">{{
                      'auth.forgot.new.label' | transloco
                    }}</span>
                    <input
                      type="password"
                      dir="ltr"
                      autocomplete="new-password"
                      data-testid="password-new"
                      [class]="inputClass"
                      [value]="next()"
                      [attr.aria-invalid]="errors().next ? 'true' : null"
                      [attr.aria-describedby]="
                        errors().next ? 'password-error-new password-hint' : 'password-hint'
                      "
                      (input)="setNext($event)"
                    />
                  </label>
                  <p
                    class="text-muted-foreground text-xs"
                    id="password-hint"
                    data-testid="password-hint"
                  >
                    {{ 'auth.signUp.passwordHint' | transloco }}
                  </p>
                  @if (errors().next; as key) {
                    <p
                      [appFieldError]="key"
                      id="password-error-new"
                      data-testid="password-error-new"
                    ></p>
                  }
                </div>

                <p class="text-muted-foreground text-sm" data-testid="password-note">
                  {{ 'account.signingIn.password.dialog.note' | transloco }}
                </p>

                <hlm-dialog-footer>
                  <button
                    hlmBtn
                    type="button"
                    variant="outline"
                    class="min-h-10"
                    data-testid="signing-cancel"
                    (click)="close()"
                  >
                    {{ 'account.cancel' | transloco }}
                  </button>
                  <button hlmBtn type="submit" class="min-h-10" data-testid="password-save">
                    {{ 'account.signingIn.password.dialog.save' | transloco }}
                  </button>
                </hlm-dialog-footer>
              </form>
            }
            @case ('phone') {
              <hlm-dialog-header class="pe-8">
                <h2
                  hlmDialogTitle
                  class="text-lg leading-snug font-semibold"
                  data-testid="signing-dialog-title"
                >
                  {{ 'account.signingIn.twoStep.newPhone' | transloco }}
                </h2>
              </hlm-dialog-header>

              <app-two-step-setup [codes]="codes()" (done)="phoneSaved()" />

              <hlm-dialog-footer>
                <button
                  hlmBtn
                  type="button"
                  variant="outline"
                  class="min-h-10"
                  data-testid="signing-close"
                  (click)="close()"
                >
                  {{ (phoneDone() ? 'account.close' : 'account.cancel') | transloco }}
                </button>
              </hlm-dialog-footer>
            }
            @case ('codes') {
              <hlm-dialog-header class="pe-8">
                <h2
                  hlmDialogTitle
                  class="text-lg leading-snug font-semibold"
                  data-testid="signing-dialog-title"
                >
                  {{ 'account.signingIn.backup.dialog.title' | transloco }}
                </h2>
              </hlm-dialog-header>

              <div class="flex flex-col gap-2 text-sm">
                <p data-testid="codes-hint">{{ 'auth.twoStep.codesHint' | transloco }}</p>
                <p class="text-muted-foreground" data-testid="codes-old">
                  {{ 'account.signingIn.backup.dialog.old' | transloco }}
                </p>
              </div>
              <ul class="grid grid-cols-2 gap-2" data-testid="codes-list">
                @for (code of codes(); track code) {
                  <li
                    class="border-border rounded-md border px-3 py-2 text-center font-mono text-sm"
                  >
                    <bdi dir="ltr">{{ code }}</bdi>
                  </li>
                }
              </ul>

              <hlm-dialog-footer>
                <button
                  hlmBtn
                  type="button"
                  class="min-h-10"
                  data-testid="signing-close"
                  (click)="close()"
                >
                  {{ 'account.signingIn.backup.dialog.done' | transloco }}
                </button>
              </hlm-dialog-footer>
            }
          }
        </hlm-dialog-content>
      </hlm-dialog>
    </div>
  `,
})
export class SigningInCard {
  private readonly accounts = inject(AccountService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly inputClass = INPUT_CLASS;
  protected readonly demoBox = DEMO_BOX;
  protected readonly total = BACKUP_CODES;
  protected readonly backupLeft = computed(() => this.accounts.person().backupCodesLeft);

  protected readonly dialogOpen = signal(false);
  /** Which pop-up it is; kept while the pop-up fades out, so it never changes in front of the eyes. */
  protected readonly pop = signal<Pop>('password');

  // The password pop-up: it opens with the current password filled in and the new one empty.
  protected readonly current = signal(DEMO_PASSWORD);
  protected readonly next = signal('');
  protected readonly errors = signal<PasswordErrors>({});
  protected readonly passwordChanged = signal(false);

  /** The backup codes a pop-up shows (made when Make new codes opened, still unsaved when Use a new phone opened): shown there, and nowhere else. */
  protected readonly codes = signal<string[]>([]);
  /** The new phone's authenticator step is finished. */
  protected readonly phoneDone = signal(false);

  protected openPassword(): void {
    this.current.set(DEMO_PASSWORD);
    this.next.set('');
    this.errors.set({});
    this.passwordChanged.set(false);
    this.open('password');
  }

  /** The new set is shown from the start but only counts once it is saved (`phoneSaved`): Cancel leaves the old codes. */
  protected openPhone(): void {
    this.codes.set(this.accounts.peekBackupCodes());
    this.phoneDone.set(false);
    this.open('phone');
  }

  /** "I've saved them": the codes the pop-up showed are now the ones that count (the old ones stop). */
  protected phoneSaved(): void {
    this.codes.set(this.accounts.makeBackupCodes());
    this.phoneDone.set(true);
  }

  protected openCodes(): void {
    this.codes.set(this.accounts.makeBackupCodes());
    this.open('codes');
  }

  protected setCurrent(event: Event): void {
    this.current.set((event.target as HTMLInputElement).value);
    clearErrors(this.errors, 'current');
  }

  protected setNext(event: Event): void {
    this.next.set((event.target as HTMLInputElement).value);
    clearErrors(this.errors, 'next');
  }

  /** The new password is not kept (nothing here is a real account): its length is checked, and the other devices are signed out. */
  protected savePassword(event: Event): void {
    event.preventDefault();
    const errors: PasswordErrors = {};
    if (this.current() === '') errors.current = 'account.signingIn.password.error.current';
    if (!isNewPassword(this.next())) errors.next = 'auth.signUp.error.passwordShort';
    this.errors.set(errors);
    if (errors.current || errors.next) {
      // The pop-up is drawn in the overlay, outside this element: the cursor is looked for in the whole page.
      focusAfterRender(
        this.injector,
        this.document.body,
        '[data-testid="signing-dialog"] [aria-invalid="true"]',
      );
      return;
    }
    this.accounts.signOutOtherDevices();
    this.passwordChanged.set(true);
    this.dialogOpen.set(false);
    focusAfterRender(this.injector, this.host, '[data-testid="password-changed"]');
  }

  /** The buttons close the pop-up themselves; the cursor goes back to where the person was. */
  protected close(): void {
    this.dialogOpen.set(false);
    focusAfterRender(this.injector, this.host, `[data-testid="${OPENER[this.pop()]}"]`);
  }

  /** The cross, Escape and a tap outside close the pop-up by themselves; it follows. */
  protected onDialogState(state: 'open' | 'closed'): void {
    if (state === 'closed' && this.dialogOpen()) this.close();
  }

  private open(pop: Pop): void {
    this.pop.set(pop);
    this.dialogOpen.set(true);
  }
}
