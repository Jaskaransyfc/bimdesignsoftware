"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Viewer,
  GLTFLoaderPlugin,
  XKTLoaderPlugin,
  AmbientLight,
  DirLight,
} from "@xeokit/xeokit-sdk";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useViewerStore } from "@/stores/viewerStore";
import type { SelectedElement } from "@/stores/viewerStore";
import {
  Home,
  Eye,
  Layers,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Search,
  ChevronRight,
  EyeOff,
  X,
  ChevronDown,
  ChevronUp,
  Maximize2,
  RotateCcw,
  Box,
  Grid3X3,
  UnfoldHorizontal,
  ArrowLeft,
  FileSpreadsheet,
  AlertTriangle,
  Zap,
  Filter,
} from "lucide-react";

const MODEL_ELEMENT_TYPES = [
  "Wall",
  "Slab",
  "Column",
  "Beam",
  "Door",
  "Window",
  "Opening",
  "Room",
  "Grid",
  "Level",
];

type XYZ = [number, number, number];

type ViewerModelElement = {
  id: string;
  type: string;
  name?: string;
  start?: XYZ;
  end?: XYZ;
  height?: number;
  thickness?: number;
  geometry?: { position?: XYZ; start?: XYZ; end?: XYZ; rotationY?: number };
  parameters?: Record<string, any>;
};

type IFCElementLite = {
  global_id: string;
  ifc_type: string;
  name?: string | null;
};

type ClashRow = {
  task_id: string;
  a_id: string;
  b_id: string;
  a_type: string;
  b_type: string;
  overlap: boolean;
  clearance_mm: number;
  min_required_mm: number;
};

