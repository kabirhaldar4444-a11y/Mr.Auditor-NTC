import React, { useMemo } from 'react';
import { Phone, CheckCircle2, ShieldAlert, Cpu, Award, Flame, TrendingUp, Zap } from 'lucide-react';
import { SCRIPT_CHECKPOINTS } from '../data/scriptData';

export default function DashboardView({ calls, onRunBatchAudit, isAuditingBatch, onNavigateToAudits, onOpenUpload }) {
  const totalCalls = calls.length;
  const auditedCalls = calls.filter(c => c.status === 'Audited').length;
  const pendingCalls = totalCalls - auditedCalls;
  const passedCalls = calls.filter(c => c.complianceStatus === 'Passed').length;
  const failedCalls = calls.filter(c => c.complianceStatus === 'Critical Fail').length;

  const avgScore = auditedCalls > 0
    ? Math.round(calls.filter(c => c.status === 'Audited').reduce((acc, curr) => acc + (curr.overallScore || 0), 0) / auditedCalls)
    : 0;

  const totalRedFlags = calls.reduce((acc, curr) => acc + (curr.redFlagsCount || 0), 0);

  // 1. Calculate checkpoint pass rates across audited calls
  const checkpointStats = useMemo(() => {
    return SCRIPT_CHECKPOINTS.map((cp) => {
      const evalKey = cp.id === 'CP1' ? 'greetingPassed' :
        cp.id === 'CP2' ? 'hrIntroPassed' :
        cp.id === 'CP3' ? 'eligibilityPassed' :
        cp.id === 'CP4' ? 'companyOverviewPassed' :
        cp.id === 'CP5' ? 'screeningQuestionsPassed' :
        cp.id === 'CP6' ? 'globalPitchPassed' :
        cp.id === 'CP7' ? 'behavioralPassed' :
        cp.id === 'CP8' ? 'certificationsPassed' :
        cp.id === 'CP9' ? 'joiningBonusPassed' : 'websiteRedirectPassed';

      const passedCount = calls.filter(c => c.status === 'Audited' && c.evaluation?.[evalKey]).length;
      const rate = auditedCalls > 0 ? Math.round((passedCount / auditedCalls) * 100) : 0;

      return {
        id: cp.id,
        label: cp.section,
        rate
      };
    });
  }, [calls, auditedCalls]);

  // 2. Calculate agent compliance leaderboard
  const agentLeaderboard = useMemo(() => {
    const agents = {};
    calls.forEach(call => {
      if (call.status !== 'Audited' || !call.agentName) return;
      if (!agents[call.agentName]) {
        agents[call.agentName] = { name: call.agentName, totalScore: 0, count: 0, criticalFails: 0 };
      }
      agents[call.agentName].totalScore += call.overallScore || 0;
      agents[call.agentName].count += 1;
      if (call.complianceStatus === 'Critical Fail') {
        agents[call.agentName].criticalFails += 1;
      }
    });

    return Object.values(agents).map(ag => ({
      name: ag.name,
      avgScore: Math.round(ag.totalScore / ag.count),
      callsCount: ag.count,
      criticalFails: ag.criticalFails
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [calls]);

  // 3. Count violations categories
  const violationCounts = useMemo(() => {
    let sirMaamCount = 0;
    let fakeCertCount = 0;
    let redirectCount = 0;

    calls.forEach(call => {
      if (call.status !== 'Audited' || !call.redFlags) return;
      call.redFlags.forEach(rf => {
        if (rf.code === 'RF_USED_SIR_MAAM') sirMaamCount++;
        if (rf.code === 'RF_FAKE_CERT_SELLING') fakeCertCount++;
        if (rf.code === 'RF_MISSING_WEBSITE_REDIRECT') redirectCount++;
      });
    });

    return [
      { name: "Fake Certificate Selling", count: fakeCertCount, color: "bg-rose-500", severity: "CRITICAL" },
      { name: "Missing Website Redirection", count: redirectCount, color: "bg-amber-500", severity: "HIGH" },
      { name: "Submissive Titles (Sir/Ma'am)", count: sirMaamCount, color: "bg-blue-500", severity: "MEDIUM" }
    ];
  }, [calls]);

  // SVG Circular Gauge Setup (Metric card 2)
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (avgScore / 100) * circumference;

  // Donut chart calculations
  const totalAuditedSlice = passedCalls + failedCalls;
  
  // Custom Donut SVG parameters
  const donutRadius = 46;
  const donutCircum = 2 * Math.PI * donutRadius;
  const passedOffset = donutCircum - (passedCalls / (totalAuditedSlice || 1)) * donutCircum;

  // Custom Inline SVG Bar Chart
  const barChartSvg = useMemo(() => {
    const chartHeight = 140; // height of chart area
    const chartWidth = 400;  // width of chart area
    const startX = 45;       // offset for y-axis text
    const startY = 20;       // top padding
    const gap = 12;          // gap between bars
    const barWidth = 24;     // bar width
    const totalBarWidth = barWidth + gap; // space for one bar

    return (
      <svg className="w-full h-full" viewBox="0 0 460 190" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal gridlines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = startY + chartHeight - (val / 100) * chartHeight;
          return (
            <g key={val}>
              <line 
                x1={startX} 
                y1={y} 
                x2={startX + chartWidth} 
                y2={y} 
                stroke="#e2e8f0" 
                strokeWidth="1" 
                strokeDasharray={val === 0 ? "0" : "3 3"}
              />
              <text 
                x={startX - 8} 
                y={y + 3} 
                textAnchor="end" 
                fill="#94a3b8" 
                fontSize="9" 
                fontWeight="700"
                className="font-mono"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Vertical bars & labels */}
        {checkpointStats.map((item, idx) => {
          const x = startX + idx * totalBarWidth + gap;
          const barHeight = (item.rate / 100) * chartHeight;
          const y = startY + chartHeight - barHeight;
          
          let fillColor = '#10b981'; // passed
          if (item.rate < 60) fillColor = '#f43f5e'; // fail
          else if (item.rate < 80) fillColor = '#f59e0b'; // warning

          return (
            <g key={item.id} className="group cursor-pointer">
              {/* Bar Rect */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(4, barHeight)}
                fill={fillColor}
                rx="3"
                className="transition-all duration-300 hover:opacity-90"
              />
              {/* Label text */}
              <text
                x={x + barWidth / 2}
                y={startY + chartHeight + 14}
                textAnchor="middle"
                fill="#64748b"
                fontSize="9"
                fontWeight="700"
                className="font-mono"
              >
                {item.id}
              </text>
              {/* Score text on top of bar on hover */}
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                fill="#0f172a"
                fontSize="9"
                fontWeight="800"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {item.rate}%
              </text>
            </g>
          );
        })}
      </svg>
    );
  }, [checkpointStats]);

  if (calls.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)]">QA Compliance Dashboard</h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Real-time ChatGPT conversation audits and script compliance tracking.</p>
        </div>
        
        <div className="card-white p-12 text-center flex flex-col items-center justify-center space-y-6 border border-slate-200 shadow-md">
          <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
            <Phone className="w-8 h-8" />
          </div>
          
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-extrabold text-[var(--text-primary)]">Compliance Dashboard Empty</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
              There are currently no call recordings loaded in the AI auditing system. Please upload your spreadsheet report (Excel/CSV) from your SlashRTC portal to visualize compliance rates, audit records, and agent leaderboards.
            </p>
          </div>
          
          <div>
            <button
              onClick={onOpenUpload}
              className="btn-primary text-xs font-bold py-2.5 px-6 shadow-md"
            >
              <Phone className="w-4 h-4 text-white" />
              <span>Upload Your First Batch</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Page Title & Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)]">QA Compliance Dashboard</h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Real-time ChatGPT conversation audits and script compliance tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onNavigateToAudits}
            className="btn-secondary text-xs font-bold py-2 border-[var(--border-color)] bg-white hover:bg-slate-50 shadow-2xs"
          >
            Open Audits Log
          </button>
          <button 
            disabled={isAuditingBatch || pendingCalls === 0}
            onClick={onRunBatchAudit}
            className="btn-primary text-xs font-bold py-2 flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
            <span>{isAuditingBatch ? 'Auditing Batch...' : `Audit Pending (${pendingCalls})`}</span>
          </button>
        </div>
      </div>

      {/* Top executive cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Batch Volume */}
        <div className="card-white p-5 flex items-center justify-between relative overflow-hidden group">
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Dataset Records</span>
            <span className="text-2xl font-extrabold text-[var(--text-primary)] block mt-1 tracking-tight">{totalCalls.toLocaleString()}</span>
            <div className="text-[11px] text-[var(--text-secondary)] font-semibold mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{auditedCalls} Audited</span>
              <span className="mx-1">•</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>{pendingCalls} Pending</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shadow-inner shrink-0">
            <Phone className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Adherence Score */}
        <div className="card-white p-5 flex items-center justify-between relative overflow-hidden group">
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Adherence Rate</span>
            <span className="text-2xl font-extrabold text-[var(--text-primary)] block mt-1 tracking-tight">{avgScore}%</span>
            <span className="text-[10px] text-[var(--text-secondary)] mt-2 font-medium block">Compliance target: &gt;85%</span>
          </div>

          <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r={radius}
                className={`transition-all duration-500 ${
                  avgScore >= 80 ? 'stroke-emerald-500' : avgScore >= 60 ? 'stroke-amber-500' : 'stroke-rose-500'
                }`}
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute text-[10px] font-extrabold text-[var(--text-primary)]">{avgScore}%</span>
          </div>
        </div>

        {/* Metric 3: Alerts Block */}
        <div className="card-white p-5 flex items-center justify-between relative overflow-hidden group">
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Red Flag Alerts</span>
            <span className="text-2xl font-extrabold text-rose-500 block mt-1 tracking-tight">{totalRedFlags}</span>
            <span className="text-[10px] text-rose-600 mt-2 font-semibold block flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-rose-500/10" />
              <span>Requires review</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shadow-inner shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: AI Operations */}
        <div className="card-white p-5 flex items-center justify-between bg-gradient-to-br from-indigo-500/5 to-indigo-600/5 border-indigo-500/20 shrink-0">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">ChatGPT Engine</span>
            <span className="text-sm font-extrabold text-[var(--text-primary)] block mt-1">Status: Active</span>
            <span className="text-[10px] text-[var(--text-secondary)] mt-2 font-medium block">Speed: ~800ms / Call</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Cpu className="w-4.5 h-4.5 animate-pulse" />
          </div>
        </div>

      </div>

      {/* Analytics charts panels grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Donut compliance states */}
        <div className="card-white p-5 flex flex-col justify-between lg:col-span-1">
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-0.5">Audits Compliance Status</h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">Breakdown of evaluated call results</p>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            {totalAuditedSlice > 0 ? (
              <div className="relative flex items-center justify-center w-40 h-40">
                <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    className="stroke-rose-500"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    className="stroke-emerald-500 transition-all duration-500"
                    strokeWidth="8"
                    strokeDasharray={donutCircum}
                    strokeDashoffset={passedOffset}
                    fill="transparent"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-extrabold text-[var(--text-primary)] block tracking-tight">
                    {Math.round((passedCalls / totalAuditedSlice) * 100)}%
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)] uppercase font-extrabold tracking-wider mt-0.5 block">Pass Rate</span>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-xs text-[var(--text-muted)] font-semibold">
                No audited data to display
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 w-full mt-5 text-xs font-semibold">
              <div className="p-2.5 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] text-center">
                <span className="block text-emerald-600 font-extrabold text-base">{passedCalls}</span>
                <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">Passed</span>
              </div>
              <div className="p-2.5 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] text-center">
                <span className="block text-rose-500 font-extrabold text-base">{failedCalls}</span>
                <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">Critical Fail</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Script checkpoints pass rates */}
        <div className="card-white p-5 lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-0.5">Script Rubrics Adherence Rates</h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">Compliance passing percentages for each script section</p>
          </div>

          <div className="flex-1 min-h-[170px] flex items-center justify-center px-1">
            {auditedCalls > 0 ? (
              barChartSvg
            ) : (
              <div className="text-xs text-[var(--text-muted)] font-semibold italic">
                Awaiting audit evaluations to populate checkpoints rates...
              </div>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-[9px] text-[var(--text-secondary)] font-bold px-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500"></span> Passed (&gt;80%)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-amber-500"></span> Warning (60-79%)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-rose-500"></span> Violated (&lt;60%)</span>
          </div>
        </div>

      </div>

      {/* Leaderboard and violations list grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Agent compliance leaderboard */}
        <div className="card-white p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-1 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500 fill-amber-500/10" />
              <span>Agent Performance Rankings</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">Ranked by average ChatGPT script adherence score</p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs font-semibold text-[var(--text-secondary)]">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[10px] text-[var(--text-muted)] uppercase font-bold">
                  <th className="py-2.5">Rank</th>
                  <th className="py-2.5">Agent Name</th>
                  <th className="py-2.5 text-center">Audited Calls</th>
                  <th className="py-2.5 text-center">Critical Flags</th>
                  <th className="py-2.5 text-right">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {agentLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[var(--text-muted)] font-medium">No audited agent records found</td>
                  </tr>
                ) : (
                  agentLeaderboard.map((agent, index) => (
                    <tr key={agent.name} className="hover:bg-[var(--bg-card-subtle)]/40 transition-colors">
                      <td className="py-2.5 text-[var(--text-primary)] font-extrabold">#{index + 1}</td>
                      <td className="py-2.5 font-bold text-[var(--text-primary)]">{agent.name}</td>
                      <td className="py-2.5 text-center">{agent.callsCount}</td>
                      <td className="py-2.5 text-center">
                        {agent.criticalFails > 0 ? (
                          <span className="text-rose-500 font-bold bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">{agent.criticalFails} Fails</span>
                        ) : (
                          <span className="text-emerald-500 font-semibold">0</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                          agent.avgScore >= 80 ? 'bg-emerald-500/10 text-emerald-600' :
                          agent.avgScore >= 60 ? 'bg-amber-500/10 text-amber-600' :
                          'bg-rose-500/10 text-rose-600'
                        }`}>
                          {agent.avgScore}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Violations breakdown panel */}
        <div className="card-white p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-1 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span>Common Script Violations Breakdown</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-4">Total detected compliance red flags across audited calls</p>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {violationCounts.map((v) => {
              const maxVal = Math.max(...violationCounts.map(vc => vc.count)) || 1;
              const widthPct = Math.round((v.count / maxVal) * 100);
              
              return (
                <div key={v.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[var(--text-primary)] font-bold">{v.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">{v.severity}</span>
                      <strong className="text-[var(--text-primary)]">{v.count} alerts</strong>
                    </div>
                  </div>
                  
                  <div className="w-full bg-[var(--bg-card-subtle)] h-1.5 rounded-full overflow-hidden border border-[var(--border-color)]">
                    <div 
                      className={`h-full rounded-full ${v.color} transition-all duration-500`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
