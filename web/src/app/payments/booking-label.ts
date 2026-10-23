import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../core/i18n/language.service';
import { Booking, Lang } from '../data/models';

/** German keeps only the SKR03 account; English and Arabic put a short translated label in front of it. */
export function showsBookingLabel(lang: Lang): boolean {
  return lang !== 'de';
}

/** What a label needs of a booking: a category's name and SKR03 account (a yearly category total has these, too). */
export type BookingLabelled = Pick<Booking, 'labelKey' | 'skr03' | 'nameDe'>;

/** The SKR03 number with its German name; the caller keeps it left-to-right. */
export function skr03Text(booking: BookingLabelled): string {
  return `${booking.skr03} ${booking.nameDe}`;
}

/**
 * A booking as text: the translated category label, then the SKR03 account (number and German name, left-to-right).
 * German shows only the account.
 */
@Component({
  selector: 'app-booking-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (showLabel()) {
      {{ 'booking.' + booking().labelKey | transloco }} ·
    }
    <bdi dir="ltr">{{ skr03() }}</bdi>
  `,
})
export class BookingLabel {
  private readonly language = inject(LanguageService);

  readonly booking = input.required<BookingLabelled>();

  protected readonly showLabel = computed(() => showsBookingLabel(this.language.lang()));
  protected readonly skr03 = computed(() => skr03Text(this.booking()));
}
