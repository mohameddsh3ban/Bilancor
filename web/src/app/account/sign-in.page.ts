import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { clearErrors, focusAfterRender } from '../settings/form-helpers';
import { ChoiceCard, FieldError, INPUT_CLASS } from '../settings/form-parts';
import { AccountService } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { PersonLanguageService } from '../state/person-language.service';
import { AuthFrame } from './auth-frame';
import { DEMO_BOX } from './demo-email';
import { safeNext } from './next-url';

/** What is wrong with the email and password (a translation key each), or with the email as an account. */
interface CredentialErrors {
  email?: string;
  password?: string;
  /** The email is somebody the demo knows but cannot sign in, or nobody. */
  account?: 'member' | 'unknown';
}

/** A code of the authenticator app is 6 digits; the app shows it as two groups of three. */
const APP_CODE = /^\d{6}$/;

/**
 * The sign-in page (`/sign-in`), outside the app shell: email and password, then the code of the authenticator app unless
 * this device is trusted. Nothing is checked: Sara's email is filled in, any password works, and so do any 6 digits or any
 * backup code (which is used up). An email the demo knows by no login says so. Signing in sets the person's language, and
 * goes to the page that was asked for (`?next=`, only a path inside the app) or the homepage; `?signedOut=1` says
 * "You're signed out." (Sign out arrives there).
 */
