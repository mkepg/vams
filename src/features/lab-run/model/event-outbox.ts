/**
 * The page's side of the event ring: events wait here when the ring is full, and go in, oldest
 * first, as the program takes what is there.
 *
 * A program busy in display() can leave the ring full for a while. Nothing the program needs to
 * stay in step is ever dropped while it waits: a key or button release (or the program would see a
 * key held down or a drag that never ends), a reshape and a menu choice always stay in the queue.
 * Motion is coalesced instead: a motion, passive motion or reshape queued straight after one of
 * its own kind replaces it, since only the latest position or size matters. If the queue still
 * grows past OUTBOX_LIMIT, the oldest event that may go (a press, a motion, a wheel turn or an
 * entry) is dropped to make room.
 */
import type { LabEvent } from './shared-layout';

/** The most events the page holds back while the ring is full. */
export const OUTBOX_LIMIT = 512;

const COALESCED = new Set<LabEvent['kind']>(['motion', 'passiveMotion', 'reshape']);

/** Whether an event must reach the program however long the ring stays full. */
export function mustDeliver(e: LabEvent): boolean {
  return e.kind === 'keyUp' || e.kind === 'specialUp' || (e.kind === 'mouse' && e.state === 1) || e.kind === 'reshape' || e.kind === 'menu';
}

export class EventOutbox {
  private queue: LabEvent[] = [];

  /** Events waiting for room in the ring. */
  get pending(): readonly LabEvent[] {
    return this.queue;
  }

  push(e: LabEvent): void {
    const last = this.queue[this.queue.length - 1];
    if (last && last.kind === e.kind && COALESCED.has(e.kind)) {
      this.queue[this.queue.length - 1] = e;
      return;
    }
    this.queue.push(e);
    if (this.queue.length > OUTBOX_LIMIT) {
      const drop = this.queue.findIndex((x) => !mustDeliver(x));
      if (drop >= 0) this.queue.splice(drop, 1);
    }
  }

  /** Posts waiting events in order until `post` says the ring is full. */
  flush(post: (e: LabEvent) => boolean): void {
    let sent = 0;
    while (sent < this.queue.length && post(this.queue[sent])) sent++;
    if (sent) this.queue.splice(0, sent);
  }
}
