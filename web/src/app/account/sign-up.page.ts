import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { LanguageService } from '../core/i18n/language.service';
import { isAppCode, isEmail, isNewPassword, normalEmail } from '../domain/people';
import { clearErrors, focusAfterRender } from '../settings/form-helpers';
import { FieldError, INPUT_CLASS } from '../settings/form-parts';
import { AccountService, demoBackupCodes } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { PersonLanguageService } from '../state/person-language.service';
import { AuthFrame } from './auth-frame';
import {
  businessErrors,
  businessInput,
  emptyBusinessDraft,
  type BusinessDraft,
} from './business-draft';
import { BusinessStep } from './business-step';
import { DemoEmail } from './demo-email';
import { PriceBox } from './price-box';
import { TermsCheck } from './terms-check';
import { TwoStepSetup } from './two-step-setup';

type Screen = 'account' | 'checkEmail' | 'business' | 'finish';

/** Which of the three steps each screen belongs to: confirming the email is still the first. */
const STEP_OF: Record<Screen, number> = { account: 1, checkEmail: 1, business: 2, finish: 3 };
const STEPS = [1, 2, 3];

/** Where the cursor goes when a screen opens: the heading of a screen that starts with words, else the first field. */
const FOCUS_ON: Record<Screen, string> = {
  account: '[data-testid="email"]',
  checkEmail: '[data-autofocus]',
  business: '[data-testid="first-name"]',
  finish: '[data-autofocus]',
};

/** What is wrong with the email and password; `taken` is an email that already has an account (it comes with a link, so it has no key). */
interface AccountErrors {
  email?: string;
  taken?: boolean;
  password?: string;
}

/** What is missing of the person's name (a translation key each). */
interface NameErrors {
  firstName?: string;
  lastName?: string;
}

/**
 * Sign-up (`/sign-up`), outside the app shell, in three short steps with a progress line: the account (email and
 * password), the person's name and a business, then the terms and the second step of signing in. After the first step the
 * demo shows the confirmation email instead of sending it, and Confirm my email goes on. Nothing is stored but the
 * answers: the password is only measured, and any 6 digits work.
 *
 * Finish makes the person (in the language the page is in), their business as its owner, signs them in and opens the
 * homepage. The business is made before the person is signed in, because a signed-in person with no business has none
 * open. Signing in then keeps the page's language as the person's own.
 */
