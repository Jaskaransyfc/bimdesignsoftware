"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  ExternalLink,
  Settings,
  Search,
  Building2,
  MapPin,
  Users,
  Clock,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  LayoutList,
  UserCircle,
  X,
  Mail,
  LogOut,
  PencilRuler,
  ScrollText,
  Calculator,
  IndianRupee,
  ShieldAlert,
  Bug,
  UsersRound,
  GitCompareArrows,
  Sigma,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  status: string;
  created_at: string;
  team_members: Array<{ name: string; email: string }> | null;
}

type SortKey = "name" | "client_name" | "location" | "status" | "created_at";
type SortDir = "asc" | "desc";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const router = useRouter();

  // Settings Modal State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    client_name: "",
    location: "",
  });
  const [editTeam, setEditTeam] = useState<
    Array<{ name: string; email: string }>
  >([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmail, setNewTeamEmail] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem("userEmail");
    const savedName = localStorage.getItem("userName");
    if (!savedEmail) {
      router.push("/login");
      return;
    }
    setCurrentUserEmail(savedEmail);
    setCurrentUserName(savedName || savedEmail);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/projects/`)
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const canEdit = (proj: Project) => {
    if (currentUserEmail === "admin@bim.com") return true;
    if (!proj.team_members || proj.team_members.length === 0) return false;
    return proj.team_members[0].email === currentUserEmail;
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-white/10 ml-1">⇅</span>;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 inline ml-1 text-blue-400" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1 text-blue-400" />
    );
  };

  const filtered = projects
    .filter((p) => {
      // Role-based filtering: user must be in team_members
      const isMember = p.team_members?.some(
        (m: any) => m.email === currentUserEmail,
      );
      return isMember;
    })
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.location || "").toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const valA = (a[sortKey] || "") as string;
      const valB = (b[sortKey] || "") as string;
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ready: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      processing: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      uploaded: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      error: "bg-red-500/15 text-red-400 border-red-500/20",
    };
    return map[status] || map.error;
  };

  const allTeamEmails = Array.from(
    new Set(projects.flatMap((p) => p.team_members?.map((m) => m.email) || [])),
  );

  return (
    <main className="min-h-screen bg-[#0d0e1a] text-white">
      {/* Top bar */}
      <header className="border-b border-white/5 bg-[#0d0e1a]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                B
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">BIM Cloud</h1>
                <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest">
                  Project Center
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                <UserCircle className="w-4 h-4 text-white/40" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white leading-tight">
                    {currentUserName}
                  </span>
                  <span className="text-[9px] text-white/40 leading-tight uppercase tracking-widest">
                    {currentUserEmail}
                  </span>
                </div>
                <button
                  onClick={() => {
                    localStorage.clear();
                    router.push("/login");
                  }}
                  className="ml-2 text-white/30 hover:text-red-400 transition-colors"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              <Link
                id="new-project-btn"
                href="/upload"
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20 uppercase tracking-wider"
              >
                <PlusCircle className="w-4 h-4" /> New Project
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex items-center gap-2 min-w-max">
              <Link
                href="/plan-viewer"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <LayoutGrid className="w-4 h-4" /> 2D Plan Viewer
              </Link>
              <Link
                href="/annotations"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <PencilRuler className="w-4 h-4" /> Annotation
              </Link>
              <Link
                href="/sheet-export"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <ScrollText className="w-4 h-4" /> Sheet Export
              </Link>
              <Link
                href="/boq"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <Calculator className="w-4 h-4" /> BOQ
              </Link>
              <Link
                href="/sor-costing"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <IndianRupee className="w-4 h-4" /> SOR Costing
              </Link>
              <Link
                href="/clash-detaction"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <ShieldAlert className="w-4 h-4" /> Clash
              </Link>
              <Link
                href="/issue-bcf"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <Bug className="w-4 h-4" /> Issues / BCF
              </Link>
              <Link
                href="/collaboration"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <UsersRound className="w-4 h-4" /> Collaboration
              </Link>
              <Link
                href="/version-compare"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <GitCompareArrows className="w-4 h-4" /> Version Diff
              </Link>
              <Link
                href="/structural-check"
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold text-[11px] flex items-center gap-2 transition-all border border-white/10 uppercase tracking-wider whitespace-nowrap"
              >
                <Sigma className="w-4 h-4" /> Structural
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Projects",
              value: projects.length,
              icon: Building2,
              color: "blue",
            },
            {
              label: "Ready",
              value: projects.filter((p) => p.status === "ready").length,
              icon: ExternalLink,
              color: "emerald",
            },
            {
              label: "Processing",
              value: projects.filter((p) => p.status === "processing").length,
              icon: Clock,
              color: "amber",
            },
            {
              label: "Team Members",
              value: projects.reduce(
                (sum, p) => sum + (p.team_members?.length || 0),
                0,
              ),
              icon: Users,
              color: "indigo",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#121422] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center`}
                >
                  <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
                </div>
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  {stat.label}
                </span>
              </div>
              <p className="text-2xl font-extrabold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              id="search-projects"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, clients, locations…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-all ${viewMode === "table" ? "bg-blue-600 text-white" : "bg-white/5 text-white/40 hover:text-white"}`}
              title="Table view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white/5 text-white/40 hover:text-white"}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-white/5 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24 bg-[#121422] rounded-3xl border border-dashed border-white/10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-9 h-9 text-white/15" />
            </div>
            <h3 className="text-xl font-bold mb-2">No Projects Yet</h3>
            <p className="text-white/30 mb-8 max-w-sm mx-auto text-sm">
              Upload your first IFC model to start exploring BIM metadata and 3D
              geometry.
            </p>
            <Link
              href="/upload"
              className="text-blue-400 font-bold hover:underline text-sm"
            >
              Upload Model Now →
            </Link>
          </div>
        ) : viewMode === "table" ? (
          /* ===== TABLE VIEW ===== */
          <div className="bg-[#121422] border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" id="projects-table">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th
                      className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/60 select-none"
                      onClick={() => handleSort("name")}
                    >
                      Project <SortIcon col="name" />
                    </th>
                    <th
                      className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/60 select-none"
                      onClick={() => handleSort("client_name")}
                    >
                      Client <SortIcon col="client_name" />
                    </th>
                    <th
                      className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/60 select-none"
                      onClick={() => handleSort("location")}
                    >
                      Location <SortIcon col="location" />
                    </th>
                    <th
                      className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/60 select-none"
                      onClick={() => handleSort("status")}
                    >
                      Status <SortIcon col="status" />
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/40">
                      Team
                    </th>
                    <th
                      className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/40 cursor-pointer hover:text-white/60 select-none"
                      onClick={() => handleSort("created_at")}
                    >
                      Created <SortIcon col="created_at" />
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/40">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((proj) => (
                    <tr
                      key={proj.id}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="font-semibold group-hover:text-blue-400 transition-colors">
                            {proj.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-white/50">
                        {proj.client_name || "—"}
                      </td>
                      <td className="py-3.5 px-6 text-white/50">
                        {proj.location ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-white/30" />
                            {proj.location}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge(proj.status)}`}
                        >
                          {proj.status === "processing" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1.5" />
                          )}
                          {proj.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        {proj.team_members?.length ? (
                          <div className="flex -space-x-2">
                            {proj.team_members.slice(0, 3).map((m, i) => (
                              <div
                                key={i}
                                className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-[#121422] flex items-center justify-center text-[10px] font-bold text-blue-300"
                                title={`${m.name} (${m.email})`}
                              >
                                {m.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                            ))}
                            {proj.team_members.length > 3 && (
                              <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-[#121422] flex items-center justify-center text-[10px] text-white/50 font-bold">
                                +{proj.team_members.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-white/40 text-xs">
                        {new Date(proj.created_at).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/viewer/${proj.id}`}
                            className={`p-2 rounded-lg transition-all ${proj.status === "ready" ? "text-blue-400 hover:bg-blue-500/10" : "text-white/15 pointer-events-none"}`}
                            title="Open Viewer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/modeling/${proj.id}`}
                            className="p-2 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-all"
                            title="2D Design Studio"
                          >
                            <PencilRuler className="w-4 h-4" />
                          </Link>
                          {canEdit(proj) && (
                            <button
                              onClick={() => {
                                setEditingProject(proj);
                                setEditForm({
                                  name: proj.name,
                                  client_name: proj.client_name || "",
                                  location: proj.location || "",
                                });
                                setEditTeam(proj.team_members || []);
                              }}
                              className="text-white/30 hover:text-white/60 hover:bg-white/5 p-2 rounded-lg transition-all"
                              title="Settings"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="border-t border-white/5 px-6 py-3 flex justify-between items-center">
              <p className="text-xs text-white/30">
                {filtered.length} of {projects.length} projects
              </p>
            </div>
          </div>
        ) : (
          /* ===== GRID VIEW ===== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((proj) => (
              <div
                key={proj.id}
                className="group bg-[#121422] border border-white/5 rounded-2xl p-6 hover:border-blue-500/20 hover:shadow-xl hover:shadow-black/20 transition-all"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge(proj.status)}`}
                  >
                    {proj.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold mb-1 group-hover:text-blue-400 transition-colors">
                  {proj.name}
                </h3>

                {proj.client_name && (
                  <p className="text-white/40 text-xs mb-1">
                    {proj.client_name}
                  </p>
                )}
                {proj.location && (
                  <p className="text-white/30 text-xs flex items-center gap-1 mb-4">
                    <MapPin className="w-3 h-3" /> {proj.location}
                  </p>
                )}
                {!proj.client_name && !proj.location && (
                  <div className="mb-4" />
                )}

                {/* Team avatars */}
                {proj.team_members?.length ? (
                  <div className="flex -space-x-2 mb-5">
                    {proj.team_members.slice(0, 4).map((m, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-[#121422] flex items-center justify-center text-[10px] font-bold text-blue-300"
                      >
                        {m.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mb-5" />
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/25 uppercase tracking-wider">
                    {new Date(proj.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/modeling/${proj.id}`}
                      className="text-xs font-bold px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all"
                    >
                      Design
                    </Link>
                    <Link
                      href={`/viewer/${proj.id}`}
                      className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                        proj.status === "ready"
                          ? "bg-blue-600 hover:bg-blue-500 text-white"
                          : "bg-white/5 text-white/30 pointer-events-none"
                      }`}
                      onClick={(e) =>
                        proj.status !== "ready" && e.preventDefault()
                      }
                    >
                      {proj.status === "ready" ? "View" : "Pending…"}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121422] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h2 className="text-lg font-bold">Project Settings</h2>
                <p className="text-xs text-white/40">
                  Manage project details and team access.
                </p>
              </div>
              <button
                onClick={() => setEditingProject(null)}
                className="text-white/40 hover:text-white p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Details */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                  General Information
                </h3>
                <div>
                  <label className="block text-xs font-bold text-white/60 mb-1.5">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-white/60 mb-1.5">
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={editForm.client_name}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          client_name: e.target.value,
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/60 mb-1.5">
                      Location
                    </label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) =>
                        setEditForm({ ...editForm, location: e.target.value })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Team */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                  Team Members
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newTeamEmail}
                    onChange={(e) => setNewTeamEmail(e.target.value)}
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  />
                  <button
                    onClick={() => {
                      if (newTeamName && newTeamEmail) {
                        setEditTeam([
                          ...editTeam,
                          { name: newTeamName, email: newTeamEmail },
                        ]);
                        alert(
                          `Mock Email Sent: An invitation request to join the project has been sent to ${newTeamEmail}`,
                        );
                        setNewTeamName("");
                        setNewTeamEmail("");
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Mail className="w-4 h-4" /> Invite
                  </button>
                </div>

                <div className="space-y-2 mt-4">
                  {editTeam.length === 0 ? (
                    <p className="text-xs text-white/30 italic text-center py-2">
                      No team members invited yet.
                    </p>
                  ) : (
                    editTeam.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-bold">
                            {m.name}{" "}
                            {m.email === currentUserEmail && (
                              <span className="text-[10px] text-blue-400 font-normal ml-1">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-white/40">{m.email}</p>
                        </div>
                        {m.email !== currentUserEmail && (
                          <button
                            onClick={() =>
                              setEditTeam(
                                editTeam.filter((_, idx) => idx !== i),
                              )
                            }
                            className="text-red-400/60 hover:text-red-400 text-xs font-bold uppercase tracking-wider p-2"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/5 bg-[#0d0e1a] flex justify-end gap-3">
              <button
                onClick={() => setEditingProject(null)}
                className="px-5 py-2 text-sm font-bold text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const apiUrl =
                    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
                  try {
                    const res = await fetch(
                      `${apiUrl}/api/projects/${editingProject.id}`,
                      {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: editForm.name,
                          client_name: editForm.client_name,
                          location: editForm.location,
                          team_members: editTeam,
                        }),
                      },
                    );
                    if (res.ok) {
                      const updated = await res.json();
                      setProjects(
                        projects.map((p) =>
                          p.id === updated.id ? updated : p,
                        ),
                      );
                      setEditingProject(null);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
