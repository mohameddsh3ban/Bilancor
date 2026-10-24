import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { LanguageService } from '../core/i18n/language.service';
import { DEMO_TODAY } from '../data/demo-date';
import type { Lang, Member } from '../data/models';
import {
  MIN_PASSWORD,
  isAppCode,
  isExpired,
  isNewPassword,
  nameFromEmail,
  type GrantedRole,
} from '../domain/people';
import { isolateText } from '../payments/payment-history';
import { clearErrors, focusAfterRender } from '../settings/form-helpers';
import { ChoiceCard, FieldError, INPUT_CLASS } from '../settings/form-parts';
import { RoleCards } from '../settings/role-cards';
import { demoBackupCodes } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { AuthFrame } from './auth-frame';
import { DEMO_BOX } from './demo-email';
import { TwoStepSetup } from './two-step-setup';

type Mode = 'join' | 'signIn';
type View = Mode | 'done' | 'gone';

/** The languages to choose from, each in its own words. */
const LANGUAGES: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'de', label: 'Deutsch' },
  { lang: 'ar', label: 'عربي' },
];

/** An invitation that can still be accepted: its business and its row. */
interface Invitation {
  businessId: string;
  business: string;
  member: Member;
  role: GrantedRole;
}

/** Who has joined what, for the message at the end. */
interface Joined {
  name: string;
  business: string;
  role: GrantedRole;
}

/** What is wrong with the join form (a translation key each). */
interface JoinErrors {
  name?: string;
  password?: string;
}

/** What is missing from the sign-in form (a translation key each). */
interface SignInErrors {
  email?: string;
  password?: string;
}

/**
 * The invited person's side (`/join/:businessId/:memberId`), outside the app shell: "Join <business>", the role and what
 * it can and can't do, then a name, a language, a password and the same authenticator step as sign-up, and one **Join**
 * button. "Already have a login? Sign in" is the same preview with an email and a password that accept anything.
 *
 * Views per role are not built, so **joining is a preview**: nobody is signed in as the new person. Joining makes the
 * invitation's row a joined one (named by what was typed, and for the sign-in way by the invited email) in the business
 * of whoever is signed in (the owner who sent it), and says so; Back to Settings shows the list with the new person. The
 * language choice belongs to the preview too: nothing keeps it. An invitation that was cancelled or accepted, whose link
 * has run out, or that was never made (a made-up or old link, such as one from before Reset demo) says it no longer
 * works.
 */
