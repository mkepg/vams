import type { StateCreator } from 'zustand';
import type { VamsState, SceneSlice } from '@/core/store/types';
import type { SceneNode, TransformState } from '@/core/types/scene';
import type { UV } from '@/core/types/textures';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch { /* empty */ }
  }
  return 'id-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

const getUniqueName = (basePrefix: string, objects: SceneNode[]) => {
  let counter = 1;
  let newName = `${basePrefix}_${counter}`;
  while (objects.some((o) => o.name === newName)) {
    counter++;
    newName = `${basePrefix}_${counter}`;
  }
  return newName;
};

const getDuplicateName = (originalName: string, objects: SceneNode[]) => {
  let newName = `${originalName}_copy`;
  let counter = 2;
  while (objects.some((o) => o.name === newName)) {
    newName = `${originalName}_copy_${counter}`;
    counter++;
  }
  return newName;
};

const getMatrix = (t: TransformState): number[] => {
  const rad = (t.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    t.scaleX * cos, -t.scaleY * sin, t.translateX,
    t.scaleX * sin,  t.scaleY * cos, t.translateY,
  ];
};

const multiplyMat = (m1: number[], m2: number[]): number[] => {
  return [
    m1[0] * m2[0] + m1[1] * m2[3],
    m1[0] * m2[1] + m1[1] * m2[4],
    m1[0] * m2[2] + m1[1] * m2[5] + m1[2],
    m1[3] * m2[0] + m1[4] * m2[3],
    m1[3] * m2[1] + m1[4] * m2[4],
    m1[3] * m2[2] + m1[4] * m2[5] + m1[5],
  ];
};

const invertMat = (m: number[]): number[] => {
  const det = m[0] * m[4] - m[1] * m[3];
  if (det === 0) return [1, 0, 0, 0, 1, 0];
  const invDet = 1 / det;
  return [
     m[4] * invDet, -m[1] * invDet, (m[1] * m[5] - m[2] * m[4]) * invDet,
    -m[3] * invDet,  m[0] * invDet, (m[2] * m[3] - m[0] * m[5]) * invDet,
  ];
};

const extractTransform = (m: number[]): TransformState => {
  const scaleX = Math.sqrt(m[0] * m[0] + m[3] * m[3]);
  const scaleY = Math.sqrt(m[1] * m[1] + m[4] * m[4]);
  const rotate = Math.atan2(m[3], m[0]) * 180 / Math.PI;
  return { translateX: m[2], translateY: m[5], rotate, scaleX, scaleY };
};

const getGlobalMatrix = (objId: string, objects: SceneNode[]): number[] => {
  const current = objects.find((o) => o.id === objId);
  if (!current) return [1, 0, 0, 0, 1, 0];
  let mat = getMatrix(current.transform);
  let parentId: string | null | undefined = current.parentId;
  while (parentId) {
    const parent = objects.find((o) => o.id === parentId);
    if (!parent) break;
    mat = multiplyMat(getMatrix(parent.transform), mat);
    parentId = parent.parentId;
  }
  return mat;
};

