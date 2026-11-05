import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { buildProjectFile, createDefaultProjectFilename, downloadJSON } from '@/entities/project/model/project-io';
import { prepareShare, type ShareResult } from '../model/share-flow';
import { useShareDialog } from '../model/dialog-store';
import { ShareDialogFrame, ShareResultBody } from './ShareDialogFrame';

const sceneName = () => useVamsStore.getState().sceneName;

/** The link, its notes and the QR code for one result. Exported for tests. */
export function ShareResultView({ result, onSaveFile }: { result: ShareResult; onSaveFile: () => void }) {
  return <ShareResultBody result={result} onSaveFile={onSaveFile} saveLabel="Save project file" qrName={sceneName} />;
}

function saveFile() {
  try {
    downloadJSON(createDefaultProjectFilename(), buildProjectFile(useVamsStore.getState()));
    toast.success('Project saved');
  } catch (error) {
    console.error(error);
    toast.error('Failed to save project');
  }
}

/** Mounted only while the dialog is open, so its result starts empty each time. */
function ShareDialogBody({ lessonTitle }: { lessonTitle: string | null }) {
  const name = useVamsStore((s) => s.sceneName);
  const lessonId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.activeLessonId : null));

  const prepare = () => {
    const s = useVamsStore.getState();
    return prepareShare({
      sceneName: s.sceneName,
      objects: s.objects,
      callbacks: s.callbacks,
      viewportLimits: s.viewportLimits,
      canvasBackgroundColor: s.canvasBackgroundColor,
      textures: s.getAllTextures(),
      lesson: lessonId ? { id: lessonId, title: lessonTitle ?? '' } : null,
    });
  };

  return (
    <ShareDialogFrame
      title={lessonId ? 'Share this lesson' : `Share ‘${name}’`}
      // The lesson link's own note says who can open it, so the lead is for scenes only.
      lead={lessonId ? null : 'Anyone with the link opens a copy of this scene. On a phone it opens as a view.'}
      prepare={prepare}
      prepareKey={JSON.stringify([lessonId, lessonTitle])}
      saveLabel="Save project file"
      saveInsteadLabel={lessonId ? null : 'Save project file instead'}
      onSaveFile={saveFile}
      qrName={sceneName}
    />
  );
}

export default function ShareDialog({ lessonTitle }: { lessonTitle: string | null }) {
  const open = useShareDialog((s) => s.open);
  return open ? <ShareDialogBody lessonTitle={lessonTitle} /> : null;
}
