import React from 'react';
import { UploadCloud, Calendar } from 'lucide-react';

export default function Header({ viewTitle, viewSubtitle, onOpenUpload, totalCalls }) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="bg-white border-b border-[var(--border-color)] h-[68px] flex items-center justify-between px-8 shrink-0 z-10" style={{ boxShadow: 'var(--shadow-xs)' }}>
      
      {/* Title / Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-md font-semibold tracking-wide uppercase">
            CallPulse AI
          </span>
          <span className="text-gray-300">/</span>
          <h1 className="font-bold text-[var(--text-primary)] text-base tracking-tight">{viewTitle}</h1>
        </div>
        {viewSubtitle && (
          <p className="text-[13px] text-[var(--text-muted)] font-normal mt-0.5 hidden sm:block">{viewSubtitle}</p>
        )}
      </div>

      {/* Action panel */}
      <div className="flex items-center gap-3">
        
        {/* Date widget */}
        <div className="hidden md:flex items-center gap-2 text-[13px] text-[var(--text-muted)] font-medium bg-[var(--bg-card-subtle)] border border-[var(--border-color)] px-3.5 py-2 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span>{currentDate}</span>
        </div>

        {/* Upload shortcut */}
        <button
          onClick={onOpenUpload}
          className="btn-primary text-sm font-semibold py-2 px-4 flex items-center gap-2"
          title="Import Excel/CSV rows"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload batch</span>
        </button>

      </div>
    </header>
  );
}
