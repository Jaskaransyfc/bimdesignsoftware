"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitBranch, MessageSquare, Users } from "lucide-react";

type Project = { id: string; name: string; status: string };

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function CollaborationPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [collab, setCollab] = useState<any>({ roles: [], comments: [], activity_log: [] });
  const [roleEmail, setRoleEmail] = useState("engineer@company.com");
  const [role, setRole] = useState("engineer");
  const [commentAuthor, setCommentAuthor] = useState("lead@company.com");
  const [commentText, setCommentText] = useState("Please review latest model version.");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [versionAuthor, setVersionAuthor] = useState("lead@company.com");
  const [msg, setMsg] = useState("");

  const loadData = async (pid: string) => {
    if (!pid) return;
    const r = await fetch(`${apiBase()}/api/projects/${pid}/collaboration`);
    setCollab(await r.json());
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
          loadData(ready[0].id);
        }
      });
  }, [router]);

  const setProjectRole = async () => {
    if (!projectId) return;
    await fetch(`${apiBase()}/api/projects/${projectId}/collaboration/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_email: roleEmail, role }),
    });
    setMsg("Role updated");
    loadData(projectId);
  };

  const addComment = async () => {
    if (!projectId) return;
    await fetch(`${apiBase()}/api/projects/${projectId}/collaboration/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: commentAuthor, message: commentText }),
    });
    setMsg("Comment added");
    loadData(projectId);
  };

  const createVersion = async () => {
    if (!projectId) return;
    await fetch(`${apiBase()}/api/projects/${projectId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: versionLabel, author: versionAuthor, note: "Auto snapshot" }),
    });
    setMsg("Version snapshot created");
    loadData(projectId);
  };

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-sky-300"> Multi-User Collaboration</div>
      </header>
      <section className="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <label className="text-xs text-white/60 block mb-2">Project</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                loadData(e.target.value);
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
          <div className="rounded-xl border border-white/10 p-3 bg-black/20 space-y-2">
            <div className="text-xs font-semibold text-white/70">Project roles</div>
            <input value={roleEmail} onChange={(e) => setRoleEmail(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded px-2 py-1.5 text-xs" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded px-2 py-1.5 text-xs">
              <option value="owner">owner</option>
              <option value="engineer">engineer</option>
              <option value="reviewer">reviewer</option>
              <option value="viewer">viewer</option>
              <option value="contractor">contractor</option>
            </select>
            <button onClick={setProjectRole} className="w-full bg-sky-600 hover:bg-sky-500 rounded px-3 py-1.5 text-xs font-bold">Set Role</button>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-black/20 space-y-2">
            <div className="text-xs font-semibold text-white/70">Comments</div>
            <input value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded px-2 py-1.5 text-xs" />
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full h-16 bg-black/25 border border-white/15 rounded px-2 py-1.5 text-xs" />
            <button onClick={addComment} className="w-full bg-indigo-600 hover:bg-indigo-500 rounded px-3 py-1.5 text-xs font-bold">Add Comment</button>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-black/20 space-y-2">
            <div className="text-xs font-semibold text-white/70">Model versioning</div>
            <input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded px-2 py-1.5 text-xs" />
            <input value={versionAuthor} onChange={(e) => setVersionAuthor(e.target.value)} className="w-full bg-black/25 border border-white/15 rounded px-2 py-1.5 text-xs" />
            <button onClick={createVersion} className="w-full bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-1.5 text-xs font-bold">Create Version Snapshot</button>
          </div>
          <div className="text-xs text-white/50">{msg}</div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 p-3 bg-black/20">
            <div className="flex items-center gap-2 text-sm mb-2"><Users className="w-4 h-4" /> Roles</div>
            <div className="space-y-1 text-xs">
              {(collab.roles || []).map((r: any, idx: number) => (
                <div key={`${r.user_email}-${idx}`} className="text-white/70">{r.user_email} - {r.role}</div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-black/20">
            <div className="flex items-center gap-2 text-sm mb-2"><MessageSquare className="w-4 h-4" /> Comments</div>
            <div className="space-y-2 text-xs">
              {(collab.comments || []).map((c: any) => (
                <div key={c.id} className="text-white/70">
                  <div className="font-semibold">{c.author}</div>
                  <div>{c.message}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-black/20">
            <div className="flex items-center gap-2 text-sm mb-2"><GitBranch className="w-4 h-4" /> Activity log</div>
            <div className="space-y-1 text-xs">
              {(collab.activity_log || []).slice().reverse().map((a: any) => (
                <div key={a.id} className="text-white/70">{a.type}: {a.message}</div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

