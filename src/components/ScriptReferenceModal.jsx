import React from 'react';
import { FileText, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { SCRIPT_CHECKPOINTS, RED_FLAG_RULES } from '../data/scriptData';

export default function ScriptReferenceModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="bg-[var(--bg-card-solid)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col relative overflow-hidden modal-content transition-colors">
        
        {/* Header */}
        <div className="p-4 px-6 bg-[var(--bg-card-solid)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-[var(--text-primary)]">DPR Screening Script & Rubric Guide</h2>
              <p className="text-xs text-[var(--text-secondary)] font-medium">Standard Operating Procedure for Project-Based Roles</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-card-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
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
