import { beforeEach, vi } from 'vitest';
import { useVamsStore } from '@/core/store';

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
    callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' },
    canvasBackgroundColor: '#000000',
    viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    uploadedTextures: s.uploadedTextures ?? [],
  });
});

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
