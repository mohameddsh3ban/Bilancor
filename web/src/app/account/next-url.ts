/** The pages for people who are not in yet: a sign-in must never send a person back to one of them. */
const SIGNED_OUT_PAGES = ['/sign-in', '/sign-up', '/forgot-password'];

/**
 * Where to go after signing in, from the `next` in the address (the page that was asked for). Only a path inside the app
 * is followed: one that starts with `//` or `/\` is read by a browser as another site, and the sign-in pages themselves
 * would only bring the person back to where they are. Anything else goes to the homepage.
 */
export function safeNext(next: string | null): string {
  if (next === null || !next.startsWith('/')) return '/';
  if (next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (SIGNED_OUT_PAGES.some((page) => next.startsWith(page))) return '/';
  return next;
}
