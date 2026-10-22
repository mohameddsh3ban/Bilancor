import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { ACCEPT_ATTRIBUTE } from '../domain/document-upload';
import { UploadService } from '../state/upload.service';
import { ADD_WAYS, AddWayLabel, PHONE_ONLY } from './add-ways';
import { CopyButton } from './copy-button';

/**
 * The **+ Add** button and the ways it offers: take a photo (phones only), choose files, or forward by email. A way
 * that needs a file picker opens one of two hidden file inputs, which live here and not in the menu, so they are
 * still there when the menu closes. What is picked goes to `UploadService`. `open` opens the menu when it turns
 * true (the page asks that of "Upload receipt"); it never closes it again.
 */
@Component({
  selector: 'app-add-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AddWayLabel, CopyButton, HlmButton, HlmPopoverImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucidePlus })],
  host: { class: 'inline-block' },
  template: `
    <hlm-popover
      align="end"
      [attachTo]="trigger"
      [state]="menuOpen() ? 'open' : 'closed'"
      (stateChanged)="menuOpen.set($event === 'open')"
    >
      <button #trigger hlmPopoverTrigger hlmBtn type="button" data-testid="add-button">
        <ng-icon name="lucidePlus" size="16" aria-hidden="true" />
        {{ 'documents.add' | transloco }}
      </button>
      <ng-template hlmPopoverPortal>
        <hlm-popover-content class="w-[min(22rem,calc(100vw-2rem))] gap-0 p-1">
          <ul class="flex flex-col" data-testid="add-ways">
            @for (way of ways; track way.id) {
              <li [class]="way.phoneOnly ? phoneOnly : ''">
                @if (way.id === 'email') {
                  <div
                    class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-sm px-2 py-2"
                    data-testid="add-email"
                  >
                    <app-add-way [way]="way" [email]="email()" />
                    <app-copy-button [text]="email()" />
                  </div>
                } @else {
                  <button
                    type="button"
                    class="hover:bg-accent focus-visible:bg-accent w-full rounded-sm px-2 py-2 outline-none"
                    [attr.data-testid]="'add-' + way.id"
                    (click)="choose(way.id)"
                  >
                    <app-add-way [way]="way" />
                  </button>
                }
              </li>
            }
          </ul>
        </hlm-popover-content>
      </ng-template>
    </hlm-popover>

    <input
      #photoInput
      type="file"
      class="hidden"
      accept="image/*"
      capture="environment"
      tabindex="-1"
      data-testid="photo-input"
      (change)="picked($event, 'photo')"
    />
    <input
      #fileInput
      type="file"
      class="hidden"
      multiple
      tabindex="-1"
      data-testid="file-input"
      [accept]="accept"
      (change)="picked($event, 'file')"
    />
  `,
})
export class AddMenu {
  private readonly upload = inject(UploadService);

  /** The address to forward receipts to. */
  readonly email = input.required<string>();
  /** Opens the menu when it turns true. */
  readonly open = input(false);

  protected readonly ways = ADD_WAYS;
  protected readonly phoneOnly = PHONE_ONLY;
  protected readonly accept = ACCEPT_ATTRIBUTE;
  protected readonly menuOpen = signal(false);

  private readonly photoInput = viewChild.required<ElementRef<HTMLInputElement>>('photoInput');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    effect(() => {
      if (this.open()) this.menuOpen.set(true);
    });
  }

  /** Opens the picker of a way and closes the menu. */
  protected choose(way: 'photo' | 'file'): void {
    (way === 'photo' ? this.photoInput() : this.fileInput()).nativeElement.click();
    this.menuOpen.set(false);
  }

  /** Adds what was picked, then empties the input so the same file can be picked again. */
  protected picked(event: Event, source: 'photo' | 'file'): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length > 0) this.upload.add(files, source);
  }
}
