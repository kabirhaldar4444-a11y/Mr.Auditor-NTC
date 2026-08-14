import React, { useState, useMemo } from 'react';
import { Search, Play, ShieldAlert, CheckCircle2, Clock, Sparkles, ChevronLeft, ChevronRight, FileSpreadsheet, Eye, Trash2, Zap, SlidersHorizontal, Filter, Check, X, PhoneOff, VolumeX, AlertCircle, Calendar } from 'lucide-react';

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
    if (rawVal && String(rawVal).trim() !== '' && String(rawVal).trim() !== '--') {
      return String(rawVal).trim();
    }
    return call.agentName || rawVal || '--';
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
  const cleanStr = String(dateStr).split(' ')[0]; // ignore time
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return cleanStr;
  }

  const parts = cleanStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts;
    if (p3.length === 2) {
      p3 = '20' + p3;
    }
    let month = parseInt(p1);
    let day = parseInt(p2);
    let year = parseInt(p3);
    
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
  } catch (_) {}
  
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

const parseCallDateTimestamp = (call) => {
  const dStr = call.callDate || (call.rawFields && (call.rawFields['DATE-TIME'] || call.rawFields['Date']));
  if (!dStr) return 0;
  const t = new Date(dStr).getTime();
  return isNaN(t) ? 0 : t;
};

