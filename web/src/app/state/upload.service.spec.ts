import { TestBed } from '@angular/core/testing';
import type { Doc, Transaction } from '../data/models';
import { docNeedsYou, docStatus } from '../domain/document-status';
import { READING_MS } from '../domain/document-upload';
import { paymentStatus } from '../domain/payment-status';
import { DemoStateService } from './demo-state.service';
import { UploadService } from './upload.service';

/** A file as the browser hands it over; only its name and size matter here. */
function file(name: string, size = 1000): File {
  return Object.defineProperty(new File(['x'], name), 'size', { value: size });
}

const MB_25 = 25 * 1024 * 1024;

describe('UploadService', () => {
  let demo: DemoStateService;
  let upload: UploadService;

  const docsOf = (businessId: string): Doc[] =>
    demo.businesses.find((b) => b.id === businessId)!.documents;
  const uploadsOf = (businessId: string): Doc[] => docsOf(businessId).filter((d) => d.fromUpload);
  const paymentOf = (id: string): Transaction =>
    demo.business().transactions.find((t) => t.id === id)!;
  const upload1 = (): Doc => docsOf('weber-design').find((d) => d.id === 'up-1')!;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    demo = TestBed.inject(DemoStateService);
    upload = TestBed.inject(UploadService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a file reads in two seconds and takes the first pool result', () => {
    upload.add([file('scan.pdf')], 'file');
    expect(docsOf('weber-design')[0]).toMatchObject({
      id: 'up-1',
      fileName: 'scan.pdf',
      fromUpload: true,
      reading: true,
      name: null,
    });

    vi.advanceTimersByTime(READING_MS - 1);
    expect(upload1().reading).toBe(true);

    vi.advanceTimersByTime(1);
    expect(upload1()).toMatchObject({
      reading: false,
      name: 'Deutsche Bahn',
      invoiceNo: '8841',
      amountCents: 12000,
      bookingConfirmed: false,
    });
  });

  it('the next files take the next pool results in order', () => {
    upload.add([file('a.pdf'), file('b.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);
    expect(docsOf('weber-design').find((d) => d.id === 'up-1')!.name).toBe('Deutsche Bahn');
    expect(docsOf('weber-design').find((d) => d.id === 'up-2')!.name).toBe('Telekom');
  });

  it('a photo and a file each write their own added line', () => {
    upload.add([file('IMG_1.jpg')], 'photo');
    expect(upload1()).toMatchObject({ source: 'photo', history: [{ key: 'addedPhoto' }] });
    upload.add([file('scan.pdf')], 'file');
    expect(docsOf('weber-design')[0]).toMatchObject({
      id: 'up-2',
      source: 'file',
      history: [{ key: 'addedFile' }],
    });
  });

  it('the Deutsche Bahn upload links itself to wd-t3', () => {
    expect(paymentStatus(paymentOf('wd-t3'))).not.toBe('booked');

    upload.add([file('ticket.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);

    expect(paymentOf('wd-t3')).toMatchObject({ receipt: 'attached', receiptFile: 'ticket.pdf' });
    expect(paymentStatus(paymentOf('wd-t3'))).toBe('booked');
    expect(upload1().paymentId).toBe('wd-t3');
    expect(upload1().history[0].key).toBe('linkedAuto');
    expect(paymentOf('wd-t3').history[0].key).toBe('receiptLinkedAuto');
  });

  it('a possible duplicate does not link itself to the payment of the document it looks like', () => {
    demo.unlink('doc-wd-t2');
    expect(paymentOf('wd-t2').receipt).toBe('missing');

    upload.add([file('a.pdf'), file('b.pdf')], 'file'); // Deutsche Bahn, then the Telekom duplicate
    vi.advanceTimersByTime(READING_MS);

    expect(docsOf('weber-design').find((d) => d.id === 'up-2')).toMatchObject({
      name: 'Telekom',
      duplicateOf: 'doc-wd-t2',
      paymentId: null,
    });
    expect(paymentOf('wd-t2').receipt).toBe('missing');
    expect(upload1().paymentId).toBe('wd-t3');
  });

  it('a file that does not surely match any payment is not linked', () => {
    upload.add([file('a.pdf'), file('b.pdf'), file('c.pdf'), file('d.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);
    expect(docsOf('weber-design').find((d) => d.id === 'up-4')).toMatchObject({
      name: 'Copyshop Mitte',
      paymentId: null,
    });
  });

  it('refused files are named with their reason', () => {
    upload.add(
      [file('notes.docx'), file('scan.PDF', MB_25), file('rechnung.pdf'), file('foto.jpg')],
      'file',
    );

    expect(upload.summary()!.refused).toEqual([
      { name: 'notes.docx', reason: 'type' },
      { name: 'scan.PDF', reason: 'size' },
    ]);
    expect(
      uploadsOf('weber-design')
        .map((d) => d.fileName)
        .sort(),
    ).toEqual(['foto.jpg', 'rechnung.pdf']);
  });

  it('a drop of refused files only adds nothing and says so at once', () => {
    upload.add([file('notes.docx')], 'file');
    expect(upload.summary()).toEqual({
      added: 0,
      needsYou: 0,
      refused: [{ name: 'notes.docx', reason: 'type' }],
    });
    expect(uploadsOf('weber-design')).toEqual([]);
    vi.runAllTimers();
    expect(upload.summary()).toEqual({
      added: 0,
      needsYou: 0,
      refused: [{ name: 'notes.docx', reason: 'type' }],
    });
  });

  it('the summary keeps the refused files and counts added and needs-you once the whole batch is read', () => {
    upload.add([file('a.pdf'), file('notes.docx')], 'file');
    expect(upload.summary()).toEqual({
      added: 0,
      needsYou: 0,
      refused: [{ name: 'notes.docx', reason: 'type' }],
    });
    vi.advanceTimersByTime(READING_MS);
    expect(upload.summary()).toEqual({
      added: 1,
      needsYou: 0,
      refused: [{ name: 'notes.docx', reason: 'type' }],
    });
  });

  it('summary counts added and needs-you after reading', () => {
    upload.add([file('a.pdf'), file('b.pdf'), file('c.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);
    // Deutsche Bahn links itself; the Telekom duplicate and the Krause direction wait for the person.
    expect(upload.summary()).toEqual({ added: 3, needsYou: 2, refused: [] });
    expect(uploadsOf('weber-design').filter(docNeedsYou)).toHaveLength(2);
  });

  it('a result lands in the business it was added to', () => {
    upload.add([file('ticket.pdf')], 'file');
    demo.setBusiness('sara-yoga');
    vi.advanceTimersByTime(READING_MS);

    expect(docsOf('weber-design').find((d) => d.id === 'up-1')).toMatchObject({
      reading: false,
      name: 'Deutsche Bahn',
      paymentId: 'wd-t3',
    });
    expect(uploadsOf('sara-yoga')).toEqual([]);
    expect(demo.documents().some((d) => d.fromUpload)).toBe(false);
    expect(
      demo.businesses
        .find((b) => b.id === 'weber-design')!
        .transactions.find((t) => t.id === 'wd-t3')!.receipt,
    ).toBe('attached');
  });

  it('reset while reading drops the pending result', () => {
    upload.add([file('a.pdf'), file('b.pdf')], 'file');
    demo.resetData();
    expect(() => vi.advanceTimersByTime(READING_MS)).not.toThrow();

    expect(uploadsOf('weber-design')).toEqual([]);
    expect(paymentOf('wd-t3').receipt).toBe('missing');
    expect(upload.summary()).toBeNull();
  });

  it('Reset demo clears the summary, whether the drop was read or is still being read', () => {
    upload.add([file('a.pdf'), file('notes.docx')], 'file');
    expect(upload.summary()).not.toBeNull();
    demo.resetData();
    expect(upload.summary()).toBeNull();

    upload.add([file('b.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);
    expect(upload.summary()).toEqual({ added: 1, needsYou: 0, refused: [] });
    demo.resetData();
    expect(upload.summary()).toBeNull();
  });

  it('a drop added after a reset shows its own summary', () => {
    demo.resetData();
    upload.add([file('notes.docx')], 'file');
    expect(upload.summary()).toEqual({
      added: 0,
      needsYou: 0,
      refused: [{ name: 'notes.docx', reason: 'type' }],
    });
  });

  it('a file added after a reset reads normally and the pool starts over', () => {
    upload.add([file('a.pdf'), file('b.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);
    demo.resetData();

    upload.add([file('c.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);

    expect(uploadsOf('weber-design')).toHaveLength(1);
    expect(uploadsOf('weber-design')[0]).toMatchObject({
      id: 'up-3',
      reading: false,
      name: 'Deutsche Bahn',
    });
    expect(upload.summary()).toEqual({ added: 1, needsYou: 0, refused: [] });
  });

  it('ids never repeat, even after a reset', () => {
    upload.add([file('a.pdf')], 'file');
    demo.resetData();
    upload.add([file('b.pdf')], 'file');
    expect(uploadsOf('weber-design').map((d) => d.id)).toEqual(['up-2']);
  });

  it('each business has its own pool position', () => {
    upload.add([file('a.pdf')], 'file');
    demo.setBusiness('sara-yoga');
    upload.add([file('b.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);

    expect(uploadsOf('sara-yoga')).toHaveLength(1);
    expect(uploadsOf('sara-yoga')[0].name).toBe('Yogashop Berlin');
    expect(uploadsOf('weber-design')[0].name).toBe('Deutsche Bahn');
  });

  it('after the last pool entry the receipts repeat and need nothing from the person', () => {
    const files = Array.from({ length: 7 }, (_, i) => file(`r${i}.pdf`));
    upload.add(files, 'file');
    vi.advanceTimersByTime(READING_MS);
    const tail = ['up-6', 'up-7'].map((id) => docsOf('weber-design').find((d) => d.id === id)!);
    expect(tail.map((d) => d.name)).toEqual(['Copyshop Mitte', 'Parkhaus Alexa']);
    expect(tail.some(docNeedsYou)).toBe(false);
  });

  it('in the new-client state an upload is never linked', () => {
    demo.setSetup('new');
    upload.add([file('ticket.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);

    expect(upload1()).toMatchObject({ reading: false, name: 'Deutsche Bahn', paymentId: null });
    expect(paymentOf('wd-t3').receipt).toBe('missing');
    expect(upload.summary()).toEqual({ added: 1, needsYou: 0, refused: [] });
  });

  it('a new drop replaces the summary, and the batch before it does not bring its own back', () => {
    upload.add([file('a.pdf'), file('b.pdf')], 'file');
    vi.advanceTimersByTime(1000);

    upload.add([file('c.pdf')], 'file');
    expect(upload.summary()).toEqual({ added: 0, needsYou: 0, refused: [] });

    vi.advanceTimersByTime(1000); // the first batch is read now
    expect(upload.summary()).toEqual({ added: 0, needsYou: 0, refused: [] });

    vi.advanceTimersByTime(1000); // the second is
    expect(upload.summary()).toEqual({ added: 1, needsYou: 1, refused: [] });
  });

  it('the summary belongs to the business it was added to', () => {
    upload.add([file('a.pdf'), file('b.pdf'), file('c.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);
    expect(upload.summary()).toEqual({ added: 3, needsYou: 2, refused: [] });

    demo.setBusiness('sara-yoga');
    expect(upload.summary()).toBeNull();

    demo.setBusiness('weber-design');
    expect(upload.summary()).toEqual({ added: 3, needsYou: 2, refused: [] });
  });

  it('a summary still being read does not show in another business either, and each business gets its own after a new drop', () => {
    upload.add([file('notes.docx'), file('a.pdf')], 'file');
    demo.setBusiness('sara-yoga');
    expect(upload.summary()).toBeNull();

    upload.add([file('b.pdf')], 'file');
    expect(upload.summary()).toEqual({ added: 0, needsYou: 0, refused: [] });
    vi.advanceTimersByTime(READING_MS);
    expect(upload.summary()).toEqual({ added: 1, needsYou: 0, refused: [] });

    demo.setBusiness('weber-design');
    expect(upload.summary()).toBeNull(); // the newer drop replaced the first one, and it belongs to Sara
  });

  it('clearSummary removes the summary and a batch still reading does not bring it back', () => {
    upload.add([file('a.pdf')], 'file');
    upload.clearSummary();
    expect(upload.summary()).toBeNull();
    vi.advanceTimersByTime(READING_MS);
    expect(upload.summary()).toBeNull();
    expect(upload1().reading).toBe(false);
  });

  it('adding no files changes nothing', () => {
    upload.add([file('a.pdf')], 'file');
    vi.advanceTimersByTime(READING_MS);
    const summary = upload.summary();
    const documents = demo.documents();

    upload.add([], 'file');
    expect(upload.summary()).toBe(summary);
    expect(demo.documents()).toBe(documents);
  });

  it('a document removed while it is still reading is skipped', () => {
    upload.add([file('a.pdf'), file('b.pdf')], 'file');
    demo.removeDocument('up-1');
    expect(() => vi.advanceTimersByTime(READING_MS)).not.toThrow();

    expect(uploadsOf('weber-design').map((d) => d.id)).toEqual(['up-2']);
    expect(paymentOf('wd-t3').receipt).toBe('missing');
    expect(upload.summary()).toEqual({ added: 1, needsYou: 1, refused: [] });
  });

  describe('addPhotoFor', () => {
    it('photo for wd-t3 links a new Done document after READING_MS', async () => {
      expect(paymentStatus(paymentOf('wd-t3'))).toBe('noReceipt');
      expect(upload.readingFor()).toBeNull();

      const outcome = upload.addPhotoFor('wd-t3');
      expect(upload.readingFor()).toBe('wd-t3');
      expect(upload1()).toMatchObject({
        fileName: 'photo-2026-10-22-1.jpg',
        source: 'photo',
        fromUpload: true,
        reading: true,
        paymentId: null,
      });
      expect(paymentStatus(paymentOf('wd-t3'))).toBe('noReceipt');

      vi.advanceTimersByTime(READING_MS - 1);
      expect(upload1().reading).toBe(true);
      expect(upload.readingFor()).toBe('wd-t3');

      vi.advanceTimersByTime(1);
      await expect(outcome).resolves.toBe('linked');
      expect(upload.readingFor()).toBeNull();
      expect(upload1()).toMatchObject({
        reading: false,
        name: 'Deutsche Bahn',
        direction: 'received',
        amountCents: 12000,
        date: '2026-10-17',
        duplicateOf: null,
        paymentId: 'wd-t3',
      });
      expect(docStatus(upload1())).toBe('done');
      expect(paymentOf('wd-t3')).toMatchObject({
        receipt: 'attached',
        receiptFile: 'photo-2026-10-22-1.jpg',
      });
      expect(paymentStatus(paymentOf('wd-t3'))).toBe('booked');
      const docKeys = upload1().history.map((h) => h.key);
      expect(docKeys[0]).toBe('linked');
      expect(docKeys.at(-1)).toBe('addedPhoto');
      expect(paymentOf('wd-t3').history[0].key).toBe('receiptLinked');
    });

    it("photo doesn't move the upload pool", async () => {
      const first = upload.addPhotoFor('wd-t3');
      const second = upload.addPhotoFor('wd-t17');
      vi.advanceTimersByTime(READING_MS);
      await expect(Promise.all([first, second])).resolves.toEqual(['linked', 'linked']);

      upload.add([file('ticket.pdf')], 'file');
      vi.advanceTimersByTime(READING_MS);
      expect(docsOf('weber-design').find((d) => d.id === 'up-3')).toMatchObject({
        name: 'Deutsche Bahn',
        invoiceNo: '8841',
        amountCents: 12000,
      });
    });

    it('photos are numbered through the session, one number each', async () => {
      const first = upload.addPhotoFor('wd-t3');
      const second = upload.addPhotoFor('wd-t17');
      const fileName = (id: string) => docsOf('weber-design').find((d) => d.id === id)!.fileName;
      expect(fileName('up-1')).toBe('photo-2026-10-22-1.jpg');
      expect(fileName('up-2')).toBe('photo-2026-10-22-2.jpg');
      vi.advanceTimersByTime(READING_MS);
      await Promise.all([first, second]);
    });

    it('reset during reading drops it', async () => {
      const outcome = upload.addPhotoFor('wd-t3');
      demo.resetData();
      expect(() => vi.advanceTimersByTime(READING_MS)).not.toThrow();

      await expect(outcome).resolves.toBe('dropped');
      expect(uploadsOf('weber-design')).toEqual([]);
      expect(paymentOf('wd-t3').receipt).toBe('missing');
      expect(upload.readingFor()).toBeNull();
    });

    it('reset during reading clears readingFor at once, and a new photo for the same payment starts fresh', async () => {
      const stale = upload.addPhotoFor('wd-t3');
      vi.advanceTimersByTime(1000);
      demo.resetData();
      expect(upload.readingFor()).toBeNull();

      const fresh = upload.addPhotoFor('wd-t3');
      expect(fresh).not.toBe(stale);
      expect(upload.readingFor()).toBe('wd-t3');
      expect(uploadsOf('weber-design').map((d) => d.id)).toEqual(['up-2']);

      vi.advanceTimersByTime(1000); // the photo from before the reset is over now
      await expect(stale).resolves.toBe('dropped');
      expect(upload.readingFor()).toBe('wd-t3');
      expect(paymentOf('wd-t3').receipt).toBe('missing');

      vi.advanceTimersByTime(1000);
      await expect(fresh).resolves.toBe('linked');
      expect(upload.readingFor()).toBeNull();
      expect(paymentOf('wd-t3').receipt).toBe('attached');
    });

    it('a photo for money in is a sent document, and still links', async () => {
      demo.updateTransaction('wd-t1', (tx) => ({ ...tx, receipt: 'missing', receiptFile: null }));
      const outcome = upload.addPhotoFor('wd-t1');
      vi.advanceTimersByTime(READING_MS);

      await expect(outcome).resolves.toBe('linked');
      expect(upload1()).toMatchObject({
        direction: 'sent',
        name: 'Müller GmbH',
        amountCents: 150000,
        paymentId: 'wd-t1',
      });
      expect(docStatus(upload1())).toBe('done');
      expect(paymentOf('wd-t1')).toMatchObject({ receipt: 'attached' });
    });

    it('a photo of a payment that was fixed meanwhile stays unlinked', async () => {
      const outcome = upload.addPhotoFor('wd-t3');
      demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
      vi.advanceTimersByTime(READING_MS);

      await expect(outcome).resolves.toBe('dropped');
      expect(upload1()).toMatchObject({ reading: false, name: 'Deutsche Bahn', paymentId: null });
      expect(paymentOf('wd-t3')).toMatchObject({ receipt: 'notNeeded', receiptFile: null });
      expect(upload.readingFor()).toBeNull();
    });

    it('a photo that is removed while it is read is dropped', async () => {
      const outcome = upload.addPhotoFor('wd-t3');
      demo.removeDocument('up-1');
      vi.advanceTimersByTime(READING_MS);

      await expect(outcome).resolves.toBe('dropped');
      expect(uploadsOf('weber-design')).toEqual([]);
      expect(paymentOf('wd-t3').receipt).toBe('missing');
    });

    it('lands in the business the photo was taken in', async () => {
      const outcome = upload.addPhotoFor('wd-t3');
      demo.setBusiness('sara-yoga');
      vi.advanceTimersByTime(READING_MS);

      await expect(outcome).resolves.toBe('linked');
      expect(uploadsOf('sara-yoga')).toEqual([]);
      expect(upload1()).toMatchObject({ reading: false, paymentId: 'wd-t3' });
      expect(
        demo.businesses
          .find((b) => b.id === 'weber-design')!
          .transactions.find((t) => t.id === 'wd-t3')!.receipt,
      ).toBe('attached');
    });

    it('a second tap on the same payment gives the same photo, not another one', async () => {
      const first = upload.addPhotoFor('wd-t3');
      const second = upload.addPhotoFor('wd-t3');
      expect(second).toBe(first);
      vi.advanceTimersByTime(READING_MS);

      await expect(first).resolves.toBe('linked');
      expect(uploadsOf('weber-design').map((d) => d.id)).toEqual(['up-1']);
      expect(paymentOf('wd-t3').history.filter((h) => h.key === 'receiptLinked')).toHaveLength(1);
    });

    it('a payment that has its receipt, or is not there, takes no photo', async () => {
      await expect(upload.addPhotoFor('wd-t2')).resolves.toBe('dropped');
      await expect(upload.addPhotoFor('nope')).resolves.toBe('dropped');
      expect(uploadsOf('weber-design')).toEqual([]);
      expect(upload.readingFor()).toBeNull();
    });

    it('two payments can be read at the same time', async () => {
      const first = upload.addPhotoFor('wd-t3');
      const second = upload.addPhotoFor('wd-t17');
      expect(upload.readingFor()).toBe('wd-t17');

      vi.advanceTimersByTime(READING_MS);
      await Promise.all([first, second]);
      expect(upload.readingFor()).toBeNull();
      expect(paymentOf('wd-t3').receipt).toBe('attached');
      expect(paymentOf('wd-t17').receipt).toBe('attached');
    });
  });
});
