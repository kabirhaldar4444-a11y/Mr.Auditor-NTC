import React from 'react';
import { Phone, CheckCircle2, ShieldAlert, Cpu, Zap, Activity } from 'lucide-react';

export default function StatsOverview({ calls, onRunBatchAudit, isAuditingBatch }) {
  const totalCalls = calls.length;
  const auditedCallsWithScore = calls.filter(c => c.status === 'Audited' && c.overallScore !== null && c.overallScore !== undefined);
  const auditedCalls = calls.filter(c => c.status === 'Audited').length;
  const pendingCalls = calls.filter(c => c.status !== 'Audited' && c.complianceStatus !== 'Unanswered').length;
  
  const avgScore = auditedCallsWithScore.length > 0
    ? Math.round(auditedCallsWithScore.reduce((acc, curr) => acc + curr.overallScore, 0) / auditedCallsWithScore.length)
    : 0;

  const passedCalls = calls.filter(c => c.complianceStatus === 'Passed').length;
  const criticalFails = calls.filter(c => c.complianceStatus === 'Critical Fail').length;
  const totalRedFlags = calls.reduce((acc, curr) => acc + (curr.redFlagsCount || 0), 0);

  // SVG Circular Gauge Setup
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (avgScore / 100) * circumference;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* Metric 1: Total Queue Volume */}
      <div className="card-white p-5 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300"></div>
        <div className="flex items-center justify-between z-10">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Dataset Batch Volume</span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Phone className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 z-10">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[var(--text-primary)]">{totalCalls.toLocaleString()}</span>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">records</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>High-volume 50K - 60K Pipeline</span>
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs font-semibold z-10">
          <span className="text-emerald-600">{auditedCalls} Audited</span>
          <span className="text-amber-600">{pendingCalls} Pending</span>
        </div>
      </div>

      {/* Metric 2: Average Script Adherence */}
      <div className="card-white p-5 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300"></div>
        <div className="flex items-center justify-between z-10">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Script Adherence Score</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 z-10">
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold ${avgScore >= 80 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                {avgScore}%
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">avg quality rating</p>
          </div>

          {/* Glowing Circular Gauge */}
          <div className="relative flex items-center justify-center w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="4.5"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                className={`transition-all duration-500 ${
                  avgScore >= 80 ? 'stroke-emerald-500' : avgScore >= 60 ? 'stroke-amber-500' : 'stroke-rose-500'
                }`}
                strokeWidth="4.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute text-[11px] font-extrabold text-[var(--text-primary)]">{avgScore}%</span>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)] font-medium z-10">
          <span>Compliant: <strong className="text-[var(--text-primary)] font-bold">{passedCalls}</strong></span>
          <span>Target: <strong className="text-[var(--text-primary)] font-bold">&gt; 85%</strong></span>
        </div>
      </div>

      {/* Metric 3: Critical Compliance Flags */}
      <div className="card-white p-5 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all duration-300"></div>
        <div className="flex items-center justify-between z-10">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Compliance Red Flags</span>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 z-10">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-500">{criticalFails}</span>
            <span className="text-xs font-semibold text-rose-600 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
              {totalRedFlags} Alerts
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-snug">
            Detects fake cert sales, missing website redirect & honorific violations.
          </p>
        </div>
        <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)] z-10">
          <span className="text-rose-500 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            Immediate Review Required
          </span>
        </div>
      </div>

      {/* Metric 4: AI Batch Trigger */}
      <div className="card-white p-5 flex flex-col justify-between bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-500/20 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="flex items-center justify-between z-10">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">ChatGPT AI Engine</span>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 z-10">
          <p className="text-xs text-[var(--text-secondary)] mb-3 leading-snug">
            Parallel speech modeling, script matching & dynamic scorecard synthesis.
          </p>
          <button
            onClick={onRunBatchAudit}
            disabled={isAuditingBatch}
            className="w-full btn-primary py-2.5 text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group-hover:scale-[1.01]"
          >
            {isAuditingBatch ? (
              <>
                <Zap className="w-4 h-4 animate-spin text-white" />
                <span>Auditing Batch...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
                <span>Run AI Audit All Calls</span>
              </>
            )}
          </button>
        </div>
        <div className="mt-3 pt-2 text-center border-t border-[var(--border-color)] z-10">
          <span className="text-[11px] text-[var(--text-muted)] font-medium">Fast parallel worker threads</span>
        </div>
      </div>

    </div>
  );
}
