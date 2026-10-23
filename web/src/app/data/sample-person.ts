import type { Person } from './models';

// The sample person, kept apart from the sample businesses so the sign-in pages can use her without loading all of that data.
// Like all sample data, she and her devices are invented.

/** Sara Weber, the person the demo starts with: no language chosen yet, this browser and her phone, and 6 of 8 backup codes left. */
export const PERSON: Person = {
  id: 'p1',
  firstName: 'Sara',
  lastName: 'Weber',
  email: 'sara@example.com',
  lang: null,
  devices: [
    { id: 'd1', browser: 'Chrome', system: 'Windows', place: 'Berlin', lastSeen: null, current: true },
    { id: 'd2', browser: 'Safari', system: 'iPhone', place: 'Berlin', lastSeen: '2026-10-21', current: false },
  ],
  backupCodesLeft: 6,
};
