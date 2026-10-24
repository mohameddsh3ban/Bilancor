import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEllipsisVertical, lucideMail, lucidePlus } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { combineLatest, take, type Subscription } from 'rxjs';
import { DemoEmail } from '../account/demo-email';
import { AppDatePipe } from '../core/format/date.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { DialogCard } from '../core/layout/dialog-card';
import { DEMO_TODAY } from '../data/demo-date';
import type { Lang, Member } from '../data/models';
import {
  INVITE_DAYS,
  SUPPORT_DAYS,
  initialsOf,
  ownerOf,
  supportActive,
  type GrantedRole,
} from '../domain/people';
import { isolateText } from '../payments/payment-history';
import { AccountService } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { focusAfterRender } from './form-helpers';
import { InviteDialog } from './invite-dialog';
import { RoleCards } from './role-cards';

/** The languages an invitation email is written in, in the order of the app's language buttons. */
const LANGS: readonly Lang[] = ['en', 'de', 'ar'];

/** What a row of the list shows about one person or invitation. */
interface Row {
  member: Member;
  /** The name; the email of an invitation, which has no name yet. */
  label: string;
  /** The email: the login's own, as it is now, for a person with an account. */
  email: string;
  /** Empty for an invitation. */
  initials: string;
  you: boolean;
  waiting: boolean;
  /** The colours of the role word (or of Waiting). */
  tone: string;
}

/** The pop-ups the list opens, each about one person. */
interface DialogTarget {
  kind: 'role' | 'owner' | 'remove';
  id: string;
  name: string;
}

/** The email an invitation is shown as: in the inviter's language, with a line in each of the other two. */
interface InvitationMail {
  memberId: string;
  to: string;
  lang: Lang;
  subject: string;
  body: string;
  action: string;
  others: { lang: Lang; dir: 'ltr' | 'rtl'; text: string }[];
}

/**
 * Settings › People with access: who can open the open business's books, and our support team's access.
 *
 * Each person is a row (initials, name or email, "(you)", when they joined, their role as a word); an invitation that
 * waits shows when it was sent, how long its link works and **Waiting**. Only the owner invites, changes and removes
 * people and hands the business over: for the owner each row but their own has a ⋮ menu (Change what they can do, Make
 * owner for Full access only, Remove, each with the answer it needs; for a waiting invitation Send again and Cancel
 * invitation) and the card has **Invite someone**. Anyone else sees the list, and who the owner is.
 *
 * An invitation (and Send again) shows the email the demo can't send, written in the inviter's language with one line
 * in each of the other two; its button opens the join page. Under the list, our support team: no access unless the
 * owner lets it look for 7 days, with Stop now.
 */