@Component({
  selector: 'app-sign-up-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthFrame,
    BusinessStep,
    DemoEmail,
    FieldError,
    HlmButton,
    PriceBox,
    RouterLink,
    TermsCheck,
    TranslocoPipe,
    TwoStepSetup,
  ],
  template: `
    <app-auth-frame>
      <div class="flex flex-col gap-2" data-testid="progress">
        <p class="text-muted-foreground text-xs font-medium" data-testid="step-label">
          {{ 'auth.signUp.step.' + screen() | transloco }}
        </p>
        <div class="flex gap-1" aria-hidden="true">
          @for (n of steps; track n) {
            <span
              class="h-1 flex-1 rounded-full"
              [class]="n <= stepNumber() ? 'bg-primary' : 'bg-muted'"
            ></span>
          }
        </div>
      </div>

      @switch (screen()) {
        @case ('account') {
          <form
            class="flex flex-col gap-4"
            novalidate
            data-testid="sign-up-form"
            (submit)="createAccount($event)"
          >
            <h1 class="text-2xl font-semibold" data-testid="sign-up-title">
              {{ 'auth.signUp.title' | transloco }}
            </h1>

            <app-price-box />

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
                  [attr.aria-invalid]="
                    accountErrors().email || accountErrors().taken ? 'true' : null
                  "
                  [attr.aria-describedby]="
                    accountErrors().email || accountErrors().taken ? 'error-email' : null
                  "
                  (input)="setEmail($event)"
                />
              </label>
              @if (accountErrors().email; as key) {
                <p [appFieldError]="key" id="error-email" data-testid="error-email"></p>
              }
              @if (accountErrors().taken) {
                <p
                  class="text-negative text-sm"
                  role="alert"
                  id="error-email"
                  data-testid="error-email"
                >
                  {{ 'auth.signUp.error.emailTaken' | transloco }}
                  <a
                    class="text-primary font-medium underline-offset-4 hover:underline"
                    routerLink="/sign-in"
                    data-testid="taken-sign-in"
                  >
                    {{ 'auth.signUp.signIn' | transloco }}
                  </a>
                </p>
              }
            </div>

            <div class="flex flex-col gap-1">
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-muted-foreground">{{ 'auth.field.password' | transloco }}</span>
                <input
                  type="password"
                  dir="ltr"
                  autocomplete="new-password"
                  data-testid="password"
                  [class]="inputClass"
                  [value]="password()"
                  [attr.aria-invalid]="accountErrors().password ? 'true' : null"
                  [attr.aria-describedby]="
                    accountErrors().password ? 'error-password password-hint' : 'password-hint'
                  "
                  (input)="setPassword($event)"
                />
              </label>
              <p class="text-muted-foreground text-xs" id="password-hint">
                {{ 'auth.signUp.passwordHint' | transloco }}
              </p>
              @if (accountErrors().password; as key) {
                <p [appFieldError]="key" id="error-password" data-testid="error-password"></p>
              }
            </div>

            <button hlmBtn size="lg" type="submit" class="w-full" data-testid="sign-up-submit">
              {{ 'auth.signUp.submit' | transloco }}
            </button>

            <p class="text-muted-foreground text-center text-sm">
              {{ 'auth.signUp.haveAccount' | transloco }}
              <a
                class="text-primary font-medium underline-offset-4 hover:underline"
                routerLink="/sign-in"
                data-testid="sign-in-link"
              >
                {{ 'auth.signUp.signIn' | transloco }}
              </a>
            </p>
          </form>
        }
        @case ('checkEmail') {
          <div class="flex flex-col gap-4">
            <h1
              class="text-2xl font-semibold outline-none"
              tabindex="-1"
              data-autofocus
              data-testid="check-email-title"
            >
              {{ 'auth.signUp.checkEmail.title' | transloco }}
            </h1>
            <p class="text-sm" data-testid="check-email-body">
              {{ 'auth.signUp.checkEmail.before' | transloco }}<bdi dir="ltr">{{ sentTo() }}</bdi
              >{{ 'auth.signUp.checkEmail.after' | transloco }}
            </p>

            <div class="flex flex-col gap-2">
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="self-start"
                data-testid="resend"
                (click)="resent.set(true)"
              >
                {{ 'auth.signUp.checkEmail.again' | transloco }}
              </button>
              <div role="status">
                @if (resent()) {
                  <p class="text-muted-foreground text-sm" data-testid="resent">
                    {{ 'auth.signUp.checkEmail.sentAgain' | transloco }}
                  </p>
                }
              </div>
            </div>

            <app-demo-email
              [to]="sentTo()"
              [subject]="'auth.signUp.mail.subject' | transloco"
              [body]="'auth.signUp.mail.body' | transloco"
              [action]="'auth.signUp.mail.action' | transloco"
              (act)="go('business')"
            />

            <p class="text-muted-foreground text-sm">
              {{ 'auth.signUp.checkEmail.wrong' | transloco }}
              <button
                type="button"
                class="text-primary font-medium underline-offset-4 hover:underline"
                data-testid="change-email"
                (click)="changeEmail()"
              >
                {{ 'auth.signUp.checkEmail.change' | transloco }}
              </button>
            </p>
          </div>
        }
        @case ('business') {
          <form
            class="flex flex-col gap-4"
            novalidate
            data-testid="business-form"
            (submit)="continueToFinish($event)"
          >
            <h1 class="text-2xl font-semibold">{{ 'auth.signUp.business.title' | transloco }}</h1>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{
                    'auth.signUp.business.firstName' | transloco
                  }}</span>
                  <input
                    type="text"
                    dir="auto"
                    autocomplete="given-name"
                    data-testid="first-name"
                    [class]="inputClass"
                    [value]="firstName()"
                    [attr.aria-invalid]="shownNames().firstName ? 'true' : null"
                    [attr.aria-describedby]="shownNames().firstName ? 'error-first-name' : null"
                    (input)="setFirstName($event)"
                  />
                </label>
                @if (shownNames().firstName; as key) {
                  <p [appFieldError]="key" id="error-first-name" data-testid="error-first-name"></p>
                }
              </div>
              <div class="flex flex-col gap-1">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{
                    'auth.signUp.business.lastName' | transloco
                  }}</span>
                  <input
                    type="text"
                    dir="auto"
                    autocomplete="family-name"
                    data-testid="last-name"
                    [class]="inputClass"
                    [value]="lastName()"
                    [attr.aria-invalid]="shownNames().lastName ? 'true' : null"
                    [attr.aria-describedby]="shownNames().lastName ? 'error-last-name' : null"
                    (input)="setLastName($event)"
                  />
                </label>
                @if (shownNames().lastName; as key) {
                  <p [appFieldError]="key" id="error-last-name" data-testid="error-last-name"></p>
                }
              </div>
            </div>

            <app-business-step [(draft)]="draft" [errors]="shownDraft()" />

            <button hlmBtn size="lg" type="submit" class="w-full" data-testid="business-continue">
              {{ 'auth.signUp.business.continue' | transloco }}
            </button>
          </form>
        }
        @case ('finish') {
          <form
            class="flex flex-col gap-4"
            novalidate
            data-testid="finish-form"
            (submit)="finish($event)"
          >
            <h1
              class="text-2xl font-semibold outline-none"
              tabindex="-1"
              data-autofocus
              data-testid="finish-title"
            >
              {{ 'auth.signUp.finish.title' | transloco }}
            </h1>

            <app-terms-check [(accepted)]="accepted" [error]="termsError()" />

            <section class="flex flex-col gap-3" aria-labelledby="protect-title">
              <h2 class="text-lg font-semibold" id="protect-title">
                {{ 'auth.signUp.finish.protect' | transloco }}
              </h2>
              <app-two-step-setup
                [codes]="backupCodes"
                [confirmable]="false"
                [(code)]="code"
                [error]="codeError()"
              />
            </section>

            <button hlmBtn size="lg" type="submit" class="w-full" data-testid="finish-submit">
              {{ 'auth.signUp.finish.submit' | transloco }}
            </button>
          </form>
        }
      }
    </app-auth-frame>
  `,
})
export class SignUpPage {
  private readonly accounts = inject(AccountService);
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly personLanguage = inject(PersonLanguageService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly inputClass = INPUT_CLASS;
  protected readonly steps = STEPS;
  /** The first set of backup codes, shown at sign-up. */
  protected readonly backupCodes = demoBackupCodes(0);

  protected readonly screen = signal<Screen>('account');
  protected readonly stepNumber = computed(() => STEP_OF[this.screen()]);

  // The account.
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly accountErrors = signal<AccountErrors>({});
  /** The email the link was "sent" to, as typed (without the spaces around it). */
  protected readonly sentTo = signal('');
  protected readonly resent = signal(false);

  // You and your business.
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly draft = signal<BusinessDraft>(emptyBusinessDraft());
  /** Whether Continue was pressed: the messages show from then on, and go as each answer is given. */
  private readonly triedBusiness = signal(false);
  private readonly nameProblems = computed<NameErrors>(() => ({
    ...(this.firstName().trim() ? {} : { firstName: 'auth.signUp.error.firstName' }),
    ...(this.lastName().trim() ? {} : { lastName: 'auth.signUp.error.lastName' }),
  }));
  private readonly draftProblems = computed(() => businessErrors(this.draft()));
  protected readonly shownNames = computed<NameErrors>(() =>
    this.triedBusiness() ? this.nameProblems() : {},
  );
  protected readonly shownDraft = computed(() =>
    this.triedBusiness() ? this.draftProblems() : {},
  );

  // The terms and a safe login.
  protected readonly accepted = signal(false);
  /** The 6 digits typed for the authenticator app (the page checks them when Finish is pressed). */
  protected readonly code = signal('');
  private readonly triedFinish = signal(false);
  protected readonly termsError = computed(() =>
    this.triedFinish() && !this.accepted() ? 'auth.terms.error' : null,
  );
  protected readonly codeError = computed(() =>
    this.triedFinish() && !isAppCode(this.code()) ? 'auth.twoStep.error.digits' : null,
  );
  /** Set when Finish starts, so a second tap before the page has gone makes no second account. */
  private finishing = false;

  protected setEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    clearErrors(this.accountErrors, 'email', 'taken');
  }

