"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Play } from "lucide-react";

type Project = { id: string; name: string; status: string };
type ClashResult = {
  task_id: string;
  a_id: string;
  b_id: string;
  a_type: string;
  b_type: string;
  overlap: boolean;
  clearance_mm: number;
  min_required_mm: number;
};

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function Module16Page() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [payload, setPayload] = useState(
    JSON.stringify(
      {
        tasks: [
          { id: "duct_vs_beam", a_type: "Duct", b_type: "Beam", min_clearance_mm: 50 },
          { id: "pipe_vs_wall", a_type: "Pipe", b_type: "Wall", min_clearance_mm: 25 },
        ],
        elements: [
          { id: "duct-1", type: "Duct", min: [0, 2.5, 0], max: [4, 3, 0.5] },
          { id: "beam-1", type: "Beam", min: [2, 2.7, 0.2], max: [6, 3.2, 0.8] },
          { id: "pipe-1", type: "Pipe", min: [1, 1, 1], max: [1.2, 1.2, 4] },
          { id: "wall-1", type: "Wall", min: [0.9, 0, 3.8], max: [1.5, 3, 4.2] },
        ],
      },
      null,
      2,
    ),
  );
  const [clashes, setClashes] = useState<ClashResult[]>([]);
  const [checkedElements, setCheckedElements] = useState(0);
  const [msg, setMsg] = useState("");

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
      });
  }, [router]);

  const runClash = async () => {
    if (!projectId) return;
    setMsg("");
    try {
      const parsed = JSON.parse(payload);
      const res = await fetch(`${apiBase()}/api/projects/${projectId}/module-16/clashes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Clash run failed");
      setCheckedElements(Number(data.checked_elements || 0));
      setClashes(Array.isArray(data.clashes) ? data.clashes : []);
      setMsg("Clash detection complete");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Clash detection failed");
    }
  };

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-rose-300">Module 16 Clash Detection</div>
      </header>

      <section className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
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
          <div>
            <label className="text-xs text-white/60 block mb-2">User-defined clash tasks + element boxes (JSON)</label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={16}
              className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono"
            />
          </div>
          <button
            onClick={runClash}
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Run Module 16
          </button>
          <p className="text-xs text-white/50">{msg}</p>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <AlertTriangle className="w-4 h-4" /> Clash results ({clashes.length}) - checked elements: {checkedElements}
          </div>
          <div className="overflow-auto max-h-[760px] border border-white/10 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-black/25">
                <tr>
                  <th className="p-3 text-left">Task</th>
                  <th className="p-3 text-left">A</th>
                  <th className="p-3 text-left">B</th>
                  <th className="p-3 text-left">Overlap</th>
                  <th className="p-3 text-left">Clearance (mm)</th>
                  <th className="p-3 text-left">Required (mm)</th>
                </tr>
              </thead>
              <tbody>
                {clashes.map((c, i) => (
                  <tr key={`${c.task_id}-${c.a_id}-${c.b_id}-${i}`} className="border-t border-white/10">
                    <td className="p-3">{c.task_id}</td>
                    <td className="p-3">
                      {c.a_type} ({c.a_id})
                    </td>
                    <td className="p-3">
                      {c.b_type} ({c.b_id})
                    </td>
                    <td className="p-3">{c.overlap ? "Yes" : "No"}</td>
                    <td className="p-3">{c.clearance_mm}</td>
                    <td className="p-3">{c.min_required_mm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

