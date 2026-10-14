import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Hand } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { TOUR_STEP_COUNT } from '@/core/store/tour-slice';
import { Button } from '@/shared/ui/controls';
import { useNarrowLayout } from '@/shared/hooks/useNarrowLayout';
import { observeResize } from '@/shared/engine/observe-resize';
import { TOUR_STEPS, type TourCaptionContext, type TourRunState } from '../model/steps';
import { makeItSpin, spinTarget } from '../model/spin';
import { placeCallout, type Box, type Size } from '../model/geometry';
import { inertOutside } from '../lib/inert-outside';
import { RichText } from './RichText';
import './first-visit-tour.scss';

/** What the tour needs from Run. The editor page passes the canvas's run controller. */
export interface TourRun {
  start: () => boolean;
  stop: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => { running: boolean };
}

export interface FirstVisitTourProps {
  run: TourRun;
  /** The C++ name the generator gives an object, as in `draw_<name>()`. */
  codeName: (name: string) => string;
  /** Opens the lesson the student should study next. */
  startLearning: () => void;
}

/** How long a finished try-it stays on screen before the tour moves on, so the student sees the result. */
export const TOUR_ADVANCE_MS = 1200;

const RUN_STEP = TOUR_STEPS.findIndex((s) => s.id === 'run');
const LAST_STEP = TOUR_STEP_COUNT - 1;
const CALLOUT_SIZE: Size = { width: 320, height: 200 };
/** Arrow keys inside these widgets move within the widget, never the tour. */
const ARROW_KEY_OWNERS = [
  '[role="menu"]', '[role="menuitem"]', '[role="radiogroup"]', '[role="tree"]',
  '[role="tablist"]', '[role="slider"]', '[role="spinbutton"]',
].join(', ');

const isField = (el: HTMLElement | null) =>
  !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
const findAnchors = (ids: readonly string[]) =>
  ids
    .map((id) => document.querySelector<HTMLElement>(`[data-tour-anchor="${id}"]`))
    .filter((el): el is HTMLElement => el !== null);
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/** The first-visit tour: a spotlight on one region of the editor at a time, with a callout beside it. */
export default function FirstVisitTour(props: FirstVisitTourProps) {
  const tourStep = useVamsStore((s) => s.tourStep);
  if (tourStep === null) return null;
  return <TourLayer {...props} index={tourStep} />;
}

