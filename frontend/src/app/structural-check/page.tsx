"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Sigma } from "lucide-react";

type Project = { id: string; name: string; status: string };

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function StructuralCheckPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [payload, setPayload] = useState(
    JSON.stringify(
      {
        use_auto_grid: true,
        load_factor_dead: 1.5,
        load_factor_live: 1.5,
        tasks: [
          { id: "beam_B1", type: "beam_load_check", demand: 210, capacity: 260 },
          { id: "column_C7", type: "column_load_check", demand: 880, capacity: 820 },
          { id: "beam_defl", type: "deflection_warning", demand: 0.024, capacity: 1.0, limit: 0.02 },
          { id: "combo_uls", type: "load_combination", demand: 1.62, capacity: 1.7 },
        ],
      },
      null,
      2,
    ),
  );
  const [result, setResult] = useState<any>(null);
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

  const runStructural = async () => {
    if (!projectId) return;
    setMsg("");
    try {
      const parsed = JSON.parse(payload);
      const r = await fetch(`${apiBase()}/api/projects/${projectId}/structural-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Structural check failed");
      setResult(d);
      setMsg("Structural check completed");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Structural check failed");
    }
  };

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-teal-300"> Structural Module</div>
      </header>
      <section className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
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
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={18}
            className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono"
          />
          <button onClick={runStructural} className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> Run Structural Check
          </button>
          <p className="text-xs text-white/50">{msg}</p>
        </aside>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Sigma className="w-4 h-4" /> Structural results
          </div>
          {!result ? (
            <div className="text-sm text-white/40">Run structural checks.</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm">Grid: X {result.grid?.x_grids} / Y {result.grid?.y_grids}</div>
              <div className="text-sm">Load combos: {(result.load_combinations || []).map((c: any) => `${c.name}(${c.factor_sum})`).join(", ")}</div>
              <div className="overflow-auto max-h-[560px] border border-white/10 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-black/25">
                    <tr>
                      <th className="p-3 text-left">ID</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Demand</th>
                      <th className="p-3 text-left">Capacity</th>
                      <th className="p-3 text-left">Ratio</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.checks || []).map((c: any) => (
                      <tr key={c.id} className="border-t border-white/10">
                        <td className="p-3">{c.id}</td>
                        <td className="p-3">{c.type}</td>
                        <td className="p-3">{c.demand}</td>
                        <td className="p-3">{c.capacity}</td>
                        <td className="p-3">{c.ratio}</td>
                        <td className={`p-3 ${c.status === "warning" ? "text-red-300" : "text-emerald-300"}`}>{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

