import { create } from 'zustand';

export interface SelectedElement {
  global_id: string;
  ifc_type: string;
  name: string | null;
  properties: Record<string, any> | null;
}

export interface BOQItem {
  type: string;
  quantity: string;
  unit: string | null;
  total: number;
}

interface ViewerState {
  // Ribbon
  activeRibbonTab: string;
  setActiveRibbonTab: (tab: string) => void;

  // Selection
  selectedElement: SelectedElement | null;
  setSelectedElement: (el: SelectedElement | null) => void;

  // Panels
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;

  // Bottom panel tab
  bottomTab: 'boq' | 'issues' | 'clash';
  setBottomTab: (tab: 'boq' | 'issues' | 'clash') => void;

  // BOQ data
  boqItems: BOQItem[];
  setBoqItems: (items: BOQItem[]) => void;

  // Tree
  groupMode: 'spatial' | 'type';
  setGroupMode: (mode: 'spatial' | 'type') => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  // Ribbon
  activeRibbonTab: 'View',
  setActiveRibbonTab: (tab) => set({ activeRibbonTab: tab }),

  // Selection
  selectedElement: null,
  setSelectedElement: (el) => set({ selectedElement: el }),

  // Panels
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),

  // Bottom panel tab
  bottomTab: 'boq',
  setBottomTab: (tab) => set({ bottomTab: tab }),

  // BOQ
  boqItems: [],
  setBoqItems: (items) => set({ boqItems: items }),

  // Tree
  groupMode: 'spatial',
  setGroupMode: (mode) => set({ groupMode: mode }),
}));
