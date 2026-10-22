import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { SUPPLIES } from '../../data/categories';
import { editDocument } from '../../domain/document-actions';
import { changeCategory, markNoReceiptNeeded } from '../../domain/payment-actions';
import { DemoStateService } from '../../state/demo-state.service';
import { DecisionsCard } from './decisions-card';

describe('DecisionsCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  function render(businessId: string): HTMLElement {
    TestBed.inject(DemoStateService).setBusiness(businessId);
    const fixture = TestBed.createComponent(DecisionsCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the count, the minutes and a Start link', () => {
    const el = render('weber-design');
    expect(el.textContent).toContain('5 things need your decision');
    expect(el.textContent).toContain('about 5 minutes');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/soon/decisions');
    expect(el.querySelector('a')?.textContent).toContain('Start');
  });

  it('decisions count is 5 for weber-design and drops to 4 after typing the amount', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setBusiness('weber-design');
    const fixture = TestBed.createComponent(DecisionsCard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('5 things need your decision');
    // Four payments need the person; the fifth thing is the receipt whose amount could not be read.
    demo.updateDocument('wd-d1', (doc) => editDocument(doc, { amountCents: 4200 }));
    fixture.detectChanges();
    expect(el.textContent).toContain('4 things need your decision');
    expect(el.textContent).toContain('about 4 minutes');
  });

  it('counts a document that needs the person once a bank is connected, and not before', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setBusiness('weber-design');
    demo.setSetup('halfway');
    const fixture = TestBed.createComponent(DecisionsCard);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('5 things need your decision');
    demo.setSetup('new');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('4 things need your decision');
  });

  it('sara-yoga stays at 3', () => {
    expect(render('sara-yoga').textContent).toContain('3 things need your decision');
  });

  it('uses the singular for one decision', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setBusiness('sara-yoga');
    demo.updateTransaction('sy-t7', (tx) => changeCategory(tx, SUPPLIES));
    demo.updateTransaction('sy-t8', markNoReceiptNeeded);
    const fixture = TestBed.createComponent(DecisionsCard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('1 thing needs your decision');
    expect(el.textContent).toContain('about 1 minute');
    expect(el.textContent).not.toContain('1 minutes');
  });

  it('shows the all-clear text and no Start link when nothing is open', () => {
    const el = render('cafe-linde');
    expect(el.textContent).toContain('All clear');
    expect(el.textContent).not.toContain('0 things');
    expect(el.querySelector('a')).toBeNull();
  });
});
