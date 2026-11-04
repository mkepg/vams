import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JSX } from 'preact';
import {
  FramebufferCanvas,
  glutButton,
  glutKey,
  glutModifiers,
  GLUT_STATE,
  runController,
  useLabRun,
  type ProgramWindow,
  type RunStatus,
} from '@/features/lab-run';
import { CanvasWindow, type ResizeEdge, type WindowControls } from '@/shared/ui/floating-window';
import { CHROME, FRAME_BORDER, clampRect, fullscreenRect, resizedProgram, windowRect, windowScale, type Rect, type Size } from '../model/stage-geometry';
import { useLabStage } from '../model/stage-store';
import LabMenu from './LabMenu';

type Drag = { kind: 'move'; x: number; y: number; from: Rect } | { kind: 'size'; edge: ResizeEdge; x: number; y: number; from: Rect };
type GlutKey = NonNullable<ReturnType<typeof glutKey>>;

const capture = (event: PointerEvent) => {
  try {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  } catch {
    // No active pointer to capture (synthetic events); delivery still works.
  }
};

/** What the stage says while there is no window to show. */
export function stageMessage(status: RunStatus, exitCode?: number): string {
  switch (status) {
    case 'compiling':
    case 'busy':
      return 'Compiling…';
    case 'running':
    case 'waitingInput':
      return 'The program is running. What it prints is in the Console.';
    case 'exited':
      return `The program ended with exit code ${exitCode ?? 0}.`;
    case 'crashed':
      return 'The program stopped. The Console says why.';
    default:
      return 'Press Run to compile main.cpp and open its window here.';
  }
}

