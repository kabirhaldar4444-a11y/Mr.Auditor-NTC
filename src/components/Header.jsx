import React from 'react';
import { UploadCloud, Calendar } from 'lucide-react';

export default function Header({
  viewTitle,
  viewSubtitle,
  onOpenUpload,
  totalCalls
}) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="bg-[var(--bg-card-solid)] border-b border-[var(--border-color)] h-16 flex items-center justify-between px-6 shrink-0 transition-colors z-10">
      
      {/* Title / Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded font-bold font-mono uppercase tracking-wider">
            CallPulse AI
          </span>
          <span className="text-slate-300">/</span>
          <h2 className="font-extrabold text-[var(--text-primary)] text-sm tracking-tight">{viewTitle}</h2>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5 hidden sm:block">{viewSubtitle}</p>
      </div>

      {/* Action panel & Date display */}
      <div className="flex items-center gap-4">
        
        {/* Calendar widget */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold font-mono bg-[var(--bg-card-subtle)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>{currentDate}</span>
        </div>

        {/* Upload shortcut */}
        <button
          onClick={onOpenUpload}
          className="btn-primary text-xs font-bold py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
          title="Import Excel/CSV rows"
        >
          <UploadCloud className="w-4 h-4 text-white" />
          <span>Upload batch</span>
        </button>

      </div>

    </header>
  );
}
