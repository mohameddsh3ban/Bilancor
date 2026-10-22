/**
 * Whether the screen is at least Tailwind's `lg` wide: the width from which a template's `lg:` classes apply, so
 * code that must act differently on a computer asks the same question the styles do. False where there are no
 * media queries (a test without a browser).
 */
export function isComputerScreen(doc: Document): boolean {
  return doc.defaultView?.matchMedia?.('(min-width: 64rem)').matches ?? false;
}
