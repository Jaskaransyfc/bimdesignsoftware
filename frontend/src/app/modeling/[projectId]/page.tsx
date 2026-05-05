"use client";

import React, { useState, use, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Download,
  Eye,
  BarChart3,
  Settings,
  Share2,
  FileDown,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  Layers,
  Home,
  Workflow,
} from "lucide-react";
import CADEditor from "@/components/CADEditor";
import Model3DPreview from "@/components/Model3DPreview";
import FurnitureModelImport from "@/components/FurnitureModelImport";
import { Element } from "@/types/modeling";
import { generateProjectBOM, calculateDrawingStats } from "@/lib/calculations";
import { convert2DTo3D, exportModelAsJSON } from "@/lib/geometry3d";
import { formatImperial } from "@/lib/calculations";

interface ModelingProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function ModelingWorkspace({ params }: ModelingProps) {
  const { projectId } = use(params);
  const [elements, setElements] = useState<Element[]>([]);
  const [showProperties, setShowProperties] = useState(true);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [panelWidth, setPanelWidth] = useState(460);
  const [activePanelTab, setActivePanelTab] = useState<"info" | "materials">(
    "info",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [modelsRefresh, setModelsRefresh] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load drawing on mount
  useEffect(() => {
    const loadDrawing = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/drawing`);
        if (response.ok) {
          const data = await response.json();
          if (data.elements && data.elements.length > 0) {
            setElements(data.elements);
          }
        }
      } catch (error) {
        console.error("Failed to load drawing:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDrawing();
  }, [projectId]);

  const handleSaveDrawing = async (updatedElements: Element[]) => {
    setElements(updatedElements);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/drawing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          elements: updatedElements,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        alert("Project saved successfully!");
      } else {
        alert("Failed to save project. Please check your connection.");
      }
    } catch (error) {
      console.error("Save failed:", error);
      alert("Error saving project: " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAs3D = () => {
    const model3D = convert2DTo3D(elements, projectId);
    const jsonData = exportModelAsJSON(model3D);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `model_${projectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBOM = () => {
    const bom = generateProjectBOM(elements);
    const csv = generateBOMCSV(bom);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bom_${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = calculateDrawingStats(elements);
  const bom = generateProjectBOM(elements);

  return (
    <main className="h-screen bg-slate-900 flex flex-col">
      {/* Header - Revit Style */}
      <header className="bg-slate-950 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition">
            <Home className="w-5 h-5" />
          </Link>
          <div className="border-l border-slate-700 pl-4">
            <h1 className="text-xl font-bold text-white">2D Design Studio</h1>
            <p className="text-xs text-slate-400">Project: {projectId}</p>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-700 p-1">
            <button
              onClick={() => setView("2d")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                view === "2d"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4" /> 2D
            </button>
            <button
              onClick={() => setView("3d")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                view === "3d"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-4 h-4" /> 3D
            </button>
          </div>

          <button
            onClick={() => setShowProperties(!showProperties)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              showProperties
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:text-white"
            }`}
          >
            <PanelRightOpen className="w-4 h-4" /> Properties
          </button>
          <button
            onClick={() => handleSaveDrawing(elements)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={handleExportAs3D}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
          >
            <Eye className="w-4 h-4" /> 3D Export
          </button>

          <button
            onClick={handleExportBOM}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
          >
            <FileDown className="w-4 h-4" /> BOQ
          </button>

          <FurnitureModelImport 
            projectId={projectId}
            onImportSuccess={() => setModelsRefresh(prev => prev + 1)}
          />

          <Link
            href={`/modules/${projectId}`}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition border border-slate-600"
          >
            <Workflow className="w-4 h-4" /> Modules
          </Link>
        </div>
      </header>

      {/* Main Content - Single View */}
      <div className="flex flex-1 overflow-hidden gap-0">
        <div className="flex-1 bg-slate-800 min-w-0">
          {view === "2d" ? (
            <CADEditor
              projectId={projectId}
              onSave={handleSaveDrawing}
              onElementsChange={setElements}
              initialElements={elements}
            />
          ) : (
            <Model3DPreview 
              key={`3d-${modelsRefresh}`}
              elements={elements} 
              projectId={projectId} 
            />
          )}
        </div>

        {/* Right Panel - Properties & BOM */}
        <aside
          className={`bg-slate-800 border-l border-slate-700 overflow-hidden transition-all duration-200 ${
            showProperties ? "overflow-y-auto" : "border-l-0"
          }`}
          style={{ width: showProperties ? `${panelWidth}px` : "0px" }}
        >
          <div
            className="transition-opacity duration-200"
            style={{
              width: `${panelWidth}px`,
              opacity: showProperties ? 1 : 0,
              pointerEvents: showProperties ? "auto" : "none",
            }}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" /> Properties
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-lg">
                <button
                  onClick={() => setActivePanelTab("info")}
                  className={`flex-1 px-3 py-2 text-sm rounded font-medium transition ${
                    activePanelTab === "info"
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Info
                </button>
                <button
                  onClick={() => setActivePanelTab("materials")}
                  className={`flex-1 px-3 py-2 text-sm rounded font-medium transition ${
                    activePanelTab === "materials"
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Materials
                </button>
              </div>

              {activePanelTab === "info" && (
                <>
                  {/* Drawing Statistics */}
                  <div className="mb-8 bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-slate-400" /> Drawing
                      Statistics
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Wall Area:</span>
                        <strong className="text-white bg-slate-800 px-3 py-1 rounded">
                          {(stats.totalWallArea * 10.764).toFixed(1)} sq ft
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Wall Length:</span>
                        <strong className="text-white bg-slate-800 px-3 py-1 rounded">
                          {formatImperial(stats.totalWallLength * 1000)}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Floor Area:</span>
                        <strong className="text-white bg-slate-800 px-3 py-1 rounded">
                          {(stats.totalFloorArea * 10.764).toFixed(1)} sq ft
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Volume:</span>
                        <strong className="text-white bg-slate-800 px-3 py-1 rounded">
                          {stats.estimatedVolume} m³
                        </strong>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-400">
                            {stats.roomCount}
                          </div>
                          <div className="text-xs text-slate-500">Rooms</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-400">
                            {stats.doorCount}
                          </div>
                          <div className="text-xs text-slate-500">Doors</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-cyan-400">
                            {stats.windowCount}
                          </div>
                          <div className="text-xs text-slate-500">Windows</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Wall Schedule */}
                  <div className="mb-8">
                    <h3 className="font-bold text-white mb-3 text-sm">
                      🧱 Wall Schedule
                    </h3>
                    <div className="space-y-2 text-xs">
                      {bom.walls.length === 0 ? (
                        <p className="text-slate-500">No walls yet</p>
                      ) : (
                        bom.walls.map((wall) => (
                          <div
                            key={wall.id}
                            className="p-3 bg-slate-900 rounded border border-slate-700 hover:border-slate-600 transition"
                          >
                            <div className="font-semibold text-white">
                              {wall.material}
                            </div>
                            <div className="text-slate-400 mt-1">
                              {formatImperial(wall.totalLength * 1000)} ×{" "}
                              {formatImperial(wall.height)}
                            </div>
                            <div className="text-blue-400 font-medium mt-1">
                              {(wall.totalArea * 10.764).toFixed(1)} sq ft
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Door Schedule */}
                  <div className="mb-8">
                    <h3 className="font-bold text-white mb-3 text-sm">
                      🚪 Door Schedule
                    </h3>
                    <div className="space-y-2 text-xs">
                      {bom.doors.length === 0 ? (
                        <p className="text-slate-500">No doors yet</p>
                      ) : (
                        bom.doors.map((door, idx) => (
                          <div
                            key={door.id}
                            className="p-3 bg-slate-900 rounded border border-slate-700"
                          >
                            <div className="font-semibold text-white">
                              Door {idx + 1} - {formatImperial(door.width)} x{" "}
                              {formatImperial(door.height)}
                            </div>
                            <div className="text-slate-400 mt-1">
                              {door.material}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Window Schedule */}
                  <div className="mb-8">
                    <h3 className="font-bold text-white mb-3 text-sm">
                      🪟 Window Schedule
                    </h3>
                    <div className="space-y-2 text-xs">
                      {bom.windows.length === 0 ? (
                        <p className="text-slate-500">No windows yet</p>
                      ) : (
                        bom.windows.map((window_) => (
                          <div
                            key={window_.id}
                            className="p-3 bg-slate-900 rounded border border-slate-700"
                          >
                            <div className="font-semibold text-white">
                              {window_.description}
                            </div>
                            <div className="text-slate-400 mt-1">
                              Glazing: {window_.glazing}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {activePanelTab === "materials" && (
                <div className="space-y-3 mb-8">
                  <h3 className="font-bold text-white text-sm">
                    🧱 Material Usage
                  </h3>
                  {bom.materials.length === 0 ? (
                    <div className="p-4 bg-slate-900 rounded border border-slate-700 text-slate-400 text-sm">
                      Add walls, doors, and windows to see materials and costs.
                    </div>
                  ) : (
                    bom.materials.map((material) => (
                      <div
                        key={`${material.material}-${material.unit}`}
                        className="p-3 bg-slate-900 rounded border border-slate-700"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-white">
                            {material.material}
                          </div>
                          <div className="text-emerald-400 font-semibold">
                            ₹ {(material.cost ?? 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="text-slate-400 text-xs mt-1">
                          {material.quantity} {material.unit}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Cost Summary */}
              {bom.materials.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-700">
                  <h3 className="font-bold text-white mb-3 text-sm">
                    💰 Cost Estimate
                  </h3>
                  <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-2">
                      Estimated Cost
                    </div>
                    <div className="text-3xl font-bold text-green-400">
                      ₹{" "}
                      {bom.materials
                        .reduce((sum, m) => sum + (m.cost || 0), 0)
                        .toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="bg-slate-950 border-t border-slate-700 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex gap-6">
          <span>
            Elements: <strong className="text-white">{elements.length}</strong>
          </span>
          <span>
            Walls:{" "}
            <strong className="text-white">
              {formatImperial(stats.totalWallLength * 1000)}
            </strong>
          </span>
          <span>
            Doors: <strong className="text-white">{stats.doorCount}</strong>
          </span>
          <span>
            Windows: <strong className="text-white">{stats.windowCount}</strong>
          </span>
        </div>
        <span>{mounted ? new Date().toLocaleString() : ""}</span>
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────

function generateBOMCSV(bom: any): string {
  let csv = "Bill of Quantities (BOQ)\n\n";

  // Summary
  csv += "SUMMARY\n";
  csv += `Total Wall Area (m²),${bom.summary.totalWallArea}\n`;
  csv += `Total Floor Area (m²),${bom.summary.totalFloorArea}\n`;
  csv += `Total Wall Length (m),${bom.summary.totalWallLength}\n`;
  csv += `Estimated Volume (m³),${bom.summary.estimatedVolume}\n`;
  csv += `Rooms,${bom.summary.roomCount}\n`;
  csv += `Doors,${bom.summary.doorCount}\n`;
  csv += `Windows,${bom.summary.windowCount}\n\n`;

  // Walls
  csv += "WALL SCHEDULE\n";
  csv += "Material,Length (m),Height (m),Area (m²),Doors,Windows\n";
  bom.walls.forEach((wall: any) => {
    csv += `${wall.material},${wall.totalLength},${wall.height / 1000},${wall.totalArea},${wall.doorCount},${wall.windowCount}\n`;
  });
  csv += "\n";

  // Materials
  csv += "MATERIAL SCHEDULE\n";
  csv += "Material,Quantity,Unit,Cost (INR)\n";
  bom.materials.forEach((material: any) => {
    csv += `${material.material},${material.quantity},${material.unit},${material.cost || 0}\n`;
  });

  return csv;
}