@Component({
  selector: 'app-join-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthFrame,
    ChoiceCard,
    FieldError,
    HlmButton,
    RoleCards,
    RouterLink,
    TranslocoPipe,
    TwoStepSetup,
  ],
  template: `
    <app-auth-frame (langPicked)="joinLang.set($event)">
      @switch (view()) {
        @case ('gone') {
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <h1
                class="text-2xl font-semibold outline-none"
                tabindex="-1"
                data-autofocus
                data-testid="gone-title"
              >
                {{ 'people.join.gone.title' | transloco }}
              </h1>
              <p class="text-sm" data-testid="gone-body">
                {{ 'people.join.gone.body' | transloco }}
              </p>
            </div>
            <a
              hlmBtn
              size="lg"
              class="w-full"
              routerLink="/settings"
              fragment="people"
              data-testid="gone-back"
            >
              {{ 'people.join.gone.back' | transloco }}
            </a>
          </div>
        }
        @case ('done') {
          @if (joined(); as done) {
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <h1
                  class="text-2xl font-semibold outline-none"
                  tabindex="-1"
                  data-autofocus
                  data-testid="done-title"
                >
                  {{
                    'people.join.done.title'
                      | transloco
                        : {
                            name: isolate(done.name),
                            business: isolate(done.business),
                            role: ('roles.' + done.role + '.name' | transloco),
                          }
                  }}
                </h1>
                <p class="text-muted-foreground text-sm" data-testid="done-note">
                  {{ 'people.join.done.note' | transloco }}
                </p>
              </div>
              <a
                hlmBtn
                size="lg"
                class="w-full"
                routerLink="/settings"
                fragment="people"
                data-testid="done-back"
              >
                {{ 'people.join.done.back' | transloco }}
              </a>
            </div>
          }
        }
        @case ('signIn') {
          @if (invitation(); as invite) {
            <form
              class="flex flex-col gap-4"
              novalidate
              data-testid="join-signin-form"
              (submit)="signInToJoin($event)"
            >
              <h1
                class="text-2xl font-semibold outline-none"
                tabindex="-1"
                data-autofocus
                data-testid="join-title"
              >
                {{ 'people.join.signInTitle' | transloco: { business: isolate(invite.business) } }}
              </h1>

              <p [class]="demoBox" data-testid="join-demo">
                {{ 'people.join.signInDemo' | transloco }}
              </p>

              <div class="flex flex-col gap-1">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{ 'auth.field.email' | transloco }}</span>
                  <input
                    type="email"
                    dir="ltr"
                    autocomplete="username"
                    spellcheck="false"
                    data-testid="join-signin-email"
                    [class]="inputClass"
                    [value]="signInEmail()"
                    [attr.aria-invalid]="signInErrors().email ? 'true' : null"
                    [attr.aria-describedby]="signInErrors().email ? 'error-signin-email' : null"
                    (input)="setSignInEmail($event)"
                  />
                </label>
                @if (signInErrors().email; as key) {
                  <p
                    [appFieldError]="key"
                    id="error-signin-email"
                    data-testid="error-signin-email"
                  ></p>
                }
              </div>

              <div class="flex flex-col gap-1">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{ 'auth.field.password' | transloco }}</span>
                  <input
                    type="password"
                    dir="ltr"
                    autocomplete="current-password"
                    data-testid="join-signin-password"
                    [class]="inputClass"
                    [value]="signInPassword()"
                    [attr.aria-invalid]="signInErrors().password ? 'true' : null"
                    [attr.aria-describedby]="
                      signInErrors().password ? 'error-signin-password' : null
                    "
                    (input)="setSignInPassword($event)"
                  />
                </label>
                @if (signInErrors().password; as key) {
                  <p
                    [appFieldError]="key"
                    id="error-signin-password"
                    data-testid="error-signin-password"
                  ></p>
                }
              </div>

              <button
                hlmBtn
                size="lg"
                type="submit"
                class="w-full"
                data-testid="join-signin-submit"
              >
                {{ 'people.join.signInSubmit' | transloco }}
              </button>

              <p class="text-center text-sm">
                <button
                  type="button"
                  class="text-primary font-medium underline-offset-4 hover:underline"
                  data-testid="join-new-login"
                  (click)="show('join')"
                >
                  {{ 'people.join.newLogin' | transloco }}
                </button>
              </p>
            </form>
          }
        }
        @default {
          @if (invitation(); as invite) {
            <form
              class="flex flex-col gap-4"
              novalidate
              data-testid="join-form"
              (submit)="join($event)"
            >
              <h1
                class="text-2xl font-semibold outline-none"
                tabindex="-1"
                data-autofocus
                data-testid="join-title"
              >
                {{ 'people.join.title' | transloco: { business: isolate(invite.business) } }}
              </h1>

              <p [class]="demoBox" data-testid="join-demo">
                {{ 'people.join.demo' | transloco }}
              </p>

              <div class="flex flex-col gap-2">
                <p class="text-sm font-medium">{{ 'people.join.roleLabel' | transloco }}</p>
                <app-role-cards [role]="invite.role" [readonly]="true" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{ 'people.join.name' | transloco }}</span>
                  <input
                    type="text"
                    dir="auto"
                    autocomplete="name"
                    data-testid="join-name"
                    [class]="inputClass"
                    [value]="name()"
                    [attr.aria-invalid]="shown().name ? 'true' : null"
                    [attr.aria-describedby]="shown().name ? 'error-name' : null"
                    (input)="setName($event)"
                  />
                </label>
                @if (shown().name; as key) {
                  <p [appFieldError]="key" id="error-name" data-testid="error-name"></p>
                }
              </div>

              <div class="flex flex-col gap-2">
                <p class="text-sm font-medium" id="join-language">
                  {{ 'people.join.language' | transloco }}
                </p>
                <div
                  role="radiogroup"
                  class="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2"
                  aria-labelledby="join-language"
                >
                  @for (option of languages; track option.lang) {
                    <app-choice-card
                      name="join-language"
                      [attr.data-testid]="'join-lang-' + option.lang"
                      [checked]="joinLang() === option.lang"
                      (changed)="joinLang.set(option.lang)"
                    >
                      <span [lang]="option.lang">{{ option.label }}</span>
                    </app-choice-card>
                  }
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-muted-foreground">{{ 'auth.field.password' | transloco }}</span>
                  <input
                    type="password"
                    dir="ltr"
                    autocomplete="new-password"
                    data-testid="join-password"
                    [class]="inputClass"
                    [value]="password()"
                    [attr.aria-invalid]="shown().password ? 'true' : null"
                    [attr.aria-describedby]="
                      shown().password ? 'error-password join-password-hint' : 'join-password-hint'
                    "
                    (input)="setPassword($event)"
                  />
                </label>
                <p
                  class="text-muted-foreground text-xs"
                  id="join-password-hint"
                  data-testid="join-password-hint"
                >
                  {{ 'people.join.hint.password' | transloco: { min: minPassword } }}
                </p>
                @if (shown().password; as key) {
                  <p
                    [appFieldError]="key"
                    [appFieldErrorParams]="{ min: '' + minPassword }"
                    id="error-password"
                    data-testid="error-password"
                  ></p>
                }
              </div>

              <section class="flex flex-col gap-3" aria-labelledby="join-protect">
                <h2 class="text-lg font-semibold" id="join-protect">
                  {{ 'auth.signUp.finish.protect' | transloco }}
                </h2>
                <app-two-step-setup
                  [codes]="backupCodes"
                  [confirmable]="false"
                  [(code)]="code"
                  [error]="codeError()"
                />
              </section>

              <button hlmBtn size="lg" type="submit" class="w-full" data-testid="join-submit">
                {{ 'people.join.submit' | transloco }}
              </button>

              <p class="text-muted-foreground text-center text-sm">
                {{ 'people.join.haveLogin' | transloco }}
                <button
                  type="button"
                  class="text-primary font-medium underline-offset-4 hover:underline"
                  data-testid="join-have-login"
                  (click)="show('signIn')"
                >
                  {{ 'people.join.signIn' | transloco }}
                </button>
              </p>
            </form>
          }
        }
      }
    </app-auth-frame>
  `,
})
export class JoinPage {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly inputClass = INPUT_CLASS;
  protected readonly demoBox = DEMO_BOX;
  protected readonly minPassword = MIN_PASSWORD;
  protected readonly languages = LANGUAGES;
  protected readonly isolate = isolateText;
  /** The first set of backup codes, as at sign-up. */
  protected readonly backupCodes = demoBackupCodes(0);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  /**
   * The invitation this link is for, while it can be accepted: a waiting row of one of the signed-in person's businesses
   * whose link has not run out. Null for anything else: a made-up id, a business that isn't theirs, a cancelled or accepted
   * invitation, one from before Reset demo.
   */
  protected readonly invitation = computed<Invitation | null>(() => {
    const businessId = this.params().get('businessId');
    const memberId = this.params().get('memberId');
    const business = this.demo.businesses.find((b) => b.id === businessId);
    const member = business?.people.find((m) => m.id === memberId);
    if (!business || !member || member.status !== 'invited' || isExpired(member, DEMO_TODAY)) {
      return null;
    }
    return {
      businessId: business.id,
      business: business.name,
      member,
      role: member.role as GrantedRole,
    };
  });

