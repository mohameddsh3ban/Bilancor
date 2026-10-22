import { DEMO_TODAY } from '../data/demo-date';
import type { Account, AccountConnection } from '../data/models';
import { BANKS } from '../data/banks';
import { BUSINESSES } from '../data/sample-data';
import {
  CONSENT_DAYS,
  addDays,
  bankInitials,
  bankNotices,
  connectionStatus,
  isAlreadyConnected,
  maskIban,
  newConnection,
  noConnection,
} from './bank-connection';

const accountsOf = (businessId: string): Account[] => BUSINESSES.find((b) => b.id === businessId)!.accounts;
const qonto = accountsOf('weber-design').find((a) => a.id === 'wd-qonto')!;

/** The Weber Design Qonto account with its connection changed. */
function connection(change: Partial<AccountConnection>): Account {
  return { ...qonto, connection: { ...qonto.connection, ...change } };
}

describe('connectionStatus', () => {
  it('a consent that ends in 5 days is renewSoon with 5 days left', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-10-27' }))).toEqual({ kind: 'renewSoon', daysLeft: 5 });
  });

  it('a consent that ends in 14 days is still renewSoon (the 14th day counts)', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-11-05' }))).toEqual({ kind: 'renewSoon', daysLeft: 14 });
  });

  it('a consent that ends in 15 days is connected', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-11-06' }))).toEqual({ kind: 'connected' });
  });

  it('a consent that ends today is renewSoon with 0 days left, not ended yet', () => {
    expect(connectionStatus(connection({ consentUntil: DEMO_TODAY }))).toEqual({ kind: 'renewSoon', daysLeft: 0 });
  });

  it('a consent that ended yesterday means sign in again', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-10-21' }))).toEqual({ kind: 'signInAgain' });
  });

  it('a connection the bank reports as broken means sign in again, however long the consent still runs', () => {
    expect(connectionStatus(connection({ consentUntil: '2027-04-01', broken: true }))).toEqual({ kind: 'signInAgain' });
  });

  it('counts the days across a month and a year end from the day it is given, not the demo day', () => {
    const account = connection({ consentUntil: '2027-01-03' });
    expect(connectionStatus(account, '2026-12-30')).toEqual({ kind: 'renewSoon', daysLeft: 4 });
    expect(connectionStatus(account, '2026-12-20')).toEqual({ kind: 'renewSoon', daysLeft: 14 });
    expect(connectionStatus(account, '2026-12-19')).toEqual({ kind: 'connected' });
    expect(connectionStatus(account, '2027-01-04')).toEqual({ kind: 'signInAgain' });
  });

  it('a connected account with no consent date has nothing that ends', () => {
    expect(connectionStatus(connection({ consentUntil: null }))).toEqual({ kind: 'connected' });
  });

  it('a statement account is statement, and a cash box is cash, whatever else its connection says', () => {
    const sparkasse = accountsOf('cafe-linde').find((a) => a.id === 'cl-sparkasse')!;
    const cash = accountsOf('weber-design').find((a) => a.id === 'wd-cash')!;
    expect(connectionStatus(sparkasse)).toEqual({ kind: 'statement' });
    expect(connectionStatus(cash)).toEqual({ kind: 'cash' });
    const broken = { ...sparkasse, connection: { ...sparkasse.connection, broken: true, consentUntil: '2026-10-01' } };
    expect(connectionStatus(broken)).toEqual({ kind: 'statement' });
  });

  it('the sample accounts show every status the demo promises', () => {
    const status = (businessId: string, accountId: string) =>
      connectionStatus(accountsOf(businessId).find((a) => a.id === accountId)!);
    expect(status('weber-design', 'wd-qonto')).toEqual({ kind: 'renewSoon', daysLeft: 5 });
    expect(status('sara-yoga', 'sy-qonto')).toEqual({ kind: 'signInAgain' });
    expect(status('cafe-linde', 'cl-qonto')).toEqual({ kind: 'connected' });
    expect(status('cafe-linde', 'cl-sparkasse')).toEqual({ kind: 'statement' });
    expect(status('cafe-linde', 'cl-cash')).toEqual({ kind: 'cash' });
  });
});

describe('bankNotices', () => {
  it('Weber Design gets one notice: its Qonto connection expires in 5 days', () => {
    expect(bankNotices(accountsOf('weber-design'))).toEqual([
      {
        id: 'bank-expiry-wd-qonto',
        kind: 'bankExpiry',
        urgency: 2,
        blocking: false,
        params: { bank: 'Qonto', days: 5 },
        date: DEMO_TODAY,
      },
    ]);
  });

  it('Sara Weber Yoga gets one notice: its Qonto connection has ended', () => {
    expect(bankNotices(accountsOf('sara-yoga'))).toEqual([
      {
        id: 'bank-ended-sy-qonto',
        kind: 'bankEnded',
        urgency: 1,
        blocking: false,
        params: { bank: 'Qonto' },
        date: DEMO_TODAY,
      },
    ]);
  });

  it('Café Linde gets none: one connection with months left, a statement account and a cash box', () => {
    expect(bankNotices(accountsOf('cafe-linde'))).toEqual([]);
  });

  it('a broken connection with a long consent gets the "ended" notice', () => {
    const [notice] = bankNotices([connection({ consentUntil: '2027-04-01', broken: true })]);
    expect(notice).toMatchObject({ id: 'bank-ended-wd-qonto', kind: 'bankEnded', params: { bank: 'Qonto' } });
  });

  it('gives each account its own notice, with the bank name and days of that account', () => {
    const other: Account = { ...connection({ consentUntil: '2026-11-02' }), id: 'wd-other', name: 'N26' };
    const notices = bankNotices([qonto, other, accountsOf('weber-design')[1]]);
    expect(notices.map((n) => [n.id, n.params])).toEqual([
      ['bank-expiry-wd-qonto', { bank: 'Qonto', days: 5 }],
      ['bank-expiry-wd-other', { bank: 'N26', days: 11 }],
    ]);
  });

  it('counts the days from the day it is given and dates the notice that day', () => {
    const [notice] = bankNotices([qonto], '2026-10-20');
    expect(notice).toMatchObject({ kind: 'bankExpiry', params: { bank: 'Qonto', days: 7 }, date: '2026-10-20' });
  });

  it('no notice for no accounts, and the accounts it is given stay as they are', () => {
    expect(bankNotices([])).toEqual([]);
    const accounts = structuredClone(accountsOf('weber-design'));
    bankNotices(accounts);
    expect(accounts).toEqual(accountsOf('weber-design'));
  });
});

