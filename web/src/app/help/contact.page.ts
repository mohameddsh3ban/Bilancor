import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Signal,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, translateObjectSignal, translateSignal } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { DEMO_BOX } from '../account/demo-email';
import { HELP_ANSWERS, HELP_TOPICS, type HelpTopic } from '../data/help';
import { focusAfterRender } from '../settings/form-helpers';
import { FieldError } from '../settings/form-parts';
import { AccountService } from '../state/account.service';
import { HelpBackLink } from './help-back-link';

/** What a message needs to be sent: this many characters once the spaces around it are taken away. */
const MIN_MESSAGE = 10;

/** The topics the person can choose: the seven of Help and a last one for everything else. */
type ContactTopic = HelpTopic | 'other';
const TOPIC_CHOICES: readonly ContactTopic[] = [...HELP_TOPICS, 'other'];

/** Stands where the email goes in the reply line, so the address can be set left to right inside the translated sentence. */
const EMAIL_MARK = '\u0001';

/** What is missing from a message, or null when it can be sent. */
function messageProblem(message: string): 'missing' | 'short' | null {
  const length = message.trim().length;
  return length === 0 ? 'missing' : length < MIN_MESSAGE ? 'short' : null;
}

/**
 * Write to us (`/help/contact`): a topic, a message, the email the answer goes to (the signed-in person's own, no field
 * for it), **Send**, and a line on how to let support look at the books. A dashed demo box says nothing is really sent.
 * Send shows "Sent" with a way back to Help in place of the form; nothing is stored or sent anywhere, so a reload shows
 * the empty form again.
 *
 * Help's pages open it with parts filled in: `?topic=<topic>` chooses the topic (anything that is not a topic leaves the
 * choice to the person), `?about=<answer id>` starts the message with "About: <the question>" and a blank line (an id with
 * no answer is ignored), and `?q=<text>` puts the text of a search in the message, after the answer line when both come.
 * Only the message is needed: at least 10 characters once trimmed. A message that falls short is named under the field
 * when Send is pressed, and the name goes as soon as the person types.
 *
 * What the person types (and chooses) stays when the language changes, while a message nobody touched is written again
 * in the new language, since the question is named in the language of the page. Another address for the same page (the
 * browser's back and forward) starts the form again.
 */
