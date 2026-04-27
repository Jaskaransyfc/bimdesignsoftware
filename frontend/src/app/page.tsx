'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/`)
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-[#0d0e1a] text-white p-8 md:p-12">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            BIM Project Center
          </h1>
          <p className="text-white/40 text-sm font-medium tracking-wide uppercase">
            Manage your industrial IFC models & metadata
          </p>
        </div>
        
        <Link 
          href="/upload" 
          className="group relative px-8 py-4 bg-blue-600 rounded-2xl font-bold text-sm tracking-wide overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <span className="relative flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            UPLOAD NEW MODEL
          </span>
        </Link>
      </div>

      {/* Projects Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-white/5 rounded-3xl animate-pulse border border-white/5"></div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className="group relative bg-[#16192c] border border-white/5 rounded-[2rem] p-8 transition-all hover:bg-[#1c203a] hover:border-blue-500/30 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${
                    project.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400' :
                    project.status === 'error' ? 'bg-red-500/10 text-red-400' :
                    'bg-amber-500/10 text-amber-400 animate-pulse'
                  }`}>
                    {project.status}
                  </span>
                </div>

                <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-400 transition-colors">
                  {project.name}
                </h2>
                <p className="text-white/30 text-xs mb-8">
                  Registered: {new Date(project.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </p>

                <Link 
                  href={`/viewer/${project.id}`}
                  className={`flex items-center justify-center w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all ${
                    project.status === 'ready' 
                    ? 'bg-white/5 hover:bg-blue-600 text-white' 
                    : 'bg-white/5 opacity-50 cursor-not-allowed text-white/40'
                  }`}
                  onClick={(e) => project.status !== 'ready' && e.preventDefault()}
                >
                  {project.status === 'ready' ? 'LAUNCH VIEWER' : 'PROCESSING...'}
                  {project.status === 'ready' && (
                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  )}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-white/20">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">No Projects Found</h3>
            <p className="text-white/30 mb-8 max-w-sm mx-auto">Upload your first IFC model to start exploring BIM metadata and 3D geometries.</p>
            <Link href="/upload" className="text-blue-400 font-bold hover:underline">Upload Model Now</Link>
          </div>
        )}
      </div>
    </main>
  );
}
