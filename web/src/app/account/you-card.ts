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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { isEmail, normalEmail } from '../domain/people';
import { clearErrors, focusAfterRender } from '../settings/form-helpers';
import { FieldError, INPUT_CLASS } from '../settings/form-parts';
import { AccountService } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { DemoEmail } from './demo-email';

/** Where the email change is: nothing started, the new address being typed, or its confirmation link waiting. */
type EmailStep = 'idle' | 'form' | 'sent';

/** The messages under the name fields (translation keys). */
interface NameErrors {
  first?: string;
  last?: string;
}

/**
 * My account › You: the first and last name (**Save**), and the email. A new email is not taken at once: Change asks for
 * the address, **Send the link** checks it (it must be an address, not the person's own, and not another account's) and
 * shows the email the demo can't send, and only its **Confirm my new email** button saves it. Then the card says the old
 * address is told. **Cancel** drops the change at either step.
 */
@Component({
  selector: 'app-you-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DemoEmail, FieldError, HlmButton, HlmCardImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="you-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle tabindex="-1" class="outline-none" data-testid="you-title">
          {{ 'account.you.title' | transloco }}
        </h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-4">
        <form
          class="flex flex-col gap-3"
          novalidate
          data-testid="you-name-form"
          (submit)="saveName($event)"
        >
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
                  data-testid="you-first-name"
                  [class]="inputClass"
                  [value]="firstName()"
                  [attr.aria-invalid]="nameErrors().first ? 'true' : null"
                  [attr.aria-describedby]="nameErrors().first ? 'you-error-first' : null"
                  (input)="setFirstName($event)"
                />
              </label>
              @if (nameErrors().first; as key) {
                <p
                  [appFieldError]="key"
                  id="you-error-first"
                  data-testid="you-error-first-name"
                ></p>
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
                  data-testid="you-last-name"
                  [class]="inputClass"
                  [value]="lastName()"
                  [attr.aria-invalid]="nameErrors().last ? 'true' : null"
                  [attr.aria-describedby]="nameErrors().last ? 'you-error-last' : null"
                  (input)="setLastName($event)"
                />
              </label>
              @if (nameErrors().last; as key) {
                <p [appFieldError]="key" id="you-error-last" data-testid="you-error-last-name"></p>
              }
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button hlmBtn type="submit" class="min-h-10" data-testid="you-save">
              {{ 'account.you.save' | transloco }}
            </button>
            <div role="status">
              @if (nameSaved()) {
                <p class="text-positive flex items-center gap-1 text-sm" data-testid="you-saved">
                  <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
                  {{ 'account.you.saved' | transloco }}
                </p>
              }
            </div>
          </div>
        </form>

        <div class="border-border flex flex-col gap-3 border-t pt-4" data-testid="you-email-row">
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div class="min-w-0 flex-1 basis-48">
              <p class="text-muted-foreground text-sm">{{ 'auth.field.email' | transloco }}</p>
              <p class="font-medium [overflow-wrap:anywhere]" data-testid="you-email">
                <bdi dir="ltr">{{ person().email }}</bdi>
              </p>
              <p class="text-muted-foreground text-xs" data-testid="you-email-hint">
                {{ 'account.you.email.hint' | transloco }}
              </p>
            </div>
            @if (emailStep() === 'idle') {
              <button
                hlmBtn
                type="button"
                variant="outline"
                size="sm"
                class="min-h-10 shrink-0"
                data-testid="you-email-change"
                [attr.aria-label]="'account.you.email.changeLabel' | transloco"
                (click)="startEmailChange()"
              >
                {{ 'account.change' | transloco }}
              </button>
            }
          </div>

          @switch (emailStep()) {
            @case ('form') {
              <form
                class="flex flex-col gap-3"
                novalidate
                data-testid="you-email-form"
                (submit)="sendLink($event)"
              >
                <div class="flex flex-col gap-1">
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="text-muted-foreground">{{
                      'account.you.email.new' | transloco
                    }}</span>
                    <input
                      type="email"
                      dir="ltr"
                      autocomplete="email"
                      spellcheck="false"
                      data-testid="you-email-input"
                      [class]="inputClass"
                      [value]="newEmail()"
                      [attr.aria-invalid]="emailError() ? 'true' : null"
                      [attr.aria-describedby]="emailError() ? 'you-error-email' : null"
                      (input)="setNewEmail($event)"
                    />
                  </label>
                  @if (emailError(); as key) {
                    <p [appFieldError]="key" id="you-error-email" data-testid="you-email-error"></p>
                  }
                </div>
                <div class="flex flex-wrap gap-2">
                  <button hlmBtn type="submit" class="min-h-10" data-testid="you-email-send">
                    {{ 'account.you.email.send' | transloco }}
                  </button>
                  <button
                    hlmBtn
                    type="button"
                    variant="outline"
                    class="min-h-10"
                    data-testid="you-email-cancel"
                    (click)="cancelEmailChange()"
                  >
                    {{ 'account.cancel' | transloco }}
                  </button>
                </div>
              </form>
            }
            @case ('sent') {
              <p class="text-sm outline-none" tabindex="-1" data-testid="you-email-sent">
                {{ 'account.you.email.sent.before' | transloco }}<bdi dir="ltr">{{ sentTo() }}</bdi
                >{{ 'account.you.email.sent.after' | transloco }}
              </p>
              <app-demo-email
                [to]="sentTo()"
                [subject]="'account.you.mail.subject' | transloco"
                [body]="'account.you.mail.body' | transloco"
                [action]="'account.you.mail.action' | transloco"
                (act)="confirmEmail()"
              />
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10 self-start"
                data-testid="you-email-cancel"
                (click)="cancelEmailChange()"
              >
                {{ 'account.cancel' | transloco }}
              </button>
            }
          }

          <div role="status">
            @if (emailChanged()) {
              <p
                class="text-positive flex items-center gap-1 text-sm outline-none"
                tabindex="-1"
                data-testid="you-email-changed"
              >
                <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
                {{ 'account.you.email.changed' | transloco }}
              </p>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class YouCard {
  private readonly accounts = inject(AccountService);
  private readonly demo = inject(DemoStateService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly inputClass = INPUT_CLASS;
  protected readonly person = this.accounts.person;

  // The name fields start as the person's name and follow it; what is typed stays until Save.
  // The saved names are their own computeds: a change to anything else of the person (language, devices, codes, email)
  // replaces the person but not these, so it can't take away what is typed and not yet saved.
  private readonly savedFirst = computed(() => this.person().firstName);
  private readonly savedLast = computed(() => this.person().lastName);
  protected readonly firstName = linkedSignal(() => this.savedFirst());
  protected readonly lastName = linkedSignal(() => this.savedLast());
  protected readonly nameErrors = signal<NameErrors>({});
  protected readonly nameSaved = signal(false);

  protected readonly emailStep = signal<EmailStep>('idle');
  protected readonly newEmail = signal('');
  /** The message under the new email (a translation key), or null. */
  protected readonly emailError = signal<string | null>(null);
  /** The address the link was "sent" to: written the way it will be kept. */
  protected readonly sentTo = signal('');
  protected readonly emailChanged = signal(false);

  protected setFirstName(event: Event): void {
    this.firstName.set((event.target as HTMLInputElement).value);
    clearErrors(this.nameErrors, 'first');
    this.nameSaved.set(false);
  }

  protected setLastName(event: Event): void {
    this.lastName.set((event.target as HTMLInputElement).value);
    clearErrors(this.nameErrors, 'last');
    this.nameSaved.set(false);
  }

  /** Saves the names without the spaces around them; a missing one is named under its field and nothing is saved. */
  protected saveName(event: Event): void {
    event.preventDefault();
    const first = this.firstName().trim();
    const last = this.lastName().trim();
    const errors: NameErrors = {};
    if (first === '') errors.first = 'auth.signUp.error.firstName';
    if (last === '') errors.last = 'auth.signUp.error.lastName';
    this.nameErrors.set(errors);
    this.nameSaved.set(false);
    if (errors.first || errors.last) {
      focusAfterRender(
        this.injector,
        this.host,
        '[data-testid="you-name-form"] [aria-invalid="true"]',
      );
      return;
    }
    this.accounts.updatePerson(this.person().id, (p) =>
      p.firstName === first && p.lastName === last ? p : { ...p, firstName: first, lastName: last },
    );
    this.keepRowsInStep(first, last, this.person().email);
    // The fields show what was kept (a name typed with spaces round it does not change the person, so nothing else would).
    this.firstName.set(first);
    this.lastName.set(last);
    this.nameSaved.set(true);
  }

  protected startEmailChange(): void {
    this.newEmail.set('');
    this.emailError.set(null);
    this.emailChanged.set(false);
    this.emailStep.set('form');
    this.focus('you-email-input');
  }

  protected setNewEmail(event: Event): void {
    this.newEmail.set((event.target as HTMLInputElement).value);
    this.emailError.set(null);
  }

  /** Checks the new address, then shows the email with its link: the person's email changes only when that is pressed. */
  protected sendLink(event: Event): void {
    event.preventDefault();
    const address = normalEmail(this.newEmail());
    const problem = this.emailProblem(address);
    this.emailError.set(problem);
    if (problem !== null) {
      this.focus('you-email-input');
      return;
    }
    this.sentTo.set(address);
    this.emailStep.set('sent');
    this.focus('you-email-sent');
  }

  protected cancelEmailChange(): void {
    this.emailStep.set('idle');
    this.emailError.set(null);
    this.focus('you-email-change');
  }

  /** The link in the email was followed: the new address is the person's. The old address gets a line saying so. */
  protected confirmEmail(): void {
    const address = this.sentTo();
    this.accounts.updatePerson(this.person().id, (p) =>
      p.email === address ? p : { ...p, email: address },
    );
    const { firstName, lastName } = this.person();
    this.keepRowsInStep(firstName, lastName, address);
    this.emailStep.set('idle');
    this.emailChanged.set(true);
    this.focus('you-email-changed');
  }

  /** The people lists of the person's businesses hold their name and email too: they follow the account. */
  private keepRowsInStep(first: string, last: string, email: string): void {
    this.demo.updateLoginRows(this.person().id, `${first} ${last}`, email);
  }

  /** Why this address (already written in its kept form) can't be the new email, as a translation key. */
  private emailProblem(address: string): string | null {
    if (address === '') return 'auth.error.emailMissing';
    if (!isEmail(address)) return 'auth.signUp.error.emailInvalid';
    if (address === normalEmail(this.person().email)) return 'account.you.error.same';
    if (this.accounts.emailTaken(address)) return 'auth.signUp.error.emailTaken';
    return null;
  }

  private focus(testId: string): void {
    focusAfterRender(this.injector, this.host, `[data-testid="${testId}"]`);
  }
}