@Component({
  selector: 'app-people-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    DemoEmail,
    DialogCard,
    HlmButton,
    HlmCardImports,
    HlmDialogImports,
    HlmDropdownMenuImports,
    InviteDialog,
    NgIcon,
    RoleCards,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideEllipsisVertical, lucideMail, lucidePlus })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" id="people" data-testid="settings-people">
      <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
        <h2 hlmCardTitle tabindex="-1" class="outline-none" data-testid="people-title">
          {{ 'people.title' | transloco }}
        </h2>
        @if (isOwner()) {
          <button
            hlmBtn
            size="sm"
            type="button"
            data-testid="people-invite"
            (click)="inviteOpen.set(true)"
          >
            <ng-icon name="lucidePlus" size="16" aria-hidden="true" />
            {{ 'people.invite.button' | transloco }}
          </button>
        }
      </header>
      <div hlmCardContent class="flex flex-col gap-4">
        <p class="text-muted-foreground text-sm" data-testid="people-intro">
          {{ 'people.intro' | transloco: { business: isolate(business().name) } }}
        </p>

        <ul class="flex flex-col">
          @for (row of rows(); track row.member.id) {
            <li
              class="border-border grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
              [attr.data-testid]="'people-row-' + row.member.id"
            >
              <span
                class="bg-muted text-muted-foreground row-span-2 flex size-9 shrink-0 items-center justify-center self-start rounded-full text-xs font-semibold"
                aria-hidden="true"
                [attr.data-testid]="'people-avatar-' + row.member.id"
              >
                @if (row.waiting) {
                  <ng-icon name="lucideMail" size="16" />
                } @else {
                  {{ row.initials }}
                }
              </span>
              <p
                class="min-w-0 font-medium [overflow-wrap:anywhere]"
                [attr.data-testid]="'people-name-' + row.member.id"
              >
                <bdi [attr.dir]="row.waiting ? 'ltr' : 'auto'">{{ row.label }}</bdi>
                @if (row.you) {
                  <span class="text-muted-foreground font-normal">
                    {{ 'people.row.you' | transloco }}
                  </span>
                }
              </p>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                [class]="row.tone"
                [attr.data-testid]="'people-role-' + row.member.id"
              >
                @if (row.waiting) {
                  {{ 'people.row.waiting' | transloco }}
                } @else {
                  {{ 'roles.' + row.member.role + '.name' | transloco }}
                }
              </span>
              @if (isOwner() && row.member.role === 'owner') {
                <!-- Where the others have their ⋮ menu, so the role words line up. -->
                <span class="size-10 shrink-0" aria-hidden="true"></span>
              } @else if (isOwner()) {
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon-lg"
                  type="button"
                  align="end"
                  [attr.data-testid]="'people-menu-' + row.member.id"
                  [hlmDropdownMenuTrigger]="menu"
                  [attr.aria-label]="'people.row.actions' | transloco: { name: row.label }"
                >
                  <ng-icon name="lucideEllipsisVertical" size="20" aria-hidden="true" />
                </button>
                <ng-template #menu>
                  <div hlmDropdownMenu class="w-64">
                    @if (row.waiting) {
                      <button
                        hlmDropdownMenuItem
                        type="button"
                        class="min-h-10"
                        data-testid="menu-resend"
                        (triggered)="resend(row.member)"
                      >
                        {{ 'people.menu.resend' | transloco }}
                      </button>
                      <button
                        hlmDropdownMenuItem
                        type="button"
                        class="min-h-10"
                        data-testid="menu-cancel"
                        (triggered)="cancel(row.member)"
                      >
                        {{ 'people.menu.cancel' | transloco }}
                      </button>
                    } @else {
                      <button
                        hlmDropdownMenuItem
                        type="button"
                        class="min-h-10"
                        data-testid="menu-change"
                        (triggered)="ask('role', row)"
                      >
                        {{ 'people.menu.change' | transloco }}
                      </button>
                      @if (row.member.role === 'full') {
                        <button
                          hlmDropdownMenuItem
                          type="button"
                          class="min-h-10"
                          data-testid="menu-owner"
                          (triggered)="ask('owner', row)"
                        >
                          {{ 'people.menu.owner' | transloco }}
                        </button>
                      }
                      <button
                        hlmDropdownMenuItem
                        type="button"
                        variant="destructive"
                        class="min-h-10"
                        data-testid="menu-remove"
                        (triggered)="ask('remove', row)"
                      >
                        {{ 'people.menu.remove' | transloco }}
                      </button>
                    }
                  </div>
                </ng-template>
              }
              <p
                class="text-muted-foreground col-span-3 col-start-2 text-xs [overflow-wrap:anywhere]"
                [attr.data-testid]="'people-sub-' + row.member.id"
              >
                @if (row.waiting) {
                  @if (row.member.invitedOn; as invited) {
                    {{ 'people.row.invited' | transloco }}
                    <bdi dir="ltr">{{ invited | appDate }}</bdi>
                  }
                  @if (row.member.expiresOn; as until) {
                    · {{ 'people.row.linkUntil' | transloco }}
                    <bdi dir="ltr">{{ until | appDate }}</bdi>
                  }
                } @else {
                  <bdi dir="ltr">{{ row.email }}</bdi>
                  @if (row.member.joinedOn; as joined) {
                    · {{ 'people.row.joined' | transloco }}
                    <bdi dir="ltr">{{ joined | appDate: { year: true } }}</bdi>
                  }
                }
              </p>
            </li>
          }
        </ul>

        @if (!isOwner()) {
          <p class="text-muted-foreground text-sm" data-testid="people-owner-note">
            {{ 'people.ownerNote' | transloco: { owner: isolate(ownerName()) } }}
          </p>
        }

        @if (shownMail(); as mail) {
          <app-demo-email
            [to]="mail.to"
            [mailLang]="mail.lang"
            [subject]="mail.subject"
            [body]="mail.body"
            [action]="mail.action"
            (act)="accept(mail.memberId)"
          >
            @for (other of mail.others; track other.lang) {
              <p
                class="border-border text-muted-foreground border-t pt-2 text-xs"
                data-testid="demo-email-other"
                [attr.lang]="other.lang"
                [attr.dir]="other.dir"
              >
                {{ other.text }}
              </p>
            }
          </app-demo-email>
        }

        <div
          class="border-border flex flex-col items-start gap-2 rounded-lg border p-3"
          data-testid="people-support"
        >
          <h3 class="font-medium" data-testid="support-title">
            {{ 'people.support.title' | transloco }}
          </h3>
          @if (supportUntil(); as until) {
            <p class="text-sm" data-testid="support-status">
              {{ 'people.support.on' | transloco }}
              <bdi dir="ltr">{{ until | appDate }}</bdi>
            </p>
            <p class="text-muted-foreground text-sm" data-testid="support-look-only">
              {{ 'people.support.lookOnly' | transloco }}
            </p>
            @if (isOwner()) {
              <button
                hlmBtn
                variant="outline"
                size="sm"
                type="button"
                data-testid="support-stop"
                (click)="demo.setSupportAccess(false)"
              >
                {{ 'people.support.stop' | transloco }}
              </button>
            }
          } @else {
            <p class="text-sm" data-testid="support-status">
              {{ 'people.support.off' | transloco }}
            </p>
            @if (isOwner()) {
              <button
                hlmBtn
                variant="outline"
                size="sm"
                type="button"
                data-testid="support-allow"
                (click)="demo.setSupportAccess(true)"
              >
                {{ 'people.support.allow' | transloco: { days: supportDays } }}
              </button>
            }
          }
        </div>
      </div>
    </section>

    <!-- The pop-ups show through the overlay: nothing of them belongs in the card. -->
    <div hidden>
      <app-invite-dialog [(open)]="inviteOpen" (invited)="showEmail($event)" />

      <hlm-dialog
        [state]="dialogOpen() ? 'open' : 'closed'"
        autoFocus="dialog"
        (stateChanged)="onDialogState($event)"
      >
        <hlm-dialog-content
          *hlmDialogPortal
          appDialogCard
          data-testid="people-dialog"
          [closeLabel]="'people.dialog.close' | transloco"
        >
          @if (target(); as t) {
            <hlm-dialog-header class="pe-8">
              <h2
                hlmDialogTitle
                class="text-lg leading-snug font-semibold"
                data-testid="dialog-title"
              >
                {{ 'people.dialog.' + t.kind + '.title' | transloco: { name: isolate(t.name) } }}
              </h2>
            </hlm-dialog-header>

            @if (t.kind === 'role') {
              <app-role-cards [(role)]="pick" />
            } @else {
              <p data-testid="dialog-body">
                {{
                  'people.dialog.' + t.kind + '.body'
                    | transloco: { name: isolate(t.name), business: isolate(business().name) }
                }}
              </p>
            }

            <hlm-dialog-footer>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="dialog-cancel"
                (click)="dialogOpen.set(false)"
              >
                {{ 'people.dialog.cancel' | transloco }}
              </button>
              <button
                hlmBtn
                type="button"
                class="min-h-10"
                data-testid="dialog-confirm"
                [variant]="t.kind === 'remove' ? 'destructive' : 'default'"
                [disabled]="t.kind === 'role' && pick() === null"
                (click)="confirm(t)"
              >
                {{ 'people.dialog.' + t.kind + '.confirm' | transloco }}
              </button>
            </hlm-dialog-footer>
          }
        </hlm-dialog-content>
      </hlm-dialog>
    </div>
  `,
})
export class PeopleCard {
  protected readonly demo = inject(DemoStateService);
  private readonly accounts = inject(AccountService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly business = this.demo.business;
  protected readonly isOwner = computed(() => this.demo.myRole() === 'owner');
  protected readonly ownerName = computed(() => {
    const owner = this.whoIs(ownerOf(this.business()));
    return owner.name ?? owner.email;
  });
  protected readonly supportDays = SUPPORT_DAYS;
  protected readonly isolate = isolateText;

  protected readonly rows = computed<Row[]>(() => {
    const personId = this.demo.person.id;
    return this.business().people.map((member) => {
      const waiting = member.status === 'invited';
      const who = this.whoIs(member);
      return {
        member,
        label: who.name ?? who.email,
        email: who.email,
        initials: who.name ? initialsOf(who.name) : '',
        you: !waiting && member.personId === personId,
        waiting,
        tone: waiting
          ? 'bg-warning/10 text-warning'
          : member.role === 'owner'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
      };
    });
  });

  /** The last day our support team can look, while it can; null for "No access". */
  protected readonly supportUntil = computed(() => {
    const business = this.business();
    return supportActive(business, DEMO_TODAY) ? business.supportUntil : null;
  });

  // The pop-ups.
  protected readonly inviteOpen = signal(false);
  protected readonly dialogOpen = signal(false);
  /** Whom the open pop-up is about; kept while it fades out, so it never changes in front of the eyes. */
  protected readonly target = signal<DialogTarget | null>(null);
  /** The role chosen in the Change pop-up. */
  protected readonly pick = signal<GrantedRole | null>(null);

  // The invitation email: forgotten when another business opens.
  private readonly mail = linkedSignal<string, InvitationMail | null>({
    source: () => this.business().id,
    computation: () => null,
  });
  /** The email while its invitation is still waiting: it goes with a cancelled invitation, with one that was accepted, and when the business is handed over. */
  protected readonly shownMail = computed(() => {
    const mail = this.mail();
    const row = mail && this.business().people.find((m) => m.id === mail.memberId);
    return mail && row?.status === 'invited' && this.isOwner() ? mail : null;
  });
  /** The languages of the email being loaded, so a later one drops it. */
  private loading: Subscription | null = null;

  /** Asks about a person: what they can do, handing the business over, removing them. */
  protected ask(kind: DialogTarget['kind'], row: Row): void {
    this.target.set({ kind, id: row.member.id, name: row.label });
    this.pick.set(row.member.role === 'owner' ? null : (row.member.role as GrantedRole));
    this.dialogOpen.set(true);
  }

  /** The cross, Escape and a tap outside close the pop-up by themselves; it follows. */
  protected onDialogState(state: 'open' | 'closed'): void {
    if (state === 'closed') this.dialogOpen.set(false);
  }

  protected confirm(target: DialogTarget): void {
    switch (target.kind) {
      case 'role': {
        const role = this.pick();
        if (role !== null) this.demo.changeRole(target.id, role);
        break;
      }
      case 'owner':
        this.demo.makeOwner(target.id);
        break;
      case 'remove':
        this.demo.removeMember(target.id);
        break;
    }
    this.dialogOpen.set(false);
    // The ⋮ the cursor was on may be gone (a person removed, the menus hidden after a handover).
    this.focusTitle();
  }

  protected resend(member: Member): void {
    this.demo.resendInvite(member.id);
    this.showEmail(member.id);
  }

  protected cancel(member: Member): void {
    this.demo.cancelInvite(member.id);
    this.focusTitle();
  }

  /** The join page of an invitation: the demo can't send the email, so its button is the link. */
  protected accept(memberId: string): void {
    void this.router.navigate(['/join', this.business().id, memberId]);
  }

  /**
   * Shows the email of an invitation: in the language of the person who invites (the page's when they have none yet),
   * with one line in each of the other two (the invited person's own language isn't known yet). The languages are loaded
   * first, as only the one the page shows has been.
   */
  protected showEmail(memberId: string): void {
    const business = this.business();
    const member = business.people.find((m) => m.id === memberId);
    if (!member) return;
    const person = this.demo.person;
    const inviter = isolateText(`${person.firstName} ${person.lastName}`);
    const lang = person.lang ?? this.language.lang();
    const langs = [lang, ...LANGS.filter((other) => other !== lang)];
    this.loading?.unsubscribe();
    this.loading = combineLatest(langs.map((l) => this.transloco.load(l)))
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Another business may have been opened while the languages came.
        if (this.business().id !== business.id) return;
        const say = (l: Lang, key: string): string =>
          this.transloco.translate(
            `people.mail.${key}`,
            {
              inviter,
              business: isolateText(business.name),
              role: this.transloco.translate(`roles.${member.role}.name`, {}, l),
              days: INVITE_DAYS,
            },
            l,
          );
        this.mail.set({
          memberId,
          to: member.email,
          lang,
          subject: say(lang, 'subject'),
          body: say(lang, 'body'),
          action: say(lang, 'action'),
          others: langs.slice(1).map((l) => ({
            lang: l,
            dir: l === 'ar' ? 'rtl' : 'ltr',
            text: say(l, 'line'),
          })),
        });
      });
  }

  /**
   * The name and email of a row. A row that is a login (it has an account) shows what the account says now, so a person
   * who renamed themselves or changed their email in My account is not shown as they were when they joined; every other
   * row shows what it holds (an invitation has no name yet).
   */
  private whoIs(member: Member): { name: string | null; email: string } {
    const login =
      member.personId === null
        ? undefined
        : this.accounts.persons().find((p) => p.id === member.personId);
    return login
      ? { name: `${login.firstName} ${login.lastName}`, email: login.email }
      : { name: member.name, email: member.email };
  }

  private focusTitle(): void {
    focusAfterRender(this.injector, this.host, '[data-testid="people-title"]');
  }
}
