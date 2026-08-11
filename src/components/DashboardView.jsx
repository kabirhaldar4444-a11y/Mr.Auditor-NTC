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
      return { id: cp.id, label: cp.section, rate };
    });
  }, [calls, auditedCalls]);

  const agentLeaderboard = useMemo(() => {
    const agents = {};
    calls.forEach(call => {
      if (call.status !== 'Audited' || !call.agentName) return;
      if (!agents[call.agentName]) {
        agents[call.agentName] = { name: call.agentName, totalScore: 0, count: 0, criticalFails: 0 };
      }
      agents[call.agentName].totalScore += call.overallScore || 0;
      agents[call.agentName].count += 1;
      if (call.complianceStatus === 'Critical Fail') agents[call.agentName].criticalFails += 1;
    });
    return Object.values(agents).map(ag => ({
      name: ag.name,
      avgScore: Math.round(ag.totalScore / ag.count),
      callsCount: ag.count,
      criticalFails: ag.criticalFails
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [calls]);

  const violationCounts = useMemo(() => {
    let sirMaamCount = 0, fakeCertCount = 0, redirectCount = 0;
    calls.forEach(call => {
      if (call.status !== 'Audited' || !call.redFlags) return;
      call.redFlags.forEach(rf => {
        if (rf.code === 'RF_USED_SIR_MAAM') sirMaamCount++;
        if (rf.code === 'RF_FAKE_CERT_SELLING') fakeCertCount++;
        if (rf.code === 'RF_MISSING_WEBSITE_REDIRECT') redirectCount++;
      });
    });
    return [
      { name: "Fake Certificate Selling", count: fakeCertCount, color: "bg-red-500", severity: "CRITICAL", severityColor: "text-red-600 bg-red-50 border-red-200" },
      { name: "Missing Website Redirection", count: redirectCount, color: "bg-amber-400", severity: "HIGH", severityColor: "text-amber-700 bg-amber-50 border-amber-200" },
      { name: "Submissive Titles (Sir/Ma'am)", count: sirMaamCount, color: "bg-blue-400", severity: "MEDIUM", severityColor: "text-blue-700 bg-blue-50 border-blue-200" }
    ];
  }, [calls]);

  // SVG Circular Gauge
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (avgScore / 100) * circumference;

  // Donut chart
  const totalAuditedSlice = passedCalls + failedCalls;
  const donutRadius = 52;
  const donutCircum = 2 * Math.PI * donutRadius;
  const passedOffset = donutCircum - (passedCalls / (totalAuditedSlice || 1)) * donutCircum;

  const barChartSvg = useMemo(() => {
    const chartHeight = 130;
    const chartWidth = 380;
    const startX = 40;
    const startY = 15;
    const gap = 10;
    const barWidth = 22;
    const totalBarWidth = barWidth + gap;

    return (
      <svg className="w-full h-full" viewBox="0 0 450 185" xmlns="http://www.w3.org/2000/svg">
        {[0, 25, 50, 75, 100].map((val) => {
          const y = startY + chartHeight - (val / 100) * chartHeight;
          return (
            <g key={val}>
              <line x1={startX} y1={y} x2={startX + chartWidth} y2={y}
                stroke={val === 0 ? '#e5e7eb' : '#f3f4f6'} strokeWidth="1"
                strokeDasharray={val === 0 ? '0' : '4 3'} />
              <text x={startX - 8} y={y + 4} textAnchor="end" fill="#9ca3af"
                fontSize="9" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
                {val}%
              </text>
            </g>
          );
        })}
        {checkpointStats.map((item, idx) => {
          const x = startX + idx * totalBarWidth + gap;
          const barHeight = (item.rate / 100) * chartHeight;
          const y = startY + chartHeight - barHeight;
          let fillColor = '#10b981';
          if (item.rate < 60) fillColor = '#ef4444';
          else if (item.rate < 80) fillColor = '#f59e0b';
          return (
            <g key={item.id} className="group cursor-pointer">
              <rect x={x} y={y} width={barWidth} height={Math.max(4, barHeight)}
                fill={fillColor} rx="3" opacity="0.85" />
              <rect x={x} y={y} width={barWidth} height={Math.max(4, barHeight)}
                fill={fillColor} rx="3" opacity="0" className="group-hover:opacity-20" />
              <text x={x + barWidth / 2} y={startY + chartHeight + 13} textAnchor="middle"
                fill="#9ca3af" fontSize="8.5" fontWeight="700"
                fontFamily="'JetBrains Mono', monospace">
                {item.id}
              </text>
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle"
                fill="#374151" fontSize="9" fontWeight="800"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                fontFamily="'JetBrains Mono', monospace">
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
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">QA Compliance Dashboard</h2>
          <p className="text-[var(--text-muted)] mt-1.5">Real-time conversation audits and script compliance tracking.</p>
        </div>
        <div className="card-white p-16 text-center flex flex-col items-center justify-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
            <Phone className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">No data loaded yet</h3>
            <p className="text-[var(--text-muted)] leading-relaxed">
              Upload your SlashRTC call report (Excel or CSV) to start visualizing compliance rates, audit scores, and agent leaderboards.
            </p>
          </div>
          <button onClick={onOpenUpload} className="btn-primary py-2.5 px-6 text-sm font-semibold flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>Upload Your First Batch</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">QA Compliance Dashboard</h2>
          <p className="text-[var(--text-muted)] mt-1">Real-time conversation audits and script compliance tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onNavigateToAudits} className="btn-secondary text-sm font-medium py-2.5 px-5">
            Open Audits Log
          </button>
          <button
            disabled={isAuditingBatch || pendingCalls === 0}
            onClick={onRunBatchAudit}
            className="btn-primary text-sm font-semibold py-2.5 px-5 flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            <span>{isAuditingBatch ? 'Auditing...' : `Audit Pending (${pendingCalls})`}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Card 1: Dataset Records */}
        <div className="card-white p-6 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Dataset Records</p>
            <p className="text-[32px] font-bold text-[var(--text-primary)] mt-2 leading-none tracking-tight font-mono">{totalCalls.toLocaleString()}</p>
            <div className="flex items-center gap-3 mt-3 text-[12px] font-medium">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {auditedCalls} Audited
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                {pendingCalls} Pending
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Adherence Rate */}
        <div className="card-white p-6 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Adherence Rate</p>
            <p className="text-[32px] font-bold text-[var(--text-primary)] mt-2 leading-none tracking-tight font-mono">{avgScore}%</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-3">Compliance target: &gt;85%</p>
          </div>
          <div className="relative w-14 h-14 shrink-0">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle cx="28" cy="28" r={radius} stroke="#f3f4f6" strokeWidth="4" fill="transparent" />
              <circle cx="28" cy="28" r={radius}
                stroke={avgScore >= 80 ? '#10b981' : avgScore >= 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round" fill="transparent" className="transition-all duration-500" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[var(--text-primary)] font-mono">{avgScore}%</span>
          </div>
        </div>

        {/* Card 3: Red Flag Alerts */}
        <div className="card-white p-6 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Red Flag Alerts</p>
            <p className="text-[32px] font-bold text-red-600 mt-2 leading-none tracking-tight font-mono">{totalRedFlags}</p>
            <p className="text-[12px] text-red-500 mt-3 flex items-center gap-1.5 font-medium">
              <Flame className="w-3.5 h-3.5" />
              Requires review
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-red-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: AI Status */}
        <div className="card-white p-6 flex items-center justify-between bg-indigo-50 border-indigo-100">
          <div>
            <p className="text-[12px] font-semibold text-indigo-500 uppercase tracking-wide">AI Audit Status</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-base font-bold text-[var(--text-primary)]">Online</span>
            </div>
            <p className="text-[12px] text-[var(--text-muted)] mt-3 font-mono">Latency: ~800ms / record</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Donut Chart */}
        <div className="card-white p-7 flex flex-col lg:col-span-1">
          <div className="mb-5">
            <h3 className="font-semibold text-[var(--text-primary)] text-base">Audits Compliance Status</h3>
            <p className="text-[13px] text-[var(--text-muted)] mt-1">Breakdown of evaluated call results</p>
          </div>

          <div className="flex flex-col items-center justify-center flex-1 py-4">
            {totalAuditedSlice > 0 ? (
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 130 130">
                  <circle cx="65" cy="65" r={donutRadius} stroke="#fee2e2" strokeWidth="9" fill="transparent" />
                  <circle cx="65" cy="65" r={donutRadius} stroke="#10b981" strokeWidth="9" fill="transparent"
                    strokeDasharray={donutCircum} strokeDashoffset={passedOffset} className="transition-all duration-500" />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-bold text-[var(--text-primary)] block font-mono">
                    {Math.round((passedCalls / totalAuditedSlice) * 100)}%
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wide mt-0.5 block">Pass Rate</span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-[var(--text-muted)] italic">
                No audited data
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 w-full mt-6">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                <span className="block text-2xl font-bold text-emerald-700 font-mono">{passedCalls}</span>
                <span className="text-[12px] text-emerald-600 font-medium mt-1 block">Passed</span>
              </div>
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                <span className="block text-2xl font-bold text-red-700 font-mono">{failedCalls}</span>
                <span className="text-[12px] text-red-600 font-medium mt-1 block">Critical Fail</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="card-white p-7 lg:col-span-2 flex flex-col">
          <div className="mb-5">
            <h3 className="font-semibold text-[var(--text-primary)] text-base">Script Rubrics Adherence Rates</h3>
            <p className="text-[13px] text-[var(--text-muted)] mt-1">Compliance passing percentages for each script checkpoint</p>
          </div>

          <div className="flex-1 min-h-[180px] flex items-center justify-center">
            {auditedCalls > 0 ? barChartSvg : (
              <p className="text-sm text-[var(--text-muted)] italic">Awaiting audit evaluations...</p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-[var(--border-color)] flex items-center justify-center gap-6 text-[12px] font-medium text-[var(--text-muted)]">
            <span className="flex items-center gap-2"><span className="w-3 h-2.5 rounded bg-emerald-500 opacity-85"></span> Passed (&gt;80%)</span>
            <span className="flex items-center gap-2"><span className="w-3 h-2.5 rounded bg-amber-400"></span> Warning (60–79%)</span>
            <span className="flex items-center gap-2"><span className="w-3 h-2.5 rounded bg-red-500 opacity-85"></span> Violated (&lt;60%)</span>
          </div>
        </div>

      </div>

      {/* Leaderboard & Violations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Agent Leaderboard */}
        <div className="card-white p-7">
          <div className="mb-5 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] text-base">Agent Performance Rankings</h3>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Ranked by average script adherence score</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  <th className="py-3 pr-4">Rank</th>
                  <th className="py-3 pr-4">Agent Name</th>
                  <th className="py-3 pr-4 text-center">Calls</th>
                  <th className="py-3 pr-4 text-center">Critical Flags</th>
                  <th className="py-3 text-right">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {agentLeaderboard.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-[var(--text-muted)] italic text-sm">No audited agent records</td></tr>
                ) : (
                  agentLeaderboard.map((agent, index) => (
                    <tr key={agent.name} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 pr-4 font-bold text-[var(--text-muted)] font-mono text-sm">#{index + 1}</td>
                      <td className="py-3.5 pr-4 font-semibold text-[var(--text-primary)] text-sm">{agent.name}</td>
                      <td className="py-3.5 pr-4 text-center text-sm font-mono text-[var(--text-secondary)]">{agent.callsCount}</td>
                      <td className="py-3.5 pr-4 text-center">
                        {agent.criticalFails > 0 ? (
                          <span className="text-red-600 font-semibold bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full text-[12px] font-mono">{agent.criticalFails} Fails</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold text-[12px] font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-[12px] font-bold font-mono ${
                          agent.avgScore >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          agent.avgScore >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>{agent.avgScore}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Violations Breakdown */}
        <div className="card-white p-7">
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] text-base">Common Script Violations</h3>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Total detected compliance red flags across audited calls</p>
            </div>
          </div>

          <div className="space-y-6">
            {violationCounts.map((v) => {
              const maxVal = Math.max(...violationCounts.map(vc => vc.count)) || 1;
              const widthPct = Math.round((v.count / maxVal) * 100);
              return (
                <div key={v.name} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{v.name}</span>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold font-mono ${v.severityColor}`}>{v.severity}</span>
                      <strong className="text-sm font-bold text-[var(--text-primary)] font-mono">{v.count} alerts</strong>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${v.color} transition-all duration-500`}
                      style={{ width: `${widthPct}%` }} />
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
