import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  inject,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { DialogCard } from '../core/layout/dialog-card';
import { INVITE_DAYS, inviteError, normalEmail, type GrantedRole } from '../domain/people';
import { isolateText } from '../payments/payment-history';
import { DemoStateService } from '../state/demo-state.service';
import { focusAfterRender } from './form-helpers';
import { FieldError, INPUT_CLASS } from './form-parts';
import { RoleCards } from './role-cards';

/**
 * The pop-up that invites someone to the open business: their email and one of the three roles, then **Send
 * invitation**. An email that isn't one, one that already has access and one that is already invited (whatever its case
 * or the spaces around it) are named under the field, and a missing role under the cards. When the invitation is made
 * the pop-up closes and tells the page which row it made (`invited`), which shows the email the demo can't send.
 *
 * It opens empty each time. Only the owner invites: the page offers the button to nobody else, and the state ignores
 * anyone else.
 */
@Component({
  selector: 'app-invite-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogCard, FieldError, HlmButton, HlmDialogImports, RoleCards, TranslocoPipe],
  // Not displayed: the dialog shows through the overlay, so nothing of this element belongs in the card column.
  host: { hidden: '' },
  template: `
    <hlm-dialog
      [state]="open() ? 'open' : 'closed'"
      autoFocus="dialog"
      (stateChanged)="onStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        appDialogCard
        data-testid="invite-dialog"
        [closeLabel]="'people.dialog.close' | transloco"
      >
        <form class="grid gap-6" novalidate (submit)="send($event)">
          <hlm-dialog-header class="pe-8">
            <h2
              hlmDialogTitle
              class="text-lg leading-snug font-semibold"
              data-testid="invite-title"
            >
              {{ 'people.invite.title' | transloco: { business: isolate(demo.business().name) } }}
            </h2>
          </hlm-dialog-header>

          <div class="flex flex-col gap-1">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{ 'people.invite.email' | transloco }}</span>
              <input
                type="email"
                dir="ltr"
                autocomplete="off"
                spellcheck="false"
                data-testid="invite-email"
                [class]="inputClass"
                [value]="email()"
                [attr.aria-invalid]="emailError() ? 'true' : null"
                [attr.aria-describedby]="emailError() ? 'invite-error-email' : null"
                (input)="setEmail($event)"
              />
            </label>
            @if (emailError(); as key) {
              <p [appFieldError]="key" id="invite-error-email" data-testid="invite-error-email"></p>
            }
          </div>

          <div class="flex flex-col gap-1">
            <app-role-cards [role]="role()" (roleChange)="pickRole($event)" />
            @if (roleMissing()) {
              <p
                appFieldError="people.invite.error.role"
                id="invite-error-role"
                data-testid="invite-error-role"
              ></p>
            }
          </div>

          <p class="text-muted-foreground text-sm" data-testid="invite-hint">
            {{ 'people.invite.hint' | transloco: { days: days } }}
          </p>

          <hlm-dialog-footer>
            <button
              hlmBtn
              type="button"
              variant="outline"
              class="min-h-10"
              data-testid="invite-cancel"
              (click)="open.set(false)"
            >
              {{ 'people.invite.cancel' | transloco }}
            </button>
            <button hlmBtn type="submit" class="min-h-10" data-testid="invite-submit">
              {{ 'people.invite.send' | transloco }}
            </button>
          </hlm-dialog-footer>
        </form>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class InviteDialog {
  protected readonly demo = inject(DemoStateService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Whether the pop-up is open. */
  readonly open = model.required<boolean>();
  /** An invitation was made: the id of its row in the business's people. */
  readonly invited = output<string>();

  protected readonly inputClass = INPUT_CLASS;
  protected readonly days = INVITE_DAYS;
  protected readonly isolate = isolateText;

  /** What is typed and chosen: empty each time the pop-up opens (and when it closes). */
  protected readonly email = linkedSignal<boolean, string>({
    source: this.open,
    computation: () => '',
  });
  protected readonly role = linkedSignal<boolean, GrantedRole | null>({
    source: this.open,
    computation: () => null,
  });
  /** The message under the email (a translation key), or null. */
  protected readonly emailError = signal<string | null>(null);
  protected readonly roleMissing = signal(false);

  protected setEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.emailError.set(null);
  }

  protected pickRole(role: GrantedRole | null): void {
    this.role.set(role);
    this.roleMissing.set(false);
  }

  /** The cross, Escape and a tap outside close the pop-up by themselves; it follows, and what was asked of it is forgotten. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state !== 'closed') return;
    this.open.set(false);
    this.emailError.set(null);
    this.roleMissing.set(false);
  }

  /** Checks the email and the role, then invites; a refusal is named under its field and the cursor goes there. */
  protected send(event: Event): void {
    event.preventDefault();
    const email = this.email().trim();
    const role = this.role();
    const problem = email === '' ? 'missing' : inviteError(this.demo.business(), email);
    this.emailError.set(problem === null ? null : `people.invite.error.${problem}`);
    this.roleMissing.set(role === null);
    if (problem !== null || role === null) {
      // The pop-up is drawn in the overlay, outside this element: the cursor is looked for in the whole page.
      focusAfterRender(
        this.injector,
        this.document.body,
        problem !== null
          ? '[data-testid="invite-dialog"] [data-testid="invite-email"]'
          : '[data-testid="invite-dialog"] [role="radiogroup"] input',
      );
      return;
    }
    // The state is the one that knows who may invite: it does nothing for anyone but the owner, and then no row comes of it.
    this.demo.invite(email, role);
    const row = this.demo
      .business()
      .people.find((m) => m.status === 'invited' && normalEmail(m.email) === normalEmail(email));
    this.open.set(false);
    if (row) this.invited.emit(row.id);
  }
}
