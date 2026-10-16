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

/** The editor's settings menu: the theme and the shortcuts. */
export default function EditorPreferencesMenu() {
  // Re-render when the theme changes elsewhere; the counter covers a choice that leaves the applied theme as it was.
  useSiteTheme();
  const [, setChosen] = useState(0);
  const choice = readThemeChoice();
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
    { kind: 'separator', id: 'sep' },
    { kind: 'item', id: 'shortcuts', label: 'Keyboard shortcuts', icon: <Keyboard />, onSelect: () => openHelp('shortcuts') },
  ];

  return <MenuButton label="Settings" iconOnly variant="quiet" icon={<Settings />} align="end" entries={entries} />;
}
