import { useRef, useState } from 'react';
import { useLabStore, type LabFile } from '@/entities/lab-project';
import { Button } from '@/shared/ui/controls';
import { BROWSER_SAVE_FAILED } from '../model/browser-save';
import { addUploads } from '../model/open';
import { downloadBlob } from '../model/save';
import './file-list.scss';

export interface FileListProps {
  /** The files the program wrote in its last run, offered for download. */
  written: readonly LabFile[];
  /**
   * A line from outside the list, such as what Open takes. Each new object takes the place of
   * what the list said last; one whose text is null clears it.
   */
  notice?: { text: string | null } | null;
}

/** What the input offers; the list itself checks each file by its extension. */
const ACCEPT = '.png,.jpg,.jpeg,.bmp,.txt,image/png,image/jpeg,image/bmp,text/plain';

/** The images and text files the program opens, beside main.cpp, and the files it wrote. */
export default function FileList({ written, notice }: FileListProps) {
  const files = useLabStore((s) => s.files);
  const saveFailed = useLabStore((s) => s.browserSaveFailed);
  const input = useRef<HTMLInputElement>(null);
  const [said, setSaid] = useState<{ lines: string[]; notice: FileListProps['notice'] }>({ lines: notice?.text ? [notice.text] : [], notice });
  // A new notice takes the place of what the list said last.
  if (notice !== said.notice) setSaid({ lines: notice?.text ? [notice.text] : [], notice });

  const add = async (event: Event) => {
    const field = event.currentTarget as HTMLInputElement;
    const uploads = [...(field.files ?? [])];
    field.value = '';
    if (uploads.length > 0) setSaid({ lines: await addUploads(uploads), notice });
  };

  return (
    <section className="lab-files" aria-labelledby="lab-files-title">
      <h2 id="lab-files-title" className="lab-files__title">
        Files
      </h2>
      <ul className="lab-files__list">
        {files.map((f) => (
          <li key={f.name} className="lab-files__item">
            <span className="lab-files__name">{f.name}</span>
            <button
              type="button"
              className="lab-files__action"
              aria-label={`Remove ${f.name}`}
              title={`Remove ${f.name}`}
              onClick={() => {
                setSaid({ lines: [], notice });
                void useLabStore.getState().removeFile(f.name);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
        {written.map((f) => (
          <li key={`written-${f.name}`} className="lab-files__item lab-files__item--written">
            <span className="lab-files__written-name">{f.name}</span>
            <span className="lab-files__from">written by your program</span>
            <button
              type="button"
              className="lab-files__action"
              aria-label={`Download ${f.name}`}
              title={`Download ${f.name}`}
              onClick={() => downloadBlob(f.name, new Blob([f.bytes as Uint8Array<ArrayBuffer>], { type: f.type }))}
            >
              <span aria-hidden="true">↓</span>
            </button>
          </li>
        ))}
      </ul>
      {files.length === 0 && written.length === 0 ? <p className="lab-files__empty">Add the images and .txt files your program opens.</p> : null}
      <Button variant="quiet" className="lab-files__add" onClick={() => input.current?.click()}>
        Add files
      </Button>
      <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(event) => void add(event)} />
      {saveFailed ? (
        <p className="lab-files__warning" role="alert">
          {BROWSER_SAVE_FAILED}
        </p>
      ) : null}
      {said.lines.length > 0 ? (
        <p className="lab-files__message" role="status">
          {said.lines.join(' ')}
        </p>
      ) : null}
    </section>
  );
}
