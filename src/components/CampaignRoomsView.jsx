import React, { useState, useMemo } from 'react';
import {
  FolderKanban, Users, ShieldCheck,
  Sparkles, Clock, ArrowLeft, BarChart3,
  Search, Phone, ChevronRight, FileSpreadsheet,
  ArrowUpRight
} from 'lucide-react';
import CallTable from './CallTable';

export const MANDATORY_CAMPAIGN_ROOMS = [
  'NTC',
  'CRLA',
  'CRLB',
  'CRLD',
  'CRM',
  'NLPC',
  'CRMFC'
];

// Helper to resolve room names cleanly to strictly one of the 7 official campaign rooms
const resolveRoomName = (callOrName) => {
  let combined = '';
  if (typeof callOrName === 'string') {
    combined = callOrName;
  } else if (callOrName && typeof callOrName === 'object') {
    combined = [
      callOrName.campaign,
      callOrName.CAMPAIGN,
      callOrName.process,
      callOrName.PROCESS,
      callOrName.queue,
      callOrName.QUEUE,
      callOrName.campaignStage,
      callOrName.jobTitle,
      callOrName.agentCode,
      callOrName.agentName,
      callOrName.rawFields ? Object.values(callOrName.rawFields).join(' ') : ''
    ].filter(Boolean).join(' ');
  }
  
  const upper = String(combined || '').toUpperCase();
  
  if (upper.includes('CRMFC')) return 'CRMFC';
  if (upper.includes('CRLA')) return 'CRLA';
  if (upper.includes('CRLB')) return 'CRLB';
  if (upper.includes('CRLD')) return 'CRLD';
  if (upper.includes('NLPC')) return 'NLPC';
  if (upper.includes('CRM')) return 'CRM';
  if (upper.includes('NTC')) return 'NTC';

  return 'NTC';
};