export default function CallTable({ calls, onSelectCall, onAuditSingleCall, isAuditingId, onDeleteCalls, initialAgentFilter = 'ALL', onOpenUpload, onRunBatchAudit, onClearDemoData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState(initialAgentFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pageSize, setPageSize] = useState(50);
  const [dateFilter, setDateFilter] = useState('');

  // Smart Sorting State ('date_desc', 'date_asc', 'talk_desc', 'talk_asc', 'score_desc', 'score_asc')
  const [sortOption, setSortOption] = useState('date_desc');

  // Smart Duration Filter State ('ALL', 'LONG', 'MEDIUM', 'SHORT', 'UNANSWERED')
  const [durationFilter, setDurationFilter] = useState('ALL');

  // Smart Date Filter State ('ALL', 'TODAY', 'YESTERDAY', 'LAST_7', 'THIS_MONTH', 'CUSTOM')
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

  if (calls.length === 0) {
    return (
      <div className="card-white p-12 text-center flex flex-col items-center justify-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-sm animate-pulse">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-base font-extrabold text-[var(--text-primary)]">No Audits Logged Yet</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
            Your call recordings database is empty. Import your CSV or Excel call report exported from the SlashRTC dialer to run automated AI compliance audits.
          </p>
        </div>
        
        <div>
          <button
            onClick={onOpenUpload}
            className="btn-primary text-xs font-bold py-2 px-5 shadow-md flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Upload Batch Dataset</span>
          </button>
        </div>
      </div>
    );
  }

  // Extract unique agents for dropdown
  const uniqueAgents = useMemo(() => {
    const set = new Set(calls.map(c => c.agentName).filter(Boolean));
    return Array.from(set);
  }, [calls]);

  // Extract unique campaigns for dropdown
  const uniqueCampaigns = useMemo(() => {
    const set = new Set(calls.map(c => c.campaign).filter(Boolean));
    return Array.from(set);
  }, [calls]);

  // Extract all columns in the dataset dynamically
  const allAvailableColumns = useMemo(() => {
    if (calls.length === 0 || !calls[0].rawFields) {
      return DEFAULT_COLUMNS;
    }
    return Object.keys(calls[0].rawFields);
  }, [calls]);

  // Compute unique values for the open column header filter popover
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

  // Filtered dataset with smart multi-column scanning search, duration, and smart date presets
  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      let matchSearch = true;
      if (searchTerm) {
        // Clean copy-paste whitespace, non-breaking spaces (\u00A0), tabs, newlines
        const cleanQuery = searchTerm.replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (cleanQuery.length > 0) {
          const queryWords = cleanQuery.split(' ').filter(Boolean);

          // Get searchable haystack text for this record
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

          // Every word in the query must be found somewhere in the record haystack
          matchSearch = queryWords.every(word => fullRecordHaystack.includes(word));
        }
      }

      const matchStatus = 
        statusFilter === 'ALL' ||
        (statusFilter === 'AUDITED' && call.status === 'Audited' && call.overallScore !== null) ||
        (statusFilter === 'PENDING' && call.status !== 'Audited' && call.complianceStatus !== 'Unanswered') ||
        (statusFilter === 'PASSED' && call.complianceStatus === 'Passed') ||
        (statusFilter === 'FAIL' && call.complianceStatus === 'Critical Fail') ||
        (statusFilter === 'UNANSWERED' && call.complianceStatus === 'Unanswered') ||
        (statusFilter === 'AUDIO_ERROR' && (call.complianceStatus === 'Audio Error' || call.status === 'Audio Error'));

      const matchAgent = agentFilter === 'ALL' || call.agentName === agentFilter;

      const matchCampaign = campaignFilter === 'ALL' || call.campaign === campaignFilter;

      // Smart Duration Filter
      let matchDuration = true;
      const talkSec = parseDurationSeconds(call.talkTime || call.duration || (call.rawFields && (call.rawFields['TALKTIME'] || call.rawFields['CALL TIME'])));
      if (durationFilter === 'LONG') {
        matchDuration = talkSec >= 180; // > 3 mins
      } else if (durationFilter === 'MEDIUM') {
        matchDuration = talkSec >= 60 && talkSec < 180; // 1 - 3 mins
      } else if (durationFilter === 'SHORT') {
        matchDuration = talkSec > 0 && talkSec < 60; // < 1 min
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
      } else if (dateFilter) {
        matchDate = callDateNorm === dateFilter;
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
  }, [calls, searchTerm, statusFilter, agentFilter, campaignFilter, durationFilter, datePreset, customStartDate, customEndDate, dateFilter, activeColumnFilters]);

  // Smart Sorted Dataset (highest to lowest talk time, score, date)
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
      // default date_desc (newest first)
      return parseCallDateTimestamp(b) - parseCallDateTimestamp(a);
    });
    return list;
  }, [filteredCalls, sortOption]);

  const totalPages = Math.ceil(sortedAndFilteredCalls.length / pageSize) || 1;
  const paginatedCalls = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredCalls.slice(start, start + pageSize);
  }, [sortedAndFilteredCalls, currentPage, pageSize]);

  // Checkbox functions
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
    const allSelected = allIdsOnPage.every(id => next.has(id));

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
      // Fallback
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

  return (
    <div className="card-white overflow-hidden shadow-sm transition-all duration-300 relative flex flex-col">
      
      {/* Top Filter & Search Controls (Senior Executive UI/UX) */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Search Bar (App Look & Feel) */}
        <div className="relative flex-1 min-w-[320px] lg:max-w-md">
          <Search className="w-4 h-4 text-indigo-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search by ID (e.g. 1000), Agent (Kaushik), Candidate, Lead ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            style={{ paddingLeft: '44px' }}
            className="w-full h-11 pr-10 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
              title="Clear Search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Clean Executive Controls Bar */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Clear Sample/Demo Data Button */}
          {onClearDemoData && calls.some(c => c.id && c.id.startsWith('CALL-2026-0807-')) && (
            <button
              onClick={onClearDemoData}
              className="h-11 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl text-xs font-extrabold text-rose-600 flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
              title="Remove all 50 mock demo records and keep real data only"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Clear Demo Data</span>
            </button>
          )}

          {/* Calendar Date Picker (Choose Date, Month, Year) */}
          <div className="h-11 px-4 bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl flex items-center gap-2.5 shadow-2xs transition-all cursor-pointer">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-slate-400">Date:</span>
            <input 
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
              className="bg-transparent border-none text-xs font-extrabold text-slate-800 outline-none cursor-pointer p-0 font-sans"
            />
            {dateFilter && (
              <button 
                onClick={() => { setDateFilter(''); setCurrentPage(1); setSelectedIds(new Set()); }}
                className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer ml-1 transition-colors"
                title="Clear Date"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Talk Time Filter (ONLY 2 Options: Highest to Lowest & Lowest to Highest) */}
          <div className="h-11 px-4 bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl flex items-center gap-2.5 shadow-2xs transition-all cursor-pointer">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => { setSortOption(e.target.value); setCurrentPage(1); }}
              className="bg-transparent border-none text-xs font-extrabold text-indigo-600 outline-none cursor-pointer p-0 font-sans"
              style={{ width: 'auto' }}
            >
              <option value="talk_desc">Talk Time: Highest to Lowest ⬇</option>
              <option value="talk_asc">Talk Time: Lowest to Highest ⬆</option>
            </select>
          </div>

          {/* Columns Manager Button & Popover */}
          <div className="relative">
            <button
              onClick={() => setShowColumnsPopover(!showColumnsPopover)}
              className="h-11 px-4 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 rounded-2xl text-xs font-extrabold text-slate-700 flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>Columns ({visibleColumns.size})</span>
            </button>
            
            {showColumnsPopover && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-40 flex flex-col gap-3.5 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Visible Columns</span>
                  <button 
                    onClick={() => setVisibleColumns(new Set(DEFAULT_COLUMNS))}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-bold">
                    Reset
                  </button>
                </div>
                
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={columnSearchQuery}
                  onChange={(e) => setColumnSearchQuery(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 transition-all"
                />
                
                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1 font-sans">
                  {allAvailableColumns
                    .filter(col => col.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                    .map(col => {
                      const isChecked = visibleColumns.has(col);
                      return (
                        <label key={col} className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 p-2 rounded-xl transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = new Set(visibleColumns);
                              if (isChecked) next.delete(col);
                              else next.add(col);
                              setVisibleColumns(next);
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="truncate">{col}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Main Call Table */}
      <div className="overflow-x-auto w-full flex-1">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b border-[var(--border-color)] text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              {/* Checkbox Header */}
              <th className="py-3.5 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={paginatedCalls.length > 0 && paginatedCalls.every(c => selectedIds.has(c.id))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              {/* Visible dynamic columns */}
              {Array.from(visibleColumns).map(colName => {
                const isFiltered = activeColumnFilters[colName] && activeColumnFilters[colName].size > 0;
                return (
                  <th key={colName} className="py-3 px-4 whitespace-nowrap text-left relative group">
                    <div 
                      className="flex items-center gap-1.5 cursor-pointer select-none"
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
                      <span className="font-extrabold text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">{colName}</span>
                      <Filter className={`w-2.5 h-2.5 ${isFiltered ? 'text-indigo-400 fill-indigo-500/5' : 'text-[var(--text-muted)]/40 group-hover:text-[var(--text-primary)]'} transition-colors`} />
                    </div>

                    {openFilterColumn === colName && (
                      <div className="absolute left-4 top-full mt-2 w-60 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl shadow-xl p-3 z-45 text-left font-sans flex flex-col gap-2 normal-case tracking-normal text-[var(--text-primary)]">
                        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 mb-0.5">
                          <span className="font-extrabold text-[11px] text-[var(--text-primary)] truncate max-w-[140px]">Filter {colName}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = { ...activeColumnFilters };
                              delete next[colName];
                              setActiveColumnFilters(next);
                              setOpenFilterColumn(null);
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                          >
                            Clear
                          </button>
                        </div>

                        <input
                          type="text"
                          placeholder="Search values..."
                          value={columnValSearch}
                          onChange={(e) => setColumnValSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="input-field py-1 px-2 text-xs bg-[var(--bg-card-subtle)] border-[var(--border-color)]"
                        />

                        <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1 max-h-40 mt-1">
                          {currentUniqueValues
                            .filter(item => item.val.toLowerCase().includes(columnValSearch.toLowerCase()))
                            .map(item => {
                              const selectedSet = activeColumnFilters[colName] || new Set();
                              const isChecked = selectedSet.has(item.val);
                              
                              return (
                                <label key={item.val} className="flex items-center justify-between gap-2 cursor-pointer text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)] p-1 rounded-lg transition-colors">
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
                                      className="w-3.5 h-3.5 text-indigo-500 rounded border-slate-700 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="truncate">{item.val}</span>
                                  </div>
                                  <span className="text-[10px] text-[var(--text-muted)] font-mono">({item.count})</span>
                                </label>
                              );
                            })}
                        </div>
                        
                        <div className="flex items-center justify-end gap-1.5 border-t border-[var(--border-color)] pt-2 mt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(null); }}
                            className="btn-secondary py-1 px-2.5 text-[10px] font-bold"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="py-3 px-5 text-center whitespace-nowrap text-[10px] font-extrabold">Script Score</th>
              <th className="py-3 px-5 text-center whitespace-nowrap text-[10px] font-extrabold">Compliance Badge</th>
              <th className="py-3 px-5 text-right whitespace-nowrap text-[10px] font-extrabold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)] text-sm text-[var(--text-secondary)]">
            {paginatedCalls.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.size + 4} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                      <Search className="w-7 h-7 text-indigo-500" />
                    </div>
                    <h4 className="font-extrabold text-slate-800 text-sm">No records found matching "{searchTerm || 'filters'}"</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      {calls.length > 0
                        ? `The currently loaded batch of ${calls.length} records ranges from ${calls[0]?.id || 'CALL-LOG-1000'} to ${calls[calls.length - 1]?.id || 'CALL-LOG-1359'}.`
                        : 'No calls currently loaded. Import a CSV/Excel file or reset your filters.'}
                    </p>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('ALL');
                        setAgentFilter('ALL');
                        setCampaignFilter('ALL');
                        setDurationFilter('ALL');
                        setDateFilter('');
                        setDatePreset('ALL');
                        setActiveColumnFilters({});
                        setCurrentPage(1);
                      }}
                      className="mt-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Clear Search & Reset All Filters ({calls.length} Records)</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCalls.map((call) => (
                <tr 
                  key={call.id}
                  className={`hover:bg-gray-50 transition-colors group ${
                    selectedIds.has(call.id) ? 'bg-indigo-50 hover:bg-indigo-50/80' : ''
                  }`}
                >
                  
                  {/* Checkbox */}
                  <td className="py-3.5 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(call.id)}
                      onChange={() => toggleSelect(call.id)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  {/* Visible dynamic columns */}
                  {Array.from(visibleColumns).map((colName) => {
                    const value = getCellValue(call, colName);
                    
                    if (colName === 'RECORDING PATH' || colName === 'RECORDING_PATH' || colName === 'audioUrl') {
                      return (
                        <td key={colName} className="py-3 px-4 whitespace-nowrap">
                          <button
                            onClick={() => onSelectCall(call)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[12px] font-medium border border-indigo-200 transition-colors"
                            title="Play Recording"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Play</span>
                          </button>
                        </td>
                      );
                    }

                    if (colName === 'name' || colName === 'CandidateName' || colName === 'Candidate_Name') {
                      return (
                        <td key={colName} className="py-3 px-4 whitespace-nowrap font-extrabold text-[var(--text-primary)]">
                          {value || '-'}
                        </td>
                      );
                    }

                    if (colName === 'email' || colName === 'CUSTOMER EMAIL' || colName === 'Candidate_Email' || colName === 'CandidateEmailAddress/AlternativeEmailAddress') {
                      return (
                        <td key={colName} className="py-3 px-4 whitespace-nowrap text-[var(--text-secondary)] font-mono text-[10px]">
                          {value || '-'}
                        </td>
                      );
                    }

                    return (
                      <td key={colName} className="py-3 px-4 whitespace-nowrap text-[var(--text-secondary)] max-w-[200px] truncate">
                        {value === '--' || !value ? (
                          <span className="text-[var(--text-muted)] opacity-40">-</span>
                        ) : typeof value === 'object' ? (
                          String(JSON.stringify(value))
                        ) : (
                          String(value)
                        )}
                      </td>
                    );
                  })}

                  {/* Script Adherence Score */}
                  <td className="py-3 px-5 text-center font-bold font-mono">
                    {call.overallScore !== null && call.overallScore !== undefined ? (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-bold font-mono ${
                        call.overallScore >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        call.overallScore >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {call.overallScore}%
                      </span>
                    ) : call.complianceStatus === 'Unanswered' ? (
                      <span className="text-gray-400 text-[11px] font-bold font-mono bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">N/A</span>
                    ) : (call.status === 'Audio Error' || call.complianceStatus === 'Audio Error') ? (
                      <span className="text-amber-700 text-[11px] font-bold font-mono bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">N/A</span>
                    ) : call.status === 'Failed' ? (
                      <span className="text-red-600 text-sm font-semibold">Failed</span>
                    ) : (
                      <span className="text-gray-400 text-[12px] italic">Pending</span>
                    )}
                  </td>

                  {/* Compliance Status & Red Flags */}
                  <td className="py-3 px-5 text-center">
                    {call.complianceStatus === 'Passed' && (
                      <span className="badge badge-success">
                        <CheckCircle2 className="w-3 h-3" /> Passed
                      </span>
                    )}
                    {call.complianceStatus === 'Critical Fail' && (
                      <span className="badge badge-danger">
                        <ShieldAlert className="w-3 h-3 animate-pulse" /> Critical Fail
                      </span>
                    )}
                    {call.complianceStatus === 'Unanswered' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        <PhoneOff className="w-3 h-3 text-gray-400" /> Unanswered
                      </span>
                    )}
                    {call.complianceStatus === 'No Speech' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <VolumeX className="w-3 h-3 text-slate-400" /> No Speech
                      </span>
                    )}
                    {(call.complianceStatus === 'Audio Error' || call.status === 'Audio Error') && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-500" /> Audio Error
                      </span>
                    )}
                    {call.complianceStatus === 'Pending' && (
                      <span className="badge badge-info">
                        Pending
                      </span>
                    )}
                    {call.complianceStatus === 'Error' && (
                      <span className="badge badge-danger">
                        <ShieldAlert className="w-3 h-3" /> API Error
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      
                      {/* Inspect / Play Details Button */}
                      <button
                        onClick={() => onSelectCall(call)}
                        className="btn-secondary py-1 px-2.5 text-[11px] font-bold shadow-sm"
                        title="Inspect Script Audit Details"
                      >
                        <Eye className="w-3 h-3 text-[var(--text-secondary)]" />
                        <span>Inspect</span>
                      </button>

                      {/* Run AI Audit Single Button */}
                      <button
                        onClick={() => onAuditSingleCall(call)}
                        disabled={isAuditingId === call.id}
                        className="btn-primary py-1 px-2.5 text-[11px] font-bold shadow-sm"
                        title="Evaluate script compliance via AI"
                      >
                        {isAuditingId === call.id ? (
                          <Sparkles className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-amber-300" />
                        )}
                        <span>{call.status === 'Audited' ? 'Re-Audit' : 'AI Audit'}</span>
                      </button>

                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-4 border-t border-[var(--border-color)] bg-gray-50 text-[13px] text-[var(--text-muted)] font-medium flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            Showing <strong className="text-[var(--text-secondary)]">{Math.min((currentPage - 1) * pageSize + 1, filteredCalls.length)}</strong> to <strong className="text-[var(--text-secondary)]">{Math.min(currentPage * pageSize, filteredCalls.length)}</strong> of <strong className="text-[var(--text-secondary)]">{filteredCalls.length.toLocaleString()}</strong> records
          </div>

          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            <span className="text-xs font-semibold text-gray-500">Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg px-2 py-1 font-bold cursor-pointer hover:border-indigo-500 focus:outline-none"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page (Default)</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-card-solid)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-bold text-[var(--text-primary)] px-1">Page {currentPage} of {totalPages}</span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-card-solid)] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white text-[var(--text-primary)] rounded-xl shadow-xl px-6 py-3.5 flex items-center gap-5 z-40 transition-all border border-[var(--border-color)] animate-in fade-in slide-in-from-bottom-4 duration-200 text-sm font-medium">
          <span className="text-[var(--text-muted)]">
            Selected <strong className="text-[var(--text-primary)] font-semibold font-mono">{selectedIds.size}</strong> calls
          </span>
          
          <div className="w-[1px] h-4 bg-gray-200"></div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchAudit}
              className="btn-primary py-2 px-4 text-sm font-semibold flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>AI Audit Selected ({selectedIds.size} Calls)</span>
            </button>

            <button
              onClick={handleBatchDelete}
              className="btn-secondary py-2 px-4 text-sm font-medium text-red-600 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-gray-200"></div>

          <button 
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      )}

    </div>
  );
}
