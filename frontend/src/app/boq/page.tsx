"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, Play } from "lucide-react";

type Project = { id: string; name: string; status: string };
type QuantityItem = { id: string; value?: number; unit?: string; source?: string; error?: string };

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function QuantityTakeoffPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState(
    JSON.stringify(
      [
        { id: "custom_wall_formula", formula: "wall_area * 2 - opening_area", unit: "m2" },
        { id: "india_plaster_plus_paint", formula: "paint_area + plaster_area", unit: "m2" },
      ],
      null,
      2,
    ),
  );
  const [items, setItems] = useState<QuantityItem[]>([]);
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

  const runTakeoff = async () => {
    if (!projectId) return;
    setMsg("");
    try {
      const parsed = JSON.parse(tasks);
      const res = await fetch(`${apiBase()}/api/projects/${projectId}/quantity-takeoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Takeoff failed");
      setItems(data.items || []);
      setMsg("Takeoff generated successfully");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error running takeoff");
    }
  };

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-orange-300"> BOQ / Quantity Takeoff</div>
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
            <label className="text-xs text-white/60 block mb-2">User-defined quantity tasks (JSON)</label>
            <textarea
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              rows={12}
              className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono"
            />
          </div>
          <button
            onClick={runTakeoff}
            className="w-full rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Run 
          </button>
          <p className="text-xs text-white/50">{msg}</p>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Calculator className="w-4 h-4" /> Quantity results
          </div>
          <div className="overflow-auto max-h-[760px] border border-white/10 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-black/25">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">Value</th>
                  <th className="text-left p-3">Unit</th>
                  <th className="text-left p-3">Source</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-white/10">
                    <td className="p-3">{it.id}</td>
                    <td className="p-3">{typeof it.value === "number" ? it.value : "—"}</td>
                    <td className="p-3">{it.unit || "—"}</td>
                    <td className="p-3">{it.source || "—"}</td>
                    <td className="p-3">{it.error ? <span className="text-red-300">{it.error}</span> : "ok"}</td>
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

