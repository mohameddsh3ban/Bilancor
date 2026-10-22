import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileUp, lucideSearch, lucideSearchX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { filter as only, map, startWith } from 'rxjs';
import { isComputerScreen } from '../core/layout/computer-screen';
import { filterDocuments, groupDocsByMonth } from '../domain/document-search';
import { docNeedsYou, visibleDocuments } from '../domain/document-status';
import { DemoStateService } from '../state/demo-state.service';
import { AddMenu } from './add-menu';
import { ADD_WAYS, AddWayLabel, PHONE_ONLY } from './add-ways';
import { DocumentList } from './document-list';
import { DocumentTable } from './document-table';
import { DropOverlay } from './drop-overlay';
import { InboxLine } from './inbox-line';
import { NeedsYouBox } from './needs-you-box';
import { UploadMessage } from './upload-message';

type EmptyKind = 'new' | 'noMatch' | null;

/**
 * The documents of the open business: the ones that need the person in a box on top, then every other one newest
 * first, grouped by month, with search. A document opens beside the list (from `lg`) or on its own (below `lg`)
 * through the child route.
 */
@Component({
  selector: 'app-documents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddMenu,
    AddWayLabel,
    DocumentList,
    DocumentTable,
    DropOverlay,
    HlmButton,
    InboxLine,
    NeedsYouBox,
    NgIcon,
    RouterOutlet,
    TranslocoPipe,
    UploadMessage,
  ],
  viewProviders: [provideIcons({ lucideFileUp, lucideSearch, lucideSearchX })],
  template: `
    <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section
        class="min-w-0 flex-1 flex-col gap-4"
        data-testid="documents-list"
        [class]="selectedId() ? 'hidden lg:flex' : 'flex'"
      >
        <div class="flex items-center justify-between gap-3">
          <h1 class="text-2xl font-semibold">{{ 'documents.title' | transloco }}</h1>
          <app-add-menu [email]="inboxEmail()" [open]="addRequested()" />
        </div>
        <app-inbox-line [email]="inboxEmail()" />
        <app-upload-message />
        <app-needs-you-box [docs]="needsYou()" />

        @if (empty() !== 'new') {
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              size="16"
              class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              class="border-input bg-background placeholder:text-muted-foreground h-10 w-full rounded-md border ps-9 pe-3 text-sm"
              data-testid="document-search"
              [value]="search()"
              [attr.aria-label]="'documents.search.label' | transloco"
              [placeholder]="'documents.search.placeholder' | transloco"
              (input)="setSearch($event)"
            />
          </div>
        }

        @switch (empty()) {
          @case ('new') {
            <div
              class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center"
              data-testid="empty-new"
            >
              <ng-icon name="lucideFileUp" size="32" class="text-primary" aria-hidden="true" />
              <h2 class="text-lg font-semibold">{{ 'documents.empty.new.title' | transloco }}</h2>
              <p class="text-muted-foreground max-w-sm">
                {{ 'documents.empty.new.body' | transloco }}
              </p>
              <ul class="flex w-full max-w-sm flex-col gap-4 pt-2">
                @for (way of ways; track way.id) {
                  <li [class]="way.phoneOnly ? phoneOnly : ''" data-testid="empty-new-way">
                    <app-add-way [way]="way" [email]="inboxEmail()" />
                  </li>
                }
              </ul>
            </div>
          }
          @case ('noMatch') {
            <div
              class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
              data-testid="empty-no-match"
            >
              <ng-icon
                name="lucideSearchX"
                size="32"
                class="text-muted-foreground"
                aria-hidden="true"
              />
              <h2 class="text-lg font-semibold">{{ 'documents.empty.noMatch' | transloco }}</h2>
              <button
                hlmBtn
                variant="outline"
                type="button"
                data-testid="clear-search"
                (click)="search.set('')"
              >
                {{ 'documents.empty.clearSearch' | transloco }}
              </button>
            </div>
          }
          @default {
            @if (groups().length > 0) {
              <app-document-list
                [groups]="groups()"
                [selectedId]="selectedId()"
                [panelOpen]="!!selectedId()"
              />
              <app-document-table
                [groups]="groups()"
                [selectedId]="selectedId()"
                [panelOpen]="!!selectedId()"
              />
            }
          }
        }
      </section>

      <div
        class="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto"
        data-testid="documents-detail"
        [class.hidden]="!selectedId()"
      >
        <router-outlet />
      </div>
    </div>
    <app-drop-overlay />
  `,
})
export class DocumentsPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly ways = ADD_WAYS;
  protected readonly phoneOnly = PHONE_ONLY;

  /** The search lives here, not in the URL; it starts over when another business opens. */
  protected readonly search = linkedSignal<string, string>({
    source: () => this.demo.business().id,
    computation: () => '',
  });

  /** The document open through the child route, if any. */
  protected readonly selectedId = toSignal(
    this.router.events.pipe(
      only((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.firstChild?.snapshot?.paramMap.get('id') ?? null),
    ),
    { initialValue: null },
  );

  /** Whether the address asks for the Add menu to be open (`?add=1`, from Upload receipt). */
  protected readonly addRequested = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('add') === '1')),
    { initialValue: this.route.snapshot.queryParamMap.get('add') === '1' },
  );

  protected readonly inboxEmail = computed(() => this.demo.business().inboxEmail);
  private readonly visible = computed(() =>
    visibleDocuments(this.demo.documents(), this.demo.setup()),
  );
  /** The documents that need the person; the search does not touch them. */
  protected readonly needsYou = computed(() => this.visible().filter(docNeedsYou));
  private readonly rest = computed(() => this.visible().filter((doc) => !docNeedsYou(doc)));
  private readonly filtered = computed(() => filterDocuments(this.rest(), this.search()));
  protected readonly groups = computed(() => groupDocsByMonth(this.filtered()));

  /** What to show instead of the list: nothing to show yet and no bank, or no match for the search. */
  protected readonly empty = computed<EmptyKind>(() => {
    if (!this.demo.bankConnected() && this.visible().length === 0) return 'new';
    return this.search().trim() !== '' && this.filtered().length === 0 ? 'noMatch' : null;
  });

  constructor() {
    // The menu opens from the address once; the address is cleaned at once, so a reload or the back button
    // does not open it again, and the next Upload receipt can ask again.
    effect(() => {
      if (!this.addRequested()) return;
      void this.router.navigate([], {
        queryParams: { add: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    // On a phone a document is a page of its own: show it from its top, not from where the list or the homepage
    // was scrolled to. From `lg` it is a panel beside the list, which stays where it is (the panel is sticky).
    effect(() => {
      if (this.selectedId() && !isComputerScreen(this.document)) {
        this.document.documentElement.scrollTop = 0;
      }
    });
  }

  protected setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
