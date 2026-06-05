import { useMemo } from 'react';
import { useVamsStore } from "@/core/store";
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { useCanvasSize } from '@/features/code-generation/model/useCanvasSize';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { resolveChangedLines } from '@/features/code-generation/model/code-diff';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { GLUT_BOILERPLATE_ANNOTATIONS } from '@/features/code-generation/model/glut-annotations';
import { useAnimationPreview } from '@/features/animation-preview/model/useAnimationPreview';

export default function SceneCodePanel() {
  const objects = useVamsStore(s => s.objects);
  const selectedObjectId = useVamsStore(s => s.selectedObjectId);
  const canvasBackgroundColor = useVamsStore(s => s.canvasBackgroundColor);
  const appMode = useVamsStore(s => s.appMode);
  const activeSection = useVamsStore(s => s.activeSection);
  const callbacks = useVamsStore(s => s.callbacks);
  const changedCodeLines = useVamsStore(s => s.changedCodeLines);
  const viewportLimits = useVamsStore(s => s.viewportLimits);
  const canvasSize = useCanvasSize();
  const getAllTextures = useVamsStore((s) => s.getAllTextures);

  // Re-render on uploads:
  useVamsStore((s) => s.uploadedTextures);

  // Live Animation-Preview snapshot. While a preview plays in Author Mode, the
  // previewed motion overrides that object's effective animation so the main
  // code panel reflects the real `animate_<name>()` / `_vams_idle()` structure.
  // Saved animations always appear (they live on the object). The override
  // itself is a transient derived view — never written to state or saved.
  const anim = useAnimationPreview();
  const previewObj =
    appMode === 'Author' && anim.playing && anim.objectId
      ? objects.find((o) => o.id === anim.objectId)
      : undefined;
  const previewAnimation = useMemo(
    () =>
      previewObj && previewObj.visible
        ? { objectId: previewObj.id, motion: anim.motion, speed: anim.speed }
        : undefined,
    [previewObj, anim.motion, anim.speed],
  );

  const selectedObject = objects.find(o => o.id === selectedObjectId);
  const highlightTarget = selectedObject ? sanitizeName(selectedObject.name) : null;

  const baseCode = useMemo(
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

  const previewCode = useMemo(
    () =>
      previewAnimation
        ? generateCodeFromState(
            {
              objects,
              canvasBackgroundColor,
              callbacks,
              viewportLimits,
              textures: getAllTextures(),
              previewAnimation,
            },
            canvasSize,
          )
        : null,
    [previewAnimation, objects, canvasBackgroundColor, callbacks, canvasSize, viewportLimits, getAllTextures],
  );

  const generatedCode = previewCode ?? baseCode;

  // While previewing, amber-highlight the idle machinery that lit up (the diff
  // against the non-preview program). Lesson mode keeps its own change focus.
  const previewChanged = useMemo(
    () => (previewCode ? resolveChangedLines(baseCode, previewCode) : undefined),
    [baseCode, previewCode],
  );

  const showAnnotations = activeSection === 'Pipeline' && objects.length === 0;
  const isLessonMode = appMode === 'Lesson';
  const changedLines = isLessonMode ? changedCodeLines : previewChanged;
  return (
    <CodeViewer
      code={generatedCode}
      highlightTarget={highlightTarget}
      isLessonMode={isLessonMode}
      annotations={showAnnotations ? GLUT_BOILERPLATE_ANNOTATIONS : undefined}
      changedLines={changedLines}
    />
  );
}
