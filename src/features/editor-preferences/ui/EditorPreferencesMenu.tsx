import { useState } from 'react';
import { Keyboard, Settings } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { readThemeChoice, setThemeChoice, useSiteTheme, type ThemeChoice } from '@/shared/lib/theme';
import { MenuButton, type MenuEntry } from '@/shared/ui/controls';

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

/** The editor's one settings menu: the theme and what the canvas shows. */
export default function EditorPreferencesMenu() {
  // Re-render when the theme changes elsewhere; the counter covers a choice that leaves the applied theme as it was.
  useSiteTheme();
  const [, setChosen] = useState(0);
  const choice = readThemeChoice();
  const axisVisibility = useVamsStore((state) => state.axisVisibility);
  const setAxisVisibility = useVamsStore((state) => state.setAxisVisibility);
  const showCoordinateTracker = useVamsStore((state) => state.showCoordinateTracker);
  const setShowCoordinateTracker = useVamsStore((state) => state.setShowCoordinateTracker);
  const openHelp = useVamsStore((state) => state.openHelp);

  const entries: MenuEntry[] = [
    { kind: 'group', id: 'theme', label: 'Theme' },
    ...THEMES.map((t): MenuEntry => ({
      kind: 'radio',
      id: `theme-${t.id}`,
      label: t.label,
      checked: choice === t.id,
      onSelect: () => {
        setThemeChoice(t.id);
        setChosen((n) => n + 1);
      },
    })),
    { kind: 'separator', id: 'sep-theme' },
    { kind: 'group', id: 'view', label: 'View' },
    {
      kind: 'checkbox', id: 'axes', label: 'Coordinate axes', checked: axisVisibility.showOriginMarker,
      onSelect: () => setAxisVisibility({ ...axisVisibility, showOriginMarker: !axisVisibility.showOriginMarker }),
    },
    {
      kind: 'checkbox', id: 'grid', label: 'Gridlines', checked: axisVisibility.showGridlines,
      onSelect: () => setAxisVisibility({ ...axisVisibility, showGridlines: !axisVisibility.showGridlines }),
    },
    {
      kind: 'checkbox', id: 'grid-numbers', label: 'Grid numbers', checked: axisVisibility.showGridNumbers,
      onSelect: () => setAxisVisibility({ ...axisVisibility, showGridNumbers: !axisVisibility.showGridNumbers }),
    },
    {
      kind: 'checkbox', id: 'tracker', label: 'Coordinate tracker', checked: showCoordinateTracker,
      onSelect: () => setShowCoordinateTracker(!showCoordinateTracker),
    },
    { kind: 'separator', id: 'sep' },
    { kind: 'item', id: 'shortcuts', label: 'Keyboard shortcuts', icon: <Keyboard />, onSelect: () => openHelp('shortcuts') },
  ];

  return <MenuButton label="Settings" iconOnly variant="quiet" icon={<Settings />} align="end" entries={entries} />;
}
