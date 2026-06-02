import './scene-hierarchy-panel.scss';
import './scene-hierarchy-groups.scss';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Layers, Shapes, Type, Eye, EyeOff, Copy, Trash2,
  FolderOpen, Folder, FolderX, Edit3
} from 'lucide-react';
import { useVamsStore } from "@/core/store";
import type { SceneNode } from "@/core/types/scene";
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
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
  const getRootObjects = () =>
    objects.filter(obj => !obj.parentId || !objects.find(o => o.id === obj.parentId));
  const getChildren = (parentId: string) =>
    objects.filter(obj => obj.parentId === parentId);
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
  const renderObjectItem = (obj: SceneNode, depth: number = 0) => {
    const isGroup = obj.type === 'GROUP';
    const isSelected = isMultiSelectMode
      ? selectedObjects.has(obj.id)
      : selectedObjectId === obj.id;
    const children = isGroup ? getChildren(obj.id) : [];
    const isEditing = editingId === obj.id;
    const effectivelyHidden = isEffectivelyHidden(obj);
    let dragClass = '';
    if (dragOverId === obj.id && dragPosition) dragClass = `drag-${dragPosition}`;
    return (
      <li key={obj.id} style={{ marginLeft: `${depth * 16}px` }}>
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
            {isGroup ? (
              children.length > 0 ? <FolderOpen size={13} /> : <Folder size={13} />
            ) : obj.type === 'TEXT' ? (
              <Type size={13} />
            ) : (
              <Shapes size={14} />
            )}
            {isEditing ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                onBlur={() => {
                  if (editName.trim()) updateObjectName(obj.id, editName.trim());
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editName.trim()) updateObjectName(obj.id, editName.trim());
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="rename-input"
              />
            ) : (
              <span className="name" title="Double-click to rename">
                {obj.textContent || obj.name}
              </span>
            )}
            {isGroup && !isEditing && (
              <span className="child-count">({children.length})</span>
            )}
          </span>
          <div className="item-actions">
            {}
            <button
              onClick={(e) => { e.stopPropagation(); startRename(obj.id); }}
              className="action-btn"
              title="Rename"
              aria-label="Rename"
            >
              <Edit3 size={14} />
            </button>
            {}
            <button
              onClick={(e) => { e.stopPropagation(); toggleObjectVisibility(obj.id); }}
              className={`action-btn ${effectivelyHidden ? 'active-dim' : ''}`}
              title={effectivelyHidden ? 'Show (excluded from output)' : 'Hide (exclude from output)'}
              aria-label={effectivelyHidden ? 'Show object' : 'Hide object'}
            >
              {effectivelyHidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {isGroup ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); ungroup(obj.id); }}
                  className="action-btn"
                  title="Ungroup"
                  aria-label="Ungroup"
                >
                  <FolderOpen size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteWithUndo(obj.id, true); }}
                  className="action-btn delete"
                  title="Delete Group & Children"
                  aria-label="Delete group and its children"
                >
                  <FolderX size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateObject(obj.id); }}
                  className="action-btn"
                  title="Duplicate"
                  aria-label="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteWithUndo(obj.id, false); }}
                  className="action-btn delete"
                  title="Delete"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        {isGroup && children.length > 0 && (
          <ul className="tree-list">
            {children.map(child => renderObjectItem(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };
  const rootObjects = getRootObjects();
  return (
    <CollapsibleSection panelId="scene-hierarchy" title="Scene Hierarchy" icon={<Layers size={14} />} defaultOpen={true}>
      <div className="group-controls">
        <button
          onClick={() => {
            setIsMultiSelectMode(!isMultiSelectMode);
            setSelectedObjects(new Set());
          }}
          className={`control-btn ${isMultiSelectMode ? 'active' : ''}`}
          title="Multi-Select Mode"
        >
          {isMultiSelectMode ? 'Cancel Selection' : 'Multi-Select'}
        </button>
        {isMultiSelectMode && (
          <button
            onClick={handleCreateGroup}
            disabled={selectedObjects.size < 2}
            className="control-btn group-btn"
            title="Create Group"
          >
            <Folder size={14} />
            <span>Group ({selectedObjects.size})</span>
          </button>
        )}
      </div>
      <ul className="tree-list">
        {rootObjects.map(obj => renderObjectItem(obj))}
        {rootObjects.length === 0 && (
          <div className="empty-msg">Scene is empty</div>
        )}
      </ul>
    </CollapsibleSection>
  );
}