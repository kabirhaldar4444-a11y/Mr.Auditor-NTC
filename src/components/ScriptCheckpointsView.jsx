import React from 'react';
import { CheckCircle2, ShieldAlert, HelpCircle, BookOpen } from 'lucide-react';
import { SCRIPT_CHECKPOINTS, RED_FLAG_RULES } from '../data/scriptData';

export default function ScriptCheckpointsView() {
  return (
    <div className="space-y-8">
      
      {/* View Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">DPR Audit Guidelines</h2>
        <p className="text-[var(--text-muted)] mt-1">Standard checkpoint checklist and critical evaluation rules mapped to AI compliance models.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        
        {/* Left 2 Columns: Script Checkpoints Matrix */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card-white p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] text-base">DPR HR Screening Script Flow</h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">10 checkpoints mapped to point weights — Total: 100 points</p>
              </div>
            </div>
            
            <div className="divide-y divide-[var(--border-color)]">
              {SCRIPT_CHECKPOINTS.map((cp) => (
                <div key={cp.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-mono text-[12px] font-bold shrink-0">
                        {cp.id.replace('CP', '')}
                      </span>
                      <h4 className="font-semibold text-sm text-[var(--text-primary)]">{cp.title}</h4>
                    </div>
                    <span className="text-[11px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md border border-gray-200 font-mono font-semibold shrink-0 whitespace-nowrap">
                      {cp.section} · {cp.weight} pts
                    </span>
                  </div>

                  <p className="text-[13px] text-[var(--text-muted)] leading-relaxed pl-10">{cp.description}</p>
                  
                  {cp.standardPhrases && cp.standardPhrases.length > 0 && (
                    <div className="pl-10 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-[var(--text-muted)] font-semibold">Standard:</span>
                      {cp.standardPhrases.map(phrase => (
                        <span key={phrase} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  )}

                  {cp.prohibitedPhrases && cp.prohibitedPhrases.length > 0 && (
                    <div className="pl-10 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-red-600 font-semibold">Prohibited:</span>
                      {cp.prohibitedPhrases.map(phrase => (
                        <span key={phrase} className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[11px] font-mono">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Red Flag Rules & Notes */}
        <div className="space-y-5">
          
          {/* Red Flag Rules */}
          <div className="card-white p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-500 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] text-sm">Critical Red Flag Rules</h3>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Automatic point deductions</p>
              </div>
            </div>

            <div className="space-y-3">
              {RED_FLAG_RULES.map((rule) => (
                <div key={rule.code} className="p-4 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">{rule.name}</span>
                    <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-mono shrink-0">
                      -{rule.deduction} pts
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* QA Protocol Note */}
          <div className="card-white p-6 bg-indigo-50 border-indigo-100">
            <div className="flex items-center gap-2.5 mb-4">
              <HelpCircle className="w-4.5 h-4.5 text-indigo-500" />
              <h4 className="font-semibold text-indigo-700 text-sm">QA Audit Protocols</h4>
            </div>
            <ul className="space-y-2.5 text-[12px] text-indigo-700 leading-relaxed">
              <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-indigo-400 mt-2 shrink-0"></span><span>Each call is transcribed via Gemini STT and evaluated against this 10-checkpoint rubric.</span></li>
              <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-indigo-400 mt-2 shrink-0"></span><span>Scoring: 100 base points minus deductions for red flag violations.</span></li>
              <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-indigo-400 mt-2 shrink-0"></span><span>Critical Fail is applied when overall score drops below 55%.</span></li>
              <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-indigo-400 mt-2 shrink-0"></span><span>Red flag violations trigger immediate supervisor escalation alerts.</span></li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
