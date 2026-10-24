import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideFileUp, lucideLoaderCircle } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { Term } from '../core/i18n/term';
import { pluralKey } from '../core/i18n/plural-key';
import type { ColumnMapping, SampleStatement } from '../data/models';
import { accountName, bankNameOf, maskIban } from '../domain/bank-connection';
import { isClosedDate } from '../domain/months';
import { guessMapping, mappingComplete, undoBlockedBy } from '../domain/statement-import';
import { focusAfterRender } from '../settings/form-helpers';
import { BACK_URLS, openedFrom } from '../settings/opened-from';
import { DemoStateService } from '../state/demo-state.service';
import { StatementImportService, type ImportSummary } from '../state/statement-import.service';
import { ImportAccountChooser } from './import-account-chooser';
import { ImportColumnGrid } from './import-column-grid';
import { ImportNewAccount } from './import-new-account';

/** Stands where a German term goes in a translated sentence, so the sentence can be cut there and the term put in (`<app-term>` is a component). */
const TERM_MARK = '\u0001';

/** How many payments of the file are shown as they will appear. */
const FIRST_ROWS = 5;

/** What a file that was read stands for: the statement it was read as. A new object for each file, so reading the same sample again starts its columns over. */
interface FileRead {
  statement: SampleStatement;
}

/**
 * Import a bank statement (`/payments/import`): for an account that has no bank connection, or one that has but lacks older months.
 * `?account=<id>` names the account; without it (or with an id that is not one of the open business's accounts, the cash box or the Own money account) the
 * person picks one first, and `?new=1` asks for the name and IBAN of a new one. `?from=home|payments|settings` says where Back leads.
 *
 * The screen follows the file from top to bottom: the account, the drop zone (a file, or **Use a sample statement**: the mockup reads no
 * file, so any file takes the account's next sample), what we read from it (the format, how many payments, which are new, which the
 * account has already, which are in a closed month), its first payments, for a layout nobody knows the columns to match, and
 * **Import N payments**. Importing takes a moment; then the summary says what was added and what the person still has to do, with
 * **Undo import** while it can be undone. Nothing is imported twice: a payment the account has already is skipped.
 *
 * Everything on the screen belongs to the open business, its data and the account: another business, a reset or another account starts it
 * over, and an import that comes back after that is not shown.
 */
