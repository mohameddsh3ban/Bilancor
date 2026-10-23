import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { bankInitials } from '../domain/bank-connection';

/** The colours a tile can have: project tokens only, so a bank is told apart without a logo. */
const TONES = [
  'bg-primary text-primary-foreground',
  'bg-primary/10 text-primary',
  'bg-accent text-accent-foreground',
] as const;

/**
 * A bank as two letters on a coloured square, never its logo. The colour follows the name, so the same bank looks the
 * same everywhere. Decorative: the bank's name is always written next to it.
 */
@Component({
  selector: 'app-bank-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `<span
    class="flex items-center justify-center rounded-lg font-semibold tracking-wide"
    [class]="classes()"
    >{{ initials() }}</span
  >`,
})
export class BankTile {
  readonly name = input.required<string>();
  readonly size = input<'md' | 'lg'>('md');

  protected readonly initials = computed(() => bankInitials(this.name()));
  protected readonly classes = computed(() => {
    const sum = [...this.name()].reduce((total, letter) => total + letter.charCodeAt(0), 0);
    const size = this.size() === 'lg' ? 'size-16 text-xl' : 'size-10 text-sm';
    return `${size} ${TONES[sum % TONES.length]}`;
  });
}
