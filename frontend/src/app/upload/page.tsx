'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UploadPage() {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const router = useRouter();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setUploading(true);
    setStatusMessage('Preparing upload...');
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    // Remove trailing slash if present to avoid double slashes
    const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const endpoint = `${cleanUrl}/api/projects/`;

    console.log("Attempting upload to:", endpoint);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        // Important: Do NOT set Content-Type header manually when sending FormData
      });

      if (res.ok) {
        console.log("Upload successful!");
        setStatusMessage('Upload successful! Redirecting...');
        router.push('/');
      } else {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        console.error("Upload failed with status:", res.status, errorData);
        alert(`Upload failed: ${errorData.detail || 'Server error'}`);
        setStatusMessage('Upload failed. Please try again.');
      }
    } catch (error) {
      console.error("Network error during upload:", error);
      alert('Network error: Could not reach the backend. Ensure the FastAPI server is running on port 8000.');
      setStatusMessage('Connection error.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0e1a] text-white p-8 flex items-center justify-center">
      <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-500">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 font-bold text-xs uppercase tracking-widest">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Dashboard
        </Link>

        <div className="bg-[#16192c] border border-white/5 rounded-[3rem] p-10 md:p-14 shadow-2xl">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Upload IFC Model</h1>
            <p className="text-white/30 text-sm font-medium">Add a new project to your BIM dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-4">Project Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all" placeholder="e.g. New Office Block" required />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-4">IFC Geometry</label>
              <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop} className={`relative border-2 border-dashed rounded-[2rem] p-12 text-center transition-all ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'} ${file ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}>
                <input type="file" accept=".ifc" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                    {file ? <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
                  </div>
                  <p className="font-bold text-sm">{file ? file.name : 'Drag & drop IFC file or click to browse'}</p>
                </div>
              </div>
            </div>

            <div className="text-center h-4">
              {statusMessage && <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest animate-pulse">{statusMessage}</p>}
            </div>

            <button type="submit" disabled={uploading || !file || !name} className="w-full bg-blue-600 disabled:bg-white/5 disabled:text-white/20 py-5 rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl">
              {uploading ? 'Uploading...' : 'Initialize Project'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
