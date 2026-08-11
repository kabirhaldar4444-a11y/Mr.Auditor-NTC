import React, { useState, useMemo } from 'react';
import { Search, Play, ShieldAlert, CheckCircle2, Clock, Sparkles, ChevronLeft, ChevronRight, FileSpreadsheet, Eye, Trash2, Zap, SlidersHorizontal, Filter, Check, X } from 'lucide-react';

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
  if (call.rawFields && call.rawFields[colName] !== undefined) {
    return call.rawFields[colName];
  }
  const camelKey = COLUMN_MAPPING[colName] || colName;
  return call[camelKey];
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

export default function CallTable({ calls, onSelectCall, onAuditSingleCall, isAuditingId, onDeleteCalls, initialAgentFilter = 'ALL', onOpenUpload, onRunBatchAudit }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState(initialAgentFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pageSize, setPageSize] = useState(50);
  const [dateFilter, setDateFilter] = useState('');

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

  // Filtered dataset with smart multi-column scanning search
  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      let matchSearch = true;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        if (call.rawFields) {
          matchSearch = Object.values(call.rawFields).some(val => 
            val && String(val).toLowerCase().includes(query)
          );
        } else {
          matchSearch = 
            (call.candidateName && call.candidateName.toLowerCase().includes(query)) ||
            (call.candidateEmail && call.candidateEmail.toLowerCase().includes(query)) ||
            (call.agentName && call.agentName.toLowerCase().includes(query)) ||
            (call.id && call.id.toLowerCase().includes(query)) ||
            (call.callerId && call.callerId.includes(query));
        }
      }

      const matchStatus = 
        statusFilter === 'ALL' ||
        (statusFilter === 'AUDITED' && call.status === 'Audited') ||
        (statusFilter === 'PENDING' && call.status !== 'Audited') ||
        (statusFilter === 'PASSED' && call.complianceStatus === 'Passed') ||
        (statusFilter === 'FAIL' && call.complianceStatus === 'Critical Fail');

      const matchAgent = agentFilter === 'ALL' || call.agentName === agentFilter;

      const matchCampaign = campaignFilter === 'ALL' || call.campaign === campaignFilter;

      let matchDate = true;
      if (dateFilter) {
        const callDateNorm = getNormalizedDateString(call.callDate);
        matchDate = callDateNorm === dateFilter;
      }

      if (!matchSearch || !matchStatus || !matchAgent || !matchCampaign || !matchDate) {
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
  }, [calls, searchTerm, statusFilter, agentFilter, campaignFilter, activeColumnFilters, dateFilter]);

  const totalPages = Math.ceil(filteredCalls.length / pageSize) || 1;
  const paginatedCalls = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCalls.slice(start, start + pageSize);
  }, [filteredCalls, currentPage, pageSize]);

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
      
      {/* Top Filter & Search Controls */}
      <div className="p-5 border-b border-[var(--border-color)] bg-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[280px] lg:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search candidate, lead ID, agent or filters..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className="input-field pl-10 py-2.5 text-sm"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className="input-field py-2.5 text-sm w-auto cursor-pointer"
          >
            <option value="ALL">All Statuses ({calls.length})</option>
            <option value="AUDITED">Audited Only</option>
            <option value="PENDING">Pending AI Audit</option>
            <option value="PASSED">Passed Compliant</option>
            <option value="FAIL">Critical Fail</option>
          </select>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className="input-field py-2.5 text-sm w-auto cursor-pointer"
          >
            <option value="ALL">All Agents ({uniqueAgents.length})</option>
            {uniqueAgents.map(ag => (
              <option key={ag} value={ag}>{ag}</option>
            ))}
          </select>

          {/* Campaign Filter */}
          <select
            value={campaignFilter}
            onChange={(e) => { setCampaignFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className="input-field py-2.5 text-sm w-auto cursor-pointer"
          >
            <option value="ALL">All Campaigns ({uniqueCampaigns.length})</option>
            {uniqueCampaigns.map(camp => (
              <option key={camp} value={camp}>{camp}</option>
            ))}
          </select>

          {/* Date Filter */}
          <div className="flex items-center gap-2 bg-white border border-[var(--border-color)] rounded-lg px-3.5 py-2">
            <span className="text-[12px] font-semibold text-[var(--text-muted)]">Date:</span>
            <input 
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
              className="bg-transparent border-none text-sm text-[var(--text-primary)] outline-none cursor-pointer p-0 min-w-[110px]"
            />
            {dateFilter && (
              <button 
                onClick={() => { setDateFilter(''); setCurrentPage(1); setSelectedIds(new Set()); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
                title="Clear Date Filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Columns Manager Button & Popover */}
          <div className="relative">
            <button
              onClick={() => setShowColumnsPopover(!showColumnsPopover)}
              className="btn-secondary py-2 px-3 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Columns ({visibleColumns.size})</span>
            </button>
            
            {showColumnsPopover && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-[var(--border-color)] rounded-xl shadow-lg p-4 z-30 flex flex-col gap-2 max-h-96 overflow-y-auto text-left">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 mb-1">
                  <span className="font-semibold text-sm text-[var(--text-primary)]">Visible Columns</span>
                  <button 
                    onClick={() => setVisibleColumns(new Set(DEFAULT_COLUMNS))}
                    className="text-[12px] text-indigo-600 hover:text-indigo-700 font-medium">
                    Reset
                  </button>
                </div>
                
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={columnSearchQuery}
                  onChange={(e) => setColumnSearchQuery(e.target.value)}
                  className="input-field py-1.5 px-3 text-sm"
                />
                
                <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1 mt-1 font-sans">
                  {allAvailableColumns
                    .filter(col => col.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                    .map(col => {
                      const isChecked = visibleColumns.has(col);
                      return (
                        <label key={col} className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = new Set(visibleColumns);
                              if (isChecked) next.delete(col);
                              else next.add(col);
                              setVisibleColumns(next);
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
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
                <td colSpan={visibleColumns.size + 4} className="py-16 text-center text-[var(--text-muted)]">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileSpreadsheet className="w-10 h-10 text-[var(--text-muted)] opacity-35" />
                    <p className="font-bold text-[var(--text-primary)]">No audits match your filter criteria</p>
                    <p className="text-xs text-[var(--text-muted)]">Try adjusting search term or clearing grid filters</p>
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
                    {call.status === 'Audited' ? (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-bold font-mono ${
                        call.overallScore >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        call.overallScore >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {call.overallScore}%
                      </span>
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
