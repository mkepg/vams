import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { ChevronDown, Check } from 'lucide-react';
import { Button, type ButtonVariant } from './Button';
import './menu.scss';

export type MenuEntry =
  | { kind: 'item'; id: string; label: string; icon?: ComponentChildren; description?: string; disabled?: boolean; onSelect: () => void }
  | { kind: 'radio'; id: string; label: string; icon?: ComponentChildren; description?: string; checked: boolean; onSelect: () => void }
  | { kind: 'checkbox'; id: string; label: string; icon?: ComponentChildren; checked: boolean; onSelect: () => void }
  | { kind: 'separator'; id: string }
  | { kind: 'group'; id: string; label: string };

type Actionable = Extract<MenuEntry, { kind: 'item' | 'radio' | 'checkbox' }>;

export interface MenuButtonProps {
  /** Accessible name of the trigger and of the menu. */
  label: string;
  entries: MenuEntry[];
  /** Visible trigger content; omit with iconOnly. */
  children?: ComponentChildren;
  icon?: ComponentChildren;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  align?: 'start' | 'end';
  title?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

const isActionable = (entry: MenuEntry): entry is Actionable =>
  entry.kind === 'item' || entry.kind === 'radio' || entry.kind === 'checkbox';

export function MenuButton({
  label, entries, children, icon, iconOnly = false, variant = 'secondary', align = 'start',
  title, className, triggerClassName, menuClassName,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  // Set by a Space keydown inside the open menu; the matching keyup activates the item.
  const spaceDownRef = useRef(false);
  const menuId = useId();
  const actionable = entries.filter(isActionable);

  const startIndex = (from: 'first' | 'last') => {
    if (from === 'last') return Math.max(0, actionable.length - 1);
    const checked = actionable.findIndex((entry) => entry.kind === 'radio' && entry.checked);
    return checked >= 0 ? checked : 0;
  };

  const openMenu = (from: 'first' | 'last') => {
    spaceDownRef.current = false;
    setActive(startIndex(from));
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const activate = (entry: Actionable) => {
    if (entry.kind === 'item' && entry.disabled) return;
    close(true);
    entry.onSelect();
  };

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu('last');
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const count = actionable.length;
    if (count === 0) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => (index + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => (index - 1 + count) % count);
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(count - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
      case 'Enter':
        event.preventDefault();
        activate(actionable[active]);
        break;
      case ' ':
        // Space activates on keyup, as a native button does. Activating on keydown would move
        // focus to the trigger, and Firefox would then click whatever has focus on keyup.
        event.preventDefault();
        spaceDownRef.current = true;
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const letter = event.key.toLowerCase();
          for (let step = 1; step <= count; step++) {
            const index = (active + step) % count;
            if (actionable[index].label.toLowerCase().startsWith(letter)) {
              setActive(index);
              break;
            }
          }
        }
    }
  };

  const onMenuKeyUp = (event: KeyboardEvent) => {
    if (event.key !== ' ') return;
    event.preventDefault();
    if (!spaceDownRef.current) return;
    spaceDownRef.current = false;
    const entry = actionable[active];
    if (entry) activate(entry);
  };

  // Split entries into labelled groups, separated by separators.
  const blocks: { key: string; groupLabel?: string; items: Actionable[]; separatorBefore: boolean }[] = [];
  let currentBlock: (typeof blocks)[number] | null = null;
  let pendingSeparator = false;
  for (const entry of entries) {
    if (entry.kind === 'separator') {
      currentBlock = null;
      pendingSeparator = blocks.length > 0;
    } else if (entry.kind === 'group') {
      currentBlock = { key: entry.id, groupLabel: entry.label, items: [], separatorBefore: pendingSeparator };
      blocks.push(currentBlock);
      pendingSeparator = false;
    } else {
      if (!currentBlock) {
        currentBlock = { key: `block-${entry.id}`, items: [], separatorBefore: pendingSeparator };
        blocks.push(currentBlock);
        pendingSeparator = false;
      }
      currentBlock.items.push(entry);
    }
  }

  const renderItem = (entry: Actionable) => {
    const index = actionable.indexOf(entry);
    const role = entry.kind === 'item' ? 'menuitem' : entry.kind === 'radio' ? 'menuitemradio' : 'menuitemcheckbox';
    const disabled = entry.kind === 'item' && entry.disabled;
    return (
      <div
        key={entry.id}
        ref={(el) => {
          itemRefs.current[index] = el;
        }}
        role={role}
        tabIndex={-1}
        aria-checked={entry.kind === 'item' ? undefined : entry.checked}
        aria-disabled={disabled ? 'true' : undefined}
        className={['vmenu__item', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}
        onClick={() => activate(entry)}
        onMouseEnter={() => setActive(index)}
      >
        {entry.icon && <span className="vmenu__icon" aria-hidden="true">{entry.icon}</span>}
        <span className="vmenu__text">
          <span className="vmenu__label">{entry.label}</span>
          {'description' in entry && entry.description && <span className="vmenu__desc">{entry.description}</span>}
        </span>
        {entry.kind !== 'item' && (
          <span className="vmenu__check" aria-hidden="true">{entry.checked && <Check size={14} />}</span>
        )}
      </div>
    );
  };

  return (
    <div ref={rootRef} className={className ? `vmenu ${className}` : 'vmenu'}>
      <Button
        ref={triggerRef}
        variant={variant}
        icon={icon}
        iconOnly={iconOnly}
        label={label}
        title={title}
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu('first'))}
        onKeyDown={onTriggerKeyDown}
      >
        {children}
        {!iconOnly && <ChevronDown size={12} aria-hidden="true" className="vmenu__chev" />}
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={['vmenu__list', `vmenu__list--${align}`, menuClassName ?? ''].filter(Boolean).join(' ')}
          onKeyDown={onMenuKeyDown}
          onKeyUp={onMenuKeyUp}
        >
          {blocks.map((block) => {
            const groupId = `${menuId}-${block.key}`;
            return [
              block.separatorBefore ? <div key={`${block.key}-sep`} role="separator" className="vmenu__sep" /> : null,
              block.groupLabel ? (
                <div key={block.key} role="group" aria-labelledby={groupId}>
                  <div id={groupId} className="vmenu__group" role="presentation">{block.groupLabel}</div>
                  {block.items.map(renderItem)}
                </div>
              ) : (
                block.items.map(renderItem)
              ),
            ];
          })}
        </div>
      )}
    </div>
  );
}
