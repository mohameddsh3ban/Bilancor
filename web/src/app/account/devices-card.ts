import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import type { Device } from '../data/models';
import { focusAfterRender } from '../settings/form-helpers';
import { AccountService } from '../state/account.service';
import { DEMO_BOX } from './demo-email';

/** What the card last did, said in a line the person hears: one device signed out (named), or every other one. */
type Note = Pick<Device, 'browser' | 'system'> | 'others';

/**
 * My account › Where you're signed in: each device of the signed-in person ("Chrome on Windows", the place and when it
 * was last used, or "now"), with **This device** on the one in use. Every other device has **Sign out**; **Sign out
 * everywhere else** signs all of them out. This device can't be signed out from here (Sign out in the person menu does
 * that). The devices are sample rows: the app doesn't read the browser, and a demo box says so.
 *
 * What was done is said in a line under the list, and the cursor goes there, since the button it was on is gone.
 */
@Component({
  selector: 'app-devices-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, HlmCardImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="devices-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle tabindex="-1" class="outline-none" data-testid="devices-title">
          {{ 'account.devices.title' | transloco }}
        </h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-4">
        <p [class]="demoBox" data-testid="devices-demo">{{ 'account.devices.demo' | transloco }}</p>

        <ul class="flex flex-col">
          @for (device of devices(); track device.id) {
            <li
              class="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
              [attr.data-testid]="'device-row-' + device.id"
            >
              <div class="min-w-0 flex-1 basis-48">
                <p class="font-medium [overflow-wrap:anywhere]">
                  <span [attr.data-testid]="'device-name-' + device.id">{{
                    'account.devices.device'
                      | transloco: { browser: device.browser, system: device.system }
                  }}</span>
                  @if (device.current) {
                    <span
                      class="bg-muted text-muted-foreground ms-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      [attr.data-testid]="'device-this-' + device.id"
                      >{{ 'account.devices.thisDevice' | transloco }}</span
                    >
                  }
                </p>
                <p
                  class="text-muted-foreground text-sm"
                  [attr.data-testid]="'device-sub-' + device.id"
                >
                  <bdi>{{ device.place }}</bdi> ·
                  @if (device.lastSeen; as seen) {
                    <bdi dir="ltr">{{ seen | appDate: { year: true } }}</bdi>
                  } @else {
                    {{ 'account.devices.now' | transloco }}
                  }
                </p>
              </div>
              @if (!device.current) {
                <button
                  hlmBtn
                  type="button"
                  variant="outline"
                  size="sm"
                  class="min-h-10 shrink-0"
                  [attr.data-testid]="'device-sign-out-' + device.id"
                  [attr.aria-label]="
                    'account.devices.signOutLabel'
                      | transloco
                        : {
                            device:
                              'account.devices.device'
                              | transloco: { browser: device.browser, system: device.system },
                          }
                  "
                  (click)="signOut(device)"
                >
                  {{ 'account.devices.signOut' | transloco }}
                </button>
              }
            </li>
          }
        </ul>

        @if (others().length > 0) {
          <button
            hlmBtn
            type="button"
            variant="outline"
            class="min-h-10 self-start"
            data-testid="sign-out-others"
            (click)="signOutOthers()"
          >
            {{ 'account.devices.signOutOthers' | transloco }}
          </button>
        } @else {
          <p class="text-muted-foreground text-sm" data-testid="devices-none">
            {{ 'account.devices.none' | transloco }}
          </p>
        }

        <div role="status">
          @if (note(); as done) {
            <p
              class="text-positive flex items-center gap-1 text-sm outline-none"
              tabindex="-1"
              data-testid="devices-status"
            >
              <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
              @if (done === 'others') {
                {{ 'account.devices.signedOutOthers' | transloco }}
              } @else {
                {{
                  'account.devices.signedOut'
                    | transloco
                      : {
                          device:
                            'account.devices.device'
                            | transloco: { browser: done.browser, system: done.system },
                        }
                }}
              }
            </p>
          }
        </div>
      </div>
    </section>
  `,
})
export class DevicesCard {
  private readonly accounts = inject(AccountService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly demoBox = DEMO_BOX;
  protected readonly devices = computed(() => this.accounts.person().devices);
  protected readonly others = computed(() => this.devices().filter((d) => !d.current));
  protected readonly note = signal<Note | null>(null);

  protected signOut(device: Device): void {
    this.accounts.signOutDevice(device.id);
    this.say({ browser: device.browser, system: device.system });
  }

  protected signOutOthers(): void {
    this.accounts.signOutOtherDevices();
    this.say('others');
  }

  /** Says what was done and moves the cursor there: the button it was on has gone with its row. */
  private say(note: Note): void {
    this.note.set(note);
    focusAfterRender(this.injector, this.host, '[data-testid="devices-status"]');
  }
}
