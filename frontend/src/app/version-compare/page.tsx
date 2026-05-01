"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitCompareArrows, Play } from "lucide-react";

type Project = { id: string; name: string; status: string };
type Version = { id: string; label: string; author: string; created_at: string };

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function VersionComparePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [baseVersion, setBaseVersion] = useState("");
  const [targetVersion, setTargetVersion] = useState("");
  const [result, setResult] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const loadVersions = async (pid: string) => {
    if (!pid) return;
    const r = await fetch(`${apiBase()}/api/projects/${pid}/versions`);
    const d = await r.json();
    const list = Array.isArray(d?.versions) ? d.versions : [];
    setVersions(list);
    if (list.length >= 2) {
      setBaseVersion(list[list.length - 2].id);
      setTargetVersion(list[list.length - 1].id);
    }
  };

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
        if (ready[0]?.id) {
          setProjectId(ready[0].id);
          loadVersions(ready[0].id);
        }
      });
  }, [router]);

  const runCompare = async () => {
    if (!projectId || !baseVersion || !targetVersion) return;
    setMsg("");
    const r = await fetch(`${apiBase()}/api/projects/${projectId}/version-compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_version_id: baseVersion, target_version_id: targetVersion }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMsg(d?.detail || "Version compare failed");
      return;
    }
    setResult(d);
    setMsg("Version comparison complete");
  };

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-violet-300"> Version Comparison</div>
      </header>
      <section className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              loadVersions(e.target.value);
            }}
            className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={baseVersion} onChange={(e) => setBaseVersion(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm">
            <option value="">Base version</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.author})
              </option>
            ))}
          </select>
          <select value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm">
            <option value="">Target version</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.author})
              </option>
            ))}
          </select>
          <button onClick={runCompare} className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> Compare Versions
          </button>
          <p className="text-xs text-white/50">{msg}</p>
        </aside>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <GitCompareArrows className="w-4 h-4" /> Comparison output
          </div>
          {!result ? (
            <div className="text-white/40 text-sm">Select two versions and compare.</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>Added objects: {result.added_objects?.length || 0}</div>
              <div>Deleted objects: {result.deleted_objects?.length || 0}</div>
              <div>Modified objects: {result.modified_objects?.length || 0}</div>
              <div>Quantity difference: {result.quantity_difference}</div>
              <div>Cost difference: {result.cost_difference}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                  <div className="font-semibold">Added</div>
                  <div className="text-xs text-white/70 max-h-48 overflow-auto">
                    {(result.added_objects || []).slice(0, 30).map((o: any) => (
                      <div key={o.id}>{o.type} - {o.name}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                  <div className="font-semibold">Deleted</div>
                  <div className="text-xs text-white/70 max-h-48 overflow-auto">
                    {(result.deleted_objects || []).slice(0, 30).map((o: any) => (
                      <div key={o.id}>{o.type} - {o.name}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="font-semibold">Modified</div>
                  <div className="text-xs text-white/70 max-h-48 overflow-auto">
                    {(result.modified_objects || []).slice(0, 30).map((o: any) => (
                      <div key={o.id}>{o.id}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

