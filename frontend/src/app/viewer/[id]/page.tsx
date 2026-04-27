'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Viewer, GLTFLoaderPlugin, AmbientLight, DirLight } from '@xeokit/xeokit-sdk';

export default function ViewerPage() {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'properties' | 'structure'>('structure');
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [allElements, setAllElements] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [groupMode, setGroupMode] = useState<'spatial' | 'type'>('spatial');

  useEffect(() => {
    let active = true;
    let viewer: Viewer | null = null;

    const init = async () => {
      if (!canvasRef.current || viewerRef.current) return;

      try {
        // Create Viewer
        viewer = new Viewer({
          canvasElement: canvasRef.current!,
          transparent: false,
          backgroundColor: [0.05, 0.05, 0.1, 1]
        });
        viewerRef.current = viewer;

        // Lights
        new AmbientLight(viewer.scene, { color: [1.0, 1.0, 1.0], intensity: 0.8 });
        new DirLight(viewer.scene, { dir: [0.8, -0.6, -0.8], color: [1.0, 1.0, 1.0], intensity: 1.0, space: "world" });
        new DirLight(viewer.scene, { dir: [-0.8, -0.4, 0.4], color: [1.0, 1.0, 1.0], intensity: 0.6, space: "world" });

        viewer.camera.eye = [-10, 10, -10];
        viewer.camera.look = [0, 0, 0];
        viewer.camera.up = [0, 1, 0];

        // Fetch Project Data (includes hierarchy)
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}`);
        if (!res.ok) throw new Error("Failed to fetch project");
        const data = await res.json();

        if (!active || !viewer) return;

        setHierarchy(data.hierarchy);
        if (data.hierarchy) setExpandedNodes(new Set([data.hierarchy.id]));

        // Fetch all elements for type-based grouping
        try {
          const elemRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/elements/${id}`);
          if (elemRes.ok) setAllElements(await elemRes.json());
        } catch (e) {
          console.warn("Could not fetch elements list", e);
        }

        // Load the 3D model
        if (data.status === 'ready' && data.xkt_file) {
          const loader = new GLTFLoaderPlugin(viewer);
          const url = `${process.env.NEXT_PUBLIC_API_URL}/api/storage/${data.xkt_file}`;
          
          const model = loader.load({
            id: "main-model",
            src: url,
            edges: true
          });

          model.on("loaded", () => {
            if (active && viewer) {
              viewer.cameraFlight.jumpTo(model);
              setLoading(false);
            }
          });
        } else {
          setLoading(false);
        }

        // Hover effect
        viewer.cameraControl.on("hover", (pick) => {
          if (!viewer) return;
          viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
          if (pick.entity) pick.entity.highlighted = true;
        });

        // Click to select & show properties
        viewer.cameraControl.on("picked", async (pick) => {
          if (!viewer || !active) return;
          viewer.scene.setObjectsSelected(viewer.scene.selectedObjectIds, false);
          if (pick.entity) {
            pick.entity.selected = true;
            const propRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/elements/${id}/${pick.entity.id}`);
            if (propRes.ok) {
              const el = await propRes.json();
              setSelectedElement(el);
              setActiveTab('properties');
            }
          } else {
            setSelectedElement(null);
          }
        });

      } catch (err) {
        console.error("Init error:", err);
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
    };
  }, [id]);

  // ----------------------------------------------
  // Tree helpers
  // ----------------------------------------------

  // Build a type‑based tree: root → IFC types → elements
  const buildTypeTree = (elements: any[]) => {
    const grouped: Record<string, any[]> = {};
    elements.forEach(el => {
      const type = el.ifc_type || 'Other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(el);
    });

    const root: any = {
      id: 'type-root',
      name: 'All Elements',
      type: 'IfcProject',
      children: Object.entries(grouped).map(([type, items]) => ({
        id: `type-${type}`,
        name: type,
        type: 'IfcGroup',
        children: items.map(item => ({
          id: item.global_id,            // matches entity ID in the 3D scene
          name: item.name || 'Unnamed',
          type: item.ifc_type,
          children: []
        }))
      }))
    };
    return root;
  };

  // Toggle node visibility (works on spatial tree and leaf elements)
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

  // Select a tree node: fly to & show properties
  const selectNode = async (node: any) => {
    if (!viewerRef.current) return;
    const ent = viewerRef.current.scene.objects[node.id];
    if (ent) {
      // Deselect all, then select this one
      viewerRef.current.scene.setObjectsSelected(viewerRef.current.scene.selectedObjectIds, false);
      ent.selected = true;
      viewerRef.current.cameraFlight.flyTo(ent);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/elements/${id}/${node.id}`);
        if (res.ok) {
          const el = await res.json();
          setSelectedElement(el);
          setActiveTab('properties');
        }
      } catch (err) {
        console.error("Property fetch error:", err);
      }
    }
  };

  // Recursive tree rendering (works for both spatial and type trees)
  const renderNode = (node: any) => {
    if (!node) return null;
    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
    const hasMatchChild = node.children?.some((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (searchQuery && !matchesSearch && !hasMatchChild) return null;

    const expanded = expandedNodes.has(node.id) || (searchQuery && hasMatchChild);
    const hidden = hiddenNodes.has(node.id);
    const selected = selectedElement?.global_id === node.id;

    return (
      <div key={node.id} className="ml-4">
        <div className={`flex items-center gap-2 py-1 px-2 rounded-lg group transition-all ${selected ? 'bg-blue-600/20 border border-blue-500/20' : 'hover:bg-white/5'}`}>
          {/* Expand/collapse button */}
          {node.children?.length > 0 ? (
            <button onClick={() => {
              const s = new Set(expandedNodes);
              if (s.has(node.id)) s.delete(node.id); else s.add(node.id);
              setExpandedNodes(s);
            }} className="text-white/20">
              <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M9 5l7 7-7 7" /></svg>
            </button>
          ) : <div className="w-3" />}
          
          {/* Node name – click to select */}
          <button onClick={() => selectNode(node)} className={`flex-1 text-left text-[11px] font-bold truncate ${selected ? 'text-blue-400' : 'text-white/40 group-hover:text-white/80'}`}>
            {node.name}
          </button>

          {/* Visibility toggle (only if it has a corresponding 3D object or children) */}
          <button onClick={() => setNodeVisibility(node, hidden)} className={`opacity-0 group-hover:opacity-100 ${hidden ? 'text-red-500 opacity-100' : 'text-white/20'}`}>
            {hidden ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
          </button>
        </div>
        {expanded && node.children?.map((c: any) => renderNode(c))}
      </div>
    );
  };

  // Get the currently displayed tree (spatial or type)
  const activeTree = groupMode === 'spatial' ? hierarchy : (allElements.length > 0 ? buildTypeTree(allElements) : null);

  return (
    <div className="flex h-screen bg-[#0d0e1a] overflow-hidden" ref={containerRef}>
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <canvas className="w-full h-full cursor-crosshair" ref={canvasRef} />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xl z-50">
            <div className="flex flex-col items-center gap-6"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p className="text-blue-400 font-black tracking-widest text-xs uppercase">Rendering BIM Data...</p></div>
          </div>
        )}
      </div>

      {/* Side Panel */}
      <div className="w-[450px] bg-[#0d0e1a] border-l border-white/5 flex flex-col shadow-2xl z-20">
        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#121422]">
          <button onClick={() => setActiveTab('properties')} className={`flex-1 py-7 text-[10px] font-black uppercase tracking-[0.3em] ${activeTab === 'properties' ? 'text-blue-400 bg-white/5' : 'text-white/30'}`}>Properties</button>
          <button onClick={() => setActiveTab('structure')} className={`flex-1 py-7 text-[10px] font-black uppercase tracking-[0.3em] ${activeTab === 'structure' ? 'text-blue-400 bg-white/5' : 'text-white/30'}`}>Spatial Tree</button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'properties' ? (
            <div className="p-10">
              {selectedElement ? (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-10">
                  <div className="space-y-4">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10"><label className="text-[9px] font-black text-blue-400/50 uppercase block mb-1">Entity</label><p className="text-xl font-bold">{selectedElement.ifc_type}</p></div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10"><label className="text-[9px] font-black text-blue-400/50 uppercase block mb-1">Name</label><p className="text-xl font-bold">{selectedElement.name || 'N/A'}</p></div>
                  </div>
                  <div className="pt-8 border-t border-white/5">
                    <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-8">Metadata</h3>
                    {Object.keys(selectedElement.properties || {}).length === 0 ? (
                      <p className="text-white/30 italic text-sm">No properties found.</p>
                    ) : (
                      <div className="grid gap-4">
                        {Object.entries(selectedElement.properties!).map(([k, v]: [string, any]) => (
                          <div key={k} className="bg-white/[0.02] p-5 rounded-2xl border border-transparent hover:border-white/10 transition-all">
                            <span className="text-[10px] text-white/30 block mb-1.5 font-black uppercase tracking-widest">{k}</span>
                            <span className="text-sm font-semibold text-white/90">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center opacity-20 text-center px-10">
                  <h4 className="text-lg font-bold mb-3 uppercase tracking-tighter">Selection Required</h4>
                  <p className="text-xs">Pick an element in the 3D view or use the Spatial Tree to explore BIM parameters.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Group mode selector & search */}
              <div className="border-b border-white/5 bg-[#121422] px-4 py-3">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setGroupMode('spatial')}
                    className={`flex-1 py-2 text-[10px] font-black tracking-wider rounded-xl transition ${groupMode === 'spatial' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40'}`}>
                    🏗 Spatial
                  </button>
                  <button
                    onClick={() => setGroupMode('type')}
                    className={`flex-1 py-2 text-[10px] font-black tracking-wider rounded-xl transition ${groupMode === 'type' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40'}`}>
                    🧱 Type
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Search elements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 text-[11px] font-bold focus:border-blue-500 transition-all outline-none"
                />
              </div>
              {/* Tree rendering */}
              <div className="flex-1 overflow-y-auto p-4 select-none">
                {activeTree ? renderNode(activeTree) : (
                  <div className="text-center py-20 text-white/10 italic text-sm">
                    {groupMode === 'spatial' ? 'No spatial data found.' : 'No elements loaded.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}