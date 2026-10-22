/**
 * Whether the person asked their system for less motion. Read when it is needed rather than once at the start, so a
 * change of the setting counts at the next animation. False where there are no media queries (a test without a browser).
 */
export function prefersReducedMotion(doc: Document): boolean {
  return doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
