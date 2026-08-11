import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, ShieldCheck, ShieldAlert, CheckCircle2, 
  XCircle, Sparkles, ExternalLink, Lock, FileText, 
  MessageSquare, X, AlertTriangle, Volume2, Clock, Check, Users
} from 'lucide-react';
import { SCRIPT_CHECKPOINTS, RED_FLAG_RULES, PDF_SCRIPT_LINES } from '../data/scriptData';

const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  return parseFloat(timeStr) || 0;
};

const analyzeScriptAlignment = (transcript, scriptLines) => {
  if (!transcript || transcript.length === 0) return {};

  const matches = {};
  scriptLines.forEach((line) => {
    let matchedIdx = -1;
    let matchedTime = null;

    for (let idx = 0; idx < transcript.length; idx++) {
      const t = transcript[idx];
      const textLower = t.text.toLowerCase();

      // Check keywords
      const hasKeyword = line.keywords.some((keyword) => 
        textLower.includes(keyword.toLowerCase())
      );
      
      // Prohibited words (e.g. Greeting check)
      const hasProhibited = line.prohibited && line.prohibited.some((word) => 
        textLower.includes(word.toLowerCase())
      );

      if (hasKeyword && !hasProhibited) {
        matchedIdx = idx;
        matchedTime = t.time;
        break;
      }
    }

    if (matchedIdx !== -1) {
      matches[line.id] = {
        transcriptIndex: matchedIdx,
        time: matchedTime,
        seconds: parseTimeToSeconds(matchedTime)
      };
    }
  });

  const alignment = {};
  scriptLines.forEach((line, index) => {
    const match = matches[line.id];

    if (!match) {
      alignment[line.id] = {
        status: 'MISSED',
        matchTime: null,
        seconds: null
      };
    } else {
      let isTakenLater = false;
      for (let nextIdx = index + 1; nextIdx < scriptLines.length; nextIdx++) {
        const nextLine = scriptLines[nextIdx];
        const nextMatch = matches[nextLine.id];
        if (nextMatch && match.transcriptIndex > nextMatch.transcriptIndex) {
          isTakenLater = true;
          break;
        }
      }

      alignment[line.id] = {
        status: isTakenLater ? 'TAKEN_LATER' : 'COMPLETED',
        matchTime: match.time,
        seconds: match.seconds
      };
    }
  });

  return alignment;
};

const CUTOFFS = {
  PL1: 20,
  PL2: 45,
  PL3: 80,
  PL4: 120,
  PL5: 160,
  PL6: 220,
  PL7: 260,
  PL8: 320,
  PL9: 380,
  PL10: 420
};