  protected setPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    clearErrors(this.accountErrors, 'password');
  }

  protected setFirstName(event: Event): void {
    this.firstName.set((event.target as HTMLInputElement).value);
  }

  protected setLastName(event: Event): void {
    this.lastName.set((event.target as HTMLInputElement).value);
  }

  /** Step 1: checks the email and the password, and goes on to "Check your email". */
  protected createAccount(event: Event): void {
    event.preventDefault();
    const email = this.email().trim();
    const errors: AccountErrors = {};
    if (!email) errors.email = 'auth.error.emailMissing';
    else if (!isEmail(email)) errors.email = 'auth.signUp.error.emailInvalid';
    else if (this.accounts.emailTaken(email)) errors.taken = true;
    if (!isNewPassword(this.password())) errors.password = 'auth.signUp.error.passwordShort';
    if (Object.keys(errors).length > 0) {
      this.accountErrors.set(errors);
      this.focus('[aria-invalid="true"]');
      return;
    }
    this.accountErrors.set({});
    this.sentTo.set(email);
    this.resent.set(false);
    this.go('checkEmail');
  }

  /** Back to the first step, which keeps what was typed. */
  protected changeEmail(): void {
    this.resent.set(false);
    this.go('account');
  }

  /** Step 2: the names and the business must be answered, then the terms and the login. */
  protected continueToFinish(event: Event): void {
    event.preventDefault();
    this.triedBusiness.set(true);
    if (Object.keys(this.nameProblems()).length + Object.keys(this.draftProblems()).length > 0) {
      // The first field with a message: a text field, or the first answer of a group of cards.
      this.focus('input[aria-invalid="true"], [aria-invalid="true"] input');
      return;
    }
    this.go('finish');
  }

  /**
   * Step 3: needs the terms ticked and 6 digits for the authenticator app, then makes the person and their business,
   * signs them in and opens the homepage. A missing tick or code is named under its field and the cursor goes there.
   */
  protected finish(event: Event): void {
    event.preventDefault();
    if (this.finishing) return;
    this.triedFinish.set(true);
    if (!this.accepted()) {
      this.focus('[data-testid="terms-accept"] input');
      return;
    }
    if (!isAppCode(this.code())) {
      this.focus('[data-testid="two-step-code"]');
      return;
    }
    const input = businessInput(this.draft());
    if (input === null) return;
    this.finishing = true;
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    const email = this.sentTo();
    // The business comes before the sign-in: a signed-in person with no business has none open.
    const id = this.accounts.createPerson({
      firstName,
      lastName,
      email,
      lang: this.language.lang(),
    });
    this.demo.createBusiness(
      { personId: id, name: `${firstName} ${lastName}`, email: normalEmail(email) },
      input,
    );
    this.accounts.signIn(id, false);
    // The language the page is in was the person's choice here, so it is theirs from now on.
    this.personLanguage.applyOnSignIn(id, true);
    void this.router.navigateByUrl('/');
  }

  protected go(screen: Screen): void {
    this.screen.set(screen);
    this.focus(FOCUS_ON[screen]);
  }

  private focus(selector: string): void {
    focusAfterRender(this.injector, this.host, selector);
  }
}
