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

const speakText = (text, speaker) => {
  // Speech synthesis is completely disabled to remove robotic voice noise overlay
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
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [call]);

  // Robotic speech synthesis is disabled. Only the actual audio recording plays.

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
    // Split by words and whitespace so spaces are preserved in rendering
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
        return <span key={index}>{w}</span>;
      }
      
      const thisIdx = wordIdx;
      wordIdx++;

      // Check classes
      let highlightClass = "transition-all duration-150 rounded px-0.5 select-none ";
      if (isSpoken) {
        if (isLineActive) {
          if (thisIdx < currentWordIdx) {
            // Already spoken in the active line
            highlightClass += "text-indigo-600 font-extrabold bg-indigo-50/70";
          } else if (thisIdx === currentWordIdx) {
            // Currently active word
            highlightClass += "text-indigo-900 font-black bg-indigo-200/90 scale-105 shadow-3xs ring-2 ring-indigo-500/20";
          } else {
            // Not yet spoken in the active line
            highlightClass += "text-[var(--text-primary)] font-medium opacity-80";
          }
        } else {
          // Entire bubble is in the past
          highlightClass += "text-[var(--text-primary)] font-medium";
        }
      } else {
        // Future bubble
        highlightClass += "text-[var(--text-muted)] opacity-60";
      }

      return (
        <span
          key={index}
          className={highlightClass}
          onClick={(e) => {
            e.stopPropagation(); // Avoid triggering the parent div's onClick
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
      <div className="bg-[var(--bg-card-solid)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-7xl w-full h-[90vh] flex flex-col relative overflow-hidden modal-content">
        
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
        <div className="p-4 px-6 bg-[var(--bg-card-solid)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-indigo-500/20">
              AI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-[var(--text-primary)]">Call Audit Inspector</h2>
                <span className="text-[10px] bg-[var(--bg-card-subtle)] text-[var(--text-secondary)] font-mono px-2 py-0.5 rounded border border-[var(--border-color)]">
                  {call.id}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Agent: <strong className="text-[var(--text-primary)] font-bold">{call.agentName}</strong> | Candidate: <strong className="text-[var(--text-primary)] font-bold">{call.candidateName}</strong> ({call.callDate})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReAuditClick}
              disabled={isAuditing}
              className="btn-primary py-1.5 px-3.5 text-xs font-bold shadow-sm"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : 'text-amber-300 fill-amber-300'}`} />
              <span>{isAuditing ? (auditProgressStatus || 'Re-Auditing...') : 'Run ChatGPT Audit'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-card-subtle)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Audio Player Strip (Integrated SlashRTC Dynamic Link Player) */}
        <div className="bg-[var(--bg-card-subtle)] p-4 border-b border-[var(--border-color)] flex flex-col items-stretch gap-3 shrink-0 transition-colors">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Controls & Waveform */}
            <div className="flex items-center gap-4 w-full md:w-auto flex-1">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-600 hover:scale-105 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 shrink-0"
                title={isPlaying ? "Pause audio" : "Play audio"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              {/* Audio Waveform simulation */}
              <div className="flex items-center gap-1.5 h-8 px-2 shrink-0">
                {[12, 28, 20, 36, 16, 24, 8, 30, 18, 26, 10, 32].map((height, idx) => (
                  <div
                    key={idx}
                    className="w-1 rounded-full bg-indigo-500 transition-all duration-300"
                    style={{
                      height: isPlaying ? '100%' : '20%',
                      animation: isPlaying
                        ? `wave-bar 1s ease-in-out infinite ${idx * 0.1}s`
                        : 'none',
                      minHeight: '4px',
                      maxHeight: `${height}px`
                    }}
                  />
                ))}
              </div>

              {/* Seekable Progress Bar */}
              <div className="flex-1 md:max-w-md">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-semibold font-mono mb-1 select-none">
                  <span>{formatTime(currentTime)}</span>
                  <span className="flex items-center gap-1.5">
                    <span>{duration > 0 ? formatTime(duration) : (call.talkTime || call.duration)}</span>
                  </span>
                </div>
                <div 
                  onClick={handleSeek}
                  className="w-full bg-slate-200 hover:bg-slate-300 h-2 rounded-full relative cursor-pointer transition-colors"
                  title="Seek playback location"
                >
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full transition-all duration-75 relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-600 shadow-md hover:scale-110 transition-transform"></div>
                  </div>
                </div>
              </div>

              {/* Playback speed multiplier */}
              <div className="flex items-center gap-1 bg-[var(--bg-card-solid)] p-1 rounded-lg border border-[var(--border-color)] text-[11px] font-mono text-[var(--text-secondary)] shrink-0 select-none">
                {[1, 1.25, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackRate(speed)}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      playbackRate === speed 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)]'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Clean player strip toolbar - fallbacks and warning banners removed */}
            <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
              {/* Standard active connection label only */}
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50 flex items-center gap-1 font-bold font-mono shadow-3xs">
                ● Connected
              </span>
            </div>

          </div>

        </div>

        {/* Tab Navigation */}
        <div className="bg-[var(--bg-card-solid)] px-6 py-2 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'AUDIT' 
                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-inner' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ChatGPT Audit Evaluation</span>
            </button>

            <button
              onClick={() => setActiveTab('TRANSCRIPT')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'TRANSCRIPT' 
                  ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shadow-inner' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Speaker Diarized Transcript</span>
            </button>

            <button
              onClick={() => setActiveTab('RAW_META')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'RAW_META' 
                  ? 'bg-slate-500/10 text-[var(--text-primary)] border border-slate-500/20 shadow-inner' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-subtle)]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Raw Call Meta</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-[var(--text-secondary)]">Overall Score:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-xs ${
              (call.overallScore || 0) >= 80 
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
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

            const getCheckpointState = (lineId) => {
              const align = alignment[lineId];
              if (!align) return { status: 'PENDING', label: 'Pending' };

              const { status, seconds, matchTime } = align;
              const isAudioFinished = duration > 0 && currentTime >= duration - 1;

              if (showFinalReport || isAudioFinished) {
                if (status === 'COMPLETED') return { status: 'COMPLETED', label: `Complete [${matchTime}]` };
                if (status === 'TAKEN_LATER') return { status: 'TAKEN_LATER', label: `Taken Later [${matchTime}]` };
                return { status: 'MISSED', label: 'Missed' };
              }

              // Live mode matching
              if (seconds !== null) {
                if (currentTime >= seconds) {
                  if (status === 'COMPLETED') return { status: 'COMPLETED', label: `Complete [${matchTime}]` };
                  return { status: 'TAKEN_LATER', label: `Taken Later [${matchTime}]` };
                }
                return { status: 'PENDING', label: 'Evaluating...' };
              } else {
                const cutoff = CUTOFFS[lineId] || 999;
                if (currentTime > cutoff) {
                  return { status: 'MISSED', label: 'Missed' };
                }
                return { status: 'PENDING', label: 'Evaluating...' };
              }
            };

            return (
              <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto h-full">
                
                {/* Left Column: Live Speech-to-Text alignment */}
                <div className="flex-1 lg:w-3/5 space-y-4 flex flex-col min-h-0">
                  
                  {/* Critical Red Flag Alert Box if present */}
                  {call.hasRedFlags && call.redFlags && call.redFlags.length > 0 && (
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 shadow-rose-500/5 shadow-sm shrink-0">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg shrink-0">
                          <ShieldAlert className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-extrabold text-rose-600 text-sm">Critical Compliance Violations ({call.redFlags.length})</h3>
                          <div className="mt-2 space-y-1.5">
                            {call.redFlags.map((rf, idx) => (
                              <div key={idx} className="bg-[var(--bg-card-solid)] border border-[var(--border-color)] p-2 rounded-lg text-xs font-semibold">
                                <span className="text-rose-500 font-bold">⚠️ {rf.title}: </span>
                                <span className="text-[var(--text-secondary)] font-medium">{rf.snippet || rf.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-4 shadow-xs shrink-0 text-left">
                    <h3 className="font-extrabold text-sm text-[var(--text-primary)]">Speech-to-Text Live Transcript Stream</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5">
                      Matched speech elements are automatically aligned with the PDF script checkpoints. Click to seek audio.
                    </p>
                  </div>

                  {/* Transcript Bubbles Stream */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[55vh]">
                    {call.transcript && call.transcript.length > 0 ? (
                      call.transcript.map((line, idx) => {
                        const lineSec = parseTimeToSeconds(line.time);
                        const isSpoken = currentTime >= lineSec;
                        
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
                                ? 'bg-indigo-50/80 border-indigo-500 ring-4 ring-indigo-100/50 shadow-md scale-[1.01] stt-active-highlight'
                                : isSpoken
                                ? 'bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] shadow-sm'
                                : 'bg-[var(--bg-card-solid)]/30 border-[var(--border-color)]/40 text-[var(--text-muted)] opacity-60'
                            } ${
                              line.speaker === 'Agent' ? 'ml-0 mr-12' : 'ml-12 mr-0 bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-2 font-bold tracking-wide">
                              <span className={`flex items-center gap-2 ${line.speaker === 'Agent' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                                {line.speaker === 'Agent' ? `Agent (${call.agentName})` : `Candidate (${call.candidateName})`}
                              </span>
                              <span className="font-mono text-[var(--text-muted)] font-semibold">{line.time}</span>
                            </div>
                            
                            <p className="text-[13.5px] leading-relaxed font-medium text-[var(--text-primary)] whitespace-pre-line">
                              {renderWordByWordText(line, lineSec, nextLineSec)}
                            </p>

                            {matchedScriptLine && isSpoken && (
                              <div className="mt-3 flex items-center gap-1.5">
                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border ${
                                  alignment[matchedScriptLine.id].status === 'TAKEN_LATER'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Aligned Checkpoint: {matchedScriptLine.title}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-[var(--text-muted)] text-xs font-semibold">
                        No transcript lines available.
                      </div>
                    )}
                  </div>

                  {/* Feedback Summary Card */}
                  <div className="card-white p-4 shrink-0 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                      <h3 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wider">AI Executive Quality Summary</h3>
                    </div>
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--bg-card-subtle)] p-3 rounded-lg border border-[var(--border-color)] font-medium">
                      {call.evaluation?.feedback || "Call successfully evaluated."}
                    </p>
                  </div>

                </div>

                {/* Right Column: PDF script checkpoints & Call Quality Audits */}
                <div className="w-full lg:w-2/5 flex flex-col min-h-0 gap-4">

                  {/* Technical & Voice Quality Audits Card */}
                  <div className="bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm shrink-0 text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <Volume2 className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wider">Technical & Voice Quality Audit</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg">
                        <span className="text-[9px] text-[var(--text-secondary)] font-bold block uppercase tracking-wide">Voice Clarity</span>
                        <span className={`font-extrabold flex items-center gap-1 mt-1 ${
                          (call.callQuality?.voiceClarity === 'Good' || !call.callQuality) ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {(call.callQuality?.voiceClarity === 'Good' || !call.callQuality) ? '✓ Clear & Loud' : `⚠️ ${call.callQuality?.voiceClarity || 'Good'}`}
                        </span>
                      </div>

                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg">
                        <span className="text-[9px] text-[var(--text-secondary)] font-bold block uppercase tracking-wide">Connectivity / Network</span>
                        <span className={`font-extrabold flex items-center gap-1 mt-1 ${
                          (call.callQuality?.networkIssues === 'None' || !call.callQuality) ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {(call.callQuality?.networkIssues === 'None' || !call.callQuality) ? '✓ Stable Connection' : `⚠️ ${call.callQuality?.networkIssues || 'None'}`}
                        </span>
                      </div>

                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg">
                        <span className="text-[9px] text-[var(--text-secondary)] font-bold block uppercase tracking-wide">Ambient Noise</span>
                        <span className={`font-extrabold flex items-center gap-1 mt-1 ${
                          (call.callQuality?.backgroundNoise === 'None' || !call.callQuality) ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {(call.callQuality?.backgroundNoise === 'None' || !call.callQuality) ? '✓ Quiet Environment' : `⚠️ ${call.callQuality?.backgroundNoise || 'None'}`}
                        </span>
                      </div>

                      <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-color)] p-2.5 rounded-lg">
                        <span className="text-[9px] text-[var(--text-secondary)] font-bold block uppercase tracking-wide">Agent Tone & Pacing</span>
                        <span className={`font-extrabold flex items-center gap-1 mt-1 ${
                          (call.callQuality?.agentTone === 'Professional & Polite' || !call.callQuality) ? 'text-indigo-600' : 'text-amber-600'
                        }`}>
                          {call.callQuality?.agentTone || 'Professional & Polite'} ({call.callQuality?.agentPacing || 'Normal'})
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 bg-blue-500/5 border border-blue-500/10 p-2.5 rounded-lg flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                        Candidate Sentiment: <strong className={`font-extrabold ${
                          (call.callQuality?.candidateSentiment === 'Interested' || !call.callQuality) ? 'text-emerald-600' : 'text-slate-700'
                        }`}>{call.callQuality?.candidateSentiment || 'Interested'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* PDF script checkpoints */}
                  <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-4.5 shadow-xs text-left">
                    
                    <div className="pb-3 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 mb-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-[var(--text-primary)]">PDF Script Alignment</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">
                          Verified checkpoint lines from PDF screening script.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] px-2 py-0.5 rounded-md shadow-3xs">
                        <input 
                          type="checkbox" 
                          id="toggleReport"
                          checked={!showFinalReport} 
                          onChange={(e) => setShowFinalReport(!e.target.checked)}
                          className="w-3 h-3 text-indigo-600 rounded cursor-pointer"
                        />
                        <label htmlFor="toggleReport" className="text-[9px] font-extrabold text-[var(--text-secondary)] cursor-pointer select-none">
                          Live STT Mode
                        </label>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[48vh]">
                      {PDF_SCRIPT_LINES.map((line, idx) => {
                        const { status, label } = getCheckpointState(line.id);
                        const isClickable = alignment[line.id]?.seconds !== null;

                        let circleBg = 'border-[var(--border-color)] bg-slate-100 text-slate-400';
                        let statusLabelColor = 'text-[var(--text-muted)] bg-slate-50 border-slate-200';
                        let itemBorderColor = 'border-[var(--border-color)]/70 hover:border-slate-300';
                        
                        if (status === 'COMPLETED') {
                          circleBg = 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/10 shadow-xs circle-completed';
                          statusLabelColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                          itemBorderColor = 'border-emerald-200/60 bg-emerald-50/10';
                        } else if (status === 'TAKEN_LATER') {
                          circleBg = 'bg-amber-500 border-amber-600 text-white shadow-amber-500/10 shadow-xs circle-taken-later';
                          statusLabelColor = 'text-amber-700 bg-amber-50 border-amber-200';
                          itemBorderColor = 'border-amber-200/60 bg-amber-50/10';
                        } else if (status === 'MISSED') {
                          circleBg = 'bg-rose-500 border-rose-600 text-white shadow-rose-500/10 shadow-xs circle-missed';
                          statusLabelColor = 'text-rose-700 bg-rose-50 border-rose-200';
                          itemBorderColor = 'border-rose-200/60 bg-rose-50/10';
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
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${circleBg}`}>
                                {status === 'COMPLETED' ? '✓' : status === 'TAKEN_LATER' ? '⏳' : status === 'MISSED' ? '✗' : idx + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-[var(--text-primary)] text-xs truncate">{line.title}</span>
                                  <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-mono border ${statusLabelColor}`}>
                                    {label}
                                  </span>
                                </div>

                                <p className="text-[10.5px] text-[var(--text-secondary)] font-medium mt-1 leading-relaxed">
                                  "{line.text}"
                                </p>

                                {line.instruction && (
                                  <p className="text-[9px] text-[var(--text-muted)] mt-1.5 italic font-bold">
                                    Guideline: {line.instruction}
                                  </p>
                                )}
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
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-600 font-bold flex items-center justify-between shadow-2xs">
                <span>AI Automated Speech-to-Text Diarization (Agent vs Candidate)</span>
                <span className="font-mono text-[11px]">Duration: {call.talkTime}</span>
              </div>

              {call.transcript && call.transcript.length > 0 ? (
                <div className="space-y-4">
                  {call.transcript.map((line, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4.5 rounded-xl border transition-all duration-200 ${
                        line.speaker === 'Agent'
                          ? 'bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] ml-0 mr-12 shadow-sm'
                          : 'bg-indigo-50/40 border-indigo-100 text-[var(--text-primary)] ml-12 mr-0'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-2 font-bold tracking-wide">
                        <span className={`flex items-center gap-2 ${line.speaker === 'Agent' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {line.speaker === 'Agent' ? `Agent (${call.agentName})` : `Candidate (${call.candidateName})`}
                        </span>
                        <span className="font-mono text-[var(--text-muted)] text-[10px]">{line.time}</span>
                      </div>
                      <p className="text-[13.5px] leading-relaxed font-medium text-[var(--text-primary)] whitespace-pre-line">{line.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-[var(--text-muted)] text-xs font-semibold">
                  No transcript available. Click "Run ChatGPT Audit" to generate transcript.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RAW EXCEL METADATA (80+ fields) */}
          {activeTab === 'RAW_META' && (
            <div className="max-w-4xl mx-auto bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm transition-colors">
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm mb-3">Raw Excel Row Attributes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Date:</span> <strong className="text-[var(--text-primary)] font-bold">{call.callDate}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Caller ID:</span> <strong className="text-[var(--text-primary)] font-bold">{call.callerId}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Agent:</span> <strong className="text-[var(--text-primary)] font-bold">{call.agentName}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Campaign:</span> <strong className="text-[var(--text-primary)] font-bold">{call.campaign}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Queue:</span> <strong className="text-[var(--text-primary)] font-bold">{call.queue}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Candidate:</span> <strong className="text-[var(--text-primary)] font-bold">{call.candidateName}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Email:</span> <strong className="text-[var(--text-primary)] font-bold">{call.candidateEmail}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Disposition:</span> <strong className="text-[var(--text-primary)] font-bold">{call.disposition}</strong></div>
                <div className="p-3 bg-[var(--bg-card-subtle)] rounded-lg border border-[var(--border-color)] font-medium col-span-full"><span className="text-[var(--text-muted)] font-mono block mb-0.5 text-[10px]">Audio URL:</span> <strong className="text-[var(--text-primary)] font-mono text-[10px] break-all select-all">{call.audioUrl}</strong></div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