  /** Who has joined, for the message once they have; forgotten when the link is another invitation's. */
  protected readonly joined = linkedSignal<unknown, Joined | null>({
    source: this.params,
    computation: () => null,
  });
  private readonly mode = linkedSignal<unknown, Mode>({
    source: this.params,
    computation: () => 'join',
  });
  protected readonly view = computed<View>(() =>
    this.joined() !== null ? 'done' : this.invitation() === null ? 'gone' : this.mode(),
  );

  // Joining as a new login.
  protected readonly name = signal('');
  protected readonly password = signal('');
  /** The 6 digits typed for the authenticator app (the page checks them when Join is pressed). */
  protected readonly code = signal('');
  /** The language chosen in the form: part of the preview, kept nowhere. It starts as the page's and follows its buttons. */
  protected readonly joinLang = signal<Lang>(this.language.lang());
  private readonly triedJoin = signal(false);
  private readonly problems = computed<JoinErrors>(() => ({
    ...(this.name().trim() ? {} : { name: 'people.join.error.name' }),
    ...(isNewPassword(this.password()) ? {} : { password: 'people.join.error.password' }),
  }));
  protected readonly shown = computed<JoinErrors>(() => (this.triedJoin() ? this.problems() : {}));
  protected readonly codeError = computed(() =>
    this.triedJoin() && !isAppCode(this.code()) ? 'auth.twoStep.error.digits' : null,
  );

