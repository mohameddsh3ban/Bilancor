import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { pluralKey } from '../core/i18n/plural-key';
import type { SampleStatement, StatementImport } from '../data/models';
import { findSampleStatement } from '../data/sample-statements';
import { isClosedDate } from '../domain/months';
import { statementText, undoBlockedBy } from '../domain/statement-import';
import { DemoStateService } from '../state/demo-state.service';

/** One line of the list: the import, its original file when the demo still has it, and why it can't be undone (null: it can). */
interface ImportLine {
  imp: StatementImport;
  statement: SampleStatement | null;
  blocked: 'worked' | 'closed' | null;
}

/** Gives a text to the browser as a file to save, under the name of the original. */
function saveTextFile(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Not at once: Safari and iOS can cancel a download whose address is revoked right after the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * The imports of one account, under its row in Settings › Bank accounts: **Imports (N)** opens one line for each statement
 * imported into it, newest first ("22 Oct · sparkasse-oktober.csv · 5 payments"). **Download the file** gives the original
 * again, and **Undo import** takes its payments out while that is still possible; after that the line says why it is not
 * ("Can't be undone: some payments were worked on", or a month it touches is closed). An account with no imports shows
 * nothing. Undoing says so in a status line and puts the cursor on it, so it does not fall to the page when the line it
 * was on is gone.
 */
@Component({
  selector: 'app-account-imports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideChevronDown })],
  host: { class: 'block' },
  template: `
    @if (lines().length > 0 || undone() !== null) {
      <div class="mt-3" [attr.data-testid]="'imports-' + accountId()">
        @if (lines().length > 0) {
          <button
            type="button"
            class="text-primary inline-flex min-h-10 items-center gap-1 text-sm font-medium"
            [attr.aria-expanded]="open()"
            [attr.aria-controls]="listId()"
            [attr.data-testid]="'imports-toggle-' + accountId()"
            (click)="open.set(!open())"
          >
            <ng-icon
              name="lucideChevronDown"
              size="16"
              aria-hidden="true"
              [class.rotate-180]="open()"
            />
            <span>
              {{ 'settings.bank.imports.title' | transloco }}
              (<bdi dir="ltr">{{ lines().length }}</bdi
              >)
            </span>
          </button>
          @if (open()) {
            <ul
              class="flex flex-col"
              [id]="listId()"
              [attr.data-testid]="'imports-list-' + accountId()"
            >
              @for (line of lines(); track line.imp.id) {
                <li
                  class="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-3 first:border-t-0"
                >
                  <p
                    class="min-w-0 flex-1 basis-56 text-sm [overflow-wrap:anywhere]"
                    [id]="'import-line-' + line.imp.id"
                    [attr.data-testid]="'import-line-' + line.imp.id"
                  >
                    <bdi dir="ltr">{{ line.imp.importedOn | appDate }}</bdi> ·
                    <bdi dir="ltr">{{ line.imp.fileName }}</bdi> ·
                    <bdi dir="ltr">{{ line.imp.paymentIds.length }}</bdi>
                    {{
                      pluralKey('settings.bank.imports.payment', line.imp.paymentIds.length)
                        | transloco
                    }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    @if (line.statement; as statement) {
                      <button
                        hlmBtn
                        variant="outline"
                        size="sm"
                        type="button"
                        [id]="'import-download-' + line.imp.id"
                        [attr.aria-labelledby]="
                          'import-download-' + line.imp.id + ' import-line-' + line.imp.id
                        "
                        [attr.data-testid]="'import-download-' + line.imp.id"
                        (click)="download(line.imp, statement)"
                      >
                        {{ 'settings.bank.imports.download' | transloco }}
                      </button>
                    }
                    @if (line.blocked; as why) {
                      <p
                        class="text-muted-foreground text-xs"
                        [attr.data-testid]="'import-blocked-' + line.imp.id"
                      >
                        {{ 'settings.bank.imports.blocked.' + why | transloco }}
                      </p>
                    } @else {
                      <button
                        hlmBtn
                        variant="outline"
                        size="sm"
                        type="button"
                        [id]="'import-undo-' + line.imp.id"
                        [attr.aria-labelledby]="
                          'import-undo-' + line.imp.id + ' import-line-' + line.imp.id
                        "
                        [attr.data-testid]="'import-undo-' + line.imp.id"
                        (click)="undo(line.imp)"
                      >
                        {{ 'settings.bank.imports.undo' | transloco }}
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        }
        <p
          #status
          role="status"
          tabindex="-1"
          [class]="statusClass()"
          [attr.data-testid]="'imports-status-' + accountId()"
        >
          @if (undone(); as done) {
            {{ pluralKey('statementImport.undone', done.count) | transloco: { count: done.count } }}
          }
        </p>
      </div>
    }
  `,
})
export class AccountImports {
  private readonly demo = inject(DemoStateService);
  private readonly injector = inject(Injector);
  private readonly status = viewChild<ElementRef<HTMLElement>>('status');

  /** The account whose imports these are. */
  readonly accountId = input.required<string>();

  protected readonly pluralKey = pluralKey;
  protected readonly listId = computed(() => `imports-list-${this.accountId()}`);

  /** The imports of the account, newest first (the ones of one day in the order they were made, last first). */
  protected readonly lines = computed<ImportLine[]>(() => {
    const business = this.demo.business();
    const isClosed = (month: string): boolean => isClosedDate(business, `${month}-01`);
    return business.imports
      .filter((imp) => imp.accountId === this.accountId())
      .sort((a, b) => b.importedOn.localeCompare(a.importedOn))
      .map((imp) => ({
        imp,
        statement: findSampleStatement(business, imp.statementId),
        blocked: undoBlockedBy(business, imp, isClosed),
      }));
  });

  /** The business and data the list belongs to: its state starts over when another business opens, or the demo is reset (not on every change of the data). */
  private readonly scope = computed(
    () => `${this.demo.business().id}|${this.demo.dataGeneration()}`,
  );

  /** Whether the list is open. */
  protected readonly open = linkedSignal<string, boolean>({
    source: this.scope,
    computation: () => false,
  });

  /** How many payments the last undo took out again. */
  protected readonly undone = linkedSignal<string, { count: number } | null>({
    source: this.scope,
    computation: () => null,
  });

  /** The status line takes no room until it has something to say. */
  protected readonly statusClass = computed(() =>
    this.undone() === null
      ? 'outline-none'
      : 'bg-positive/10 text-positive mt-2 rounded-lg px-3 py-2 text-sm font-medium outline-none',
  );

  /** Download the file: the original statement, as it was dropped, is saved under its own name. */
  protected download(imp: StatementImport, statement: SampleStatement): void {
    saveTextFile(
      imp.fileName,
      statementText(statement),
      statement.format === 'camt' ? 'application/xml' : 'text/csv',
    );
  }

  /** Undo import: its payments are taken out, and the status line says so with the cursor on it. */
  protected undo(imp: StatementImport): void {
    const count = imp.paymentIds.length;
    if (!this.demo.undoImport(imp.id)) return;
    this.undone.set({ count });
    afterNextRender(() => this.status()?.nativeElement.focus(), { injector: this.injector });
  }
}