// Helper for dynamic campaign theme colors
const getCampaignGradient = (name) => {
  const n = String(name || '').toUpperCase();
  if (n.includes('CRMFC')) {
    return { bg: 'from-amber-500 to-orange-600', text: 'text-amber-600', lightBg: 'bg-amber-50', border: 'border-amber-200' };
  }
  if (n.includes('CRLA')) {
    return { bg: 'from-indigo-600 to-violet-600', text: 'text-indigo-600', lightBg: 'bg-indigo-50', border: 'border-indigo-200' };
  }
  if (n.includes('CRLB')) {
    return { bg: 'from-cyan-600 to-teal-600', text: 'text-cyan-600', lightBg: 'bg-cyan-50', border: 'border-cyan-200' };
  }
  if (n.includes('CRLD')) {
    return { bg: 'from-sky-600 to-blue-600', text: 'text-sky-600', lightBg: 'bg-sky-50', border: 'border-sky-200' };
  }
  if (n.includes('CRM')) {
    return { bg: 'from-emerald-600 to-teal-600', text: 'text-emerald-600', lightBg: 'bg-emerald-50', border: 'border-emerald-200' };
  }
  if (n.includes('NLPC')) {
    return { bg: 'from-rose-500 to-pink-600', text: 'text-rose-600', lightBg: 'bg-rose-50', border: 'border-rose-200' };
  }
  return { bg: 'from-blue-600 to-indigo-600', text: 'text-blue-600', lightBg: 'bg-blue-50', border: 'border-blue-200' };
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

  // Compute statistics strictly for the 7 official campaign rooms
  const campaignRooms = useMemo(() => {
    const roomsMap = {};

    // 1. Initialize strictly the 7 campaign rooms
    MANDATORY_CAMPAIGN_ROOMS.forEach((name) => {
      roomsMap[name] = {
        name,
        calls: [],
        auditedCount: 0,
        passedCount: 0,
        failedCount: 0,
        totalScoreSum: 0,
        scoreCount: 0,
        agentsSet: new Set(),
        talkTimeSeconds: 0
      };
    });

    // 2. Aggregate calls into the 7 rooms
    calls.forEach((c) => {
      const roomName = resolveRoomName(c);
      
      const room = roomsMap[roomName] || roomsMap['NTC'];
      room.calls.push(c);

      if (c.agentName) room.agentsSet.add(c.agentName);

      // Audited state
      if (c.status === 'Audited' || c.overallScore !== null) {
        room.auditedCount++;
        if (typeof c.overallScore === 'number') {
          room.totalScoreSum += c.overallScore;
          room.scoreCount++;
        }
        if (c.complianceStatus === 'COMPLIANT' || c.complianceStatus === 'Passed' || c.complianceStatus === 'PASSED' || (c.overallScore && c.overallScore >= 70)) {
          room.passedCount++;
        } else {
          room.failedCount++;
        }
      }

      // Talk time calculation
      if (c.talkTime || c.duration) {
        const parts = String(c.talkTime || c.duration).split(':');
        if (parts.length === 3) {
          room.talkTimeSeconds += parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        } else if (parts.length === 2) {
          room.talkTimeSeconds += parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
      }
    });

    return MANDATORY_CAMPAIGN_ROOMS.map((name) => {
      const room = roomsMap[name];
      const avgScore = room.scoreCount > 0 ? Math.round(room.totalScoreSum / room.scoreCount) : null;
      const passRate = room.auditedCount > 0 ? Math.round((room.passedCount / room.auditedCount) * 100) : (room.calls.length > 0 ? 0 : 100);
      const hours = Math.floor(room.talkTimeSeconds / 3600);
      const mins = Math.floor((room.talkTimeSeconds % 3600) / 60);
      const talkTimeFormatted = `${hours}h ${mins}m`;

      return {
        ...room,
        agentsCount: room.agentsSet.size,
        avgScore,
        passRate: room.auditedCount > 0 ? passRate : (room.calls.length === 0 ? 100 : 0),
        talkTimeFormatted,
        pendingCount: Math.max(0, room.calls.length - room.auditedCount)
      };
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
      <div style={{ maxWidth: '1280px', margin: '0 auto' }} className="space-y-6 animate-in fade-in duration-150">
        
        {/* Workspace Top Header Bar (Premium White) */}
        <div style={{ background: '#ffffff', padding: '24px 28px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSelectedRoom(null)}
              className="btn-secondary"
              style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Rooms</span>
            </button>
            <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${theme.bg} text-white flex items-center justify-center font-black text-sm shadow-md shrink-0`}>
                {activeRoomData.name.substring(0, 3).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              disabled={isAuditingBatch || activeRoomData.calls.length === 0}
              className="btn-primary"
              style={{ padding: '10px 22px', borderRadius: '14px', fontSize: '13px', fontWeight: '700' }}
            >
              <Sparkles className={`w-4 h-4 ${isAuditingBatch ? 'animate-spin' : ''}`} />
              <span>
                {isAuditingBatch 
                  ? 'Auditing Room Calls...' 
                  : activeRoomData.calls.length === 0 
                  ? 'No Calls In Room' 
                  : `Audit ${activeRoomData.pendingCount} Pending Calls`}
              </span>
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
              <span className="campaign-stat-card-value text-emerald-600">
                {activeRoomData.calls.length > 0 ? `${activeRoomData.passRate}%` : '100%'}
              </span>
              <span className="campaign-stat-card-sub">
                {activeRoomData.calls.length > 0 ? `${activeRoomData.passedCount} Passed / ${activeRoomData.failedCount} Missed` : 'No Violations'}
              </span>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{activeRoomData.name} Campaign Call Audits</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {activeRoomData.calls.length} Records
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">All logged calls and compliance evaluations for this campaign room</p>
              </div>
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

  // Masterpiece Hub Overview with 100% Premium White Styling
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }} className="space-y-7 animate-in fade-in duration-200">
      
      {/* Premium White Hero Header Section */}
      <div className="campaign-hub-hero">
        <div style={{ zIndex: 2, maxWidth: '620px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#4f46e5', fontSize: '12px', fontWeight: '700', marginBottom: '12px' }}>
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Enterprise Campaign Room Architecture</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', lineHeight: '1.2', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Campaign Rooms Hub
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', margin: 0, fontWeight: '500' }}>
            Automated compliance workspaces partitioned smartly across all 8 major campaign processes. Monitor health, audit pending calls, and track quality scores per room.
          </p>
        </div>

        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
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
            <span className="campaign-stat-card-sub">Active Enterprise Rooms</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-blue-500">
          <div className="campaign-stat-card-title">
            <span>Total Managed Calls</span>
            <Phone className="w-4 h-4 text-blue-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-blue-600">{globalMetrics.totalCalls.toLocaleString()}</span>
            <span className="campaign-stat-card-sub">Across All Campaigns</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-emerald-500">
          <div className="campaign-stat-card-title">
            <span>Audited Calls</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-emerald-600">{globalMetrics.auditedCalls.toLocaleString()}</span>
            <span className="campaign-stat-card-sub">AI Evaluations Run</span>
          </div>
        </div>

        <div className="campaign-stat-card border-t-4 border-t-purple-500">
          <div className="campaign-stat-card-title">
            <span>Coverage Rate</span>
            <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
          </div>
          <div>
            <span className="campaign-stat-card-value text-purple-600">{globalMetrics.avgCompliance}%</span>
            <span className="campaign-stat-card-sub">Overall Audit Coverage</span>
          </div>
        </div>

      </div>

      {/* Campaign Room Cards Grid (3 Columns Explicit Grid) */}
      <div className="campaign-room-grid">
        {filteredRooms.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', background: '#ffffff', padding: '64px 32px', borderRadius: '24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <FolderKanban className="w-14 h-14 text-slate-300" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>No Campaign Rooms Match "{searchQuery}"</h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto' }}>
              Clear your search query to view all available enterprise campaign rooms.
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const hasCalls = room.calls.length > 0;
            const isHighPass = room.passRate >= 80;
            const isMidPass = room.passRate >= 60 && room.passRate < 80;
            const theme = getCampaignGradient(room.name);

            return (
              <div
                key={room.name}
                onClick={() => setSelectedRoom(room.name)}
                className="campaign-room-card group cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all duration-200 bg-white"
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
                          {room.name}
                        </h3>
                        <span className="room-card-subtitle block font-semibold text-slate-500">
                          {hasCalls ? `${room.agentsCount} Active Agents` : 'Enterprise Room'}
                        </span>
                      </div>
                    </div>

                    <span className={`badge ${
                      !hasCalls ? 'badge-info' : isHighPass ? 'badge-success' : isMidPass ? 'badge-warning' : 'badge-danger'
                    }`} style={{ flexShrink: 0 }}>
                      {!hasCalls ? 'Ready' : `${room.passRate}% Pass`}
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
                        {room.avgScore !== null ? `${room.avgScore}%` : (hasCalls ? 'Pending' : '--')}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Subtext */}
                  <div className="room-progress-section">
                    <div className="room-progress-labels">
                      <span>Audited Progress</span>
                      <span style={{ fontWeight: '700', color: '#334155' }}>
                        {hasCalls ? `${room.auditedCount} / ${room.calls.length} calls` : '0 calls loaded'}
                      </span>
                    </div>
                    <div className="room-progress-track">
                      <div
                        className="room-progress-fill"
                        style={{ width: `${hasCalls ? (room.auditedCount / room.calls.length) * 100 : 0}%` }}
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
