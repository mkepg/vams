import './scene-title.scss';
import { useEffect, useRef, useState } from 'react';
import { useVamsStore } from '@/core/store';
import { useSaveStatus, type SaveStatus } from '../model/autosave';

const STATE_TEXT: Record<SaveStatus, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved' };

interface SceneTitleProps {
  /** During a lesson, the text that replaces the name and the save state. */
  lessonLabel?: string | null;
}

/** The working scene's name and save state; during a lesson, the lesson and its step. */
export default function SceneTitle({ lessonLabel = null }: SceneTitleProps) {
  const sceneName = useVamsStore((s) => s.sceneName);
  const renameScene = useVamsStore((s) => s.renameScene);
  const status = useSaveStatus((s) => s.status);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sceneName);
  const nameRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);
  // Removing the input fires blur; once a finish has run, that blur must not run another.
  const finished = useRef(false);

  useEffect(() => {
    if (editing) {
      finished.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      nameRef.current?.focus();
    }
  }, [editing]);

  if (lessonLabel) {
    if (editing) setEditing(false);
    return <span className="scene-title scene-title--lesson">{lessonLabel}</span>;
  }

  const finish = (save: boolean, value = draft) => {
    if (finished.current) return;
    finished.current = true;
    if (save) renameScene(value);
    returnFocus.current = true;
    setEditing(false);
  };

  return (
    <span className="scene-title">
      {editing ? (
        <input
          ref={inputRef}
          className="scene-title__input"
          aria-label="Scene name"
          maxLength={80}
          value={draft}
          onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finish(true, e.currentTarget.value);
            if (e.key === 'Escape') {
              e.stopPropagation();
              finish(false);
            }
          }}
          onBlur={(e) => finish(true, e.currentTarget.value)}
        />
      ) : (
        <button
          ref={nameRef}
          type="button"
          className="scene-title__name"
          title="Rename this scene"
          aria-label={`${sceneName}, rename`}
          onClick={() => {
            finished.current = false;
            setDraft(sceneName);
            setEditing(true);
          }}
        >
          {sceneName}
        </button>
      )}
      <span
        className={`scene-title__state is-${status}`}
        aria-live="polite"
        title={status === 'error' ? 'Your browser refused to save to its storage. Save a project file to keep this work.' : undefined}
      >
        {STATE_TEXT[status]}
      </span>
    </span>
  );
}
