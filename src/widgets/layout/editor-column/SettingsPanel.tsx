import { useRef } from 'react';
import { useVamsStore } from '@/core/store';
import { PanelLayoutContext } from '@/shared/ui/controls';
import InspectorGroup from './InspectorGroup';
import { SETTINGS_GROUP_DEFS } from './inspector-groups';
import { useGroupFocus } from './use-group-focus';

/** Callbacks has its own rail panel; Task 5 removes it from SETTINGS_GROUP_DEFS and this filter. */
const DEFS = SETTINGS_GROUP_DEFS.filter((def) => def.id !== 'callbacks');

/** Settings for the whole scene: Background, Viewing volume and Texture library. */
export default function SettingsPanel() {
  const hasSelection = useVamsStore((s) => s.selectedObjectId !== null);
  const openGroups = useVamsStore((s) => s.openGroups);
  const toggleGroup = useVamsStore((s) => s.toggleGroup);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => (s.appMode === 'Lesson' ? s.lessonFocusPanel : null));
  const rootRef = useRef<HTMLDivElement>(null);
  const { target, style } = useGroupFocus(DEFS, 'settings', hasSelection, rootRef);

  return (
    <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId, embedded: true }}>
      <section className="rail-panel settings-panel" aria-labelledby="settings-panel-title">
        <header className="rail-panel__head">
          <h2 id="settings-panel-title" className="rail-panel__title">Settings</h2>
          <p className="rail-panel__hint">These apply to the whole scene.</p>
        </header>
        <div ref={rootRef} className="rail-panel__body" data-scroll-root>
          {DEFS.map((def) => (
            <InspectorGroup
              key={def.id}
              id={def.id}
              title={def.title}
              hint={def.hint(null)}
              open={openGroups.includes(def.id)}
              onToggle={() => toggleGroup(def.id)}
              focused={def.id === target}
              dimmed={style === 'tight' && target !== null && def.id !== target}
            >
              {def.render(null)}
            </InspectorGroup>
          ))}
        </div>
      </section>
    </PanelLayoutContext.Provider>
  );
}
