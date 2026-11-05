import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LabMenu as Menu } from '@/features/lab-run';

interface LabMenuProps {
  menus: readonly Menu[];
  /** The menu attached to the button that opened it. */
  root: number;
  /** Where it opens, in stage pixels. */
  at: { x: number; y: number };
  /** An entry was chosen: the menu it belongs to, and its value. */
  onChoose: (menu: number, value: number) => void;
  /** Closed without a choice (Esc, Tab or a click outside). */
  onClose: () => void;
}

interface ListProps extends Omit<LabMenuProps, 'root' | 'at' | 'onClose'> {
  id: number;
  /** Closes this list: back to its parent, or the whole menu at the root. */
  onBack: () => void;
  onDismiss: () => void;
  depth: number;
}

/** One list of a GLUT menu; a submenu opens beside its entry. */
function MenuList({ menus, id, onChoose, onBack, onDismiss, depth }: ListProps) {
  const menu = menus.find((m) => m.id === id);
  const entries = menu?.entries ?? [];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const items = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (open === null) items.current[active]?.focus();
  }, [active, open]);

  const choose = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    if ('submenu' in entry) {
      setActive(index);
      setOpen(index);
    } else onChoose(id, entry.value);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (open !== null || !entries.length) return;
    const count = entries.length;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case 'ArrowDown':
        handled();
        return setActive((i) => (i + 1) % count);
      case 'ArrowUp':
        handled();
        return setActive((i) => (i - 1 + count) % count);
      case 'Home':
        handled();
        return setActive(0);
      case 'End':
        handled();
        return setActive(count - 1);
      case 'ArrowRight':
        handled();
        if ('submenu' in entries[active]) choose(active);
        return;
      case 'ArrowLeft':
        handled();
        if (depth > 0) onBack();
        return;
      case 'Enter':
      case ' ':
        handled();
        return choose(active);
      case 'Escape':
        handled();
        return onBack();
      case 'Tab':
        return onDismiss();
    }
  };

  return (
    <div role="menu" aria-orientation="vertical" className={`lab-menu__list${depth ? ' lab-menu__list--sub' : ''}`} onKeyDown={onKeyDown}>
      {entries.map((entry, index) => {
        const sub = 'submenu' in entry;
        return (
          <div key={index} className="lab-menu__entry">
            <div
              ref={(el) => {
                items.current[index] = el;
              }}
              role="menuitem"
              tabIndex={-1}
              aria-haspopup={sub ? 'menu' : undefined}
              aria-expanded={sub ? open === index : undefined}
              className="lab-menu__item"
              onClick={() => choose(index)}
              onMouseEnter={() => {
                setActive(index);
                if (open !== null && open !== index) setOpen(null);
              }}
            >
              {entry.label}
            </div>
            {sub && open === index && (
              <MenuList
                menus={menus}
                id={entry.submenu}
                onChoose={onChoose}
                onBack={() => setOpen(null)}
                onDismiss={onDismiss}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A GLUT right-click menu, drawn over the program window, that the mouse and the keyboard both work. */
export default function LabMenu({ menus, root, at, onChoose, onClose }: LabMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  return (
    <div ref={ref} className="lab-menu" style={{ left: `${at.x}px`, top: `${at.y}px` }} onContextMenu={(event) => event.preventDefault()}>
      <MenuList menus={menus} id={root} onChoose={onChoose} onBack={onClose} onDismiss={onClose} depth={0} />
    </div>
  );
}