@Component({
  selector: 'app-statement-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    HlmButton,
    HlmCardImports,
    ImportAccountChooser,
    ImportColumnGrid,
    ImportNewAccount,
    MoneyPipe,
    NgIcon,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideFileUp, lucideLoaderCircle })],
  host: {
    class: 'mx-auto flex w-full max-w-2xl flex-col gap-4',
    // A file let go anywhere on the page is the page's, never the browser's: it would open the file and lose all that was changed in the demo.
    '(document:dragover)': 'onDragOver($event)',
    '(document:drop)': 'onDrop($event)',
  },
  template: `
    <a
      class="text-primary inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium"
      data-testid="back-link"
      [routerLink]="backUrl()"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'statementImport.back.' + from() | transloco }}
    </a>

    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold outline-none" tabindex="-1" data-testid="step-title">
        {{ 'statementImport.title' | transloco }}
      </h1>
      @let intro = ('statementImport.intro' | transloco: { term: termMark }).split(termMark);
      <p class="text-muted-foreground text-sm" data-testid="intro">
        {{ intro[0] }}<app-term key="kontoauszug" />{{ intro[1] }}
      </p>
    </header>

    @switch (mode()) {
      @case ('new') {
        <app-import-new-account [from]="from()" />
      }
      @case ('choose') {
        <app-import-account-chooser [from]="from()" />
      }
      @default {
        @if (account(); as account) {
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p class="flex flex-wrap items-center gap-x-1.5 text-sm" data-testid="into">
              <span class="text-muted-foreground">{{ 'statementImport.into' | transloco }}</span>
              <span class="font-medium">
                <bdi dir="auto">{{ bank() }}</bdi> ·
                {{ 'settings.bank.product.' + account.product | transloco }}
              </span>
              @if (iban(); as iban) {
                <span class="text-muted-foreground">
                  · <bdi dir="ltr" data-testid="into-iban">{{ iban }}</bdi>
                </span>
              }
            </p>
            @if (!summary() && !importing()) {
              <a
                class="text-primary inline-flex min-h-10 items-center text-sm font-medium underline-offset-4 hover:underline"
                data-testid="change-account"
                routerLink="/payments/import"
                [queryParams]="{ from: from() }"
              >
                {{ 'statementImport.change' | transloco }}
              </a>
            }
          </div>

          @if (summary(); as done) {
            <section hlmCard size="sm" data-testid="summary">
              <header hlmCardHeader>
                <h2 hlmCardTitle class="outline-none" tabindex="-1" data-testid="summary-title">
                  {{ 'statementImport.summary.title' | transloco }}
                </h2>
              </header>
              <div hlmCardContent class="flex flex-col gap-3">
                @if (done.added > 0) {
                  <!-- Each part stays whole when the line wraps: "1 needs you" never breaks between its words. -->
                  <p class="text-lg font-medium" id="summary-line" data-testid="summary-line">
                    <span class="whitespace-nowrap">{{
                      'statementImport.summary.added' | transloco: { count: done.added }
                    }}</span>
                    ·
                    <span class="whitespace-nowrap">{{
                      'statementImport.summary.booked'
                        | transloco: { count: done.bookedAutomatically }
                    }}</span>
                    ·
                    <span class="whitespace-nowrap">{{
                      plural('statementImport.summary.needs', done.needsYou)
                        | transloco: { count: done.needsYou }
                    }}</span>
                  </p>
                  @if (done.skipped > 0) {
                    <p class="text-muted-foreground text-sm" data-testid="summary-skipped">
                      {{
                        plural('statementImport.summary.skipped', done.skipped)
                          | transloco: { count: done.skipped }
                      }}
                    </p>
                  }
                } @else {
                  <p class="text-lg font-medium" id="summary-line" data-testid="summary-line">
                    {{ 'statementImport.summary.nothing' | transloco }}
                  </p>
                }
                <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  @if (done.needsYou > 0) {
                    <a
                      hlmBtn
                      size="lg"
                      routerLink="/review"
                      aria-describedby="summary-line"
                      data-testid="summary-start"
                    >
                      {{ 'statementImport.summary.start' | transloco }}
                    </a>
                  }
                  <a
                    hlmBtn
                    size="lg"
                    routerLink="/payments"
                    data-testid="summary-payments"
                    [variant]="done.needsYou > 0 ? 'outline' : 'default'"
                    [queryParams]="{ account: account.id }"
                  >
                    {{ 'statementImport.summary.payments' | transloco }}
                  </a>
                  @if (done.importId !== '') {
                    <button
                      hlmBtn
                      size="lg"
                      type="button"
                      variant="ghost"
                      data-testid="summary-undo"
                      (click)="undo(done)"
                    >
                      {{ 'statementImport.summary.undo' | transloco }}
                    </button>
                  }
                </div>
                @if (undoBlocked(); as why) {
                  <p class="text-negative text-sm" role="alert" data-testid="undo-blocked">
                    {{ 'statementImport.summary.undoBlocked.' + why | transloco }}
                  </p>
                }
              </div>
            </section>
          } @else {
            @if (undone(); as count) {
              <p
                class="bg-positive/10 text-positive rounded-lg px-3 py-2 text-sm font-medium"
                role="status"
                data-testid="undone"
              >
                {{ plural('statementImport.undone', count) | transloco: { count } }}
              </p>
            }

            <div
              class="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center"
              [class]="dragging() ? 'border-primary bg-primary/5' : 'border-border bg-card'"
              data-testid="drop-zone"
              (dragover)="dragging.set(true)"
              (dragleave)="dragging.set(false)"
              (drop)="dragging.set(false)"
            >
              <ng-icon name="lucideFileUp" size="32" class="text-primary" aria-hidden="true" />
              <p class="font-medium">{{ 'statementImport.file.drop' | transloco }}</p>
              <p class="text-muted-foreground text-sm">
                {{ 'statementImport.file.or' | transloco }}
                <button
                  type="button"
                  class="text-primary min-h-10 font-medium underline underline-offset-4"
                  data-testid="choose-file"
                  [disabled]="importing()"
                  (click)="picker.click()"
                >
                  {{ 'statementImport.file.choose' | transloco }}
                </button>
              </p>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="use-sample"
                [disabled]="importing()"
                (click)="takeFile()"
              >
                {{ 'statementImport.file.sample' | transloco }}
              </button>
              <p class="text-muted-foreground text-xs">
                {{ 'statementImport.file.demo' | transloco }}
              </p>
              <input
                #picker
                type="file"
                class="hidden"
                tabindex="-1"
                data-testid="file-input"
                (change)="picked($event)"
              />
            </div>

            @if (file(); as read) {
              @let parts =
                ('statementImport.read.recognised' | transloco: { format: termMark }).split(
                  termMark
                );
              <section class="flex flex-col gap-3" aria-labelledby="read-title" data-testid="read">
                <h2 class="text-lg font-semibold" id="read-title">
                  {{ 'statementImport.read.title' | transloco }}
                </h2>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <span
                    class="rounded-full px-3 py-1 font-medium"
                    data-testid="format-chip"
                    [class]="
                      read.statement.format === 'unknownCsv'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-positive/10 text-positive'
                    "
                  >
                    @switch (read.statement.format) {
                      @case ('camt') {
                        {{ parts[0] }}<app-term key="camt" />{{ parts[1] }}
                      }
                      @case ('bankCsv') {
                        {{ parts[0] }}<bdi dir="auto">{{ read.statement.bankLabel }}</bdi
                        >{{ parts[1] }}
                      }
                      @default {
                        {{ 'statementImport.read.unknown' | transloco }}
                      }
                    }
                  </span>
                  <span class="text-muted-foreground" data-testid="read-file">
                    {{ 'statementImport.read.file' | transloco }}
                    <bdi dir="ltr" data-testid="read-file-name">{{ read.statement.fileName }}</bdi>
                  </span>
                </div>
                <p class="text-sm" data-testid="read-line">
                  <span data-testid="read-count">{{
                    plural('statementImport.read.payments', read.statement.cells.length)
                      | transloco: { count: read.statement.cells.length }
                  }}</span>
                  @if (preview(); as p) {
                    @if (p.from && p.to) {
                      ·
                      <bdi dir="ltr" data-testid="read-range"
                        >{{ p.from | appDate }} – {{ p.to | appDate }}</bdi
                      >
                    }
                  }
                </p>

                @if (complete()) {
                  @if (preview(); as p) {
                    <ul
                      class="bg-card border-border divide-border divide-y rounded-xl border text-sm"
                    >
                      <li
                        class="flex items-center justify-between gap-3 px-4 py-3"
                        data-testid="count-new"
                      >
                        <span>{{ 'statementImport.read.new' | transloco }}</span>
                        <span class="text-lg font-semibold">{{ p.newCount }}</span>
                      </li>
                      <li
                        class="flex items-center justify-between gap-3 px-4 py-3"
                        data-testid="count-already"
                      >
                        <span>{{ 'statementImport.read.already' | transloco }}</span>
                        <span class="text-lg font-semibold">{{ p.duplicateCount }}</span>
                      </li>
                      @if (p.closedCount > 0) {
                        <li
                          class="flex items-center justify-between gap-3 px-4 py-3"
                          data-testid="count-closed"
                        >
                          <span>{{ 'statementImport.read.closed' | transloco }}</span>
                          <span class="text-lg font-semibold">{{ p.closedCount }}</span>
                        </li>
                      }
                      @if (p.unreadable > 0) {
                        <li
                          class="flex items-center justify-between gap-3 px-4 py-3"
                          data-testid="count-unreadable"
                        >
                          <span>{{ 'statementImport.read.unreadable' | transloco }}</span>
                          <span class="text-lg font-semibold">{{ p.unreadable }}</span>
                        </li>
                      }
                    </ul>

                    @if (p.duplicateCount > 0) {
                      <button
                        type="button"
                        class="text-primary min-h-10 self-start text-sm font-medium underline underline-offset-4"
                        aria-controls="which-list"
                        data-testid="see-which"
                        [attr.aria-expanded]="whichOpen()"
                        (click)="whichOpen.set(!whichOpen())"
                      >
                        {{
                          (whichOpen()
                            ? 'statementImport.read.hideWhich'
                            : 'statementImport.read.seeWhich'
                          ) | transloco
                        }}
                      </button>
                      @if (whichOpen()) {
                        <ul
                          class="bg-card border-border divide-border divide-y rounded-xl border px-4"
                          id="which-list"
                          data-testid="which-list"
                        >
                          @for (item of duplicates(); track item.row.index) {
                            <li
                              class="flex flex-col gap-2 py-3 sm:grid sm:grid-cols-2 sm:gap-4"
                              data-testid="which-row"
                            >
                              <div class="flex min-w-0 flex-col gap-0.5">
                                <p class="text-muted-foreground text-xs">
                                  {{ 'statementImport.read.inFile' | transloco }}
                                </p>
                                <p
                                  class="flex flex-wrap items-baseline gap-x-2 text-sm"
                                  data-testid="which-file"
                                >
                                  <span class="font-medium" dir="auto">{{
                                    item.row.counterparty
                                  }}</span>
                                  <bdi dir="ltr" data-testid="which-date">{{
                                    item.row.date | appDate
                                  }}</bdi>
                                  <bdi dir="ltr" data-testid="which-amount">{{
                                    item.row.amountCents | money: { signed: true }
                                  }}</bdi>
                                </p>
                              </div>
                              @if (item.match; as match) {
                                <div class="flex min-w-0 flex-col gap-0.5">
                                  <p class="text-muted-foreground text-xs" data-testid="which-match-label">
                                    {{ 'statementImport.read.hereAlready' | transloco }}
                                    @if (item.account; as owner) {
                                      ·
                                      <bdi dir="auto">{{
                                        nameOf(
                                          owner,
                                          'settings.bank.product.' + owner.product | transloco
                                        )
                                      }}</bdi>
                                    }
                                  </p>
                                  <p
                                    class="flex flex-wrap items-baseline gap-x-2 text-sm"
                                    data-testid="which-match"
                                  >
                                    <a
                                      class="text-primary font-medium underline underline-offset-4"
                                      dir="auto"
                                      [routerLink]="['/payments', match.id]"
                                      >{{ match.counterparty }}</a
                                    >
                                    <bdi dir="ltr" data-testid="which-match-date">{{
                                      match.date | appDate
                                    }}</bdi>
                                    <bdi dir="ltr" data-testid="which-match-amount">{{
                                      match.amountCents | money: { signed: true }
                                    }}</bdi>
                                  </p>
                                </div>
                              }
                            </li>
                          }
                        </ul>
                      }
                    }

                    @if (p.rows.length > 0) {
                      <h3 class="text-muted-foreground mt-1 text-sm font-medium" id="rows-title">
                        {{ 'statementImport.rows.title' | transloco }}
                      </h3>
                      <ul
                        class="bg-card border-border divide-border divide-y rounded-xl border"
                        aria-labelledby="rows-title"
                        data-testid="first-rows"
                      >
                        @for (row of firstRows(); track row.index) {
                          <li class="flex items-center gap-3 px-4 py-2.5" data-testid="first-row">
                            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span
                                class="truncate font-medium"
                                dir="auto"
                                data-testid="row-name"
                                >{{ row.counterparty }}</span
                              >
                              <span class="text-muted-foreground flex items-center gap-2 text-xs">
                                <bdi dir="ltr" data-testid="row-date">{{ row.date | appDate }}</bdi>
                                @if (row.state !== 'new') {
                                  <span
                                    class="bg-muted rounded-full px-2 py-0.5 font-medium"
                                    data-testid="row-tag"
                                  >
                                    {{
                                      (row.state === 'duplicate'
                                        ? 'statementImport.rows.already'
                                        : 'statementImport.rows.closed'
                                      ) | transloco
                                    }}
                                  </span>
                                }
                              </span>
                            </span>
                            <bdi dir="ltr" class="shrink-0 font-medium">
                              <span
                                data-testid="row-amount"
                                [class]="row.amountCents >= 0 ? 'text-positive' : 'text-negative'"
                              >
                                {{ row.amountCents | money: { signed: true } }}
                              </span>
                            </bdi>
                          </li>
                        }
                      </ul>
                    }
                  }
                }
              </section>

              @if (read.statement.mapping === null && mapping(); as current) {
                <app-import-column-grid
                  data-testid="columns"
                  [statement]="read.statement"
                  [mapping]="current"
                  (mappingChange)="mapping.set($event)"
                />
              }

              <div class="flex flex-col gap-2">
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  data-testid="import-button"
                  [attr.aria-busy]="importing()"
                  [disabled]="!canImport()"
                  (click)="runImport()"
                >
                  @if (importing()) {
                    <ng-icon
                      name="lucideLoaderCircle"
                      size="18"
                      class="motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    {{ 'statementImport.import.running' | transloco }}
                  } @else {
                    {{
                      (newCount() === 0
                        ? 'statementImport.import.none'
                        : plural('statementImport.import', newCount())
                      ) | transloco: { count: newCount() }
                    }}
                  }
                </button>
                <p class="sr-only" role="status" data-testid="import-status">
                  @if (importing()) {
                    {{ 'statementImport.import.running' | transloco }}
                  }
                </p>
                @if (reason(); as key) {
                  <p class="text-muted-foreground text-sm" data-testid="import-reason">
                    {{ key | transloco }}
                  </p>
                }
              </div>
            }
          }
        }
      }
    }
  `,
})
export class StatementImportPage {
  private readonly demo = inject(DemoStateService);
  private readonly service = inject(StatementImportService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly termMark = TERM_MARK;
  protected readonly plural = pluralKey;
  protected readonly nameOf = accountName;
  protected readonly importing = this.service.importing;

  /** Where the page was opened from: where Back leads (Settings when nothing is said). */
  protected readonly from = openedFrom(['home', 'payments', 'settings']);
  protected readonly backUrl = computed(() => BACK_URLS[this.from()]);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly accountId = computed(() => this.params().get('account'));
  private readonly isNew = computed(() => this.params().get('new') === '1');

  /** The account of the open business the address names, if it takes a statement: a bank account, not the cash box or the Own money account. */
  protected readonly account = computed(() => {
    const id = this.accountId();
    return (
      this.demo
        .business()
        .accounts.find((account) => account.id === id && account.kind === 'bank') ?? null
    );
  });
  /** What the page shows: the form for a new account, the import of the account named, or the choice of an account. */
  protected readonly mode = computed<'new' | 'choose' | 'import'>(() =>
    this.isNew() ? 'new' : this.account() ? 'import' : 'choose',
  );
  protected readonly bank = computed(() => {
    const account = this.account();
    return account === null ? '' : (bankNameOf(account) ?? account.name);
  });
  protected readonly iban = computed(() => {
    const iban = this.account()?.iban;
    return iban ? maskIban(iban) : null;
  });

  /** What everything below belongs to: the open business, its data and the account. It all starts over when this changes. */
  private readonly importKey = computed(
    () => `${this.demo.business().id}|${this.demo.dataGeneration()}|${this.accountId() ?? ''}`,
  );
  /** The file that was read, as the statement it stands for. */
  protected readonly file = linkedSignal<string, FileRead | null>({
    source: this.importKey,
    computation: () => null,
  });
  /** What each column holds: the statement's own mapping, or the guess for a layout nobody knows (see `guessMapping`), for the person to change. */
  protected readonly mapping = linkedSignal<FileRead | null, ColumnMapping | null>({
    source: this.file,
    computation: (read) => (read ? (read.statement.mapping ?? guessMapping(read.statement)) : null),
  });
  /** What the import came to, once it is done. */
  protected readonly summary = linkedSignal<string, ImportSummary | null>({
    source: this.importKey,
    computation: () => null,
  });
  /** How many payments the last undo took out, until something else is read or imported. */
  protected readonly undone = linkedSignal<string, number | null>({
    source: this.importKey,
    computation: () => null,
  });
  /** Why the summary's import can not be undone, after the person tried. */
  protected readonly undoBlocked = linkedSignal<string, 'worked' | 'closed' | null>({
    source: this.importKey,
    computation: () => null,
  });
  /** Whether the skipped payments are listed. */
  protected readonly whichOpen = linkedSignal<string, boolean>({
    source: this.importKey,
    computation: () => false,
  });
  protected readonly dragging = signal(false);

  /** What importing the file with the columns as they are would do to the business now. */
  protected readonly preview = computed(() => {
    const account = this.account();
    const read = this.file();
    const mapping = this.mapping();
    return account && read && mapping
      ? this.service.preview(read.statement, mapping)
      : null;
  });
  /** Whether the columns give a payment what it needs: nothing is counted or imported before. */
  protected readonly complete = computed(() => {
    const mapping = this.mapping();
    return mapping !== null && mappingComplete(mapping);
  });
  protected readonly newCount = computed(() => this.preview()?.newCount ?? 0);
  protected readonly firstRows = computed(() => this.preview()?.rows.slice(0, FIRST_ROWS) ?? []);
  /** The skipped payments, each with the payment of the business it matches and the account that payment is in (not always this one). */
  protected readonly duplicates = computed(() => {
    const { transactions, accounts } = this.demo.business();
    return (this.preview()?.rows ?? [])
      .filter((row) => row.state === 'duplicate')
      .map((row) => {
        const match = transactions.find((tx) => tx.id === row.duplicateOf) ?? null;
        return { row, match, account: accounts.find((account) => account.id === match?.accountId) ?? null };
      });
  });
  protected readonly canImport = computed(
    () => this.complete() && this.newCount() > 0 && !this.importing(),
  );
  /** Why Import is disabled when the columns are fine: every payment is here already, or nothing in the file can be added. */
  protected readonly reason = computed<string | null>(() => {
    const p = this.preview();
    if (!this.complete() || p === null || p.newCount > 0) return null;
    const onlyDuplicates = p.duplicateCount > 0 && p.closedCount === 0 && p.unreadable === 0;
    return onlyDuplicates ? 'statementImport.import.allHere' : 'statementImport.import.nothingNew';
  });

  constructor() {
    // Another screen of the page (the account was made, or chosen) starts at its heading, so what changed is read out.
    let first = true;
    effect(() => {
      this.mode();
      if (first) first = false;
      else
        untracked(() =>
          focusAfterRender(this.injector, this.host.nativeElement, '[data-testid="step-title"]'),
        );
    });
  }

  /** The file the person gave (any file: the mockup reads none) takes the account's next sample statement. */
  protected takeFile(): void {
    const account = this.account();
    if (!account || this.summary() || this.importing()) return;
    this.undone.set(null);
    this.whichOpen.set(false);
    this.file.set({ statement: this.service.nextSample(account.id) });
  }

  protected picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // so the same file can be chosen again
    if (files.length > 0) this.takeFile();
  }

