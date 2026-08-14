import React, { useState, useMemo } from 'react';
import {
  FolderKanban, Users, ShieldCheck, CheckCircle2, XCircle,
  Play, Sparkles, Clock, ArrowLeft, BarChart3, TrendingUp,
  AlertTriangle, Search, Phone, ChevronRight, FileSpreadsheet,
  ArrowUpRight, Activity, Zap, Layers, RefreshCw
} from 'lucide-react';
import CallTable from './CallTable';

// Helper for dynamic campaign theme colors
const getCampaignGradient = (name) => {
  const n = String(name || '').toUpperCase();
  if (n.includes('DPR')) return { bg: 'from-purple-600 to-indigo-600', text: 'text-purple-600', lightBg: 'bg-purple-50', border: 'border-purple-200' };
  if (n.includes('NTC')) return { bg: 'from-blue-600 to-indigo-600', text: 'text-blue-600', lightBg: 'bg-blue-50', border: 'border-blue-200' };
  if (n.includes('ISN')) return { bg: 'from-emerald-600 to-teal-600', text: 'text-emerald-600', lightBg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (n.includes('PMI')) return { bg: 'from-amber-500 to-orange-600', text: 'text-amber-600', lightBg: 'bg-amber-50', border: 'border-amber-200' };
  if (n.includes('NLPC')) return { bg: 'from-rose-500 to-pink-600', text: 'text-rose-600', lightBg: 'bg-rose-50', border: 'border-rose-200' };
  return { bg: 'from-indigo-600 to-violet-600', text: 'text-indigo-600', lightBg: 'bg-indigo-50', border: 'border-indigo-200' };
};

export default function CampaignRoomsView({
  calls = [],
  onSelectCall,
  onAuditSingleCall,
  isAuditingId,
  onDeleteCalls,
  onRunBatchAudit,
  isAuditingBatch,
  onOpenUpload,
  initialCampaignRoom = null
}) {
  const [selectedRoom, setSelectedRoom] = useState(initialCampaignRoom);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique campaigns and compute statistics for each room
  const campaignRooms = useMemo(() => {
    const roomsMap = {};

    calls.forEach((c) => {
      const roomName = (c.campaign || c.CAMPAIGN || c.process || 'General').trim() || 'Unassigned';
      if (!roomsMap[roomName]) {
        roomsMap[roomName] = {
          name: roomName,
          calls: [],
          auditedCount: 0,
          passedCount: 0,
          failedCount: 0,
          totalScoreSum: 0,
          scoreCount: 0,
          agentsSet: new Set(),
          talkTimeSeconds: 0
        };
      }

      const room = roomsMap[roomName];
      room.calls.push(c);

      if (c.agentName) room.agentsSet.add(c.agentName);

      // Audited state
      if (c.status === 'Audited' || c.overallScore !== null) {
        room.auditedCount++;
        if (typeof c.overallScore === 'number') {
          room.totalScoreSum += c.overallScore;
          room.scoreCount++;
        }
        if (c.complianceStatus === 'COMPLIANT' || c.complianceStatus === 'PASSED' || (c.overallScore && c.overallScore >= 70)) {
          room.passedCount++;
        } else {
          room.failedCount++;
        }
      }

      // Talk time calculation
      if (c.talkTime) {
        const parts = String(c.talkTime).split(':');
        if (parts.length === 3) {
          room.talkTimeSeconds += parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        } else if (parts.length === 2) {
          room.talkTimeSeconds += parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
      }
    });

    return Object.values(roomsMap).map((room) => {
      const avgScore = room.scoreCount > 0 ? Math.round(room.totalScoreSum / room.scoreCount) : null;
      const passRate = room.auditedCount > 0 ? Math.round((room.passedCount / room.auditedCount) * 100) : 0;
      const hours = Math.floor(room.talkTimeSeconds / 3600);
      const mins = Math.floor((room.talkTimeSeconds % 3600) / 60);
      const talkTimeFormatted = `${hours}h ${mins}m`;

      return {
        ...room,
        agentsCount: room.agentsSet.size,
        avgScore,
        passRate,
        talkTimeFormatted,
        pendingCount: room.calls.length - room.auditedCount
      };
    }).sort((a, b) => {
      const aNtc = a.name.toUpperCase().includes('NTC');
      const bNtc = b.name.toUpperCase().includes('NTC');
      if (aNtc && !bNtc) return -1;
      if (!aNtc && bNtc) return 1;
      return b.calls.length - a.calls.length;
    });
  }, [calls]);

  // Filtered rooms search
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return campaignRooms;
    const q = searchQuery.toLowerCase();
    return campaignRooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [campaignRooms, searchQuery]);

  // Active room data when inside a room
  const activeRoomData = useMemo(() => {
    if (!selectedRoom) return null;
    return campaignRooms.find((r) => r.name.toLowerCase() === selectedRoom.toLowerCase()) || null;
  }, [selectedRoom, campaignRooms]);

  // Overall Global Metrics across all rooms
  const globalMetrics = useMemo(() => {
    const totalCalls = calls.length;
    const totalRooms = campaignRooms.length;
    const auditedCalls = calls.filter((c) => c.status === 'Audited' || c.overallScore !== null).length;
    const avgCompliance = totalCalls > 0 ? Math.round((auditedCalls / totalCalls) * 100) : 0;
    return { totalCalls, totalRooms, auditedCalls, avgCompliance };
  }, [calls, campaignRooms]);

  // Handle batch audit for active room calls
  const handleBatchAuditRoom = () => {
    if (!activeRoomData || !onRunBatchAudit) return;
    const pendingInRoom = activeRoomData.calls.filter((c) => !c.overallScore && c.status !== 'Audited');
    onRunBatchAudit(pendingInRoom.length > 0 ? pendingInRoom : activeRoomData.calls);
  };

  // If a room is selected, display the Campaign Room Workspace
  if (selectedRoom && activeRoomData) {
    const theme = getCampaignGradient(activeRoomData.name);

    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        {/* Workspace Top Header Bar */}
        <div style={{ background: '#ffffff', padding: '24px 28px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSelectedRoom(null)}
              className="btn-secondary"
              style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Rooms</span>
            </button>
            <div style={{ width: '1px', height: '32px', background: '#cbd5e1' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${theme.bg} text-white flex items-center justify-center font-black text-sm shadow-md shrink-0`}>
                {activeRoomData.name.substring(0, 3).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', items: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>{activeRoomData.name} Workspace</h2>
                  <span className="badge badge-info">{activeRoomData.name} Room</span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>
                  Dedicated AI compliance monitoring & evaluation workspace for {activeRoomData.name}
                </p>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={handleBatchAuditRoom}
              disabled={isAuditingBatch}
              className="btn-primary"
              style={{ padding: '10px 22px', borderRadius: '14px', fontSize: '13px', fontWeight: '700' }}
            >
              <Sparkles className={`w-4 h-4 ${isAuditingBatch ? 'animate-spin' : ''}`} />
              <span>{isAuditingBatch ? 'Auditing Room Calls...' : `Audit ${activeRoomData.pendingCount} Pending Calls`}</span>
            </button>
          </div>
        </div>

        {/* Room Health & KPI Metric Cards */}
        <div className="campaign-summary-grid">
          
          <div className="campaign-stat-card border-l-4 border-l-indigo-500">
            <div className="campaign-stat-card-title">
              <span>Total Room Calls</span>
              <Phone className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <span className="campaign-stat-card-value">{activeRoomData.calls.length}</span>
              <span className="campaign-stat-card-sub">{activeRoomData.agentsCount} Active Agents</span>
            </div>
          </div>

          <div className="campaign-stat-card border-l-4 border-l-emerald-500">
            <div className="campaign-stat-card-title">
              <span>Room Pass Rate</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <span className="campaign-stat-card-value text-emerald-600">{activeRoomData.passRate}%</span>
              <span className="campaign-stat-card-sub">{activeRoomData.passedCount} Passed / {activeRoomData.failedCount} Missed</span>
            </div>
          </div>

          <div className="campaign-stat-card border-l-4 border-l-purple-500">
            <div className="campaign-stat-card-title">
              <span>Average Score</span>
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <span className="campaign-stat-card-value text-purple-600">{activeRoomData.avgScore !== null ? `${activeRoomData.avgScore}%` : 'N/A'}</span>
              <span className="campaign-stat-card-sub">{activeRoomData.auditedCount} Audited Calls</span>
            </div>
          </div>

          <div className="campaign-stat-card border-l-4 border-l-amber-500">
            <div className="campaign-stat-card-title">
              <span>Talk Duration</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <span className="campaign-stat-card-value">{activeRoomData.talkTimeFormatted}</span>
              <span className="campaign-stat-card-sub">{activeRoomData.pendingCount} Pending Audits</span>
            </div>
          </div>

        </div>

        {/* Room Call Table Container */}
        <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '16px' }}>
          <div style={{ padding: '12px 16px 20px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderKanban className="w-5 h-5 text-indigo-600" />
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{activeRoomData.name} Campaign Call Audits</h3>
              <span className="badge badge-info">{activeRoomData.calls.length} Records</span>
            </div>
          </div>

          <CallTable
            calls={activeRoomData.calls}
            onSelectCall={onSelectCall}
            onAuditSingleCall={onAuditSingleCall}
            isAuditingId={isAuditingId}
            onDeleteCalls={onDeleteCalls}
            onOpenUpload={onOpenUpload}
            onRunBatchAudit={onRunBatchAudit}
          />
        </div>

      </div>
    );
  }

  // Masterpiece Layout with Scoped Explicit CSS (0% Overlap Guaranteed)
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* Premium Hero Header Section */}
      <div className="campaign-hub-hero">
        <div style={{ zIndex: 2, maxWidth: '580px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Smart Workspace Engine</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', lineHeight: '1.2', margin: '0 0 8px 0', tracking: '-0.02em' }}>
            Campaign Rooms Hub
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: 0, fontWeight: '400' }}>
            Automated compliance workspaces grouped smartly by process campaign. Monitor health, audit pending calls, and track quality scores per room.
          </p>
        </div>

        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Room Search Box */}
          <div style={{ position: 'relative' }}>
            <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', zIndex: 3 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaign room..."
              className="campaign-search-input"
            />
          </div>

          <button
            onClick={onOpenUpload}
            className="btn-primary"
            style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upload Call Data</span>
          </button>
        </div>
      </div>

      {/* Global Summary Metric Cards Bar (4 Columns Explicit Grid) */}
      <div className="campaign-summary-grid">
        
        <div className="campaign-stat-card border-t-4 border-t-indigo-500">
          <div className="campaign-stat-card-title">
            <span>Campaign Rooms</span>
            <FolderKanban className="w-4 h-4 text-indigo-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value">{globalMetrics.totalRooms}</span>
            <span className="campaign-stat-card-sub">Active Process Rooms</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-blue-500">
          <div className="campaign-stat-card-title">
            <span>Total Managed Calls</span>
            <Phone className="w-4 h-4 text-blue-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-blue-600">{globalMetrics.totalCalls}</span>
            <span className="campaign-stat-card-sub">Across All Campaigns</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-emerald-500">
          <div className="campaign-stat-card-title">
            <span>Audited Calls</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-emerald-600">{globalMetrics.auditedCalls}</span>
            <span className="campaign-stat-card-sub">AI Evaluations Run</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-purple-500">
          <div className="campaign-stat-card-title">
            <span>Coverage Rate</span>
            <TrendingUp className="w-4 h-4 text-purple-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-purple-600">{globalMetrics.avgCompliance}%</span>
            <span className="campaign-stat-card-sub">Overall Audit Rate</span>
          </div>
        </div>

      </div>

      {/* Campaign Room Cards Grid (3 Columns Explicit Grid, 0% Overlap) */}
      <div className="campaign-room-grid">
        {filteredRooms.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', background: '#ffffff', padding: '64px 32px', borderRadius: '24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <FolderKanban className="w-14 h-14 text-slate-300" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>No Campaign Rooms Found</h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto' }}>
              Upload call logs or reports containing a Campaign column to automatically spawn dynamic Campaign Rooms.
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isHighPass = room.passRate >= 80;
            const isMidPass = room.passRate >= 60 && room.passRate < 80;
            const theme = getCampaignGradient(room.name);

            return (
              <div
                key={room.name}
                onClick={() => setSelectedRoom(room.name)}
                className="campaign-room-card group"
              >
                <div>
                  {/* Card Header Bar */}
                  <div className="room-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${theme.bg} text-white flex items-center justify-center font-black text-sm shadow-md shrink-0`}>
                        {room.name.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="room-card-title group-hover:text-indigo-600 transition-colors">
                          {room.name} Room
                        </h3>
                        <span className="room-card-subtitle block">
                          {room.agentsCount} Active Agents
                        </span>
                      </div>
                    </div>

                    <span className={`badge ${
                      isHighPass ? 'badge-success' : isMidPass ? 'badge-warning' : 'badge-danger'
                    }`} style={{ shrink: 0 }}>
                      {room.passRate}% Pass
                    </span>
                  </div>

                  {/* Room KPI Summary Grid */}
                  <div className="room-metrics-row">
                    <div className="room-metric-box">
                      <span className="room-metric-label">Total Calls</span>
                      <span className="room-metric-value">{room.calls.length}</span>
                    </div>

                    <div className="room-metric-box">
                      <span className="room-metric-label">Avg Score</span>
                      <span className="room-metric-value text-indigo-600">
                        {room.avgScore !== null ? `${room.avgScore}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Subtext */}
                  <div className="room-progress-section">
                    <div className="room-progress-labels">
                      <span>Audited Progress</span>
                      <span style={{ fontWeight: '700', color: '#334155' }}>{room.auditedCount} / {room.calls.length} calls</span>
                    </div>
                    <div className="room-progress-track">
                      <div
                        className="room-progress-fill"
                        style={{ width: `${room.calls.length > 0 ? (room.auditedCount / room.calls.length) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                </div>

                {/* Footer Action Trigger */}
                <div className="room-card-footer">
                  <span>Enter Workspace</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