@Component({
  selector: 'app-help-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldError, HelpBackLink, HlmButton, HlmCardImports, RouterLink, TranslocoPipe],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    <app-help-back-link testId="contact-back">
      {{ 'help.title' | transloco }}
    </app-help-back-link>

    <h1 class="text-2xl font-semibold" data-testid="contact-title">
      {{ 'help.contact.title' | transloco }}
    </h1>

    @if (sent()) {
      <section hlmCard size="sm" data-testid="contact-sent-card">
        <div hlmCardContent class="flex flex-col items-start gap-3">
          <!-- tabindex -1: the focus goes here once the message is sent, so a screen reader reads what happened. -->
          <p #sentNote tabindex="-1" class="font-medium outline-none" data-testid="contact-sent">
            {{ 'help.contact.sent' | transloco }}
          </p>
          <a hlmBtn routerLink="/help" data-testid="contact-sent-back">
            {{ 'help.contact.back' | transloco }}
          </a>
        </div>
      </section>
    } @else {
      <form
        class="flex flex-col gap-4"
        novalidate
        data-testid="contact-form"
        (submit)="send($event)"
      >
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">{{ 'help.contact.topic.label' | transloco }}</span>
          <select
            class="border-input bg-background h-11 w-full min-w-0 rounded-md border px-3 text-base"
            data-testid="contact-topic"
            (change)="pickTopic($event)"
          >
            <option value="" [selected]="topic() === ''">
              {{ 'help.contact.topic.placeholder' | transloco }}
            </option>
            @for (choice of choices; track choice) {
              <option [value]="choice" [selected]="topic() === choice">
                {{ topicKey(choice) | transloco }}
              </option>
            }
          </select>
        </label>

        <div class="flex flex-col gap-1">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">{{
              'help.contact.message.label' | transloco
            }}</span>
            <!-- Once there is text, dir auto: it reads from the side of the language it is written in, whatever the page's. Empty, it follows the page, so the placeholder and the cursor start on the right in Arabic. -->
            <textarea
              [attr.dir]="message().trim() === '' ? null : 'auto'"
              rows="7"
              class="border-input bg-background placeholder:text-muted-foreground aria-invalid:border-negative w-full resize-y rounded-md border px-3 py-2 text-base leading-relaxed"
              data-testid="contact-message"
              aria-required="true"
              [value]="message()"
              [placeholder]="'help.contact.message.placeholder' | transloco"
              [attr.aria-invalid]="problem() ? 'true' : null"
              [attr.aria-describedby]="problem() ? 'contact-error-message' : null"
              (input)="setMessage($event)"
            ></textarea>
          </label>
          @if (problem(); as why) {
            <p
              id="contact-error-message"
              data-testid="contact-error-message"
              [appFieldError]="'help.contact.error.' + why"
              [appFieldErrorParams]="errorParams"
            ></p>
          }
        </div>

        @let reply = ('help.contact.reply' | transloco: { email: emailMark }).split(emailMark);
        <p class="text-muted-foreground text-sm" data-testid="contact-reply">
          {{ reply[0] }}<bdi dir="ltr">{{ email() }}</bdi
          >{{ reply[1] }}
        </p>

        <button
          hlmBtn
          type="submit"
          size="lg"
          class="w-full sm:w-auto sm:self-start"
          data-testid="contact-send"
        >
          {{ 'help.contact.send' | transloco }}
        </button>
      </form>
    }

    <div
      [class]="demoBox"
      role="group"
      aria-labelledby="contact-demo-label"
      data-testid="contact-demo"
    >
      <p class="text-warning text-xs font-semibold" id="contact-demo-label">
        {{ 'help.contact.demo.label' | transloco }}
      </p>
      <p>{{ 'help.contact.demo.text' | transloco }}</p>
    </div>

    <p class="text-sm" data-testid="contact-support">
      {{ 'help.contact.support.text' | transloco }}
      <a
        routerLink="/settings"
        fragment="people"
        class="text-primary font-medium underline underline-offset-4"
        data-testid="contact-support-link"
        >{{
          'help.contact.support.path'
            | transloco: { settings: settingsName(), people: peopleName() }
        }}</a
      >
    </p>
  `,
})
export class HelpContactPage {
  private readonly route = inject(ActivatedRoute);
  private readonly account = inject(AccountService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly choices = TOPIC_CHOICES;
  protected readonly demoBox = DEMO_BOX;
  protected readonly emailMark = EMAIL_MARK;
  protected readonly errorParams = { min: String(MIN_MESSAGE) };

  /** The email the answer goes to: the signed-in person's own. */
  protected readonly email = computed(() => this.account.person().email);
  /** The app's own names for the pages the support line walks through. */
  protected readonly settingsName = translateSignal('settings.title');
  protected readonly peopleName = translateSignal('people.title');

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  /** The topic the address asks for (`?topic=`), or none for a missing one and for one that does not exist. */
  private readonly topicParam = computed<ContactTopic | ''>(
    () => TOPIC_CHOICES.find((choice) => choice === this.params().get('topic')) ?? '',
  );
  /** The answer the address names (`?about=`), or none, also for an id that has no answer. */
  private readonly aboutId = computed(
    () => HELP_ANSWERS.find((answer) => answer.id === this.params().get('about'))?.id ?? null,
  );
  private readonly queryText = computed(() => this.params().get('q') ?? '');
  /** What the address asks for, as one text: the form starts again when it changes, not when it is only visited again. */
  private readonly address = computed(
    () => `${this.topicParam()}\n${this.aboutId() ?? ''}\n${this.queryText()}`,
  );

  /** The question of the named answer, in the language of the page; empty until the translation file has arrived. */
  private readonly answerTexts = translateObjectSignal('help.answers') as Signal<
    Record<string, { q: string; a: string }>
  >;
  private readonly question = computed(() => {
    const id = this.aboutId();
    return id === null ? '' : (this.answerTexts()[id]?.q ?? '');
  });
  private readonly aboutLine = translateSignal(
    'help.contact.about',
    computed(() => ({ question: this.question() })),
  );
  /** What the message starts with: the answer line and a blank line, then the text of a search. */
  private readonly prefill = computed(() => {
    const about =
      this.question() !== '' && this.aboutLine() !== '' ? `${this.aboutLine()}\n\n` : '';
    return about + this.queryText();
  });

  /** The chosen topic; it starts as the address says and the person can change it. */
  protected readonly topic = linkedSignal<string, ContactTopic | ''>({
    source: this.address,
    computation: () => this.topicParam(),
  });
  /** What the person typed, or null while they have not typed: then the message is the start the address gives. */
  private readonly typed = linkedSignal<string, string | null>({
    source: this.address,
    computation: () => null,
  });
  protected readonly message = computed(() => this.typed() ?? this.prefill());
  /** What the last Send found missing, or null. Goes as soon as the person types. */
  protected readonly problem = linkedSignal<string, 'missing' | 'short' | null>({
    source: this.address,
    computation: () => null,
  });
  /** Whether Send was pressed with a message that can be sent. Only for the address shown. Never stored. */
  protected readonly sent = linkedSignal<string, boolean>({
    source: this.address,
    computation: () => false,
  });
  private readonly sentNote = viewChild<ElementRef<HTMLElement>>('sentNote');

  constructor() {
    // The form goes away when the message is sent; the focus moves to the note in its place, so the keyboard stays on the page.
    afterRenderEffect(() => this.sentNote()?.nativeElement.focus());
  }

  /** The translation key of a topic's name. */
  protected topicKey(choice: ContactTopic): string {
    return choice === 'other' ? 'help.contact.topic.other' : `help.topics.${choice}`;
  }

  protected pickTopic(event: Event): void {
    this.topic.set((event.target as HTMLSelectElement).value as ContactTopic | '');
  }

  protected setMessage(event: Event): void {
    this.typed.set((event.target as HTMLTextAreaElement).value);
    this.problem.set(null);
  }

  /** Sends when the message is long enough, and shows "Sent"; otherwise names what is missing and goes to the message. */
  protected send(event: Event): void {
    event.preventDefault();
    const problem = messageProblem(this.message());
    this.problem.set(problem);
    if (problem === null) {
      this.sent.set(true);
      return;
    }
    focusAfterRender(this.injector, this.host.nativeElement, '[data-testid="contact-message"]');
  }
}
