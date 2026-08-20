import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Play, ShieldAlert, CheckCircle2, Clock, Sparkles, ChevronLeft, 
  ChevronRight, FileSpreadsheet, Eye, Trash2, Zap, SlidersHorizontal, Filter, 
  Check, X, PhoneOff, VolumeX, AlertCircle, Calendar, Download, Copy, 
  ArrowUpDown, Activity, User, Layers, ChevronDown, RotateCcw
} from 'lucide-react';

const DEFAULT_COLUMNS = [
  'DATE-TIME',
  'LEAD ID',
  'AGENT FULL NAME',
  'CAMPAIGN',
  'PROCESS',
  'CALL TIME',
  'TALKTIME',
  'RECORDING PATH',
  'name',
  'email',
  'jobTitle'
];

const PRESET_VIEWS = {
  default: {
    label: 'Standard Overview',
    columns: ['DATE-TIME', 'LEAD ID', 'AGENT FULL NAME', 'CAMPAIGN', 'PROCESS', 'CALL TIME', 'TALKTIME', 'RECORDING PATH', 'name', 'email']
  },
  compliance: {
    label: 'Compliance Focus',
    columns: ['DATE-TIME', 'LEAD ID', 'AGENT FULL NAME', 'TALKTIME', 'RECORDING PATH', 'name']
  },
  leads: {
    label: 'Lead & Contact Details',
    columns: ['LEAD ID', 'name', 'email', 'jobTitle', 'AGENT FULL NAME', 'CAMPAIGN', 'DATE-TIME']
  }
};

const COLUMN_MAPPING = {
  'DATE-TIME': 'callDate',
  'DATE_TIME': 'callDate',
  'LEAD ID': 'callerId',
  'LEAD_ID': 'callerId',
  'CALLER ID': 'callerId',
  'CALLER_ID': 'callerId',
  'AGENT FULL NAME': 'agentName',
  'AGENT_FULL_NAME': 'agentName',
  'AGENT NAME': 'agentName',
  'AGENT_NAME': 'agentName',
  'CAMPAIGN': 'campaign',
  'PROCESS': 'queue',
  'QUEUE': 'queue',
  'CALL TIME': 'duration',
  'CALL_TIME': 'duration',
  'DURATION': 'duration',
  'TALKTIME': 'talkTime',
  'TALK_TIME': 'talkTime',
  'HOLD TIME': 'holdTime',
  'HOLD_TIME': 'holdTime',
  'RECORDING PATH': 'audioUrl',
  'RECORDING_PATH': 'audioUrl',
  'AUDIO URL': 'audioUrl',
  'AUDIO_URL': 'audioUrl',
  'name': 'candidateName',
  'candidateName': 'candidateName',
  'candidate_name': 'candidateName',
  'email': 'candidateEmail',
  'candidateEmail': 'candidateEmail',
  'candidate_email': 'candidateEmail',
  'jobTitle': 'callType',
  'JOB_TITLE': 'callType'
};

const getCellValue = (call, colName) => {
  if (!call) return '--';
  const normCol = String(colName).toUpperCase().trim();
  
  if (normCol === 'NAME' || normCol === 'CANDIDATE NAME' || normCol === 'CANDIDATENAME') {
    const rawVal = call.rawFields ? (call.rawFields['NAME'] || call.rawFields['CANDIDATE NAME'] || call.rawFields['CANDIDATENAME']) : '';
    if (rawVal && String(rawVal).trim() !== '' && String(rawVal).trim() !== '--') {
      return String(rawVal).trim();
    }
    return call.candidateName || rawVal || '--';
  }

  if (normCol === 'AGENT FULL NAME' || normCol === 'AGENT NAME' || normCol === 'AGENT') {
    const rawVal = call.rawFields ? (call.rawFields['AGENT FULL NAME'] || call.rawFields['AGENT NAME']) : '';
    let nameStr = (rawVal && String(rawVal).trim() !== '' && String(rawVal).trim() !== '--') ? String(rawVal).trim() : (call.agentName || rawVal || '--');
    if (nameStr && nameStr !== '--') {
      nameStr = nameStr.replace(/^(NTC|CRLA|CRLB|CRLD|CRM|NLPC|CRMFC)\s+/i, '');
      nameStr = nameStr.replace(/(NTC|CRLA|CRLB|CRLD|CRM|NLPC|CRMFC)$/i, '').trim();
    }
    return nameStr || '--';
  }

  if (call.rawFields && call.rawFields[colName] !== undefined) {
    const rawVal = call.rawFields[colName];
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '' && String(rawVal).trim() !== '--') {
      return rawVal;
    }
  }

  const camelKey = COLUMN_MAPPING[colName] || colName;
  return call[camelKey] || (call.rawFields ? call.rawFields[colName] : '--');
};

const getNormalizedDateString = (dateStr) => {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split(' ')[0];
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return cleanStr;
  }

  const parts = cleanStr.split(/[/\\-]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts;
    if (p3.length === 2) {
      p3 = '20' + p3;
    }
    let month = parseInt(p1, 10);
    let day = parseInt(p2, 10);
    let year = parseInt(p3, 10);
    
    if (month > 12) {
      const temp = month;
      month = day;
      day = temp;
    }
    
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore parse error
  }
  
  return '';
};

const parseDurationSeconds = (durationStr) => {
  if (!durationStr) return 0;
  const str = String(durationStr).trim();
  const parts = str.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
};

