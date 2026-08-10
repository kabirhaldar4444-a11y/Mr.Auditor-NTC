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
  const pageSize = 10;
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
      <div className="card-white p-12 text-center flex flex-col items-center justify-center space-y-6 border border-slate-200 shadow-md">
        <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg font-extrabold text-[var(--text-primary)]">No Audits Logged Yet</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
            Your call recordings database is empty. Import your CSV or Excel call report exported from the SlashRTC dialer to run automated AI compliance audits.
          </p>
        </div>
        
        <div>
          <button
            onClick={onOpenUpload}
            className="btn-primary text-xs font-bold py-2.5 px-6 shadow-md"
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
    <div className="card-white overflow-hidden shadow-sm transition-all duration-300 relative">
      
      {/* Top Filter & Search Controls */}
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-card-subtle)]/40 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search candidate, phone, agent name, email, call ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className="input-field pl-10 py-2.5 text-xs sm:text-sm bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)]"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className="input-field py-2.5 text-xs font-semibold w-auto bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer"
          >
            <option value="ALL">All Statuses ({calls.length})</option>
            <option value="AUDITED">Audited Only</option>
            <option value="PENDING">Pending AI Audit</option>
            <option value="PASSED">Passed Compliant</option>
            <option value="FAIL">Critical Compliance Fail</option>
          </select>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className="input-field py-2.5 text-xs font-semibold w-auto bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer"
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
            className="input-field py-2.5 text-xs font-semibold w-auto bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer"
          >
            <option value="ALL">All Campaigns ({uniqueCampaigns.length})</option>
            {uniqueCampaigns.map(camp => (
              <option key={camp} value={camp}>{camp}</option>
            ))}
          </select>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] tracking-wider">Date:</span>
            <input 
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
              className="bg-transparent border-none text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer p-0.5"
            />
            {dateFilter && (
              <button 
                onClick={() => { setDateFilter(''); setCurrentPage(1); setSelectedIds(new Set()); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer ml-1"
                title="Clear Date Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Columns Manager Button & Popover */}
          <div className="relative">
            <button
              onClick={() => setShowColumnsPopover(!showColumnsPopover)}
              className="btn-secondary py-2.5 px-3.5 text-xs font-bold bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Columns Manager ({visibleColumns.size})</span>
            </button>
            
            {showColumnsPopover && (
              <div className="absolute right-0 mt-2 w-72 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl shadow-xl p-3.5 z-30 flex flex-col gap-2 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 mb-1.5">
                  <span className="font-extrabold text-xs text-[var(--text-primary)]">Select Table Columns</span>
                  <button 
                    onClick={() => setVisibleColumns(new Set(DEFAULT_COLUMNS))}
                    className="text-[10px] text-blue-500 hover:text-blue-600 font-bold"
                  >
                    Reset Default
                  </button>
                </div>
                
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={columnSearchQuery}
                  onChange={(e) => setColumnSearchQuery(e.target.value)}
                  className="input-field py-1.5 px-3 text-xs bg-[var(--bg-card-subtle)] border-[var(--border-color)]"
                />
                
                <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1 mt-1.5">
                  {allAvailableColumns
                    .filter(col => col.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                    .map(col => {
                      const isChecked = visibleColumns.has(col);
                      return (
                        <label key={col} className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]/40 p-1.5 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = new Set(visibleColumns);
                              if (isChecked) {
                                next.delete(col);
                              } else {
                                next.add(col);
                              }
                              setVisibleColumns(next);
                            }}
                            className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
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
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-[var(--bg-card-subtle)]/50 border-b border-[var(--border-color)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {/* Checkbox Header */}
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={paginatedCalls.length > 0 && paginatedCalls.every(c => selectedIds.has(c.id))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              {/* Visible dynamic columns */}
              {Array.from(visibleColumns).map(colName => {
                const isFiltered = activeColumnFilters[colName] && activeColumnFilters[colName].size > 0;
                return (
                  <th key={colName} className="py-3 px-5 whitespace-nowrap text-left relative group">
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
                      <span className="font-extrabold text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">{colName}</span>
                      <Filter className={`w-3 h-3 ${isFiltered ? 'text-blue-500 fill-blue-500/10' : 'text-[var(--text-muted)]/50 group-hover:text-[var(--text-primary)]'} transition-colors`} />
                    </div>

                    {openFilterColumn === colName && (
                      <div className="absolute left-4 top-full mt-2 w-64 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl shadow-xl p-3 z-45 text-left font-sans flex flex-col gap-2 normal-case tracking-normal text-[var(--text-primary)]">
                        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
                          <span className="font-extrabold text-xs text-[var(--text-primary)] truncate max-w-[150px]">Filter {colName}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = { ...activeColumnFilters };
                              delete next[colName];
                              setActiveColumnFilters(next);
                              setOpenFilterColumn(null);
                            }}
                            className="text-[10px] text-blue-500 hover:text-blue-600 font-bold"
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
                          className="input-field py-1.5 px-2.5 text-xs bg-[var(--bg-card-subtle)] border-[var(--border-color)]"
                        />

                        <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1 max-h-48 mt-1.5">
                          {currentUniqueValues
                            .filter(item => item.val.toLowerCase().includes(columnValSearch.toLowerCase()))
                            .map(item => {
                              const selectedSet = activeColumnFilters[colName] || new Set();
                              const isChecked = selectedSet.has(item.val);
                              
                              return (
                                <label key={item.val} className="flex items-center justify-between gap-2 cursor-pointer text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]/40 p-1.5 rounded-lg transition-colors">
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
                                      className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
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
              <th className="py-3 px-5 text-center whitespace-nowrap">Script Score</th>
              <th className="py-3 px-5 text-center whitespace-nowrap">Compliance Badge</th>
              <th className="py-3 px-5 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)]">
            {paginatedCalls.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.size + 4} className="py-12 text-center text-[var(--text-muted)]">
                  <div className="flex flex-col items-center justify-center">
                    <FileSpreadsheet className="w-10 h-10 text-[var(--text-muted)] opacity-50 mb-2" />
                    <p className="font-bold text-[var(--text-primary)]">No calls matched your filter</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Try clearing filters or search query</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCalls.map((call) => (
                <tr 
                  key={call.id}
                  className={`hover:bg-[var(--bg-card-subtle)]/30 transition-colors group ${
                    selectedIds.has(call.id) ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''
                  }`}
                >
                  
                  {/* Checkbox */}
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(call.id)}
                      onChange={() => toggleSelect(call.id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>

                  {/* Visible dynamic columns */}
                  {Array.from(visibleColumns).map((colName) => {
                    const value = getCellValue(call, colName);
                    
                    if (colName === 'RECORDING PATH' || colName === 'RECORDING_PATH' || colName === 'audioUrl') {
                      return (
                        <td key={colName} className="py-3 px-5 whitespace-nowrap">
                          <button
                            onClick={() => onSelectCall(call)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[11px] font-bold border border-indigo-500/20 transition-all duration-200"
                            title="Open SlashRTC Audio Player"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>SlashRTC Audio</span>
                          </button>
                        </td>
                      );
                    }

                    if (colName === 'name' || colName === 'CandidateName' || colName === 'Candidate_Name') {
                      return (
                        <td key={colName} className="py-3 px-5 whitespace-nowrap font-bold text-[var(--text-primary)]">
                          {value || '-'}
                        </td>
                      );
                    }

                    if (colName === 'email' || colName === 'CUSTOMER EMAIL' || colName === 'Candidate_Email' || colName === 'CandidateEmailAddress/AlternativeEmailAddress') {
                      return (
                        <td key={colName} className="py-3 px-5 whitespace-nowrap text-[var(--text-secondary)] font-mono text-[11px]">
                          {value || '-'}
                        </td>
                      );
                    }

                    return (
                      <td key={colName} className="py-3 px-5 whitespace-nowrap text-[var(--text-secondary)] max-w-xs truncate">
                        {value === '--' || !value ? (
                          <span className="text-[var(--text-muted)] opacity-50">-</span>
                        ) : typeof value === 'object' ? (
                          String(JSON.stringify(value))
                        ) : (
                          String(value)
                        )}
                      </td>
                    );
                  })}

                  {/* Script Adherence Score */}
                  <td className="py-3 px-5 text-center font-bold">
                    {call.status === 'Audited' ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                        call.overallScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        call.overallScore >= 60 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {call.overallScore}%
                      </span>
                    ) : call.status === 'Failed' ? (
                      <span className="text-rose-500 text-xs font-extrabold">Failed</span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-[11px] italic">Not Audited</span>
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
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      
                      {/* Inspect / Play Details Button */}
                      <button
                        onClick={() => onSelectCall(call)}
                        className="btn-secondary py-1.5 px-3 text-xs text-[var(--text-primary)] border-[var(--border-color)] bg-[var(--bg-card-solid)] hover:bg-[var(--bg-card-subtle)] font-bold transition-all animate-none"
                        title="View Transcript & AI Score Breakdown"
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        <span>Inspect</span>
                      </button>

                      {/* Run AI Audit Single Button */}
                      <button
                        onClick={() => onAuditSingleCall(call)}
                        disabled={isAuditingId === call.id}
                        className="btn-primary py-1.5 px-3 text-xs font-bold transition-all"
                        title="Analyze call with ChatGPT AI"
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-card-subtle)]/40 text-xs text-[var(--text-secondary)] font-medium flex items-center justify-between transition-colors">
        <div>
          Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredCalls.length)}</strong> to <strong>{Math.min(currentPage * pageSize, filteredCalls.length)}</strong> of <strong>{filteredCalls.length.toLocaleString()}</strong> calls
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-solid)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-card-subtle)] transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-bold text-[var(--text-primary)] px-2">Page {currentPage} of {totalPages}</span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-solid)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-card-subtle)] transition-all duration-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-4 z-40 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 font-semibold text-xs border border-slate-800">
          <span className="text-slate-300">
            Selected <strong className="text-white font-extrabold">{selectedIds.size}</strong> calls
          </span>
          
          <div className="w-px h-4 bg-slate-700"></div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchAudit}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>AI Audit Selected</span>
            </button>

            <button
              onClick={handleBatchDelete}
              className="bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          <div className="w-px h-4 bg-slate-700"></div>

          <button 
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

    </div>
  );
}
