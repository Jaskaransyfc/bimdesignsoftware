'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, UploadCloud, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface TeamMember {
  name: string;
  email: string;
}

export default function UploadPage() {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([{ name: '', email: '' }]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const router = useRouter();

  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem('userEmail');
    if (!savedEmail) {
      router.push('/login');
      return;
    }
    setCurrentUserEmail(savedEmail);
    setCurrentUserName(localStorage.getItem('userName') || savedEmail);
  }, [router]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && isSupportedFormat(droppedFile.name)) {
      setFile(droppedFile);
    } else {
      alert("Unsupported file format. Please use: IFC, GLB, GLTF, OBJ, FBX, DAE, STP, STEP, XYZ, E57");
    }
  };

  const acceptFormats = ".ifc,.glb,.gltf,.obj,.fbx,.dae,.stp,.step,.xyz,.e57,.blend";

  const isSupportedFormat = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return false;
    const allowed = ['ifc', 'glb', 'gltf', 'obj', 'fbx', 'dae', 'stp', 'step', 'xyz', 'e57', 'blend'];
    return allowed.includes(ext);
  };

  const addTeamMember = () => setTeam([...team, { name: '', email: '' }]);
  const removeTeamMember = (index: number) => setTeam(team.filter((_, i) => i !== index));
  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = [...team];
    updated[index][field] = value;
    setTeam(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    if (!isSupportedFormat(file.name)) {
      alert("Unsupported file format. Please use: IFC, GLB, GLTF, OBJ, FBX, DAE, STP, STEP, XYZ, E57");
      return;
    }

    setUploading(true);
    setStatusMessage('Uploading model…');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    if (client) formData.append('client_name', client);
    if (location) formData.append('location', location);

    const validTeam = team.filter(m => m.name || m.email);
    if (!validTeam.some(m => m.email === currentUserEmail)) {
      validTeam.unshift({ name: currentUserName || 'Project Owner', email: currentUserEmail });
    }
    if (validTeam.length > 0) {
      formData.append('team_members', JSON.stringify(validTeam));
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

    try {
      const res = await fetch(`${cleanUrl}/api/projects/`, { method: 'POST', body: formData });
      if (res.ok) {
        setStatusMessage('Project created! Redirecting…');
        setTimeout(() => router.push('/'), 800);
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Upload failed: ${err.detail || 'Server error'}`);
        setStatusMessage('Upload failed.');
      }
    } catch {
      alert('Network error – is the backend running on port 8000?');
      setStatusMessage('Connection error.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateBlankProject = async () => {
    if (!name) return;
    setUploading(true);
    setStatusMessage("Creating blank project...");
    const validTeam = team.filter((m) => m.name || m.email);
    if (!validTeam.some((m) => m.email === currentUserEmail)) {
      validTeam.unshift({
        name: currentUserName || "Project Owner",
        email: currentUserEmail,
      });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const cleanUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

    try {
      const res = await fetch(`${cleanUrl}/api/projects/blank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          client_name: client || null,
          location: location || null,
          team_members: validTeam.length > 0 ? validTeam : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        alert(`Could not create blank project: ${err.detail || "Server error"}`);
        setStatusMessage("Blank project creation failed.");
        return;
      }
      setStatusMessage("Blank project ready. Redirecting...");
      setTimeout(() => router.push("/"), 800);
    } catch {
      alert("Network error - is the backend running on port 8000?");
      setStatusMessage("Connection error.");
    } finally {
      setUploading(false);
    }
  };

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null;

  return (
    <main className="min-h-screen bg-[#0d0e1a] text-white p-6 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 text-sm font-medium group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </Link>

        <div className="bg-[#121422] border border-white/5 rounded-3xl p-8 md:p-12 shadow-2xl shadow-black/40">
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              New Project
            </h1>
            <p className="text-white/35 text-sm">Upload any supported 3D model. IFC files will extract BIM data.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Project Name + Client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Project Name *</label>
                <input
                  id="project-name"
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                  placeholder="Office Tower Phase 2" required
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Client</label>
                <input
                  id="client-name"
                  type="text" value={client} onChange={(e) => setClient(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                  placeholder="Acme Construction Ltd"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Location</label>
              <input
                id="project-location"
                type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                placeholder="Mumbai, India"
              />
            </div>

            {/* Team Members */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Team Members</label>
                <button
                  type="button" onClick={addTeamMember}
                  className="text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
              </div>
              <div className="space-y-3">
                {team.map((member, idx) => (
                  <div key={idx} className="flex gap-3 items-center group">
                    <input
                      type="text" placeholder="Name" value={member.name}
                      onChange={(e) => updateTeamMember(idx, 'name', e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:border-blue-500 outline-none transition-all"
                    />
                    <input
                      type="email" placeholder="Email" value={member.email}
                      onChange={(e) => updateTeamMember(idx, 'email', e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:border-blue-500 outline-none transition-all"
                    />
                    <button
                      type="button" onClick={() => removeTeamMember(idx)}
                      className="text-white/20 hover:text-red-400 transition-colors p-1"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* File Drop */}
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">3D Model *</label>
              <div
                onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' :
                  file ? 'border-emerald-500/50 bg-emerald-500/5' :
                    'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
              >
                <input
                  id="model-file-input"
                  type="file" accept={acceptFormats}
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected && !isSupportedFormat(selected.name)) {
                      alert("Unsupported file format.");
                      e.target.value = '';
                      return;
                    }
                    setFile(selected || null);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'
                    }`}>
                    {file ? <CheckCircle2 className="w-7 h-7" /> : <UploadCloud className="w-7 h-7" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {file ? file.name : 'Drag & drop or click to browse (.ifc, .glb, .obj, .fbx, ...)'}
                    </p>
                    <p className="text-white/25 text-xs mt-2">
                      Supported: IFC, GLB, GLTF, OBJ, FBX, DAE, STP, STEP, XYZ, E57
                    </p>
                    {fileSizeMB && (
                      <p className="text-white/30 text-xs mt-1">{fileSizeMB} MB</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="text-center h-5">
              {statusMessage && (
                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                  {statusMessage}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              id="submit-project"
              type="submit" disabled={uploading || !file || !name}
              className="w-full bg-blue-600 disabled:bg-white/5 disabled:text-white/20 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.99]"
            >
              {uploading ? 'Creating Project…' : 'Initialize Project'}
            </button>
            <button
              type="button"
              onClick={handleCreateBlankProject}
              disabled={uploading || !name}
              className="w-full bg-white/10 disabled:bg-white/5 disabled:text-white/20 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all hover:bg-white/15"
            >
              Create Blank Project (Start Modeling)
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}