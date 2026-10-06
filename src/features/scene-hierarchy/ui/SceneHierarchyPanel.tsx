import './scene-hierarchy-panel.scss';
import './scene-hierarchy-groups.scss';
import { useState, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Layers, Shapes, Type, Eye, EyeOff, Copy, Trash2,
  FolderOpen, Folder, FolderX, Edit3, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useVamsStore } from "@/core/store";
import type { SceneNode } from "@/core/types/scene";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button } from '@/shared/ui/controls';

interface VisibleRow {
  id: string;
  parentId: string | null;
  isGroup: boolean;
  hasChildren: boolean;
}

export default function SceneHierarchyPanel() {
  const {
    objects,
    selectedObjectId,
    setSelection,
    deleteObject,
    duplicateObject,
    toggleObjectVisibility,
    createGroup,
    ungroup,
    deleteGroup,
    updateObjectName,
    reorderObject,
  } = useVamsStore();
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | 'inside' | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  // The row that last held focus inside the tree, and its visible index, so focus can
  // move to a neighbour when that row unmounts.
  const lastFocusRef = useRef<{ id: string; index: number } | null>(null);
  // The row whose rename just ended; focus goes back to it once the input unmounts.
  const renameReturnRef = useRef<string | null>(null);
  // The row being renamed, read by handlers: the rename field's blur can fire after
  // Enter or Esc already ended the rename, and must not commit a second time.
  const editingRef = useRef<string | null>(null);
  const focusRenameRef = useRef<string | null>(null);
  const idPrefix = useId();
  const getRootObjects = () =>
    objects.filter(obj => !obj.parentId || !objects.find(o => o.id === obj.parentId));
  const getChildren = (parentId: string) =>
    objects.filter(obj => obj.parentId === parentId);
  const displayName = (obj: SceneNode) => obj.textContent || obj.name;
  const isEffectivelyHidden = (obj: SceneNode): boolean => {
    if (!obj.visible) return true;
    if (obj.parentId) {
      const parent = objects.find(o => o.id === obj.parentId);
      if (parent && isEffectivelyHidden(parent)) return true;
    }
    return false;
  };
  const toggleObjectSelection = (id: string) => {
    if (!isMultiSelectMode) {
      setSelection(id);
      return;
    }
    const newSelection = new Set(selectedObjects);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedObjects(newSelection);
  };
  // Single click selects immediately (no artificial delay); double-click or F2
  // starts an inline rename.
  const handleItemClick = (id: string, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    toggleObjectSelection(id);
  };
  const startRename = (id: string) => {
    const obj = objects.find(o => o.id === id);
    if (obj) {
      editingRef.current = id;
      focusRenameRef.current = id;
      setEditingId(id);
      setEditName(obj.textContent || obj.name);
    }
  };
  const deleteWithUndo = (id: string, isGroup: boolean) => {
    const obj = objects.find(o => o.id === id);
    const name = obj?.textContent || obj?.name || 'Object';
    if (isGroup) deleteGroup(id);
    else deleteObject(id);
    toast(`Deleted “${name}”`, {
      action: { label: 'Undo', onClick: () => useVamsStore.getState().undo() },
    });
  };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F2') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!isMultiSelectMode && selectedObjectId) {
        e.preventDefault();
        startRename(selectedObjectId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiSelectMode, selectedObjectId, objects]);
  const handleCreateGroup = () => {
    if (selectedObjects.size < 2) return;
    createGroup(Array.from(selectedObjects));
    setSelectedObjects(new Set());
    setIsMultiSelectMode(false);
  };
  const setExpanded = (id: string, expanded: boolean) => {
    setCollapsed((prev) => {
      if (expanded === !prev.has(id)) return prev;
      const next = new Set(prev);
      if (expanded) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Rows in display order, skipping the children of collapsed groups.
  const rootObjects = getRootObjects();
  const visibleRows: VisibleRow[] = [];
  const collectRows = (nodes: SceneNode[], parentId: string | null) => {
    for (const node of nodes) {
      const isGroup = node.type === 'GROUP';
      const children = isGroup ? getChildren(node.id) : [];
      visibleRows.push({ id: node.id, parentId, isGroup, hasChildren: children.length > 0 });
      if (children.length > 0 && !collapsed.has(node.id)) collectRows(children, node.id);
    }
  };
  collectRows(rootObjects, null);
  const tabStopId = visibleRows.some((row) => row.id === selectedObjectId)
    ? selectedObjectId
    : visibleRows[0]?.id ?? null;

  // When a focused rename field or row unmounts, the browser drops focus to <body>.
  // Put it back on the renamed row, or on a neighbour of a row that disappeared,
  // but never take focus from somewhere the user moved it.
  useLayoutEffect(() => {
    const active = document.activeElement;
    const focusLost = !active || active === document.body || !active.isConnected;
    const renamedId = renameReturnRef.current;
    if (renamedId !== null) {
      renameReturnRef.current = null;
      if (focusLost) {
        itemRefs.current.get(renamedId)?.focus();
        return;
      }
    }
    const last = lastFocusRef.current;
    if (!last || !focusLost || visibleRows.some((row) => row.id === last.id)) return;
    const neighbour = visibleRows[Math.min(last.index, visibleRows.length - 1)]?.id ?? tabStopId;
    lastFocusRef.current = null;
    if (neighbour) itemRefs.current.get(neighbour)?.focus();
  });

  const rememberFocus = (e: FocusEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    const id = row?.dataset.objectId;
    if (!id) return;
    lastFocusRef.current = { id, index: visibleRows.findIndex((r) => r.id === id) };
  };
  const forgetFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    const tree = e.currentTarget as HTMLElement;
    // Chrome fires focusout while a focused row is being removed, so decide after the
    // render: forget the row only if it is still there and focus left the tree on purpose.
    setTimeout(() => {
      if (target.isConnected && !tree.contains(document.activeElement)) lastFocusRef.current = null;
    }, 0);
  };

  const endRename = (id: string, commit: boolean) => {
    if (editingRef.current !== id) return;
    editingRef.current = null;
    if (commit && editName.trim()) updateObjectName(id, editName.trim());
    renameReturnRef.current = id;
    setEditingId(null);
  };

  const focusRow = (id: string | null | undefined) => {
    if (id) itemRefs.current.get(id)?.focus();
  };

  // Keys reach this handler only from a focused treeitem; keys typed in the rename
  // field or pressed on a row button keep their own behaviour.
  const onTreeKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute('role') !== 'treeitem') return;
    const id = target.dataset.objectId;
    const index = visibleRows.findIndex((row) => row.id === id);
    if (!id || index < 0) return;
    const row = visibleRows[index];
    const isExpanded = row.hasChildren && !collapsed.has(id);
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        focusRow(visibleRows[index + 1]?.id);
        break;
      case 'ArrowUp':
        focusRow(visibleRows[index - 1]?.id);
        break;
      case 'Home':
        focusRow(visibleRows[0]?.id);
        break;
      case 'End':
        focusRow(visibleRows[visibleRows.length - 1]?.id);
        break;
      case 'ArrowRight':
        if (row.hasChildren && !isExpanded) setExpanded(id, true);
        else if (isExpanded) focusRow(visibleRows[index + 1]?.id);
        break;
      case 'ArrowLeft':
        if (isExpanded) setExpanded(id, false);
        else focusRow(row.parentId);
        break;
      case 'Enter':
        toggleObjectSelection(id);
        break;
      case 'F2':
        startRename(id);
        break;
      default:
        handled = false;
    }
    if (handled) {
      // Keep window-level shortcuts (F2 rename, Enter to finish a shape) from acting twice.
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const renderObjectItem = (obj: SceneNode, depth: number = 1) => {
    const isGroup = obj.type === 'GROUP';
    const isSelected = isMultiSelectMode
      ? selectedObjects.has(obj.id)
      : selectedObjectId === obj.id;
    const children = isGroup ? getChildren(obj.id) : [];
    const hasChildren = children.length > 0;
    const isExpanded = hasChildren && !collapsed.has(obj.id);
    const isEditing = editingId === obj.id;
    const effectivelyHidden = isEffectivelyHidden(obj);
    const name = displayName(obj);
    const nameId = `${idPrefix}-name-${obj.id}`;
    let dragClass = '';
    if (dragOverId === obj.id && dragPosition) dragClass = `drag-${dragPosition}`;
    return (
      <li
        key={obj.id}
        ref={(el) => {
          if (el) itemRefs.current.set(obj.id, el);
          else itemRefs.current.delete(obj.id);
        }}
        role="treeitem"
        className="tree-node"
        data-object-id={obj.id}
        aria-level={depth}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-labelledby={isEditing ? undefined : nameId}
        aria-label={isEditing ? name : undefined}
        tabIndex={obj.id === tabStopId ? 0 : -1}
      >
        <div
          className={`tree-item ${isSelected ? 'selected' : ''} ${isGroup ? 'group-item' : ''} ${dragClass} ${effectivelyHidden ? 'hidden-item' : ''}`}
          draggable={!isEditing}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer?.setData('text/plain', obj.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const h = rect.height;
            let pos: 'before' | 'after' | 'inside' = 'inside';
            if (isGroup) {
              if (y < h * 0.25) pos = 'before';
              else if (y > h * 0.75) pos = 'after';
              else pos = 'inside';
            } else {
              pos = y < h * 0.5 ? 'before' : 'after';
            }
            setDragOverId(obj.id);
            setDragPosition(pos);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverId(null);
            setDragPosition(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const sourceId = e.dataTransfer?.getData('text/plain');
            setDragOverId(null);
            setDragPosition(null);
            if (sourceId && sourceId !== obj.id && dragPosition) {
              reorderObject(sourceId, obj.id, dragPosition);
            }
          }}
          onClick={(e) => handleItemClick(obj.id, e)}
          onDblClick={(e) => { e.stopPropagation(); startRename(obj.id); }}
        >
          <span className="label">
            {hasChildren ? (
              <span
                className="tree-twisty"
                aria-hidden="true"
                onClick={(e) => { e.stopPropagation(); setExpanded(obj.id, !isExpanded); }}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
            ) : isGroup ? (
              <span className="tree-twisty" aria-hidden="true" />
            ) : null}
            <span className="tree-icon" aria-hidden="true">
              {isGroup ? (
                hasChildren ? <FolderOpen size={13} /> : <Folder size={13} />
              ) : obj.type === 'TEXT' ? (
                <Type size={13} />
              ) : (
                <Shapes size={14} />
              )}
            </span>
            {isEditing ? (
              <input
                ref={(el) => {
                  if (el && focusRenameRef.current === obj.id) {
                    focusRenameRef.current = null;
                    el.focus();
                    el.select();
                  }
                }}
                value={editName}
                aria-label={`Rename ${name}`}
                onChange={(e) => setEditName(e.currentTarget.value)}
                onBlur={() => endRename(obj.id, true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') endRename(obj.id, true);
                  if (e.key === 'Escape') endRename(obj.id, false);
                }}
                onClick={(e) => e.stopPropagation()}
                className="rename-input vfield-input"
              />
            ) : (
              <span id={nameId} className="name" title="Double-click to rename">
                {name}
              </span>
            )}
            {isGroup && !isEditing && (
              <span className="child-count">({children.length})</span>
            )}
          </span>
          <div className="item-actions" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="quiet"
              iconOnly
              label={`Rename ${name}`}
              title="Rename"
              icon={<Edit3 size={14} />}
              onClick={() => startRename(obj.id)}
            />
            <Button
              variant="quiet"
              iconOnly
              className={effectivelyHidden ? 'active-dim' : undefined}
              label={`${effectivelyHidden ? 'Show' : 'Hide'} ${name}`}
              title={effectivelyHidden ? 'Show (excluded from output)' : 'Hide (exclude from output)'}
              icon={effectivelyHidden ? <EyeOff size={14} /> : <Eye size={14} />}
              onClick={() => toggleObjectVisibility(obj.id)}
            />
            {isGroup ? (
              <>
                <Button
                  variant="quiet"
                  iconOnly
                  label={`Ungroup ${name}`}
                  title="Ungroup"
                  icon={<FolderOpen size={14} />}
                  onClick={() => ungroup(obj.id)}
                />
                <Button
                  variant="quiet"
                  iconOnly
                  className="delete"
                  label={`Delete ${name} and its children`}
                  title="Delete Group & Children"
                  icon={<FolderX size={14} />}
                  onClick={() => deleteWithUndo(obj.id, true)}
                />
              </>
            ) : (
              <>
                <Button
                  variant="quiet"
                  iconOnly
                  label={`Duplicate ${name}`}
                  title="Duplicate"
                  icon={<Copy size={14} />}
                  onClick={() => duplicateObject(obj.id)}
                />
                <Button
                  variant="quiet"
                  iconOnly
                  className="delete"
                  label={`Delete ${name}`}
                  title="Delete"
                  icon={<Trash2 size={14} />}
                  onClick={() => deleteWithUndo(obj.id, false)}
                />
              </>
            )}
          </div>
        </div>
        {isExpanded && (
          <ul role="group" className="tree-list">
            {children.map(child => renderObjectItem(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };
  return (
    <CollapsibleSection panelId="scene-hierarchy" title="Scene Hierarchy" icon={<Layers size={14} />} defaultOpen={true}>
      <div className="group-controls">
        <Button
          variant="quiet"
          className={isMultiSelectMode ? 'active' : undefined}
          title="Multi-Select Mode"
          onClick={() => {
            setIsMultiSelectMode(!isMultiSelectMode);
            setSelectedObjects(new Set());
          }}
        >
          {isMultiSelectMode ? 'Cancel Selection' : 'Multi-Select'}
        </Button>
        {isMultiSelectMode && (
          <Button
            variant="quiet"
            icon={<Folder size={14} />}
            onClick={handleCreateGroup}
            disabled={selectedObjects.size < 2}
            title="Create Group"
          >
            Group ({selectedObjects.size})
          </Button>
        )}
      </div>
      {rootObjects.length === 0 ? (
        <p className="empty-msg">Scene is empty</p>
      ) : (
        <ul
          role="tree"
          aria-label="Scene objects"
          aria-multiselectable={isMultiSelectMode || undefined}
          className="tree-list tree-root"
          onKeyDown={onTreeKeyDown}
          onFocus={rememberFocus}
          onBlur={forgetFocus}
        >
          {rootObjects.map(obj => renderObjectItem(obj))}
        </ul>
      )}
    </CollapsibleSection>
  );
}
