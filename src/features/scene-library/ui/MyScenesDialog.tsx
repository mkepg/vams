import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { sanitizeProjectData } from '@/entities/project/model/project-io';
import { getSceneLibrary, MAX_NAME_LENGTH, type SceneEntry } from '@/entities/project/model/scene-library';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';
import { useMyScenesDialog } from '../model/dialog-store';
import { backupLabel, downloadEntry, isSceneEmpty, replaceScene, saveCurrentScene } from '../model/scene-ops';
import './my-scenes.scss';

const STORED_HERE = 'Scenes are stored in this browser. Clearing site data removes them — use Download to keep a copy.';
const TAB_ONLY = 'This browser is not keeping scenes after you close the tab. Use Download to keep a copy.';
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function defaultName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Scene ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function MyScenesDialog() {
  const isOpen = useMyScenesDialog((state) => state.isOpen);
  if (!isOpen) return null;
  return <MyScenesDialogInner />;
}

function MyScenesDialogInner() {
  const close = useMyScenesDialog((state) => state.close);
  const sceneEmpty = useVamsStore(isSceneEmpty);
  const [entries, setEntries] = useState<SceneEntry[] | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [name, setName] = useState(defaultName);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    const library = await getSceneLibrary();
    const list = await library.list();
    if (!aliveRef.current) return;
    setPersistent(library.persistent);
    setEntries(list);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => nameRef.current?.focus());
    // Loading from IndexedDB on open: the async result arrives after the effect, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch((error) => console.error(error));
    return () => {
      aliveRef.current = false;
      previouslyFocused?.focus?.();
    };
  }, [refresh]);

  /** Run an action, report a failure as a toast, and re-read the list either way. */
  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
    } catch (error) {
      console.error(error);
      toast.error(failure);
    }
    await refresh().catch((error) => console.error(error));
  };

  const onSave = (event: Event) => {
    event.preventDefault();
    void run(async () => {
      // Read the field itself: a state update from the latest keystroke may not have rendered yet.
      const saved = await saveCurrentScene(nameRef.current?.value ?? name);
      toast.success(`Saved ‘${saved.name}’`);
      setName(defaultName());
    }, "Couldn't save the scene. The browser's storage may be full; use Download to keep a copy.");
  };

  const onOpen = (entry: SceneEntry) =>
    run(async () => {
      if (!entry.file) return;
      const { detached } = await replaceScene(sanitizeProjectData(entry.file.data), {
        reason: 'library-open',
        label: backupLabel(entry.name),
      });
      close();
      toast.success(`Opened ‘${entry.name}’`);
      if (detached > 0) toast.message('Some textures could not be loaded and were detached.');
    }, "Couldn't keep a backup of the current scene, so it was left as it is.");

  const onRename = (entry: SceneEntry, value: string) =>
    run(async () => {
      await (await getSceneLibrary()).rename(entry.id, value);
      setRenaming(null);
    }, "Couldn't rename the scene.");

  const onDelete = (entry: SceneEntry) =>
    run(async () => {
      const ok = await confirm({
        title: `Delete ‘${entry.name}’?`,
        message: 'This removes it from My scenes in this browser.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (ok) await (await getSceneLibrary()).remove(entry.id);
    }, "Couldn't delete the scene.");

  const onDownload = (entry: SceneEntry) => {
    try {
      downloadEntry(entry);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't download the scene.");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  const saved = entries?.filter((e) => e.kind === 'saved') ?? [];
  const backups = entries?.filter((e) => e.kind === 'backup') ?? [];

  const renderRow = (entry: SceneEntry) => {
    const edit = renaming !== null && renaming.id === entry.id ? renaming : null;
    return (
      <li className="my-scenes__row" key={entry.id}>
        <div className="my-scenes__meta">
          {edit ? (
            <input
              className="my-scenes__rename"
              aria-label={`New name for ${entry.name}`}
              value={edit.value}
              maxLength={MAX_NAME_LENGTH}
              ref={(el) => el?.focus()}
              onInput={(e) => setRenaming({ id: entry.id, value: e.currentTarget.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onRename(entry, e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <span className="my-scenes__name">{entry.name}</span>
          )}
          <time className="my-scenes__time" dateTime={new Date(entry.updatedAt).toISOString()}>
            {timeFormat.format(entry.updatedAt)}
          </time>
        </div>
        <div className="my-scenes__actions">
          {edit ? (
            <>
              <button type="button" className="my-scenes__btn" onClick={() => void onRename(entry, edit.value)}>
                Save name
              </button>
              <button type="button" className="my-scenes__btn" onClick={() => setRenaming(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {entry.file && (
                <button type="button" className="my-scenes__btn" aria-label={`Open ${entry.name}`} onClick={() => void onOpen(entry)}>
                  Open
                </button>
              )}
              {entry.kind === 'saved' && (
                <button
                  type="button"
                  className="my-scenes__btn"
                  aria-label={`Rename ${entry.name}`}
                  onClick={() => setRenaming({ id: entry.id, value: entry.name })}
                >
                  Rename
                </button>
              )}
              <button type="button" className="my-scenes__btn" aria-label={`Download ${entry.name}`} onClick={() => onDownload(entry)}>
                Download
              </button>
              <button
                type="button"
                className="my-scenes__btn my-scenes__btn--danger"
                aria-label={`Delete ${entry.name}`}
                onClick={() => void onDelete(entry)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  const renderList = (id: 'saved' | 'backups', title: string, items: SceneEntry[], empty: string) => (
    <section className="my-scenes__section" aria-labelledby={`my-scenes-${id}`}>
      <h3 id={`my-scenes-${id}`} className="my-scenes__heading">{title}</h3>
      {entries === null ? (
        <p className="my-scenes__empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="my-scenes__empty">{empty}</p>
      ) : (
        <ul className="my-scenes__list" data-list={id}>
          {items.map(renderRow)}
        </ul>
      )}
    </section>
  );

  return (
    <div className="my-scenes-overlay" onMouseDown={close}>
      <div
        className="my-scenes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-scenes-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="my-scenes__header">
          <h2 id="my-scenes-title">My scenes</h2>
          <button type="button" className="my-scenes__close" onClick={close} aria-label="Close My scenes">
            <X size={18} aria-hidden />
          </button>
        </header>

        <form className="my-scenes__save" onSubmit={onSave}>
          <label htmlFor="my-scenes-name">Save current scene</label>
          <div className="my-scenes__save-row">
            <input
              id="my-scenes-name"
              ref={nameRef}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              aria-describedby={sceneEmpty ? 'my-scenes-empty-hint' : undefined}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <button type="submit" className="my-scenes__btn my-scenes__btn--primary" disabled={sceneEmpty}>
              Save
            </button>
          </div>
          {sceneEmpty && (
            <p id="my-scenes-empty-hint" className="my-scenes__hint">
              Add something to the canvas first.
            </p>
          )}
        </form>

        {renderList('saved', 'Saved', saved, 'Nothing saved yet.')}
        {renderList('backups', 'Backups (last 5 are kept)', backups, 'No backups yet.')}

        <p className="my-scenes__note">{persistent ? STORED_HERE : TAB_ONLY}</p>
      </div>
    </div>
  );
}