// ─────────────────────────────────────────
// RIBBON
// ─────────────────────────────────────────
function Ribbon({
  floorNames,
  selectedFloor,
  onFloorChange,
  hasFloors,
  onQuickCreate,
  modelingEnabled,
}: {
  floorNames: string[];
  selectedFloor: string;
  onFloorChange: (floor: string) => void;
  hasFloors: boolean;
  onQuickCreate: (type: string) => void;
  modelingEnabled: boolean;
}) {
  const {
    activeRibbonTab,
    setActiveRibbonTab,
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
    leftPanelOpen,
    rightPanelOpen,
    bottomPanelOpen,
  } = useViewerStore();
  const tabs = ["Home", "View", "Analyze", "Model"];
  const modelingTools = [
    "Wall",
    "Slab",
    "Column",
    "Beam",
    "Door",
    "Window",
    "Opening",
    "Room",
    "Grid",
    "Level",
  ];

  const handleTabClick = (tab: string) => {
    setActiveRibbonTab(tab);
    if (tab === "Home") {
      if (!leftPanelOpen) toggleLeftPanel();
    } else if (tab === "View") {
      if (!rightPanelOpen) toggleRightPanel();
    } else if (tab === "Analyze") {
      if (!bottomPanelOpen) toggleBottomPanel();
    }
  };

  return (
    <div className="bg-[#0a0b14] border-b border-white/5 flex items-center h-10 px-2 gap-1 select-none flex-shrink-0 z-40">
      {/* Logo / Back */}
      <Link
        href="/"
        className="flex items-center gap-2 px-3 py-1 text-white/40 hover:text-white transition-colors mr-2"
        title="Dashboard"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline">
          Dashboard
        </span>
      </Link>

      <div className="w-px h-5 bg-white/10 mr-1" />

      {/* Tabs */}
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => handleTabClick(tab)}
          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
            activeRibbonTab === tab
              ? "bg-blue-600/20 text-blue-400"
              : "text-white/30 hover:text-white/60 hover:bg-white/5"
          }`}
        >
          {tab}
        </button>
      ))}

      {activeRibbonTab === "Model" && modelingEnabled && (
        <>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <div className="flex items-center gap-1">
            {modelingTools.map((tool) => (
              <button
                key={tool}
                onClick={() => onQuickCreate(tool)}
                className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-blue-600/20 transition-all"
                title={`Create ${tool}`}
              >
                {tool}
              </button>
            ))}
          </div>
        </>
      )}
      {activeRibbonTab === "Model" && !modelingEnabled && (
        <span className="text-[10px] text-amber-300/80 ml-2">
          Model tools work in blank modeling projects only.
        </span>
      )}

      {/* Floor Filter – only for IFC models */}
      {hasFloors && (
        <>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <Filter className="w-3 h-3 text-white/30 ml-2" />
          <div className="relative">
            <select
              value={selectedFloor}
              onChange={(e) => onFloorChange(e.target.value)}
              className="bg-white/5 border w-24 border-white/10 rounded-md text-[10px] font-medium text-white/70 px-3 py-1.5 outline-none appearance-none cursor-pointer hover:bg-white/10 focus:border-blue-500 transition-all"
              title="Filter by floor"
            >
              <option value="All" className="bg-[#0a0b14] text-white">
                All Floors
              </option>
              {floorNames.map((name) => (
                <option
                  key={name}
                  value={name}
                  className="bg-[#0a0b14] text-white"
                >
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Panel toggles */}
      <button
        onClick={toggleLeftPanel}
        className={`p-1.5 rounded-md transition-all ${leftPanelOpen ? "text-blue-400 bg-blue-500/10" : "text-white/25 hover:text-white/50"}`}
        title="Toggle Tree"
      >
        {leftPanelOpen ? (
          <PanelLeftClose className="w-4 h-4" />
        ) : (
          <PanelLeftOpen className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={toggleBottomPanel}
        className={`p-1.5 rounded-md transition-all ${bottomPanelOpen ? "text-blue-400 bg-blue-500/10" : "text-white/25 hover:text-white/50"}`}
        title="Toggle BOQ"
      >
        {bottomPanelOpen ? (
          <PanelBottomClose className="w-4 h-4" />
        ) : (
          <PanelBottomOpen className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={toggleRightPanel}
        className={`p-1.5 rounded-md transition-all ${rightPanelOpen ? "text-blue-400 bg-blue-500/10" : "text-white/25 hover:text-white/50"}`}
        title="Toggle Properties"
      >
        {rightPanelOpen ? (
          <PanelRightClose className="w-4 h-4" />
        ) : (
          <PanelRightOpen className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// LEFT PANEL – Spatial / Type Tree
// ─────────────────────────────────────────
function LeftPanel({
  hierarchy,
  allElements,
  viewerRef,
  projectId,
  blankModelingMode,
  onSelectBlankElement,
  onToggleBlankVisibility,
}: {
  hierarchy: any;
  allElements: any[];
  viewerRef: React.MutableRefObject<Viewer | null>;
  projectId: string;
  blankModelingMode: boolean;
  onSelectBlankElement: (elementId: string) => void;
  onToggleBlankVisibility: (ids: string[], visible: boolean) => void;
}) {
  const { leftPanelOpen, groupMode, setGroupMode, setSelectedElement } =
    useViewerStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (hierarchy?.id) setExpandedNodes(new Set([hierarchy.id]));
  }, [hierarchy]);

  const buildTypeTree = useCallback((elements: any[]) => {
    const grouped: Record<string, any[]> = {};
    elements.forEach((el) => {
      const type = el.ifc_type || el.type || "Other";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(el);
    });
    return {
      id: "type-root",
      name: "All Elements",
      type: "IfcProject",
      children: Object.entries(grouped).map(([type, items]) => ({
        id: `type-${type}`,
        name: type,
        type: "IfcGroup",
        children: items.map((item: any) => ({
          id: item.global_id || item.id,
          name: item.name || item.id || "Unnamed",
          type: item.ifc_type || item.type || "Part",
          children: [],
        })),
      })),
    };
  }, []);

  const setNodeVisibility = (node: any, visible: boolean) => {
    if (!node) return;
    const collectIds = (n: any, bucket: string[]) => {
      if (!n || !n.id) return;
      bucket.push(n.id);
      n.children.forEach((c: any) => collectIds(c, bucket));
    };
    const ids: string[] = [];
    collectIds(node, ids);
    if (blankModelingMode) {
      onToggleBlankVisibility(ids, visible);
      const newHidden = new Set(hiddenNodes);
      ids.forEach((id) => {
        if (visible) newHidden.delete(id);
        else newHidden.add(id);
      });
      setHiddenNodes(newHidden);
      return;
    }
    if (!viewerRef.current) return;
    const newHidden = new Set(hiddenNodes);
    const walk = (n: any) => {
      if (!n || !n.id) return;
      if (visible) newHidden.delete(n.id);
      else newHidden.add(n.id);
      const ent = viewerRef.current?.scene.objects[n.id];
      if (ent) ent.visible = visible;
      if (n.children) n.children.forEach(walk);
    };
    walk(node);
    setHiddenNodes(newHidden);
  };

  const selectNode = async (node: any) => {
    if (!node || !node.id) return;
    if (blankModelingMode) {
      if (!node.children || node.children.length === 0) {
        onSelectBlankElement(node.id);
      } else {
        const s = new Set(expandedNodes);
        if (s.has(node.id)) s.delete(node.id);
        else s.add(node.id);
        setExpandedNodes(s);
      }
      return;
    }
    if (!viewerRef.current) return;
    const ent = viewerRef.current.scene.objects[node.id];
    if (!ent) {
      if (node.children?.length > 0) {
        const s = new Set(expandedNodes);
        if (s.has(node.id)) s.delete(node.id);
        else s.add(node.id);
        setExpandedNodes(s);
      }
      return;
    }
    if (ent) {
      viewerRef.current.scene.setObjectsSelected(
        viewerRef.current.scene.selectedObjectIds,
        false,
      );
      ent.selected = true;
      viewerRef.current.cameraFlight.flyTo(ent);
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(
          `${apiUrl}/api/elements/${projectId}/${node.id}`,
        );
        if (res.ok) {
          const el = await res.json();
          setSelectedElement(el as SelectedElement);
        } else {
          // Fallback for non-BIM
          setSelectedElement({
            global_id: node.id,
            ifc_type: ent.is_a?.() || node.type || "Mesh",
            name: node.name || node.id,
            properties: {
              "Mesh Name": node.id,
              Vertices: ent.numTriangles ? ent.numTriangles * 3 : "N/A",
              "Model Type": "Non‑BIM 3D Model",
            },
          });
        }
      } catch (err) {
        console.error("Property fetch error:", err);
      }
    }
  };

  const renderNode = (node: any): React.ReactNode => {
    if (!node || !node.id) return null;
    const matchesSearch = node.name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const hasMatchChild = node.children?.some((c: any) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    if (searchQuery && !matchesSearch && !hasMatchChild) return null;

    const expanded =
      expandedNodes.has(node.id) || (searchQuery !== "" && hasMatchChild);
    const hidden = hiddenNodes.has(node.id);
    const selectedEl = useViewerStore.getState().selectedElement;
    const selected = selectedEl?.global_id === node.id;

    return (
      <div key={node.id} className="ml-3">
        <div
          className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded group transition-all text-[11px] ${
            selected ? "bg-blue-600/20 text-blue-400" : "hover:bg-white/5"
          }`}
        >
          {node.children?.length > 0 ? (
            <button
              onClick={() => {
                const s = new Set(expandedNodes);
                if (s.has(node.id)) s.delete(node.id);
                else s.add(node.id);
                setExpandedNodes(s);
              }}
              className="text-white/20 flex-shrink-0"
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <div className="w-3" />
          )}

          <button
            onClick={() => selectNode(node)}
            className={`flex-1 text-left truncate font-medium ${
              selected
                ? "text-blue-400"
                : "text-white/50 group-hover:text-white/80"
            }`}
          >
            {node.name}
          </button>

          <button
            onClick={() => setNodeVisibility(node, hidden)}
            className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${hidden ? "text-red-400 !opacity-100" : "text-white/20"}`}
          >
            {hidden ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </button>
        </div>
        {expanded &&
          node.children?.map((c: any) => renderNode(c)).filter(Boolean)}
      </div>
    );
  };

  const activeTree =
    groupMode === "spatial"
      ? hierarchy
      : allElements.length > 0
        ? buildTypeTree(allElements)
        : null;

  if (!leftPanelOpen) return null;

  return (
    <div className="w-[280px] bg-[#0d0e1a] border-r border-white/5 flex flex-col flex-shrink-0 select-none">
      <div className="px-3 pt-3 pb-2 border-b border-white/5 bg-[#0f1020]">
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => setGroupMode("spatial")}
            className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider rounded-lg transition ${groupMode === "spatial" ? "bg-blue-600 text-white" : "bg-white/5 text-white/35"}`}
          >
            🏗 Spatial
          </button>
          <button
            onClick={() => setGroupMode("type")}
            className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider rounded-lg transition ${groupMode === "type" ? "bg-blue-600 text-white" : "bg-white/5 text-white/35"}`}
          >
            🧱 Type
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-lg pl-7 pr-3 py-1.5 text-[11px] focus:border-blue-500 outline-none transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {activeTree ? (
          renderNode(activeTree)
        ) : (
          <div className="text-center py-20 text-white/15 text-xs italic">
            {groupMode === "spatial"
              ? "No spatial data."
              : "No elements loaded."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// RIGHT PANEL – Properties
// ─────────────────────────────────────────
function RightPanel({
  projectId,
  onModelingChanged,
  selectedModelElement,
  onUpdateModelElement,
  onPreviewModelElement,
  onClearPreviewModelElement,
}: {
  projectId: string;
  onModelingChanged: () => Promise<void>;
  selectedModelElement: ViewerModelElement | null;
  onUpdateModelElement: (
    elementId: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onPreviewModelElement: (
    elementId: string,
    payload: Record<string, unknown>,
  ) => void;
  onClearPreviewModelElement: (elementId: string) => void;
}) {
  const { rightPanelOpen, selectedElement } = useViewerStore();
  const [panelTab, setPanelTab] = useState<"properties" | "modeling">(
    "properties",
  );
  const [materials, setMaterials] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [modelElements, setModelElements] = useState<
    Array<{ id: string; name?: string; type: string }>
  >([]);
  const [elementName, setElementName] = useState("");
  const [elementType, setElementType] = useState("Wall");
  const [elementMaterialId, setElementMaterialId] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [families, setFamilies] = useState<
    Array<{
      id: string;
      family: string;
      category: string;
      schema: { type?: string; parameters?: Record<string, unknown> };
    }>
  >([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [familyInstanceName, setFamilyInstanceName] = useState("");
  const [familyParametersText, setFamilyParametersText] = useState("{}");
  const [paramWallStartX, setParamWallStartX] = useState("");
  const [paramWallStartZ, setParamWallStartZ] = useState("");
  const [paramWallEndX, setParamWallEndX] = useState("");
  const [paramWallEndZ, setParamWallEndZ] = useState("");
  const [paramHeight, setParamHeight] = useState("");
  const [paramThickness, setParamThickness] = useState("");
  const [paramWidth, setParamWidth] = useState("");
  const [paramSill, setParamSill] = useState("");
  const formatPropertyValue = (value: unknown) => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const loadModelingData = useCallback(async () => {
    try {
      const [materialRes, elementRes, familyRes] = await Promise.all([
        fetch(`${apiUrl}/api/modeling/projects/${projectId}/materials`),
        fetch(`${apiUrl}/api/modeling/projects/${projectId}/elements`),
        fetch(`${apiUrl}/api/modeling/projects/${projectId}/families`),
      ]);
      if (materialRes.ok) {
        setMaterials(await materialRes.json());
      }
      if (elementRes.ok) {
        setModelElements(await elementRes.json());
      }
      if (familyRes.ok) {
        const data = await familyRes.json();
        setFamilies(data);
        if (!selectedFamilyId && data.length > 0) {
          setSelectedFamilyId(data[0].id);
          setFamilyParametersText(
            JSON.stringify(data[0].schema?.parameters || {}, null, 2),
          );
        }
      }
    } catch (err) {
      console.error("Failed to load modeling data", err);
    }
  }, [apiUrl, projectId, selectedFamilyId]);

  const createMaterial = async () => {
    if (!materialName.trim()) return;
    const res = await fetch(
      `${apiUrl}/api/modeling/projects/${projectId}/materials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: materialName.trim() }),
      },
    );
    if (res.ok) {
      setMaterialName("");
      await loadModelingData();
      await onModelingChanged();
    }
  };

  const createElement = async () => {
    if (!elementName.trim()) return;
    const payload: Record<string, unknown> = {
      name: elementName.trim(),
      type: elementType,
      parameters: { source: "viewer-panel" },
    };
    if (elementMaterialId) payload.material_id = elementMaterialId;
    const res = await fetch(
      `${apiUrl}/api/modeling/projects/${projectId}/elements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) {
      setElementName("");
      await loadModelingData();
      await onModelingChanged();
    }
  };

  const renameElement = async (elementId: string, name: string) => {
    const newName = window.prompt("Update element name", name);
    if (!newName || newName === name) return;
    const res = await fetch(
      `${apiUrl}/api/modeling/projects/${projectId}/elements/${elementId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      },
    );
    if (res.ok) {
      await loadModelingData();
      await onModelingChanged();
    }
  };

  const instantiateFamily = async () => {
    if (!selectedFamilyId) return;
    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = JSON.parse(familyParametersText || "{}");
    } catch {
      window.alert("Invalid Family Parameters JSON");
      return;
    }
    const res = await fetch(
      `${apiUrl}/api/modeling/projects/${projectId}/families/${selectedFamilyId}/instantiate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: familyInstanceName.trim() || undefined,
          parameters: parsedParams,
        }),
      },
    );
    if (res.ok) {
      setFamilyInstanceName("");
      await loadModelingData();
      await onModelingChanged();
    }
  };

  useEffect(() => {
    const el = selectedModelElement;
    if (!el) return;
    const wallStart = (el.geometry?.start || el.start || [0, 0, 0]) as XYZ;
    const wallEnd = (el.geometry?.end || el.end || [3, 0, 0]) as XYZ;
    const p = el.parameters || {};
    setParamWallStartX(String(wallStart[0] ?? 0));
    setParamWallStartZ(String(wallStart[2] ?? 0));
    setParamWallEndX(String(wallEnd[0] ?? 3));
    setParamWallEndZ(String(wallEnd[2] ?? 0));
    setParamHeight(String((p.height ?? el.height ?? 3) as number));
    setParamThickness(String((p.thickness ?? el.thickness ?? 0.2) as number));
    setParamWidth(String((p.width ?? 1) as number));
    setParamSill(String((p.sill_height ?? 0) as number));
  }, [selectedModelElement]);

  const saveParametricChanges = async () => {
    if (!selectedModelElement) return;
    const payload: Record<string, unknown> = {};
    const p = { ...(selectedModelElement.parameters || {}) } as Record<
      string,
      unknown
    >;
    if (selectedModelElement.type === "Wall") {
      payload.geometry = {
        ...(selectedModelElement.geometry || {}),
        start: [Number(paramWallStartX), 0, Number(paramWallStartZ)],
        end: [Number(paramWallEndX), 0, Number(paramWallEndZ)],
      };
      p.height = Number(paramHeight);
      p.thickness = Number(paramThickness);
    } else if (
      selectedModelElement.type === "Door" ||
      selectedModelElement.type === "Window" ||
      selectedModelElement.type === "Opening"
    ) {
      p.width = Number(paramWidth);
      p.height = Number(paramHeight);
      p.thickness = Number(paramThickness);
      p.sill_height = Number(paramSill);
    } else {
      p.width = Number(paramWidth);
      p.height = Number(paramHeight);
      p.depth = Number(paramThickness);
    }
    payload.parameters = p;
    await onUpdateModelElement(selectedModelElement.id, payload);
    onClearPreviewModelElement(selectedModelElement.id);
    await loadModelingData();
  };

  useEffect(() => {
    if (!selectedModelElement) return;
    const p = { ...(selectedModelElement.parameters || {}) } as Record<
      string,
      unknown
    >;
    const payload: Record<string, unknown> = {};
    if (selectedModelElement.type === "Wall") {
      payload.geometry = {
        ...(selectedModelElement.geometry || {}),
        start: [Number(paramWallStartX), 0, Number(paramWallStartZ)],
        end: [Number(paramWallEndX), 0, Number(paramWallEndZ)],
      };
      p.height = Number(paramHeight);
      p.thickness = Number(paramThickness);
    } else if (
      selectedModelElement.type === "Door" ||
      selectedModelElement.type === "Window" ||
      selectedModelElement.type === "Opening"
    ) {
      p.width = Number(paramWidth);
      p.height = Number(paramHeight);
      p.thickness = Number(paramThickness);
      p.sill_height = Number(paramSill);
    } else {
      p.width = Number(paramWidth);
      p.height = Number(paramHeight);
      p.depth = Number(paramThickness);
    }
    payload.parameters = p;
    onPreviewModelElement(selectedModelElement.id, payload);
  }, [
    onPreviewModelElement,
    paramHeight,
    paramSill,
    paramThickness,
    paramWallEndX,
    paramWallEndZ,
    paramWallStartX,
    paramWallStartZ,
    paramWidth,
    selectedModelElement,
  ]);

  if (!rightPanelOpen) return null;

  return (
    <div className="w-[320px] bg-[#0d0e1a] border-l border-white/5 flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-white/5 bg-[#0f1020]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanelTab("properties")}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${panelTab === "properties" ? "bg-blue-600/20 text-blue-400" : "text-white/40"}`}
          >
            Properties
          </button>
          <button
            onClick={async () => {
              setPanelTab("modeling");
              if (rightPanelOpen) {
                await loadModelingData();
              }
            }}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${panelTab === "modeling" ? "bg-blue-600/20 text-blue-400" : "text-white/40"}`}
          >
            Modeling
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {panelTab === "properties" && selectedElement ? (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
              <div>
                <span className="text-[9px] text-blue-400/60 font-bold uppercase tracking-wider">
                  Entity
                </span>
                <p className="text-base font-bold mt-0.5">
                  {selectedElement.ifc_type}
                </p>
              </div>
              <div>
                <span className="text-[9px] text-blue-400/60 font-bold uppercase tracking-wider">
                  Name
                </span>
                <p className="text-base font-bold mt-0.5">
                  {selectedElement.name || "N/A"}
                </p>
              </div>
              <div>
                <span className="text-[9px] text-blue-400/60 font-bold uppercase tracking-wider">
                  Global ID
                </span>
                <p className="text-xs font-mono text-white/50 mt-0.5 break-all">
                  {selectedElement.global_id}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-3">
                Metadata
              </h3>
              {Object.keys(selectedElement.properties || {}).length === 0 ? (
                <p className="text-white/25 text-xs italic">
                  No properties found.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(selectedElement.properties!).map(
                    ([k, v]: [string, any]) => (
                      <div
                        key={k}
                        className="bg-white/[0.02] rounded-lg px-3 py-2 hover:bg-white/[0.05] transition-all overflow-hidden"
                      >
                        <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider block">
                          {k}
                        </span>
                        <pre className="text-xs text-white/80 font-medium whitespace-pre-wrap break-words max-h-36 overflow-auto">
                          {formatPropertyValue(v)}
                        </pre>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        ) : panelTab === "properties" ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-white/15">
            <Box className="w-10 h-10 mb-3" />
            <p className="text-xs font-medium">
              Select an element in the 3D view or tree
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {selectedModelElement && (
              <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Module 8: Parametric Engine
                </p>
                <p className="text-[10px] text-white/60">
                  Editing: {selectedModelElement.type}{" "}
                  {selectedModelElement.name || selectedModelElement.id}
                </p>
                {selectedModelElement.type === "Wall" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-white/65">
                      Start X (m)
                      <input
                        value={paramWallStartX}
                        onChange={(e) => setParamWallStartX(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-white/65">
                      Start Z (m)
                      <input
                        value={paramWallStartZ}
                        onChange={(e) => setParamWallStartZ(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-white/65">
                      End X (m)
                      <input
                        value={paramWallEndX}
                        onChange={(e) => setParamWallEndX(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-white/65">
                      End Z (m)
                      <input
                        value={paramWallEndZ}
                        onChange={(e) => setParamWallEndZ(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-white/65">
                      Height (Y, m)
                      <input
                        value={paramHeight}
                        onChange={(e) => setParamHeight(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-white/65">
                      Thickness (m)
                      <input
                        value={paramThickness}
                        onChange={(e) => setParamThickness(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-white/65">
                      Width (X, m)
                      <input
                        value={paramWidth}
                        onChange={(e) => setParamWidth(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-white/65">
                      Height (Y, m)
                      <input
                        value={paramHeight}
                        onChange={(e) => setParamHeight(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-white/65">
                      {selectedModelElement.type === "Door" ||
                      selectedModelElement.type === "Window" ||
                      selectedModelElement.type === "Opening"
                        ? "Thickness (Z, m)"
                        : "Depth (Z, m)"}
                      <input
                        value={paramThickness}
                        onChange={(e) => setParamThickness(e.target.value)}
                        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    {(selectedModelElement.type === "Door" ||
                      selectedModelElement.type === "Window" ||
                      selectedModelElement.type === "Opening") && (
                      <label className="text-[10px] text-white/65">
                        Sill Height (m)
                        <input
                          value={paramSill}
                          onChange={(e) => setParamSill(e.target.value)}
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                        />
                      </label>
                    )}
                  </div>
                )}
                <button
                  onClick={saveParametricChanges}
                  className="w-full rounded bg-blue-600/80 py-1.5 text-xs font-semibold hover:bg-blue-600"
                >
                  Apply Parametric Update
                </button>
                <p className="text-[10px] text-white/45">
                  Tip: Select in 3D, then use move/resize handles to adjust
                  position and dimensions.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Family / Component Library
              </p>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 space-y-2">
                <select
                  value={selectedFamilyId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedFamilyId(nextId);
                    const fam = families.find((f) => f.id === nextId);
                    setFamilyParametersText(
                      JSON.stringify(fam?.schema?.parameters || {}, null, 2),
                    );
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                >
                  {families.map((f) => (
                    <option
                      key={f.id}
                      value={f.id}
                      style={{ backgroundColor: "#0f1020", color: "#ffffff" }}
                    >
                      {f.family} ({f.category})
                    </option>
                  ))}
                </select>
                <input
                  value={familyInstanceName}
                  onChange={(e) => setFamilyInstanceName(e.target.value)}
                  placeholder="Instance name (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                />
                <textarea
                  value={familyParametersText}
                  onChange={(e) => setFamilyParametersText(e.target.value)}
                  className="w-full min-h-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono"
                />
                <button
                  onClick={instantiateFamily}
                  className="w-full rounded bg-emerald-600/80 py-1.5 text-xs font-semibold hover:bg-emerald-600"
                >
                  Place Family Instance
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Existing Elements ({modelElements.length})
              </p>
              <div className="space-y-1">
                {modelElements.map((element) => (
                  <button
                    key={element.id}
                    onClick={() =>
                      renameElement(element.id, element.name || "")
                    }
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 rounded px-2 py-2"
                  >
                    <div className="text-xs font-semibold">
                      {element.name || "Unnamed"}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {element.type}
                    </div>
                  </button>
                ))}
                {modelElements.length === 0 && (
                  <p className="text-xs text-white/30 italic">
                    No model elements yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// BOTTOM PANEL – BOQ / Issues / Clash
// ─────────────────────────────────────────
function normalizeIfcType(ifcType: string): string {
  if (!ifcType) return "Unknown";
  return ifcType.replace(/^Ifc/i, "");
}

function BottomPanel({
  projectId,
  viewerRef,
  allElements,
}: {
  projectId: string;
  viewerRef: React.MutableRefObject<Viewer | null>;
  allElements: IFCElementLite[];
}) {
  const {
    bottomPanelOpen,
    toggleBottomPanel,
    bottomTab,
    setBottomTab,
    boqItems,
    setSelectedElement,
  } = useViewerStore();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const [runningClash, setRunningClash] = useState(false);
  const [clashMessage, setClashMessage] = useState("");
  const [clashRows, setClashRows] = useState<ClashRow[]>([]);
  const [clashEditorOpen, setClashEditorOpen] = useState(false);
  const [clashTasksText, setClashTasksText] = useState(
    JSON.stringify(
      [
        { id: "beam_vs_wall", a_type: "Beam", b_type: "Wall", min_clearance_mm: 25 },
        { id: "column_vs_opening", a_type: "Column", b_type: "Opening", min_clearance_mm: 15 },
        { id: "slab_vs_window", a_type: "Slab", b_type: "Window", min_clearance_mm: 10 },
      ],
      null,
      2,
    ),
  );

  const issues = useMemo(
    () =>
      clashRows.map((row, idx) => {
        const severity = row.overlap ? "high" : row.clearance_mm <= row.min_required_mm / 2 ? "high" : "medium";
        const title = row.overlap
          ? `Hard clash: ${row.a_type} vs ${row.b_type}`
          : `Clearance violation: ${row.a_type} vs ${row.b_type}`;
        const recommendation = row.overlap
          ? "Re-route one system or modify host geometry."
          : "Increase clearance, move service, or resize conflicting element.";
        return {
          id: `${row.task_id}-${row.a_id}-${row.b_id}-${idx}`,
          title,
          severity,
          details: `${row.a_id} vs ${row.b_id} | clearance ${row.clearance_mm.toFixed(1)}mm (required ${row.min_required_mm.toFixed(1)}mm)`,
          recommendation,
        };
      }),
    [clashRows],
  );

  const runClashFromViewer = useCallback(async () => {
    setRunningClash(true);
    setClashMessage("");
    try {
      const parsedTasks = JSON.parse(clashTasksText);
      const viewer = viewerRef.current;
      const sceneObjects = viewer?.scene?.objects || {};
      const elementBoxes = allElements
        .slice(0, 1200)
        .map((el) => {
          const obj = sceneObjects[el.global_id] as { aabb?: number[] } | undefined;
          const aabb = obj?.aabb;
          if (!aabb || aabb.length < 6) return null;
          return {
            id: el.global_id,
            type: normalizeIfcType(el.ifc_type),
            min: [aabb[0], aabb[1], aabb[2]],
            max: [aabb[3], aabb[4], aabb[5]],
          };
        })
        .filter(Boolean);

      const res = await fetch(`${apiUrl}/api/projects/${projectId}/clash-detection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: parsedTasks,
          elements: elementBoxes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Clash detection failed");
      const rows: ClashRow[] = Array.isArray(data?.clashes) ? data.clashes : [];
      setClashRows(rows);
      setClashMessage(`Checked ${data?.checked_elements ?? 0} elements, found ${rows.length} clashes.`);
      setBottomTab("clash");
    } catch (e) {
      setClashMessage(e instanceof Error ? e.message : "Could not run clash detection");
    } finally {
      setRunningClash(false);
    }
  }, [allElements, apiUrl, clashTasksText, projectId, setBottomTab, viewerRef]);

  const focusClashRow = useCallback(
    (row: ClashRow) => {
      const viewer = viewerRef.current as any;
      if (!viewer?.scene) return;
      const scene = viewer.scene as any;
      const aObj = scene.objects?.[row.a_id];
      const bObj = scene.objects?.[row.b_id];
      if (!aObj && !bObj) return;

      try {
        const allIds: string[] = scene.objectIds || [];
        if (typeof scene.setObjectsHighlighted === "function") {
          scene.setObjectsHighlighted(allIds, false);
          const targetIds = [row.a_id, row.b_id].filter((id) => !!scene.objects?.[id]);
          scene.setObjectsHighlighted(targetIds, true);
        } else {
          allIds.forEach((id) => {
            if (scene.objects?.[id]) scene.objects[id].highlighted = false;
          });
          if (aObj) aObj.highlighted = true;
          if (bObj) bObj.highlighted = true;
        }
      } catch {
        // ignore highlight API differences across xeokit versions
      }

      const ids = [row.a_id, row.b_id];
      const matchElements = ids
        .map((id) => allElements.find((el) => el.global_id === id))
        .filter((x): x is IFCElementLite => !!x);
      const picked = matchElements[0];
      if (picked) {
        setSelectedElement({
          global_id: picked.global_id,
          ifc_type: picked.ifc_type,
          name: picked.name || picked.global_id,
          properties: {
            source: "clash-detection",
            clash_task: row.task_id,
            clash_pair: `${row.a_id} vs ${row.b_id}`,
            overlap: row.overlap ? "true" : "false",
            clearance_mm: row.clearance_mm,
            required_mm: row.min_required_mm,
          },
        });
      }

      try {
        if (aObj && typeof viewer.cameraFlight?.flyTo === "function") {
          viewer.cameraFlight.flyTo(aObj);
        } else if (bObj && typeof viewer.cameraFlight?.flyTo === "function") {
          viewer.cameraFlight.flyTo(bObj);
        }
      } catch {
        // no-op if camera flight target fails
      }
    },
    [allElements, setSelectedElement, viewerRef],
  );

  if (!bottomPanelOpen) return null;

  const tabs = [
    { key: "boq" as const, label: "Bill of Quantities", icon: FileSpreadsheet },
    { key: "issues" as const, label: "Issues", icon: AlertTriangle },
    { key: "clash" as const, label: "Clash Detection", icon: Zap },
  ];

  return (
    <div className="h-[260px] bg-[#0d0e1a] border-t border-white/5 flex flex-col flex-shrink-0">
      <div className="flex items-center border-b border-white/5 bg-[#0f1020] px-2 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setBottomTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${bottomTab === tab.key ? "text-blue-400 border-b-2 border-blue-400" : "text-white/30 hover:text-white/50"}`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={toggleBottomPanel}
          className="text-white/20 hover:text-white/50 p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {bottomTab === "boq" ? (
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
                  <tr
                    key={i}
                    className="border-t border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-1.5 px-4 text-white/60 font-medium">
                      {item.type}
                    </td>
                    <td className="py-1.5 px-4 text-white/50">
                      {item.quantity}
                    </td>
                    <td className="py-1.5 px-4 text-right font-mono text-white/70">
                      {item.total.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-4 text-white/40">
                      {item.unit || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-white/15 text-xs">
              No BOQ data extracted for this project.
            </div>
          )
        ) : bottomTab === "issues" ? (
          <div className="p-3 space-y-2 text-xs">
            {issues.length === 0 ? (
              <div className="text-white/40 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No issues generated yet. Run clash detection first.
              </div>
            ) : (
              issues.map((issue) => (
                <div key={issue.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-white/85">{issue.title}</div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                        issue.severity === "high"
                          ? "bg-red-500/20 text-red-300 border border-red-400/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <div className="text-white/55 mt-1">{issue.details}</div>
                  <div className="text-white/40 mt-1">Action: {issue.recommendation}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="h-full p-3 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="text-white/55">
                Run clash detection with user-defined tasks for current viewer model.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setClashEditorOpen(true)}
                  className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-semibold"
                >
                  Edit Tasks
                </button>
                <button
                  onClick={runClashFromViewer}
                  disabled={runningClash}
                  className="px-3 py-1.5 rounded bg-blue-600/80 hover:bg-blue-600 disabled:bg-white/10 text-white font-semibold"
                >
                  {runningClash ? "Running..." : "Run Clash"}
                </button>
              </div>
            </div>
            <textarea
              value={clashTasksText}
              onChange={(e) => setClashTasksText(e.target.value)}
              className="w-full h-24 bg-white/5 border border-white/10 rounded p-2 font-mono text-[11px]"
            />
            <div className="text-white/45">{clashMessage || `${clashRows.length} clashes loaded`}</div>
            <div className="flex-1 overflow-auto border border-white/10 rounded">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[#0f1020]">
                  <tr className="text-left text-white/40 uppercase tracking-wider">
                    <th className="p-2">Task</th>
                    <th className="p-2">A</th>
                    <th className="p-2">B</th>
                    <th className="p-2">Overlap</th>
                    <th className="p-2">Clearance mm</th>
                    <th className="p-2">Required mm</th>
                  </tr>
                </thead>
                <tbody>
                  {clashRows.map((row, idx) => (
                    <tr
                      key={`${row.task_id}-${row.a_id}-${row.b_id}-${idx}`}
                      className="border-t border-white/10 hover:bg-white/5 cursor-pointer"
                      onClick={() => focusClashRow(row)}
                      title="Click to focus conflicting elements in 3D"
                    >
                      <td className="p-2 text-white/75">{row.task_id}</td>
                      <td className="p-2 text-white/60">{row.a_type} ({row.a_id})</td>
                      <td className="p-2 text-white/60">{row.b_type} ({row.b_id})</td>
                      <td className={`p-2 ${row.overlap ? "text-red-300" : "text-amber-300"}`}>
                        {row.overlap ? "Yes" : "No"}
                      </td>
                      <td className="p-2 text-white/75">{row.clearance_mm.toFixed(2)}</td>
                      <td className="p-2 text-white/55">{row.min_required_mm.toFixed(2)}</td>
                    </tr>
                  ))}
                  {clashRows.length === 0 && (
                    <tr>
                      <td className="p-3 text-white/30" colSpan={6}>
                        No clashes yet. Click "Run Clash".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {clashEditorOpen && (
              <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm p-4">
                <div className="max-w-5xl mx-auto h-full bg-[#0e1020] border border-white/10 rounded-xl flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="text-sm font-semibold text-white/90">
                      Clash Task Editor ()
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setClashEditorOpen(false)}
                        className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-4">
                    <textarea
                      value={clashTasksText}
                      onChange={(e) => setClashTasksText(e.target.value)}
                      className="w-full h-full bg-black/30 border border-white/10 rounded p-3 font-mono text-xs text-white/90"
                      spellCheck={false}
                    />
                  </div>
                  <div className="px-4 pb-4 flex justify-end gap-2">
                    <button
                      onClick={runClashFromViewer}
                      disabled={runningClash}
                      className="px-4 py-2 rounded bg-blue-600/80 hover:bg-blue-600 disabled:bg-white/10 text-sm font-semibold"
                    >
                      {runningClash ? "Running..." : "Run Clash With These Tasks"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// VIEWPORT – 3D Canvas with Explode + Floor
// ─────────────────────────────────────────
function Viewport({
  canvasRef,
  viewerRef,
  loading,
  explodeFactor,
  onExplodeChange,
  hasFloors,
  blankModelingMode,
  modelElements,
  hiddenModelElementIds,
  selectedModelElementId,
  onSelectModelElement,
  onUpdateModelElement,
  previewModelElementUpdates,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewerRef: React.MutableRefObject<Viewer | null>;
  loading: boolean;
  explodeFactor: number;
  onExplodeChange: (val: number) => void;
  hasFloors: boolean;
  blankModelingMode: boolean;
  modelElements: ViewerModelElement[];
  hiddenModelElementIds: Set<string>;
  selectedModelElementId: string | null;
  onSelectModelElement: (elementId: string) => void;
  onUpdateModelElement: (
    elementId: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  previewModelElementUpdates: Record<string, Record<string, unknown>>;
}) {
  const threeHostRef = useRef<HTMLDivElement>(null);
  const threeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const threeSceneRef = useRef<THREE.Scene | null>(null);
  const threeControlsRef = useRef<OrbitControls | null>(null);
  const threeCameraSnapshotRef = useRef<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(null);
  const threeMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const threeRaycasterRef = useRef(new THREE.Raycaster());
  const threePointerRef = useRef(new THREE.Vector2());
  const threeHoveredElementIdRef = useRef<string | null>(null);
  const threeMoveArrowsRef = useRef<THREE.Group | null>(null);
  const threeAxisGuideRef = useRef<THREE.Line | null>(null);
  const threeResizeHandlesRef = useRef<THREE.Mesh[]>([]);
  const freeMoveDragRef = useRef<{
    active: boolean;
    elementId: string | null;
    y: number;
  }>({ active: false, elementId: null, y: 0 });
  const resizeDragRef = useRef<{
    active: boolean;
    elementId: string | null;
    axis: "x" | "y" | "z";
    direction: 1 | -1;
    startClientX: number;
    startClientY: number;
    startScale: THREE.Vector3;
    axisDir: THREE.Vector3;
    axisOrigin: THREE.Vector3;
    startPoint: THREE.Vector3;
    baseScaleAxis: number;
  }>({
    active: false,
    elementId: null,
    axis: "x",
    direction: 1,
    startClientX: 0,
    startClientY: 0,
    startScale: new THREE.Vector3(1, 1, 1),
    axisDir: new THREE.Vector3(1, 0, 0),
    axisOrigin: new THREE.Vector3(),
    startPoint: new THREE.Vector3(),
    baseScaleAxis: 1,
  });
  const axisDragRef = useRef<{
    active: boolean;
    elementId: string | null;
    axis: "x" | "y" | "z" | null;
    axisDir: THREE.Vector3;
    axisOrigin: THREE.Vector3;
    startPoint: THREE.Vector3;
    startPosition: THREE.Vector3;
  }>({
    active: false,
    elementId: null,
    axis: null,
    axisDir: new THREE.Vector3(1, 0, 0),
    axisOrigin: new THREE.Vector3(),
    startPoint: new THREE.Vector3(),
    startPosition: new THREE.Vector3(),
  });
  const [axisHint, setAxisHint] = useState<{
    axis: "x" | "y" | "z";
    delta: number;
    dragging: boolean;
  } | null>(null);
  const threeXrayRef = useRef(false);
  const threeSelectionOutlineRef = useRef<THREE.LineSegments | null>(null);

  useEffect(() => {
    if (!blankModelingMode || !threeHostRef.current) return;

    const host = threeHostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);

    const camera = new THREE.PerspectiveCamera(
      60,
      host.clientWidth / Math.max(host.clientHeight, 1),
      0.1,
      5000,
    );
    if (threeCameraSnapshotRef.current) {
      const saved = threeCameraSnapshotRef.current;
      camera.position.set(
        saved.position[0],
        saved.position[1],
        saved.position[2],
      );
    } else {
      camera.position.set(20, 20, 20);
    }
    threeCameraRef.current = camera;
    threeSceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    if (threeCameraSnapshotRef.current) {
      const saved = threeCameraSnapshotRef.current;
      controls.target.set(saved.target[0], saved.target[1], saved.target[2]);
    } else {
      controls.target.set(0, 0, 0);
    }
    threeControlsRef.current = controls;
    const moveArrows = new THREE.Group();
    const axisGroup = new THREE.Group();
    const makeAxisLine = (
      to: [number, number, number],
      color: number,
      axis: "x" | "y" | "z",
    ) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(to[0], to[1], to[2]),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color });
      lineMat.depthTest = false;
      lineMat.transparent = true;
      lineMat.opacity = 0.95;
      const line = new THREE.Line(lineGeo, lineMat);
      line.renderOrder = 999;
      line.userData.isAxisHandle = true;
      line.userData.axis = axis;
      return line;
    };
    const makeArrow = (
      dir: THREE.Vector3,
      color: number,
      len: number,
      axis: "x" | "y" | "z",
    ) => {
      const arrow = new THREE.ArrowHelper(
        dir,
        new THREE.Vector3(0, 0, 0),
        len,
        color,
        Math.max(0.3, len * 0.22),
        Math.max(0.16, len * 0.12),
      );
      arrow.line.material.depthTest = false;
      arrow.line.material.transparent = true;
      arrow.line.material.opacity = 0.95;
      arrow.cone.material.depthTest = false;
      arrow.cone.material.transparent = true;
      arrow.cone.material.opacity = 0.95;
      arrow.line.renderOrder = 1000;
      arrow.cone.renderOrder = 1001;
      arrow.userData.isAxisHandle = true;
      arrow.userData.axis = axis;
      arrow.line.userData.isAxisHandle = true;
      arrow.line.userData.axis = axis;
      arrow.cone.userData.isAxisHandle = true;
      arrow.cone.userData.axis = axis;
      return arrow;
    };
    axisGroup.add(makeAxisLine([2.2, 0, 0], 0xff3b3b, "x"));
    axisGroup.add(makeAxisLine([0, 2.2, 0], 0x2bff6a, "y"));
    axisGroup.add(makeAxisLine([0, 0, 2.2], 0x3b82ff, "z"));
    axisGroup.add(makeArrow(new THREE.Vector3(1, 0, 0), 0xff3b3b, 2.2, "x"));
    axisGroup.add(makeArrow(new THREE.Vector3(0, 1, 0), 0x2bff6a, 2.2, "y"));
    axisGroup.add(makeArrow(new THREE.Vector3(0, 0, 1), 0x3b82ff, 2.2, "z"));
    moveArrows.add(axisGroup);
    moveArrows.visible = false;
    scene.add(moveArrows);
    threeMoveArrowsRef.current = moveArrows;
    const axisGuideGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const axisGuideMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    axisGuideMaterial.depthTest = false;
    const axisGuide = new THREE.Line(axisGuideGeometry, axisGuideMaterial);
    axisGuide.visible = false;
    axisGuide.renderOrder = 1200;
    scene.add(axisGuide);
    threeAxisGuideRef.current = axisGuide;

    scene.add(new THREE.GridHelper(200, 100, 0x2b5bd7, 0x1f2a44));
    scene.add(new THREE.AxesHelper(5));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 30, 20);
    scene.add(dir);

    const colorForType = (type: string) => {
      const map: Record<string, number> = {
        Wall: 0x6ea8fe,
        Slab: 0x8d99ae,
        Column: 0x64dfdf,
        Beam: 0x4895ef,
        Door: 0xffbe0b,
        Window: 0x90e0ef,
        Opening: 0xf4a261,
        Room: 0xadb5bd,
        Grid: 0x4cc9f0,
        Level: 0xb5179e,
      };
      return map[type] || 0xcccccc;
    };

    const addElementMesh = (el: {
      id: string;
      type: string;
      geometry?: { position?: [number, number, number] };
      parameters?: Record<string, unknown>;
    }) => {
      const preview = previewModelElementUpdates[el.id] || {};
      const previewGeometry =
        (preview.geometry as Record<string, unknown>) || {};
      const previewParams =
        (preview.parameters as Record<string, unknown>) || {};
      const mergedGeometry = { ...(el.geometry || {}), ...previewGeometry } as {
        position?: [number, number, number];
        rotationY?: number;
        start?: [number, number, number];
        end?: [number, number, number];
      };
      let pos = mergedGeometry.position || [0, 0, 0];
      let geometry: THREE.BufferGeometry;

      const p = { ...(el.parameters || {}), ...previewParams };
      if (el.type === "Wall") {
        const ws = mergedGeometry.start;
        const we = mergedGeometry.end;
        let wallLen = Number(p.length ?? 3);
        let wallRot = Number(mergedGeometry.rotationY ?? 0);
        if (ws && we) {
          const dx = we[0] - ws[0];
          const dz = we[2] - ws[2];
          wallLen = Math.max(0.1, Math.hypot(dx, dz));
          wallRot = Math.atan2(dz, dx);
          pos = [
            (ws[0] + we[0]) * 0.5,
            Number(p.height ?? 3) * 0.5,
            (ws[2] + we[2]) * 0.5,
          ];
        }
        geometry = new THREE.BoxGeometry(
          wallLen,
          Number(p.height ?? 3),
          Number(p.thickness ?? 0.23),
        );
        mergedGeometry.rotationY = wallRot;
      } else if (el.type === "Column")
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 0.4),
          Number(p.height ?? 3),
          Number(p.depth ?? 0.4),
        );
      else if (el.type === "Slab")
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 4),
          Number(p.height ?? 0.3),
          Number(p.depth ?? 4),
        );
      else if (el.type === "Beam")
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 3),
          Number(p.height ?? 0.35),
          Number(p.depth ?? 0.35),
        );
      else if (el.type === "Door")
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 1),
          Number(p.height ?? 2.1),
          Number(p.thickness ?? 0.12),
        );
      else if (el.type === "Window")
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 1.2),
          Number(p.height ?? 1.2),
          Number(p.thickness ?? 0.12),
        );
      else if (el.type === "Opening")
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 1),
          Number(p.height ?? 1),
          Number(p.thickness ?? 0.12),
        );
      else if (el.type === "Room")
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 4),
          Number(p.height ?? 2.7),
          Number(p.depth ?? 4),
        );
      else if (el.type === "Grid")
        geometry = new THREE.BoxGeometry(0.05, 0.05, 5);
      else if (el.type === "Level")
        geometry = new THREE.BoxGeometry(5, 0.05, 0.05);
      else
        geometry = new THREE.BoxGeometry(
          Number(p.width ?? 3),
          Number(p.height ?? 3),
          Number(p.depth ?? 0.23),
        );

      const material = new THREE.MeshStandardMaterial({
        color: colorForType(el.type),
        metalness: 0.1,
        roughness: 0.75,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.y = Number(mergedGeometry.rotationY ?? 0);
      mesh.userData.basePosition = [...pos];
      mesh.userData.elementId = el.id;
      mesh.visible = !hiddenModelElementIds.has(el.id);
      scene.add(mesh);
      threeMeshMapRef.current.set(el.id, mesh);
    };

    threeMeshMapRef.current.clear();
    modelElements.forEach(addElementMesh);

    const clearResizeHandles = () => {
      threeResizeHandlesRef.current.forEach((h) => {
        if (h.parent) h.parent.remove(h);
        h.geometry.dispose();
        (h.material as THREE.Material).dispose();
      });
      threeResizeHandlesRef.current = [];
    };

    const addResizeHandles = (mesh: THREE.Mesh) => {
      clearResizeHandles();
      const box = new THREE.Box3().setFromBufferAttribute(
        (mesh.geometry as THREE.BufferGeometry).attributes
          .position as THREE.BufferAttribute,
      );
      const size = box.getSize(new THREE.Vector3());
      const hx = Math.max(0.1, size.x * 0.5);
      const hy = Math.max(0.1, size.y * 0.5);
      const hz = Math.max(0.1, size.z * 0.5);
      const defs: Array<{
        axis: "x" | "y" | "z";
        dir: 1 | -1;
        pos: [number, number, number];
        color: number;
      }> = [
        { axis: "x", dir: 1, pos: [hx * 1.03, 0, 0], color: 0xff4d4d },
        { axis: "x", dir: -1, pos: [-hx * 1.03, 0, 0], color: 0xff4d4d },
        { axis: "y", dir: 1, pos: [0, hy * 1.03, 0], color: 0x4dff8a },
        { axis: "y", dir: -1, pos: [0, -hy * 1.03, 0], color: 0x4dff8a },
        { axis: "z", dir: 1, pos: [0, 0, hz * 1.03], color: 0x4da6ff },
        { axis: "z", dir: -1, pos: [0, 0, -hz * 1.03], color: 0x4da6ff },
      ];
      defs.forEach((def) => {
        const g = new THREE.SphereGeometry(
          Math.max(0.12, Math.min(hx, hy, hz) * 0.2),
          14,
          14,
        );
        const m = new THREE.MeshBasicMaterial({
          color: def.color,
          transparent: true,
          opacity: 0.95,
        });
        const h = new THREE.Mesh(g, m);
        h.position.set(def.pos[0], def.pos[1], def.pos[2]);
        h.userData.isResizeHandle = true;
        h.userData.axis = def.axis;
        h.userData.direction = def.dir;
        mesh.add(h);
        threeResizeHandlesRef.current.push(h);
      });
    };
    if (selectedModelElementId) {
      const selectedMesh = threeMeshMapRef.current.get(selectedModelElementId);
      if (selectedMesh) {
        addResizeHandles(selectedMesh);
        if (threeMoveArrowsRef.current) {
          const bbox = new THREE.Box3().setFromObject(selectedMesh);
          const size = bbox.getSize(new THREE.Vector3());
          const axisLen = Math.max(2.2, size.length() * 0.55);
          const axis = threeMoveArrowsRef.current.children[0] as
            | THREE.Group
            | undefined;
          if (axis) {
            axis.scale.set(axisLen / 2.2, axisLen / 2.2, axisLen / 2.2);
          }
          threeMoveArrowsRef.current.position.copy(selectedMesh.position);
          threeMoveArrowsRef.current.rotation.copy(selectedMesh.rotation);
          threeMoveArrowsRef.current.visible = true;
        }
      }
    }

    const pickMeshFromPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      threePointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      threePointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      threeRaycasterRef.current.setFromCamera(threePointerRef.current, camera);
      const meshes = Array.from(threeMeshMapRef.current.values()).filter(
        (m) => m.visible,
      );
      const hits = threeRaycasterRef.current.intersectObjects(meshes, false);
      return hits[0]?.object as THREE.Mesh | undefined;
    };

    const pickResizeHandleFromPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      threePointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      threePointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      threeRaycasterRef.current.setFromCamera(threePointerRef.current, camera);
      const hits = threeRaycasterRef.current.intersectObjects(
        threeResizeHandlesRef.current,
        false,
      );
      return hits[0]?.object as THREE.Mesh | undefined;
    };

    const pickAxisHandleFromPointer = (event: PointerEvent) => {
      if (!threeMoveArrowsRef.current || !threeMoveArrowsRef.current.visible)
        return null;
      const rect = renderer.domElement.getBoundingClientRect();
      threePointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      threePointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      threeRaycasterRef.current.setFromCamera(threePointerRef.current, camera);
      const axisObjects: THREE.Object3D[] = [];
      threeMoveArrowsRef.current.traverse((obj: THREE.Object3D) => {
        if (obj.userData?.isAxisHandle) axisObjects.push(obj);
      });
      const hits = threeRaycasterRef.current.intersectObjects(
        axisObjects,
        true,
      );
      return (hits[0]?.object as THREE.Object3D | undefined) || null;
    };

    const showAxisGuide = (axis: "x" | "y" | "z", at: THREE.Vector3) => {
      if (!threeAxisGuideRef.current) return;
      const span = 200;
      const p1 = at.clone();
      const p2 = at.clone();
      const mat = threeAxisGuideRef.current.material as THREE.LineBasicMaterial;
      if (axis === "x") {
        p1.x -= span;
        p2.x += span;
        mat.color.setHex(0xff3b3b);
      } else if (axis === "y") {
        p1.y -= span;
        p2.y += span;
        mat.color.setHex(0x2bff6a);
      } else {
        p1.z -= span;
        p2.z += span;
        mat.color.setHex(0x3b82ff);
      }
      threeAxisGuideRef.current.geometry.setFromPoints([p1, p2]);
      threeAxisGuideRef.current.visible = true;
    };

    const onPointerMove = (event: PointerEvent) => {
      const handle = pickResizeHandleFromPointer(event);
      if (handle) {
        const axis = handle.userData.axis as "x" | "y" | "z";
        const hostEl = threeHostRef.current;
        if (hostEl) {
          hostEl.style.cursor = axis === "y" ? "ns-resize" : "ew-resize";
        }
        threeResizeHandlesRef.current.forEach((h) => {
          const mat = h.material as THREE.MeshBasicMaterial;
          mat.opacity = h === handle ? 1 : 0.75;
        });
        return;
      }
      const axisHandle = pickAxisHandleFromPointer(event);
      if (axisHandle) {
        const axis = axisHandle.userData.axis as "x" | "y" | "z";
        if (threeMoveArrowsRef.current) {
          showAxisGuide(axis, threeMoveArrowsRef.current.position);
        }
        if (!axisDragRef.current.active) {
          setAxisHint({ axis, delta: 0, dragging: false });
        }
        const hostEl = threeHostRef.current;
        if (hostEl) hostEl.style.cursor = "grab";
        return;
      }
      if (threeAxisGuideRef.current && !axisDragRef.current.active) {
        threeAxisGuideRef.current.visible = false;
        setAxisHint(null);
      }
      const mesh = pickMeshFromPointer(event);
      const nextHover =
        (mesh?.userData.elementId as string | undefined) || null;
      threeHoveredElementIdRef.current = nextHover;
      const hostEl = threeHostRef.current;
      if (hostEl) {
        hostEl.style.cursor = nextHover ? "pointer" : "default";
      }
      threeResizeHandlesRef.current.forEach((h) => {
        const mat = h.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.95;
      });
      threeMeshMapRef.current.forEach((m, id) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (id === selectedModelElementId) return;
        if (id === nextHover) {
          mat.emissive = new THREE.Color(0x223366);
          mat.emissiveIntensity = 0.45;
        } else {
          mat.emissive = new THREE.Color(0x000000);
          mat.emissiveIntensity = 0;
        }
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      threePointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      threePointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      threeRaycasterRef.current.setFromCamera(threePointerRef.current, camera);
      const meshes = Array.from(threeMeshMapRef.current.values()).filter(
        (m) => m.visible,
      );
      const hits = threeRaycasterRef.current.intersectObjects(meshes, false);
      const hit = hits[0];
      const mesh = hit?.object as THREE.Mesh | undefined;
      const id = mesh?.userData.elementId as string | undefined;

      // Always allow switching to another element even if gizmos are in front.
      if (id && selectedModelElementId && id !== selectedModelElementId) {
        onSelectModelElement(id);
        return;
      }

      // Resize handles have priority for the currently selected element.
      const handle = pickResizeHandleFromPointer(event);
      if (handle && selectedModelElementId) {
        const selectedMesh = threeMeshMapRef.current.get(
          selectedModelElementId,
        );
        if (selectedMesh) {
          const axis = handle.userData.axis as "x" | "y" | "z";
          const axisDirLocal =
            axis === "x"
              ? new THREE.Vector3(1, 0, 0)
              : axis === "y"
                ? new THREE.Vector3(0, 1, 0)
                : new THREE.Vector3(0, 0, 1);
          const axisDir = axisDirLocal
            .clone()
            .applyQuaternion(selectedMesh.quaternion)
            .normalize();
          const origin = selectedMesh.position.clone();
          const segA = origin.clone().addScaledVector(axisDir, -1000);
          const segB = origin.clone().addScaledVector(axisDir, 1000);
          const pOnRay = new THREE.Vector3();
          const pOnSeg = new THREE.Vector3();
          threeRaycasterRef.current.ray.distanceSqToSegment(
            segA,
            segB,
            pOnRay,
            pOnSeg,
          );
          const baseScaleAxis =
            axis === "x"
              ? selectedMesh.scale.x
              : axis === "y"
                ? selectedMesh.scale.y
                : selectedMesh.scale.z;
          resizeDragRef.current = {
            active: true,
            elementId: selectedModelElementId,
            axis,
            direction: (handle.userData.direction as 1 | -1) || 1,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startScale: selectedMesh.scale.clone(),
            axisDir,
            axisOrigin: origin,
            startPoint: pOnSeg.clone(),
            baseScaleAxis,
          };
          controls.enabled = false;
          return;
        }
      }

      // Axis drag starts when clicking axis handles.
      const axisHandle = pickAxisHandleFromPointer(event);
      if (axisHandle && selectedModelElementId) {
        const selectedMesh = threeMeshMapRef.current.get(
          selectedModelElementId,
        );
        if (selectedMesh) {
          const axis = axisHandle.userData.axis as "x" | "y" | "z";
          const axisDirLocal =
            axis === "x"
              ? new THREE.Vector3(1, 0, 0)
              : axis === "y"
                ? new THREE.Vector3(0, 1, 0)
                : new THREE.Vector3(0, 0, 1);
          const axisDir = axisDirLocal
            .clone()
            .applyQuaternion(selectedMesh.quaternion)
            .normalize();
          const origin = selectedMesh.position.clone();
          const pOnRay = new THREE.Vector3();
          const pOnSeg = new THREE.Vector3();
          const segA = origin.clone().addScaledVector(axisDir, -1000);
          const segB = origin.clone().addScaledVector(axisDir, 1000);
          threeRaycasterRef.current.ray.distanceSqToSegment(
            segA,
            segB,
            pOnRay,
            pOnSeg,
          );
          axisDragRef.current = {
            active: true,
            elementId: selectedModelElementId,
            axis,
            axisDir,
            axisOrigin: origin,
            startPoint: pOnSeg.clone(),
            startPosition: selectedMesh.position.clone(),
          };
          controls.enabled = false;
          showAxisGuide(axis, origin);
          setAxisHint({ axis, delta: 0, dragging: true });
          return;
        }
      }

      // Click selected element body: always free-move.
      // Resizing is handled only via explicit resize handles.
      if (id && id === selectedModelElementId) {
        const selectedMesh = threeMeshMapRef.current.get(
          selectedModelElementId,
        );
        if (selectedMesh) {
          freeMoveDragRef.current = {
            active: true,
            elementId: selectedModelElementId,
            y: selectedMesh.position.y,
          };
          controls.enabled = false;
          return;
        }
      }

      // Select element when not yet selected.
      if (id) {
        onSelectModelElement(id);
      }
    };

    const onPointerUp = async () => {
      if (axisDragRef.current.active) {
        const id = axisDragRef.current.elementId;
        axisDragRef.current.active = false;
        controls.enabled = true;
        if (threeAxisGuideRef.current)
          threeAxisGuideRef.current.visible = false;
        setAxisHint(null);
        if (!id) return;
        const mesh = threeMeshMapRef.current.get(id);
        const element = modelElements.find((el) => el.id === id);
        if (!mesh || !element) return;
        const payload: Record<string, unknown> = {};
        const p = { ...(element.parameters || {}) } as Record<string, unknown>;
        if (element.type === "Wall") {
          const prevPos = (element.geometry?.position || [0, 0, 0]) as XYZ;
          const prevStart = (element.geometry?.start ||
            element.start || [0, 0, 0]) as XYZ;
          const prevEnd = (element.geometry?.end ||
            element.end || [3, 0, 0]) as XYZ;
          const dx = mesh.position.x - prevPos[0];
          const dz = mesh.position.z - prevPos[2];
          payload.geometry = {
            ...(element.geometry || {}),
            start: [prevStart[0] + dx, 0, prevStart[2] + dz],
            end: [prevEnd[0] + dx, 0, prevEnd[2] + dz],
          };
        } else {
          payload.geometry = {
            ...(element.geometry || {}),
            position: [mesh.position.x, mesh.position.y, mesh.position.z],
          };
          if (
            element.type === "Door" ||
            element.type === "Window" ||
            element.type === "Opening"
          ) {
            p.host_wall_id = null;
          }
        }
        payload.parameters = p;
        await onUpdateModelElement(id, payload);
        return;
      }
      const wasMove = freeMoveDragRef.current.active;
      const wasResize = resizeDragRef.current.active;
      if (!wasMove && !wasResize) return;
      freeMoveDragRef.current.active = false;
      resizeDragRef.current.active = false;
      controls.enabled = true;
      const id =
        freeMoveDragRef.current.elementId || resizeDragRef.current.elementId;
      if (!id) return;
      const mesh = threeMeshMapRef.current.get(id);
      const element = modelElements.find((el) => el.id === id);
      if (!mesh || !element) return;
      const payload: Record<string, unknown> = {};
      const p = { ...(element.parameters || {}) } as Record<string, unknown>;
      const nextParams = { ...p } as Record<string, unknown>;
      if (wasMove) {
        if (element.type === "Wall") {
          const prevPos = (element.geometry?.position || [0, 0, 0]) as XYZ;
          const prevStart = (element.geometry?.start ||
            element.start || [0, 0, 0]) as XYZ;
          const prevEnd = (element.geometry?.end ||
            element.end || [3, 0, 0]) as XYZ;
          const dx = mesh.position.x - prevPos[0];
          const dz = mesh.position.z - prevPos[2];
          payload.geometry = {
            ...(element.geometry || {}),
            start: [prevStart[0] + dx, 0, prevStart[2] + dz],
            end: [prevEnd[0] + dx, 0, prevEnd[2] + dz],
          };
        } else {
          payload.geometry = {
            ...(element.geometry || {}),
            position: [mesh.position.x, mesh.position.y, mesh.position.z],
          };
          if (
            element.type === "Door" ||
            element.type === "Window" ||
            element.type === "Opening"
          ) {
            p.host_wall_id = null;
          }
        }
      } else {
        const sx = Math.max(0.1, mesh.scale.x);
        const sy = Math.max(0.1, mesh.scale.y);
        const sz = Math.max(0.1, mesh.scale.z);
        if (element.type === "Wall") {
          nextParams.height = Number(p.height ?? element.height ?? 3) * sy;
          nextParams.thickness =
            Number(p.thickness ?? element.thickness ?? 0.23) * sz;
          const prevStart = (element.geometry?.start ||
            element.start || [0, 0, 0]) as XYZ;
          const prevEnd = (element.geometry?.end ||
            element.end || [3, 0, 0]) as XYZ;
          const cx = (prevStart[0] + prevEnd[0]) * 0.5;
          const cz = (prevStart[2] + prevEnd[2]) * 0.5;
          const hx = (prevEnd[0] - prevStart[0]) * 0.5 * sx;
          const hz = (prevEnd[2] - prevStart[2]) * 0.5 * sx;
          payload.geometry = {
            ...(element.geometry || {}),
            start: [cx - hx, 0, cz - hz],
            end: [cx + hx, 0, cz + hz],
          };
        } else if (
          element.type === "Door" ||
          element.type === "Window" ||
          element.type === "Opening"
        ) {
          nextParams.width = Number(p.width ?? 1) * sx;
          nextParams.height = Number(p.height ?? 2.1) * sy;
          nextParams.thickness = Number(p.thickness ?? 0.12) * sz;
          nextParams.host_wall_id = null;
        } else {
          nextParams.width = Number(p.width ?? 1) * sx;
          nextParams.height = Number(p.height ?? 1) * sy;
          nextParams.depth = Number(p.depth ?? 1) * sz;
        }
        mesh.scale.set(1, 1, 1);
      }
      if (!payload.geometry) {
        payload.geometry = {
          ...(element.geometry || {}),
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
        };
      }
      payload.parameters = wasResize ? nextParams : p;
      await onUpdateModelElement(id, payload);
    };

    const onPointerDrag = (event: PointerEvent) => {
      if (!freeMoveDragRef.current.active) return;
      const id = freeMoveDragRef.current.elementId;
      if (!id) return;
      const mesh = threeMeshMapRef.current.get(id);
      if (!mesh) return;
      const rect = renderer.domElement.getBoundingClientRect();
      threePointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      threePointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      threeRaycasterRef.current.setFromCamera(threePointerRef.current, camera);
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -freeMoveDragRef.current.y,
      );
      const hit = new THREE.Vector3();
      if (threeRaycasterRef.current.ray.intersectPlane(plane, hit)) {
        mesh.position.x = hit.x;
        mesh.position.z = hit.z;
      }
    };
    const onResizeDrag = (event: PointerEvent) => {
      if (!resizeDragRef.current.active) return;
      const id = resizeDragRef.current.elementId;
      if (!id) return;
      const mesh = threeMeshMapRef.current.get(id);
      if (!mesh) return;
      const rect = renderer.domElement.getBoundingClientRect();
      threePointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      threePointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      threeRaycasterRef.current.setFromCamera(threePointerRef.current, camera);
      const pOnRay = new THREE.Vector3();
      const pOnSeg = new THREE.Vector3();
      const segA = resizeDragRef.current.axisOrigin
        .clone()
        .addScaledVector(resizeDragRef.current.axisDir, -1000);
      const segB = resizeDragRef.current.axisOrigin
        .clone()
        .addScaledVector(resizeDragRef.current.axisDir, 1000);
      threeRaycasterRef.current.ray.distanceSqToSegment(
        segA,
        segB,
        pOnRay,
        pOnSeg,
      );
      const deltaVec = pOnSeg.clone().sub(resizeDragRef.current.startPoint);
      const dist = deltaVec.dot(resizeDragRef.current.axisDir);
      const nextScaleAxis = Math.max(
        0.2,
        resizeDragRef.current.baseScaleAxis +
          dist * 0.15 * resizeDragRef.current.direction,
      );
      if (resizeDragRef.current.axis === "x") mesh.scale.x = nextScaleAxis;
      if (resizeDragRef.current.axis === "y") mesh.scale.y = nextScaleAxis;
      if (resizeDragRef.current.axis === "z") mesh.scale.z = nextScaleAxis;
    };
    const onAxisDrag = (event: PointerEvent) => {
      if (!axisDragRef.current.active) return;
      const id = axisDragRef.current.elementId;
      if (!id) return;
      const mesh = threeMeshMapRef.current.get(id);
      if (!mesh) return;
      const rect = renderer.domElement.getBoundingClientRect();
      threePointerRef.current.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      threePointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      threeRaycasterRef.current.setFromCamera(threePointerRef.current, camera);
      const pOnRay = new THREE.Vector3();
      const pOnSeg = new THREE.Vector3();
      const segA = axisDragRef.current.axisOrigin
        .clone()
        .addScaledVector(axisDragRef.current.axisDir, -1000);
      const segB = axisDragRef.current.axisOrigin
        .clone()
        .addScaledVector(axisDragRef.current.axisDir, 1000);
      threeRaycasterRef.current.ray.distanceSqToSegment(
        segA,
        segB,
        pOnRay,
        pOnSeg,
      );
      const delta = pOnSeg.clone().sub(axisDragRef.current.startPoint);
      const dist = delta.dot(axisDragRef.current.axisDir);
      mesh.position
        .copy(axisDragRef.current.startPosition)
        .addScaledVector(axisDragRef.current.axisDir, dist);
      if (threeMoveArrowsRef.current) {
        threeMoveArrowsRef.current.position.copy(mesh.position);
      }
      showAxisGuide(axisDragRef.current.axis || "x", mesh.position);
      if (axisDragRef.current.axis) {
        setAxisHint({
          axis: axisDragRef.current.axis,
          delta: dist,
          dragging: true,
        });
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerDrag);
    renderer.domElement.addEventListener("pointermove", onResizeDrag);
    renderer.domElement.addEventListener("pointermove", onAxisDrag);

    let raf = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host);

    return () => {
      if (threeCameraRef.current && threeControlsRef.current) {
        threeCameraSnapshotRef.current = {
          position: [
            threeCameraRef.current.position.x,
            threeCameraRef.current.position.y,
            threeCameraRef.current.position.z,
          ],
          target: [
            threeControlsRef.current.target.x,
            threeControlsRef.current.target.y,
            threeControlsRef.current.target.z,
          ],
        };
      }
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      if (threeSelectionOutlineRef.current) {
        scene.remove(threeSelectionOutlineRef.current);
        const mat = threeSelectionOutlineRef.current.material as THREE.Material;
        mat.dispose();
        threeSelectionOutlineRef.current.geometry.dispose();
        threeSelectionOutlineRef.current = null;
      }
      controls.dispose();
      if (threeMoveArrowsRef.current && threeMoveArrowsRef.current.parent) {
        threeMoveArrowsRef.current.parent.remove(threeMoveArrowsRef.current);
      }
      threeMoveArrowsRef.current = null;
      if (threeAxisGuideRef.current && threeAxisGuideRef.current.parent) {
        threeAxisGuideRef.current.parent.remove(threeAxisGuideRef.current);
      }
      threeAxisGuideRef.current = null;
      clearResizeHandles();
      renderer.dispose();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerDrag);
      renderer.domElement.removeEventListener("pointermove", onResizeDrag);
      renderer.domElement.removeEventListener("pointermove", onAxisDrag);
      setAxisHint(null);
      host.innerHTML = "";
      threeMeshMapRef.current.clear();
      threeControlsRef.current = null;
      threeCameraRef.current = null;
      threeSceneRef.current = null;
    };
  }, [
    blankModelingMode,
    modelElements,
    hiddenModelElementIds,
    onSelectModelElement,
    onUpdateModelElement,
    previewModelElementUpdates,
    selectedModelElementId,
  ]);

  useEffect(() => {
    if (!blankModelingMode) return;
    threeMeshMapRef.current.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (id === selectedModelElementId) {
        mat.emissive = new THREE.Color(0x3344aa);
        mat.emissiveIntensity = 0.8;
      } else {
        mat.emissive = new THREE.Color(0x000000);
        mat.emissiveIntensity = 0;
      }
      mesh.visible = !hiddenModelElementIds.has(id);
    });
    if (threeSelectionOutlineRef.current && threeSceneRef.current) {
      threeSceneRef.current.remove(threeSelectionOutlineRef.current);
      const mat = threeSelectionOutlineRef.current.material as THREE.Material;
      mat.dispose();
      threeSelectionOutlineRef.current.geometry.dispose();
      threeSelectionOutlineRef.current = null;
    }
    if (
      selectedModelElementId &&
      threeCameraRef.current &&
      threeControlsRef.current
    ) {
      const mesh = threeMeshMapRef.current.get(selectedModelElementId);
      if (mesh) {
        if (threeMoveArrowsRef.current) {
          const bbox = new THREE.Box3().setFromObject(mesh);
          const size = bbox.getSize(new THREE.Vector3());
          const axisLen = Math.max(2.2, size.length() * 0.55);
          const axis = threeMoveArrowsRef.current.children[0] as
            | THREE.Group
            | undefined;
          if (axis) {
            axis.scale.set(axisLen / 2.2, axisLen / 2.2, axisLen / 2.2);
          }
          threeMoveArrowsRef.current.position.copy(mesh.position);
          threeMoveArrowsRef.current.rotation.copy(mesh.rotation);
          threeMoveArrowsRef.current.visible = true;
        }
        if (threeResizeHandlesRef.current.length === 0) {
          const box = new THREE.Box3().setFromBufferAttribute(
            (mesh.geometry as THREE.BufferGeometry).attributes
              .position as THREE.BufferAttribute,
          );
          const size = box.getSize(new THREE.Vector3());
          const hx = Math.max(0.1, size.x * 0.5);
          const hy = Math.max(0.1, size.y * 0.5);
          const hz = Math.max(0.1, size.z * 0.5);
          const defs: Array<{
            axis: "x" | "y" | "z";
            dir: 1 | -1;
            pos: [number, number, number];
            color: number;
          }> = [
            { axis: "x", dir: 1, pos: [hx * 1.03, 0, 0], color: 0xff4d4d },
            { axis: "x", dir: -1, pos: [-hx * 1.03, 0, 0], color: 0xff4d4d },
            { axis: "y", dir: 1, pos: [0, hy * 1.03, 0], color: 0x4dff8a },
            { axis: "y", dir: -1, pos: [0, -hy * 1.03, 0], color: 0x4dff8a },
            { axis: "z", dir: 1, pos: [0, 0, hz * 1.03], color: 0x4da6ff },
            { axis: "z", dir: -1, pos: [0, 0, -hz * 1.03], color: 0x4da6ff },
          ];
          defs.forEach((def) => {
            const g = new THREE.SphereGeometry(
              Math.max(0.12, Math.min(hx, hy, hz) * 0.2),
              14,
              14,
            );
            const m = new THREE.MeshBasicMaterial({
              color: def.color,
              transparent: true,
              opacity: 0.95,
            });
            const h = new THREE.Mesh(g, m);
            h.position.set(def.pos[0], def.pos[1], def.pos[2]);
            h.userData.isResizeHandle = true;
            h.userData.axis = def.axis;
            h.userData.direction = def.dir;
            mesh.add(h);
            threeResizeHandlesRef.current.push(h);
          });
        }
        const outlineGeo = new THREE.EdgesGeometry(mesh.geometry);
        const outlineMat = new THREE.LineBasicMaterial({
          color: 0xffff66,
          linewidth: 2,
        });
        const outline = new THREE.LineSegments(outlineGeo, outlineMat);
        outline.position.copy(mesh.position);
        outline.rotation.copy(mesh.rotation);
        outline.scale.copy(mesh.scale.clone().multiplyScalar(1.02));
        if (threeSceneRef.current) {
          threeSceneRef.current.add(outline);
          threeSelectionOutlineRef.current = outline;
        }
        const p = mesh.position;
        threeControlsRef.current.target.set(p.x, p.y, p.z);
      }
    } else {
      if (threeMoveArrowsRef.current) {
        threeMoveArrowsRef.current.visible = false;
      }
      threeResizeHandlesRef.current.forEach((h) => {
        if (h.parent) h.parent.remove(h);
        h.geometry.dispose();
        (h.material as THREE.Material).dispose();
      });
      threeResizeHandlesRef.current = [];
    }
  }, [blankModelingMode, selectedModelElementId, hiddenModelElementIds]);

  useEffect(() => {
    if (!blankModelingMode) return;
    const meshes = Array.from(threeMeshMapRef.current.values());
    if (meshes.length === 0) return;
    meshes.forEach((mesh) => {
      const base = mesh.userData.basePosition as [number, number, number];
      const len = Math.hypot(base[0], base[1], base[2]) || 1;
      const explode = explodeFactor * 0.03;
      mesh.position.set(
        base[0] + (base[0] / len) * explode,
        base[1] + (base[1] / len) * explode,
        base[2] + (base[2] / len) * explode,
      );
    });
  }, [blankModelingMode, explodeFactor]);

  const fitAll = () => {
    if (blankModelingMode) {
      const meshes = Array.from(threeMeshMapRef.current.values()).filter(
        (m) => m.visible,
      );
      if (
        meshes.length === 0 ||
        !threeCameraRef.current ||
        !threeControlsRef.current
      )
        return;
      const box = new THREE.Box3();
      meshes.forEach((m) => box.expandByObject(m));
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length() || 10;
      threeControlsRef.current.target.copy(center);
      threeCameraRef.current.position.set(
        center.x + size * 0.8,
        center.y + size * 0.6,
        center.z + size * 0.8,
      );
      return;
    }
    if (!viewerRef.current) return;
    const model = viewerRef.current.scene.models["main-model"];
    if (model) viewerRef.current.cameraFlight.flyTo(model);
  };

  const resetView = () => {
    if (
      blankModelingMode &&
      threeCameraRef.current &&
      threeControlsRef.current
    ) {
      threeCameraRef.current.position.set(20, 20, 20);
      threeControlsRef.current.target.set(0, 0, 0);
      return;
    }
    if (!viewerRef.current) return;
    viewerRef.current.camera.eye = [-10, 10, -10];
    viewerRef.current.camera.look = [0, 0, 0];
    viewerRef.current.camera.up = [0, 1, 0];
    const model = viewerRef.current.scene.models["main-model"];
    if (model) viewerRef.current.cameraFlight.jumpTo(model);
  };

  const toggleXray = () => {
    if (blankModelingMode) {
      threeXrayRef.current = !threeXrayRef.current;
      threeMeshMapRef.current.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.wireframe = threeXrayRef.current;
        mat.transparent = threeXrayRef.current;
        mat.opacity = threeXrayRef.current ? 0.45 : 1;
      });
      return;
    }
    if (!viewerRef.current) return;
    const objects = viewerRef.current.scene.objectIds;
    const firstObj = viewerRef.current.scene.objects[objects[0]];
    if (firstObj) {
      const currentXray = firstObj.xrayed;
      viewerRef.current.scene.setObjectsXRayed(objects, !currentXray);
    }
  };

  const resetExplode = () => {
    onExplodeChange(0);
  };

  return (
    <div className="flex-1 relative bg-[#080912] min-h-0">
      <canvas
        className="w-full h-full cursor-default block outline-none"
        ref={canvasRef}
        tabIndex={0}
      />
      {blankModelingMode && (
        <div ref={threeHostRef} className="absolute inset-0" />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xl z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-400 font-bold tracking-widest text-[10px] uppercase">
              Rendering BIM Model…
            </p>
          </div>
        </div>
      )}

      {/* Floating toolbar */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        {blankModelingMode && (
          <button
            className="w-8 h-8 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center bg-blue-600/60 text-white"
            title="Move selected element with axis arrows"
          >
            ↕
          </button>
        )}
        <button
          onClick={fitAll}
          className="w-8 h-8 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-black/70 transition-all"
          title="Fit All"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-black/70 transition-all"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={toggleXray}
          className="w-8 h-8 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-black/70 transition-all"
          title="Toggle X-Ray"
        >
          <Grid3X3 className="w-3.5 h-3.5" />
        </button>

        {/* Explode View */}
        <div
          className="w-8 bg-black/50 backdrop-blur border border-white/10 rounded-lg flex flex-col items-center gap-0.5 py-1"
          title="Explode View"
        >
          <UnfoldHorizontal className="w-3 h-3 text-white/30" />
          <input
            type="range"
            min="0"
            max="100"
            value={explodeFactor}
            onChange={(e) => onExplodeChange(parseInt(e.target.value))}
            className="w-6 h-12 appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-runnable-track]:bg-white/10 [&::-webkit-slider-runnable-track]:w-0.5 [&::-webkit-slider-runnable-track]:mx-auto"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
          <button
            onClick={resetExplode}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      {blankModelingMode && (
        <div className="absolute left-3 bottom-3 rounded bg-black/50 border border-white/10 px-2 py-1 text-[10px] text-white/70">
          Click element center to move. Drag near edges/top/bottom to resize.
        </div>
      )}
      {blankModelingMode && axisHint && (
        <div className="absolute left-3 top-3 rounded bg-black/60 border border-white/10 px-2 py-1 text-[10px] text-white/80">
          Axis {axisHint.axis.toUpperCase()}{" "}
          {axisHint.dragging
            ? `d${axisHint.axis.toUpperCase()}: ${axisHint.delta.toFixed(2)}m`
            : "selected"}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE – 5-Pane Shell
// ─────────────────────────────────────────
export default function ViewerPage() {
  const { id } = useParams();
  const projectId = id as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  const [loading, setLoading] = useState(true);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [allElements, setAllElements] = useState<any[]>([]);
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [blankModelingMode, setBlankModelingMode] = useState(false);
  const [modelElements, setModelElements] = useState<ViewerModelElement[]>([]);
  const [hiddenModelElementIds, setHiddenModelElementIds] = useState<
    Set<string>
  >(new Set());
  const [selectedModelElementId, setSelectedModelElementId] = useState<
    string | null
  >(null);
  const [previewModelElementUpdates, setPreviewModelElementUpdates] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // Floor filter state
  const [floorNames, setFloorNames] = useState<string[]>([]);
  const [selectedFloor, setSelectedFloor] = useState("All");
  const floorMap = useRef<Map<string, string[]>>(new Map());
  const allFloorElementIds = useRef<string[]>([]);

  const { setSelectedElement, setBoqItems } = useViewerStore();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const loadModelElements = useCallback(async () => {
    try {
      const res = await fetch(
        `${apiUrl}/api/modeling/projects/${projectId}/elements`,
      );
      if (res.ok) {
        const elements = await res.json();
        setModelElements(elements);
        if (blankModelingMode) {
          setAllElements(elements);
        }
      }
    } catch (e) {
      console.warn("Could not fetch modeling elements", e);
    }
  }, [apiUrl, projectId, blankModelingMode]);

  const quickCreateElement = useCallback(
    async (type: string) => {
      if (!blankModelingMode) return;
      const elementCount = modelElements.length + 1;
      const payload = {
        type,
        name: `${type}_${String(elementCount).padStart(3, "0")}`,
        geometry: {
          position: [
            ((elementCount - 1) % 6) * 2 - 5,
            type === "Slab" ? 0.15 : 1.5,
            Math.floor((elementCount - 1) / 6) * 2 - 5,
          ],
        },
        parameters:
          type === "Wall"
            ? {
                source: "top-model-toolbar",
                height: 3,
                thickness: 0.23,
              }
            : type === "Door" || type === "Window" || type === "Opening"
              ? {
                  source: "top-model-toolbar",
                  host_wall_id:
                    modelElements.find((el) => el.type === "Wall")?.id || null,
                  offset: 1.5,
                }
              : { source: "top-model-toolbar" },
      };
      const res = await fetch(
        `${apiUrl}/api/modeling/projects/${projectId}/elements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        await loadModelElements();
      }
    },
    [apiUrl, projectId, modelElements.length, loadModelElements],
  );

  const selectBlankElement = useCallback(
    (elementId: string) => {
      const el = modelElements.find((item) => item.id === elementId);
      if (!el) return;
      setSelectedModelElementId(elementId);
      setSelectedElement({
        global_id: el.id,
        ifc_type: el.type,
        name: el.name || el.id,
        properties: {
          "Model Element ID": el.id,
          Type: el.type,
          Position: JSON.stringify(el.geometry?.position || [0, 0, 0]),
          ...(el.parameters || {}),
        },
      });
    },
    [modelElements, setSelectedElement],
  );

  const toggleBlankVisibility = useCallback(
    (ids: string[], visible: boolean) => {
      setHiddenModelElementIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => {
          if (visible) next.delete(id);
          else next.add(id);
        });
        return next;
      });
    },
    [],
  );

  // Explode logic
  const applyExplode = useCallback((factor: number) => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const objects = viewer.scene.objects;
    const entityIds = Object.keys(objects);
    if (entityIds.length === 0) return;

    // Reset all positions
    entityIds.forEach((id) => {
      objects[id].position = [0, 0, 0];
      objects[id].dirty = true;
    });
    if (factor === 0) return;

    // Model centre from overall AABB
    const model = viewer.scene.models["main-model"];
    if (!model || !model.aabb) return;
    const aabb = model.aabb;
    const center = [
      (aabb[0] + aabb[3]) / 2,
      (aabb[1] + aabb[4]) / 2,
      (aabb[2] + aabb[5]) / 2,
    ];

    const modelSize = Math.max(
      aabb[3] - aabb[0],
      aabb[4] - aabb[1],
      aabb[5] - aabb[2],
    );
    const maxDistance = modelSize * 0.02 * factor;

    entityIds.forEach((id) => {
      const entity = objects[id];
      const mat = entity.worldMatrix;
      if (!mat) return;
      const ec = [mat[12], mat[13], mat[14]];
      const dir = [ec[0] - center[0], ec[1] - center[1], ec[2] - center[2]];
      const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
      if (len < 1e-6) return;
      const ndir = [dir[0] / len, dir[1] / len, dir[2] / len];
      entity.position = [
        ndir[0] * maxDistance,
        ndir[1] * maxDistance,
        ndir[2] * maxDistance,
      ];
    });
    // No requestRender needed – xeokit auto‑updates
  }, []);

  const handleExplodeChange = useCallback(
    (val: number) => {
      setExplodeFactor(val);
      applyExplode(val);
    },
    [applyExplode],
  );

  // Floor filter logic
  const extractFloorMap = useCallback((hierarchyData: any) => {
    const map = new Map<string, string[]>();
    const allIds: string[] = [];

    const collectLeafIds = (node: any, bucket: string[]) => {
      if (!node) return;
      if (!node.children || node.children.length === 0) {
        if (node.id) bucket.push(node.id);
        return;
      }
      node.children.forEach((c: any) => collectLeafIds(c, bucket));
    };

    function traverse(node: any) {
      if (!node) return;
      if (node.type === "IfcBuildingStorey") {
        const guids: string[] = [];
        node.children?.forEach((child: any) => collectLeafIds(child, guids));
        map.set(node.name || node.id, guids);
        guids.forEach((g) => allIds.push(g));
      } else if (node.children) {
        node.children.forEach(traverse);
      }
    }
    traverse(hierarchyData);

    floorMap.current = map;
    allFloorElementIds.current = allIds;
    setFloorNames(Array.from(map.keys()));
  }, []);

  const handleFloorChange = useCallback((floor: string) => {
    setSelectedFloor(floor);
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;
    const objects = viewer.scene.objects;

    const mappedAll = allFloorElementIds.current.filter((g) => !!objects[g]);
    if (mappedAll.length === 0) return;

    if (floor === "All") {
      mappedAll.forEach((g) => {
        objects[g].visible = true;
      });
    } else {
      const floorIds = (floorMap.current.get(floor) || []).filter(
        (g) => !!objects[g],
      );
      if (floorIds.length === 0) return;
      mappedAll.forEach((g) => {
        objects[g].visible = floorIds.includes(g);
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    let viewer: Viewer | null = null;

    const init = async () => {
      if (!canvasRef.current || viewerRef.current) return;

      try {
        viewer = new Viewer({
          canvasElement: canvasRef.current!,
          transparent: false,
          backgroundColor: [0.03, 0.03, 0.07, 1],
        });
        viewerRef.current = viewer;
        (window as any).__viewer = viewer;

        // Enable PBR
        viewer.scene.pbrEnabled = true;

        // PBR-friendly lights
        new AmbientLight(viewer.scene, {
          color: [0.3, 0.3, 0.3],
          intensity: 0.5,
        });
        new DirLight(viewer.scene, {
          dir: [0.8, -0.6, -0.8],
          color: [1.0, 1.0, 0.95],
          intensity: 1.2,
          space: "world",
        });
        new DirLight(viewer.scene, {
          dir: [-0.8, -0.4, 0.4],
          color: [0.9, 0.95, 1.0],
          intensity: 0.6,
          space: "world",
        });

        viewer.camera.eye = [-10, 10, -10];
        viewer.camera.look = [0, 0, 0];
        viewer.camera.up = [0, 1, 0];

        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

        // Fetch project data
        const res = await fetch(`${apiUrl}/api/projects/${projectId}`);
        if (!res.ok) throw new Error("Failed to fetch project");
        const data = await res.json();
        if (!active || !viewer) return;

        setHierarchy(data.hierarchy);
        setBlankModelingMode(!data.viewer_file);
        if (!data.viewer_file) {
          await loadModelElements();
        }

        // Extract floors from hierarchy
        if (data.hierarchy) {
          extractFloorMap(data.hierarchy);
        }

        // Fetch elements for type tree
        try {
          const elemRes = await fetch(`${apiUrl}/api/elements/${projectId}`);
          if (elemRes.ok) setAllElements(await elemRes.json());
        } catch (e) {
          console.warn("Could not fetch elements", e);
        }

        // Fetch BOQ data
        try {
          const boqRes = await fetch(
            `${apiUrl}/api/projects/${projectId}/boq-summary`,
          );
          if (boqRes.ok) setBoqItems(await boqRes.json());
        } catch (e) {
          console.warn("Could not fetch BOQ", e);
        }

        // Load 3D model
        if (data.status === "ready" && data.viewer_file) {
          try {
            const viewerUrlRes = await fetch(
              `${apiUrl}/api/projects/${projectId}/viewer-url`,
            );
            if (!viewerUrlRes.ok) throw new Error("Failed to fetch viewer URL");
            const { url } = await viewerUrlRes.json();

            const absoluteUrl = url.startsWith("http")
              ? url
              : `${apiUrl}${url}`;
            const isGLB =
              absoluteUrl.endsWith(".glb") || absoluteUrl.endsWith(".gltf");
            const isXKT = absoluteUrl.endsWith(".xkt");

            if (isGLB) {
              const gltfLoader = new GLTFLoaderPlugin(viewer);
              const model = gltfLoader.load({
                id: "main-model",
                src: absoluteUrl,
                edges: true,
                splitMeshes: true,
                pbrEnabled: true,
              });
              model.on("loaded", () => {
                if (!active || !viewer) return;

                const aabb = model.aabb;
                console.log("Model AABB:", JSON.stringify(aabb));

                if (aabb && aabb.length === 6) {
                  viewer.cameraFlight.jumpTo(aabb);
                } else {
                  viewer.cameraFlight.jumpTo(model);
                }

                if (
                  !data.hierarchy ||
                  (data.hierarchy.children &&
                    data.hierarchy.children.length === 0)
                ) {
                  const meshTree: any = {
                    id: "root",
                    name: data?.name || "Model",
                    type: "Project",
                    children: [],
                  };
                  const typeMap: Record<string, any[]> = {};

                  const modelEntities = Object.values(
                    viewer.scene.objects,
                  ).filter(
                    (entity: any) => entity.modelId === model.id,
                  ) as any[];

                  for (const entity of modelEntities) {
                    const entityId = entity.id;
                    const type = entity.is_a?.() || "Part";
                    if (!typeMap[type]) typeMap[type] = [];
                    typeMap[type].push({
                      id: entityId,
                      name: entityId,
                      type: type,
                      children: [],
                    });
                  }

                  for (const [type, items] of Object.entries(typeMap)) {
                    meshTree.children.push({
                      id: `group-${type}`,
                      name: `${type} (${items.length})`,
                      type: "Group",
                      children: items,
                    });
                  }

                  setAllElements(Object.values(viewer.scene.objects));
                  if (
                    !data.hierarchy ||
                    data.hierarchy?.children?.length === 0
                  ) {
                    setHierarchy(meshTree);
                  }
                }

                setLoading(false);
              });
            } else if (isXKT) {
              const xktLoader = new XKTLoaderPlugin(viewer);
              const model = xktLoader.load({
                id: "main-model",
                src: absoluteUrl,
                edges: true,
              });
              model.on("loaded", () => {
                if (active && viewer) {
                  viewer.cameraFlight.jumpTo(model);
                  setLoading(false);
                }
              });
            } else {
              console.error("Unsupported viewer file format");
              setLoading(false);
            }
          } catch (err) {
            console.error("Viewer loading error:", err);
            setLoading(false);
          }
        } else {
          setLoading(false);
        }

        const resolvePickObjectId = (pick: any): string | null => {
          const rawId = pick?.entity?.id;
          if (!rawId) return null;
          if (viewer?.scene.models[rawId]) return null; // ignore model root
          if (!viewer?.scene.objects[rawId]) return null; // only leaf object IDs
          return rawId;
        };

        // Hover
        viewer.cameraControl.on("hover", (pick: any) => {
          if (!viewer) return;
          viewer.scene.setObjectsHighlighted(
            viewer.scene.highlightedObjectIds,
            false,
          );
          const objectId = resolvePickObjectId(pick);
          if (objectId) {
            viewer.scene.setObjectsHighlighted([objectId], true);
          }
        });

        // Pick → update Zustand store with fallback for non-BIM
        viewer.cameraControl.on("picked", async (pick: any) => {
          if (!viewer || !active) return;
          viewer.scene.setObjectsSelected(
            viewer.scene.selectedObjectIds,
            false,
          );
          const entityId = resolvePickObjectId(pick);
          if (entityId) {
            viewer.scene.setObjectsSelected([entityId], true);

            try {
              const propRes = await fetch(
                `${apiUrl}/api/elements/${projectId}/${entityId}`,
              );
              if (propRes.ok) {
                const el = await propRes.json();
                setSelectedElement(el as SelectedElement);
              } else {
                // Non-BIM fallback
                setSelectedElement({
                  global_id: entityId,
                  ifc_type: pick.entity.is_a?.() || "Mesh",
                  name: entityId,
                  properties: {
                    "Mesh Name": entityId,
                    Vertices: pick.entity.numTriangles
                      ? pick.entity.numTriangles * 3
                      : "N/A",
                    Material: pick.entity.material?.name || "Default",
                    "Model Type": "Non‑BIM 3D Model",
                  },
                });
              }
            } catch {
              setSelectedElement(null);
            }
          } else {
            setSelectedElement(null);
          }
        });
      } catch (err) {
        console.error("Viewer init error:", err);
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
  }, [
    projectId,
    setSelectedElement,
    setBoqItems,
    extractFloorMap,
    loadModelElements,
  ]);

  const hasFloors = floorNames.length > 0;
  const selectedModelElement =
    modelElements.find((el) => el.id === selectedModelElementId) || null;

  const updateModelElement = useCallback(
    async (elementId: string, payload: Record<string, unknown>) => {
      const res = await fetch(
        `${apiUrl}/api/modeling/projects/${projectId}/elements/${elementId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        await loadModelElements();
      }
    },
    [apiUrl, projectId, loadModelElements],
  );

  const previewModelElement = useCallback(
    (elementId: string, payload: Record<string, unknown>) => {
      setPreviewModelElementUpdates((prev) => ({
        ...prev,
        [elementId]: payload,
      }));
    },
    [],
  );

  const clearPreviewModelElement = useCallback((elementId: string) => {
    setPreviewModelElementUpdates((prev) => {
      const next = { ...prev };
      delete next[elementId];
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0d0e1a] text-white overflow-hidden">
      {/* 1. Ribbon */}
      <Ribbon
        floorNames={floorNames}
        selectedFloor={selectedFloor}
        onFloorChange={handleFloorChange}
        hasFloors={hasFloors}
        onQuickCreate={quickCreateElement}
        modelingEnabled={blankModelingMode}
      />

      {/* 2. Main area: Left + Center + Right */}
      <div className="flex-1 flex min-h-0">
        <LeftPanel
          hierarchy={hierarchy}
          allElements={allElements}
          viewerRef={viewerRef}
          projectId={projectId}
          blankModelingMode={blankModelingMode}
          onSelectBlankElement={selectBlankElement}
          onToggleBlankVisibility={toggleBlankVisibility}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Viewport
            canvasRef={canvasRef}
            viewerRef={viewerRef}
            loading={loading}
            explodeFactor={explodeFactor}
            onExplodeChange={handleExplodeChange}
            hasFloors={hasFloors}
            blankModelingMode={blankModelingMode}
            modelElements={modelElements}
            hiddenModelElementIds={hiddenModelElementIds}
            selectedModelElementId={selectedModelElementId}
            onSelectModelElement={selectBlankElement}
            onUpdateModelElement={updateModelElement}
            previewModelElementUpdates={previewModelElementUpdates}
          />
          <BottomPanel
            projectId={projectId}
            viewerRef={viewerRef}
            allElements={allElements}
          />
        </div>

        <RightPanel
          projectId={projectId}
          onModelingChanged={loadModelElements}
          selectedModelElement={selectedModelElement}
          onUpdateModelElement={updateModelElement}
          onPreviewModelElement={previewModelElement}
          onClearPreviewModelElement={clearPreviewModelElement}
        />
      </div>
    </div>
  );
}
