import type { Business, HistoryKey, Member, Role } from '../data/models';
import { addDays } from './dates';

// Who has access to a business, the invitations waiting, and our support team's access. Every rule returns the business
// it was given when it changes nothing (the state service relies on that to skip an update), and one that changes
// something adds exactly one line to the business's history. `by` is the full name of who did it, `today` an ISO date
// (never the real clock). Only the owner may invite, change, remove and hand over; the callers check that. These rules
// only keep the owner row safe: it is never changed, removed or left.

/** An invitation link works until this many days after the day it is sent (that last day included). */
export const INVITE_DAYS = 7;
/** Our support team can look until this many days after the day the owner lets it in (that last day included). */
export const SUPPORT_DAYS = 7;

/** The roles an invitation or a role change can give: everything but the owner. */
type GrantedRole = Exclude<Role, 'owner'>;

/** Why an email can't be invited: it isn't an address, it already has access, or it is already invited. */
export type InviteError = 'invalid' | 'hasAccess' | 'invited';

/** An email as every comparison reads it: without spaces around it, in lower case. */
export function normalEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Whether the text looks like an email address: something, an @, something, a dot, something. */
export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalEmail(email));
}

/** The joined row of a login in the business; a waiting invitation is nobody's row yet. */
export function memberOf(business: Business, personId: string): Member | undefined {
  return business.people.find((m) => m.status === 'joined' && m.personId === personId);
}

/** The login's role in the business, or null when it has no access. */
export function roleOf(business: Business, personId: string): Role | null {
  return memberOf(business, personId)?.role ?? null;
}

/** The business's owner; every business has exactly one. */
export function ownerOf(business: Business): Member {
  return business.people.find((m) => m.role === 'owner')!;
}

/** Whether this email can't be invited to the business, and why. Capitals and spaces around the address don't matter. */
export function inviteError(business: Business, email: string): InviteError | null {
  if (!isEmail(email)) return 'invalid';
  const address = normalEmail(email);
  const row = business.people.find((m) => normalEmail(m.email) === address);
  if (!row) return null;
  return row.status === 'joined' ? 'hasAccess' : 'invited';
}

/** Whether a waiting invitation's link has run out: it works through its last day. A joined row has no link to run out. */
export function isExpired(member: Member, today: string): boolean {
  return member.status === 'invited' && member.expiresOn !== null && member.expiresOn < today;
}

/** The name a history line uses for a row: a joined row has one, the email stands in when it doesn't. */
const nameOf = (member: Member): string => member.name ?? member.email;

const rowOf = (business: Business, memberId: string): Member | undefined =>
  business.people.find((m) => m.id === memberId);

/** A joined row that isn't the owner's: the only kind that can have its role changed or be removed. */
function editableRow(business: Business, memberId: string): Member | undefined {
  const row = rowOf(business, memberId);
  return row?.status === 'joined' && row.role !== 'owner' ? row : undefined;
}

/** The business with these people and one history line added at the front. */
function withLine(
  business: Business,
  people: Member[],
  key: HistoryKey,
  params: Record<string, string>,
  today: string,
): Business {
  return { ...business, people, history: [{ date: today, key, params }, ...business.history] };
}

const replaceRow = (business: Business, row: Member): Member[] =>
  business.people.map((m) => (m.id === row.id ? row : m));

/** Adds a waiting invitation for the email (stored without capitals or spaces) whose link works for `INVITE_DAYS`. Refused when `inviteError` finds a reason. */
export function invite(
  business: Business,
  email: string,
  role: GrantedRole,
  id: string,
  by: string,
  today: string,
): Business {
  if (inviteError(business, email) !== null) return business;
  const address = normalEmail(email);
  const row: Member = {
    id,
    personId: null,
    name: null,
    email: address,
    role,
    status: 'invited',
    invitedOn: today,
    expiresOn: addDays(today, INVITE_DAYS),
    joinedOn: null,
  };
  return withLine(
    business,
    [...business.people, row],
    'personInvited',
    { email: address, role, by },
    today,
  );
}

