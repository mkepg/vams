import { readLabFiles, useLabStore } from '@/entities/lab-project';
import { useShareDialog } from '../model/dialog-store';
import { LAB_SHARE_COPY, prepareLabShare } from '../model/lab-share';
import { ShareDialogFrame } from './ShareDialogFrame';

const prepare = async () => prepareLabShare({ source: useLabStore.getState().source, files: await readLabFiles() });
const qrName = () => LAB_SHARE_COPY.qrName;

/** The Lab's Share dialog: the editor's, for the code and its files. Save is the Lab's own. */
export default function LabShareDialog({ onSaveFile }: { onSaveFile: () => void }) {
  const open = useShareDialog((s) => s.open);
  if (!open) return null;
  return (
    <ShareDialogFrame
      title={LAB_SHARE_COPY.title}
      lead={LAB_SHARE_COPY.lead}
      prepare={prepare}
      prepareKey="lab"
      saveLabel={LAB_SHARE_COPY.save}
      saveInsteadLabel={LAB_SHARE_COPY.saveInstead}
      onSaveFile={onSaveFile}
      qrName={qrName}
    />
  );
}
