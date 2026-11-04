/**
 * The messages between the Lab page and the worker that runs a student's program.
 *
 * The page starts a fresh worker for every Run and sends it one `start`. Everything after that
 * flows the other way, as WorkerMessage, apart from what goes through the shared memory (events,
 * typed input and frame acknowledgements from the page; frames and the program's output, Console
 * clears included, from the worker; see shared-layout.ts). The worker can block on
 * Atomics.wait at any time, so the page never expects it to read another message. To stop a
 * program the page terminates the worker.
 */
import type { LabFile } from '@/entities/lab-project';
import type { SharedLayout } from './shared-layout';

/** One file in the student's file list, as the Lab's project keeps it. */
export type { LabFile };

/** Page to worker: run this side module with these files. */
export interface StartMessage {
  type: 'start';
  /** The side module the compile service returned. */
  module: ArrayBuffer;
  files: LabFile[];
  shared: SharedLayout;
  /** What glutGet(GLUT_SCREEN_WIDTH) and glutGet(GLUT_SCREEN_HEIGHT) answer: the stage's size. */
  screen?: { width: number; height: number };
}

export type PageMessage = StartMessage;

/** A right-click menu entry: a value for the menu's callback, or a submenu. */
export type LabMenuEntry = { label: string; value: number } | { label: string; submenu: number };

/** A menu made by glutCreateMenu, with its entries in the order they were added. */
export interface LabMenu {
  id: number;
  entries: LabMenuEntry[];
}

/** A menu attached to a mouse button: GLUT_LEFT_BUTTON 0, GLUT_MIDDLE_BUTTON 1, GLUT_RIGHT_BUTTON 2. */
export interface AttachedMenu {
  button: number;
  menu: number;
}

export type WorkerMessage =
  /** glutCreateWindow, glutReshapeWindow or glutPositionWindow: the window to show, in screen pixels. */
  | { type: 'window'; title: string; width: number; height: number; x: number; y: number }
  /** glutSetWindowTitle. */
  | { type: 'title'; title: string }
  /** glutFullScreen: the window fills the stage, and the page sends a reshape. */
  | { type: 'fullscreen' }
  /** Every menu and what each button opens. Sent again whenever either changes. */
  | { type: 'menus'; tree: LabMenu[]; attached: AttachedMenu[] }
  /**
   * The window grew past the framebuffer: frames of `generation` and later are in `buffer`, top row
   * first, until the next one of these.
   */
  | { type: 'framebuffer'; buffer: SharedArrayBuffer; generation: number }
  /** A file the program wrote and closed; it belongs in the file list. */
  | { type: 'fileWritten'; name: string; bytes: Uint8Array }
  /** main returned, or the program called exit. Read the output ring once more: all of it is there. */
  | { type: 'exit'; code: number }
  /** The program stopped on an error: a trap, an abort, or a runtime that wouldn't load. */
  | { type: 'crash'; message: string };
