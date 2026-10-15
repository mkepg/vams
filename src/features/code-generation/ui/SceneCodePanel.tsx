import { useMemo, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { useCanvasSize } from '@/features/code-generation/model/useCanvasSize';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';
import { outlineCode } from '@/features/code-generation/model/code-outline';
import { visibleRows } from '@/features/code-generation/model/code-folds';
import { useValueMarks } from '@/features/code-generation/model/use-value-marks';
import type { RuleTrigger } from '@/core/types/scene';

interface SceneCodePanelProps {
  /** The handler branch Run just fired; its lines flash in the code. */
  flashBranch?: { handlerName: string; trigger: RuleTrigger | null; seq: number } | null;
  headerLead?: ComponentChildren;
  headerTrail?: ComponentChildren;
}

const NO_LINES: number[] = [];

export default function SceneCodePanel({ flashBranch, headerLead, headerTrail }: SceneCodePanelProps = {}) {
  const objects = useVamsStore((s) => s.objects);
  const selectedObjectId = useVamsStore((s) => s.selectedObjectId);
  const canvasBackgroundColor = useVamsStore((s) => s.canvasBackgroundColor);
  const appMode = useVamsStore((s) => s.appMode);
  const activeLessonId = useVamsStore((s) => s.activeLessonId);
  const callbacks = useVamsStore((s) => s.callbacks);
  const changedCodeLines = useVamsStore((s) => s.changedCodeLines);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const opened = useVamsStore((s) => s.codeFoldsOpened);
  const toggleCodeFold = useVamsStore((s) => s.toggleCodeFold);
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const canvasSize = useCanvasSize();

  // Re-render on uploads:
  useVamsStore((s) => s.uploadedTextures);

  const generatedCode = useMemo(
    () =>
      generateCodeFromState(
        { objects, canvasBackgroundColor, callbacks, viewportLimits, textures: getAllTextures() },
        canvasSize,
      ),
    [objects, canvasBackgroundColor, callbacks, canvasSize, viewportLimits, getAllTextures],
  );
  const outline = useMemo(() => outlineCode(generatedCode), [generatedCode]);

  const selected = objects.find((o) => o.id === selectedObjectId);
  const selection = selected ? sanitizeName(selected.name) : null;
  const isLessonMode = appMode === 'Lesson';

  const flashLines = useMemo(
    () => (flashBranch ? locateHandlerBranch(generatedCode, flashBranch.handlerName, flashBranch.trigger) : NO_LINES),
    [flashBranch, generatedCode],
  );
  const { marks, key: marksKey } = useValueMarks(generatedCode, canvasSize, `${appMode}:${activeLessonId ?? ''}`, selectedObjectId);
  const [findLine, setFindLine] = useState<number | null>(null);
  const lessonLines = isLessonMode ? changedCodeLines : NO_LINES;

  const rows = useMemo(() => {
    const forced = [...lessonLines, ...marks.map((m) => m.line), ...flashLines, ...(findLine === null ? [] : [findLine])];
    return visibleRows(outline, selection, opened, forced);
  }, [outline, selection, opened, lessonLines, marks, flashLines, findLine]);

  const revealLines = useMemo(() => (lessonLines.length > 0 ? lessonLines : marks.map((m) => m.line)), [lessonLines, marks]);

  return (
    <CodeViewer
      code={generatedCode}
      rows={rows}
      onToggleFold={toggleCodeFold}
      marks={marks}
      marksKey={marksKey}
      revealLines={revealLines}
      firedLines={flashLines}
      onFindLine={setFindLine}
      isLessonMode={isLessonMode}
      headerLead={headerLead}
      headerTrail={headerTrail}
    />
  );
}
