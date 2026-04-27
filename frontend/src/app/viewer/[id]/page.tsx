'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Viewer, GLTFLoaderPlugin } from '@xeokit/xeokit-sdk';

export default function ViewerPage() {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || viewerRef.current) return;

    const initViewer = async () => {
      try {
        // 1. Initialize Xeokit Viewer
        const viewer = new Viewer({
          canvasElement: canvasRef.current!,
          transparent: true
        });
        viewerRef.current = viewer;

        // 2. Setup Camera
        viewer.camera.eye = [-10, 10, -10];
        viewer.camera.look = [0, 0, 0];
        viewer.camera.up = [0, 1, 0];

        // 3. Setup GLTF Loader
        const gltfLoader = new GLTFLoaderPlugin(viewer);

        // 4. Fetch Model Info
        const projectRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}`);
        const projectData = await projectRes.json();

        if (projectData.status !== 'ready') {
          console.warn("Project not ready yet, status:", projectData.status);
          setLoading(false);
          return;
        }

        if (!projectData.xkt_file) {
          throw new Error("GLB file path missing in project data");
        }

        const glbUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/storage/${projectData.xkt_file}`;

        // 5. Load the Model
        // We ensure the viewer is still active before loading
        if (!viewerRef.current) return;

        const model = gltfLoader.load({
          id: "myModel",
          src: glbUrl,
          edges: true
        });

        model.on("loaded", () => {
          if (viewerRef.current) {
            viewerRef.current.cameraFlight.jumpTo(model);
          }
          setLoading(false);
        });

        // 6. Handle Interaction (Picking)
        viewer.cameraControl.on("picked", async (pickResult) => {
          if (pickResult.entity) {
            const globalId = pickResult.entity.id;
            
            // Highlight selected
            viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
            pickResult.entity.highlighted = true;

            try {
              const propRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/elements/${id}/${globalId}`);
              if (propRes.ok) {
                const data = await propRes.json();
                setSelectedElement(data);
              } else {
                setSelectedElement({ global_id: globalId, name: "Metadata not found", properties: {} });
              }
            } catch (err) {
              console.error("Property fetch error:", err);
            }
          } else {
            viewer.scene.setObjectsHighlighted(viewer.scene.highlightedObjectIds, false);
            setSelectedElement(null);
          }
        });

      } catch (error) {
        console.error("Viewer initialization failed:", error);
        setLoading(false);
      }
    };

    initViewer();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [id]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      <div className="flex-1 relative bg-gradient-to-b from-[#1a1c2c] to-[#0d0e1a]">
        <canvas className="w-full h-full cursor-crosshair" ref={canvasRef} />
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-gray-900/60 backdrop-blur-md">
            <div className="flex flex-col items-center gap-6 p-10 rounded-3xl border border-white/10 bg-white/5">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
              <p className="text-blue-400 font-semibold tracking-wider uppercase animate-pulse">Initializing BIM Engine...</p>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-6 left-6 flex gap-2 pointer-events-none">
          <div className="px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-[10px] text-white/60 font-medium uppercase tracking-widest">
            Xeokit 3D SDK
          </div>
        </div>
      </div>

      <div className="w-[420px] bg-[#0d0e1a] text-white border-l border-white/5 overflow-y-auto shadow-2xl z-20 flex flex-col">
        <div className="p-8 border-b border-white/5 bg-[#121422]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,1)]"></div>
            <h2 className="text-xl font-bold tracking-tight">Project Explorer</h2>
          </div>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">BIM Data & Specifications</p>
        </div>
        
        <div className="flex-1">
          {selectedElement ? (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="space-y-4">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 group">
                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2 opacity-70 group-hover:opacity-100 transition-opacity">IFC Entity</label>
                  <p className="text-xl font-semibold text-white tracking-tight">{selectedElement.ifc_type}</p>
                </div>
                
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 group">
                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2 opacity-70 group-hover:opacity-100 transition-opacity">Name</label>
                  <p className="text-xl font-semibold text-white tracking-tight">{selectedElement.name || 'N/A'}</p>
                </div>
                
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2 opacity-70">Global ID</label>
                  <p className="font-mono text-xs text-white/40 break-all leading-relaxed">{selectedElement.global_id}</p>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] mb-6 flex items-center gap-4">
                  Metadata <span className="flex-1 h-px bg-white/5"></span>
                </h3>
                
                {selectedElement.properties && Object.keys(selectedElement.properties).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(selectedElement.properties).map(([key, value]: [string, any]) => (
                      <div key={key} className="group bg-white/[0.02] p-4 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-all">
                        <span className="text-[10px] text-white/40 group-hover:text-blue-400 transition-colors block mb-1 font-bold tracking-wider">{key}</span>
                        <span className="text-sm font-medium text-white/90">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                    <p className="text-white/20 text-xs italic tracking-wide">No additional properties found</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-blue-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 border border-blue-500/20 shadow-2xl">
                <svg className="w-10 h-10 text-blue-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Model Ready</h3>
              <p className="text-white/40 text-sm leading-relaxed max-w-[240px]">
                Interact with the 3D geometry to inspect detailed BIM metadata and structural hierarchies.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}