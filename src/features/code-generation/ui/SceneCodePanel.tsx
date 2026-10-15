import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import CodeViewer from '@/shared/ui/code-viewer/CodeViewer';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { sanitizeName } from '@/features/code-generation/model/generator/utils';
import { locateHandlerBranch } from '@/features/code-generation/model/locate-branch';
import { findCallLine, outlineCode, stateFieldAt } from '@/features/code-generation/model/code-outline';
import { visibleRows } from '@/features/code-generation/model/code-folds';
import { useValueMarks } from '@/features/code-generation/model/use-value-marks';
import { explainLine, noteFor, type ExplainScene } from '@/features/code-generation/model/code-explanations';
import { JOURNEY_STAGE_TITLES } from '@/core/inspector';
import type { CodeNote, CodeStrip } from '@/shared/ui/code-viewer/types';
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
  const sceneSwapSeq = useVamsStore((s) => s.sceneSwapSeq);
  const callbacks = useVamsStore((s) => s.callbacks);
  const changedCodeLines = useVamsStore((s) => s.changedCodeLines);
  const viewportLimits = useVamsStore((s) => s.viewportLimits);
  const opened = useVamsStore((s) => s.codeFoldsOpened);
  const toggleCodeFold = useVamsStore((s) => s.toggleCodeFold);
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const explainedLine = useVamsStore((s) => s.explainedLine);
  const setExplainedLine = useVamsStore((s) => s.setExplainedLine);
  const codeNotes = useVamsStore((s) => s.codeNotes);
  const setCodeNotes = useVamsStore((s) => s.setCodeNotes);
  const setCodePane = useVamsStore((s) => s.setCodePane);
  const setJourneyStageOverride = useVamsStore((s) => s.setJourneyStageOverride);
  const revealGroup = useVamsStore((s) => s.revealGroup);
  const selectObject = useVamsStore((s) => s.selectObject);
  const explainRequest = useVamsStore((s) => s.explainRequest);
  const requestExplain = useVamsStore((s) => s.requestExplain);
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

  const scene = useMemo<ExplainScene>(
    () => ({ objects, viewportLimits, canvasBackgroundColor, canvas: canvasSize, textures: getAllTextures() }),
    [objects, viewportLimits, canvasBackgroundColor, canvasSize, getAllTextures],
  );
  const explainable = useMemo(
    () => new Set(outline.lines.flatMap((l, i) => (l.explainable && explainLine(i, outline, scene) ? [i] : []))),
    [outline, scene],
  );
  // explainedLine is a raw index: when the program gains or loses lines, it no longer names the same line.
  const lineCount = outline.lines.length;
  const lastCount = useRef(lineCount);
  useEffect(() => {
    if (lastCount.current === lineCount) return;
    lastCount.current = lineCount;
    if (useVamsStore.getState().explainedLine !== null) setExplainedLine(null);
  }, [lineCount, setExplainedLine]);
  const toggleNotes = useCallback(() => setCodeNotes(!useVamsStore.getState().codeNotes), [setCodeNotes]);
  const explained = explainedLine !== null && explainable.has(explainedLine) ? explainedLine : null;

  const selected = objects.find((o) => o.id === selectedObjectId);
  const selection = selected ? sanitizeName(selected.name) : null;
  const isLessonMode = appMode === 'Lesson';

  // The math named a GL call; explain the selected object's line that makes it.
  // After the effect above, so a request that arrives with a line-count change is not closed at once.
  useEffect(() => {
    if (!explainRequest) return;
    const line = findCallLine(outline, selection, explainRequest);
    if (line !== null) setExplainedLine(line);
    requestExplain(null);
  }, [explainRequest, outline, selection, setExplainedLine, requestExplain]);

  const flashLines = useMemo(
    () => (flashBranch ? locateHandlerBranch(generatedCode, flashBranch.handlerName, flashBranch.trigger) : NO_LINES),
    [flashBranch, generatedCode],
  );
  const { marks, key: marksKey } = useValueMarks(generatedCode, canvasSize, `${appMode}:${activeLessonId ?? ''}:${sceneSwapSeq}`, selectedObjectId);
  const [findLine, setFindLine] = useState<number | null>(null);
  const lessonLines = isLessonMode ? changedCodeLines : NO_LINES;

  const rows = useMemo(() => {
    const forced = [...lessonLines, ...marks.map((m) => m.line), ...flashLines, ...(findLine === null ? [] : [findLine]), ...(explained === null ? [] : [explained])];
    return visibleRows(outline, selection, opened, forced);
  }, [outline, selection, opened, lessonLines, marks, flashLines, findLine, explained]);

  // What scrolls into view: Run's fired branch, else a lesson's highlight, else the changed values.
  const revealLines = useMemo(() => {
    if (flashLines.length > 0) return flashLines;
    return lessonLines.length > 0 ? lessonLines : marks.map((m) => m.line);
  }, [flashLines, lessonLines, marks]);

  // A note's value is amber when the student's last edit changed the state field it shows.
  const changedRefs = useMemo(
    () => new Set(marks.flatMap((m) => {
      const ref = stateFieldAt(outline.lines[m.line]?.text ?? '', m.start);
      return ref ? [ref] : [];
    })),
    [marks, outline],
  );
  const notes = useMemo(() => {
    const map = new Map<number, CodeNote>();
    for (const row of rows) {
      if (row.kind !== 'line') continue;
      const parts = noteFor(row.line, outline, scene);
      if (parts) map.set(row.line, parts.map((p) => (typeof p === 'string' ? { text: p } : { text: p.value, changed: changedRefs.has(p.ref) })));
    }
    return map;
  }, [rows, outline, scene, changedRefs]);

  const strip = useMemo<CodeStrip | null>(() => {
    if (explained === null) return null;
    const e = explainLine(explained, outline, scene);
    if (!e) return null;
    const links: CodeStrip['links'] = [];
    if (e.stage) {
      const stage = e.stage;
      links.push({ label: `See the math: ${JOURNEY_STAGE_TITLES[stage]}`, onSelect: () => { setJourneyStageOverride(stage); setCodePane('math'); } });
    }
    if (e.control) {
      const { group, objectId, label } = e.control;
      links.push({
        label: `Open ${label}`,
        onSelect: () => {
          // Select the line's object first: a new selection clears the outline, so revealing comes second.
          if (objectId && objectId !== selectedObjectId) selectObject(objectId);
          revealGroup(group);
        },
      });
    }
    return { signature: e.signature, text: e.text, values: e.values, links };
  }, [explained, outline, scene, selectedObjectId, selectObject, revealGroup, setCodePane, setJourneyStageOverride]);

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
      explainable={explainable}
      explainedLine={explained}
      onExplain={setExplainedLine}
      strip={strip}
      notes={notes}
      notesOn={codeNotes}
      onToggleNotes={toggleNotes}
    />
  );
}
