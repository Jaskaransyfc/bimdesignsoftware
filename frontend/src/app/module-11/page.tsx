"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileDown,
  FileImage,
  FileText,
  Loader2,
  Map,
  Maximize2,
  Palette,
  PanelTopOpen,
  Ruler,
  Sparkles,
  SquareDashed,
  Triangle,
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  status: string;
  created_at: string;
};

type ViewMode = "plan" | "section" | "elevation";

const apiBase = () => {
  const value = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

export default function Module11Page() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [cutPlaneOrigin, setCutPlaneOrigin] = useState("0,0,0");
  const [cutPlaneDirection, setCutPlaneDirection] = useState("0,0,1");
  const [elevationDirection, setElevationDirection] = useState("1,0,0");
  const [error, setError] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem("userEmail");
    if (!savedEmail) {
      router.push("/login");
      return;
    }

    fetch(`${apiBase()}/api/projects/`)
      .then((response) => response.json())
      .then((data) => {
        const sorted = Array.isArray(data)
          ? [...data].sort((a, b) =>
              String(b.created_at || "").localeCompare(
                String(a.created_at || ""),
              ),
            )
          : [];
        setProjects(sorted);
        setSelectedProjectId((current) => current || sorted[0]?.id || "");
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError("Unable to load projects from the backend.");
      });
  }, [router]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const previewKey = useMemo(
    () =>
      [
        selectedProjectId,
        viewMode,
        cutPlaneOrigin,
        cutPlaneDirection,
        elevationDirection,
      ].join("|"),
    [
      selectedProjectId,
      viewMode,
      cutPlaneOrigin,
      cutPlaneDirection,
      elevationDirection,
    ],
  );

  const previewUrl = useMemo(() => {
    if (!selectedProjectId) return "";
    const base = apiBase();
    if (viewMode === "plan") {
      return `${base}/api/projects/${selectedProjectId}/plan-view.svg`;
    }
    if (viewMode === "section") {
      const origin = encodeURIComponent(cutPlaneOrigin);
      const direction = encodeURIComponent(cutPlaneDirection);
      return `${base}/api/projects/${selectedProjectId}/section-view.svg?cut_plane_origin=${origin}&cut_plane_direction=${direction}`;
    }
    const direction = encodeURIComponent(elevationDirection);
    return `${base}/api/projects/${selectedProjectId}/elevation-view.svg?elevation_direction=${direction}`;
  }, [
    selectedProjectId,
    viewMode,
    cutPlaneOrigin,
    cutPlaneDirection,
    elevationDirection,
  ]);

  const dxfUrl = useMemo(() => {
    if (!selectedProjectId) return "";
    return `${apiBase()}/api/projects/${selectedProjectId}/plan-view.dxf`;
  }, [selectedProjectId]);

  const open3dUrl = selectedProjectId ? `/viewer/${selectedProjectId}` : "/";

  return (
    <main className="min-h-screen bg-[#090b14] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_rgba(10,11,20,0.1),_rgba(10,11,20,0.96))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

      <header className="relative z-10 border-b border-white/5 bg-[#090b14]/70 backdrop-blur-xl">
        <div className="max-w-[1480px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/45 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-full px-3 py-2">
            <PanelTopOpen className="w-4 h-4" />
            2d View Planner
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-[1480px] mx-auto px-6 md:px-10 py-8 md:py-10">
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center text-blue-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">
                    2D Floor Plan Engine
                  </h1>
                  <p className="text-xs text-white/40 uppercase tracking-[0.22em]">
                    Generate plans, sections, elevations
                  </p>
                </div>
              </div>

              <p className="text-sm text-white/60 leading-6 mb-5">
                Select a project and generate 2D outputs from the backend
                module. Plan, section, and elevation views are available as SVG,
                with DXF export for CAD workflows.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/35 mb-2">
                    Open source stack
                  </div>
                  <div className="space-y-2 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      <SquareDashed className="w-4 h-4 text-blue-300" /> Open
                      CASCADE
                    </div>
                    <div className="flex items-center gap-2">
                      <Triangle className="w-4 h-4 text-cyan-300" /> trimesh +
                      shapely
                    </div>
                    <div className="flex items-center gap-2">
                      <FileImage className="w-4 h-4 text-sky-300" /> SVG
                      renderer
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-300" /> ezdxf
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/35 mb-2">
                    What it supports
                  </div>
                  <div className="space-y-2 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      <Map className="w-4 h-4 text-amber-300" /> Cut lines
                    </div>
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-fuchsia-300" /> Wall
                      hatches
                    </div>
                    <div className="flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-orange-300" /> Dimensions
                    </div>
                    <div className="flex items-center gap-2">
                      <Maximize2 className="w-4 h-4 text-indigo-300" /> Section
                      / elevation
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.03] backdrop-blur-xl p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.24em] text-white/40">
                    Project
                  </h2>
                  <p className="text-xs text-white/35 mt-1">
                    Choose the source model for 2D generation
                  </p>
                </div>
                {selectedProject && (
                  <Link
                    href={`/viewer/${selectedProject.id}`}
                    className="inline-flex items-center gap-2 text-xs font-bold text-blue-300 hover:text-blue-200 transition-colors"
                  >
                    Open 3D <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <label className="block text-[10px] font-black text-white/35 uppercase tracking-[0.24em] mb-2">
                Source model
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400/50 transition-colors"
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/70">
                {selectedProject ? (
                  <>
                    <div className="font-semibold text-white">
                      {selectedProject.name}
                    </div>
                    <div className="mt-2 space-y-1 text-white/45 text-xs">
                      <div>Client: {selectedProject.client_name || "—"}</div>
                      <div>Location: {selectedProject.location || "—"}</div>
                      <div>Status: {selectedProject.status}</div>
                    </div>
                  </>
                ) : loading ? (
                  <div className="flex items-center gap-2 text-white/45">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading
                    projects…
                  </div>
                ) : (
                  <div>No project selected yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.03] backdrop-blur-xl p-6">
              <h2 className="text-sm font-black uppercase tracking-[0.24em] text-white/40 mb-4">
                View mode
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "plan", label: "Plan", icon: Map },
                    { key: "section", label: "Section", icon: Maximize2 },
                    { key: "elevation", label: "Elevation", icon: FileImage },
                  ] as const
                ).map((mode) => {
                  const Icon = mode.icon;
                  const active = viewMode === mode.key;
                  return (
                    <button
                      key={mode.key}
                      onClick={() => setViewMode(mode.key)}
                      className={`rounded-2xl border px-3 py-3 text-left transition-all ${active ? "bg-blue-500/15 border-blue-400/30 text-blue-100" : "bg-black/20 border-white/8 text-white/55 hover:text-white hover:border-white/15"}`}
                    >
                      <Icon className="w-4 h-4 mb-3" />
                      <div className="text-xs font-bold uppercase tracking-wider">
                        {mode.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                {viewMode === "section" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-white/35 uppercase tracking-[0.24em] mb-2">
                        Cut plane origin
                      </label>
                      <input
                        value={cutPlaneOrigin}
                        onChange={(e) => setCutPlaneOrigin(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400/50 transition-colors"
                        placeholder="0,0,0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-white/35 uppercase tracking-[0.24em] mb-2">
                        Cut plane direction
                      </label>
                      <input
                        value={cutPlaneDirection}
                        onChange={(e) => setCutPlaneDirection(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400/50 transition-colors"
                        placeholder="0,0,1"
                      />
                    </div>
                  </>
                )}
                {viewMode === "elevation" && (
                  <div>
                    <label className="block text-[10px] font-black text-white/35 uppercase tracking-[0.24em] mb-2">
                      Elevation direction
                    </label>
                    <input
                      value={elevationDirection}
                      onChange={(e) => setElevationDirection(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400/50 transition-colors"
                      placeholder="1,0,0"
                    />
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] backdrop-blur-xl p-5 md:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight">
                    Live 2D Preview
                  </h2>
                  <p className="text-sm text-white/45 mt-1">
                    SVG output is rendered directly from the backend. DXF is
                    available for download.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Open SVG <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={dxfUrl}
                    download
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-blue-500 transition-colors"
                  >
                    Download DXF <FileDown className="w-3.5 h-3.5" />
                  </a>
                  {selectedProject && (
                    <Link
                      href={open3dUrl}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70 hover:text-white hover:border-white/20 transition-colors"
                    >
                      Open 3D <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : !selectedProjectId ? (
                <div className="min-h-[540px] rounded-[28px] border border-dashed border-white/10 bg-black/20 grid place-items-center text-center px-6">
                  <div>
                    <div className="mx-auto w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                      <FileImage className="w-7 h-7 text-white/25" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">
                      Pick a project to generate 2D views
                    </h3>
                    <p className="text-sm text-white/40 max-w-md">
                      Plan, section, elevation, cut lines, wall hatches, and
                      dimensions will appear here once a project is selected.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
                  <div className="min-h-[540px] rounded-[28px] overflow-hidden border border-white/10 bg-[#11131f] relative">
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                        {viewMode} view preview
                      </div>
                      <div className="text-[10px] text-white/30">
                        Refresh key {previewKey}
                      </div>
                    </div>
                    <iframe
                      key={`${previewUrl}-${previewKey}`}
                      src={previewUrl}
                      title={`${viewMode} preview`}
                      className="h-full w-full border-0 bg-white"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/35 mb-3">
                        Endpoint
                      </div>
                      <code className="block text-[11px] text-blue-200/90 break-all leading-5">
                        {previewUrl || "Select a project"}
                      </code>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/35 mb-3">
                        Delivery notes
                      </div>
                      <ul className="space-y-2 text-sm text-white/65 leading-6">
                        <li>
                          SVG is the primary preview format for plan, section,
                          and elevation.
                        </li>
                        <li>
                          DXF is exported from the same geometry pipeline for
                          CAD handoff.
                        </li>
                        <li>
                          On the backend, GLB slicing is used when mesh geometry
                          is available.
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/35 mb-3">
                        Project actions
                      </div>
                      <div className="space-y-2 text-sm">
                        <Link
                          href={`/viewer/${selectedProjectId}`}
                          className="block rounded-xl border border-white/8 px-4 py-3 hover:border-white/15 hover:bg-white/5 transition-colors"
                        >
                          Open model in 3D viewer
                        </Link>
                        <a
                          href={dxfUrl}
                          download
                          className="block rounded-xl border border-white/8 px-4 py-3 hover:border-white/15 hover:bg-white/5 transition-colors"
                        >
                          Download current plan DXF
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
