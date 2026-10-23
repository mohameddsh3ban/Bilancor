import { Directive } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';

/**
 * The card of a spartan dialog (`<hlm-dialog-content appDialogCard>`), made for a phone first: as wide as the screen
 * less a margin on each side, 28rem at most from a wider screen, and scrolling inside itself when the screen is short,
 * so the buttons never leave the screen. Put it on the content of every pop-up, and give the `<hlm-dialog>` around it
 * `autoFocus="dialog"`, so the cursor starts on the dialog and not on its first button.
 *
 * It is a directive, not a class on the element, because spartan builds the classes of the content itself and merges
 * the later ones over its own (`w-full` gives way to the width here); a binding would be overwritten.
 */
@Directive({ selector: 'hlm-dialog-content[appDialogCard]' })
export class DialogCard {
  constructor() {
    classes(() => 'max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto');
  }
}
