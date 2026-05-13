"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  DEFAULT_FLOOR_HEIGHT_MM,
  FT_TO_MM,
  Level,
  MM_TO_CANVAS,
  SLAB_THICKNESS_MM,
} from "@/types/modeling";
import { mmToFeetInches, mmToMeters, metersToMM } from "@/lib/calculations";

interface LevelPanelProps {
  projectId: string;
  levels: Level[];
  activeLevelId: string | null;
  onLevelSelect: (levelId: string) => void;
  onLevelsChange: (levels: Level[]) => void;
}

const sortLevels = (levels: Level[]) => [...levels].sort((a, b) => a.order - b.order);

const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function LevelPanel({
  projectId,
  levels,
  activeLevelId,
  onLevelSelect,
  onLevelsChange,
}: LevelPanelProps) {
  const [unit, setUnit] = useState<"mm" | "ft">("mm");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingElevationId, setEditingElevationId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftElevation, setDraftElevation] = useState<number>(0);
  const [dragId, setDragId] = useState<string | null>(null);

  const orderedLevels = useMemo(() => sortLevels(levels), [levels]);
  const highestMM = orderedLevels.length
    ? Math.max(...orderedLevels.map((level) => level.elevation_mm))
    : 0;

  const updateLevel = async (levelId: string, payload: Partial<Level>) => {
    const response = await fetch(`/api/projects/${projectId}/levels/${levelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    const updated = await response.json();
    const nextLevels = orderedLevels.map((level) =>
      level.id === levelId
        ? {
            ...level,
            ...updated,
            projectId: updated.projectId ?? updated.project_id ?? level.projectId,
            elevation_mm: metersToMM(updated.elevation_m ?? level.elevation_m),
          }
        : level,
    );
    onLevelsChange(sortLevels(nextLevels));
  };

  const handleAddLevel = async () => {
    const nextOrder = orderedLevels.length;
    const elevationMM = highestMM + DEFAULT_FLOOR_HEIGHT_MM;
    const response = await fetch(`/api/projects/${projectId}/levels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Level ${nextOrder}`,
        elevation_m: mmToMeters(elevationMM),
        order: nextOrder,
      }),
    });
    if (!response.ok) return;
    const created = await response.json();
    const newLevel: Level = {
      ...created,
      projectId: created.projectId ?? created.project_id,
      elevation_mm: metersToMM(created.elevation_m),
      color: created.color ?? palette[nextOrder % palette.length],
    };
    const nextLevels = sortLevels([...orderedLevels, newLevel]).map((level, index) => ({
      ...level,
      order: index,
      color: level.color || palette[index % palette.length],
    }));
    onLevelsChange(nextLevels);
    setEditingNameId(newLevel.id);
    setDraftName(newLevel.name);
    onLevelSelect(newLevel.id);
  };

  const handleDeleteLevel = async (level: Level) => {
    if (orderedLevels.length <= 1) {
      alert("Cannot delete the last level.");
      return;
    }
    const fallback = orderedLevels[0];
    const confirmed = window.confirm(
      `Delete ${level.name}? Elements on this level will be reassigned to ${fallback.name}.`,
    );
    if (!confirmed) return;
    const response = await fetch(`/api/projects/${projectId}/levels/${level.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    const next = orderedLevels.filter((item) => item.id !== level.id).map((item, order) => ({
      ...item,
      order,
    }));
    onLevelsChange(next);
    if (activeLevelId === level.id && next[0]) onLevelSelect(next[0].id);
  };

  const startNameEdit = (level: Level) => {
    setEditingNameId(level.id);
    setDraftName(level.name);
  };

  const saveName = async (level: Level) => {
    setEditingNameId(null);
    if (!draftName.trim() || draftName.trim() === level.name) return;
    await updateLevel(level.id, { name: draftName.trim() });
  };

  const startElevationEdit = (level: Level) => {
    setEditingElevationId(level.id);
    setDraftElevation(level.elevation_mm);
  };

  const saveElevation = async (level: Level) => {
    setEditingElevationId(null);
    const nextMM = Math.max(0, Math.round(draftElevation));
    if (orderedLevels.some((item) => item.id !== level.id && item.elevation_mm === nextMM)) {
      alert("Two levels cannot share the same elevation.");
      return;
    }
    await updateLevel(level.id, { elevation_m: mmToMeters(nextMM) });
    const locallySorted = sortLevels(
      orderedLevels.map((item) =>
        item.id === level.id
          ? { ...item, elevation_mm: nextMM, elevation_m: mmToMeters(nextMM) }
          : item,
      ),
    ).map((item, order) => ({ ...item, order }));
    onLevelsChange(locallySorted);
  };

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const sourceIndex = orderedLevels.findIndex((level) => level.id === dragId);
    const targetIndex = orderedLevels.findIndex((level) => level.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const reordered = [...orderedLevels];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const normalized = reordered.map((level, order) => ({ ...level, order }));
    onLevelsChange(normalized);
    await Promise.all(
      normalized.map((level) =>
        fetch(`/api/projects/${projectId}/levels/${level.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: level.order }),
        }),
      ),
    );
    setDragId(null);
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Levels</h3>
        <button
          type="button"
          onClick={() => setUnit((prev) => (prev === "mm" ? "ft" : "mm"))}
          className="text-xs text-slate-300 border border-slate-600 rounded px-2 py-1"
        >
          {unit === "mm" ? "mm / ft" : "ft / mm"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleAddLevel}
        className="w-full mb-3 rounded border border-slate-600 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
      >
        + Add Level
      </button>

      <div className="space-y-2">
        {orderedLevels.map((level) => {
          const isActive = activeLevelId === level.id;
          return (
            <div
              key={level.id}
              draggable
              onDragStart={() => setDragId(level.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(level.id)}
              onClick={() => onLevelSelect(level.id)}
              className={`group rounded border px-2 py-2 cursor-pointer ${
                isActive ? "border-blue-500 bg-slate-800" : "border-slate-700 bg-slate-900"
              }`}
              style={{ borderLeftWidth: isActive ? 3 : 1 }}
            >
              <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill={isActive ? "#1d4ed8" : "white"}
                    stroke="#1d4ed8"
                    strokeWidth="1.5"
                  />
                  {!isActive && <path d="M12 2 A10 10 0 0 1 12 22 Z" fill="#1d4ed8" />}
                </svg>
                <div className="flex-1 border-b border-dashed border-slate-600 pb-1">
                  {editingNameId === level.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => saveName(level)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveName(level);
                      }}
                      className="w-full bg-slate-950 border border-slate-600 rounded px-1 py-0.5 text-xs text-white"
                    />
                  ) : (
                    <div onDoubleClick={() => startNameEdit(level)} className="text-xs text-white">
                      {level.name}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-300">
                  {editingElevationId === level.id ? (
                    <input
                      autoFocus
                      type="number"
                      value={draftElevation}
                      onChange={(event) => setDraftElevation(Number(event.target.value))}
                      onBlur={() => saveElevation(level)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveElevation(level);
                      }}
                      className="w-20 bg-slate-950 border border-slate-600 rounded px-1 py-0.5 text-xs text-white"
                    />
                  ) : (
                    <button type="button" onClick={() => startElevationEdit(level)}>
                      {unit === "mm" ? `${level.elevation_mm} mm` : mmToFeetInches(level.elevation_mm)}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteLevel(level);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <svg
        width="100%"
        height={Math.max(orderedLevels.length * 80, 240)}
        viewBox={`0 0 280 ${Math.max(orderedLevels.length * 80, 240)}`}
        className="mt-4 rounded bg-slate-950"
      >
        {orderedLevels.map((level, index) => {
          const height = Math.max(orderedLevels.length * 80, 240);
          const ratio = highestMM > 0 ? level.elevation_mm / highestMM : 0;
          const y = height - 30 - ratio * (height - 60);
          const isActive = activeLevelId === level.id;
          const next = orderedLevels[index + 1];
          return (
            <g key={level.id}>
              {next && (
                <rect
                  x={20}
                  y={y - SLAB_THICKNESS_MM / MM_TO_CANVAS}
                  width={200}
                  height={SLAB_THICKNESS_MM / MM_TO_CANVAS}
                  fill="#94a3b8"
                  opacity={0.2}
                />
              )}
              <line
                x1={20}
                y1={y}
                x2={220}
                y2={y}
                stroke={isActive ? "#3b82f6" : "#94a3b8"}
                strokeWidth={isActive ? 2 : 1.5}
                strokeDasharray={isActive ? "0" : "6 4"}
              />
              <g transform={`translate(228 ${y - 12})`}>
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill={isActive ? "#1d4ed8" : "white"}
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                />
                {!isActive && <path d="M12 2 A10 10 0 0 1 12 22 Z" fill="#1d4ed8" />}
                <text
                  x="12"
                  y="16"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="500"
                  fill={isActive ? "white" : "#1d4ed8"}
                >
                  L{level.order}
                </text>
              </g>
              <text x={20} y={y - 6} fill="#cbd5e1" fontSize="10">
                {level.name}
              </text>
              <text x={254} y={y + 4} fill="#cbd5e1" fontSize="10">
                {unit === "mm" ? `${level.elevation_mm}` : `${(level.elevation_mm / FT_TO_MM).toFixed(1)}ft`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
