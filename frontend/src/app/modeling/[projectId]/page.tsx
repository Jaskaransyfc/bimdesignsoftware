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
  Plus,
} from "lucide-react";
import CADEditor from "@/components/CADEditor";
import Model3DPreview from "@/components/Model3DPreview";
import FurnitureModelImport from "@/components/FurnitureModelImport";
import LevelPanel from "@/components/LevelPanel";
import {
  DEFAULT_FLOOR_HEIGHT_MM,
  Element,
  Door,
  Window,
  Wall,
  Stair,
  Floor,
  Level,
} from "@/types/modeling";
import {
  generateProjectBOM,
  calculateDrawingStats,
  metersToMM,
  mmToMeters,
} from "@/lib/calculations";
import { convert2DTo3D, exportModelAsJSON } from "@/lib/geometry3d";
import { formatImperial } from "@/lib/calculations";

interface ModelingProps {
  params: Promise<{
    projectId: string;
  }>;
}

type LevelApiItem = Partial<Level> & {
  project_id?: string;
};

const sortLevels = (items: Level[]) =>
  [...items].sort((a, b) => a.order - b.order);

const normalizeLevel = (
  level: LevelApiItem,
  index: number,
  projectId: string,
): Level => {
  const elevationMM = level.elevation_mm ?? metersToMM(level.elevation_m ?? 0);
  return {
    id: level.id ?? "",
    projectId: level.projectId ?? level.project_id ?? projectId,
    name: level.name ?? `Level ${index}`,
    elevation_m: level.elevation_m ?? mmToMeters(elevationMM),
    elevation_mm: elevationMM,
    order: Number(level.order ?? index),
    color: level.color,
    isActive: level.isActive,
  };
};

const ColorPicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) => {
  const colors = [
    "#ffffff",
    "#f8fafc",
    "#f1f5f9",
    "#e2e8f0",
    "#94a3b8",
    "#475569",
    "#1e293b",
    "#b56a2a",
    "#8a4a1d",
    "#5c3217",
    "#3b82f6",
    "#ef4444",
    "#22c55e",
  ];

  return (
    <div className="space-y-2 pb-3 border-b border-slate-800">
      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
        Primary Color
      </label>
      <div className="flex flex-wrap gap-2 pt-1 items-center">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 ${
              value === c
                ? "ring-2 ring-blue-500 ring-offset-1 scale-110"
                : "border-slate-700"
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        {/* Custom Color Input */}
        <div className="relative flex items-center justify-center w-6 h-6 rounded-full border border-slate-700 overflow-hidden shadow-sm hover:scale-110 transition-transform group">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-[200%] h-[200%] cursor-pointer -translate-x-1/4 -translate-y-1/4"
            title="Custom Color"
          />
        </div>
      </div>
    </div>
  );
};

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
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [applyFlash, setApplyFlash] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [isAddingLevel, setIsAddingLevel] = useState(false);

  // Update a property on the selected element and propagate to elements array
  const handlePropertyUpdate = (field: string, value: any) => {
    if (!selectedElement) return;
    const updatedElement = { ...selectedElement, [field]: value } as Element;
    setSelectedElement(updatedElement);
    setElements((prev) =>
      prev.map((el) => (el.id === selectedElement.id ? updatedElement : el)),
    );
  };

  // Update nested metadata fields
  const handleMetadataUpdate = (field: string, value: any) => {
    if (!selectedElement) return;
    const meta = (selectedElement as any).metadata || {};
    const updatedElement = {
      ...selectedElement,
      metadata: { ...meta, [field]: value },
    } as Element;
    setSelectedElement(updatedElement);
    setElements((prev) =>
      prev.map((el) => (el.id === selectedElement.id ? updatedElement : el)),
    );
  };

  const handleApplyChanges = () => {
    setApplyFlash(true);
    setTimeout(() => setApplyFlash(false), 1800);
    // Auto-save
    handleSaveDrawing(elements);
  };

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

  useEffect(() => {
    const loadLevels = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/levels`);
        let data = response.ok ? await response.json() : [];
        if (!Array.isArray(data) || data.length === 0) {
          const initResponse = await fetch(`/api/projects/${projectId}/levels/init`, {
            method: "POST",
          });
          data = initResponse.ok ? await initResponse.json() : [];
        }
        if (!Array.isArray(data)) data = [];
        const normalized = sortLevels(
          data.map((level: LevelApiItem, index: number) =>
            normalizeLevel(level, index, projectId),
          ),
        );
        setLevels(normalized);
        const storageKey = `bim_active_level_${projectId}`;
        const fromStorage = localStorage.getItem(storageKey);
        const candidate = normalized.find((level: Level) => level.id === fromStorage)?.id;
        const nextActive = candidate || normalized[0]?.id || null;
        setActiveLevelId(nextActive);
      } catch (error) {
        console.error("Failed to load levels", error);
      }
    };
    loadLevels();
  }, [projectId]);

  useEffect(() => {
    if (!activeLevelId) return;
    localStorage.setItem(`bim_active_level_${projectId}`, activeLevelId);
  }, [projectId, activeLevelId]);

  const handleAddLevel = async () => {
    if (isAddingLevel) return;

    const orderedLevels = sortLevels(levels);
    const nextOrder = orderedLevels.length;
    const highestMM = orderedLevels.length
      ? Math.max(...orderedLevels.map((level) => level.elevation_mm))
      : 0;

    setIsAddingLevel(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextOrder === 0 ? "Ground Floor" : `Level ${nextOrder}`,
          elevation_m: mmToMeters(
            nextOrder === 0 ? 0 : highestMM + DEFAULT_FLOOR_HEIGHT_MM,
          ),
          order: nextOrder,
        }),
      });

      if (!response.ok) {
        alert("Failed to add level. Please try again.");
        return;
      }

      const created = normalizeLevel(await response.json(), nextOrder, projectId);
      const nextLevels = sortLevels([...orderedLevels, created]).map(
        (level, index) => ({ ...level, order: index }),
      );
      setLevels(nextLevels);
      setActiveLevelId(created.id);
    } catch (error) {
      console.error("Failed to add level", error);
      alert("Failed to add level. Please try again.");
    } finally {
      setIsAddingLevel(false);
    }
  };

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
  const activeLevelName =
    levels.find((level) => level.id === activeLevelId)?.name || "No level selected";

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
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${view === "2d"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
                }`}
            >
              <Layers className="w-4 h-4" /> 2D
            </button>
            <button
              onClick={() => setView("3d")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${view === "3d"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
                }`}
            >
              <Eye className="w-4 h-4" /> 3D
            </button>
          </div>
          <select
            value={activeLevelId || ""}
            onChange={(event) => setActiveLevelId(event.target.value || null)}
            className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 text-sm"
          >
            <option value="">Editing: {activeLevelName}</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                Editing: {level.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddLevel}
            disabled={isAddingLevel}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition disabled:opacity-50"
            title="Add next floor level"
          >
            <Plus className="w-4 h-4" />
            {isAddingLevel ? "Adding..." : "Level"}
          </button>

          <button
            onClick={() => setShowProperties(!showProperties)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${showProperties
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
              onSelectionChange={(el) => setSelectedElement(el)}
              initialElements={elements}
              levels={levels}
              activeLevelId={activeLevelId}
              onActiveLevelChange={setActiveLevelId}
            />
          ) : (
            <Model3DPreview
              key={`3d-${modelsRefresh}`}
              elements={elements}
              projectId={projectId}
              selectedElementId={selectedElement?.id}
              levels={levels}
              activeLevelId={activeLevelId}
            />
          )}
        </div>

        {/* Right Panel - Properties & BOM */}
        <aside
          className={`bg-slate-800 border-l border-slate-700 overflow-hidden transition-all duration-200 ${showProperties ? "overflow-y-auto" : "border-l-0"
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


              {/* ─── SELECTED ELEMENT PROPERTY EDITOR ─── */}
              {selectedElement && (
                <div className="mb-6 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Element Header */}
                  <div className="px-4 py-3 bg-slate-950 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {selectedElement.type === "door"
                          ? "🚪"
                          : selectedElement.type === "window"
                            ? "🪟"
                            : selectedElement.type === "wall"
                              ? "🧱"
                              : "📐"}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white capitalize">
                          {selectedElement.type} Properties
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {selectedElement.id}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded font-mono">
                      MM
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-mono font-bold">
                      PARAMETERS
                    </div>

                    {/* ── DOOR PROPERTIES ── */}
                    {selectedElement.type === "door" && (() => {
                      const door = selectedElement as Door;
                      return (
                        <>
                          <ColorPicker
                            value={door.color || "#ffffff"}
                            onChange={(c) => handlePropertyUpdate("color", c)}
                          />
                          {/* Width */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Width</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={door.width}
                                  min={300}
                                  max={4000}
                                  step={10}
                                  onChange={(e) => handlePropertyUpdate("width", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={300}
                              max={4000}
                              step={10}
                              value={door.width}
                              onChange={(e) => handlePropertyUpdate("width", Number(e.target.value))}
                              className="w-full h-1 accent-blue-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                              <span>300mm</span>
                              <span className="text-blue-400">{formatImperial(door.width)}</span>
                              <span>4000mm</span>
                            </div>
                          </div>

                          {/* Height */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Height</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={door.height}
                                  min={1500}
                                  max={3500}
                                  step={10}
                                  onChange={(e) => handlePropertyUpdate("height", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={1500}
                              max={3500}
                              step={10}
                              value={door.height}
                              onChange={(e) => handlePropertyUpdate("height", Number(e.target.value))}
                              className="w-full h-1 accent-blue-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                              <span>1500mm</span>
                              <span className="text-blue-400">{formatImperial(door.height)}</span>
                              <span>3500mm</span>
                            </div>
                          </div>

                          {/* Swing Direction */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Swing Direction</label>
                              <select
                                value={door.swingDirection}
                                onChange={(e) => handlePropertyUpdate("swingDirection", e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                              >
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="double">Double</option>
                              </select>
                            </div>
                          </div>

                          {/* Opening Side */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Opening Side</label>
                              <select
                                value={door.openingSide || "inside"}
                                onChange={(e) => handlePropertyUpdate("openingSide", e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                              >
                                <option value="inside">Inside</option>
                                <option value="outside">Outside</option>
                              </select>
                            </div>
                          </div>

                          {/* Material */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Material</label>
                              <select
                                value={door.material || "Wood"}
                                onChange={(e) => handlePropertyUpdate("material", e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                              >
                                <option value="Wood">Wood</option>
                                <option value="Glass">Glass</option>
                                <option value="Metal">Metal</option>
                                <option value="Aluminum">Aluminum</option>
                                <option value="Steel">Steel</option>
                              </select>
                            </div>
                          </div>

                          {/* Door Style */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Door Style</label>
                              <select
                                value={(door as any).metadata?.door_style || "single"}
                                onChange={(e) => {
                                  handleMetadataUpdate("door_style", e.target.value);
                                  if (e.target.value === "double") {
                                    handlePropertyUpdate("swingDirection", "double");
                                  }
                                }}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                              >
                                <option value="single">Single</option>
                                <option value="double">Double</option>
                                <option value="multi">Multi Panel</option>
                                <option value="glass">Glass</option>
                              </select>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* ── WINDOW PROPERTIES ── */}
                    {selectedElement.type === "window" && (() => {
                      const win = selectedElement as Window;
                      return (
                        <>
                          <ColorPicker
                            value={win.color || "#ffffff"}
                            onChange={(c) => handlePropertyUpdate("color", c)}
                          />
                          {/* Width */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Width</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={win.width}
                                  min={300}
                                  max={4000}
                                  step={10}
                                  onChange={(e) => handlePropertyUpdate("width", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range" min={300} max={4000} step={10} value={win.width}
                              onChange={(e) => handlePropertyUpdate("width", Number(e.target.value))}
                              className="w-full h-1 accent-cyan-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                              <span>300mm</span>
                              <span className="text-cyan-400">{formatImperial(win.width)}</span>
                              <span>4000mm</span>
                            </div>
                          </div>

                          {/* Height */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Height</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={win.height}
                                  min={300}
                                  max={3000}
                                  step={10}
                                  onChange={(e) => handlePropertyUpdate("height", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range" min={300} max={3000} step={10} value={win.height}
                              onChange={(e) => handlePropertyUpdate("height", Number(e.target.value))}
                              className="w-full h-1 accent-cyan-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                              <span>300mm</span>
                              <span className="text-cyan-400">{formatImperial(win.height)}</span>
                              <span>3000mm</span>
                            </div>
                          </div>

                          {/* Material */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Material</label>
                              <select
                                value={win.material || "Aluminum"}
                                onChange={(e) => handlePropertyUpdate("material", e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                              >
                                <option value="Aluminum">Aluminum</option>
                                <option value="Wood">Wood</option>
                                <option value="PVC">PVC</option>
                                <option value="Steel">Steel</option>
                              </select>
                            </div>
                          </div>

                          {/* Glazing */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Glazing</label>
                              <select
                                value={win.glazing || "Standard"}
                                onChange={(e) => handlePropertyUpdate("glazing", e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                              >
                                <option value="Standard">Standard</option>
                                <option value="Clear">Clear</option>
                                <option value="Tinted">Tinted</option>
                                <option value="Frosted">Frosted</option>
                                <option value="Double">Double Glazed</option>
                              </select>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* ── WALL PROPERTIES ── */}
                    {selectedElement.type === "wall" && (() => {
                      const wall = selectedElement as Wall;
                      return (
                        <>
                          <ColorPicker
                            value={wall.color || "#ffffff"}
                            onChange={(c) => handlePropertyUpdate("color", c)}
                          />
                          {/* Thickness */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Thickness</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={wall.thickness}
                                  min={50}
                                  max={600}
                                  step={5}
                                  onChange={(e) => handlePropertyUpdate("thickness", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range" min={50} max={600} step={5} value={wall.thickness}
                              onChange={(e) => handlePropertyUpdate("thickness", Number(e.target.value))}
                              className="w-full h-1 accent-amber-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                              <span>50mm</span>
                              <span className="text-amber-400">{formatImperial(wall.thickness)}</span>
                              <span>600mm</span>
                            </div>
                          </div>

                          {/* Height */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Height</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={wall.height}
                                  min={1500}
                                  max={6000}
                                  step={50}
                                  onChange={(e) => handlePropertyUpdate("height", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range" min={1500} max={10000} step={50} value={wall.height}
                              onChange={(e) => handlePropertyUpdate("height", Number(e.target.value))}
                              className="w-full h-1 accent-amber-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                              <span>1500mm</span>
                              <span className="text-amber-400">{formatImperial(wall.height)}</span>
                              <span>10000mm</span>
                            </div>
                          </div>

                          {/* Material */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Material</label>
                              <select
                                value={wall.material || "Concrete"}
                                onChange={(e) => handlePropertyUpdate("material", e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                              >
                                <option value="Concrete">Concrete</option>
                                <option value="Brick">Brick</option>
                                <option value="CMU">CMU Block</option>
                                <option value="Wood Frame">Wood Frame</option>
                                <option value="Steel">Steel</option>
                                <option value="Glass">Glass</option>
                              </select>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* ── STAIR PROPERTIES ── */}
                    {selectedElement.type === "stairs" && (() => {
                      const stair = selectedElement as Stair;
                      return (
                        <>
                          <ColorPicker
                            value={stair.color || "#ffffff"}
                            onChange={(c) => handlePropertyUpdate("color", c)}
                          />


                          {/* Rotation */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Rotation</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={stair.rotation || 0}
                                  min={0}
                                  max={360}
                                  step={1}
                                  onChange={(e) => handlePropertyUpdate("rotation", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">deg</span>
                              </div>
                            </div>
                            <input
                              type="range" min={0} max={360} step={1} value={stair.rotation || 0}
                              onChange={(e) => handlePropertyUpdate("rotation", Number(e.target.value))}
                              className="w-full h-1 accent-indigo-500 cursor-pointer"
                            />
                          </div>

                          {/* Common Base Stair Properties based on style */}
                          {(() => {
                            const style = (stair.metadata?.stair_style || stair.metadata?.stairStyle || "").toLowerCase();
                            const isFloating = style === "floating_switchback" || stair.metadata?.stair_model_url === "FLOATING_SWITCHBACK_V1";
                            const isSpiral = style === "spiral_metal" || stair.metadata?.stair_model_url === "SPIRAL_METAL_V1";

                            if (isFloating) {
                              return (
                                <>
                                  {/* Lower Steps */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Lower Steps</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          value={Number(stair.metadata?.lower_steps ?? 9)}
                                          min={1} max={20}
                                          onChange={(e) => handleMetadataUpdate("lower_steps", e.target.value)}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <input type="range" min={1} max={20} step={1} value={Number(stair.metadata?.lower_steps ?? 9)} onChange={(e) => handleMetadataUpdate("lower_steps", e.target.value)} className="w-full h-1 accent-indigo-500 cursor-pointer" />
                                  </div>

                                  {/* Upper Steps */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Upper Steps</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          value={Number(stair.metadata?.upper_steps ?? 7)}
                                          min={0} max={20}
                                          onChange={(e) => handleMetadataUpdate("upper_steps", e.target.value)}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <input type="range" min={0} max={20} step={1} value={Number(stair.metadata?.upper_steps ?? 7)} onChange={(e) => handleMetadataUpdate("upper_steps", e.target.value)} className="w-full h-1 accent-indigo-500 cursor-pointer" />
                                  </div>

                                  {/* Run (m) */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Run (m)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number" step="0.01"
                                          value={Number(stair.metadata?.run ?? 0.62)}
                                          min={0.2} max={1.5}
                                          onChange={(e) => handleMetadataUpdate("run", e.target.value)}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <input type="range" min={0.2} max={1.5} step={0.01} value={Number(stair.metadata?.run ?? 0.62)} onChange={(e) => handleMetadataUpdate("run", e.target.value)} className="w-full h-1 accent-indigo-500 cursor-pointer" />
                                  </div>

                                  {/* Rise (m) */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Rise (m)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number" step="0.01"
                                          value={Number(stair.metadata?.rise ?? 0.23)}
                                          min={0.1} max={0.4}
                                          onChange={(e) => handleMetadataUpdate("rise", e.target.value)}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <input type="range" min={0.1} max={0.4} step={0.01} value={Number(stair.metadata?.rise ?? 0.23)} onChange={(e) => handleMetadataUpdate("rise", e.target.value)} className="w-full h-1 accent-indigo-500 cursor-pointer" />
                                  </div>
                                </>
                              );
                            } else if (isSpiral) {
                              return (
                                <>
                                  {/* Step Count */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Step Count</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          value={Number(stair.metadata?.step_count ?? 15)}
                                          min={1} max={50}
                                          onChange={(e) => handleMetadataUpdate("step_count", e.target.value)}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <input type="range" min={1} max={50} step={1} value={Number(stair.metadata?.step_count ?? 15)} onChange={(e) => handleMetadataUpdate("step_count", e.target.value)} className="w-full h-1 accent-indigo-500 cursor-pointer" />
                                  </div>

                                  {/* Rise (m) */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Rise (m)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number" step="0.01"
                                          value={Number(stair.metadata?.rise ?? 0.23)}
                                          min={0.1} max={0.4}
                                          onChange={(e) => handleMetadataUpdate("rise", e.target.value)}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <input type="range" min={0.1} max={0.4} step={0.01} value={Number(stair.metadata?.rise ?? 0.23)} onChange={(e) => handleMetadataUpdate("rise", e.target.value)} className="w-full h-1 accent-indigo-500 cursor-pointer" />
                                  </div>

                                  {/* Outer Tread Radius (m) */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Outer Radius (m)</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number" step="0.05"
                                          value={Number(stair.metadata?.outer_tread_radius ?? 1.00)}
                                          min={0.5} max={3.0}
                                          onChange={(e) => handleMetadataUpdate("outer_tread_radius", e.target.value)}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                    <input type="range" min={0.5} max={3.0} step={0.05} value={Number(stair.metadata?.outer_tread_radius ?? 1.00)} onChange={(e) => handleMetadataUpdate("outer_tread_radius", e.target.value)} className="w-full h-1 accent-indigo-500 cursor-pointer" />
                                  </div>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  {/* Step Count */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Step Count</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          value={Number(stair.metadata?.number_of_steps || 8)}
                                          min={1}
                                          max={30}
                                          step={1}
                                          onChange={(e) => handleMetadataUpdate("number_of_steps", String(e.target.value))}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-slate-500 font-mono w-6">qty</span>
                                      </div>
                                    </div>
                                    <input
                                      type="range" min={1} max={30} step={1} value={Number(stair.metadata?.number_of_steps || 8)}
                                      onChange={(e) => handleMetadataUpdate("number_of_steps", String(e.target.value))}
                                      className="w-full h-1 accent-indigo-500 cursor-pointer"
                                    />
                                  </div>

                                  {/* Tread Depth */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Tread Depth</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          value={Number(stair.metadata?.tread_depth || 0.42) * 1000}
                                          min={200}
                                          max={600}
                                          step={10}
                                          onChange={(e) => handleMetadataUpdate("tread_depth", String(Number(e.target.value) / 1000))}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                                      </div>
                                    </div>
                                    <input
                                      type="range" min={200} max={600} step={10} value={Number(stair.metadata?.tread_depth || 0.42) * 1000}
                                      onChange={(e) => handleMetadataUpdate("tread_depth", String(Number(e.target.value) / 1000))}
                                      className="w-full h-1 accent-indigo-500 cursor-pointer"
                                    />
                                  </div>

                                  {/* Rise Height */}
                                  <div className="space-y-1.5 pb-3 border-b border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Rise Height</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          value={Number(stair.metadata?.rise_height || 0.22) * 1000}
                                          min={100}
                                          max={300}
                                          step={5}
                                          onChange={(e) => handleMetadataUpdate("rise_height", String(Number(e.target.value) / 1000))}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                                      </div>
                                    </div>
                                    <input
                                      type="range" min={100} max={300} step={5} value={Number(stair.metadata?.rise_height || 0.22) * 1000}
                                      onChange={(e) => handleMetadataUpdate("rise_height", String(Number(e.target.value) / 1000))}
                                      className="w-full h-1 accent-indigo-500 cursor-pointer"
                                    />
                                  </div>

                                  {/* Landing Depth */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-400 font-medium">Landing Depth</label>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          value={Number(stair.metadata?.landing_depth || 0.65) * 1000}
                                          min={300}
                                          max={2000}
                                          step={50}
                                          onChange={(e) => handleMetadataUpdate("landing_depth", String(Number(e.target.value) / 1000))}
                                          className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                                      </div>
                                    </div>
                                    <input
                                      type="range" min={300} max={2000} step={50} value={Number(stair.metadata?.landing_depth || 0.65) * 1000}
                                      onChange={(e) => handleMetadataUpdate("landing_depth", String(Number(e.target.value) / 1000))}
                                      className="w-full h-1 accent-indigo-500 cursor-pointer"
                                    />
                                  </div>
                                </>
                              );
                            }
                          })()}
                        </>
                      );
                    })()}

                    {/* ── FLOOR PROPERTIES ── */}
                    {selectedElement.type === "floor" && (() => {
                      const floor = selectedElement as Floor;
                      return (
                        <>
                          <ColorPicker
                            value={floor.color || "#ffffff"}
                            onChange={(c) => handlePropertyUpdate("color", c)}
                          />
                          {/* Width */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Width</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={floor.width}
                                  min={500}
                                  max={10000}
                                  step={10}
                                  onChange={(e) => handlePropertyUpdate("width", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range" min={500} max={10000} step={10} value={floor.width}
                              onChange={(e) => handlePropertyUpdate("width", Number(e.target.value))}
                              className="w-full h-1 accent-emerald-500 cursor-pointer"
                            />
                          </div>

                          {/* Depth */}
                          <div className="space-y-1.5 pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-400 font-medium">Depth</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={floor.depth}
                                  min={500}
                                  max={10000}
                                  step={10}
                                  onChange={(e) => handlePropertyUpdate("depth", Number(e.target.value))}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-blue-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 font-mono w-6">mm</span>
                              </div>
                            </div>
                            <input
                              type="range" min={500} max={10000} step={10} value={floor.depth}
                              onChange={(e) => handlePropertyUpdate("depth", Number(e.target.value))}
                              className="w-full h-1 accent-emerald-500 cursor-pointer"
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Apply Button */}
                  <div className="px-4 py-3 bg-slate-950 border-t border-slate-700 space-y-2">
                    {applyFlash && (
                      <div className="px-3 py-2 bg-green-500/10 border border-green-500/25 rounded text-[11px] text-green-400 font-mono font-bold">
                        ✓ Changes applied to design
                      </div>
                    )}
                    <button
                      onClick={handleApplyChanges}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${applyFlash
                        ? "bg-green-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                    >
                      <span className="text-[11px]">▶</span> Apply Changes
                    </button>
                    <div className="text-[10px] text-slate-600 text-center font-mono">
                      Preview updates live · Apply to save
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-lg">
                <button
                  onClick={() => setActivePanelTab("info")}
                  className={`flex-1 px-3 py-2 text-sm rounded font-medium transition ${activePanelTab === "info"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  Info
                </button>
                <button
                  onClick={() => setActivePanelTab("materials")}
                  className={`flex-1 px-3 py-2 text-sm rounded font-medium transition ${activePanelTab === "materials"
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

              <LevelPanel
                projectId={projectId}
                levels={levels}
                activeLevelId={activeLevelId}
                onLevelSelect={setActiveLevelId}
                onLevelsChange={setLevels}
              />

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
