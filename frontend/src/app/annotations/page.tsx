"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save } from "lucide-react";

type Project = {
  id: string;
  name: string;
  status: string;
};

type AnnotationKind =
  | "text"
  | "dimension"
  | "level"
  | "grid_bubble"
  | "room_tag"
  | "door_tag"
  | "window_tag"
  | "section_mark"
  | "revision_cloud";

type AnnotationItem = {
  id: string;
  kind: AnnotationKind;
  text?: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  points?: number[][];
};

const apiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export default function Annotation() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<AnnotationItem[]>([]);
  const [kind, setKind] = useState<AnnotationKind>("text");
  const [text, setText] = useState("Label");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      .catch(() => setMessage("Could not load projects"));
  }, [router]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`${apiBase()}/api/projects/${projectId}/annotations`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setItems([]));
  }, [projectId]);

  const previewUrl = useMemo(() => {
    if (!projectId) return "";
    const q = new URLSearchParams({
      size: "A3",
      title: "Annotated Plan",
      drawing_number: "A-201",
      revision: "R0",
      view: "plan",
    });
    return `${apiBase()}/api/projects/${projectId}/sheet.svg?${q.toString()}`;
  }, [projectId]);

  const addAnnotation = () => {
    const id = `${Date.now()}`;
    const base: AnnotationItem = {
      id,
      kind,
      text,
      x: 120 + items.length * 20,
      y: 120 + items.length * 14,
    };
    if (kind === "dimension") {
      base.x2 = base.x + 140;
      base.y2 = base.y;
      base.text = "3.20m";
    }
    setItems((prev) => [...prev, base]);
  };

  const saveAnnotations = async () => {
    if (!projectId) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${apiBase()}/api/projects/${projectId}/annotations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("Annotations saved");
    } catch {
      setMessage("Could not save annotations");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Annotation + Dimension</div>
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
          <div>
            <label className="text-xs text-white/60 block mb-2">Annotation type</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AnnotationKind)}
              className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            >
              <option value="text">Text label</option>
              <option value="dimension">Dimension</option>
              <option value="level">Level</option>
              <option value="grid_bubble">Grid bubble</option>
              <option value="room_tag">Room tag</option>
              <option value="door_tag">Door tag</option>
              <option value="window_tag">Window tag</option>
              <option value="section_mark">Section mark</option>
              <option value="revision_cloud">Revision cloud</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-2">Text</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-black/25 border border-white/15 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addAnnotation}
              className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button
              onClick={saveAnnotations}
              disabled={!projectId || saving}
              className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
          <p className="text-xs text-white/40">{message || `${items.length} annotations loaded`}</p>
          <div className="max-h-72 overflow-auto rounded-xl border border-white/10 p-3 bg-black/20 text-xs space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                <span>
                  {item.kind} {item.text ? `- ${item.text}` : ""}
                </span>
                <button
                  onClick={() => setItems((prev) => prev.filter((p) => p.id !== item.id))}
                  className="text-red-300"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          {!projectId ? (
            <div className="h-[780px] grid place-items-center text-white/40">Select a project to annotate.</div>
          ) : (
            <iframe key={previewUrl} src={previewUrl} className="w-full h-[780px] bg-white" title="Sheet preview" />
          )}
        </section>
      </section>
    </main>
  );
}

