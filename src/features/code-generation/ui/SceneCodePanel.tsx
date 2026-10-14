import { useMemo } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from "@/core/store";
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { useCanvasSize } from '@/features/code-generation/model/useCanvasSize';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { GLUT_BOILERPLATE_ANNOTATIONS } from '@/features/code-generation/model/glut-annotations';
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
  const changedLines = flashLines.length > 0 ? flashLines : isLessonMode ? changedCodeLines : undefined;
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
