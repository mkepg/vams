import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from "@/core/store";
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { useCanvasSize } from '@/features/code-generation/model/useCanvasSize';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { GLUT_BOILERPLATE_ANNOTATIONS } from '@/features/code-generation/model/glut-annotations';
import { resolveChangedLines } from '@/features/code-generation/model/code-diff';
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';
import type { RuleTrigger } from '@/core/types/scene';

interface SceneCodePanelProps {
  /** The handler branch Run just fired; its lines flash in the code. */
  flashBranch?: { handlerName: string; trigger: RuleTrigger | null; seq: number } | null;
  headerLead?: ComponentChildren;
  headerTrail?: ComponentChildren;
}

export default function SceneCodePanel({ flashBranch, headerLead, headerTrail }: SceneCodePanelProps = {}) {
  const objects = useVamsStore(s => s.objects);
  const selectedObjectId = useVamsStore(s => s.selectedObjectId);
  const canvasBackgroundColor = useVamsStore(s => s.canvasBackgroundColor);
  const appMode = useVamsStore(s => s.appMode);
  const callbacks = useVamsStore(s => s.callbacks);
  const changedCodeLines = useVamsStore(s => s.changedCodeLines);
  const viewportLimits = useVamsStore(s => s.viewportLimits);
  const canvasSize = useCanvasSize();
  const getAllTextures = useVamsStore((s) => s.getAllTextures);

  // Re-render on uploads:
  useVamsStore((s) => s.uploadedTextures);

  const selectedObject = objects.find(o => o.id === selectedObjectId);
  const highlightTarget = selectedObject ? sanitizeName(selectedObject.name) : null;

  const generatedCode = useMemo(
    () =>
      generateCodeFromState(
        {
          objects,
          canvasBackgroundColor,
          callbacks,
          viewportLimits,
          textures: getAllTextures(),
        },
        canvasSize,
      ),
    [objects, canvasBackgroundColor, callbacks, canvasSize, viewportLimits, getAllTextures],
  );

  const showAnnotations = objects.length === 0;
  const isLessonMode = appMode === 'Lesson';
  const flashLines = useMemo(
    () => (flashBranch ? locateHandlerBranch(generatedCode, flashBranch.handlerName, flashBranch.trigger) : []),
    [flashBranch, generatedCode],
  );
  // While the tour runs, the lines an edit changes flash as they do in a lesson.
  const tourStep = useVamsStore((s) => s.tourStep);
  const [tourFlash, setTourFlash] = useState<number[]>([]);
  const lastTourCode = useRef<{ code: string; width: number; height: number } | null>(null);
  useEffect(() => {
    const last = lastTourCode.current;
    lastTourCode.current = tourStep === null ? null : { code: generatedCode, width: canvasSize.width, height: canvasSize.height };
    if (tourStep === null || !last) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTourFlash([]);
      return;
    }
    // A canvas resize changes only glutInitWindowSize; that is not the student's edit.
    if (last.code === generatedCode || last.width !== canvasSize.width || last.height !== canvasSize.height) return;
    setTourFlash(resolveChangedLines(last.code, generatedCode));
  }, [generatedCode, canvasSize, tourStep]);

  const changedLines = flashLines.length > 0
    ? flashLines
    : isLessonMode ? changedCodeLines : tourStep !== null ? tourFlash : undefined;
  return (
    <CodeViewer
      code={generatedCode}
      highlightTarget={highlightTarget}
      isLessonMode={isLessonMode}
      annotations={showAnnotations ? GLUT_BOILERPLATE_ANNOTATIONS : undefined}
      changedLines={changedLines}
      headerLead={headerLead}
      headerTrail={headerTrail}
    />
  );
}
