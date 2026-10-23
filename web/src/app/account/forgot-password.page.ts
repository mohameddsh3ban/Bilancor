import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { focusAfterRender } from '../settings/form-helpers';
import { FieldError, INPUT_CLASS } from '../settings/form-parts';
import { AccountService } from '../state/account.service';
import { AuthFrame } from './auth-frame';
import { DemoEmail } from './demo-email';

/** A new password needs at least this many characters (sign-up, a new password and a changed one). */
const MIN_PASSWORD = 10;

type Step = 'email' | 'sent' | 'choose' | 'done';

/**
 * A forgotten password (`/forgot-password`), outside the app shell, in four steps: the email, "Check your email", a new
 * password, "Password changed". The page says a link was sent for any email, so it does not tell an account from a
 * stranger; only an email that has a login gets the demo box with the email (the link, as the demo shows it). The new
 * password signs the person out on the other devices; it does not sign anybody in, and the code is still asked then.
 */
@Component({
  selector: 'app-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthFrame, DemoEmail, FieldError, HlmButton, RouterLink, TranslocoPipe],
  template: `
    <app-auth-frame>
      @switch (step()) {
        @case ('email') {
          <form
            class="flex flex-col gap-4"
            novalidate
            data-testid="forgot-form"
            (submit)="send($event)"
          >
            <div class="flex flex-col gap-1">
              <h1 class="text-2xl font-semibold" data-testid="forgot-title">
                {{ 'auth.forgot.title' | transloco }}
              </h1>
              <p class="text-sm" data-testid="forgot-intro">
                {{ 'auth.forgot.intro' | transloco }}
              </p>
              <p class="text-muted-foreground text-sm">{{ 'auth.forgot.note' | transloco }}</p>
            </div>

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
                  [attr.aria-invalid]="emailMissing() ? 'true' : null"
                  [attr.aria-describedby]="emailMissing() ? 'error-email' : null"
                  (input)="setEmail($event)"
                />
              </label>
              @if (emailMissing()) {
                <p
                  appFieldError="auth.error.emailMissing"
                  id="error-email"
                  data-testid="error-email"
                ></p>
              }
            </div>

            <button hlmBtn size="lg" type="submit" class="w-full" data-testid="forgot-submit">
              {{ 'auth.forgot.submit' | transloco }}
            </button>

            <a
              class="text-primary text-center text-sm font-medium underline-offset-4 hover:underline"
              routerLink="/sign-in"
              data-testid="back-to-sign-in"
            >
              {{ 'auth.forgot.back' | transloco }}
            </a>
          </form>
        }
        @case ('sent') {
          <div class="flex flex-col gap-4">
            <h1 class="text-2xl font-semibold" data-testid="sent-title">
              {{ 'auth.forgot.sent.title' | transloco }}
            </h1>
            <p class="text-sm" data-testid="sent-body">
              {{ 'auth.forgot.sent.before' | transloco }}<bdi dir="ltr">{{ sentTo() }}</bdi
              >{{ 'auth.forgot.sent.after' | transloco }}
            </p>

            @if (known()) {
              <app-demo-email
                [to]="sentTo()"
                [subject]="'auth.forgot.mail.subject' | transloco"
                [body]="'auth.forgot.mail.body' | transloco"
                [action]="'auth.forgot.mail.action' | transloco"
                (act)="step.set('choose')"
              />
            }

            <p class="text-muted-foreground text-sm">
              {{ 'auth.forgot.sent.wrong' | transloco }}
              <button
                type="button"
                class="text-primary font-medium underline-offset-4 hover:underline"
                data-testid="sent-back"
                (click)="changeEmail()"
              >
                {{ 'auth.forgot.sent.change' | transloco }}
              </button>
            </p>

            <a
              class="text-primary text-sm font-medium underline-offset-4 hover:underline"
              routerLink="/sign-in"
              data-testid="back-to-sign-in"
            >
              {{ 'auth.forgot.back' | transloco }}
            </a>
          </div>
        }
        @case ('choose') {
          <form
            class="flex flex-col gap-4"
            novalidate
            data-testid="new-password-form"
            (submit)="save($event)"
          >
            <h1 class="text-2xl font-semibold" data-testid="new-title">
              {{ 'auth.forgot.new.title' | transloco }}
            </h1>

            <div class="flex flex-col gap-1">
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-muted-foreground">{{ 'auth.forgot.new.label' | transloco }}</span>
                <input
                  type="password"
                  dir="ltr"
                  autocomplete="new-password"
                  data-testid="new-password"
                  [class]="inputClass"
                  [value]="newPassword()"
                  [attr.aria-invalid]="tooShort() ? 'true' : null"
                  [attr.aria-describedby]="
                    tooShort() ? 'error-new-password new-password-hint' : 'new-password-hint'
                  "
                  (input)="setNewPassword($event)"
                />
              </label>
              <p class="text-muted-foreground text-xs" id="new-password-hint">
                {{ 'auth.forgot.new.hint' | transloco }}
              </p>
              @if (tooShort()) {
                <p
                  appFieldError="auth.forgot.new.error"
                  id="error-new-password"
                  data-testid="error-new-password"
                ></p>
              }
            </div>

            <button hlmBtn size="lg" type="submit" class="w-full" data-testid="new-password-submit">
              {{ 'auth.forgot.new.submit' | transloco }}
            </button>
          </form>
        }
        @case ('done') {
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <h1 class="text-2xl font-semibold" data-testid="done-title">
                {{ 'auth.forgot.done.title' | transloco }}
              </h1>
              <p class="text-sm" data-testid="done-body">
                {{ 'auth.forgot.done.body' | transloco }}
              </p>
            </div>
            <a hlmBtn size="lg" class="w-full" routerLink="/sign-in" data-testid="done-sign-in">
              {{ 'auth.forgot.done.signIn' | transloco }}
            </a>
          </div>
        }
      }
    </app-auth-frame>
  `,
})
export class ForgotPasswordPage {
  private readonly accounts = inject(AccountService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly inputClass = INPUT_CLASS;

  protected readonly step = signal<Step>('email');
  protected readonly email = signal(this.accounts.samplePerson.email);
  protected readonly emailMissing = signal(false);
  /** The email the link was "sent" to, as typed (without the spaces around it). */
  protected readonly sentTo = signal('');
  /** Who has the email, when somebody does: only then is there a link to show. */
  private readonly personId = signal<string | null>(null);
  protected readonly newPassword = signal('');
  protected readonly tooShort = signal(false);

  protected readonly known = computed(() => this.personId() !== null);

  protected setEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.emailMissing.set(false);
  }

  protected setNewPassword(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
    this.tooShort.set(false);
  }

  protected send(event: Event): void {
    event.preventDefault();
    const email = this.email().trim();
    if (!email) {
      this.emailMissing.set(true);
      focusAfterRender(this.injector, this.host, '[aria-invalid="true"]');
      return;
    }
    this.sentTo.set(email);
    this.personId.set(this.accounts.findByEmail(email)?.id ?? null);
    this.step.set('sent');
  }

  /** Back to the email, which keeps what was typed. */
  protected changeEmail(): void {
    this.personId.set(null);
    this.step.set('email');
    focusAfterRender(this.injector, this.host, '[data-testid="email"]');
  }

  protected save(event: Event): void {
    event.preventDefault();
    const id = this.personId();
    if (id === null) return;
    // The password is not stored (nothing here is a real account), so only its length is checked.
    if (Array.from(this.newPassword()).length < MIN_PASSWORD) {
      this.tooShort.set(true);
      focusAfterRender(this.injector, this.host, '[aria-invalid="true"]');
      return;
    }
    this.accounts.signOutOtherDevices(id);
    this.step.set('done');
  }
}
