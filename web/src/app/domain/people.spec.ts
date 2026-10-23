import { DEMO_TODAY } from '../data/demo-date';
import type { Business, Member } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { PERSON } from '../data/sample-person';
import {
  INVITE_DAYS,
  MIN_PASSWORD,
  SUPPORT_DAYS,
  acceptInvite,
  cancelInvite,
  changeRole,
  invite,
  inviteError,
  isEmail,
  isAppCode,
  isExpired,
  isNewPassword,
  leave,
  makeOwner,
  memberOf,
  normalEmail,
  ownerOf,
  removeMember,
  resendInvite,
  roleOf,
  setSupport,
  supportActive,
} from './people';

const TODAY = DEMO_TODAY; // 2026-10-22
const SARA = 'Sara Weber';

const sample = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const weber = (): Business => structuredClone(sample('weber-design'));
const linde = (): Business => structuredClone(sample('cafe-linde'));
const row = (business: Business, id: string): Member | undefined =>
  business.people.find((m) => m.id === id);

/** Weber Design with a partner who has full access, to hand the business over to. */
function weberWithPartner(): Business {
  const business = weber();
  const partner: Member = {
    id: 'wd-m9',
    personId: null,
    name: 'Lena Roth',
    email: 'lena@example.com',
    role: 'full',
    status: 'joined',
    invitedOn: null,
    expiresOn: null,
    joinedOn: '2026-09-20',
  };
  return { ...business, people: [...business.people, partner] };
}

describe('constants', () => {
  it('an invitation link and support access both run 7 days', () => {
    expect(INVITE_DAYS).toBe(7);
    expect(SUPPORT_DAYS).toBe(7);
  });
});

describe('the password and the code', () => {
  it('a new password needs 10 characters, counted as people count them', () => {
    expect(MIN_PASSWORD).toBe(10);
    expect(isNewPassword('123456789')).toBe(false);
    expect(isNewPassword('1234567890')).toBe(true);
    expect(isNewPassword('😀'.repeat(10))).toBe(true);
    expect(isNewPassword('😀'.repeat(9))).toBe(false);
    expect(isNewPassword('')).toBe(false);
  });

  it('a code is exactly 6 digits, with or without a space between the groups of three', () => {
    for (const good of ['123456', '000000', '123 456', ' 123456 '])
      expect(isAppCode(good), good).toBe(true);
    for (const bad of ['', '12345', '1234567', '12345a', 'abcdef', '123-456', '１２３４５６']) {
      expect(isAppCode(bad), bad).toBe(false);
    }
  });
});

describe('normalEmail and isEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalEmail('  Mia@Example.COM ')).toBe('mia@example.com');
  });

  it('accepts an address with a name, an @ and a dot after it, whatever its case and spaces', () => {
    expect(isEmail('mia@example.com')).toBe(true);
    expect(isEmail(' Mia@Example.com ')).toBe(true);
    expect(isEmail('a.b+c@sub.example.de')).toBe(true);
  });

  it('refuses a missing name, @, domain or dot, and spaces inside', () => {
    for (const bad of [
      '',
      'mia',
      'mia@',
      'mia@example',
      '@example.com',
      'mia@.',
      'mia @example.com',
      'mia@exa mple.com',
      'a@b@c.de',
    ]) {
      expect(isEmail(bad), bad).toBe(false);
    }
  });
});

describe('memberOf, roleOf and ownerOf', () => {
  it('finds the joined row of a login and its role', () => {
    expect(memberOf(weber(), PERSON.id)?.id).toBe('wd-m1');
    expect(roleOf(weber(), PERSON.id)).toBe('owner');
    expect(roleOf(linde(), PERSON.id)).toBe('full');
  });

  it('knows no row and no role for a person who is not in the business', () => {
    expect(memberOf(weber(), 'p99')).toBeUndefined();
    expect(roleOf(weber(), 'p99')).toBeNull();
  });

  it('counts joined rows only: a waiting row with that login is not a member', () => {
    const business = weber();
    const waiting: Member = { ...row(business, 'wd-m3')!, personId: 'p7' };
    const withWaiting = { ...business, people: [...business.people, waiting] };
    expect(memberOf(withWaiting, 'p7')).toBeUndefined();
    expect(roleOf(withWaiting, 'p7')).toBeNull();
  });

  it('names the owner row', () => {
    expect(ownerOf(weber()).name).toBe(SARA);
    expect(ownerOf(linde()).name).toBe('Jonas Linde');
  });
});

