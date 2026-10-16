import type { StateCreator } from 'zustand';
import type { VamsState, ViewportSlice } from '@/core/store/types';

export const createViewportSlice: StateCreator<VamsState, [], [], ViewportSlice> = (set) => ({
  viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
  axisVisibility: {
    showGlobalAxes: true,
    showLocalAxes: true,
    showOriginMarker: true,
    showGridlines: true,
    showGridNumbers: true,
  },
  // Automatically disabled by default to avoid redundancy with the initial Pipeline active tab
  showCoordinateTracker: false,
  
  setViewportLimits: (limits) => set((state) => ({
    viewportLimits: { ...state.viewportLimits, ...limits },
  })),
  
  setAxisVisibility: (visibility) => set((state) => ({
    axisVisibility: { ...state.axisVisibility, ...visibility },
  })),
  
  setShowCoordinateTracker: (show) => set({ showCoordinateTracker: show }),
});