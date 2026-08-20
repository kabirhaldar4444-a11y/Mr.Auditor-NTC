import React from 'react';
import { FileText, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { SCRIPT_CHECKPOINTS, RED_FLAG_RULES } from '../data/scriptData';

export default function ScriptReferenceModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop select-none"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div 
        style={{ 
          maxWidth: '860px',
          width: '100%',
          height: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left'
        }}
        className="modal-content"
      >
        
        {/* Header */}
        <div 
          style={{
            padding: '20px 24px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#eef2ff',
                border: '1px solid #e0e7ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileText style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                  DPR Screening Script & Rubric Guide
                </h2>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#eef2ff',
                    color: '#4f46e5',
                    border: '1px solid #e0e7ff'
                  }}
                >
                  SOP
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '400' }}>
                Standard Operating Procedure for Project-Based Telephony Screening
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#334155';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
            title="Close"
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Scrollable Script Reference */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--bg-app)]/50">
          
          {/* Mandatory Checkpoints Overview */}
          <div className="card-white p-5">
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
              <span>Mandatory Screening Script Flow</span>
            </h3>
            
            <div className="space-y-4 text-xs text-[var(--text-secondary)]">
              {SCRIPT_CHECKPOINTS.map((cp, idx) => (
                <div key={cp.id} className="p-3.5 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-color)] space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <strong className="text-blue-600 font-extrabold text-sm block">
                      {idx + 1}. {cp.title}
                    </strong>
                    <span className="text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
                      {cp.section} ({cp.weight} pts)
                    </span>
                  </div>
                  <p className="font-semibold text-[var(--text-primary)] text-[12px] leading-relaxed pl-2.5 border-l-2 border-indigo-500/30">
                    {cp.description}
                  </p>
                  {cp.standardPhrases && cp.standardPhrases.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                      <span className="font-bold text-[var(--text-secondary)]">Phrases:</span>
                      {cp.standardPhrases.map((phrase, pIdx) => (
                        <span key={pIdx} className="bg-slate-100 border border-slate-200 text-slate-600 px-1 py-0.2 rounded font-mono text-[9px]">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  )}
                  {cp.prohibitedPhrases && cp.prohibitedPhrases.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                      <span className="font-bold text-rose-500">Prohibited:</span>
                      {cp.prohibitedPhrases.map((phrase, pIdx) => (
                        <span key={pIdx} className="bg-rose-50 border border-rose-100 text-rose-600 px-1 py-0.2 rounded font-mono text-[9px]">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Red Flag Audit Rules */}
          <div className="card-white p-5 border-rose-500/20 bg-rose-500/5">
            <h3 className="font-extrabold text-rose-500 text-sm mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>ChatGPT AI Red Flag & Violation Rules</span>
            </h3>

            <div className="space-y-3">
              {RED_FLAG_RULES.map((rule, idx) => (
                <div key={idx} className="p-3 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-lg text-xs font-semibold">
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)] mb-1">
                    <span className="text-rose-500">{rule.title}</span>
                    <span className="bg-rose-500/10 text-rose-500 text-[10px] px-2 py-0.5 rounded font-mono">{rule.severity}</span>
                  </div>
                  <p className="text-[var(--text-secondary)] font-medium leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
