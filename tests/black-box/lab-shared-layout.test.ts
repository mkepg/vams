/**
 * BLACK-BOX TEST SUITE — BB-LAB
 * The rings the Lab page and the program's worker share: they keep working when their counters
 * pass 2^31, and the output reader finishes a character the program stopped in the middle of.
 */
import { describe, expect, it } from 'vitest';
import {
  CONTROL,
  EVENT_SLOTS,
  INPUT_BYTES,
  OUTPUT_BYTES,
  OutputReader,
  createSharedLayout,
  eventsWaiting,
  inputWaiting,
  openLayout,
  outputRoom,
  peekInput,
  postEvent,
  putOutput,
  sendInput,
  takeEvents,
  takeInput,
  type LabEvent,
  type OutputChunk,
} from '@/features/lab-run/model/shared-layout';

/** A counter just under Int32's top, where an unbounded count wraps negative. */
const NEAR_TOP = 2 ** 31 - 5;

/** A layout with a tiny framebuffer; the rings are what the tests use. */
function rings() {
  return { views: openLayout(createSharedLayout(16)) };
}

const key = (n: number): LabEvent => ({ kind: 'key', key: n, x: n, y: n, modifiers: 0 });
const text = (s: string) => new TextEncoder().encode(s);
const joined = (chunks: OutputChunk[]) => chunks.map((c) => (c.stream === 'clear' ? '<clear>' : c.text)).join('');

describe('BB-LAB-61: The event ring keeps its order and its fullness when the counters pass 2^31', () => {
  it('delivers every event in order, and still reports a full ring', () => {
    const { views } = rings();
    Atomics.store(views.control, CONTROL.EVENT_HEAD, NEAR_TOP);
    Atomics.store(views.control, CONTROL.EVENT_TAIL, NEAR_TOP);
    const seen: number[] = [];
    for (let n = 0; n < EVENT_SLOTS * 3; n++) {
      expect(postEvent(views, key(n))).toBe(true);
      if (n % 7 === 6) seen.push(...takeEvents(views).map((e) => (e as { key: number }).key));
    }
    seen.push(...takeEvents(views).map((e) => (e as { key: number }).key));
    expect(seen).toEqual(Array.from({ length: EVENT_SLOTS * 3 }, (_, n) => n));
    expect(eventsWaiting(views)).toBe(false);

    for (let n = 0; n < EVENT_SLOTS; n++) expect(postEvent(views, key(n))).toBe(true);
    expect(postEvent(views, key(999))).toBe(false);
    expect(takeEvents(views)).toHaveLength(EVENT_SLOTS);
  });
});

describe('BB-LAB-62: The input ring keeps its bytes and its count when the counters pass 2^31', () => {
  it('queues, peeks and takes bytes across the wrap, and refuses what does not fit', () => {
    const { views } = rings();
    Atomics.store(views.control, CONTROL.INPUT_HEAD, NEAR_TOP);
    Atomics.store(views.control, CONTROL.INPUT_TAIL, NEAR_TOP);
    for (let round = 0; round < 40; round++) {
      const bytes = Uint8Array.from({ length: 300 }, (_, i) => (round + i) & 0xff);
      expect(sendInput(views, bytes)).toBe(true);
      expect(inputWaiting(views)).toBe(300);
      expect(peekInput(views, 299)).toBe(bytes[299]);
      expect(Array.from(takeInput(views, 300))).toEqual(Array.from(bytes));
      expect(inputWaiting(views)).toBe(0);
    }
    expect(sendInput(views, new Uint8Array(INPUT_BYTES))).toBe(true);
    expect(sendInput(views, new Uint8Array(1))).toBe(false);
    expect(inputWaiting(views)).toBe(INPUT_BYTES);
  });
});

describe('BB-LAB-63: The output ring keeps its records and its room when the counters pass 2^31', () => {
  it('writes and reads records across the wrap, and the room comes back as the page reads', () => {
    const { views } = rings();
    Atomics.store(views.control, CONTROL.OUTPUT_HEAD, NEAR_TOP);
    Atomics.store(views.control, CONTROL.OUTPUT_TAIL, NEAR_TOP);
    const reader = new OutputReader(views);
    expect(outputRoom(views)).toBe(OUTPUT_BYTES);
    const got: string[] = [];
    for (let n = 0; n < 200; n++) {
      const line = `line ${n} ${'x'.repeat(n * 3)}\n`;
      expect(outputRoom(views)).toBeGreaterThanOrEqual(line.length + 3);
      putOutput(views, 'stdout', text(line));
      if (n % 5 === 4) {
        got.push(joined(reader.take()));
        expect(outputRoom(views)).toBe(OUTPUT_BYTES);
      }
    }
    const expected = Array.from({ length: 200 }, (_, n) => `line ${n} ${'x'.repeat(n * 3)}\n`);
    expect(got.join('')).toBe(expected.join(''));
    putOutput(views, 'stderr', text('oops'));
    putOutput(views, 'clear');
    expect(reader.take()).toEqual([{ stream: 'stderr', text: 'oops' }, { stream: 'clear' }]);
  });
});

describe('BB-LAB-64: finish() gives the end of a character the program stopped in the middle of', () => {
  it('flushes a cut UTF-8 sequence as U+FFFD, once, per stream', () => {
    const { views } = rings();
    const reader = new OutputReader(views);
    const euro = text('€'); // three bytes
    putOutput(views, 'stdout', Uint8Array.of(...text('ok '), euro[0], euro[1]));
    putOutput(views, 'stderr', Uint8Array.of(euro[0]));
    expect(reader.take()).toEqual([{ stream: 'stdout', text: 'ok ' }]);
    expect(reader.finish()).toEqual([
      { stream: 'stdout', text: '�' },
      { stream: 'stderr', text: '�' },
    ]);
    expect(reader.finish()).toEqual([]);
  });

  it('takes what is still in the ring before it flushes, and is empty when nothing was cut', () => {
    const { views } = rings();
    const reader = new OutputReader(views);
    putOutput(views, 'stdout', text('bye\n'));
    expect(reader.finish()).toEqual([{ stream: 'stdout', text: 'bye\n' }]);
    expect(reader.finish()).toEqual([]);
  });
});