const formatSecondsToMinutes = (seconds) => {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${seconds % 60}s`;
};

// Formats duration into crystal-clear human readable format: e.g. "0:13:31" -> "13m 31s", "0:07:19" -> "7m 19s", "0:00:45" -> "45s"
const formatDisplayDuration = (durationStr) => {
  if (!durationStr || durationStr === '--') return '0s';
  const str = String(durationStr).trim();
  const parts = str.split(':');
  
  if (parts.length === 3) {
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    const secs = parseInt(parts[2], 10) || 0;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }
  
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  const num = parseInt(str, 10);
  if (!isNaN(num) && num > 0) {
    return formatSecondsToMinutes(num);
  }

  return str;
};

const parseCallDateTimestamp = (call) => {
  if (!call) return 0;
  const dStr = call.callDate || (call.rawFields && (call.rawFields['DATE-TIME'] || call.rawFields['Date']));
  if (!dStr) return 0;
  const t = new Date(dStr).getTime();
  return isNaN(t) ? 0 : t;
};

// Export to CSV helper
const exportCallsToCSV = (callsToExport, visibleCols) => {
  if (!callsToExport || callsToExport.length === 0) return;
  
  const headers = ['ID', ...Array.from(visibleCols), 'Script Score', 'Compliance Status'];
  const rows = callsToExport.map(c => {
    const colValues = Array.from(visibleCols).map(col => {
      const v = getCellValue(c, col);
      const str = v === '--' || v === undefined || v === null ? '' : String(v);
      return `"${str.replace(/"/g, '""')}"`;
    });
    const scoreVal = c.overallScore !== null && c.overallScore !== undefined ? `${c.overallScore}%` : 'Pending';
    const statusVal = c.complianceStatus || c.status || 'Pending';
    return [`"${c.id}"`, ...colValues, `"${scoreVal}"`, `"${statusVal}"`].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Call_Audits_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function CallTable({ 
  calls = [], 
  onSelectCall, 
  onAuditSingleCall, 
  isAuditingId, 
  onDeleteCalls, 
  initialAgentFilter = 'ALL', 
  onOpenUpload, 
  onRunBatchAudit, 
  onClearDemoData 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState(initialAgentFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pageSize, setPageSize] = useState(50);
  
  // Smart Sorting State
  const [sortOption, setSortOption] = useState('talk_desc');

  // Smart Duration Filter State
  const [durationFilter, setDurationFilter] = useState('ALL');

  // Smart Date Filter State
  const [datePreset, setDatePreset] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePopover, setShowDatePopover] = useState(false);

  // Dynamic Column Selector States
  const [visibleColumns, setVisibleColumns] = useState(() => new Set(DEFAULT_COLUMNS));
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);
  const [columnSearchQuery, setColumnSearchQuery] = useState('');

  // Column Header Filter States
  const [activeColumnFilters, setActiveColumnFilters] = useState({});
  const [openFilterColumn, setOpenFilterColumn] = useState(null);
  const [columnValSearch, setColumnValSearch] = useState('');

  // Campaign Filter State
  const [campaignFilter, setCampaignFilter] = useState('ALL');

  // Quick Copy Feedback State
  const [copiedText, setCopiedText] = useState(null);

  // Quick Stats Strip Expand/Collapse State
  const [showStatsStrip, setShowStatsStrip] = useState(true);

  // Search Input Ref for Keyboard Shortcuts
  const searchInputRef = useRef(null);
  const datePopoverRef = useRef(null);
  const columnsPopoverRef = useRef(null);

  // Keyboard shortcut: Press "/" or "Ctrl+K" to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k') || (e.metaKey && e.key === 'k')) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target)) {
        setShowDatePopover(false);
      }
      if (columnsPopoverRef.current && !columnsPopoverRef.current.contains(e.target)) {
        setShowColumnsPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = (text, e) => {
    e?.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Extract unique agents for dropdown
  const uniqueAgents = useMemo(() => {
    const set = new Set(calls.map(c => c.agentName).filter(Boolean));
    return Array.from(set).sort();
  }, [calls]);

  // Extract unique campaigns for dropdown
  const uniqueCampaigns = useMemo(() => {
    const set = new Set(calls.map(c => c.campaign).filter(Boolean));
    return Array.from(set).sort();
  }, [calls]);

  // Extract all columns in dataset dynamically
  const allAvailableColumns = useMemo(() => {
    if (calls.length === 0 || !calls[0].rawFields) {
      return DEFAULT_COLUMNS;
    }
    return Object.keys(calls[0].rawFields);
  }, [calls]);

  // Compute unique values for open column header filter popover
  const currentUniqueValues = useMemo(() => {
    if (!openFilterColumn) return [];
    const values = {};
    calls.forEach(call => {
      const cellVal = getCellValue(call, openFilterColumn);
      const stringVal = cellVal === undefined || cellVal === null ? '' : String(cellVal).trim();
      const displayVal = stringVal || '(Blank)';
      values[displayVal] = (values[displayVal] || 0) + 1;
    });
    return Object.entries(values).map(([val, count]) => ({ val, count })).sort((a, b) => b.count - a.count);
  }, [calls, openFilterColumn]);

  // Live quick status counts computed across entire loaded calls dataset
  const statusCounts = useMemo(() => {
    let passed = 0;
    let fail = 0;
    let pending = 0;
    let unanswered = 0;
    let longTalk = 0;

    calls.forEach(c => {
      if (c.complianceStatus === 'Passed') passed++;
      else if (c.complianceStatus === 'Critical Fail') fail++;
      else if (c.complianceStatus === 'Unanswered' || c.complianceStatus === 'No Speech') unanswered++;
      else if (c.status !== 'Audited') pending++;

      const talkSec = parseDurationSeconds(c.talkTime || c.duration || (c.rawFields && (c.rawFields['TALKTIME'] || c.rawFields['CALL TIME'])));
      if (talkSec >= 180) longTalk++;
    });

    return {
      all: calls.length,
      passed,
      fail,
      pending,
      unanswered,
      longTalk
    };
  }, [calls]);

  // Filtered dataset
  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      let matchSearch = true;
      if (searchTerm) {
        const cleanQuery = searchTerm.replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (cleanQuery.length > 0) {
          const queryWords = cleanQuery.split(' ').filter(Boolean);

          const rawValues = call.rawFields ? Object.values(call.rawFields).join(' ') : '';
          const fullRecordHaystack = [
            call.id || '',
            call.callerId || '',
            call.agentName || '',
            call.candidateName || '',
            call.candidateEmail || '',
            call.campaign || '',
            call.disposition || '',
            rawValues
          ].join(' ').toLowerCase();

          matchSearch = queryWords.every(word => fullRecordHaystack.includes(word));
        }
      }

      const matchStatus = 
        statusFilter === 'ALL' ||
        (statusFilter === 'AUDITED' && call.status === 'Audited' && call.overallScore !== null) ||
        (statusFilter === 'PENDING' && call.status !== 'Audited' && call.complianceStatus !== 'Unanswered') ||
        (statusFilter === 'PASSED' && call.complianceStatus === 'Passed') ||
        (statusFilter === 'FAIL' && call.complianceStatus === 'Critical Fail') ||
        (statusFilter === 'UNANSWERED' && (call.complianceStatus === 'Unanswered' || call.complianceStatus === 'No Speech')) ||
        (statusFilter === 'LONG_TALK' && parseDurationSeconds(call.talkTime || call.duration || (call.rawFields && (call.rawFields['TALKTIME'] || call.rawFields['CALL TIME']))) >= 180) ||
        (statusFilter === 'AUDIO_ERROR' && (call.complianceStatus === 'Audio Error' || call.status === 'Audio Error'));

      const matchAgent = agentFilter === 'ALL' || call.agentName === agentFilter;
      const matchCampaign = campaignFilter === 'ALL' || call.campaign === campaignFilter;

      // Duration filter
      let matchDuration = true;
      const talkSec = parseDurationSeconds(call.talkTime || call.duration || (call.rawFields && (call.rawFields['TALKTIME'] || call.rawFields['CALL TIME'])));
      if (durationFilter === 'LONG') {
        matchDuration = talkSec >= 180;
      } else if (durationFilter === 'MEDIUM') {
        matchDuration = talkSec >= 60 && talkSec < 180;
      } else if (durationFilter === 'SHORT') {
        matchDuration = talkSec > 0 && talkSec < 60;
      } else if (durationFilter === 'UNANSWERED') {
        matchDuration = talkSec === 0;
      }

      // Smart Date Preset & Range Filter
      let matchDate = true;
      const callDateNorm = getNormalizedDateString(call.callDate);
      if (datePreset === 'TODAY') {
        const todayNorm = new Date().toISOString().split('T')[0];
        matchDate = callDateNorm === todayNorm;
      } else if (datePreset === 'YESTERDAY') {
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        const yestNorm = yest.toISOString().split('T')[0];
        matchDate = callDateNorm === yestNorm;
      } else if (datePreset === 'LAST_7') {
        const sevenAgo = new Date();
        sevenAgo.setDate(sevenAgo.getDate() - 7);
        const sevenAgoNorm = sevenAgo.toISOString().split('T')[0];
        matchDate = callDateNorm >= sevenAgoNorm;
      } else if (datePreset === 'THIS_MONTH') {
        const monthPrefix = new Date().toISOString().slice(0, 7);
        matchDate = callDateNorm.startsWith(monthPrefix);
      } else if (datePreset === 'CUSTOM') {
        if (customStartDate && customEndDate) {
          matchDate = callDateNorm >= customStartDate && callDateNorm <= customEndDate;
        } else if (customStartDate) {
          matchDate = callDateNorm >= customStartDate;
        } else if (customEndDate) {
          matchDate = callDateNorm <= customEndDate;
        }
      }

      if (!matchSearch || !matchStatus || !matchAgent || !matchCampaign || !matchDuration || !matchDate) {
        return false;
      }

      // Dynamic Column Header Filters
      for (const colName of Object.keys(activeColumnFilters)) {
        const selectedSet = activeColumnFilters[colName];
        if (selectedSet && selectedSet.size > 0) {
          const cellVal = getCellValue(call, colName);
          const stringVal = cellVal === undefined || cellVal === null ? '' : String(cellVal).trim();
          const displayVal = stringVal || '(Blank)';
          if (!selectedSet.has(displayVal)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [calls, searchTerm, statusFilter, agentFilter, campaignFilter, durationFilter, datePreset, customStartDate, customEndDate, activeColumnFilters]);

  // Live KPI summary stats computed strictly on current filtered set
  const filteredMetrics = useMemo(() => {
    let totalSec = 0;
    let audited = 0;
    let scoreSum = 0;
    let passed = 0;
    let failed = 0;

    filteredCalls.forEach(c => {
      const s = parseDurationSeconds(c.talkTime || c.duration || (c.rawFields && (c.rawFields['TALKTIME'] || c.rawFields['CALL TIME'])));
      totalSec += s;

      if (c.status === 'Audited' || c.overallScore !== null) {
        audited++;
        if (typeof c.overallScore === 'number') {
          scoreSum += c.overallScore;
        }
        if (c.complianceStatus === 'Passed') passed++;
        if (c.complianceStatus === 'Critical Fail') failed++;
      }
    });

    const avgScore = audited > 0 ? Math.round(scoreSum / audited) : null;
    const passRate = audited > 0 ? Math.round((passed / audited) * 100) : 0;
    const auditCoverage = filteredCalls.length > 0 ? Math.round((audited / filteredCalls.length) * 100) : 0;

    return {
      totalCalls: filteredCalls.length,
      audited,
      auditCoverage,
      avgScore,
      passRate,
      totalTalkFormatted: formatSecondsToMinutes(totalSec),
      criticalCount: failed
    };
  }, [filteredCalls]);

  // Smart Sorted Dataset
  const sortedAndFilteredCalls = useMemo(() => {
    const list = [...filteredCalls];
    list.sort((a, b) => {
      if (sortOption === 'talk_desc') {
        const secA = parseDurationSeconds(a.talkTime || a.duration || (a.rawFields && (a.rawFields['TALKTIME'] || a.rawFields['CALL TIME'])));
        const secB = parseDurationSeconds(b.talkTime || b.duration || (b.rawFields && (b.rawFields['TALKTIME'] || b.rawFields['CALL TIME'])));
        return secB - secA;
      }
      if (sortOption === 'talk_asc') {
        const secA = parseDurationSeconds(a.talkTime || a.duration || (a.rawFields && (a.rawFields['TALKTIME'] || a.rawFields['CALL TIME'])));
        const secB = parseDurationSeconds(b.talkTime || b.duration || (b.rawFields && (b.rawFields['TALKTIME'] || b.rawFields['CALL TIME'])));
        return secA - secB;
      }
      if (sortOption === 'score_desc') {
        return (b.overallScore || 0) - (a.overallScore || 0);
      }
      if (sortOption === 'score_asc') {
        return (a.overallScore || 0) - (b.overallScore || 0);
      }
      if (sortOption === 'date_asc') {
        return parseCallDateTimestamp(a) - parseCallDateTimestamp(b);
      }
      if (sortOption === 'agent_asc') {
        return String(a.agentName || '').localeCompare(String(b.agentName || ''));
      }
      // default date_desc
      return parseCallDateTimestamp(b) - parseCallDateTimestamp(a);
    });
    return list;
  }, [filteredCalls, sortOption]);

  const totalPages = Math.ceil(sortedAndFilteredCalls.length / pageSize) || 1;
  const paginatedCalls = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredCalls.slice(start, start + pageSize);
  }, [sortedAndFilteredCalls, currentPage, pageSize]);

  // Checkbox handlers
  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const allIdsOnPage = paginatedCalls.map(c => c.id);
    const next = new Set(selectedIds);
    const allSelected = allIdsOnPage.length > 0 && allIdsOnPage.every(id => next.has(id));

    if (allSelected) {
      allIdsOnPage.forEach(id => next.delete(id));
    } else {
      allIdsOnPage.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleBatchAudit = async () => {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    
    const selectedCalls = calls.filter(c => ids.includes(c.id));
    if (onRunBatchAudit) {
      await onRunBatchAudit(selectedCalls);
    } else {
      await Promise.all(
        selectedCalls.map(c => onAuditSingleCall(c))
      );
    }
  };

  const handleBatchDelete = () => {
    if (onDeleteCalls) {
      onDeleteCalls(Array.from(selectedIds));
    }
    setSelectedIds(new Set());
  };

  const handleApplyPresetView = (presetKey) => {
    if (presetKey === 'all') {
      setVisibleColumns(new Set(allAvailableColumns));
    } else if (PRESET_VIEWS[presetKey]) {
      const targetCols = PRESET_VIEWS[presetKey].columns.filter(c => allAvailableColumns.includes(c) || DEFAULT_COLUMNS.includes(c));
      setVisibleColumns(new Set(targetCols));
    }
  };

  const dateFilterLabel = useMemo(() => {
    if (datePreset === 'TODAY') return 'Today';
    if (datePreset === 'YESTERDAY') return 'Yesterday';
    if (datePreset === 'LAST_7') return 'Last 7 Days';
    if (datePreset === 'THIS_MONTH') return 'This Month';
    if (datePreset === 'CUSTOM') {
      if (customStartDate && customEndDate) return `${customStartDate} → ${customEndDate}`;
      if (customStartDate) return `From ${customStartDate}`;
      if (customEndDate) return `Until ${customEndDate}`;
      return 'Custom Range';
    }
    return 'All Dates';
  }, [datePreset, customStartDate, customEndDate]);

  const activeFiltersCount = (statusFilter !== 'ALL' ? 1 : 0) +
    (agentFilter !== 'ALL' ? 1 : 0) +
    (campaignFilter !== 'ALL' ? 1 : 0) +
    (durationFilter !== 'ALL' ? 1 : 0) +
    (datePreset !== 'ALL' ? 1 : 0) +
    Object.keys(activeColumnFilters).length;

  if (calls.length === 0) {
    return (
      <div className="card-white p-14 text-center flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg font-black text-slate-900">No Audits Logged Yet</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Your call recordings database is empty. Import your CSV or Excel call report exported from the SlashRTC dialer to run automated AI compliance audits.
          </p>
        </div>
        
        <div>
          <button
            onClick={onOpenUpload}
            className="btn-primary text-xs font-bold py-2.5 px-6 shadow-md flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Upload Batch Dataset</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="call-table-card">
      
      {/* 1. TOP TOOLBAR: SEARCH, FILTERS & ACTION TOOLS */}
      <div className="call-table-toolbar">
        
        {/* Row 1: Search Bar & Export CSV */}
        <div className="call-table-row-1">
          
          {/* Omni Search Box */}
          <div className="call-table-search-wrapper">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by Lead ID, Agent, Candidate, Campaign, Keyword... (Press / to focus)"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
              className="call-table-search-input"
            />
            
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md cursor-pointer transition-colors"
                  title="Clear Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
                /
              </kbd>
            </div>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={() => exportCallsToCSV(sortedAndFilteredCalls, visibleColumns)}
            className="call-table-btn-dropdown"
            title="Export filtered view to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

        </div>

        {/* Row 2: Secondary Filter Controls Group */}
        <div className="call-table-filters-row">
          <div className="call-table-filter-group">
            
            {/* 1. Date Filter Dropdown */}
            <div className="relative" ref={datePopoverRef}>
              <button
                onClick={() => setShowDatePopover(!showDatePopover)}
                className={`call-table-btn-dropdown ${
                  datePreset !== 'ALL' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : ''
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{dateFilterLabel}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showDatePopover ? 'rotate-180' : ''}`} />
              </button>

              {showDatePopover && (
                <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Filter By Date</span>
                    {datePreset !== 'ALL' && (
                      <button
                        onClick={() => {
                          setDatePreset('ALL');
                          setCustomStartDate('');
                          setCustomEndDate('');
                          setShowDatePopover(false);
                          setCurrentPage(1);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-3.5">
                    {[
                      { id: 'ALL', label: 'All Time' },
                      { id: 'TODAY', label: 'Today' },
                      { id: 'YESTERDAY', label: 'Yesterday' },
                      { id: 'LAST_7', label: 'Last 7 Days' },
                      { id: 'THIS_MONTH', label: 'This Month' },
                      { id: 'CUSTOM', label: 'Custom Range' },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setDatePreset(preset.id);
                          if (preset.id !== 'CUSTOM') {
                            setShowDatePopover(false);
                          }
                          setCurrentPage(1);
                        }}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold text-left transition-all cursor-pointer ${
                          datePreset === preset.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {datePreset === 'CUSTOM' && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">From Date</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                          className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">To Date</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                          className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Sort Dropdown */}
            <div className="call-table-select-wrapper">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortOption}
                onChange={(e) => { setSortOption(e.target.value); setCurrentPage(1); }}
                className="call-table-select"
              >
                <option value="talk_desc">⏱️ Talk Time (Longest → Shortest)</option>
                <option value="talk_asc">⏱️ Talk Time (Shortest → Longest)</option>
                <option value="date_desc">📅 Date (Newest First)</option>
                <option value="date_asc">📅 Date (Oldest First)</option>
                <option value="score_desc">⭐ Script Score (Highest → Lowest)</option>
                <option value="score_asc">⚠️ Script Score (Lowest → Highest)</option>
                <option value="agent_asc">👤 Agent Name (A → Z)</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* 3. Agent Filter Dropdown */}
            {uniqueAgents.length > 1 && (
              <div className="call-table-select-wrapper">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={agentFilter}
                  onChange={(e) => { setAgentFilter(e.target.value); setCurrentPage(1); }}
                  className="call-table-select"
                >
                  <option value="ALL">All Agents ({uniqueAgents.length})</option>
                  {uniqueAgents.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* 4. Columns Selector */}
            <div className="relative" ref={columnsPopoverRef}>
              <button
                onClick={() => setShowColumnsPopover(!showColumnsPopover)}
                className="call-table-btn-dropdown"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Columns ({visibleColumns.size})</span>
              </button>

              {showColumnsPopover && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Visible Columns</span>
                    <button
                      onClick={() => setVisibleColumns(new Set(DEFAULT_COLUMNS))}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {allAvailableColumns.map((col) => (
                      <label key={col} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col)}
                          onChange={() => toggleColumn(col)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>{col}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Reset Filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setAgentFilter('ALL');
                  setCampaignFilter('ALL');
                  setDurationFilter('ALL');
                  setDatePreset('ALL');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setActiveColumnFilters({});
                  setCurrentPage(1);
                }}
                className="call-table-btn-dropdown text-rose-600 hover:bg-rose-50 border-rose-200"
                title="Reset active filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}

          </div>

          {/* Multi-selected actions */}
          {selectedIds.size > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' }}>
              <span>{selectedIds.size} selected</span>
              <button
                onClick={handleBatchAuditSelected}
                disabled={isAuditingBatch}
                className="btn-primary"
                style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '8px' }}
              >
                Audit Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{ fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
              >
                Clear
              </button>
            </div>
          )}

        </div>

        {/* Row 3: Status Filter Segment Tabs */}
        <div className="call-table-status-tabs">
          
          <button
            onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            className={`call-table-status-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
          >
            <span>All Calls</span>
            <span className="call-table-status-count">{statusCounts.all}</span>
          </button>

          <button
            onClick={() => { setStatusFilter('PASSED'); setCurrentPage(1); }}
            className={`call-table-status-pill ${statusFilter === 'PASSED' ? 'active' : ''}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Passed</span>
            <span className="call-table-status-count">{statusCounts.passed}</span>
          </button>

          <button
            onClick={() => { setStatusFilter('FAIL'); setCurrentPage(1); }}
            className={`call-table-status-pill ${statusFilter === 'FAIL' ? 'active' : ''}`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>Critical Fail</span>
            <span className="call-table-status-count">{statusCounts.fail}</span>
          </button>

          <button
            onClick={() => { setStatusFilter('PENDING'); setCurrentPage(1); }}
            className={`call-table-status-pill ${statusFilter === 'PENDING' ? 'active' : ''}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending AI Audit</span>
            <span className="call-table-status-count">{statusCounts.pending}</span>
          </button>

          <button
            onClick={() => { setStatusFilter('LONG_TALK'); setCurrentPage(1); }}
            className={`call-table-status-pill ${statusFilter === 'LONG_TALK' ? 'active' : ''}`}
          >
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            <span>High Talk Time (&gt;3m)</span>
            <span className="call-table-status-count">{statusCounts.longTalk}</span>
          </button>

          <button
            onClick={() => { setStatusFilter('UNANSWERED'); setCurrentPage(1); }}
            className={`call-table-status-pill ${statusFilter === 'UNANSWERED' ? 'active' : ''}`}
          >
            <PhoneOff className="w-3.5 h-3.5 text-slate-400" />
            <span>Unanswered</span>
            <span className="call-table-status-count">{statusCounts.unanswered}</span>
          </button>

        </div>

        {/* Row 4: SMART KPI INTELLIGENCE STRIP */}
        {showStatsStrip && (
          <div className="call-table-kpi-banner">
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Filtered Calls:</span>
                <span style={{ fontWeight: '800', color: '#0f172a', background: '#ffffff', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                  {filteredMetrics.totalCalls.toLocaleString()} / {calls.length.toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>AI Audit Coverage:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '800', color: '#059669' }}>
                    {filteredMetrics.auditCoverage}%
                  </span>
                  <div style={{ width: '64px', height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                    <div 
                      style={{ width: `${filteredMetrics.auditCoverage}%`, height: '100%', background: 'linear-gradient(90deg, #4f46e5, #10b981)', borderRadius: '99px' }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>({filteredMetrics.audited} audited)</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Pass Rate:</span>
                <span style={{ fontWeight: '800', color: filteredMetrics.passRate >= 70 ? '#059669' : '#e11d48' }}>
                  {filteredMetrics.passRate}%
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Total Talk Time:</span>
                <span style={{ fontWeight: '800', color: '#1e293b' }}>
                  {filteredMetrics.totalTalkFormatted}
                </span>
              </div>

              {filteredMetrics.avgScore !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Avg Script Score:</span>
                  <span style={{ fontWeight: '800', color: '#7c3aed' }}>
                    {filteredMetrics.avgScore}%
                  </span>
                </div>
              )}

            </div>

            {filteredMetrics.criticalCount > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '4px 12px', borderRadius: '10px', fontWeight: '700' }}>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>{filteredMetrics.criticalCount} Critical Violations</span>
              </div>
            )}

          </div>
        )}

      </div>

      {/* 3. ULTRA MODERN INTERACTIVE DATA GRID */}
      <div className="overflow-x-auto w-full flex-1 scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider sticky top-0 z-20 backdrop-blur-xs">
              
              {/* Checkbox Header */}
              <th className="py-3.5 px-4 w-12 text-center select-none">
                <input
                  type="checkbox"
                  checked={paginatedCalls.length > 0 && paginatedCalls.every(c => selectedIds.has(c.id))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </th>

              {/* Visible dynamic columns with inline filter & sort triggers */}
              {Array.from(visibleColumns).map(colName => {
                const isFiltered = activeColumnFilters[colName] && activeColumnFilters[colName].size > 0;
                const normCol = String(colName).toUpperCase().trim();
                let colMinWidth = 'min-w-[120px]';
                if (normCol.includes('DATE')) colMinWidth = 'min-w-[160px]';
                else if (normCol.includes('LEAD') || normCol.includes('CALLER')) colMinWidth = 'min-w-[130px]';
                else if (normCol.includes('AGENT')) colMinWidth = 'min-w-[160px]';
                else if (normCol.includes('TALK') || normCol.includes('CALL TIME') || normCol.includes('DURATION') || normCol.includes('HOLD')) colMinWidth = 'min-w-[110px]';
                else if (normCol.includes('RECORDING') || normCol.includes('AUDIO')) colMinWidth = 'min-w-[90px]';
                else if (normCol.includes('EMAIL')) colMinWidth = 'min-w-[180px]';
                else if (normCol.includes('NAME')) colMinWidth = 'min-w-[140px]';
                else if (normCol === 'CAMPAIGN' || normCol === 'PROCESS' || normCol === 'QUEUE') colMinWidth = 'min-w-[130px]';

                return (
                  <th key={colName} className={`py-3.5 px-4 whitespace-nowrap text-left relative group select-none ${colMinWidth}`}>
                    <div 
                      className="flex items-center gap-1.5 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openFilterColumn === colName) {
                          setOpenFilterColumn(null);
                        } else {
                          setOpenFilterColumn(colName);
                          setColumnValSearch('');
                        }
                      }}
                    >
                      <span className="font-extrabold text-[11px] text-slate-600 group-hover:text-indigo-600 transition-colors">
                        {colName}
                      </span>
                      <Filter className={`w-3 h-3 ${isFiltered ? 'text-indigo-600 fill-indigo-600' : 'text-slate-300 group-hover:text-slate-500'} transition-colors`} />
                    </div>

                    {/* Column Value Filter Popover */}
                    {openFilterColumn === colName && (
                      <div className="absolute left-2 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-40 text-left font-sans flex flex-col gap-2.5 normal-case tracking-normal text-slate-800 animate-in fade-in slide-in-from-top-1 duration-100">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-extrabold text-xs text-slate-900 truncate max-w-[150px]">Filter: {colName}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = { ...activeColumnFilters };
                              delete next[colName];
                              setActiveColumnFilters(next);
                              setOpenFilterColumn(null);
                            }}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                          >
                            Clear
                          </button>
                        </div>

                        <input
                          type="text"
                          placeholder="Search unique values..."
                          value={columnValSearch}
                          onChange={(e) => setColumnValSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                        />

                        <div className="flex flex-col gap-1 overflow-y-auto max-h-44 pr-1">
                          {currentUniqueValues
                            .filter(item => item.val.toLowerCase().includes(columnValSearch.toLowerCase()))
                            .map(item => {
                              const selectedSet = activeColumnFilters[colName] || new Set();
                              const isChecked = selectedSet.has(item.val);
                              
                              return (
                                <label key={item.val} className="flex items-center justify-between gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                                  <div className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const nextSet = new Set(selectedSet);
                                        if (isChecked) {
                                          nextSet.delete(item.val);
                                        } else {
                                          nextSet.add(item.val);
                                        }
                                        
                                        const nextFilters = { ...activeColumnFilters };
                                        if (nextSet.size === 0) {
                                          delete nextFilters[colName];
                                        } else {
                                          nextFilters[colName] = nextSet;
                                        }
                                        setActiveColumnFilters(nextFilters);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="truncate">{item.val}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">({item.count})</span>
                                </label>
                              );
                            })}
                        </div>
                        
                        <div className="flex items-center justify-end border-t border-slate-100 pt-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(null); }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}

              <th className="py-3 px-5 text-center whitespace-nowrap text-[11px] font-black text-slate-600 uppercase tracking-wider">
                Script Score
              </th>
              <th className="py-3 px-5 text-center whitespace-nowrap text-[11px] font-black text-slate-600 uppercase tracking-wider">
                Compliance Status
              </th>
              <th className="py-3 px-6 text-right whitespace-nowrap text-[11px] font-black text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
            {paginatedCalls.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.size + 4} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                      <Search className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h4 className="font-black text-slate-900 text-base">No records found</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      No call records matched your current search queries and filters.
                    </p>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('ALL');
                        setAgentFilter('ALL');
                        setCampaignFilter('ALL');
                        setDurationFilter('ALL');
                        setDatePreset('ALL');
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setActiveColumnFilters({});
                        setCurrentPage(1);
                      }}
                      className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset All Filters ({calls.length} Total Calls)</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCalls.map((call, idx) => {
                const isSelected = selectedIds.has(call.id);
                const talkSec = parseDurationSeconds(call.talkTime || call.duration || (call.rawFields && (call.rawFields['TALKTIME'] || call.rawFields['CALL TIME'])));
                const durationSec = parseDurationSeconds(call.duration || (call.rawFields && call.rawFields['CALL TIME']) || talkSec);
                const talkRatio = durationSec > 0 ? Math.min(100, Math.round((talkSec / durationSec) * 100)) : 100;

                return (
                  <tr 
                    key={call.id || idx}
                    className={`transition-colors group hover:bg-slate-50/80 ${
                      isSelected ? 'bg-indigo-50/60 hover:bg-indigo-50/90' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')
                    }`}
                  >
                    
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(call.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    {/* Visible dynamic columns */}
                    {Array.from(visibleColumns).map((colName) => {
                      const value = getCellValue(call, colName);
                      const normCol = String(colName).toUpperCase().trim();

                      // 1. Audio Recording Playback Button
                      if (normCol === 'RECORDING PATH' || normCol === 'RECORDING_PATH' || normCol === 'AUDIO URL' || normCol === 'AUDIO_URL') {
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap min-w-[90px]">
                            <button
                              onClick={() => onSelectCall(call)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200/70 shadow-2xs transition-all cursor-pointer"
                              title="Play Recording & Inspect"
                            >
                              <Play className="w-3 h-3 fill-indigo-600 text-indigo-600" />
                              <span>Play</span>
                            </button>
                          </td>
                        );
                      }

                      // 2. Lead ID
                      if (normCol === 'LEAD ID' || normCol === 'LEAD_ID' || normCol === 'CALLER ID' || normCol === 'CALLER_ID') {
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap min-w-[120px]">
                            <span className="font-mono font-semibold text-slate-800 text-xs tracking-tight">
                              {value || call.callerId || call.id}
                            </span>
                          </td>
                        );
                      }

                      // 3. Agent Full Name with subtle Avatar
                      if (normCol === 'AGENT FULL NAME' || normCol === 'AGENT NAME' || normCol === 'AGENT') {
                        const agentStr = String(value || call.agentName || 'Unassigned');
                        const initials = agentStr.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AG';
                        
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap min-w-[160px]">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {initials}
                              </div>
                              <span className="font-semibold text-slate-900 text-xs">{agentStr}</span>
                            </div>
                          </td>
                        );
                      }

                      // 4. Candidate Name
                      if (normCol === 'NAME' || normCol === 'CANDIDATE NAME' || normCol === 'CANDIDATENAME') {
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900 text-xs min-w-[130px]">
                            {value && value !== '--' ? value : (
                              <span className="text-slate-400 font-normal italic">--</span>
                            )}
                          </td>
                        );
                      }

                      // 5. Candidate Email
                      if (normCol === 'EMAIL' || normCol === 'CUSTOMER EMAIL' || normCol === 'CANDIDATE_EMAIL') {
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 font-medium min-w-[160px]">
                            {value && value !== '--' ? value : (
                              <span className="text-slate-300">--</span>
                            )}
                          </td>
                        );
                      }

                      // 6. Talktime & Call Time in clean standard dialer format (0:00:00)
                      if (normCol === 'TALKTIME' || normCol === 'TALK_TIME' || normCol === 'CALL TIME' || normCol === 'CALL_TIME' || normCol === 'HOLD TIME' || normCol === 'HOLD_TIME' || normCol === 'DURATION') {
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-700 font-semibold min-w-[110px] tracking-tight">
                            {value || '0:00:00'}
                          </td>
                        );
                      }

                      // 7. Campaign or Process Badge
                      if (normCol === 'CAMPAIGN' || normCol === 'PROCESS' || normCol === 'QUEUE') {
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap min-w-[120px]">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 font-medium text-xs rounded border border-slate-200/80">
                              {value || '--'}
                            </span>
                          </td>
                        );
                      }

                      // 8. Date-Time Formatting
                      if (normCol === 'DATE-TIME' || normCol === 'DATE_TIME' || normCol === 'DATE') {
                        return (
                          <td key={colName} className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 font-medium min-w-[150px]">
                            {value || '--'}
                          </td>
                        );
                      }

                      // General Cell Fallback
                      return (
                        <td key={colName} className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 font-medium max-w-[200px] truncate">
                          {value === '--' || !value ? (
                            <span className="text-slate-300">--</span>
                          ) : typeof value === 'object' ? (
                            String(JSON.stringify(value))
                          ) : (
                            String(value)
                          )}
                        </td>
                      );
                    })}

                    {/* Script Adherence Score Badge */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {call.overallScore !== null && call.overallScore !== undefined ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs border ${
                          call.overallScore >= 80 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : call.overallScore >= 60 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {call.overallScore >= 80 ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : call.overallScore < 60 ? (
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                          ) : null}
                          <span>{call.overallScore}%</span>
                        </span>
                      ) : call.complianceStatus === 'Unanswered' || call.complianceStatus === 'No Speech' ? (
                        <span className="text-slate-400 text-[10px] font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          N/A
                        </span>
                      ) : (call.status === 'Audio Error' || call.complianceStatus === 'Audio Error') ? (
                        <span className="text-amber-700 text-[10px] font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Error
                        </span>
                      ) : call.status === 'Failed' ? (
                        <span className="text-rose-600 text-xs font-bold">Failed</span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-medium italic">Pending</span>
                      )}
                    </td>

                    {/* Compliance Status Badge */}
                    <td className="py-3 px-5 text-center whitespace-nowrap">
                      {call.complianceStatus === 'Passed' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Passed</span>
                        </span>
                      )}
                      {call.complianceStatus === 'Critical Fail' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs animate-pulse">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>Critical Fail</span>
                        </span>
                      )}
                      {call.complianceStatus === 'Unanswered' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <PhoneOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>Unanswered</span>
                        </span>
                      )}
                      {call.complianceStatus === 'No Speech' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                          <span>No Speech</span>
                        </span>
                      )}
                      {(call.complianceStatus === 'Audio Error' || call.status === 'Audio Error') && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          <span>Audio Error</span>
                        </span>
                      )}
                      {(!call.complianceStatus || call.complianceStatus === 'Pending') && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Pending</span>
                        </span>
                      )}
                      {call.complianceStatus === 'Error' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                          <span>API Error</span>
                        </span>
                      )}
                    </td>

                    {/* Actions Group */}
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        <button
                          onClick={() => onSelectCall(call)}
                          className="h-8 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                          title="Inspect call details & transcript"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Inspect</span>
                        </button>

                        <button
                          onClick={() => onAuditSingleCall(call)}
                          disabled={isAuditingId === call.id}
                          className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          title="Evaluate script compliance via AI"
                        >
                          {isAuditingId === call.id ? (
                            <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          )}
                          <span>{call.status === 'Audited' ? 'Re-Audit' : 'AI Audit'}</span>
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. SMART PAGINATION & CONTROLS FOOTER */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-500 font-medium flex items-center justify-between flex-wrap gap-4">
        
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            Showing <strong className="text-slate-800">{sortedAndFilteredCalls.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(currentPage * pageSize, sortedAndFilteredCalls.length)}</strong> of <strong className="text-slate-800">{sortedAndFilteredCalls.length.toLocaleString()}</strong> records
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <span className="text-xs font-bold text-slate-600">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-extrabold rounded-lg px-2.5 py-1 cursor-pointer hover:border-indigo-500 focus:outline-none shadow-2xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50 (Default)</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            title="First Page"
          >
            «
          </button>
          
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-extrabold text-slate-800 px-2 text-xs">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
            title="Last Page"
          >
            »
          </button>
        </div>

      </div>

      {/* 5. FLOATING SMART BATCH ACTIONS HUB (Premium White Glassmorphism) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-md text-slate-800 rounded-2xl shadow-xl px-6 py-3.5 flex items-center gap-4 z-50 border border-slate-200 animate-in fade-in slide-in-from-bottom-5 duration-200 text-xs font-bold">
          
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono px-2 py-0.5 rounded-md font-black">
              {selectedIds.size}
            </span>
            <span className="text-slate-600 font-semibold">calls selected</span>
          </div>

          <div className="w-[1px] h-5 bg-slate-200" />

          <div className="flex items-center gap-2">
            
            <button
              onClick={handleBatchAudit}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>AI Batch Audit ({selectedIds.size})</span>
            </button>

            <button
              onClick={() => {
                const selectedCalls = calls.filter(c => selectedIds.has(c.id));
                exportCallsToCSV(selectedCalls, visibleColumns);
              }}
              className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export Selected</span>
            </button>

            {onDeleteCalls && (
              <button
                onClick={handleBatchDelete}
                className="h-9 px-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete</span>
              </button>
            )}

          </div>

          <div className="w-[1px] h-5 bg-slate-200" />

          <button 
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-xs font-semibold"
          >
            Deselect All
          </button>
        </div>
      )}

    </div>
  );
}
