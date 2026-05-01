"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bug, Download, Plus } from "lucide-react";

type Project = { id: string; name: string; status: string };
type Issue = {
  id: string;
  title: string;
  description: string;
  object_id?: string;
  assigned_to?: string;
  status: string;
  priority: string;
};

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function IssuesBcfPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [title, setTitle] = useState("Clash at beam-wall joint");
  const [description, setDescription] = useState("Please resolve clearance conflict before next review.");
  const [objectId, setObjectId] = useState("");
  const [assignedTo, setAssignedTo] = useState("engineer@company.com");
  const [msg, setMsg] = useState("");

  const loadIssues = async (pid: string) => {
    if (!pid) return;
    const r = await fetch(`${apiBase()}/api/projects/${pid}/issues`);
    const d = await r.json();
    setIssues(Array.isArray(d?.issues) ? d.issues : []);
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
          loadIssues(ready[0].id);
        }
      });
  }, [router]);

  const createIssue = async () => {
    if (!projectId) return;
    setMsg("");
    const payload = {
      title,
      description,
      object_id: objectId || null,
      object_type: objectId ? "IfcElement" : null,
      assigned_to: assignedTo || null,
      status: "open",
      priority: "high",
      camera_view: { eye: [-10, 10, -10], look: [0, 0, 0], up: [0, 1, 0] },
    };
    const r = await fetch(`${apiBase()}/api/projects/${projectId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setMsg(d?.detail || "Could not create issue");
      return;
    }
    setMsg("Issue created");
    await loadIssues(projectId);
  };

  const exportBcfUrl = projectId ? `${apiBase()}/api/projects/${projectId}/issues/bcf-export` : "";

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-red-300"> Issue Management / BCF</div>
      </header>
      <section className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <label className="text-xs text-white/60 block mb-2">Project</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                loadIssues(e.target.value);
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
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            placeholder="Issue title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-24 bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            placeholder="Issue description"
          />
          <input
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
            className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            placeholder="Attach to model object ID"
          />
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            placeholder="Assign to engineer email"
          />
          <button
            onClick={createIssue}
            className="w-full rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Issue
          </button>
          <a
            href={exportBcfUrl}
            className="w-full rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Export BCF
          </a>
          <div className="text-xs text-white/50">{msg}</div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Bug className="w-4 h-4" /> Issues
          </div>
          <div className="space-y-3">
            {issues.map((i) => (
              <div key={i.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="font-semibold">{i.title}</div>
                <div className="text-xs text-white/50 mt-1">{i.description}</div>
                <div className="text-xs text-white/40 mt-2">
                  Status: {i.status} | Priority: {i.priority} | Assigned: {i.assigned_to || "—"}
                </div>
                <div className="text-xs text-white/35">Object: {i.object_id || "—"}</div>
              </div>
            ))}
            {issues.length === 0 && <div className="text-white/40 text-sm">No issues yet.</div>}
          </div>
        </section>
      </section>
    </main>
  );
}

