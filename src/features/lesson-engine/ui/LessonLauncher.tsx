import { GraduationCap, PlayCircle } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { MenuButton, type MenuEntry } from '@/shared/ui/controls';
import { LESSON_REGISTRY } from '../model/lesson-registry';

export default function LessonLauncher() {
  const activeSection = useVamsStore((s) => s.activeSection);
  const appMode = useVamsStore((s) => s.appMode);
  const setActiveLesson = useVamsStore((s) => s.setActiveLesson);
  const setAppMode = useVamsStore((s) => s.setAppMode);

  if (appMode === 'Lesson') return null;

  const sectionLessons = Object.values(LESSON_REGISTRY).filter((l) => l.section === activeSection);
  const launch = (id: string) => {
    setActiveLesson(id);
    setAppMode('Lesson');
  };
  const group = (type: 'demo' | 'exercise', label: string): MenuEntry[] => {
    const lessons = sectionLessons.filter((l) => l.type === type);
    const items: MenuEntry[] = lessons.length
      ? lessons.map((l) => ({
          kind: 'item' as const,
          id: l.id,
          label: l.title,
          description: `${l.steps.length} steps`,
          icon: type === 'demo' ? <PlayCircle /> : <GraduationCap />,
          onSelect: () => launch(l.id),
        }))
      : [{ kind: 'item' as const, id: `${type}-none`, label: `No ${label.toLowerCase()} in this section`, disabled: true, onSelect: () => {} }];
    return [{ kind: 'group', id: `group-${type}`, label }, ...items];
  };

  return (
    <MenuButton
      label="Lessons"
      title="Browse lessons for this section"
      icon={<GraduationCap />}
      entries={[...group('demo', 'Demos'), ...group('exercise', 'Exercises')]}
      align="end"
    >
      Lessons
    </MenuButton>
  );
}