  // Signing in to join.
  protected readonly signInEmail = linkedSignal(() => this.invitation()?.member.email ?? '');
  protected readonly signInPassword = signal('');
  protected readonly signInErrors = signal<SignInErrors>({});

  protected setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected setPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected setSignInEmail(event: Event): void {
    this.signInEmail.set((event.target as HTMLInputElement).value);
    clearErrors(this.signInErrors, 'email');
  }

  protected setSignInPassword(event: Event): void {
    this.signInPassword.set((event.target as HTMLInputElement).value);
    clearErrors(this.signInErrors, 'password');
  }

  /** Goes between joining as a new login and signing in to join; what was typed stays. */
  protected show(mode: Mode): void {
    this.mode.set(mode);
    this.focus('[data-autofocus]');
  }

  /** Needs a name, a password and 6 digits; each missing one is named under its field and the cursor goes to the first. */
  protected join(event: Event): void {
    event.preventDefault();
    const invite = this.invitation();
    if (invite === null) return;
    this.triedJoin.set(true);
    if (Object.keys(this.problems()).length > 0 || !isAppCode(this.code())) {
      this.focus('[aria-invalid="true"]');
      return;
    }
    this.accept(invite, this.name().trim());
  }

  /** Any email and password do, but they must be filled in; the person is named after the invited email. */
  protected signInToJoin(event: Event): void {
    event.preventDefault();
    const invite = this.invitation();
    if (invite === null) return;
    const errors: SignInErrors = {
      ...(this.signInEmail().trim() ? {} : { email: 'auth.error.emailMissing' }),
      ...(this.signInPassword() ? {} : { password: 'auth.error.passwordMissing' }),
    };
    this.signInErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.focus('[aria-invalid="true"]');
      return;
    }
    this.accept(invite, nameFromEmail(invite.member.email));
  }

  /** The invited person joins under the name, and the page says so. A second press finds no waiting invitation and does nothing. */
  private accept(invite: Invitation, name: string): void {
    if (!this.demo.acceptInvite(invite.businessId, invite.member.id, name)) return;
    this.joined.set({ name, business: invite.business, role: invite.role });
    this.focus('[data-autofocus]');
  }

  private focus(selector: string): void {
    focusAfterRender(this.injector, this.host, selector);
  }
}