  protected onDragOver(event: DragEvent): void {
    if (hasFiles(event)) event.preventDefault();
  }

  protected onDrop(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if ((event.dataTransfer?.files.length ?? 0) > 0) this.takeFile();
  }

  /**
   * Imports the file. A second tap while it runs does nothing, and a result that comes after the business, the data or the account
   * changed (or no result: the import was dropped) is not shown.
   */
  protected async runImport(): Promise<void> {
    const account = this.account();
    const read = this.file();
    const mapping = this.mapping();
    if (!account || !read || !mapping || !this.canImport()) return;
    const key = this.importKey();
    this.undone.set(null);
    const done = await this.service.import(account.id, read.statement, mapping);
    if (done === null || this.importKey() !== key) return;
    this.summary.set(done);
    focusAfterRender(this.injector, this.host.nativeElement, '[data-testid="summary-title"]');
  }

  /** Undo import: the payments are taken out again and the screen shows the file as it was read, ready to import again. If it can't be undone any more it says why. */
  protected undo(done: ImportSummary): void {
    if (this.demo.undoImport(done.importId)) {
      this.undoBlocked.set(null);
      this.summary.set(null);
      this.undone.set(done.added);
      return;
    }
    const business = this.demo.business();
    const imp = business.imports.find((i) => i.id === done.importId);
    const why = imp
      ? undoBlockedBy(business, imp, (month) => isClosedDate(business, `${month}-01`))
      : null;
    this.undoBlocked.set(why ?? 'worked');
  }
}

/** Whether a drag carries files: nothing else is the page's to take. */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
