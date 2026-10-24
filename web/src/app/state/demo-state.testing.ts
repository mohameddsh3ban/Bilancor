import type { WritableSignal } from '@angular/core';
import type { AccountConnection, Business, Role } from '../data/models';
import type { DemoStateService } from './demo-state.service';

/**
 * For tests: puts an account of the open business back with another connection, as the bank would report it (a consent
 * that ends on a given day, or a broken connection). No screen can set that, so this reaches into the service's working
 * copy of the data; `DemoStateService.restore` puts back payments, documents and rules only.
 */
export function withConnection(
  demo: DemoStateService,
  accountId: string,
  change: Partial<AccountConnection>,
): void {
  const data = (demo as unknown as { data: WritableSignal<Business[]> }).data;
  const openId = demo.business().id;
  data.update((all) =>
    all.map((business) =>
      business.id !== openId
        ? business
        : {
            ...business,
            accounts: business.accounts.map((account) =>
              account.id === accountId
                ? { ...account, connection: { ...account.connection, ...change } }
                : account,
            ),
          },
    ),
  );
}

/** For tests: a business as the service holds it now, whoever is signed in (`businesses` lists only the person's own). */
export function businessOf(demo: DemoStateService, businessId: string): Business {
  return (demo as unknown as { data: WritableSignal<Business[]> }).data().find((b) => b.id === businessId)!;
}

/**
 * For tests: gives the signed-in person another role in a business. No screen does that (a login is an owner, or has full
 * access where the owner invited it), so this reaches into the service's working copy of the data.
 */
export function withRole(demo: DemoStateService, businessId: string, role: Role): void {
  const data = (demo as unknown as { data: WritableSignal<Business[]> }).data;
  const personId = demo.person.id;
  data.update((all) =>
    all.map((business) =>
      business.id !== businessId
        ? business
        : { ...business, people: business.people.map((m) => (m.personId === personId ? { ...m, role } : m)) },
    ),
  );
}
