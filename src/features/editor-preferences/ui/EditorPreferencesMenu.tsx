import { useEffect, useRef, useState } from 'react';
import { Settings, Eye, EyeOff, Keyboard } from 'lucide-react';
import { useVamsStore } from '@/core/store';

export default function EditorPreferencesMenu() {
  const axisVisibility = useVamsStore((state) => state.axisVisibility);
  const setAxisVisibility = useVamsStore((state) => state.setAxisVisibility);
  const showCoordinateTracker = useVamsStore((state) => state.showCoordinateTracker);
  const setShowCoordinateTracker = useVamsStore(
    (state) => state.setShowCoordinateTracker
  );
  const openHelp = useVamsStore((state) => state.openHelp);

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="dropdown-container" ref={menuRef}>
      <button
        className="icon-btn"
        onClick={() => setShowMenu((value) => !value)}
        title="View Settings"
        aria-label="View settings"
        aria-haspopup="menu"
        aria-expanded={showMenu}
      >
        <Settings size={16} />
      </button>

      {showMenu && (
        <div className="dropdown-menu">
          <div className="menu-header">View</div>

          <button
            className="menu-item"
            onClick={() =>
              setAxisVisibility({
                ...axisVisibility,
                showOriginMarker: !axisVisibility.showOriginMarker,
              })
            }
          >
            {axisVisibility.showOriginMarker ? <Eye size={14} /> : <EyeOff size={14} />}
            Coordinate Axes
          </button>

          <button
            className="menu-item"
            onClick={() =>
              setAxisVisibility({
                ...axisVisibility,
                showGridlines: !axisVisibility.showGridlines,
              })
            }
          >
            {axisVisibility.showGridlines ? <Eye size={14} /> : <EyeOff size={14} />}
            Gridlines
          </button>

          <button
            className="menu-item"
            onClick={() => setShowCoordinateTracker(!showCoordinateTracker)}
          >
            {showCoordinateTracker ? <Eye size={14} /> : <EyeOff size={14} />}
            Coordinate Tracker
          </button>

          <div className="menu-separator" />

          <button
            className="menu-item"
            onClick={() => {
              setShowMenu(false);
              openHelp('shortcuts');
            }}
          >
            <Keyboard size={14} />
            Keyboard Shortcuts
          </button>
        </div>
      )}
    </div>
  );
}
