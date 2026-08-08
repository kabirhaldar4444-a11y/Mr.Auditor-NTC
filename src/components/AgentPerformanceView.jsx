import React, { useMemo } from 'react';
import { Award, User, Volume2, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function AgentPerformanceView({ calls, onSelectAgentFilter }) {
  
  const agentStats = useMemo(() => {
    const agents = {};

    calls.forEach(call => {
      const name = call.agentName || 'Unknown Agent';
      if (!agents[name]) {
        agents[name] = {
          name,
          code: call.agentCode || 'N/A',
          totalCalls: 0,
          auditedCalls: 0,
          pendingCalls: 0,
          totalScore: 0,
          passedCount: 0,
          failedCount: 0,
          redFlagsCount: 0
        };
      }

      agents[name].totalCalls += 1;
      if (call.status === 'Audited') {
        agents[name].auditedCalls += 1;
        agents[name].totalScore += call.overallScore || 0;
        agents[name].redFlagsCount += call.redFlagsCount || 0;
        if (call.complianceStatus === 'Passed') {
          agents[name].passedCount += 1;
        } else if (call.complianceStatus === 'Critical Fail') {
          agents[name].failedCount += 1;
        }
      } else {
        agents[name].pendingCalls += 1;
      }
    });

    return Object.values(agents).map(ag => {
      const avgScore = ag.auditedCalls > 0 ? Math.round(ag.totalScore / ag.auditedCalls) : 0;
      let rating = 'No Audits';
      let ratingColor = 'bg-slate-150 text-slate-500 border border-slate-200';
      
      if (ag.auditedCalls > 0) {
        if (avgScore >= 85 && ag.failedCount === 0) {
          rating = 'Elite Compliance';
          ratingColor = 'badge-success';
        } else if (avgScore >= 70 && ag.failedCount <= 1) {
          rating = 'Satisfactory';
          ratingColor = 'badge-info';
        } else {
          rating = 'High Violation Risk';
          ratingColor = 'badge-danger';
        }
      }

      return {
        ...ag,
        avgScore,
        rating,
        ratingColor
      };
    }).sort((a, b) => b.avgScore - a.avgScore);

  }, [calls]);

  if (calls.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)]">Agent Performance Logs</h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Compliance performance, call auditing statistics, and risk rating levels per agent.</p>
        </div>
        <div className="card-white p-12 text-center flex flex-col items-center justify-center space-y-6 border border-slate-200 shadow-md">
          <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
            <Award className="w-8 h-8" />
          </div>
          
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-extrabold text-[var(--text-primary)]">No Agent Data Yet</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
              We cannot calculate compliance rankings because no call records have been uploaded yet. Please import your dialer logs spreadsheet report to start scoring your agents.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <div>
        <h2 className="text-xl font-extrabold text-[var(--text-primary)]">Agent Performance Logs</h2>
        <p className="text-xs text-[var(--text-secondary)] font-medium">Compliance performance, call auditing statistics, and risk rating levels per agent.</p>
      </div>

      <div className="card-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-card-subtle)]/50 border-b border-[var(--border-color)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="py-3.5 px-5">Agent Profile</th>
                <th className="py-3.5 px-5 text-center">Total Assigned</th>
                <th className="py-3.5 px-5 text-center">Audited Log</th>
                <th className="py-3.5 px-5 text-center">Compliant</th>
                <th className="py-3.5 px-5 text-center">Critical Fails</th>
                <th className="py-3.5 px-5 text-center">Total Alerts</th>
                <th className="py-3.5 px-5 text-center">Adherence score</th>
                <th className="py-3.5 px-5 text-center">Compliance Band</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)]">
              {agentStats.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--text-muted)]">No agent data found</td>
                </tr>
              ) : (
                agentStats.map((agent) => (
                  <tr key={agent.name} className="hover:bg-[var(--bg-card-subtle)]/30 transition-colors">
                    
                    {/* Profile */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-extrabold text-[var(--text-primary)]">{agent.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">Code: {agent.code}</div>
                        </div>
                      </div>
                    </td>

                    {/* Assigned */}
                    <td className="py-4 px-5 text-center font-bold text-[var(--text-primary)]">
                      {agent.totalCalls}
                    </td>

                    {/* Audited */}
                    <td className="py-4 px-5 text-center font-medium">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-[var(--text-primary)] font-bold">{agent.auditedCalls}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">({Math.round((agent.auditedCalls / agent.totalCalls) * 100)}%)</span>
                      </div>
                    </td>

                    {/* Compliant */}
                    <td className="py-4 px-5 text-center">
                      <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500/10" />
                        {agent.passedCount}
                      </span>
                    </td>

                    {/* Fails */}
                    <td className="py-4 px-5 text-center">
                      <span className="text-rose-500 font-bold flex items-center justify-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 fill-rose-500/10" />
                        {agent.failedCount}
                      </span>
                    </td>

                    {/* Flags */}
                    <td className="py-4 px-5 text-center font-bold">
                      {agent.redFlagsCount > 0 ? (
                        <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">{agent.redFlagsCount}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>

                    {/* Avg Score */}
                    <td className="py-4 px-5 text-center font-extrabold text-sm">
                      {agent.auditedCalls > 0 ? (
                        <span className={`${
                          agent.avgScore >= 80 ? 'text-emerald-600' :
                          agent.avgScore >= 60 ? 'text-amber-600' : 'text-rose-500'
                        }`}>
                          {agent.avgScore}%
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium text-xs italic">N/A</span>
                      )}
                    </td>

                    {/* Rating Badge */}
                    <td className="py-4 px-5 text-center">
                      <span className={`badge ${agent.ratingColor}`}>
                        {agent.rating}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => onSelectAgentFilter(agent.name)}
                        className="btn-secondary py-1.5 px-3 text-[11px] font-bold border-[var(--border-color)] hover:bg-[var(--bg-card-subtle)]"
                      >
                        Filter Audits
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
