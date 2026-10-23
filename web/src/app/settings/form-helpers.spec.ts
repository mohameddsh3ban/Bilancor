import { ApplicationRef, Component, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { clearErrors, focusAfterRender } from './form-helpers';

describe('clearErrors', () => {
  type Errors = Partial<Record<'a' | 'b' | 'c', string>>;

  it('takes the errors of the named fields away and keeps the others', () => {
    const errors = signal<Errors>({ a: 'x', b: 'y', c: 'z' });
    clearErrors(errors, 'a', 'c');
    expect(errors()).toEqual({ b: 'y' });
  });

  it('leaves the very same object when none of the named fields has an error', () => {
    const before: Errors = { b: 'y' };
    const errors = signal<Errors>(before);
    clearErrors(errors, 'a', 'c');
    expect(errors()).toBe(before);
  });

  it('does not change the object that was there: a signal must get a new one', () => {
    const before: Errors = { a: 'x', b: 'y' };
    const errors = signal<Errors>(before);
    clearErrors(errors, 'a');
    expect(before).toEqual({ a: 'x', b: 'y' });
    expect(errors()).not.toBe(before);
  });
});

describe('focusAfterRender', () => {
  @Component({
    template: `<input id="first" /><input id="second" class="x" /><input id="third" class="x" />`,
  })
  class Host {}

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('puts the cursor in the first element that matches, but only once the page has been drawn again', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    focusAfterRender(TestBed.inject(Injector), host, '.x');
    expect(document.activeElement).toBe(document.body);
    TestBed.inject(ApplicationRef).tick();
    expect(document.activeElement).toBe(host.querySelector('#second'));
  });

  it('asks the host only, not the whole document', () => {
    const fixture = render();
    const outside = document.createElement('input');
    outside.className = 'x';
    document.body.prepend(outside);
    focusAfterRender(TestBed.inject(Injector), fixture.nativeElement as HTMLElement, '.x');
    TestBed.inject(ApplicationRef).tick();
    expect(document.activeElement).not.toBe(outside);
    outside.remove();
  });

  it('does nothing when nothing matches', () => {
    const fixture = render();
    focusAfterRender(TestBed.inject(Injector), fixture.nativeElement as HTMLElement, '.nothing');
    TestBed.inject(ApplicationRef).tick();
    expect(document.activeElement).toBe(document.body);
  });
});
