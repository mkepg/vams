import { Eye } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { MenuButton, type MenuEntry } from '@/shared/ui/controls';

/** What the canvas shows: axes, gridlines, their numbers and the coordinate tracker. */
export default function ViewMenu({ iconOnly = false }: { iconOnly?: boolean }) {
  const axisVisibility = useVamsStore((state) => state.axisVisibility);
  const setAxisVisibility = useVamsStore((state) => state.setAxisVisibility);
  const showCoordinateTracker = useVamsStore((state) => state.showCoordinateTracker);
  const setShowCoordinateTracker = useVamsStore((state) => state.setShowCoordinateTracker);

  const entries: MenuEntry[] = [
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
      disabled: !axisVisibility.showOriginMarker,
      onSelect: () => setAxisVisibility({ ...axisVisibility, showGridNumbers: !axisVisibility.showGridNumbers }),
    },
    {
      kind: 'checkbox', id: 'tracker', label: 'Coordinate tracker', checked: showCoordinateTracker,
      onSelect: () => setShowCoordinateTracker(!showCoordinateTracker),
    },
  ];

  return (
    <MenuButton label="View" variant="quiet" icon={<Eye />} iconOnly={iconOnly} align="end" entries={entries}>
      View
    </MenuButton>
  );
}
