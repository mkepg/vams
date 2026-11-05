/**
 * How the program's worker waits for the page. Every wait in the runtime (the main loop between
 * events, typed input, Sleep and a frame's acknowledgement) goes through a WorkerHost, so the
 * worker blocks on Atomics.wait while tests can run the same code on a clock of their own.
 */
import type { WorkerMessage } from '../model/protocol';
import { CONTROL, eventsWaiting, takeEvents, type LabEvent, type LayoutViews } from '../model/shared-layout';

export interface WorkerHost {
  /** Sends a message to the page. */
  post(message: WorkerMessage): void;
  /** Milliseconds on a steady clock. */
  now(): number;
  /** Atomics.wait on control word `index` while it holds `value`, for at most `timeout` ms. */
  wait(index: number, value: number, timeout: number): void;
}

/** The host a real worker runs on. */
export function atomicsHost(views: LayoutViews, post: (message: WorkerMessage) => void): WorkerHost {
  return {
    post,
    now: () => performance.now(),
    wait: (index, value, timeout) => {
      Atomics.wait(views.control, index, value, timeout);
    },
  };
}

/**
 * Waits until `ready()` is true or `timeout` ms have passed, sleeping on SIGNAL between checks, so
 * any event or input the page sends wakes it. Says whether `ready()` came true.
 */
export function waitUntil(host: WorkerHost, views: LayoutViews, ready: () => boolean, timeout = Infinity): boolean {
  const deadline = host.now() + timeout;
  for (;;) {
    // SIGNAL is read before the check, so a page write after the check still ends the wait.
    const seen = Atomics.load(views.control, CONTROL.SIGNAL);
    if (ready()) return true;
    const left = deadline - host.now();
    if (left <= 0) return false;
    host.wait(CONTROL.SIGNAL, seen, left);
  }
}

/** The program window's events, as the worker takes them from the shared ring. */
export class EventQueue {
  private readonly views: LayoutViews;
  private readonly host: WorkerHost;

  constructor(views: LayoutViews, host: WorkerHost) {
    this.views = views;
    this.host = host;
  }

  /** Whether an event is waiting. */
  get waiting(): boolean {
    return eventsWaiting(this.views);
  }

  /** Every waiting event, oldest first. */
  take(): LabEvent[] {
    return takeEvents(this.views);
  }

  /** Sleeps until an event arrives or `timeout` ms pass. */
  waitForEvent(timeout: number): void {
    waitUntil(this.host, this.views, () => this.waiting, timeout);
  }
}
