import { emptyCallbacks } from '@/core/callbacks/callbacks-model';
import { beforeEach, vi } from 'vitest';
import { useVamsStore } from '@/core/store';
import { labProjectDefaults, useLabStore } from '@/entities/lab-project';
import * as sampleTextures from '@/features/textures/lib/sample-textures';

// Mock sample textures since happy-dom cannot provide a 2D canvas context (see src/features/textures/lib/sample-textures.ts)
vi.spyOn(sampleTextures, 'getSampleTextures').mockReturnValue(
  sampleTextures.SAMPLE_TEXTURE_SPECS.map((spec) => ({ ...spec, isSample: true, dataUrl: 'data:image/png;base64,' })),
);

// Provide a deterministic, monotonically increasing ID generator so that
// snapshot-style and equality assertions are stable across test runs.
let __idCounter = 0;
const realRandomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
beforeEach(() => {
  __idCounter = 0;
  if (globalThis.crypto) {
    // @ts-expect-error — we override only for tests; restored below
    globalThis.crypto.randomUUID = () => `uuid-${++__idCounter}`;
  }
  // Reset persisted state between tests
  try { localStorage.clear(); } catch { /* noop */ }
  // The Lab's browser save, as a first visit finds it.
  useLabStore.setState(labProjectDefaults());
  // Re-initialise store to default by calling reset actions that exist.
  const s = useVamsStore.getState();
  useVamsStore.setState({
    objects: [],
    selectedObjectId: null,
    selectedVertexId: null,
    interactionMode: 'SELECT',
    pendingShapeType: null,
    pendingVertices: [],
    pendingVertexStride: null,
    pendingMinVertices: 1,
    past: [],
    future: [],
    isBatchMode: false,
    activeLessonId: null,
    currentStepIndex: 0,
    exerciseAnswers: {},
    isSuccess: false,
    sceneBackup: null,
    callbacksBackup: null,
    canvasBackgroundColorBackup: null,
    viewportLimitsBackup: null,
    uploadedTexturesBackup: null,
    codeViewBeforeLesson: null,
    sceneId: 'scene-test',
    sceneName: 'Untitled scene',
    tourStep: null,
    railBeforeTour: null,
    tourStepBaseline: null,
    codePane: 'code',
    codeHidden: false,
    codeChangedUnseen: false,
    codeFoldsOpened: [],
    codeFoldsClosed: [],
    explainedLine: null,
    revealedGroup: null,
    codeNotes: true,
    journeyVertex: 0,
    explainRequest: null,
    journeyStageOverride: null,
    appMode: 'Author',
    callbacks: emptyCallbacks(),
    canvasBackgroundColor: '#000000',
    viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    uploadedTextures: s.uploadedTextures ?? [],
  });
});

// happy-dom lays nothing out, so every box is 0 × 0 and CodeMirror would draw only the few lines
// it guesses are on screen. Its boxes report a window-sized area instead, and it draws every line.
const realRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const rect = realRect.call(this);
  if (rect.height > 0 || !this.matches('.cm-editor, .cm-scroller, .cm-content')) return rect;
  return { top: 0, bottom: 600, height: 600, left: 0, right: 800, width: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
};

// happy-dom fires selectionchange at once, inside the update CodeMirror is making, which
// CodeMirror refuses; and its selection never settles to what CodeMirror wrote. The tests move the
// cursor through the view's state, so the document's selectionchange is dropped.
const realDispatch = document.dispatchEvent.bind(document);
document.dispatchEvent = (event: Event) => event.type === 'selectionchange' || realDispatch(event);

// Restore real randomUUID on exit, just in case.
process.on('exit', () => {
  if (globalThis.crypto && realRandomUUID) {
    // @ts-expect-error — same as above
    globalThis.crypto.randomUUID = realRandomUUID;
  }
});

// Silence noisy console output during tests
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