function TourLayer({ run, codeName, startLearning, index }: FirstVisitTourProps & { index: number }) {
  const step = TOUR_STEPS[index];
  const id = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const running = useSyncExternalStore(run.subscribe, () => run.getSnapshot().running);
  const narrow = useNarrowLayout();
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const interactionMode = useVamsStore((s) => s.interactionMode);
  const codePane = useVamsStore((s) => s.codePane);
  const baseline = useVamsStore((s) => s.tourStepBaseline);
  const setRailHidden = useVamsStore((s) => s.setRailHidden);
  const [spun, setSpun] = useState(false);
  const [layout, setLayout] = useState<{ boxes: Box[]; viewport: Size }>({ boxes: [], viewport: { width: 0, height: 0 } });
  const [calloutSize, setCalloutSize] = useState<Size>(CALLOUT_SIZE);
  // Where focus was when the tour started; it goes back there when the tour ends.
  const [returnFocus] = useState(() => document.activeElement as HTMLElement | null);
  // While Make it spin's program runs, the scrim lifts so the student watches it undimmed.
  const lifted = running && index === RUN_STEP;

  // Next, Back and ending first stop a running program, so the editor is never left half-locked.
  const actions = useMemo(() => {
    const stopRun = () => {
      if (run.getSnapshot().running) run.stop();
    };
    return {
      next: () => {
        stopRun();
        useVamsStore.getState().nextTourStep();
      },
      back: () => {
        stopRun();
        useVamsStore.getState().prevTourStep();
      },
      end: () => {
        stopRun();
        useVamsStore.getState().endTour();
      },
    };
  }, [run]);

  const learn = () => {
    startLearning();
    // Starting a lesson ends the tour already; this covers a lesson that did not start.
    if (useVamsStore.getState().tourStep !== null) useVamsStore.getState().endTour();
  };

  const spin = () => {
    if (makeItSpin(useVamsStore.getState()) === null) return;
    setSpun(true);
    run.start();
  };

  // Only the step's regions take clicks and keys.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (lifted || !layer) return;
    return inertOutside(findAnchors(step.anchors), [layer]);
  }, [step, lifted]);

  // The cut-outs follow the regions as they move or change size.
  useLayoutEffect(() => {
    const els = findAnchors(step.anchors);
    const measure = () =>
      setLayout({ boxes: els.map(boxOf), viewport: { width: window.innerWidth, height: window.innerHeight } });
    measure();
    const stops = els.map((el) => observeResize(el, measure));
    window.addEventListener('resize', measure);
    return () => {
      stops.forEach((stop) => stop());
      window.removeEventListener('resize', measure);
    };
  }, [step, running]);

  useLayoutEffect(() => {
    const el = calloutRef.current;
    if (!el) return;
    const measure = () =>
      setCalloutSize({ width: el.offsetWidth || CALLOUT_SIZE.width, height: el.offsetHeight || CALLOUT_SIZE.height });
    measure();
    return observeResize(el, measure);
  }, []);

  // The callout takes focus as the tour starts and on every step.
  useEffect(() => {
    calloutRef.current?.focus({ preventScroll: true });
  }, [index]);

  // When the tour ends, focus goes back where it was, unless a lesson took over. The microtask runs
  // after the unmount has given the page back its interactivity.
  useEffect(
    () => () => {
      queueMicrotask(() => {
        if (returnFocus?.isConnected && useVamsStore.getState().appMode !== 'Lesson') returnFocus.focus();
      });
    },
    [returnFocus],
  );

  // On a narrow screen the panel is a drawer: the steps about it open it, the others close it.
  useEffect(() => {
    if (narrow) setRailHidden(!step.drawer);
  }, [narrow, step, setRailHidden]);

  // Opening the Learn drawer from the last step ends the tour: the student has reached the course.
  useEffect(
    () =>
      useVamsStore.subscribe((state, prev) => {
        if (state.learnOpen && !prev.learnOpen) state.endTour();
      }),
    [],
  );

  // A step whose try-it is done moves on by itself, TOUR_ADVANCE_MS after the last scene edit. A step that
  // was done already when it opened (after Back) waits until the student undoes and does it again.
  // Run started on any step but Run ends the tour.
  useEffect(() => {
    const check = step.done;
    let runStarted = false;
    let lastRunning = run.getSnapshot().running;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const runState = (): TourRunState => ({ startedThisStep: runStarted, running: run.getSnapshot().running });
    const evaluate = () => {
      const state = useVamsStore.getState();
      return !!check && check(state, state.tourStepBaseline, runState());
    };
    const cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        if (evaluate()) useVamsStore.getState().nextTourStep();
      }, TOUR_ADVANCE_MS);
    };
    let armed = !evaluate();
    const reevaluate = (edited: boolean) => {
      if (!evaluate()) {
        armed = true;
        cancel();
        return;
      }
      if (armed && (timer === null || edited)) schedule();
    };
    const offStore = useVamsStore.subscribe((state, prev) => reevaluate(state.objects !== prev.objects));
    const offRun = run.subscribe(() => {
      const nowRunning = run.getSnapshot().running;
      if (nowRunning && !lastRunning) {
        if (index === RUN_STEP) runStarted = true;
        else useVamsStore.getState().endTour();
      }
      lastRunning = nowRunning;
      reevaluate(false);
    });
    return () => {
      offStore();
      offRun();
      cancel();
    };
  }, [index, step, run]);

  // Right or Enter go on, Left goes back, Esc ends the tour. Fields keep every key; widgets that use
  // arrows keep them; a shape being placed keeps Enter (finish) and Esc (cancel); a focused button keeps Enter.
  // The listener captures on document, so it runs before the editor's own key handlers.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (isField(target)) return;
      const placing = useVamsStore.getState().interactionMode === 'VERTEX_PLACE';
      let act: (() => void) | null = null;
      if (event.key === 'ArrowRight' && !target?.closest(ARROW_KEY_OWNERS)) act = index < LAST_STEP ? actions.next : null;
      else if (event.key === 'Enter' && !placing && !target?.closest('button, a, [role="button"]')) act = index < LAST_STEP ? actions.next : null;
      else if (event.key === 'ArrowLeft' && !target?.closest(ARROW_KEY_OWNERS)) act = actions.back;
      else if (event.key === 'Escape' && !placing && !target?.closest('[role="menu"], [role="alertdialog"]')) {
        const otherDialog = target?.closest('[role="dialog"]');
        if (!otherDialog || otherDialog === calloutRef.current) act = actions.end;
      }
      if (!act) return;
      event.preventDefault();
      event.stopPropagation();
      act();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [index, actions]);

  const ctx: TourCaptionContext = {
    state: { objects, selectedObjectId, interactionMode, codePane },
    baseline,
    codeName,
    spun,
  };
  const tryIt = step.tryIt?.(ctx) ?? null;
  const canSpin = index === RUN_STEP && !running && spinTarget({ objects, selectedObjectId }) !== null;
  const position = placeCallout(layout.boxes, layout.viewport, calloutSize);

  return (
    <div ref={layerRef} className={lifted ? 'tour is-lifted' : 'tour'}>
      {!lifted && (
        <svg className="tour__scrim" aria-hidden="true">
          <defs>
            <mask id={`${id}-mask`}>
              <rect width="100%" height="100%" fill="white" />
              {layout.boxes.map((box, i) => (
                <rect key={i} x={box.left} y={box.top} width={box.width} height={box.height} fill="black" />
              ))}
            </mask>
          </defs>
          <rect className="tour__shade" width="100%" height="100%" mask={`url(#${id}-mask)`} />
        </svg>
      )}
      {!lifted &&
        layout.boxes.map((box, i) => (
          <div key={i} className="tour__outline" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
        ))}
      <div
        ref={calloutRef}
        className="tour-callout"
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${id}-step`}
        aria-describedby={`${id}-caption`}
        tabIndex={-1}
        style={{ left: position.left, top: position.top }}
      >
        <p id={`${id}-step`} className="tour-callout__step">Step {index + 1} of {TOUR_STEP_COUNT}</p>
        <p id={`${id}-caption`} className="tour-callout__caption">
          <RichText text={step.caption(ctx)} />
        </p>
        {tryIt && (
          <p className="tour-callout__try">
            <Hand size={14} aria-hidden="true" />
            <span><RichText text={tryIt} /></span>
          </p>
        )}
        {canSpin && (
          <div className="tour-callout__try">
            <Hand size={14} aria-hidden="true" />
            <Button onClick={spin}>Make it spin</Button>
          </div>
        )}
        <p className="sr-only" aria-live="polite">{`Tour step ${index + 1} of ${TOUR_STEP_COUNT}: ${step.title}`}</p>
        <div className="tour-callout__actions">
          {index < LAST_STEP ? (
            <button type="button" className="tour-callout__skip" onClick={actions.end}>Skip tour</button>
          ) : (
            <span />
          )}
          <span className="tour-callout__nav">
            <Button disabled={index === 0} onClick={actions.back}>Back</Button>
            {index < LAST_STEP ? (
              <Button variant="primary" onClick={actions.next}>Next</Button>
            ) : (
              <>
                <Button onClick={actions.end}>Explore on my own</Button>
                <Button variant="primary" onClick={learn}>Start learning</Button>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
