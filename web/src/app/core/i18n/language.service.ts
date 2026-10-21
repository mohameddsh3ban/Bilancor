import { Directionality } from '@angular/cdk/bidi';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Lang } from '../../data/models';
import { SafeStorage } from '../storage/safe-storage';

const STORAGE_KEY = 'mockup.lang';
const LANGS: readonly Lang[] = ['en', 'de', 'ar'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly storage = inject(SafeStorage);
  private readonly transloco = inject(TranslocoService);
  private readonly directionality = inject(Directionality);

  private readonly current = signal<Lang>(this.initialLang());

  readonly lang = this.current.asReadonly();
  readonly dir = computed<'ltr' | 'rtl'>(() => (this.current() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    this.apply(this.current());
  }

  setLang(lang: Lang): void {
    this.current.set(lang);
    this.storage.set(STORAGE_KEY, lang);
    this.apply(lang);
  }

  private apply(lang: Lang): void {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = this.dir();
    // CDK reads <html dir> only once, so keep its Directionality (overlays, progress bars) in step.
    this.directionality.valueSignal.set(this.dir());
    this.directionality.change.emit(this.dir());
    this.transloco.setActiveLang(lang);
  }

  private initialLang(): Lang {
    const stored = this.storage.get(STORAGE_KEY);
    return LANGS.find((l) => l === stored) ?? 'en';
  }
}
