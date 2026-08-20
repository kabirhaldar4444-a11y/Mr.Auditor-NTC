import React, { useMemo } from 'react';
import { Phone, CheckCircle2, ShieldAlert, Cpu, Award, Flame, TrendingUp, Zap, Sparkles, LayoutDashboard, ArrowUpRight } from 'lucide-react';
import { SCRIPT_CHECKPOINTS } from '../data/scriptData';

export default function DashboardView({ calls, onRunBatchAudit, isAuditingBatch, onNavigateToAudits, onOpenUpload }) {
  const totalCalls = calls.length;
  const auditedCallsWithScore = calls.filter(c => c.status === 'Audited' && c.overallScore !== null && c.overallScore !== undefined);
  const auditedCalls = calls.filter(c => c.status === 'Audited').length;
  const pendingCalls = calls.filter(c => c.status !== 'Audited' && c.complianceStatus !== 'Unanswered').length;
  const passedCalls = calls.filter(c => c.complianceStatus === 'Passed').length;
  const failedCalls = calls.filter(c => c.complianceStatus === 'Critical Fail').length;

  const avgScore = auditedCallsWithScore.length > 0
    ? Math.round(auditedCallsWithScore.reduce((acc, curr) => acc + curr.overallScore, 0) / auditedCallsWithScore.length)
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
      const rate = auditedCallsWithScore.length > 0 ? Math.round((passedCount / auditedCallsWithScore.length) * 100) : 0;
      return { id: cp.id, label: cp.section, rate };
    });
  }, [calls, auditedCallsWithScore]);

  const agentLeaderboard = useMemo(() => {
    const agents = {};
    calls.forEach(call => {
      if (call.status !== 'Audited' || call.overallScore === null || call.overallScore === undefined || !call.agentName) return;
      if (!agents[call.agentName]) {
        agents[call.agentName] = { name: call.agentName, totalScore: 0, count: 0, criticalFails: 0 };
      }
      agents[call.agentName].totalScore += call.overallScore;
      agents[call.agentName].count += 1;
      if (call.complianceStatus === 'Critical Fail') agents[call.agentName].criticalFails += 1;
    });
    return Object.values(agents).map(ag => ({
      name: ag.name,
      avgScore: ag.count > 0 ? Math.round(ag.totalScore / ag.count) : 0,
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

  // Donut chart calculation
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
                fill={fillColor} rx="4" opacity="0.85" />
              <rect x={x} y={y} width={barWidth} height={Math.max(4, barHeight)}
                fill={fillColor} rx="4" opacity="0" className="group-hover:opacity-20" />
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
      <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
        <div className="campaign-hub-hero">
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#4f46e5', fontSize: '12px', fontWeight: '700', marginBottom: '12px' }}>
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Executive QA Portal</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', lineHeight: '1.2', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              QA Compliance Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: '500' }}>
              Real-time conversation audits, adherence rate tracking, and compliance analytics.
            </p>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '64px 32px', borderRadius: '24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <Phone className="w-14 h-14 text-indigo-500" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>No Call Data Loaded Yet</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto 20px auto' }}>
            Upload your SlashRTC call report (Excel or CSV) to visualize compliance rates and agent leaderboards.
          </p>
          <button onClick={onOpenUpload} className="btn-primary" style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}>
            <Phone className="w-4 h-4" />
            <span>Upload Your First Batch</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '64px' }} className="animate-in fade-in duration-200">

      {/* Premium Hero Header Banner */}
      <div className="campaign-hub-hero">
        <div style={{ zIndex: 2, maxWidth: '620px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#4f46e5', fontSize: '12px', fontWeight: '700', marginBottom: '12px' }}>
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
            <span>Executive QA Intelligence</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', lineHeight: '1.2', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            QA Compliance Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', margin: 0, fontWeight: '500' }}>
            Real-time conversation AI audits, script adherence scoring, and agent compliance risk metrics.
          </p>
        </div>

        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onNavigateToAudits} className="btn-secondary" style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}>
            Open Audits Log
          </button>
          <button
            disabled={isAuditingBatch || pendingCalls === 0}
            onClick={onRunBatchAudit}
            className="btn-primary"
            style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}
          >
            <Zap className="w-4 h-4" />
            <span>{isAuditingBatch ? 'Auditing...' : `Audit Pending (${pendingCalls})`}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards Bar */}
      <div className="campaign-summary-grid">

        <div className="campaign-stat-card border-t-4 border-t-indigo-500">
          <div className="campaign-stat-card-title">
            <span>Dataset Records</span>
            <Phone className="w-4 h-4 text-indigo-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value">{totalCalls.toLocaleString()}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', fontWeight: '600' }}>
              <span style={{ color: '#16a34a' }}>{auditedCalls} Audited</span>
              <span style={{ color: '#d97706' }}>{pendingCalls} Pending</span>
            </div>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-emerald-500">
          <div className="campaign-stat-card-title">
            <span>Adherence Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-emerald-600">{avgScore}%</span>
            <span className="campaign-stat-card-sub">Compliance target: &gt;85%</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-red-500">
          <div className="campaign-stat-card-title">
            <span>Red Flag Alerts</span>
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-red-600">{totalRedFlags}</span>
            <span className="campaign-stat-card-sub text-red-500" style={{ fontWeight: '700' }}>Requires Review</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-purple-500">
          <div className="campaign-stat-card-title">
            <span>AI Audit Engine</span>
            <Cpu className="w-4 h-4 text-purple-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-purple-600" style={{ fontSize: '22px' }}>Online</span>
            <span className="campaign-stat-card-sub">Latency ~800ms / record</span>
          </div>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '28px' }}>

        {/* Donut Chart */}
        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '28px', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>Audits Compliance Status</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Breakdown of evaluated call results</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '24px 0' }}>
            {totalAuditedSlice > 0 ? (
              <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 130 130">
                  <circle cx="65" cy="65" r={donutRadius} stroke="#fee2e2" strokeWidth="10" fill="transparent" />
                  <circle cx="65" cy="65" r={donutRadius} stroke="#10b981" strokeWidth="10" fill="transparent"
                    strokeDasharray={donutCircum} strokeDashoffset={passedOffset} className="transition-all duration-500" />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', display: 'block' }}>
                    {Math.round((passedCalls / totalAuditedSlice) * 100)}%
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Pass Rate</span>
                </div>
              </div>
            ) : (
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No audited data
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '22px', fontWeight: '900', color: '#15803d', display: 'block' }}>{passedCalls}</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534', marginTop: '2px', display: 'block' }}>Passed</span>
            </div>
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '14px', borderRadius: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '22px', fontWeight: '900', color: '#be123c', display: 'block' }}>{failedCalls}</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#9f1239', marginTop: '2px', display: 'block' }}>Critical Fail</span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '28px', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>Script Rubrics Adherence Rates</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Compliance passing percentages for each script checkpoint</p>
          </div>

          <div style={{ margin: '20px 0', minHeight: '180px' }}>
            {barChartSvg}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', fontSize: '12px', fontWeight: '600' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }}></span>
              Passed (&gt;80%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b' }}></span>
              Warning (60-79%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ef4444' }}></span>
              Violated (&lt;60%)
            </span>
          </div>
        </div>

      </div>

      {/* Leaderboard & Red Flags Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* Agent Leaderboard */}
        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Agent Performance Rankings</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Ranked by average script adherence score</p>
            </div>
          </div>

          {agentLeaderboard.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No audited agent scores available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agentLeaderboard.slice(0, 5).map((ag, idx) => (
                <div key={ag.name} style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: idx === 0 ? '#d97706' : '#64748b', width: '20px' }}>#{idx + 1}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{ag.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{ag.callsCount} calls</span>
                    <span className="badge badge-info" style={{ fontSize: '12px', fontWeight: '800' }}>{ag.avgScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Violations */}
        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Flame className="w-5 h-5 text-red-500" />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Common Script Violations</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Detected compliance red flags across calls</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {violationCounts.map((v) => (
              <div key={v.name} style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{v.name}</span>
                  <span className={`badge ${v.severityColor}`}>{v.count} alerts</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (v.count / (totalCalls || 1)) * 100 * 5)}%` }} className={v.color}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
