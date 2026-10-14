import { useRef } from 'react';
import { Layers, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, SquarePlus, Zap, type LucideIcon } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { RailPanel } from '@/core/store/types';
import { CALLBACK_KINDS, isCallbackValid } from '@/core/callbacks/callbacks-model';
import { useNarrowLayout } from '@/shared/hooks/useNarrowLayout';
import './rail.scss';

interface RailItem {
  id: RailPanel;
  label: string;
  icon: LucideIcon;
}

/** Building the scene; the divider then sets Callbacks, which runs it, apart. */
const BUILD: readonly RailItem[] = [
  { id: 'add', label: 'Add', icon: SquarePlus },
  { id: 'scene', label: 'Scene', icon: Layers },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];
const RUN: readonly RailItem[] = [{ id: 'callbacks', label: 'Callbacks', icon: Zap }];

export const RAIL_ORDER: readonly RailPanel[] = ['add', 'scene', 'settings', 'callbacks'];
export const EDITOR_PANEL_ID = 'editor-panel';
export const railTabId = (panel: RailPanel) => `rail-tab-${panel}`;

/** The slim labelled rail: one tab per panel, and Hide. */
export default function Rail() {
  const railPanel = useVamsStore((s) => s.railPanel);
  const railHidden = useVamsStore((s) => s.railHidden);
  const setRailPanel = useVamsStore((s) => s.setRailPanel);
  const setRailHidden = useVamsStore((s) => s.setRailHidden);
  const callbackCount = useVamsStore((s) => CALLBACK_KINDS.filter((kind) => isCallbackValid(s.callbacks, kind)).length);
  const narrow = useNarrowLayout();
  const tabs = useRef<Partial<Record<RailPanel, HTMLButtonElement | null>>>({});

  const choose = (panel: RailPanel) => {
    // On a narrow screen the open panel's own item closes the drawer again.
    if (narrow && panel === railPanel && !railHidden) setRailHidden(true);
    else setRailPanel(panel);
  };

  // Arrow keys move focus between tabs; Enter or Space (the button's own click) opens one.
  const onKeyDown = (event: KeyboardEvent) => {
    const index = RAIL_ORDER.indexOf((event.target as HTMLElement).dataset.panel as RailPanel);
    if (index < 0) return;
    const to = ({ ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: RAIL_ORDER.length - 1 } as Record<string, number>)[event.key];
    if (to === undefined) return;
    event.preventDefault();
    tabs.current[RAIL_ORDER[(to + RAIL_ORDER.length) % RAIL_ORDER.length]]?.focus();
  };

  const tab = (item: RailItem) => {
    const active = !railHidden && item.id === railPanel;
    const Icon = item.icon;
    const badge = item.id === 'callbacks' && callbackCount > 0;
    return (
      <button
        key={item.id}
        ref={(el) => {
          tabs.current[item.id] = el;
        }}
        id={railTabId(item.id)}
        type="button"
        role="tab"
        className={active ? 'rail__tab is-active' : 'rail__tab'}
        aria-selected={active ? 'true' : 'false'}
        aria-controls={EDITOR_PANEL_ID}
        tabIndex={item.id === railPanel ? 0 : -1}
        data-panel={item.id}
        data-tour-anchor={item.id === 'add' ? 'rail-add' : undefined}
        onClick={() => choose(item.id)}
      >
        <span className="rail__pill" aria-hidden="true">
          <Icon size={20} />
          {badge && <span className="rail__badge">{callbackCount}</span>}
        </span>
        <span className="rail__label">{item.label}</span>
        {badge && <span className="sr-only">, {callbackCount} on</span>}
      </button>
    );
  };

  return (
    <nav className="rail" aria-label="Editor">
      <div className="rail__tabs" role="tablist" aria-orientation="vertical" aria-label="Editor panels" onKeyDown={onKeyDown}>
        {BUILD.map(tab)}
        <span className="rail__divider" aria-hidden="true" />
        {RUN.map(tab)}
      </div>
      <button
        type="button"
        className="rail__hide"
        aria-controls={EDITOR_PANEL_ID}
        aria-expanded={!railHidden}
        onClick={() => setRailHidden(!railHidden)}
      >
        <span className="rail__pill" aria-hidden="true">
          {railHidden ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </span>
        <span className="rail__label">{railHidden ? 'Show' : 'Hide'}</span>
      </button>
    </nav>
  );
}
