/**
 * The Lab's Console in a worker thread, blocking on the real Atomics.wait, so a test can play the
 * page from the main thread. workerData holds the shared layout and the calls to make in order;
 * each call's result, and every message the Console posts, comes back as a message.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { openLayout, type SharedLayout } from '@/features/lab-run/model/shared-layout';
import { ConsoleIO } from '@/features/lab-run/worker/console-io';
import { atomicsHost } from '@/features/lab-run/worker/event-queue';

export type ConsoleCall = { write: string } | 'readLine' | 'getch';

export type ConsoleReply = { posted: unknown } | { result: string | number };

const { layout, calls } = workerData as { layout: SharedLayout; calls: ConsoleCall[] };
const views = openLayout(layout);
const io = new ConsoleIO(
  views,
  atomicsHost(views, (message) => parentPort?.postMessage({ posted: message } satisfies ConsoleReply)),
);

for (const call of calls) {
  if (call === 'readLine') parentPort?.postMessage({ result: io.readLine() } satisfies ConsoleReply);
  else if (call === 'getch') parentPort?.postMessage({ result: io.getch() } satisfies ConsoleReply);
  else io.write('stdout', call.write);
}
