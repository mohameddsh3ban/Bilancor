import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Whether an address is a Help page (`/help` and everything under it), whatever its query or fragment. */
const insideHelp = (url: string): boolean => {
  const path = url.split(/[?#]/, 1)[0];
  return path === '/help' || path.startsWith('/help/');
};

/**
 * Remembers the page the person was on before they opened Help, so Help can offer the questions for that page. The
 * menu's Help works from anywhere, so the page is not in Help's own address. Help's pages (the list, an answer, German
 * terms A–Z, Write to us) leave it as it was, so a visit that goes around Help still remembers where it began.
 *
 * Started with the app shell, as the review inbox's service is, so it has seen the first page before the first visit to Help.
 */
@Injectable({ providedIn: 'root' })
export class HelpContextService {
  private readonly router = inject(Router);

  private readonly lastPageSignal = signal<string | null>(this.currentPage());
  /** The last address opened outside Help (with its query and fragment), or null when there was none (Help was the first page). */
  readonly lastPage = this.lastPageSignal.asReadonly();

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (!insideHelp(event.urlAfterRedirects)) this.lastPageSignal.set(event.urlAfterRedirects);
      });
  }

  /** The page the router finished with last when the service starts (late, say), unless that is a Help page or there is none yet. */
  private currentPage(): string | null {
    const last = this.router.lastSuccessfulNavigation()?.finalUrl;
    const url = last ? this.router.serializeUrl(last) : null;
    return url !== null && !insideHelp(url) ? url : null;
  }
}