describe('inviteError', () => {
  it('is null for a new, well-formed address', () => {
    expect(inviteError(weber(), 'lena@example.com')).toBeNull();
  });

  it('inviteError ignores case and spaces', () => {
    expect(inviteError(weber(), ' Mia@Example.com ')).toBe('invited');
    expect(inviteError(weber(), 'JANA@kanzlei-hoffmann.example')).toBe('hasAccess');
    expect(inviteError(weber(), 'mia@')).toBe('invalid');
    expect(inviteError(weber(), '  SARA@example.com')).toBe('hasAccess');
  });

  it('a malformed address is invalid before anything else', () => {
    expect(inviteError(weber(), '')).toBe('invalid');
    expect(inviteError(weber(), 'mia example.com')).toBe('invalid');
  });

  it('asks about the open business only: Mia can be invited to Café Linde', () => {
    expect(inviteError(linde(), 'mia@example.com')).toBeNull();
  });
});

describe('invite', () => {
  it('invite adds a waiting row with a link until today + 7 and one personInvited line by the inviter', () => {
    const before = weber();
    const after = invite(before, ' Lena@Example.com ', 'full', 'wd-m4', SARA, TODAY);
    expect(after.people).toHaveLength(before.people.length + 1);
    expect(after.people.at(-1)).toEqual({
      id: 'wd-m4',
      personId: null,
      name: null,
      email: 'lena@example.com',
      role: 'full',
      status: 'invited',
      invitedOn: '2026-10-22',
      expiresOn: '2026-10-29',
      joinedOn: null,
    });
    expect(after.history).toHaveLength(before.history.length + 1);
    expect(after.history[0]).toEqual({
      date: TODAY,
      key: 'personInvited',
      params: { email: 'lena@example.com', role: 'full', by: SARA },
    });
    expect(after.history.slice(1)).toEqual(before.history);
  });

  it('keeps every other part of the business and leaves the old object alone', () => {
    const before = weber();
    const snapshot = structuredClone(before);
    const after = invite(before, 'lena@example.com', 'advisor', 'wd-m4', SARA, TODAY);
    expect({ ...after, people: before.people, history: before.history }).toEqual(before);
    expect(before).toEqual(snapshot);
  });

  it('refuses an address that has access, is already invited or is not an address, and adds no line', () => {
    const business = weber();
    for (const email of [
      'jana@kanzlei-hoffmann.example',
      'MIA@example.com',
      'mia@',
      'sara@example.com',
    ]) {
      expect(invite(business, email, 'full', 'wd-m4', SARA, TODAY), email).toBe(business);
    }
  });
});

describe('resendInvite', () => {
  it('gives the waiting row a fresh link and adds no line', () => {
    const before = weber();
    const after = resendInvite(before, 'wd-m3', TODAY);
    expect(row(after, 'wd-m3')).toEqual({ ...row(before, 'wd-m3')!, expiresOn: '2026-10-29' });
    expect(after.history).toBe(before.history);
  });

  it('brings back a link that ran out', () => {
    const before = weber();
    const later = '2026-11-15';
    expect(isExpired(row(before, 'wd-m3')!, later)).toBe(true);
    const after = resendInvite(before, 'wd-m3', later);
    expect(row(after, 'wd-m3')!.expiresOn).toBe('2026-11-22');
    expect(isExpired(row(after, 'wd-m3')!, later)).toBe(false);
  });

  it('ignores a joined or unknown row', () => {
    const business = weber();
    expect(resendInvite(business, 'wd-m2', TODAY)).toBe(business);
    expect(resendInvite(business, 'nope', TODAY)).toBe(business);
  });

  it('changes nothing when the link already ends that day', () => {
    const once = resendInvite(weber(), 'wd-m3', TODAY);
    expect(resendInvite(once, 'wd-m3', TODAY)).toBe(once);
  });
});

describe('cancelInvite', () => {
  it('cancelInvite removes the row with one line', () => {
    const before = weber();
    const after = cancelInvite(before, 'wd-m3', SARA, TODAY);
    expect(after.people.map((m) => m.id)).toEqual(['wd-m1', 'wd-m2']);
    expect(after.history).toEqual([
      { date: TODAY, key: 'invitationCancelled', params: { email: 'mia@example.com', by: SARA } },
    ]);
  });

  it('only cancels a waiting row', () => {
    const business = weber();
    expect(cancelInvite(business, 'wd-m2', SARA, TODAY)).toBe(business);
    expect(cancelInvite(business, 'wd-m1', SARA, TODAY)).toBe(business);
    expect(cancelInvite(business, 'nope', SARA, TODAY)).toBe(business);
  });
});

