import { safeNext } from './next-url';

describe('safeNext', () => {
  it('only follows paths inside the app', () => {
    expect(safeNext('/payments')).toBe('/payments');
    expect(safeNext('/payments/wd-t3?tab=history#top')).toBe('/payments/wd-t3?tab=history#top');
    expect(safeNext('/')).toBe('/');
    // Anything that could leave the app, or loop back to a page for people who are not in, lands on the homepage.
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/\\evil')).toBe('/');
    expect(safeNext('payments')).toBe('/');
    expect(safeNext('/sign-in')).toBe('/');
    expect(safeNext('/sign-in?next=/payments')).toBe('/');
    expect(safeNext('/sign-up')).toBe('/');
    expect(safeNext('/forgot-password')).toBe('/');
    expect(safeNext('')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