function defaultUVsFor(vertices: SceneNode['vertices']): UV[] {
  if (vertices.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  return vertices.map((vert) => ({
    u: (vert.x - minX) / w,
    v: (vert.y - minY) / h,
  }));
}

const isLinePrimitive = (t: SceneNode['type']): boolean =>
  t === 'LINES' || t === 'LINE_STRIP' || t === 'LINE_LOOP';

export const createSceneSlice: StateCreator<VamsState, [], [], SceneSlice> = (set, get) => ({
  objects: [],
  selectedObjectId: null,

  setSelection: (id) => get().selectObject(id),
  selectObject: (id) => set({ selectedObjectId: id, selectedVertexId: null }),

  addCustomObject: (type, placedVertices) => {
    get().pushToHistory();
    set((state) => {
      const newId = generateId();
      let centerX = 0, centerY = 0;
      if (placedVertices.length > 0) {
        let sumX = 0, sumY = 0;
        placedVertices.forEach((v) => { sumX += v.x; sumY += v.y; });
        centerX = sumX / placedVertices.length;
        centerY = sumY / placedVertices.length;
      }
      
      const vertices = placedVertices.map((pv, i) => ({
        id: `v${i}`, x: pv.x - centerX, y: pv.y - centerY, color: '#ffffff',
      }));

      const newObj: SceneNode = {
        id: newId,
        name: getUniqueName(type, state.objects),
        type,
        visible: true,
        shading: 'SMOOTH',
        vertices,
        transform: { translateX: centerX, translateY: centerY, rotate: 0, scaleX: 1, scaleY: 1 },
        parentId: null,
        children: [],
        colorMode: 'FLOAT',
        lineWidth: isLinePrimitive(type) ? 1 : undefined,
        lineStipple: null,
        renderingMode: 'IMMEDIATE',
        bufferUsage: 'STATIC',
        useIndexed: false,
        updateMethod: 'BUFFER_SUB_DATA',
        texture: null,
        uvs: null,
      };

      return {
        objects: [newObj, ...state.objects],
        selectedObjectId: newId,
        pendingShapeType: null,
        pendingVertices: [],
        pendingVertexStride: null,
        interactionMode: 'SELECT',
      };
    });
  },

  deleteObject: (id) => {
    get().pushToHistory();
    set((state) => {
      const obj = state.objects.find((o) => o.id === id);
      if (!obj) return state;

      const childrenToDelete = obj.type === 'GROUP' ? (obj.children || []) : [];
      const idsToDelete = [id, ...childrenToDelete];

      let updatedObjects = state.objects.filter((o) => !idsToDelete.includes(o.id));

      if (obj.parentId) {
        updatedObjects = updatedObjects.map((o) => {
          if (o.id === obj.parentId) {
            return { ...o, children: o.children?.filter((cid) => cid !== id) || [] };
          }
          return o;
        });
      }

      const isSelectedDeleted = state.selectedObjectId && idsToDelete.includes(state.selectedObjectId);

      return {
        objects: updatedObjects,
        selectedObjectId: isSelectedDeleted ? null : state.selectedObjectId,
        ...(isSelectedDeleted ? { selectedVertexId: null, interactionMode: state.interactionMode === 'VERTEX_EDIT' ? 'SELECT' : state.interactionMode } : {}),
      };
    });
  },

  duplicateObject: (id) => {
    get().pushToHistory();
    set((state) => {
      const objIndex = state.objects.findIndex((o) => o.id === id);
      if (objIndex === -1) return state;
      
      const obj = state.objects[objIndex];
      const newId = generateId();
      
      const duplicate: SceneNode = {
        ...obj,
        id: newId,
        name: getDuplicateName(obj.name, state.objects),
        vertices: obj.vertices.map((v) => ({ ...v, id: generateId() })),
        parentId: null,
        children: [],
      };
      
      const newObjects = [...state.objects];
      newObjects.splice(objIndex + 1, 0, duplicate);
      
      return { objects: newObjects, selectedObjectId: newId };
    });
  },

  updateObjectName: (id, name) => {
    get().pushToHistory();
    set((state) => ({ objects: state.objects.map((o) => (o.id === id ? { ...o, name } : o)) }));
  },

  toggleObjectVisibility: (id) => {
    get().pushToHistory();
    set((state) => {
      const target = state.objects.find(o => o.id === id);
      if (!target) return state;
      const nextVisible = !target.visible;

      if (target.type === 'GROUP') {
        const getAllDescendantIds = (parentId: string): string[] => {
          const children = state.objects.filter(o => o.parentId === parentId);
          return children.reduce<string[]>(
            (acc, child) => [...acc, child.id, ...getAllDescendantIds(child.id)],
            []
          );
        };
        const descendantIds = new Set(getAllDescendantIds(id));
        return {
          objects: state.objects.map(o => {
            if (o.id === id || descendantIds.has(o.id)) return { ...o, visible: nextVisible };
            return o;
          }),
        };
      }
      return {
        objects: state.objects.map(o => o.id === id ? { ...o, visible: nextVisible } : o),
      };
    });
  },

  updateObjectTransform: (id, update) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, transform: { ...obj.transform, ...update } } : obj
      ),
    }));
  },

  updateVertexPosition: (objectId, vertexId, x, y) => {
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        
        const newVertices = obj.vertices.map((v) => (v.id === vertexId ? { ...v, x, y } : v));
        
        // Dynamically recalculate UVs to match the new bounding box dimensions
        const newUvs = obj.uvs && obj.uvs.length === obj.vertices.length
          ? defaultUVsFor(newVertices) 
          : obj.uvs;

        return { ...obj, vertices: newVertices, uvs: newUvs };
      }),
    }));
  },

  updateVertexColor: (objectId, vertexId, color) => {
    const state = get();
    if (!state.isBatchMode) state.pushToHistory();
    set((s) => ({
      objects: s.objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        return { ...obj, vertices: obj.vertices.map((v) => (v.id === vertexId ? { ...v, color } : v)) };
      }),
    }));
  },

  setAllVertexColors: (objectId, color) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        return { ...obj, vertices: obj.vertices.map((v) => ({ ...v, color })) };
      }),
    }));
  },

  updateObjectShading: (id, mode) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, shading: mode } : obj)),
    }));
  },

  setObjectAnimation: (id, animation) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === id ? { ...obj, animation } : obj)),
    }));
  },

  addTextObject: (text, x, y) => {
    get().pushToHistory();
    set((state) => {
      const newId = generateId();
      const textObj: SceneNode = {
        id: newId,
        name: getUniqueName('TEXT', state.objects),
        type: 'TEXT',
        visible: true,
        shading: 'FLAT',
        vertices: [{ id: 'v0', x: 0, y: 0, color: '#ffffff' }],
        transform: { translateX: x, translateY: y, rotate: 0, scaleX: 1, scaleY: 1 },
        textContent: text,
        rasterPosition: { x, y },
        parentId: null,
        children: [],
        colorMode: 'FLOAT',
      };
      return { objects: [textObj, ...state.objects], selectedObjectId: newId };
    });
  },

  updateTextContent: (id, text) => {
    set((state) => ({
      objects: state.objects.map((obj) => obj.id === id ? { ...obj, textContent: text } : obj),
    }));
  },

  createGroup: (objectIds) => {
    if (objectIds.length < 2) return;
    get().pushToHistory();
    set((state) => {
      const groupId = generateId();
      
      const validObjectIds = objectIds.filter((id) => {
        const obj = state.objects.find((o) => o.id === id);
        return obj && !obj.parentId;
      });
      if (validObjectIds.length < 2) return state;

      const objectsToGroup = state.objects.filter((o) => validObjectIds.includes(o.id));
      const centerX = objectsToGroup.reduce((sum, obj) => sum + obj.transform.translateX, 0) / objectsToGroup.length;
      const centerY = objectsToGroup.reduce((sum, obj) => sum + obj.transform.translateY, 0) / objectsToGroup.length;

      const groupObj: SceneNode = {
        id: groupId,
        name: getUniqueName('Group', state.objects),
        type: 'GROUP',
        visible: true,
        shading: 'FLAT',
        vertices: [],
        transform: { translateX: centerX, translateY: centerY, rotate: 0, scaleX: 1, scaleY: 1 },
        parentId: null,
        children: validObjectIds,
      };

      const updatedObjects = state.objects.map((obj) => {
        if (validObjectIds.includes(obj.id)) {
          return {
            ...obj,
            parentId: groupId,
            transform: {
              ...obj.transform,
              translateX: obj.transform.translateX - centerX,
              translateY: obj.transform.translateY - centerY,
            },
          };
        }
        return obj;
      });

      return { objects: [groupObj, ...updatedObjects], selectedObjectId: groupId };
    });
  },

  ungroup: (groupId) => {
    get().pushToHistory();
    set((state) => {
      const group = state.objects.find((o) => o.id === groupId);
      if (!group || group.type !== 'GROUP') return state;

      const groupGlobalMat = getGlobalMatrix(groupId, state.objects);
      const newParentId = group.parentId ?? null;
      let newParentGlobalMat: number[] = [1, 0, 0, 0, 1, 0];
      if (newParentId) newParentGlobalMat = getGlobalMatrix(newParentId, state.objects);
      const invParentMat = invertMat(newParentGlobalMat);

      let updatedObjects = state.objects
        .filter((o) => o.id !== groupId)
        .map((obj) => {
          if (!group.children?.includes(obj.id)) return obj;

          const childLocalMat = getMatrix(obj.transform);
          const childGlobalMat = multiplyMat(groupGlobalMat, childLocalMat);
          const newLocalMat = multiplyMat(invParentMat, childGlobalMat);
          const newTransform = extractTransform(newLocalMat);

          return {
            ...obj,
            parentId: newParentId,
            transform: {
              translateX: parseFloat(newTransform.translateX.toFixed(6)),
              translateY: parseFloat(newTransform.translateY.toFixed(6)),
              rotate: parseFloat(newTransform.rotate.toFixed(6)),
              scaleX: parseFloat(newTransform.scaleX.toFixed(6)),
              scaleY: parseFloat(newTransform.scaleY.toFixed(6)),
            },
          };
        });

      if (newParentId) {
        updatedObjects = updatedObjects.map((o) => {
          if (o.id === newParentId) {
            const existingChildren = o.children?.filter((cid) => cid !== groupId) ?? [];
            return { ...o, children: [...existingChildren, ...(group.children ?? [])] };
          }
          return o;
        });
      }

      const isSelectedDeleted = state.selectedObjectId === groupId;

      return {
        objects: updatedObjects,
        selectedObjectId: isSelectedDeleted ? null : state.selectedObjectId,
        ...(isSelectedDeleted ? { selectedVertexId: null, interactionMode: state.interactionMode === 'VERTEX_EDIT' ? 'SELECT' : state.interactionMode } : {}),
      };
    });
  },

  deleteGroup: (groupId) => {
    get().pushToHistory();
    set((state) => {
      const group = state.objects.find((o) => o.id === groupId);
      if (!group || group.type !== 'GROUP') return state;

      const childrenToDelete = group.children || [];
      const idsToDelete = [groupId, ...childrenToDelete];

      const updatedObjects = state.objects.filter((o) => !idsToDelete.includes(o.id));
      const isSelectedDeleted = state.selectedObjectId && idsToDelete.includes(state.selectedObjectId);

      return {
        objects: updatedObjects,
        selectedObjectId: isSelectedDeleted ? null : state.selectedObjectId,
        ...(isSelectedDeleted ? { selectedVertexId: null, interactionMode: state.interactionMode === 'VERTEX_EDIT' ? 'SELECT' : state.interactionMode } : {}),
      };
    });
  },

  reorderObject: (sourceId, targetId, position) => {
    get().pushToHistory();
    set((state) => {
      if (sourceId === targetId) return state;

      const sourceIndex = state.objects.findIndex((o) => o.id === sourceId);
      const targetIndex = state.objects.findIndex((o) => o.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return state;

      const sourceObj = state.objects[sourceIndex];
      const targetObj = state.objects[targetIndex];

      let currentParent: string | null | undefined = targetObj.parentId;
      while (currentParent) {
        if (currentParent === sourceId) return state;
        const parentObj = state.objects.find((o) => o.id === currentParent);
        currentParent = parentObj?.parentId || null;
      }

      let newObjects = [...state.objects];

      const getDescendants = (id: string): SceneNode[] => {
        const children = newObjects.filter((o) => o.parentId === id);
        return children.reduce((acc, child) => [...acc, child, ...getDescendants(child.id)], children);
      };

      const sourceDescendants = getDescendants(sourceId);
      const sourceFamilyIds = new Set([sourceId, ...sourceDescendants.map((o) => o.id)]);

      const globalMat = getGlobalMatrix(sourceObj.id, state.objects);
      let newParentId: string | null = sourceObj.parentId ?? null;

      if (position === 'inside' && targetObj.type === 'GROUP') {
        newParentId = targetId;
      } else if (position === 'before' || position === 'after') {
        newParentId = targetObj.parentId ?? null;
      }

      let newParentGlobalMat: number[] = [1, 0, 0, 0, 1, 0];
      if (newParentId) newParentGlobalMat = getGlobalMatrix(newParentId, state.objects);
      
      const invParentMat = invertMat(newParentGlobalMat);
      const newLocalMat = multiplyMat(invParentMat, globalMat);
      const newTransform = extractTransform(newLocalMat);
      
      newTransform.translateX = parseFloat(newTransform.translateX.toFixed(4));
      newTransform.translateY = parseFloat(newTransform.translateY.toFixed(4));
      newTransform.rotate = parseFloat(newTransform.rotate.toFixed(4));
      newTransform.scaleX = parseFloat(newTransform.scaleX.toFixed(4));
      newTransform.scaleY = parseFloat(newTransform.scaleY.toFixed(4));

      const familyObjects = newObjects.filter((o) => sourceFamilyIds.has(o.id));
      newObjects = newObjects.filter((o) => !sourceFamilyIds.has(o.id));
      familyObjects[0] = { ...familyObjects[0], parentId: newParentId, transform: newTransform };

      const newTargetIndex = newObjects.findIndex((o) => o.id === targetId);
      let insertIndex = newTargetIndex;

      if (position === 'inside') {
        insertIndex = newTargetIndex + 1;
      } else if (position === 'after') {
        const targetDescendants = getDescendants(targetId);
        const validDescendantsCount = targetDescendants.filter((o) => !sourceFamilyIds.has(o.id)).length;
        insertIndex = newTargetIndex + 1 + validDescendantsCount;
      }

      newObjects.splice(insertIndex, 0, ...familyObjects);

      newObjects = newObjects.map((obj) => {
        if (obj.type === 'GROUP') {
          const actualChildren = newObjects.filter((o) => o.parentId === obj.id);
          return { ...obj, children: actualChildren.map((c) => c.id) };
        }
        return obj;
      });

      return { objects: newObjects };
    });
  },

  updateObjectColorMode: (id, mode) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, colorMode: mode } : o)),
    }));
  },

  updateLineWidth: (id, width) => {
    get().pushToHistory();
    const clamped = Math.max(0.5, Math.min(20, width));
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, lineWidth: clamped } : o)),
    }));
  },

  updateLineStipple: (id, stipple) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, lineStipple: stipple } : o)),
    }));
  },

  updateRenderingMode: (id, mode) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id
          ? {
              ...o,
              renderingMode: mode,
              bufferUsage: mode === 'VBO' ? (o.bufferUsage ?? 'STATIC') : o.bufferUsage,
              updateMethod: o.updateMethod ?? 'BUFFER_SUB_DATA',
            }
          : o,
      ),
    }));
  },

  updateBufferUsage: (id, usage) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, bufferUsage: usage } : o)),
    }));
  },

  updateUseIndexed: (id, useIndexed) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, useIndexed } : o)),
    }));
  },

  updateUpdateMethod: (id, method) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, updateMethod: method } : o)),
    }));
  },

  attachTexture: (objectId, textureId) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => {
        if (o.id !== objectId) return o;
        const uvs = o.uvs && o.uvs.length === o.vertices.length
          ? o.uvs
          : defaultUVsFor(o.vertices);
        return {
          ...o,
          texture: {
            textureId,
            filter: o.texture?.filter ?? 'LINEAR',
            wrap:   o.texture?.wrap   ?? 'REPEAT',
          },
          uvs,
        };
      }),
    }));
  },

  detachTexture: (objectId) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === objectId ? { ...o, texture: null } : o,
      ),
    }));
  },

  updateTextureFilter: (objectId, filter) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => {
        if (o.id !== objectId || !o.texture) return o;
        return { ...o, texture: { ...o.texture, filter } };
      }),
    }));
  },

  updateTextureWrap: (objectId, wrap) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) => {
        if (o.id !== objectId || !o.texture) return o;
        return { ...o, texture: { ...o.texture, wrap } };
      }),
    }));
  },

  updateUV: (objectId, vertexIndex, uv) => {
    const state = get();
    if (!state.isBatchMode) state.pushToHistory();
    set((s) => ({
      objects: s.objects.map((o) => {
        if (o.id !== objectId) return o;
        const uvs = (o.uvs && o.uvs.length === o.vertices.length)
          ? [...o.uvs]
          : defaultUVsFor(o.vertices);
        if (vertexIndex < 0 || vertexIndex >= uvs.length) return o;
        uvs[vertexIndex] = uv;
        return { ...o, uvs };
      }),
    }));
  },

  resetUVsToDefault: (objectId) => {
    get().pushToHistory();
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === objectId ? { ...o, uvs: defaultUVsFor(o.vertices) } : o,
      ),
    }));
  },
});