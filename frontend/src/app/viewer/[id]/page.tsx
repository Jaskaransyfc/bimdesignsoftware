'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Viewer, GLTFLoaderPlugin, AmbientLight, DirLight } from '@xeokit/xeokit-sdk';
import { useViewerStore } from '@/stores/viewerStore';
import type { SelectedElement } from '@/stores/viewerStore';
import {
  Home, Eye, Layers, Settings, HelpCircle,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  PanelBottomClose, PanelBottomOpen,
  Search, ChevronRight, EyeOff, X,
  ChevronDown, ChevronUp,
  Maximize2, RotateCcw, Box, Grid3X3,
  ArrowLeft, FileSpreadsheet, AlertTriangle, Zap
} from 'lucide-react';

// ─────────────────────────────────────────
// RIBBON
// ─────────────────────────────────────────
function Ribbon() {
  const { activeRibbonTab, setActiveRibbonTab, toggleLeftPanel, toggleRightPanel, toggleBottomPanel, leftPanelOpen, rightPanelOpen, bottomPanelOpen } = useViewerStore();
  const tabs = ['Home', 'View', 'Analyze'];

  const handleTabClick = (tab: string) => {
    setActiveRibbonTab(tab);
    if (tab === 'Home') {
      if (!leftPanelOpen) toggleLeftPanel();
    } else if (tab === 'View') {
      if (!rightPanelOpen) toggleRightPanel();
    } else if (tab === 'Analyze') {
      if (!bottomPanelOpen) toggleBottomPanel();
    } else if (tab === 'Help') {
      alert("Help center coming soon. Use 'Home' for Spatial Tree, 'View' for Properties, and 'Analyze' for Bill of Quantities.");
    }
  };

  return (
    <div className="bg-[#0a0b14] border-b border-white/5 flex items-center h-10 px-2 gap-1 select-none flex-shrink-0 z-40">
      {/* Logo / Back */}
      <Link href="/" className="flex items-center gap-2 px-3 py-1 text-white/40 hover:text-white transition-colors mr-2" title="Dashboard">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline">Dashboard</span>
      </Link>

      <div className="w-px h-5 bg-white/10 mr-1" />

      {/* Tabs */}
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => handleTabClick(tab)}
          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
            activeRibbonTab === tab
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-white/30 hover:text-white/60 hover:bg-white/5'
          }`}
        >
          {tab}
        </button>
      ))}

      <div className="flex-1" />

      {/* Panel toggles */}
      <button onClick={toggleLeftPanel} className={`p-1.5 rounded-md transition-all ${leftPanelOpen ? 'text-blue-400 bg-blue-500/10' : 'text-white/25 hover:text-white/50'}`} title="Toggle Tree">
        {leftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
      </button>
      <button onClick={toggleBottomPanel} className={`p-1.5 rounded-md transition-all ${bottomPanelOpen ? 'text-blue-400 bg-blue-500/10' : 'text-white/25 hover:text-white/50'}`} title="Toggle BOQ">
        {bottomPanelOpen ? <PanelBottomClose className="w-4 h-4" /> : <PanelBottomOpen className="w-4 h-4" />}
      </button>
      <button onClick={toggleRightPanel} className={`p-1.5 rounded-md transition-all ${rightPanelOpen ? 'text-blue-400 bg-blue-500/10' : 'text-white/25 hover:text-white/50'}`} title="Toggle Properties">
        {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// LEFT PANEL – Spatial / Type Tree
// ─────────────────────────────────────────
function LeftPanel({ hierarchy, allElements, viewerRef, projectId }: {
  hierarchy: any;
  allElements: any[];
  viewerRef: React.MutableRefObject<Viewer | null>;
  projectId: string;
}) {
  const { leftPanelOpen, groupMode, setGroupMode, setSelectedElement } = useViewerStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (hierarchy) setExpandedNodes(new Set([hierarchy.id]));
  }, [hierarchy]);

  const buildTypeTree = useCallback((elements: any[]) => {
    const grouped: Record<string, any[]> = {};
    elements.forEach(el => {
      const type = el.ifc_type || 'Other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(el);
    });
    return {
      id: 'type-root', name: 'All Elements', type: 'IfcProject',
      children: Object.entries(grouped).map(([type, items]) => ({
        id: `type-${type}`, name: type, type: 'IfcGroup',
        children: items.map(item => ({
          id: item.global_id, name: item.name || 'Unnamed', type: item.ifc_type, children: []
        }))
      }))
    };
  }, []);

  const setNodeVisibility = (node: any, visible: boolean) => {
    if (!viewerRef.current) return;
    const newHidden = new Set(hiddenNodes);
    const walk = (n: any) => {
      if (visible) newHidden.delete(n.id); else newHidden.add(n.id);
      const ent = viewerRef.current?.scene.objects[n.id];
      if (ent) ent.visible = visible;
      if (n.children) n.children.forEach(walk);
    };
    walk(node);
    setHiddenNodes(newHidden);
  };

  const selectNode = async (node: any) => {
    if (!viewerRef.current) return;
    const ent = viewerRef.current.scene.objects[node.id];
    if (ent) {
      viewerRef.current.scene.setObjectsSelected(viewerRef.current.scene.selectedObjectIds, false);
      ent.selected = true;
      viewerRef.current.cameraFlight.flyTo(ent);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${apiUrl}/api/elements/${projectId}/${node.id}`);
        if (res.ok) {
          const el = await res.json();
          setSelectedElement(el as SelectedElement);
        }
      } catch (err) {
        console.error('Property fetch error:', err);
      }
    }
  };

  const renderNode = (node: any): React.ReactNode => {
    if (!node) return null;
    const matchesSearch = node.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const hasMatchChild = node.children?.some((c: any) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (searchQuery && !matchesSearch && !hasMatchChild) return null;

    const expanded = expandedNodes.has(node.id) || (searchQuery !== '' && hasMatchChild);
    const hidden = hiddenNodes.has(node.id);
    const selectedEl = useViewerStore.getState().selectedElement;
    const selected = selectedEl?.global_id === node.id;

    return (
      <div key={node.id} className="ml-3">
        <div className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded group transition-all text-[11px] ${
          selected ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5'
        }`}>
          {node.children?.length > 0 ? (
            <button onClick={() => {
              const s = new Set(expandedNodes);
              if (s.has(node.id)) s.delete(node.id); else s.add(node.id);
              setExpandedNodes(s);
            }} className="text-white/20 flex-shrink-0">
              <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          ) : <div className="w-3" />}

          <button onClick={() => selectNode(node)} className={`flex-1 text-left truncate font-medium ${
            selected ? 'text-blue-400' : 'text-white/50 group-hover:text-white/80'
          }`}>
            {node.name}
          </button>

          <button
            onClick={() => setNodeVisibility(node, hidden)}
            className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${hidden ? 'text-red-400 !opacity-100' : 'text-white/20'}`}
          >
            {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
        {expanded && node.children?.map((c: any) => renderNode(c))}
      </div>
    );
  };

  const activeTree = groupMode === 'spatial' ? hierarchy : (allElements.length > 0 ? buildTypeTree(allElements) : null);

  if (!leftPanelOpen) return null;

  return (
    <div className="w-[280px] bg-[#0d0e1a] border-r border-white/5 flex flex-col flex-shrink-0 select-none">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5 bg-[#0f1020]">
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => setGroupMode('spatial')}
            className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider rounded-lg transition ${
              groupMode === 'spatial' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/35'
            }`}
          >
            🏗 Spatial
          </button>
          <button
            onClick={() => setGroupMode('type')}
            className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider rounded-lg transition ${
              groupMode === 'type' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/35'
            }`}
          >
            🧱 Type
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
          <input
            type="text" placeholder="Search…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-lg pl-7 pr-3 py-1.5 text-[11px] focus:border-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {activeTree ? renderNode(activeTree) : (
          <div className="text-center py-20 text-white/15 text-xs italic">
            {groupMode === 'spatial' ? 'No spatial data.' : 'No elements loaded.'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// RIGHT PANEL – Properties
// ─────────────────────────────────────────
function RightPanel() {
  const { rightPanelOpen, selectedElement } = useViewerStore();

  if (!rightPanelOpen) return null;

  return (
    <div className="w-[320px] bg-[#0d0e1a] border-l border-white/5 flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-white/5 bg-[#0f1020]">
        <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Properties</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedElement ? (
          <div className="space-y-4">
            {/* Identity card */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
              <div>
                <span className="text-[9px] text-blue-400/60 font-bold uppercase tracking-wider">Entity</span>
                <p className="text-base font-bold mt-0.5">{selectedElement.ifc_type}</p>
              </div>
              <div>
                <span className="text-[9px] text-blue-400/60 font-bold uppercase tracking-wider">Name</span>
                <p className="text-base font-bold mt-0.5">{selectedElement.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[9px] text-blue-400/60 font-bold uppercase tracking-wider">Global ID</span>
                <p className="text-xs font-mono text-white/50 mt-0.5">{selectedElement.global_id}</p>
              </div>
            </div>

            {/* Property sets */}
            <div>
              <h3 className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-3">Metadata</h3>
              {Object.keys(selectedElement.properties || {}).length === 0 ? (
                <p className="text-white/25 text-xs italic">No properties found.</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(selectedElement.properties!).map(([k, v]: [string, any]) => (
                    <div key={k} className="bg-white/[0.02] rounded-lg px-3 py-2 hover:bg-white/[0.05] transition-all">
                      <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider block">{k}</span>
                      <span className="text-xs text-white/80 font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-white/15">
            <Box className="w-10 h-10 mb-3" />
            <p className="text-xs font-medium">Select an element in the 3D view or tree</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// BOTTOM PANEL – BOQ / Issues / Clash
// ─────────────────────────────────────────
function BottomPanel() {
  const { bottomPanelOpen, toggleBottomPanel, bottomTab, setBottomTab, boqItems } = useViewerStore();

  if (!bottomPanelOpen) return null;

  const tabs = [
    { key: 'boq' as const, label: 'Bill of Quantities', icon: FileSpreadsheet },
    { key: 'issues' as const, label: 'Issues', icon: AlertTriangle },
    { key: 'clash' as const, label: 'Clash Detection', icon: Zap },
  ];

  return (
    <div className="h-[260px] bg-[#0d0e1a] border-t border-white/5 flex flex-col flex-shrink-0">
      {/* Tab bar */}
      <div className="flex items-center border-b border-white/5 bg-[#0f1020] px-2 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setBottomTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
              bottomTab === tab.key ? 'text-blue-400 border-b-2 border-blue-400' : 'text-white/30 hover:text-white/50'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={toggleBottomPanel} className="text-white/20 hover:text-white/50 p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {bottomTab === 'boq' ? (
          boqItems.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f1020]">
                <tr className="text-left text-[9px] font-bold uppercase tracking-wider text-white/30">
                  <th className="py-2 px-4">IFC Type</th>
                  <th className="py-2 px-4">Quantity</th>
                  <th className="py-2 px-4 text-right">Total</th>
                  <th className="py-2 px-4">Unit</th>
                </tr>
              </thead>
              <tbody>
                {boqItems.map((item, i) => (
                  <tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                    <td className="py-1.5 px-4 text-white/60 font-medium">{item.type}</td>
                    <td className="py-1.5 px-4 text-white/50">{item.quantity}</td>
                    <td className="py-1.5 px-4 text-right font-mono text-white/70">{item.total.toFixed(2)}</td>
                    <td className="py-1.5 px-4 text-white/40">{item.unit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-white/15 text-xs">
              No BOQ data extracted for this project.
            </div>
          )
        ) : bottomTab === 'issues' ? (
          <div className="flex items-center justify-center h-full text-white/15 text-xs gap-2">
            <AlertTriangle className="w-4 h-4" /> Issue tracking coming soon
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white/15 text-xs gap-2">
            <Zap className="w-4 h-4" /> Clash detection coming soon
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// VIEWPORT – 3D Canvas with overlay controls
// ─────────────────────────────────────────
function Viewport({ canvasRef, viewerRef, loading }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewerRef: React.MutableRefObject<Viewer | null>;
  loading: boolean;
}) {
  const fitAll = () => {
    if (!viewerRef.current) return;
    const model = viewerRef.current.scene.models['main-model'];
    if (model) viewerRef.current.cameraFlight.flyTo(model);
  };

  const resetView = () => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.eye = [-10, 10, -10];
    viewerRef.current.camera.look = [0, 0, 0];
    viewerRef.current.camera.up = [0, 1, 0];
  };

  const toggleXray = () => {
    if (!viewerRef.current) return;
    const objects = viewerRef.current.scene.objectIds;
    const firstObj = viewerRef.current.scene.objects[objects[0]];
    if (firstObj) {
      const currentXray = firstObj.xrayed;
      viewerRef.current.scene.setObjectsXRayed(objects, !currentXray);
    }
  };

  return (
    <div className="flex-1 relative bg-[#080912] min-h-0">
      <canvas className="w-full h-full cursor-default block" ref={canvasRef} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xl z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-400 font-bold tracking-widest text-[10px] uppercase">Rendering BIM Model…</p>
          </div>
        </div>
      )}

      {/* Floating toolbar */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        <button onClick={fitAll} className="w-8 h-8 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-black/70 transition-all" title="Fit All">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={resetView} className="w-8 h-8 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-black/70 transition-all" title="Reset View">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button onClick={toggleXray} className="w-8 h-8 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-black/70 transition-all" title="Toggle X-Ray">
          <Grid3X3 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE – 5-Pane Shell
// ─────────────────────────────────────────
export default function ViewerPage() {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  const [loading, setLoading] = useState(true);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [allElements, setAllElements] = useState<any[]>([]);

  const { setSelectedElement, setBoqItems } = useViewerStore();
  const projectId = id as string;

  useEffect(() => {
    let active = true;
    let viewer: Viewer | null = null;

    const init = async () => {
      if (!canvasRef.current || viewerRef.current) return;

      try {
        viewer = new Viewer({
          canvasElement: canvasRef.current!,
          transparent: false,
          backgroundColor: [0.03, 0.03, 0.07, 1]
        });
        viewerRef.current = viewer;

        // Lights
        new AmbientLight(viewer.scene, { color: [1.0, 1.0, 1.0], intensity: 0.8 });
        new DirLight(viewer.scene, { dir: [0.8, -0.6, -0.8], color: [1.0, 1.0, 1.0], intensity: 1.0, space: 'world' });
        new DirLight(viewer.scene, { dir: [-0.8, -0.4, 0.4], color: [1.0, 1.0, 1.0], intensity: 0.6, space: 'world' });

        viewer.camera.eye = [-10, 10, -10];
        viewer.camera.look = [0, 0, 0];
        viewer.camera.up = [0, 1, 0];

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

        // Fetch project data (includes hierarchy)
        const res = await fetch(`${apiUrl}/api/projects/${projectId}`);
        if (!res.ok) throw new Error('Failed to fetch project');
        const data = await res.json();
        if (!active || !viewer) return;

        setHierarchy(data.hierarchy);

        // Fetch elements for type tree
        try {
          const elemRes = await fetch(`${apiUrl}/api/elements/${projectId}`);
          if (elemRes.ok) setAllElements(await elemRes.json());
        } catch (e) { console.warn('Could not fetch elements', e); }

        // Fetch BOQ data
        try {
          const boqRes = await fetch(`${apiUrl}/api/projects/${projectId}/boq-summary`);
          if (boqRes.ok) setBoqItems(await boqRes.json());
        } catch (e) { console.warn('Could not fetch BOQ', e); }

        // Load 3D model
        const viewerFile = data.viewer_file || data.xkt_file;
        if (data.status === 'ready' && viewerFile) {
          const loader = new GLTFLoaderPlugin(viewer);
          const url = `${apiUrl}/api/storage/${viewerFile}`;
          const model = loader.load({ id: 'main-model', src: url, edges: true });
          model.on('loaded', () => {
            if (active && viewer) {
              viewer.cameraFlight.jumpTo(model);
              setLoading(false);
            }
          });
        } else {
          setLoading(false);
        }

        // Hover
        viewer.cameraControl.on('hover', (pick: any) => {
          if (!viewer) return;
          viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
          if (pick.entity) pick.entity.highlighted = true;
        });

        // Pick → update Zustand store
        viewer.cameraControl.on('picked', async (pick: any) => {
          if (!viewer || !active) return;
          viewer.scene.setObjectsSelected(viewer.scene.selectedObjectIds, false);
          if (pick.entity) {
            pick.entity.selected = true;
            try {
              const propRes = await fetch(`${apiUrl}/api/elements/${projectId}/${pick.entity.id}`);
              if (propRes.ok) {
                const el = await propRes.json();
                setSelectedElement(el as SelectedElement);
              }
            } catch { /* ignore */ }
          } else {
            setSelectedElement(null);
          }
        });

      } catch (err) {
        console.error('Viewer init error:', err);
        setLoading(false);
      }
    };

    init();

    return () => {
      active = false;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      setSelectedElement(null);
      setBoqItems([]);
    };
  }, [projectId, setSelectedElement, setBoqItems]);

  return (
    <div className="flex flex-col h-screen bg-[#0d0e1a] text-white overflow-hidden">
      {/* 1. Ribbon */}
      <Ribbon />

      {/* 2. Main area: Left + Center + Right */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel – Tree */}
        <LeftPanel
          hierarchy={hierarchy}
          allElements={allElements}
          viewerRef={viewerRef}
          projectId={projectId}
        />

        {/* Center: Viewport + Bottom */}
        <div className="flex-1 flex flex-col min-w-0">
          <Viewport canvasRef={canvasRef} viewerRef={viewerRef} loading={loading} />
          <BottomPanel />
        </div>

        {/* Right Panel – Properties */}
        <RightPanel />
      </div>
    </div>
  );
}