/** Gives a waiting invitation (a run-out one too) a fresh link of `INVITE_DAYS`; adds no line. */
export function resendInvite(business: Business, memberId: string, today: string): Business {
  const row = rowOf(business, memberId);
  const expiresOn = addDays(today, INVITE_DAYS);
  if (row?.status !== 'invited' || row.expiresOn === expiresOn) return business;
  return { ...business, people: replaceRow(business, { ...row, expiresOn }) };
}

/** Takes a waiting invitation back. */
export function cancelInvite(
  business: Business,
  memberId: string,
  by: string,
  today: string,
): Business {
  const row = rowOf(business, memberId);
  if (row?.status !== 'invited') return business;
  return withLine(
    business,
    business.people.filter((m) => m !== row),
    'invitationCancelled',
    { email: row.email, by },
    today,
  );
}

/** The invited person joins under the name they gave, who then is also the one who did it. Ignored for an unknown, joined or run-out invitation. */
export function acceptInvite(
  business: Business,
  memberId: string,
  name: string,
  today: string,
): Business {
  const row = rowOf(business, memberId);
  if (row?.status !== 'invited' || isExpired(row, today)) return business;
  const joined: Member = { ...row, name, status: 'joined', expiresOn: null, joinedOn: today };
  return withLine(
    business,
    replaceRow(business, joined),
    'personJoined',
    { name, role: row.role, by: name },
    today,
  );
}

/** Gives a joined person (not the owner) another role. */
export function changeRole(
  business: Business,
  memberId: string,
  role: GrantedRole,
  by: string,
  today: string,
): Business {
  const row = editableRow(business, memberId);
  if (!row || row.role === role) return business;
  return withLine(
    business,
    replaceRow(business, { ...row, role }),
    'roleChanged',
    { name: nameOf(row), role, by },
    today,
  );
}

/** Takes a joined person (not the owner) out of the business. A waiting invitation is taken back with `cancelInvite`. */
export function removeMember(
  business: Business,
  memberId: string,
  by: string,
  today: string,
): Business {
  const row = editableRow(business, memberId);
  if (!row) return business;
  return withLine(
    business,
    business.people.filter((m) => m !== row),
    'personRemoved',
    { name: nameOf(row), by },
    today,
  );
}

/** Hands the business to a joined person with full access; the owner becomes a person with full access. Nobody else can be handed it, a tax advisor included. */
export function makeOwner(
  business: Business,
  memberId: string,
  by: string,
  today: string,
): Business {
  const row = rowOf(business, memberId);
  if (row?.status !== 'joined' || row.role !== 'full') return business;
  const people = business.people.map((m): Member => {
    if (m === row) return { ...m, role: 'owner' };
    return m.role === 'owner' ? { ...m, role: 'full' } : m;
  });
  return withLine(business, people, 'ownerChanged', { name: nameOf(row), by }, today);
}

/** A login leaves the business; its own name is the one who did it. The owner can't leave: they hand the business over first. */
export function leave(business: Business, personId: string, today: string): Business {
  const row = memberOf(business, personId);
  if (!row || row.role === 'owner') return business;
  const name = nameOf(row);
  return withLine(
    business,
    business.people.filter((m) => m !== row),
    'personLeft',
    { name, by: name },
    today,
  );
}

/** Lets our support team look for `SUPPORT_DAYS` from today, or stops it. */
export function setSupport(business: Business, on: boolean, by: string, today: string): Business {
  if (on) {
    const until = addDays(today, SUPPORT_DAYS);
    if (business.supportUntil === until) return business;
    return {
      ...business,
      supportUntil: until,
      history: [{ date: today, key: 'supportOn', params: { until, by } }, ...business.history],
    };
  }
  if (business.supportUntil === null) return business;
  return {
    ...business,
    supportUntil: null,
    history: [{ date: today, key: 'supportOff', params: { by } }, ...business.history],
  };
}

/** Whether our support team can look at the books today: its last day is included. */
export function supportActive(business: Business, today: string): boolean {
  return business.supportUntil !== null && business.supportUntil >= today;
}
