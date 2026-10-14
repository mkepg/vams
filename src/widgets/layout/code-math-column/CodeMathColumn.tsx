import { useEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { CodePane } from '@/core/store/types';
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import { useRunSnapshot } from '@/features/callbacks';
import { Button, SegmentedControl } from '@/shared/ui/controls';
import './code-math-column.scss';

/** The right column: the generated code or the math behind it, one at a time, and Hide. */
export default function CodeMathColumn() {
  const { running, fired } = useRunSnapshot();
  const pane = useVamsStore((s) => s.codePane);
  const hidden = useVamsStore((s) => s.codeHidden);
  const unseen = useVamsStore((s) => s.codeChangedUnseen);
  const setCodePane = useVamsStore((s) => s.setCodePane);
  const setCodeHidden = useVamsStore((s) => s.setCodeHidden);
  const markCodeChanged = useVamsStore((s) => s.markCodeChanged);

  // The code is a pure function of these; when one changes while Math shows, Code gets its dot.
  const objects = useVamsStore((s) => s.objects);
  const callbacks = useVamsStore((s) => s.callbacks);
  const background = useVamsStore((s) => s.canvasBackgroundColor);
  const viewport = useVamsStore((s) => s.viewportLimits);
  const textures = useVamsStore((s) => s.uploadedTextures);
  const appMode = useVamsStore((s) => s.appMode);
  const lessonId = useVamsStore((s) => s.activeLessonId);
  const mounted = useRef(false);
  const previous = useRef({ appMode, lessonId });
  useEffect(() => {
    // A lesson starting or ending swaps the whole scene; that is not code changing out of sight.
    const swapped = previous.current.appMode !== appMode || previous.current.lessonId !== lessonId;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!swapped) markCodeChanged();
  }, [objects, callbacks, background, viewport, textures, markCodeChanged, appMode, lessonId]);
  // Declared after the effect above so it compares against the previous render's values.
  useEffect(() => {
    previous.current = { appMode, lessonId };
  });

  // A handler that fires during Run flashes its branch in Code; with Math showing, Code gets the dot.
  const firedSeq = fired?.seq;
  useEffect(() => {
    if (firedSeq !== undefined) markCodeChanged();
  }, [firedSeq, markCodeChanged]);

  if (hidden) {
    return (
      <button type="button" className="code-math-edge" aria-label="Show code and math" onClick={() => setCodeHidden(false)}>
        <PanelRightOpen size={16} aria-hidden="true" />
        <span className="code-math-edge__label">Code &amp; math</span>
      </button>
    );
  }

  const options: { value: CodePane; label: string; adornment?: ComponentChildren }[] = [
    {
      value: 'code',
      label: 'Code',
      adornment: unseen ? (
        <span className="code-math-switch__dot">
          <span className="sr-only">Code changed</span>
        </span>
      ) : undefined,
    },
    { value: 'math', label: 'Math' },
  ];
  const lead = (
    <div className="code-math-switch" data-tour-anchor="code-switch">
      <SegmentedControl label="Code or math" options={options} value={pane} onChange={setCodePane} />
    </div>
  );
  const hide = (
    <Button variant="quiet" iconOnly label="Hide code and math" icon={<PanelRightClose size={14} />} onClick={() => setCodeHidden(true)} />
  );
  const flashBranch = fired ? { handlerName: fired.handlerName, trigger: fired.trigger, seq: fired.seq } : null;

  return (
    <div className="code-math-column">
      {pane === 'code' ? (
        <SceneCodePanel flashBranch={flashBranch} headerLead={lead} headerTrail={hide} />
      ) : (
        <MathPanel headerLead={lead} headerTrail={hide} contentInert={running} />
      )}
    </div>
  );
}
