import React from 'react';
import { Award, FileText, CheckCircle2, ShieldAlert, BadgeCheck, HelpCircle } from 'lucide-react';
import { SCRIPT_CHECKPOINTS, RED_FLAG_RULES } from '../data/scriptData';

export default function ScriptCheckpointsView() {
  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div>
        <h2 className="text-xl font-extrabold text-[var(--text-primary)]">DPR Audit Compliance Guidelines</h2>
        <p className="text-xs text-[var(--text-secondary)] font-medium">Standard checkpoint checklist and critical evaluation rules mapped to ChatGPT models.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Script Checkpoints Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-white p-5">
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
              <span>DPR HR Screening Script Flow (10 Checkpoints)</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-4">Official checkpoints mapped to point weights (Total: 100 points)</p>
            
            <div className="divide-y divide-[var(--border-color)]">
              {SCRIPT_CHECKPOINTS.map((cp) => (
                <div key={cp.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-blue-500/10 text-blue-600 flex items-center justify-center font-mono text-xs font-extrabold shrink-0">
                        {cp.id.replace('CP', '')}
                      </span>
                      <h4 className="font-bold text-xs text-[var(--text-primary)]">{cp.title}</h4>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                      {cp.section} ({cp.weight} pts)
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium pl-8">{cp.description}</p>
                  
                  {cp.standardPhrases && cp.standardPhrases.length > 0 && (
                    <div className="pl-8 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                      <span className="text-[var(--text-muted)] font-bold">Standard Key-phrases:</span>
                      {cp.standardPhrases.map(phrase => (
                        <span key={phrase} className="bg-emerald-500/5 text-emerald-700 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  )}

                  {cp.prohibitedPhrases && cp.prohibitedPhrases.length > 0 && (
                    <div className="pl-8 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                      <span className="text-rose-500 font-bold">Prohibited words:</span>
                      {cp.prohibitedPhrases.map(phrase => (
                        <span key={phrase} className="bg-rose-500/5 text-rose-700 border border-rose-500/10 px-1.5 py-0.5 rounded">
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

        {/* Right Column: AI Violation Rules and Settings */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Red flag violations block */}
          <div className="card-white p-5 border-rose-500/20 bg-rose-500/5">
            <h3 className="font-extrabold text-rose-600 text-sm mb-1 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>ChatGPT Red Flag Penalty Rules</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-4">Immediate audit failure and score deductions criteria</p>
            
            <div className="space-y-3.5">
              {RED_FLAG_RULES.map((rule) => (
                <div key={rule.code} className="p-3 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl text-xs font-semibold space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                    <span className="text-rose-500 block truncate max-w-[150px]">{rule.title}</span>
                    <span className="bg-rose-500/10 text-rose-500 text-[10px] px-2 py-0.5 rounded font-mono shrink-0">{rule.severity}</span>
                  </div>
                  <p className="text-[var(--text-secondary)] font-medium leading-relaxed">{rule.description}</p>
                  <div className="text-[10px] text-rose-600 font-bold bg-rose-500/5 p-1 rounded inline-block">
                    Penalty: -{rule.penalty} pts
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick FAQ / Audit Tip card */}
          <div className="card-white p-5">
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-2 flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-blue-500" />
              <span>QA Auditing Protocols</span>
            </h3>
            <ul className="text-xs text-[var(--text-secondary)] font-medium list-disc pl-4 space-y-2">
              <li>Auditors must inspect critical failed calls for immediate supervisor action.</li>
              <li>Fake certificate recommendations violate DPR candidate safety rules and result in instant script failure.</li>
              <li>The official DPR domain redirect mandate requires a visit instructions trigger statement referencing **www.dprusa.in**.</li>
              <li>Neutral honorific greeting rules forbid calling candidates "Sir" or "Ma'am".</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