export default function AuditInspectorModal({ call, onClose, onReAudit, slashRtcActive, onOpenSlashRTC, username, password, portalUrl, auditProgressStatus }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeTab, setActiveTab] = useState('AUDIT'); // 'AUDIT' | 'TRANSCRIPT' | 'RAW_META'
  const [isAuditing, setIsAuditing] = useState(false);

  // Real Audio player state
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [hasAttemptedPlay, setHasAttemptedPlay] = useState(false);

  const [showFinalReport, setShowFinalReport] = useState(true);
  
  const lastSpokenIndexRef = useRef(-1);

  const [activeLineIdx, setActiveLineIdx] = useState(-1);
  const transcriptContainerRef = useRef(null);
  const transcriptTabContainerRef = useRef(null);

  // Handle play / pause toggle
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      setHasAttemptedPlay(true);
      audioRef.current.play().catch(err => {
        console.error("Playback failed:", err);
        setIsPlaying(false);
        setAudioError(true);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Handle speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Reload audio on call record changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioError(false);
    setHasAttemptedPlay(false);

    setShowFinalReport(true);
    lastSpokenIndexRef.current = -1;
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [call]);

  // Track the active dialogue line index based on playback time
  useEffect(() => {
    if (!call.transcript || call.transcript.length === 0) {
      setActiveLineIdx(-1);
      return;
    }
    
    let index = -1;
    for (let i = 0; i < call.transcript.length; i++) {
      const lineSec = parseTimeToSeconds(call.transcript[i].time);
      const nextLine = call.transcript[i + 1];
      const nextLineSec = nextLine ? parseTimeToSeconds(nextLine.time) : (duration || lineSec + 5);
      
      if (currentTime >= lineSec && currentTime < nextLineSec) {
        index = i;
        break;
      }
    }
    
    // If no exact match is found but currentTime is greater than the last line, make the last line active
    if (index === -1 && currentTime >= parseTimeToSeconds(call.transcript[call.transcript.length - 1].time)) {
      index = call.transcript.length - 1;
    }
    
    if (index !== activeLineIdx) {
      setActiveLineIdx(index);
    }
  }, [currentTime, call.transcript, duration, activeLineIdx]);

  // Automatically scroll the active transcript line into view
  useEffect(() => {
    if (activeLineIdx === -1 || !isPlaying) return;
    
    if (activeTab === 'AUDIT') {
      const activeEl = document.querySelector('.stt-active-highlight');
      if (activeEl && transcriptContainerRef.current) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    } else if (activeTab === 'TRANSCRIPT') {
      const activeEl = document.querySelector('.stt-active-highlight-tab2');
      if (activeEl && transcriptTabContainerRef.current) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [activeLineIdx, isPlaying, activeTab]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioError = () => {
    console.error("Audio recording failed to load.");
    setAudioError(true);
    setIsPlaying(false);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    if (width === 0) return;
    const clickPercent = clickX / width;
    const newTime = clickPercent * (duration || 1);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (timeInSecs) => {
    if (isNaN(timeInSecs) || !isFinite(timeInSecs)) return '00:00';
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const renderWordByWordText = (line, lineSec, nextLineSec) => {
    const words = line.text.split(/(\s+)/);
    
    // Filter out pure whitespace for timing calculation
    const timedWords = [];
    let wordCount = 0;
    words.forEach((w) => {
      if (w.trim() !== '') {
        timedWords.push({ index: wordCount, text: w });
        wordCount++;
      }
    });

    const totalWords = timedWords.length;
    if (totalWords === 0) return line.text;

    // Estimate line duration
    const lineDuration = Math.max(1, nextLineSec - lineSec);
    const isSpoken = currentTime >= lineSec;
    const isLineActive = currentTime >= lineSec && currentTime < nextLineSec && isPlaying;

    let currentWordIdx = -1;
    if (isLineActive) {
      const elapsed = currentTime - lineSec;
      const progress = elapsed / lineDuration;
      currentWordIdx = Math.floor(progress * totalWords);
      if (currentWordIdx >= totalWords) currentWordIdx = totalWords - 1;
    }

    let wordIdx = 0;
    return words.map((w, index) => {
      if (w.trim() === '') {
        const nextWordIdx = wordIdx;
        const shouldHideSpace = !showFinalReport && isLineActive && nextWordIdx > currentWordIdx;
        const shouldHideSpaceFuture = !showFinalReport && !isSpoken;
        if (shouldHideSpace || shouldHideSpaceFuture) {
          return null;
        }
        return <span key={index}>{w}</span>;
      }
      
      const thisIdx = wordIdx;
      wordIdx++;

      // In Live STT mode, hide words that haven't been reached yet
      if (!showFinalReport) {
        if (!isSpoken) {
          return null;
        }
        if (isLineActive && thisIdx > currentWordIdx) {
          return null;
        }
      }

      // Check classes
      let highlightClass = "transition-all duration-150 rounded px-0.5 select-none ";
      if (isSpoken) {
        if (isLineActive) {
          if (thisIdx < currentWordIdx) {
            highlightClass += "text-indigo-350 font-extrabold bg-indigo-500/10";
          } else if (thisIdx === currentWordIdx) {
            highlightClass += "text-white font-black bg-indigo-500/30 scale-105 shadow-3xs ring-1 ring-indigo-400/40";
          } else {
            highlightClass += "text-[var(--text-primary)] font-medium opacity-80";
          }
        } else {
          highlightClass += "text-[var(--text-primary)] font-medium";
        }
      } else {
        highlightClass += "text-[var(--text-muted)] opacity-50";
      }

      return (
        <span
          key={index}
          className={highlightClass}
          onClick={(e) => {
            e.stopPropagation();
            if (audioRef.current) {
              const targetTime = lineSec + (thisIdx / totalWords) * lineDuration;
              audioRef.current.currentTime = targetTime;
              setCurrentTime(targetTime);
            }
          }}
          title="Click to play from this word"
        >
          {w}
        </span>
      );
    });
  };

  const handleReAuditClick = async () => {
    setIsAuditing(true);
    await onReAudit(call);
    setIsAuditing(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="bg-white text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-7xl w-full h-[90vh] flex flex-col relative overflow-hidden modal-content">
        
        {/* Hidden HTML5 Audio Element */}
        <audio
          ref={audioRef}
          src={call.audioUrl || ''}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          preload="auto"
          muted={false}
        />

        {/* Header Bar */}
        <div className="px-7 py-4 bg-white border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-[11px] shadow-sm">
              AI
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-base text-[var(--text-primary)] leading-none">Call Audit Inspector</h2>
                <span className="text-[11px] bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded border border-gray-200 leading-none">
                  {call.id}
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-muted)] mt-1.5 font-normal">
                Agent: <strong className="text-[var(--text-secondary)] font-medium">{call.agentName}</strong> | Candidate: <strong className="text-[var(--text-secondary)] font-medium">{call.candidateName}</strong> ({call.callDate})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleReAuditClick}
              disabled={isAuditing}
              className="btn-primary py-2 px-4 text-sm font-semibold"
            >
              <Sparkles className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
              <span>{isAuditing ? (auditProgressStatus || 'Re-Auditing...') : 'Run AI Audit'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Audio Player Strip (Integrated SlashRTC Dynamic Link Player) */}
        <div className="bg-gray-50 px-6 py-4 border-b border-[var(--border-color)] flex flex-col items-stretch gap-3 shrink-0">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Controls & Waveform */}
            <div className="flex items-center gap-4 w-full md:w-auto flex-1">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                title={isPlaying ? "Pause audio" : "Play audio"}
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5 fill-white" /> : <Play className="w-4.5 h-4.5 fill-white ml-0.5" />}
              </button>

              {/* Audio Waveform simulation */}
              <div className="flex items-center gap-1.5 h-6 px-1 shrink-0">
                {[10, 24, 16, 30, 12, 20, 6, 26, 14, 22, 8, 28].map((height, idx) => (
                  <div
                    key={idx}
                    className="w-1 rounded-full bg-indigo-400 transition-all duration-300"
                    style={{
                      height: isPlaying ? '100%' : '20%',
                      animation: isPlaying
                        ? `wave-bar 1s ease-in-out infinite ${idx * 0.1}s`
                        : 'none',
                      minHeight: '3px',
                      maxHeight: `${height - 4}px`
                    }}
                  />
                ))}
              </div>

              {/* Seekable Progress Bar */}
              <div className="flex-1 md:max-w-md">
                <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mb-1.5 select-none">
                  <span>{formatTime(currentTime)}</span>
                  <span>{duration > 0 ? formatTime(duration) : (call.talkTime || call.duration)}</span>
                </div>
                <div 
                  onClick={handleSeek}
                  className="w-full bg-gray-200 hover:bg-gray-300 h-2 rounded-full relative cursor-pointer transition-colors"
                  title="Seek playback location"
                >
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-75 relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 shadow-md hover:scale-110 transition-transform"></div>
                  </div>
                </div>
              </div>

              {/* Playback speed multiplier */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[var(--border-color)] text-[11px] font-mono text-gray-500 shrink-0 select-none">
                {[1, 1.25, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackRate(speed)}
                    className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                      playbackRate === speed 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 font-medium">
                ● Dialer Sync Active
              </span>
            </div>

          </div>

        </div>

        {/* Tab Navigation */}
        <div className="bg-white px-6 py-0 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'AUDIT' 
                  ? 'border-indigo-600 text-indigo-600 font-semibold' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>AI Audit Evaluation</span>
            </button>

            <button
              onClick={() => setActiveTab('TRANSCRIPT')}
              className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'TRANSCRIPT' 
                  ? 'border-indigo-600 text-indigo-600 font-semibold' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Diarized Transcript</span>
            </button>

            <button
              onClick={() => setActiveTab('RAW_META')}
              className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'RAW_META' 
                  ? 'border-indigo-600 text-indigo-600 font-semibold' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Raw Call Meta</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-[var(--text-muted)]">Script Adherence:</span>
            <span className={`px-2.5 py-0.5 rounded font-extrabold text-xs font-mono ${
              (call.overallScore || 0) >= 80 
                ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10' 
                : 'bg-rose-500/5 text-rose-450 border border-rose-500/10'
            }`}>
              {call.overallScore || 0}%
            </span>
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-app)]">
          
          {/* TAB 1: AUDIT BREAKDOWN */}
          {activeTab === 'AUDIT' && (() => {
            const alignment = analyzeScriptAlignment(call.transcript, PDF_SCRIPT_LINES);

            const getCheckpointState = (lineId, evalKey) => {
              const align = alignment[lineId];
              const aiEvalPassed = call.evaluation && typeof call.evaluation[evalKey] === 'boolean' ? call.evaluation[evalKey] : null;
              const isAudioFinished = duration > 0 && currentTime >= duration - 1;

              if (showFinalReport || isAudioFinished || call.status === 'Audited') {
                if (aiEvalPassed !== null) {
                  if (aiEvalPassed) return { status: 'COMPLETED', label: '✓ PASSED' };
                  return { status: 'MISSED', label: '✗ FAILED' };
                }
                if (align?.status === 'COMPLETED') return { status: 'COMPLETED', label: `✓ PASSED [${align.matchTime}]` };
                if (align?.status === 'TAKEN_LATER') return { status: 'TAKEN_LATER', label: `✓ PASSED [${align.matchTime}]` };
                return { status: 'MISSED', label: '✗ MISSED' };
              }

              // Live playback STT mode matching
              if (align?.seconds !== null) {
                if (currentTime >= align.seconds) {
                  if (aiEvalPassed === false) return { status: 'MISSED', label: '✗ FAILED' };
                  return { status: 'COMPLETED', label: `✓ PASSED [${align.matchTime}]` };
                }
                return { status: 'PENDING', label: 'Evaluating...' };
              } else {
                const cutoff = CUTOFFS[lineId] || 999;
                if (currentTime > cutoff) {
                  if (aiEvalPassed === true) return { status: 'COMPLETED', label: '✓ PASSED' };
                  return { status: 'MISSED', label: '✗ MISSED' };
                }
                return { status: 'PENDING', label: 'Evaluating...' };
              }
            };

            return (
              <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto h-full items-stretch">
                
                {/* Left Column: Live Speech-to-Text alignment */}
                <div className="flex-1 lg:w-3/5 space-y-4 flex flex-col min-h-0">
                  
                  {/* Critical Red Flag Alert Box if present */}
                  {call.hasRedFlags && call.redFlags && call.redFlags.length > 0 && (
                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 shadow-sm shrink-0 text-left">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-rose-500/10 text-rose-455 rounded-lg shrink-0">
                          <ShieldAlert className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-extrabold text-rose-400 text-xs uppercase tracking-wide">Critical Compliance Violations ({call.redFlags.length})</h3>
                          <div className="mt-2.5 space-y-2">
                            {call.redFlags.map((rf, idx) => (
                              <div key={idx} className="bg-[var(--bg-card-solid)] border border-[var(--border-color)] p-2.5 rounded-lg text-xs font-semibold">
                                <span className="text-rose-400 font-extrabold">⚠️ {rf.title}: </span>
                                <span className="text-[var(--text-secondary)] font-medium">{rf.snippet || rf.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-4 shadow-xs shrink-0 text-left">
                    <h3 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wide">Speech-to-Text Aligned Stream</h3>
                    <p className="text-[11px] text-[var(--text-muted)] font-medium mt-1 leading-relaxed">
                      Auditor playback and compliance parsing workspace. Matched speech tags are aligned with script checkpoints. Click lines to seek.
                    </p>
                  </div>

                  {/* Transcript Bubbles Stream */}
                  <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-1.5 max-h-[50vh]">
                    {call.transcript && call.transcript.length > 0 ? (
                      call.transcript.map((line, idx) => {
                        const lineSec = parseTimeToSeconds(line.time);
                        const isSpoken = currentTime >= lineSec;

                        // In Live STT mode, hide future bubbles that have not been spoken yet
                        if (!showFinalReport && !isSpoken) {
                          return null;
                        }
                        
                        const nextLine = call.transcript[idx + 1];
                        const nextLineSec = nextLine ? parseTimeToSeconds(nextLine.time) : (duration || lineSec + 5);
                        const isActive = currentTime >= lineSec && currentTime < nextLineSec && isPlaying;

                        const matchedScriptLine = PDF_SCRIPT_LINES.find((sLine) => {
                          const align = alignment[sLine.id];
                          return align && align.matchTime === line.time;
                        });

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = lineSec;
                                setCurrentTime(lineSec);
                              }
                            }}
                            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
                              isActive
                                ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md stt-active-highlight'
                                : isSpoken
                                ? 'bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] shadow-sm'
                                : 'bg-[var(--bg-card-solid)]/30 border-[var(--border-color)]/30 text-[var(--text-muted)] opacity-50'
                            } ${
                              line.speaker === 'Agent' ? 'ml-0 mr-12' : 'ml-12 mr-0 bg-slate-900/20'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] mb-2 font-bold tracking-wide">
                              <span className={`flex items-center gap-1.5 ${line.speaker === 'Agent' ? 'text-indigo-400' : 'text-emerald-450'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                {line.speaker === 'Agent' ? `Agent (${call.agentName})` : `Candidate (${call.candidateName})`}
                              </span>
                              <span className="font-mono text-[var(--text-muted)] font-semibold">{line.time}</span>
                            </div>
                            
                            <p className="text-xs sm:text-[13px] leading-relaxed font-medium text-[var(--text-primary)] whitespace-pre-line">
                              {renderWordByWordText(line, lineSec, nextLineSec)}
                            </p>

                            {matchedScriptLine && isSpoken && (
                              <div className="mt-3 flex items-center gap-1.5">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded flex items-center gap-1 border ${
                                  alignment[matchedScriptLine.id].status === 'TAKEN_LATER'
                                    ? 'bg-amber-500/5 border-amber-500/10 text-amber-400'
                                    : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                                }`}>
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>Aligned: {matchedScriptLine.title}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-[var(--text-muted)] text-xs font-semibold italic">
                        No transcript lines available. Run AI audit.
                      </div>
                    )}
                  </div>

                  {/* Feedback Summary Card */}
                  <div className="card-white p-4.5 shrink-0 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <h3 className="font-extrabold text-[10px] text-[var(--text-primary)] uppercase tracking-wider">AI Audit Scorecard Summary</h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-card-subtle)] p-3 rounded-lg border border-[var(--border-color)] font-semibold">
                      {call.evaluation?.feedback || "Call successfully evaluated."}
                    </p>
                  </div>

                </div>

                {/* Right Column: Summarized Checkpoints & Voice Audits */}
                <div className="w-full lg:w-2/5 flex flex-col min-h-0 gap-4">

                  {/* Technical & Voice Quality Audits Card */}
                  <div className="bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm shrink-0 text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                      <h3 className="font-extrabold text-[10px] text-[var(--text-primary)] uppercase tracking-wider">Voice Parameters Audit</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg font-semibold">
                        <span className="text-[9px] text-[var(--text-muted)] font-bold block uppercase tracking-wide">Voice Clarity</span>
                        <span className={`font-extrabold flex items-center gap-1 mt-1 ${
                          (call.callQuality?.voiceClarity === 'Good' || !call.callQuality) ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {(call.callQuality?.voiceClarity === 'Good' || !call.callQuality) ? '✓ Clear & Audible' : `⚠️ ${call.callQuality?.voiceClarity || 'Good'}`}
                        </span>
                      </div>

                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg font-semibold">
                        <span className="text-[9px] text-[var(--text-muted)] font-bold block uppercase tracking-wide">Connection</span>
                        <span className={`font-extrabold flex items-center gap-1 mt-1 ${
                          (call.callQuality?.networkIssues === 'None' || !call.callQuality) ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {(call.callQuality?.networkIssues === 'None' || !call.callQuality) ? '✓ Stable' : `⚠️ ${call.callQuality?.networkIssues || 'None'}`}
                        </span>
                      </div>

                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg font-semibold">
                        <span className="text-[9px] text-[var(--text-muted)] font-bold block uppercase tracking-wide">Ambient Noise</span>
                        <span className={`font-extrabold flex items-center gap-1 mt-1 ${
                          (call.callQuality?.backgroundNoise === 'None' || !call.callQuality) ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {(call.callQuality?.backgroundNoise === 'None' || !call.callQuality) ? '✓ Quiet' : `⚠️ ${call.callQuality?.backgroundNoise || 'None'}`}
                        </span>
                      </div>

                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg font-semibold">
                        <span className="text-[9px] text-[var(--text-muted)] font-bold block uppercase tracking-wide">Tone & Pace</span>
                        <span className="font-extrabold flex items-center gap-1 mt-1 text-indigo-400">
                          {call.callQuality?.agentTone || 'Polite'} ({call.callQuality?.agentPacing || 'Normal'})
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 bg-indigo-500/5 border border-indigo-500/10 p-2.5 rounded-lg flex items-center gap-2 font-semibold">
                      <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="text-[11px] text-[var(--text-primary)]">
                        Candidate Sentiment: <strong className="font-extrabold text-emerald-400">{call.callQuality?.candidateSentiment || 'Interested'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Summarized Script Checkpoints Checklist */}
                  <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm text-left">
                    
                    <div className="pb-3 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 mb-3">
                      <div>
                        <h3 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wide">Speech-to-Text Checkpoints</h3>
                        <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5 leading-none">
                          10 Checkpoints pass/fail audit results.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] px-2 py-0.5 rounded shadow-3xs">
                        <input 
                          type="checkbox" 
                          id="toggleReport"
                          checked={!showFinalReport} 
                          onChange={(e) => setShowFinalReport(!e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-500 rounded cursor-pointer"
                        />
                        <label htmlFor="toggleReport" className="text-[9px] font-extrabold text-[var(--text-muted)] cursor-pointer select-none">
                          Live Match Mode
                        </label>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[42vh]">
                      {PDF_SCRIPT_LINES.map((line, idx) => {
                        const { status, label } = getCheckpointState(line.id, line.evalKey);
                        const isClickable = alignment[line.id]?.seconds !== null;

                        let circleBg = 'border-gray-300 bg-gray-100 text-gray-400';
                        let statusLabelColor = 'text-gray-500 bg-gray-100 border border-gray-200';
                        let itemBorderColor = 'border-[var(--border-color)] bg-[var(--bg-card-subtle)]/40 hover:border-gray-400';
                        
                        if (status === 'COMPLETED') {
                          circleBg = 'bg-emerald-600 border-emerald-700 text-white shadow-xs font-black';
                          statusLabelColor = 'text-emerald-700 bg-emerald-50 border border-emerald-200 font-extrabold';
                          itemBorderColor = 'border-emerald-200/80 bg-emerald-50/30';
                        } else if (status === 'TAKEN_LATER') {
                          circleBg = 'bg-emerald-600 border-emerald-700 text-white shadow-xs font-black';
                          statusLabelColor = 'text-emerald-700 bg-emerald-50 border border-emerald-200 font-extrabold';
                          itemBorderColor = 'border-emerald-200/80 bg-emerald-50/30';
                        } else if (status === 'MISSED') {
                          circleBg = 'bg-rose-600 border-rose-700 text-white shadow-xs font-black';
                          statusLabelColor = 'text-rose-700 bg-rose-50 border border-rose-200 font-extrabold';
                          itemBorderColor = 'border-rose-200/80 bg-rose-50/30';
                        }

                        return (
                          <div
                            key={line.id}
                            onClick={() => {
                              if (isClickable && audioRef.current) {
                                const sec = alignment[line.id].seconds;
                                audioRef.current.currentTime = sec;
                                setCurrentTime(sec);
                              }
                            }}
                            className={`p-3 rounded-xl border text-left transition-all duration-150 ${itemBorderColor} ${
                              isClickable ? 'cursor-pointer hover:shadow-2xs active:scale-[0.99]' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${circleBg}`}>
                                {status === 'COMPLETED' || status === 'TAKEN_LATER' ? '✓' : status === 'MISSED' ? '✗' : idx + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-[var(--text-primary)] text-xs truncate">{line.title}</span>
                                  <span className={`text-[9.5px] px-2 py-0.5 rounded-md font-mono border ${statusLabelColor}`}>
                                    {label}
                                  </span>
                                </div>

                                <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1 leading-relaxed">
                                  {line.summary || line.text}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>

                </div>

              </div>
            );
          })()}

          {/* TAB 2: SPEAKER TRANSCRIPT */}
          {activeTab === 'TRANSCRIPT' && (
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs text-indigo-400 font-bold flex items-center justify-between shadow-2xs font-mono">
                <span>Speech-to-Text Diarization (Agent vs Candidate)</span>
                <span>Duration: {call.talkTime || call.duration}</span>
              </div>

              {call.transcript && call.transcript.length > 0 ? (
                <div ref={transcriptTabContainerRef} className="space-y-4">
                  {call.transcript.map((line, idx) => {
                    const lineSec = parseTimeToSeconds(line.time);
                    const nextLine = call.transcript[idx + 1];
                    const nextLineSec = nextLine ? parseTimeToSeconds(nextLine.time) : (duration || lineSec + 5);
                    const isActive = currentTime >= lineSec && currentTime < nextLineSec && isPlaying;

                    return (
                      <div 
                        key={idx} 
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = lineSec;
                            setCurrentTime(lineSec);
                          }
                        }}
                        className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md stt-active-highlight-tab2'
                            : 'bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] shadow-sm'
                        } ${
                          line.speaker === 'Agent'
                            ? 'ml-0 mr-12'
                            : 'ml-12 mr-0 bg-slate-900/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] mb-2 font-bold tracking-wide">
                          <span className={`flex items-center gap-1.5 ${line.speaker === 'Agent' ? 'text-indigo-400' : 'text-emerald-455'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {line.speaker === 'Agent' ? `Agent (${call.agentName})` : `Candidate (${call.candidateName})`}
                          </span>
                          <span className="font-mono text-[var(--text-muted)] text-[10px]">{line.time}</span>
                        </div>
                        <p className="text-xs sm:text-[13px] leading-relaxed font-medium text-[var(--text-primary)] whitespace-pre-line">
                          {renderWordByWordText(line, lineSec, nextLineSec)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-[var(--text-muted)] text-xs font-semibold italic">
                  No transcript available. Run AI audit.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RAW EXCEL METADATA (80+ fields) */}
          {activeTab === 'RAW_META' && (
            <div className="max-w-4xl mx-auto bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm transition-colors text-left">
              <h3 className="font-extrabold text-[var(--text-primary)] text-xs uppercase tracking-wider mb-4">Raw Call Ingestion Columns</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-semibold">
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Date:</span> <strong className="text-[var(--text-primary)] font-bold">{call.callDate}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Caller ID:</span> <strong className="text-[var(--text-primary)] font-bold">{call.callerId}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Agent:</span> <strong className="text-[var(--text-primary)] font-bold">{call.agentName}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Campaign:</span> <strong className="text-[var(--text-primary)] font-bold">{call.campaign}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Queue:</span> <strong className="text-[var(--text-primary)] font-bold">{call.queue}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Candidate:</span> <strong className="text-[var(--text-primary)] font-bold">{call.candidateName}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Email:</span> <strong className="text-[var(--text-primary)] font-bold">{call.candidateEmail}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)]"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Disposition:</span> <strong className="text-[var(--text-primary)] font-bold">{call.disposition}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] col-span-full"><span className="text-[var(--text-muted)] font-mono block mb-1 text-[9px]">Audio URL Link:</span> <strong className="text-[var(--text-primary)] font-mono text-[10px] break-all select-all font-medium">{call.audioUrl}</strong></div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
