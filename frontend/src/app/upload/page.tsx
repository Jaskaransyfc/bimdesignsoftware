'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UploadPage() {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        router.push('/');
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      console.error(error);
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0e1a] text-white p-8 flex items-center justify-center">
      <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-500">
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 font-bold text-xs uppercase tracking-widest">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="bg-[#16192c] border border-white/5 rounded-[3rem] p-10 md:p-14 shadow-2xl shadow-black/50">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Upload IFC Model
            </h1>
            <p className="text-white/30 text-sm font-medium">Select an industry-standard IFC file to begin processing.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-4">Project Identity</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500 focus:bg-white/[0.08] transition-all"
                placeholder="e.g. Mechanical Room V1"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-4">IFC Geometry</label>
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative group border-2 border-dashed rounded-[2rem] p-12 text-center transition-all ${
                  dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                } ${file ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
              >
                <input
                  type="file"
                  accept=".ifc"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <div className="flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                    file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20 group-hover:text-blue-400'
                  }`}>
                    {file ? (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    )}
                  </div>
                  
                  <div>
                    <p className="font-bold text-sm mb-1">
                      {file ? file.name : 'Drag & drop IFC file'}
                    </p>
                    <p className="text-xs text-white/30">
                      {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'or click to browse local files'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || !file || !name}
              className="w-full relative group overflow-hidden bg-blue-600 disabled:bg-white/5 disabled:text-white/20 py-5 rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-blue-900/20"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative flex items-center justify-center gap-3">
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    PROCESSING DATA...
                  </>
                ) : (
                  'INITIALIZE UPLOAD'
                )}
              </span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