describe('isExpired', () => {
  const mia = row(weber(), 'wd-m3')!;

  it('works through the end date and is over the day after', () => {
    expect(isExpired(mia, '2026-10-22')).toBe(false);
    expect(isExpired(mia, '2026-10-27')).toBe(false);
    expect(isExpired(mia, '2026-10-28')).toBe(true);
  });

  it('is never true for a joined row', () => {
    expect(isExpired(row(weber(), 'wd-m2')!, '2030-01-01')).toBe(false);
  });
});

describe('acceptInvite', () => {
  it('acceptInvite joins the row and ignores an expired one', () => {
    const before = weber();
    const after = acceptInvite(before, 'wd-m3', 'Mia Brandt', TODAY);
    expect(row(after, 'wd-m3')).toEqual({
      id: 'wd-m3',
      personId: null,
      name: 'Mia Brandt',
      email: 'mia@example.com',
      role: 'receipts',
      status: 'joined',
      invitedOn: '2026-10-20',
      expiresOn: null,
      joinedOn: '2026-10-22',
    });
    expect(after.history).toEqual([
      {
        date: TODAY,
        key: 'personJoined',
        params: { name: 'Mia Brandt', role: 'receipts', by: 'Mia Brandt' },
      },
    ]);

    expect(acceptInvite(before, 'wd-m3', 'Mia Brandt', '2026-10-28')).toBe(before);
  });

  it('can still be accepted on the last day', () => {
    const after = acceptInvite(weber(), 'wd-m3', 'Mia Brandt', '2026-10-27');
    expect(row(after, 'wd-m3')!.status).toBe('joined');
  });

  it('ignores an unknown or joined row', () => {
    const business = weber();
    expect(acceptInvite(business, 'nope', 'Mia Brandt', TODAY)).toBe(business);
    expect(acceptInvite(business, 'wd-m2', 'Mia Brandt', TODAY)).toBe(business);
  });

  it('cannot be accepted twice', () => {
    const once = acceptInvite(weber(), 'wd-m3', 'Mia Brandt', TODAY);
    expect(acceptInvite(once, 'wd-m3', 'Mia Brandt', TODAY)).toBe(once);
  });
});

describe('changeRole', () => {
  it('gives a joined person another role with one line', () => {
    const after = changeRole(weber(), 'wd-m2', 'full', SARA, TODAY);
    expect(row(after, 'wd-m2')!.role).toBe('full');
    expect(after.history).toEqual([
      {
        date: TODAY,
        key: 'roleChanged',
        params: { name: 'Jana Hoffmann', role: 'full', by: SARA },
      },
    ]);
  });

  it('changes nothing for the same role, a waiting row or an unknown row', () => {
    const business = weber();
    expect(changeRole(business, 'wd-m2', 'advisor', SARA, TODAY)).toBe(business);
    expect(changeRole(business, 'wd-m3', 'full', SARA, TODAY)).toBe(business);
    expect(changeRole(business, 'nope', 'full', SARA, TODAY)).toBe(business);
  });
});

describe('removeMember', () => {
  it('takes a joined person out with one line', () => {
    const after = removeMember(weber(), 'wd-m2', SARA, TODAY);
    expect(after.people.map((m) => m.id)).toEqual(['wd-m1', 'wd-m3']);
    expect(after.history).toEqual([
      { date: TODAY, key: 'personRemoved', params: { name: 'Jana Hoffmann', by: SARA } },
    ]);
  });

  it('leaves a waiting row to cancelInvite', () => {
    const business = weber();
    expect(removeMember(business, 'wd-m3', SARA, TODAY)).toBe(business);
    expect(removeMember(business, 'nope', SARA, TODAY)).toBe(business);
  });
});