@Component({
  selector: 'app-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthFrame, ChoiceCard, FieldError, HlmButton, RouterLink, TranslocoPipe],
  template: `
    <app-auth-frame (langPicked)="pickedHere = true">
      @if (step() === 'credentials') {
        <form
          class="flex flex-col gap-4"
          novalidate
          data-testid="sign-in-form"
          (submit)="submitCredentials($event)"
        >
          <h1 class="text-2xl font-semibold">{{ 'auth.signIn.title' | transloco }}</h1>

          @if (signedOut()) {
            <p
              class="border-border bg-muted rounded-md border p-3 text-sm"
              role="status"
              data-testid="signed-out-note"
            >
              {{ 'auth.signIn.signedOut' | transloco }}
            </p>
          }

          <div class="flex flex-col gap-1">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{ 'auth.field.email' | transloco }}</span>
              <input
                type="email"
                dir="ltr"
                autocomplete="username"
                spellcheck="false"
                data-testid="email"
                [class]="inputClass"
                [value]="email()"
                [attr.aria-invalid]="errors().email || errors().account ? 'true' : null"
                [attr.aria-describedby]="emailDescribedBy()"
                (input)="setEmail($event)"
              />
            </label>
            @if (errors().email; as key) {
              <p [appFieldError]="key" id="error-email" data-testid="error-email"></p>
            }
            @if (errors().account; as kind) {
              <p
                class="text-negative text-sm"
                role="alert"
                id="error-account"
                data-testid="error-account"
              >
                @if (kind === 'member') {
                  {{ 'auth.signIn.error.member' | transloco }}
                } @else {
                  {{ 'auth.signIn.error.unknown' | transloco }}
                  <a
                    class="text-primary font-medium underline-offset-4 hover:underline"
                    routerLink="/sign-up"
                    data-testid="unknown-create-link"
                  >
                    {{ 'auth.signIn.createAccount' | transloco }}
                  </a>
                }
              </p>
            }
          </div>

          <div class="flex flex-col gap-1">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{ 'auth.field.password' | transloco }}</span>
              <input
                type="password"
                dir="ltr"
                autocomplete="current-password"
                data-testid="password"
                [class]="inputClass"
                [value]="password()"
                [attr.aria-invalid]="errors().password ? 'true' : null"
                [attr.aria-describedby]="errors().password ? 'error-password' : null"
                (input)="setPassword($event)"
              />
            </label>
            @if (errors().password; as key) {
              <p [appFieldError]="key" id="error-password" data-testid="error-password"></p>
            }
            <div class="flex justify-end">
              <a
                class="text-primary text-sm font-medium underline-offset-4 hover:underline"
                routerLink="/forgot-password"
                data-testid="forgot-link"
              >
                {{ 'auth.signIn.forgot' | transloco }}
              </a>
            </div>
          </div>

          <button hlmBtn size="lg" type="submit" class="w-full" data-testid="sign-in-submit">
            {{ 'auth.signIn.submit' | transloco }}
          </button>

          <p class="text-muted-foreground text-center text-sm">
            {{ 'auth.signIn.newHere' | transloco }}
            <a
              class="text-primary font-medium underline-offset-4 hover:underline"
              routerLink="/sign-up"
              data-testid="create-account-link"
            >
              {{ 'auth.signIn.createAccount' | transloco }}
            </a>
          </p>

          <p [class]="demoBox" data-testid="demo-note">{{ 'auth.signIn.demo' | transloco }}</p>
        </form>
      } @else {
        <form
          class="flex flex-col gap-4"
          novalidate
          data-testid="code-form"
          (submit)="submitCode($event)"
        >
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold" data-testid="code-title">
              {{ 'auth.code.' + kind() + '.title' | transloco }}
            </h1>
            <p class="text-muted-foreground text-sm" id="code-hint">
              {{ 'auth.code.' + kind() + '.hint' | transloco }}
            </p>
          </div>

          <div class="flex flex-col gap-1">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{
                'auth.code.' + kind() + '.label' | transloco
              }}</span>
              <input
                type="text"
                dir="ltr"
                autocomplete="one-time-code"
                spellcheck="false"
                data-testid="code"
                [attr.inputmode]="kind() === 'app' ? 'numeric' : 'text'"
                [class]="inputClass"
                [value]="code()"
                [attr.aria-invalid]="codeError() ? 'true' : null"
                [attr.aria-describedby]="codeError() ? 'error-code code-hint' : 'code-hint'"
                (input)="setCode($event)"
              />
            </label>
            @if (codeError(); as key) {
              <p [appFieldError]="key" id="error-code" data-testid="error-code"></p>
            }
          </div>

          <app-choice-card
            type="checkbox"
            name="trust"
            data-testid="trust"
            [checked]="trust()"
            (changed)="trust.set($event)"
          >
            {{ 'auth.code.trust' | transloco }}
          </app-choice-card>

          <button hlmBtn size="lg" type="submit" class="w-full" data-testid="code-submit">
            {{ 'auth.code.submit' | transloco }}
          </button>

          <div class="flex flex-col items-start gap-2 text-sm">
            <button
              type="button"
              class="text-primary text-start font-medium underline-offset-4 hover:underline"
              [attr.data-testid]="kind() === 'app' ? 'use-backup' : 'use-app'"
              (click)="switchKind()"
            >
              {{ 'auth.code.' + kind() + '.switch' | transloco }}
            </button>
            <button
              type="button"
              class="text-muted-foreground text-start underline-offset-4 hover:underline"
              data-testid="code-back"
              (click)="back()"
            >
              {{ 'auth.code.back' | transloco }}
            </button>
          </div>

          <p [class]="demoBox" data-testid="code-demo">
            {{ 'auth.code.' + kind() + '.demo' | transloco }}
          </p>
        </form>
      }
    </app-auth-frame>
  `,
})
export class SignInPage {
  private readonly accounts = inject(AccountService);
  private readonly demo = inject(DemoStateService);
  private readonly personLanguage = inject(PersonLanguageService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });

  protected readonly inputClass = INPUT_CLASS;
  protected readonly demoBox = DEMO_BOX;

  protected readonly signedOut = computed(() => this.query().get('signedOut') === '1');

  protected readonly step = signal<'credentials' | 'code'>('credentials');
  protected readonly email = signal(this.accounts.samplePerson.email);
  protected readonly password = signal('');
  protected readonly errors = signal<CredentialErrors>({});
  protected readonly emailDescribedBy = computed(() => {
    const ids = [
      this.errors().email ? 'error-email' : null,
      this.errors().account ? 'error-account' : null,
    ];
    return ids.filter((id) => id !== null).join(' ') || null;
  });

  /** Who the email and password named, while the code is asked for. */
  private readonly personId = signal<string | null>(null);
  /** The code of the authenticator app, or one of the backup codes. */
  protected readonly kind = signal<'app' | 'backup'>('app');
  protected readonly code = signal('');
  protected readonly codeError = signal<string | null>(null);
  protected readonly trust = signal(false);

  /** Whether a language button was pressed here: that language then wins over the person's own. */
  protected pickedHere = false;

  protected setEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    clearErrors(this.errors, 'email', 'account');
  }

  protected setPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    clearErrors(this.errors, 'password');
  }

  protected setCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
    this.codeError.set(null);
  }

  protected submitCredentials(event: Event): void {
    event.preventDefault();
    const email = this.email().trim();
    const errors: CredentialErrors = {};
    if (!email) errors.email = 'auth.error.emailMissing';
    if (!this.password()) errors.password = 'auth.error.passwordMissing';
    const person = email ? this.accounts.findByEmail(email) : undefined;
    // A member row of a business is somebody the demo knows, but only Sara and the accounts made here are logins.
    if (email && !person) errors.account = this.demo.isMemberEmail(email) ? 'member' : 'unknown';
    if (Object.keys(errors).length > 0 || !person) {
      this.errors.set(errors);
      focusAfterRender(this.injector, this.host, '[aria-invalid="true"]');
      return;
    }
    this.errors.set({});
    if (this.accounts.isTrusted(person.id)) {
      this.finish(person.id, false);
      return;
    }
    this.personId.set(person.id);
    this.show('code');
  }

  protected submitCode(event: Event): void {
    event.preventDefault();
    const id = this.personId();
    if (id === null) return;
    const value = this.code().trim();
    const error =
      this.kind() === 'app' ? this.appCodeError(value) : this.backupCodeError(id, value);
    if (error !== null) {
      this.codeError.set(error);
      focusAfterRender(this.injector, this.host, '[data-testid="code"]');
      return;
    }
    this.finish(id, this.trust());
  }

  /** Swaps between the code of the app and a backup code. */
  protected switchKind(): void {
    this.kind.update((kind) => (kind === 'app' ? 'backup' : 'app'));
    this.code.set('');
    this.codeError.set(null);
    focusAfterRender(this.injector, this.host, '[data-testid="code"]');
  }

  /** Back to the email and password, which keep what was typed. */
  protected back(): void {
    this.personId.set(null);
    this.kind.set('app');
    this.code.set('');
    this.codeError.set(null);
    this.show('credentials');
  }

  /** The message for a code of the app that is not 6 digits (spaces do not count), or null when it is. */
  private appCodeError(value: string): string | null {
    return APP_CODE.test(value.replace(/\s/g, '')) ? null : 'auth.code.error.digits';
  }

  /** The message for a backup code that is empty or that the person has none left for, or null: the code is used up. */
  private backupCodeError(personId: string, value: string): string | null {
    if (!value) return 'auth.code.error.backupMissing';
    return this.accounts.useBackupCode(personId) ? null : 'auth.code.error.noBackups';
  }

  private show(step: 'credentials' | 'code'): void {
    this.step.set(step);
    focusAfterRender(
      this.injector,
      this.host,
      step === 'code' ? '[data-testid="code"]' : '[data-testid="email"]',
    );
  }

  /** Signs in, sets the language, and goes to the page that was asked for. */
  private finish(personId: string, trustDevice: boolean): void {
    this.accounts.signIn(personId, trustDevice);
    this.personLanguage.applyOnSignIn(personId, this.pickedHere);
    void this.router.navigateByUrl(safeNext(this.query().get('next')));
  }
}
