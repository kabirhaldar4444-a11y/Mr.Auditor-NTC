import React, { useMemo } from 'react';
import { Award, User, ShieldAlert, CheckCircle2, Users, Sparkles } from 'lucide-react';

export default function AgentPerformanceView({ calls, onSelectAgentFilter }) {

  const agentStats = useMemo(() => {
    const agents = {};
    calls.forEach(call => {
      const name = call.agentName || 'Unknown Agent';
      if (!agents[name]) {
        agents[name] = { name, code: call.agentCode || 'N/A', totalCalls: 0, auditedCalls: 0, totalScore: 0, passedCount: 0, failedCount: 0, redFlagsCount: 0 };
      }
      agents[name].totalCalls += 1;
      if (call.status === 'Audited') {
        if (call.overallScore !== null && call.overallScore !== undefined) {
          agents[name].auditedCalls += 1;
          agents[name].totalScore += call.overallScore;
        }
        agents[name].redFlagsCount += call.redFlagsCount || 0;
        if (call.complianceStatus === 'Passed') agents[name].passedCount += 1;
        else if (call.complianceStatus === 'Critical Fail') agents[name].failedCount += 1;
      }
    });

    return Object.values(agents).map(ag => {
      const avgScore = ag.auditedCalls > 0 ? Math.round(ag.totalScore / ag.auditedCalls) : 0;
      let rating = 'No Audits';
      let ratingClass = 'badge-info';
      if (ag.auditedCalls > 0) {
        if (avgScore >= 85 && ag.failedCount === 0) { rating = 'Elite Compliance'; ratingClass = 'badge-success'; }
        else if (avgScore >= 70 && ag.failedCount <= 1) { rating = 'Satisfactory'; ratingClass = 'badge-warning'; }
        else { rating = 'High Violation Risk'; ratingClass = 'badge-danger'; }
      }
      return { ...ag, avgScore, rating, ratingClass };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [calls]);

  if (calls.length === 0) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto' }} className="space-y-8 pb-16 animate-in fade-in duration-200">
        <div className="campaign-hub-hero">
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Associate Analytics</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', lineHeight: '1.2', margin: '0 0 8px 0' }}>
              Agent Performance Hub
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Compliance performance, statistics, and risk ratings per agent.
            </p>
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '64px 32px', borderRadius: '24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <Award className="w-14 h-14 text-indigo-500" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>No Agent Data Loaded</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto' }}>
            Upload call records to visualize per-agent compliance scores and risk rankings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '64px' }} className="animate-in fade-in duration-200 space-y-8">
      
      {/* Dark Hero Header Banner */}
      <div className="campaign-hub-hero">
        <div style={{ zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Associate Compliance Engine</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', lineHeight: '1.2', margin: '0 0 8px 0' }}>
            Agent Performance Hub
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '580px', lineHeight: '1.6' }}>
            Compliance performance, script adherence rates, and risk ratings categorized per associate.
          </p>
        </div>

        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(51, 65, 85, 0.8)', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Total Agents</span>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#ffffff', display: 'block', marginTop: '2px' }}>{agentStats.length}</span>
          </div>
        </div>
      </div>

      {/* Main Agent Table Card */}
      <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ paddingBottom: '16px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award className="w-5 h-5 text-indigo-600" />
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Agent Compliance Roster</h3>
            <span className="badge badge-info">{agentStats.length} Associates</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Agent Profile</th>
                <th style={{ textAlign: 'center' }}>Total Assigned</th>
                <th style={{ textAlign: 'center' }}>Audited</th>
                <th style={{ textAlign: 'center' }}>Compliant</th>
                <th style={{ textAlign: 'center' }}>Critical Fails</th>
                <th style={{ textAlign: 'center' }}>Red Flags</th>
                <th style={{ textAlign: 'center' }}>Avg Score</th>
                <th style={{ textAlign: 'center' }}>Compliance Band</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.map((agent) => (
                <tr key={agent.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {agent.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{agent.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>Code: {agent.code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: '900', fontSize: '15px' }}>{agent.totalCalls}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: '800' }}>{agent.auditedCalls}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>({Math.round((agent.auditedCalls / agent.totalCalls) * 100)}%)</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: '#16a34a', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {agent.passedCount}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: '#dc2626', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldAlert className="w-3.5 h-3.5" /> {agent.failedCount}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {agent.redFlagsCount > 0 ? (
                      <span className="badge badge-danger">{agent.redFlagsCount}</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>0</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {agent.auditedCalls > 0 ? (
                      <span style={{ fontWeight: '900', fontSize: '15px' }} className={
                        agent.avgScore >= 80 ? 'text-emerald-600' :
                        agent.avgScore >= 60 ? 'text-amber-600' : 'text-rose-600'
                      }>{agent.avgScore}%</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>N/A</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${agent.ratingClass}`}>{agent.rating}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectAgentFilter(agent.name)}
                      className="btn-secondary"
                      style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' }}
                    >
                      Filter Audits
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
