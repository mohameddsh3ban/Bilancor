import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCamera, lucideFileUp, lucideMail } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

export type AddWayId = 'photo' | 'file' | 'email';

export interface AddWay {
  id: AddWayId;
  icon: string;
  /** Only a phone has a camera to take a photo with; from `lg` the way is not offered. */
  phoneOnly: boolean;
}

/** The three ways to add a document, in the order they are offered: the Add menu and the empty state both show these. */
export const ADD_WAYS: readonly AddWay[] = [
  { id: 'photo', icon: 'lucideCamera', phoneOnly: true },
  { id: 'file', icon: 'lucideFileUp', phoneOnly: false },
  { id: 'email', icon: 'lucideMail', phoneOnly: false },
];

/** The classes that keep a phone-only way off a computer screen. */
export const PHONE_ONLY = 'lg:hidden';

/** One way to add: its icon, its name, and its hint line (for an email, the address to forward to). */
@Component({
  selector: 'app-add-way',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCamera, lucideFileUp, lucideMail })],
  host: { class: 'flex min-w-0 items-start gap-3 text-start' },
  template: `
    <ng-icon
      [name]="way().icon"
      size="20"
      class="text-primary mt-0.5 shrink-0"
      aria-hidden="true"
    />
    <span class="flex min-w-0 flex-col">
      <span class="font-medium" data-testid="add-way-title">{{
        'documents.ways.' + way().id + '.title' | transloco
      }}</span>
      @if (way().id === 'email') {
        <bdi
          dir="ltr"
          class="text-muted-foreground text-sm break-all select-all"
          data-testid="add-way-email"
          >{{ email() }}</bdi
        >
      } @else {
        <span class="text-muted-foreground text-sm">{{
          'documents.ways.' + way().id + '.hint' | transloco
        }}</span>
      }
    </span>
  `,
})
export class AddWayLabel {
  readonly way = input.required<AddWay>();
  /** The address to forward receipts to; shown for the email way. */
  readonly email = input('');
}
