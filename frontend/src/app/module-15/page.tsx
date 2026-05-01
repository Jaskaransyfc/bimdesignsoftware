"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, IndianRupee, Play } from "lucide-react";

type Project = { id: string; name: string; status: string };

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function Module15Page() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [payload, setPayload] = useState(
    JSON.stringify(
      {
        mismatch_threshold_percent: 10,
        mappings: [
          {
            quantity_id: "wall_volume",
            sor_code: "CPWD-5.2.1",
            description: "Brick masonry in CM 1:6",
            unit: "m3",
            sor_rate: 6200,
            contractor_rate: 7000,
          },
          {
            quantity_id: "paint_area",
            sor_code: "CPWD-13.47",
            description: "Interior emulsion paint",
            unit: "m2",
            sor_rate: 145,
            contractor_rate: 132,
          },
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

  const runCosting = async () => {
    if (!projectId) return;
    setMsg("");
    try {
      const parsed = JSON.parse(payload);
      const res = await fetch(`${apiBase()}/api/projects/${projectId}/module-15/costing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Costing failed");
      setResult(data);
      setMsg("Module 15 costing generated");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Costing failed");
    }
  };

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-lime-300">Module 15 Indian SOR / Costing</div>
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
            <label className="text-xs text-white/60 block mb-2">SOR mapping + contractor bill (JSON)</label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={14}
              className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono"
            />
          </div>
          <button
            onClick={runCosting}
            className="w-full rounded-xl bg-lime-600 hover:bg-lime-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Run Module 15
          </button>
          <p className="text-xs text-white/50">{msg}</p>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <IndianRupee className="w-4 h-4" /> Cost output
          </div>
          {!result ? (
            <div className="text-white/40 text-sm">Run costing after Module 14 takeoff.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 p-4 bg-black/25">
                  <div className="text-xs text-white/50">SOR total</div>
                  <div className="text-xl font-bold">Rs {result.totals?.sor_total ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-4 bg-black/25">
                  <div className="text-xs text-white/50">Contractor total</div>
                  <div className="text-xl font-bold">Rs {result.totals?.contractor_total ?? 0}</div>
                </div>
              </div>
              <div className="overflow-auto max-h-[520px] border border-white/10 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-black/25">
                    <tr>
                      <th className="p-3 text-left">SOR</th>
                      <th className="p-3 text-left">Item</th>
                      <th className="p-3 text-left">Qty</th>
                      <th className="p-3 text-left">SOR amount</th>
                      <th className="p-3 text-left">Contractor amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.boq_lines || []).map((line: any) => (
                      <tr key={`${line.sor_code}-${line.quantity_id}`} className="border-t border-white/10">
                        <td className="p-3">{line.sor_code}</td>
                        <td className="p-3">{line.description}</td>
                        <td className="p-3">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="p-3">{line.sor_amount}</td>
                        <td className="p-3">{line.contractor_amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4">
                <div className="text-sm font-bold mb-2">Rate mismatch flags</div>
                {(result.mismatches || []).length === 0 ? (
                  <div className="text-sm text-white/60">No mismatches above threshold.</div>
                ) : (
                  <ul className="text-sm text-red-200 space-y-1">
                    {result.mismatches.map((m: any) => (
                      <li key={`${m.sor_code}-${m.description}`}>
                        {m.sor_code} - {m.description}: {m.rate_diff_percent}%
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

