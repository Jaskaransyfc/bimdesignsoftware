"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText } from "lucide-react";

type Project = {
  id: string;
  name: string;
  status: string;
};

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function SheetExport() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [size, setSize] = useState("A3");
  const [title, setTitle] = useState("Submission Sheet");
  const [drawingNumber, setDrawingNumber] = useState("A-101");
  const [revision, setRevision] = useState("R0");
  const [view, setView] = useState("plan");

  useEffect(() => {
    const user = localStorage.getItem("userEmail");
    if (!user) {
      router.push("/login");
      return;
    }
    fetch(`${apiBase()}/api/projects/`)
      .then((r) => r.json())
      .then((data) => {
        const ready = (Array.isArray(data) ? data : []).filter((p) => p.status === "ready");
        setProjects(ready);
        if (ready[0]?.id) setProjectId(ready[0].id);
      })
      .catch(() => setProjects([]));
  }, [router]);

  const qs = useMemo(() => {
    const q = new URLSearchParams({
      size,
      title,
      drawing_number: drawingNumber,
      revision,
      view,
    });
    return q.toString();
  }, [size, title, drawingNumber, revision, view]);

  const sheetSvgUrl = projectId ? `${apiBase()}/api/projects/${projectId}/sheet.svg?${qs}` : "";
  const sheetPdfUrl = projectId ? `${apiBase()}/api/projects/${projectId}/sheet.pdf?${qs}` : "";
  const sheetDxfUrl = projectId ? `${apiBase()}/api/projects/${projectId}/sheet.dxf` : "";

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-emerald-300">Sheet / Drawing Export</div>
      </header>

      <section className="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <label className="text-xs text-white/60 block mb-2">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 block mb-2">Sheet size</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="A3">A3</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-2">View</label>
              <select
                value={view}
                onChange={(e) => setView(e.target.value)}
                className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
              >
                <option value="plan">Plan</option>
                <option value="section">Section</option>
                <option value="elevation">Elevation</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-2">Title block title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 block mb-2">Drawing no.</label>
              <input
                value={drawingNumber}
                onChange={(e) => setDrawingNumber(e.target.value)}
                className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-2">Revision</label>
              <input
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <a
              href={sheetSvgUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-xl border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-white/10"
            >
              Open SVG <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href={sheetPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
            >
              Export PDF <FileText className="w-4 h-4" />
            </a>
            <a
              href={sheetDxfUrl}
              download
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
            >
              Export DXF <Download className="w-4 h-4" />
            </a>
          </div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          {!projectId ? (
            <div className="h-[780px] grid place-items-center text-white/40">Select a project to generate sheet.</div>
          ) : (
            <iframe key={sheetSvgUrl} src={sheetSvgUrl} className="w-full h-[780px] bg-white" title="Sheet preview" />
          )}
        </section>
      </section>
    </main>
  );
}

