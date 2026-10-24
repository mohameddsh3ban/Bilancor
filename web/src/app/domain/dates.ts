// Day arithmetic on ISO dates (`YYYY-MM-DD`), counted in UTC so no clock or zone matters. It sits apart from the bank rules
// so the people rules, and the sign-in code in the app's first load, can use it without reaching the sample data.

const MS_PER_DAY = 86_400_000;

/** The whole days from one ISO date to another; negative when `to` is earlier. Dates are read as UTC, so no clock or zone matters. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

/** The month before the month of an ISO date, as 'YYYY-MM' (December of the year before for a January date). */
export function monthBefore(date: string): string {
  return addDays(`${date.slice(0, 7)}-01`, -1).slice(0, 7);
}

/** An ISO date `days` after another (before it when negative), counted in UTC so no clock or zone matters. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}
