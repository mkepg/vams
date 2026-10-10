import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { getPreset, isPresetSlug } from '@/entities/project/model/scene-presets';
import { getLessonById } from '@/features/lesson-engine/model/lesson-registry';
import { recordLessonLeft } from '@/features/lesson-engine/model/progress';
import { backupLabel, replaceScene } from '@/features/scene-library';

/** What a /app URL asks the editor to open: ?lesson=<id> or ?scene=<slug>. */
export type EditorLink =
  | { kind: 'none' }
  | { kind: 'lesson'; id: string }
  | { kind: 'scene'; slug: string }
  | { kind: 'invalid'; param: 'lesson' | 'scene'; value: string };

export interface LinkTargets {
  isLesson(id: string): boolean;
  isScene(slug: string): boolean;
}

const LINK_PARAMS = ['lesson', 'scene'] as const;

const DEFAULT_TARGETS: LinkTargets = {
  isLesson: (id) => getLessonById(id) !== undefined,
  isScene: isPresetSlug,
};

export const INVALID_LINK_MESSAGE = "That link doesn't match a lesson or scene. The editor opened as usual.";

/** A lesson link wins over a scene link when both are present. */
export function parseEditorLink(search: string, targets: LinkTargets = DEFAULT_TARGETS): EditorLink {
  const params = new URLSearchParams(search);
  const lesson = params.get('lesson');
  if (lesson !== null) {
    const id = lesson.trim();
    return id && targets.isLesson(id) ? { kind: 'lesson', id } : { kind: 'invalid', param: 'lesson', value: id };
  }
  const scene = params.get('scene');
  if (scene !== null) {
    const slug = scene.trim();
    return slug && targets.isScene(slug) ? { kind: 'scene', slug } : { kind: 'invalid', param: 'scene', value: slug };
  }
  return { kind: 'none' };
}

export function stripEditorLinkParams(search: string): string {
  const params = new URLSearchParams(search);
  LINK_PARAMS.forEach((name) => params.delete(name));
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

export interface ApplyDeps {
  openLibrary: () => void;
}

/** Drive the store to what the link asks for, using the same actions as the GUI. */
export async function applyEditorLink(link: EditorLink, deps: ApplyDeps): Promise<void> {
  if (link.kind === 'none') return;
  // A linked visitor arrives with a purpose; the welcome card would cover it.
  useVamsStore.getState().markWelcomeSeen();

  if (link.kind === 'invalid') {
    toast.error(INVALID_LINK_MESSAGE);
    return;
  }

  if (link.kind === 'lesson') {
    const lesson = getLessonById(link.id);
    if (!lesson) return;
    const running = useVamsStore.getState();
    if (running.activeLessonId) {
      // As when starting a lesson from Learn, the lesson being replaced is recorded as left mid-way.
      recordLessonLeft(running.activeLessonId, running.currentStepIndex);
      running.clearLessonState();
    }
    const state = useVamsStore.getState();
    state.setActiveSection(lesson.section);
    state.setActiveLesson(lesson.id);
    state.setAppMode('Lesson');
    return;
  }

  const preset = getPreset(link.slug);
  if (!preset) return;
  try {
    const { backedUp } = await replaceScene(preset.data, { reason: 'scene-link', label: backupLabel(preset.title) });
    useVamsStore.getState().setActiveSection(preset.section);
    if (backedUp) {
      toast.success(`Opened ‘${preset.title}’`, {
        description: 'Your previous scene is in My scenes.',
        action: { label: 'My scenes', onClick: deps.openLibrary },
      });
    } else {
      toast.success(`Opened ‘${preset.title}’`);
    }
  } catch (error) {
    console.error(error);
    toast.error(`Couldn't keep a backup of your current scene, so ‘${preset.title}’ was not opened.`);
  }
}
