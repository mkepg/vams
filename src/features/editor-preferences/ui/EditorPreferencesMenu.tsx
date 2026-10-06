import { Keyboard, Settings } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { MenuButton } from '@/shared/ui/controls';

export default function EditorPreferencesMenu() {
  const axisVisibility = useVamsStore((state) => state.axisVisibility);
  const setAxisVisibility = useVamsStore((state) => state.setAxisVisibility);
  const showCoordinateTracker = useVamsStore((state) => state.showCoordinateTracker);
  const setShowCoordinateTracker = useVamsStore((state) => state.setShowCoordinateTracker);
  const openHelp = useVamsStore((state) => state.openHelp);

  return (
    <MenuButton
      label="View settings"
      iconOnly
      variant="quiet"
      icon={<Settings />}
      align="end"
      entries={[
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
          kind: 'checkbox', id: 'tracker', label: 'Coordinate tracker', checked: showCoordinateTracker,
          onSelect: () => setShowCoordinateTracker(!showCoordinateTracker),
        },
        { kind: 'separator', id: 'sep' },
        { kind: 'item', id: 'shortcuts', label: 'Keyboard shortcuts', icon: <Keyboard />, onSelect: () => openHelp('shortcuts') },
      ]}
    />
  );
}