describe('maskIban', () => {
  it('keeps the first 4 and the last 4 characters', () => {
    expect(maskIban('DE89370400440532013000')).toBe('DE89 … 3000');
  });

  it('reads an IBAN that is written in groups the same way', () => {
    expect(maskIban('DE89 3704 0044 0532 0130 00')).toBe('DE89 … 3000');
  });

  it('masks every sample IBAN, so none of the middle shows', () => {
    for (const business of BUSINESSES) {
      for (const account of business.accounts) {
        if (account.iban === null) continue;
        const masked = maskIban(account.iban);
        expect(masked).toBe(`${account.iban.slice(0, 4)} … ${account.iban.slice(-4)}`);
        expect(masked.length).toBe(11);
      }
    }
  });
});

describe('addDays', () => {
  it('adds days to an ISO date, across a month and a year end', () => {
    expect(addDays('2026-10-22', 5)).toBe('2026-10-27');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-10-22', 0)).toBe(DEMO_TODAY);
  });

  it('goes through a leap day without a zone or the clock getting in the way', () => {
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('counts back with a negative number', () => {
    expect(addDays('2026-10-22', -22)).toBe('2026-09-30');
  });
});

describe('newConnection', () => {
  it('is a bank connection with a consent of 180 days from the demo day, fetched at noon that day', () => {
    expect(CONSENT_DAYS).toBe(180);
    expect(newConnection('2026-01-01')).toEqual({
      kind: 'connected',
      consentUntil: '2027-04-20',
      lastFetched: '2026-10-22T12:00',
      fetchFrom: '2026-01-01',
      broken: false,
    });
  });

  it('counts from the day it is given', () => {
    expect(newConnection('2025-01-01', '2026-12-31')).toMatchObject({
      consentUntil: '2027-06-29',
      lastFetched: '2026-12-31T12:00',
      fetchFrom: '2025-01-01',
    });
  });

  it('is a healthy connection for the whole 180 days', () => {
    const account = { ...qonto, connection: newConnection('2026-01-01') };
    expect(connectionStatus(account)).toEqual({ kind: 'connected' });
    expect(connectionStatus(account, addDays(DEMO_TODAY, CONSENT_DAYS - 15))).toEqual({ kind: 'connected' });
    expect(connectionStatus(account, addDays(DEMO_TODAY, CONSENT_DAYS - 14))).toEqual({ kind: 'renewSoon', daysLeft: 14 });
  });

  it('gives a new object every time', () => {
    expect(newConnection('2026-01-01')).not.toBe(newConnection('2026-01-01'));
  });
});

describe('noConnection', () => {
  it('is a statement or cash connection with nothing that ends and nothing fetched', () => {
    expect(noConnection('statement')).toEqual({ kind: 'statement', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false });
    expect(noConnection('cash')).toEqual({ kind: 'cash', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false });
  });
});

describe('isAlreadyConnected', () => {
  it('is true for a bank connection once the bank step is done', () => {
    expect(isAlreadyConnected(qonto, true)).toBe(true);
  });

  it('is false while the bank step is not done: the demo account is there, the person has not connected it yet', () => {
    expect(isAlreadyConnected(qonto, false)).toBe(false);
  });

  it('is false for a statement account, a cash box and an account that is not there', () => {
    expect(isAlreadyConnected({ ...qonto, connection: noConnection('statement') }, true)).toBe(false);
    expect(isAlreadyConnected({ ...qonto, connection: noConnection('cash') }, true)).toBe(false);
    expect(isAlreadyConnected(undefined, true)).toBe(false);
  });

  it('is true for a connection that ended or broke: Renew does that, not connecting again', () => {
    expect(isAlreadyConnected(connection({ consentUntil: '2026-10-01' }), true)).toBe(true);
    expect(isAlreadyConnected(connection({ broken: true }), true)).toBe(true);
  });
});

describe('bankInitials', () => {
  it('takes the first letter of two words, or of the two parts of a joined name', () => {
    expect(bankInitials('Deutsche Bank')).toBe('DB');
    expect(bankInitials('HypoVereinsbank')).toBe('HV');
  });

  it('takes the first two letters of a single name, in capitals', () => {
    expect(bankInitials('Sparkasse')).toBe('SP');
    expect(bankInitials('ING')).toBe('IN');
    expect(bankInitials('N26')).toBe('N2');
    expect(bankInitials('Qonto')).toBe('QO');
  });

  it('is two characters for every bank of the picker, and different for most', () => {
    const initials = BANKS.map((bank) => bankInitials(bank.name));
    for (const value of initials) expect(value).toMatch(/^[A-Z0-9]{2}$/);
    expect(new Set(initials).size).toBe(BANKS.length);
  });

  it('copes with a short or empty name', () => {
    expect(bankInitials('X')).toBe('X');
    expect(bankInitials('')).toBe('');
    expect(bankInitials('  Volks   Bank ')).toBe('VB');
  });
});