/** The stage: the running program's window floats on it, as on a lab PC's screen. */
export default function LabStage() {
  const win = useLabRun((s) => s.window);
  const status = useLabRun((s) => s.status);
  const exitCode = useLabRun((s) => s.exitCode);
  const menus = useLabRun((s) => s.menus);
  const attached = useLabRun((s) => s.attached);
  const measured = useLabStage((s) => s.stage);
  const place = useLabStage((s) => s.place);
  const stageRef = useRef<HTMLElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const heldKeys = useRef(new Map<string, GlutKey>());
  const heldButtons = useRef(new Set<number>());
  const pointer = useRef({ x: 0, y: 0 });
  // The menu belongs to the menus it was opened from: a new program, or new menus, close it.
  const [menu, setMenu] = useState<{ root: number; at: { x: number; y: number }; of: typeof menus } | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => useLabStage.getState().setStage({ width: el.clientWidth, height: el.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Each program's window opens where that program asks.
  const open = win !== null;
  useEffect(() => {
    if (!open) {
      useLabStage.getState().setPlace(null);
      heldKeys.current.clear();
      heldButtons.current.clear();
      pointer.current = { x: 0, y: 0 };
    }
  }, [open]);

  // Until the stage is measured, it is taken to hold the window as it is.
  const stage: Size = measured ?? (win ? { width: win.width + CHROME.width, height: win.height + CHROME.height } : { width: 1, height: 1 });

  // glutFullScreen: the window fills the stage, and the program hears the new size.
  const fullscreen = win?.fullscreen ?? false;
  useEffect(() => {
    if (!fullscreen || !measured) return;
    runController.resizeWindow(measured.width - CHROME.width, measured.height - CHROME.height, true);
  }, [fullscreen, measured]);

  if (!win) {
    return (
      <section ref={stageRef} className="lab-stage" aria-label="Stage">
        <p className="lab-stage__empty">{stageMessage(status, exitCode)}</p>
      </section>
    );
  }

  const scale = win.fullscreen ? 1 : windowScale(stage, win);
  const rect = win.fullscreen ? fullscreenRect(stage) : windowRect(stage, win, scale, place);

  /** A pointer's place in the window's own pixels, y down, whatever scale it is shown at. */
  const toWindow = (event: { clientX: number; clientY: number }) => {
    const box = surfaceRef.current?.getBoundingClientRect();
    const left = box?.left ?? 0;
    const top = box?.top ?? 0;
    const sx = box && box.width > 0 ? win.width / box.width : 1 / scale;
    const sy = box && box.height > 0 ? win.height / box.height : 1 / scale;
    return { x: Math.floor((event.clientX - left) * sx), y: Math.floor((event.clientY - top) * sy) };
  };
  const toStage = (event: { clientX: number; clientY: number }) => {
    const box = stageRef.current?.getBoundingClientRect();
    return { x: Math.round(event.clientX - (box?.left ?? 0)), y: Math.round(event.clientY - (box?.top ?? 0)) };
  };

  const openMenu = (root: number, at: { x: number; y: number }) => {
    setMenu({ root, of: menus, at: { x: Math.max(0, Math.min(at.x, stage.width - 160)), y: Math.max(0, Math.min(at.y, stage.height - 40)) } });
  };
  const closeMenu = () => {
    setMenu(null);
    surfaceRef.current?.focus();
  };

  const releaseKeys = () => {
    for (const k of heldKeys.current.values()) {
      runController.postEvent({ kind: k.kind === 'key' ? 'keyUp' : 'specialUp', key: k.key, ...pointer.current, modifiers: 0 });
    }
    heldKeys.current.clear();
  };

  const surfaceProps: JSX.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (event) => {
      const button = glutButton(event.button);
      if (button === null) return;
      surfaceRef.current?.focus();
      pointer.current = toWindow(event);
      const menuHere = attached.find((a) => a.button === button);
      if (menuHere) {
        event.preventDefault();
        openMenu(menuHere.menu, toStage(event));
        return;
      }
      capture(event);
      heldButtons.current.add(button);
      runController.postEvent({ kind: 'mouse', button, state: GLUT_STATE.DOWN, ...pointer.current, modifiers: glutModifiers(event) });
    },
    onPointerUp: (event) => {
      const button = glutButton(event.button);
      if (button === null || !heldButtons.current.has(button)) return;
      heldButtons.current.delete(button);
      pointer.current = toWindow(event);
      runController.postEvent({ kind: 'mouse', button, state: GLUT_STATE.UP, ...pointer.current, modifiers: glutModifiers(event) });
    },
    onPointerMove: (event) => {
      pointer.current = toWindow(event);
      runController.postEvent({ kind: heldButtons.current.size ? 'motion' : 'passiveMotion', ...pointer.current });
    },
    onPointerEnter: () => runController.postEvent({ kind: 'entry', state: 1 }),
    onPointerLeave: () => runController.postEvent({ kind: 'entry', state: 0 }),
    onWheel: (event) => {
      event.preventDefault();
      pointer.current = toWindow(event);
      runController.postEvent({ kind: 'wheel', wheel: 0, direction: event.deltaY < 0 ? 1 : -1, ...pointer.current, modifiers: glutModifiers(event) });
    },
    onContextMenu: (event) => event.preventDefault(),
    onKeyDown: (event) => {
      if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
        const keyMenu = attached.find((a) => a.button === 2) ?? attached[0];
        if (keyMenu) {
          event.preventDefault();
          // At the pointer's last place in the window, as a right-click there would.
          openMenu(keyMenu.menu, { x: rect.x + FRAME_BORDER + pointer.current.x * scale, y: rect.y + CHROME.height - FRAME_BORDER + pointer.current.y * scale });
          return;
        }
      }
      const k = glutKey(event);
      if (!k) return;
      event.preventDefault();
      heldKeys.current.set(event.code || event.key, k);
      runController.postEvent({ kind: k.kind, key: k.key, ...pointer.current, modifiers: glutModifiers(event) });
    },
    onKeyUp: (event) => {
      const id = event.code || event.key;
      const k = heldKeys.current.get(id) ?? glutKey(event);
      if (!k) return;
      event.preventDefault();
      heldKeys.current.delete(id);
      runController.postEvent({ kind: k.kind === 'key' ? 'keyUp' : 'specialUp', key: k.key, ...pointer.current, modifiers: glutModifiers(event) });
    },
    onBlur: releaseKeys,
  };

  const begin = (next: Drag, event: PointerEvent) => {
    drag.current = next;
    capture(event);
  };
  const dragTo = (event: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (d.kind === 'move') {
      const moved = clampRect({ ...d.from, x: d.from.x + dx, y: d.from.y + dy }, stage);
      useLabStage.getState().setPlace({ x: moved.x, y: moved.y });
    } else {
      const size = resizedProgram(d.from, d.edge, dx, dy, stage);
      runController.resizeWindow(size.width, size.height);
    }
  };
  const end = () => {
    drag.current = null;
  };

  const controls: WindowControls = {
    maximised: win.fullscreen,
    onClose: () => runController.stop(),
    barProps: {
      onPointerDown: (event) => {
        if (event.button !== 0 || (event.target as Element).closest('button') || win.fullscreen) return;
        begin({ kind: 'move', x: event.clientX, y: event.clientY, from: rect }, event);
      },
      onPointerMove: dragTo,
      onPointerUp: end,
      onPointerCancel: end,
    },
    handleProps: (edge) => ({
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        useLabStage.getState().setPlace({ x: rect.x, y: rect.y });
        begin({ kind: 'size', edge, x: event.clientX, y: event.clientY, from: rect }, event);
      },
      onPointerMove: dragTo,
      onPointerUp: end,
      onPointerCancel: end,
    }),
  };

  const placed: JSX.CSSProperties = { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` };
  const running = status === 'running' || status === 'waitingInput';

  return (
    <section ref={stageRef} className="lab-stage" aria-label="Stage">
      <CanvasWindow
        size={{ width: win.width, height: win.height }}
        title={win.title}
        running={running}
        controls={controls}
        className={win.fullscreen ? 'canvas-window--maximised' : 'canvas-window--floating'}
        style={placed}
      >
        <div
          ref={surfaceRef}
          className="lab-stage__surface"
          tabIndex={0}
          role="application"
          aria-label={programLabel(win)}
          {...surfaceProps}
        >
          <FramebufferCanvas className="lab-stage__canvas" width={win.width} height={win.height} />
        </div>
      </CanvasWindow>
      {menu && menu.of === menus && (
        <LabMenu
          menus={menus}
          root={menu.root}
          at={menu.at}
          onChoose={(id, value) => {
            runController.postEvent({ kind: 'menu', menu: id, value });
            closeMenu();
          }}
          onClose={closeMenu}
        />
      )}
    </section>
  );
}

const programLabel = (win: ProgramWindow) => `${win.title}: keys and the mouse go to the program while this has focus`;
