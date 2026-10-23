import { TRAVEL } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { PoolResult } from '../data/models';
import { UPLOAD_POOLS } from '../data/sample-documents';
import { docStatus } from './document-status';
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  READING_MS,
  applyReadResult,
  checkFile,
  newReadingDoc,
  nextPoolResult,
} from './document-upload';

const weberPool = UPLOAD_POOLS['weber-design'];

describe('the limits', () => {
  it('allow 20 MB per file and show Reading… for two seconds', () => {
    expect(MAX_FILE_BYTES).toBe(20 * 1024 * 1024);
    expect(READING_MS).toBe(2000);
  });
});

describe('ACCEPT_ATTRIBUTE', () => {
  it('lists exactly the extensions checkFile accepts, for the file picker', () => {
    const extensions = ACCEPT_ATTRIBUTE.split(',');
    expect(extensions).toEqual(['.pdf', '.jpg', '.jpeg', '.png', '.xml']);
    for (const extension of extensions) {
      expect(checkFile({ name: `scan${extension}`, size: 1000 })).toBeNull();
    }
  });
});

describe('checkFile', () => {
  it('refuses a type that is not accepted', () => {
    expect(checkFile({ name: 'notes.docx', size: 1000 })).toBe('type');
  });

  it('refuses a file over 20 MB, whatever the case of its extension', () => {
    expect(checkFile({ name: 'scan.PDF', size: 25 * 1024 * 1024 })).toBe('size');
  });

  it('accepts an e-invoice', () => {
    expect(checkFile({ name: 'beleg.xml', size: 1000 })).toBeNull();
  });

  it('accepts .pdf .jpg .jpeg .png and .xml in any case', () => {
    for (const name of ['a.pdf', 'a.JPG', 'a.Jpeg', 'a.PNG', 'a.xml', 'A.PDF']) {
      expect(checkFile({ name, size: 1000 })).toBeNull();
    }
  });

  it('accepts exactly 20 MB and refuses one byte more', () => {
    expect(checkFile({ name: 'a.pdf', size: MAX_FILE_BYTES })).toBeNull();
    expect(checkFile({ name: 'a.pdf', size: MAX_FILE_BYTES + 1 })).toBe('size');
  });

  it('only the end of the name counts', () => {
    expect(checkFile({ name: 'report.pdf.zip', size: 1000 })).toBe('type');
    expect(checkFile({ name: 'pdf', size: 1000 })).toBe('type');
  });

  it('names the type first when a file is both the wrong type and too big', () => {
    expect(checkFile({ name: 'video.mov', size: 25 * 1024 * 1024 })).toBe('type');
  });
});

describe('nextPoolResult', () => {
  it('hands the entries out in order', () => {
    expect(weberPool.map((_, i) => nextPoolResult(weberPool, i))).toEqual(weberPool);
  });

  it('past the end repeats only plain receipts', () => {
    const plain = weberPool.filter((r) => r.plain);
    const later = Array.from({ length: 7 }, (_, i) =>
      nextPoolResult(weberPool, weberPool.length + i),
    );
    expect(later.every((r) => r.plain)).toBe(true);
    expect(later.map((r) => r.name)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((i) => plain[i % plain.length].name),
    );
  });

  it('every business pool repeats plain receipts after its last entry', () => {
    for (const pool of Object.values(UPLOAD_POOLS)) {
      for (let i = pool.length; i < pool.length + 5; i++)
        expect(nextPoolResult(pool, i).plain).toBe(true);
    }
  });
});

describe('newReadingDoc', () => {
  it('is a document that is still being read, with nothing known yet', () => {
    expect(newReadingDoc('up-1', 'scan.pdf', 'file')).toEqual({
      id: 'up-1',
      fileName: 'scan.pdf',
      source: 'file',
      addedOn: DEMO_TODAY,
      fromUpload: true,
      reading: true,
      name: null,
      direction: null,
      invoiceNo: '',
      date: null,
      dueDate: null,
      amountCents: null,
      vatRate: 0,
      duplicateOf: null,
      booking: null,
      bookingConfirmed: false,
      paymentId: null,
      history: [{ date: DEMO_TODAY, key: 'addedFile', params: {} }],
      invoice: null,
    });
  });

  it('shows Reading… as its status', () => {
    expect(docStatus(newReadingDoc('up-1', 'scan.pdf', 'file'))).toBe('reading');
  });

  it('writes the history line that matches how the file came in', () => {
    expect(newReadingDoc('up-1', 'IMG_1.jpg', 'photo').history.map((h) => h.key)).toEqual([
      'addedPhoto',
    ]);
    expect(newReadingDoc('up-2', 'scan.pdf', 'file').history.map((h) => h.key)).toEqual([
      'addedFile',
    ]);
    expect(newReadingDoc('up-3', 'mail.pdf', 'email').history.map((h) => h.key)).toEqual([
      'addedEmail',
    ]);
  });
});

describe('applyReadResult', () => {
  const reading = newReadingDoc('up-1', 'ticket.pdf', 'photo');
  const [bahn, telekom, krause, copyshop] = weberPool;

  it('fills in what reading found and stops reading', () => {
    const read = applyReadResult(reading, bahn);
    expect(read).toMatchObject({
      reading: false,
      name: 'Deutsche Bahn',
      direction: 'received',
      invoiceNo: '8841',
      date: '2026-10-17',
      dueDate: null,
      amountCents: 12000,
      vatRate: bahn.vatRate,
      duplicateOf: null,
      booking: TRAVEL,
      bookingConfirmed: false,
      paymentId: null,
      id: 'up-1',
      fileName: 'ticket.pdf',
      source: 'photo',
      fromUpload: true,
    });
  });

  it('does not copy the pool-only flag into the document', () => {
    expect(applyReadResult(reading, copyshop)).not.toHaveProperty('plain');
  });

  it('adds a docRead line with the booking category in front of the added line', () => {
    expect(applyReadResult(reading, bahn).history).toEqual([
      { date: DEMO_TODAY, key: 'docRead', params: { category: TRAVEL.labelKey } },
      { date: DEMO_TODAY, key: 'addedPhoto', params: {} },
    ]);
  });

  it('leaves the docRead line out when reading found no booking', () => {
    const noBooking: PoolResult = { ...copyshop, booking: null };
    const read = applyReadResult(reading, noBooking);
    expect(read.booking).toBeNull();
    expect(read.history.map((h) => h.key)).toEqual(['addedPhoto']);
  });

  it('does not change the document it was given', () => {
    const before = structuredClone(reading);
    applyReadResult(reading, bahn);
    expect(reading).toEqual(before);
  });

  it('gives the status the result calls for', () => {
    expect(docStatus(applyReadResult(reading, copyshop))).toBe('waiting');
    expect(docStatus(applyReadResult(reading, telekom))).toBe('duplicate');
    expect(docStatus(applyReadResult(reading, krause))).toBe('direction');
  });
});