describe('makeOwner', () => {
  it('makeOwner swaps the owner and a full-access member and refuses a tax advisor', () => {
    const before = weberWithPartner();
    const after = makeOwner(before, 'wd-m9', SARA, TODAY);
    expect(ownerOf(after).id).toBe('wd-m9');
    expect(row(after, 'wd-m1')!.role).toBe('full');
    expect(after.people.filter((m) => m.role === 'owner')).toHaveLength(1);
    expect(after.history).toEqual([
      { date: TODAY, key: 'ownerChanged', params: { name: 'Lena Roth', by: SARA } },
    ]);

    expect(makeOwner(before, 'wd-m2', SARA, TODAY)).toBe(before); // a tax advisor
    expect(makeOwner(before, 'wd-m3', SARA, TODAY)).toBe(before); // a waiting row
  });

  it('Sara can be handed Café Linde', () => {
    const after = makeOwner(linde(), 'cl-m2', 'Jonas Linde', TODAY);
    expect(ownerOf(after).personId).toBe(PERSON.id);
    expect(row(after, 'cl-m1')!.role).toBe('full');
    expect(roleOf(after, PERSON.id)).toBe('owner');
  });

  it('refuses the owner and an unknown row', () => {
    const business = weberWithPartner();
    expect(makeOwner(business, 'wd-m1', SARA, TODAY)).toBe(business);
    expect(makeOwner(business, 'nope', SARA, TODAY)).toBe(business);
  });
});

describe('leave', () => {
  it('takes the person out with one line by the leaver', () => {
    const after = leave(linde(), PERSON.id, TODAY);
    expect(after.people.map((m) => m.id)).toEqual(['cl-m1']);
    expect(after.history).toEqual([
      { date: TODAY, key: 'personLeft', params: { name: SARA, by: SARA } },
    ]);
  });

  it('changes nothing for someone who is not in the business', () => {
    const business = linde();
    expect(leave(business, 'p99', TODAY)).toBe(business);
  });
});

describe('the owner', () => {
  it("the owner can't be removed, changed or leave", () => {
    const business = weber();
    expect(removeMember(business, 'wd-m1', SARA, TODAY)).toBe(business);
    expect(changeRole(business, 'wd-m1', 'full', SARA, TODAY)).toBe(business);
    expect(makeOwner(business, 'wd-m1', SARA, TODAY)).toBe(business);
    expect(leave(business, PERSON.id, TODAY)).toBe(business);
    expect(cancelInvite(business, 'wd-m1', SARA, TODAY)).toBe(business);
    expect(ownerOf(business).id).toBe('wd-m1');
  });
});

describe('support access', () => {
  it('support is active until today + 7 and off after setSupport(false)', () => {
    const none = weber();
    expect(supportActive(none, TODAY)).toBe(false);

    const on = setSupport(none, true, SARA, TODAY);
    expect(on.supportUntil).toBe('2026-10-29');
    expect(on.history).toEqual([
      { date: TODAY, key: 'supportOn', params: { until: '2026-10-29', by: SARA } },
    ]);
    expect(supportActive(on, TODAY)).toBe(true);
    expect(supportActive(on, '2026-10-29')).toBe(true);
    expect(supportActive(on, '2026-10-30')).toBe(false);

    const off = setSupport(on, false, SARA, TODAY);
    expect(off.supportUntil).toBeNull();
    expect(off.history).toEqual([
      { date: TODAY, key: 'supportOff', params: { by: SARA } },
      ...on.history,
    ]);
    expect(supportActive(off, TODAY)).toBe(false);
  });

  it('turning it on again later moves the end date and adds a line', () => {
    const on = setSupport(weber(), true, SARA, TODAY);
    const again = setSupport(on, true, SARA, '2026-10-25');
    expect(again.supportUntil).toBe('2026-11-01');
    expect(again.history).toHaveLength(2);
  });
});

describe('a change that changes nothing', () => {
  it('a change that changes nothing returns the same business', () => {
    const business = weber();
    const withSupport = setSupport(business, true, SARA, TODAY);
    expect(setSupport(business, false, SARA, TODAY)).toBe(business);
    expect(setSupport(withSupport, true, SARA, TODAY)).toBe(withSupport);
    expect(invite(business, 'mia@example.com', 'full', 'wd-m4', SARA, TODAY)).toBe(business);
    expect(invite(business, 'nonsense', 'full', 'wd-m4', SARA, TODAY)).toBe(business);
    expect(resendInvite(business, 'wd-m1', TODAY)).toBe(business);
    expect(cancelInvite(business, 'nope', SARA, TODAY)).toBe(business);
    expect(acceptInvite(business, 'nope', 'Nobody', TODAY)).toBe(business);
    expect(changeRole(business, 'wd-m2', 'advisor', SARA, TODAY)).toBe(business);
    expect(removeMember(business, 'nope', SARA, TODAY)).toBe(business);
    expect(makeOwner(business, 'wd-m2', SARA, TODAY)).toBe(business);
    expect(leave(business, 'p99', TODAY)).toBe(business);
  });
});
