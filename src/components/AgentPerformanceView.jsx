import React, { useMemo } from 'react';
import { Award, User, ShieldAlert, CheckCircle2 } from 'lucide-react';

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
        agents[name].auditedCalls += 1;
        agents[name].totalScore += call.overallScore || 0;
        agents[name].redFlagsCount += call.redFlagsCount || 0;
        if (call.complianceStatus === 'Passed') agents[name].passedCount += 1;
        else if (call.complianceStatus === 'Critical Fail') agents[name].failedCount += 1;
      }
    });

    return Object.values(agents).map(ag => {
      const avgScore = ag.auditedCalls > 0 ? Math.round(ag.totalScore / ag.auditedCalls) : 0;
      let rating = 'No Audits';
      let ratingClass = 'bg-gray-100 text-gray-600 border-gray-200';
      if (ag.auditedCalls > 0) {
        if (avgScore >= 85 && ag.failedCount === 0) { rating = 'Elite Compliance'; ratingClass = 'badge-success'; }
        else if (avgScore >= 70 && ag.failedCount <= 1) { rating = 'Satisfactory'; ratingClass = 'badge-info'; }
        else { rating = 'High Violation Risk'; ratingClass = 'badge-danger'; }
      }
      return { ...ag, avgScore, rating, ratingClass };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [calls]);

  if (calls.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Agent Performance</h2>
          <p className="text-[var(--text-muted)] mt-1">Compliance metrics and risk analysis per agent.</p>
        </div>
        <div className="card-white p-16 text-center flex flex-col items-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
            <Award className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">No Agent Data Yet</h3>
            <p className="text-[var(--text-muted)]">Upload call records to see per-agent compliance rankings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Agent Performance</h2>
        <p className="text-[var(--text-muted)] mt-1">Compliance performance, statistics, and risk ratings per agent.</p>
      </div>

      <div className="card-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                <th className="py-4 px-6">Agent Profile</th>
                <th className="py-4 px-6 text-center">Total Assigned</th>
                <th className="py-4 px-6 text-center">Audited</th>
                <th className="py-4 px-6 text-center">Compliant</th>
                <th className="py-4 px-6 text-center">Critical Fails</th>
                <th className="py-4 px-6 text-center">Red Flags</th>
                <th className="py-4 px-6 text-center">Avg Score</th>
                <th className="py-4 px-6 text-center">Compliance Band</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {agentStats.map((agent) => (
                <tr key={agent.name} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0">
                        <User className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--text-primary)] text-sm">{agent.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">Code: {agent.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center font-bold font-mono text-[var(--text-primary)]">{agent.totalCalls}</td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-mono font-semibold text-[var(--text-secondary)]">{agent.auditedCalls}</span>
                    <span className="text-[11px] text-[var(--text-muted)] ml-1">({Math.round((agent.auditedCalls / agent.totalCalls) * 100)}%)</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-emerald-600 font-semibold font-mono flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {agent.passedCount}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-red-600 font-semibold font-mono flex items-center justify-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> {agent.failedCount}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {agent.redFlagsCount > 0 ? (
                      <span className="text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full text-[12px] font-bold font-mono">{agent.redFlagsCount}</span>
                    ) : (
                      <span className="text-[var(--text-muted)] font-mono text-sm">0</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {agent.auditedCalls > 0 ? (
                      <span className={`font-bold font-mono text-sm ${
                        agent.avgScore >= 80 ? 'text-emerald-700' :
                        agent.avgScore >= 60 ? 'text-amber-700' : 'text-red-700'
                      }`}>{agent.avgScore}%</span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-sm italic">N/A</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`badge ${agent.ratingClass}`}>{agent.rating}</span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button onClick={() => onSelectAgentFilter(agent.name)} className="btn-secondary py-1.5 px-4 text-[13px] font-medium">
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
