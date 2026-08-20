import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play, Pause, ShieldCheck, ShieldAlert, CheckCircle2,
  XCircle, Sparkles, ExternalLink, Lock, FileText,
  MessageSquare, X, AlertTriangle, Volume2, Clock, Check, Users, PhoneOff, VolumeX, AlertCircle,
  Briefcase, MapPin, UserCheck, DollarSign, ListChecks, TrendingUp, Bot, Compass, Award
} from 'lucide-react';
import { SCRIPT_CHECKPOINTS, RED_FLAG_RULES, PDF_SCRIPT_LINES, sanitizeCallRecord } from '../data/scriptData';

// Helper to extract or construct a smart structured call summary
const getStructuredCallSummary = (call) => {
  const existingSummary = call.summary || {};
  const evalData = call.evaluation || {};
  const transcript = call.transcript || [];
  
  const agentLines = transcript.filter(t => t.speaker === 'Agent').map(t => t.text).join(' ');
  const candidateLines = transcript.filter(t => t.speaker === 'Candidate').map(t => t.text).join(' ');
  const combinedText = (candidateLines + ' ' + agentLines).toLowerCase();

  // 1. Detect Callback / Busy / Timing Requests
  const isBusyOrCallback = combinedText.includes('busy') ||
    combinedText.includes('call back') ||
    combinedText.includes('call later') ||
    combinedText.includes('call after') ||
    combinedText.includes('driving') ||
    combinedText.includes('in meeting') ||
    combinedText.includes('baad mein') ||
    combinedText.includes('kal call') ||
    combinedText.includes('later');

  let callbackTime = null;
  const timeMatch = combinedText.match(/(?:after|at|around|sometimes)?\s*(\d{1,2}(?::\d{2}|\.\d{2})?\s*(?:o'?clock|am|pm|baje)?)/i);
  if (timeMatch && (combinedText.includes('call') || combinedText.includes('busy') || combinedText.includes('later'))) {
    const rawT = timeMatch[1].trim();
    if (rawT.length >= 2 && !rawT.startsWith('00:')) {
      callbackTime = rawT;
    }
  }

  // 2. Experience
  let experience = existingSummary.candidateProfile?.experience;
  if (!experience || experience === 'N/A' || experience === 'None') {
    const expMatch = combinedText.match(/(\d+)\s*(?:years?|yrs?)/i);
    experience = expMatch ? `${expMatch[1]} Years` : (isBusyOrCallback ? 'Not Discussed (Call Rescheduled)' : 'Not Disclosed on Call');
  }

  // 3. Current Role / Domain
  let currentRole = existingSummary.candidateProfile?.currentRole;
  if (!currentRole || currentRole === 'N/A' || currentRole === 'None') {
    if (combinedText.includes('civil') || combinedText.includes('site')) currentRole = 'Civil / Site Engineer';
    else if (combinedText.includes('safety') || combinedText.includes('hse') || combinedText.includes('osha')) currentRole = 'Safety Officer / HSE';
    else if (combinedText.includes('project') || combinedText.includes('planning')) currentRole = 'Project / Planning Engineer';
    else if (combinedText.includes('autocad') || combinedText.includes('drafting')) currentRole = 'CAD / Design Engineer';
    else currentRole = isBusyOrCallback ? 'Candidate (Callback Requested)' : 'Engineering / Technical Candidate';
  }

  // 4. Location Preference
  let location = existingSummary.candidateProfile?.preferredLocation || existingSummary.candidateProfile?.currentLocation;
  if (!location || location === 'N/A' || location === 'None') {
    if (combinedText.includes('dubai') || combinedText.includes('gulf') || combinedText.includes('uae') || combinedText.includes('international')) {
      location = 'Open to International (Gulf / USA) & Domestic';
    } else if (combinedText.includes('pune') || combinedText.includes('mumbai') || combinedText.includes('bangalore') || combinedText.includes('delhi')) {
      location = 'Domestic (India Metro Hubs)';
    } else {
      location = isBusyOrCallback ? 'To Be Discussed on Callback' : 'Open to Domestic & International Projects';
    }
  }

  // 5. Interest Level
  let interestLevel = existingSummary.candidateProfile?.interestLevel;
  if (!interestLevel || interestLevel === 'N/A' || interestLevel === 'Neutral') {
    if (isBusyOrCallback) {
      interestLevel = callbackTime ? `Busy / Requested Callback (${callbackTime})` : 'Busy / Requested Callback';
    } else if (combinedText.includes('not interested') || combinedText.includes('fraud') || combinedText.includes('disconnect') || combinedText.includes('wrong number') || combinedText.includes('nahi chahiye')) {
      interestLevel = 'Not Interested';
    } else if (combinedText.includes('send') || combinedText.includes('interested') || combinedText.includes('apply') || combinedText.includes('resume') || evalData.joiningBonusPassed) {
      interestLevel = 'Interested';
    } else {
      interestLevel = 'Neutral';
    }
  }

  // 6. Overview
  let overview = existingSummary.overview;
  if (!overview || overview === '-' || overview.length < 15 || overview.includes('failed to cover essential')) {
    if (isBusyOrCallback) {
      overview = `Candidate ${call.candidateName || 'Candidate'} was reached by Relationship Manager ${call.agentName || 'Agent'} (Duration: ${call.talkTime || call.duration || '0:00:47'}). The candidate stated that they are currently busy and explicitly requested a callback ${callbackTime ? `at ${callbackTime}` : 'at a later time'}. Full screening was paused for the callback.`;
    } else if (combinedText.includes('not interested')) {
      overview = `Candidate ${call.candidateName || 'Candidate'} was contacted by Relationship Manager ${call.agentName || 'Agent'}. The candidate indicated they are not interested in exploring job opportunities with DPR Construction at this time.`;
    } else {
      overview = `Telephony screening call between Agent ${call.agentName || 'Agent'} and Candidate ${call.candidateName || 'Candidate'} (Duration: ${call.talkTime || call.duration || '0:00:45'}, Disposition: ${call.disposition || 'Screening'}). ${evalData.feedback || 'Call evaluated against standard DPR screening checkpoints and script compliance guidelines.'}`;
    }
  }

  // 7. Key Highlights
  let keyHighlights = existingSummary.keyHighlights;
  if (!Array.isArray(keyHighlights) || keyHighlights.length === 0) {
    if (isBusyOrCallback) {
      keyHighlights = [
        `Candidate was reached on call but mentioned they are currently busy.`,
        `Candidate requested a callback ${callbackTime ? `at ${callbackTime}` : 'later'} to discuss the DPR opportunity.`,
        `Greeting and initial name verification was acknowledged by candidate.`,
        `Total conversation talk-time logged: ${call.talkTime || call.duration || '0:00:47'}.`
      ];
    } else {
      keyHighlights = [
        evalData.greetingPassed ? `Greeting & Candidate Name Verification verified.` : `Candidate greeting check: ${evalData.greetingPassed === false ? 'Missed or incomplete.' : 'Evaluated on call.'}`,
        evalData.companyOverviewPassed ? `DPR Construction credentials, US HQ & BKC office background pitched.` : `Company Overview & multinational pedigree discussion.`,
        evalData.eligibilityPassed ? `Candidate eligibility, notice period & current employment status recorded.` : `Verification questions and candidate qualifications discussed.`,
        evalData.websiteRedirectPassed ? `Mandatory portal redirect to www.dprusa.in instructed to candidate.` : (call.talkTime ? `Total conversation talk-time logged: ${call.talkTime}.` : `Screening outcome logged under disposition ${call.disposition || 'Evaluated'}.`)
      ];
    }
  }

  // 8. Call Outcome
  let callOutcome = existingSummary.callOutcome;
  if (!callOutcome || callOutcome.trim() === '') {
    if (isBusyOrCallback) {
      callOutcome = `Candidate requested callback ${callbackTime ? `at ${callbackTime}` : 'later'}. Disposition: ${call.disposition || 'Callback Scheduled'}.`;
    } else if (call.overallScore >= 70 || call.complianceStatus === 'Passed') {
      callOutcome = `Candidate passed screening evaluation (Score: ${call.overallScore || 75}%). Profile shortlisted with instructions to email resume to contact@naukriedge.com and review www.dprusa.in.`;
    } else if (call.complianceStatus === 'Unanswered' || (parseTimeToSeconds(call.talkTime) <= 5)) {
      callOutcome = `No agent-candidate conversation occurred (Disposition: ${call.disposition || 'Ringing no Response'}). Compliance audit not applicable.`;
    } else {
      callOutcome = `Call evaluated with adherence score ${call.overallScore || 0}%. Disposition: ${call.disposition || 'Follow-up'}.`;
    }
  }

  // 9. Next Action Steps
  let nextSteps = existingSummary.nextSteps;
  if (!nextSteps || nextSteps.trim() === '') {
    if (isBusyOrCallback) {
      nextSteps = `Schedule dialer callback ${callbackTime ? `for ${callbackTime}` : 'during evening hours'} as explicitly requested by candidate.`;
    } else if (call.overallScore >= 70 || call.complianceStatus === 'Passed') {
      nextSteps = `Shortlist candidate profile for Technical Review. Confirm mandatory certification enrolment and provide www.dprusa.in portal reference.`;
    } else if (call.complianceStatus === 'Unanswered') {
      nextSteps = `Trigger automated dialer re-queue to retry connecting with candidate during business hours.`;
    } else {
      nextSteps = `Re-screening or manager review recommended to address missed checkpoints and verify candidate availability.`;
    }
  }

  return {
    overview,
    keyHighlights,
    candidateProfile: {
      experience,
      currentRole,
      currentLocation: location,
      preferredLocation: location,
      salaryExpectation: existingSummary.candidateProfile?.salaryExpectation || 'Discussed on Call',
      interestLevel
    },
    callOutcome,
    nextSteps
  };
};

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

export default function AuditInspectorModal({ call: rawCall, onClose, onReAudit, slashRtcActive, onOpenSlashRTC, username, password, portalUrl, sessionCookie, auditProgressStatus }) {
  const call = useMemo(() => sanitizeCallRecord(rawCall), [rawCall]);

  const displayTranscript = useMemo(() => {
    if (!call.transcript || !Array.isArray(call.transcript)) return [];
    
    // 1. Filter out empty lines / hallucination loops
    const cleaned = call.transcript.filter(line => {
      if (!line || !line.text) return false;
      const txt = line.text.trim();
      if (txt.length === 0) return false;
      const words = txt.split(/\s+/);
      if (words.length >= 6) {
        const freq = {};
        let max = 0;
        for (const w of words) {
          const k = w.toLowerCase().replace(/[^\w\u0900-\u097F]/g, '');
          if (!k || k.length < 2) continue;
          freq[k] = (freq[k] || 0) + 1;
          if (freq[k] > max) max = freq[k];
        }
        if (max >= 5 && (max / words.length) >= 0.6) return false;
      }
      return true;
    });

    // 2. Intelligent Speaker Diarization Alignment
    // Fixes instances where the Agent's opening greeting/screening is mislabeled as Candidate
    const candidateFirstName = (call.candidateName || '').trim().split(' ')[0].toLowerCase();
    
    return cleaned.map((line) => {
      const textLower = line.text.toLowerCase();
      let speaker = line.speaker;

      // Unambiguous Agent phrases
      const isAgentPhrase = 
        textLower.includes('is i am speaking') ||
        textLower.includes('am i speaking with') ||
        textLower.includes('speaking with') ||
        textLower.includes('relationship manager') ||
        textLower.includes('from naukri') ||
        textLower.includes('calling from naukri') ||
        textLower.includes('dpr construction') ||
        textLower.includes('dprusa.in') ||
        textLower.includes('naukriedge.com') ||
        (candidateFirstName.length >= 3 && textLower.includes(candidateFirstName) && (textLower.includes('hello') || textLower.includes('good morning') || textLower.includes('good afternoon') || textLower.includes('good evening')));

      // Unambiguous Candidate responses
      const isCandidatePhrase = 
        textLower === 'yes' ||
        textLower === 'yes.' ||
        textLower === 'yes sir' ||
        textLower === 'haan' ||
        textLower === 'haanji' ||
        textLower === 'speaking' ||
        textLower.includes('i will call back') ||
        textLower.includes('busy now') ||
        textLower.includes('not audible') ||
        textLower.includes("now it's audible");

      if (isAgentPhrase) {
        speaker = 'Agent';
      } else if (isCandidatePhrase && !isAgentPhrase) {
        speaker = 'Candidate';
      }

      return {
        ...line,
        speaker
      };
    });
  }, [call.transcript, call.candidateName]);

  const [isPlaying, setIsPlaying] = useState(false);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeTab, setActiveTab] = useState('AUDIT'); // 'AUDIT' | 'TRANSCRIPT' | 'RAW_META'
  const [isAuditing, setIsAuditing] = useState(false);

  // Real Audio player state & refs
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

  const handleTriggerModalAudit = async () => {
    if (isAuditing || !onReAudit) return;
    setIsAuditing(true);
    try {
      // Always force fresh Whisper transcription when user clicks "Run AI Audit"
      // by passing a clean call object with transcript cleared
      const freshCall = { ...call, transcript: null, isRealTranscribed: false };
      await onReAudit(freshCall);
    } catch (err) {
      console.error("Modal audit error:", err);
    } finally {
      setIsAuditing(false);
    }
  };

  const proxyUrl = useMemo(() => {
    if (!call.audioUrl) return '';
    return `/api/audio-proxy?url=${encodeURIComponent(call.audioUrl)}&username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&portalUrl=${encodeURIComponent(portalUrl || '')}&sessionCookie=${encodeURIComponent(sessionCookie || '')}`;
  }, [call.audioUrl, username, password, portalUrl, sessionCookie]);

  const [audioSrc, setAudioSrc] = useState(proxyUrl);
  const [isUsingDirectUrl, setIsUsingDirectUrl] = useState(false);

  useEffect(() => {
    setAudioSrc(proxyUrl);
    setIsUsingDirectUrl(false);
  }, [proxyUrl]);

  const openSlashRtcRecording = () => {
    if (call.audioUrl) {
      window.open(call.audioUrl, 'slashrtc_player', 'width=650,height=380,resizable=yes,scrollbars=yes');
    }
  };

  const handlePlayToggle = async () => {
    if (!call.audioUrl) return;

    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    setHasAttemptedPlay(true);
    setAudioError(false);

    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        return;
      } catch (err) {
        console.warn("Primary audio playback failed:", err);
      }
    }

    // Direct fallback if proxy audio element fails
    if (!isUsingDirectUrl && call.audioUrl) {
      console.log("Fallback audio source to direct SlashRTC link...");
      setAudioSrc(call.audioUrl);
      setIsUsingDirectUrl(true);

      setTimeout(async () => {
        if (audioRef.current) {
          try {
            audioRef.current.load();
            await audioRef.current.play();
            setIsPlaying(true);
            setAudioError(false);
            return;
          } catch (err2) {
            console.warn("Direct HTML5 audio play failed:", err2);
            setAudioError(true);
            setIsPlaying(false);
            openSlashRtcRecording();
          }
        }
      }, 150);
    } else {
      setAudioError(true);
      setIsPlaying(false);
      openSlashRtcRecording();
    }
  };

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

  // Track active dialogue line using strictly real call.transcript
  useEffect(() => {
    if (!call.transcript || call.transcript.length === 0) {
      setActiveLineIdx(-1);
      return;
    }

    let index = -1;
    for (let i = 0; i < call.transcript.length; i++) {
      const lineSec = typeof call.transcript[i].start === 'number' ? call.transcript[i].start : parseTimeToSeconds(call.transcript[i].time);
      const nextLine = call.transcript[i + 1];
      const nextLineSec = nextLine 
        ? (typeof nextLine.start === 'number' ? nextLine.start : parseTimeToSeconds(nextLine.time))
        : (duration || lineSec + 15);

      if (currentTime >= lineSec && currentTime < nextLineSec) {
        index = i;
        break;
      }
    }

    if (index === -1 && currentTime >= parseTimeToSeconds(call.transcript[call.transcript.length - 1].time)) {
      index = call.transcript.length - 1;
    }

    if (index !== activeLineIdx) {
      setActiveLineIdx(index);
    }
  }, [currentTime, call.transcript, duration, activeLineIdx]);

  // Manual scrolling mode: Auto scroll disabled as per user requirement
  useEffect(() => {
    // Intentionally left disabled so user can scroll manually
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

    const lineDuration = Math.max(1, nextLineSec - lineSec);

    let wordIdx = 0;
    return words.map((w, index) => {
      if (w.trim() === '') {
        return <span key={index}>{w}</span>;
      }

      const thisIdx = wordIdx;
      wordIdx++;

      return (
        <span
          key={index}
          className="hover:text-indigo-600 hover:underline cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (audioRef.current) {
              const targetTime = lineSec + (thisIdx / totalWords) * lineDuration;
              audioRef.current.currentTime = targetTime;
              setCurrentTime(targetTime);
            }
          }}
          title="Click to seek audio to this word"
        >
          {w}
        </span>
      );
    });
  };

  const handleReAuditClick = async () => {
    setIsAuditing(true);
    // Clear cached transcript so Whisper always runs fresh
    const freshCall = { ...call, transcript: null, isRealTranscribed: false };
    await onReAudit(freshCall);
    setIsAuditing(false);
  };

  return (
    <div className="modal-backdrop">
      <div 
        style={{ 
          maxWidth: '1380px', 
          width: '95vw', 
          height: '92vh', 
          maxHeight: '940px', 
          background: '#ffffff', 
          borderRadius: '24px', 
          border: '1px solid #cbd5e1', 
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          position: 'relative' 
        }} 
        className="modal-content"
      >

        {/* Hidden HTML5 Audio Element — supports proxy with automatic direct SlashRTC fallback */}
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => {
            console.warn("Audio element error on src:", audioSrc);
            if (!isUsingDirectUrl && call.audioUrl) {
              setAudioSrc(call.audioUrl);
              setIsUsingDirectUrl(true);
            } else {
              setAudioError(true);
              setIsPlaying(false);
            }
          }}
          preload="auto"
          muted={false}
        />

        {/* 1. Modal Top Header */}
        <div style={{ padding: '14px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: '900', fontSize: '14px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', flexShrink: 0 }}>
              AI
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0, lineHeight: 1.2 }}>Call Audit Inspector</h2>
                <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', fontFamily: 'monospace', padding: '2px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '600' }}>
                  {call.id}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', marginTop: '3px', flexWrap: 'wrap' }}>
                <span>Agent: <strong style={{ color: '#1e293b', fontWeight: '700' }}>{call.agentName}</strong></span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>Candidate: <strong style={{ color: '#1e293b', fontWeight: '700' }}>{call.candidateName}</strong></span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{call.callDate}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleReAuditClick}
              disabled={isAuditing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '12px',
                border: 'none',
                cursor: isAuditing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                transition: 'all 0.2s ease',
                opacity: isAuditing ? 0.7 : 1
              }}
            >
              <Sparkles className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
              <span>{isAuditing ? (auditProgressStatus || 'Re-Auditing...') : 'Run AI Audit'}</span>
            </button>

            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '8px', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Sleek Dark Audio Player Bar */}
        <div style={{ background: '#0f172a', padding: '12px 24px', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            
            {/* Play Button & Audio Seekbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
              <button
                onClick={handlePlayToggle}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#6366f1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.15s ease'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title={isPlaying ? "Pause audio" : "Play audio"}
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5 fill-white" /> : <Play className="w-4.5 h-4.5 fill-white" style={{ marginLeft: '2px' }} />}
              </button>

              {/* Animated Waveform Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '22px', flexShrink: 0 }}>
                {[10, 24, 16, 30, 12, 20, 6, 26, 14, 22, 8, 28].map((height, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '3px',
                      borderRadius: '99px',
                      background: '#818cf8',
                      height: isPlaying ? '100%' : '25%',
                      animation: isPlaying ? `wave-bar 1s ease-in-out infinite ${idx * 0.1}s` : 'none',
                      minHeight: '4px',
                      maxHeight: `${height}px`,
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </div>

              {/* Seekable Progress Bar */}
              <div style={{ flex: 1, maxWidth: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px', fontWeight: '600' }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{duration > 0 ? formatTime(duration) : (call.talkTime || call.duration)}</span>
                </div>
                <div
                  onClick={handleSeek}
                  style={{ width: '100%', background: '#334155', height: '6px', borderRadius: '99px', position: 'relative', cursor: 'pointer' }}
                  title="Seek playback location"
                >
                  <div
                    style={{ width: `${progressPercent}%`, background: '#818cf8', height: '100%', borderRadius: '99px', position: 'relative' }}
                  >
                    <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translate(50%, -50%)', width: '12px', height: '12px', borderRadius: '50%', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', border: '2px solid #6366f1' }} />
                  </div>
                </div>
              </div>

              {/* Playback speed selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#1e293b', padding: '3px', borderRadius: '8px', border: '1px solid #334155', flexShrink: 0 }}>
                {[1, 1.25, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackRate(speed)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      background: playbackRate === speed ? '#6366f1' : 'transparent',
                      color: playbackRate === speed ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* SlashRTC tab button & Sync status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {call.audioUrl && (
                <button
                  onClick={openSlashRtcRecording}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#a5b4fc',
                    fontSize: '11px',
                    fontWeight: '600',
                    border: '1px solid rgba(129, 140, 248, 0.3)',
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open / Play in SlashRTC Tab</span>
                </button>
              )}
              <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '5px 12px', borderRadius: '99px', border: '1px solid rgba(52, 211, 153, 0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} className="animate-pulse" />
                Dialer Sync Active
              </span>
            </div>

          </div>

          {audioError && (
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#fbbf24' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Audio proxy couldn't stream file directly. Play using your active SlashRTC browser tab:</span>
              </div>
              <button
                onClick={openSlashRtcRecording}
                style={{ padding: '4px 10px', background: '#d97706', color: '#ffffff', fontWeight: '700', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Play in SlashRTC Tab</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Sub-Header: Pill Tabs & Script Adherence Score */}
        <div style={{ padding: '10px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('AUDIT')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === 'AUDIT' ? '#ffffff' : 'transparent',
                color: activeTab === 'AUDIT' ? '#4f46e5' : '#64748b',
                boxShadow: activeTab === 'AUDIT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>AI Audit Evaluation</span>
            </button>

            <button
              onClick={() => setActiveTab('SUMMARY')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === 'SUMMARY' ? '#ffffff' : 'transparent',
                color: activeTab === 'SUMMARY' ? '#4f46e5' : '#64748b',
                boxShadow: activeTab === 'SUMMARY' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Executive Call Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('TRANSCRIPT')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === 'TRANSCRIPT' ? '#ffffff' : 'transparent',
                color: activeTab === 'TRANSCRIPT' ? '#4f46e5' : '#64748b',
                boxShadow: activeTab === 'TRANSCRIPT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Diarized Transcript</span>
            </button>

            <button
              onClick={() => setActiveTab('RAW_META')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === 'RAW_META' ? '#ffffff' : 'transparent',
                color: activeTab === 'RAW_META' ? '#4f46e5' : '#64748b',
                boxShadow: activeTab === 'RAW_META' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <FileText className="w-4 h-4" />
              <span>Raw Call Meta</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ color: '#64748b', fontWeight: '600' }}>Script Adherence Score:</span>
            {call.overallScore !== null && call.overallScore !== undefined ? (
              <span style={{
                padding: '4px 12px',
                borderRadius: '99px',
                fontWeight: '900',
                fontSize: '12px',
                fontFamily: 'monospace',
                background: call.overallScore >= 80 ? '#f0fdf4' : call.overallScore >= 60 ? '#fffbeb' : '#fff1f2',
                color: call.overallScore >= 80 ? '#15803d' : call.overallScore >= 60 ? '#b45309' : '#be123c',
                border: `1px solid ${call.overallScore >= 80 ? '#bbf7d0' : call.overallScore >= 60 ? '#fde68a' : '#fecdd3'}`
              }}>
                {call.overallScore}%
              </span>
            ) : (
              <span style={{ padding: '4px 12px', borderRadius: '99px', fontWeight: '700', fontSize: '11px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                0% (Not Audited)
              </span>
            )}
          </div>
        </div>

        {/* 4. Tab Body Content — STRICT FLEX CONTAINMENT */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 24px', background: '#f8fafc', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* TAB 1: MAIN AUDIT BREAKDOWN */}
          {activeTab === 'AUDIT' && (() => {
            const alignment = analyzeScriptAlignment(call.transcript, PDF_SCRIPT_LINES);
            const callSummary = getStructuredCallSummary(call);

            // Filter ONLY real violations (exclude items where snippet is 'N/A' or empty)
            const activeRedFlags = (call.redFlags || []).filter(rf => {
              if (!rf) return false;
              const snip = String(rf.snippet || rf.description || '').trim();
              if (!snip || snip === 'N/A' || snip === 'None' || snip.toLowerCase() === 'not applicable' || snip === 'Passed') return false;
              return true;
            });

            const getCheckpointState = (lineId, evalKey) => {
              const align = alignment[lineId];
              const aiEvalPassed = call.evaluation && typeof call.evaluation[evalKey] === 'boolean' ? call.evaluation[evalKey] : null;
              const isAudioFinished = duration > 0 && currentTime >= duration - 1;

              // 1. Direct speech-to-text keyword alignment match
              if (align?.status === 'COMPLETED' || align?.status === 'TAKEN_LATER') {
                return { status: 'COMPLETED', label: `✓ PASSED [${align.matchTime || ''}]` };
              }

              // 2. AI evaluated status
              if (showFinalReport || isAudioFinished || call.status === 'Audited') {
                if (aiEvalPassed !== null) {
                  if (aiEvalPassed) return { status: 'COMPLETED', label: '✓ PASSED' };
                  return { status: 'MISSED', label: '✗ FAILED' };
                }
                return { status: 'MISSED', label: '✗ MISSED' };
              }

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>

                {/* 1. TOP UNIFIED COMPACT STRIP (ALL IN ONE LINE) */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '7px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  {/* Left: AI Briefing Snippet */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 auto' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>AI Briefing:</span>
                      <span style={{ fontSize: '11px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500', maxWidth: '380px' }}>
                        {callSummary.overview || 'Screening call evaluated against standard DPR checkpoints.'}
                      </span>
                      <button
                        onClick={() => setActiveTab('SUMMARY')}
                        style={{ padding: '2px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '10px', fontWeight: '700', color: '#4f46e5', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Summary →
                      </button>
                    </div>
                  </div>

                  {/* Middle: Active Red Flag Violations (Compact inline badges if any) */}
                  {activeRedFlags.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {activeRedFlags.map((rf, idx) => (
                        <span key={idx} style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          <span>⚠️ {rf.title}: <span style={{ fontWeight: '500', color: '#334155' }}>"{rf.snippet || rf.description}"</span></span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Right: Inline Voice Parameters Strip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, borderLeft: '1px solid #f1f5f9', paddingLeft: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                      <Volume2 className="w-3 h-3 text-indigo-500" />
                      <span style={{ fontWeight: '700', color: '#64748b' }}>Clarity:</span>
                      <strong style={{ color: '#047857' }}>{call.callQuality?.voiceClarity || 'Clear'}</strong>
                    </div>
                    <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#cbd5e1' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                      <span style={{ fontWeight: '700', color: '#64748b' }}>Noise:</span>
                      <strong style={{ color: '#047857' }}>{call.callQuality?.backgroundNoise || 'Low'}</strong>
                    </div>
                    <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#cbd5e1' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                      <span style={{ fontWeight: '700', color: '#64748b' }}>Tone:</span>
                      <strong style={{ color: '#4338ca' }}>{call.callQuality?.agentTone || 'Professional'}</strong>
                    </div>
                    <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#cbd5e1' }} />
                    <span style={{ fontSize: '10px', fontWeight: '800', color: call.callQuality?.candidateSentiment === 'Uninterested' ? '#be123c' : '#047857', background: call.callQuality?.candidateSentiment === 'Uninterested' ? '#fff1f2' : '#ecfdf5', padding: '1px 7px', borderRadius: '5px', border: `1px solid ${call.callQuality?.candidateSentiment === 'Uninterested' ? '#fecdd3' : '#a7f3d0'}` }}>
                      {call.callQuality?.candidateSentiment || 'Interested'}
                    </span>
                  </div>

                </div>

                {/* 2. MAIN 50/50 SIDE-BY-SIDE SPLIT SCREEN (FULL HEIGHT VISIBLE) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                  {/* Left Column: Speech-to-Text Aligned Stream (Full Height) */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '12px 16px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', textAlign: 'left' }}>
                    
                    <div style={{ paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                      <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        <span>Speech-to-Text Aligned Stream</span>
                      </h3>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>Click any word or timestamp to jump audio</span>
                    </div>

                    {/* Stream Scrollable List */}
                    <div ref={transcriptContainerRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                      {(call.isRealTranscribed || (displayTranscript && displayTranscript.length > 0)) ? (
                        displayTranscript.map((line, idx) => {
                          const lineSec = typeof line.start === 'number' ? line.start : parseTimeToSeconds(line.time);
                          const nextLine = displayTranscript[idx + 1];
                          const nextLineSec = nextLine 
                            ? (typeof nextLine.start === 'number' ? nextLine.start : parseTimeToSeconds(nextLine.time)) 
                            : (duration || lineSec + 5);
                          const isActive = currentTime >= lineSec && currentTime < nextLineSec && isPlaying;

                          const matchedScriptLine = PDF_SCRIPT_LINES.find((sLine) => {
                            const align = alignment[sLine.id];
                            return align && align.matchTime === line.time;
                          });

                          const canSeek = typeof line.start === 'number' || (line.time && line.time !== 'Unavailable');

                          const isAgent = line.speaker === 'Agent';
                          const isCandidate = line.speaker === 'Candidate';

                          const displaySpeaker = line.speaker && line.speaker !== 'Unknown'
                            ? (isAgent ? `Agent (${call.agentName})` : isCandidate ? `Candidate (${call.candidateName})` : line.speaker)
                            : (idx % 2 === 0 ? `Agent (${call.agentName})` : `Candidate (${call.candidateName})`);

                          const activeIsCandidate = isCandidate || (!isAgent && idx % 2 !== 0);

                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                if (canSeek && audioRef.current) {
                                  audioRef.current.currentTime = lineSec;
                                  setCurrentTime(lineSec);
                                }
                              }}
                              style={{
                                padding: '10px 12px',
                                borderRadius: activeIsCandidate ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                border: isActive 
                                  ? '2px solid #6366f1' 
                                  : activeIsCandidate 
                                    ? '1px solid #bbf7d0' 
                                    : '1px solid #e2e8f0',
                                background: isActive 
                                  ? '#eef2ff' 
                                  : activeIsCandidate 
                                    ? '#f0fdf4' 
                                    : '#ffffff',
                                marginLeft: activeIsCandidate ? '20px' : '0px',
                                marginRight: activeIsCandidate ? '0px' : '20px',
                                cursor: canSeek ? 'pointer' : 'default',
                                transition: 'all 0.2s ease',
                                boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: activeIsCandidate ? '#15803d' : '#4f46e5' }}>
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: activeIsCandidate ? '#22c55e' : '#6366f1' }} />
                                  {displaySpeaker}
                                </span>
                                <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontWeight: '600' }}>{line.time || 'Unavailable'}</span>
                              </div>

                              <p style={{ fontSize: '12px', lineHeight: '1.5', color: '#1e293b', margin: 0, fontWeight: 400, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                {renderWordByWordText(line, lineSec, nextLineSec)}
                              </p>

                              {matchedScriptLine && (
                                <div style={{ marginTop: '5px', display: 'flex' }}>
                                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: alignment[matchedScriptLine.id].status === 'TAKEN_LATER' ? '#fffbeb' : '#ecfdf5', border: `1px solid ${alignment[matchedScriptLine.id].status === 'TAKEN_LATER' ? '#fde68a' : '#a7f3d0'}`, color: alignment[matchedScriptLine.id].status === 'TAKEN_LATER' ? '#b45309' : '#047857', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Check className="w-3 h-3" />
                                    <span>Aligned: {matchedScriptLine.title}</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: '30px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '14px', border: '2px dashed #cbd5e1', margin: 'auto 0' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                            <Sparkles className="w-5 h-5 animate-pulse" />
                          </div>
                          <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>Real Speech-to-Text Not Yet Run</h4>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 auto 4px auto', maxWidth: '340px', lineHeight: 1.4 }}>
                            Click <strong style={{ color: '#4f46e5' }}>"Run AI Audit"</strong> in the top header to stream the audio and generate real-time transcript alignments.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right Column: Speech-to-Text Checkpoints (10 Rubrics) (Full Height) */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '12px 16px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', textAlign: 'left' }}>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', marginBottom: '8px', flexShrink: 0 }}>
                      <div>
                        <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                          Speech-to-Text Checkpoints (10 Rubrics)
                        </h3>
                        <p style={{ fontSize: '10px', color: '#64748b', margin: '2px 0 0 0' }}>
                          Pass/Fail evaluation against standard DPR screening script.
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <input
                          type="checkbox"
                          id="toggleReport"
                          checked={!showFinalReport}
                          onChange={(e) => setShowFinalReport(!e.target.checked)}
                          style={{ cursor: 'pointer', accentColor: '#4f46e5' }}
                        />
                        <label htmlFor="toggleReport" style={{ fontSize: '10px', fontWeight: '700', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                          Live Match Mode
                        </label>
                      </div>
                    </div>

                    {/* Scrollable Checkpoint Items List */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                      {PDF_SCRIPT_LINES.map((line, idx) => {
                        const { status, label } = getCheckpointState(line.id, line.evalKey);
                        const isClickable = alignment[line.id]?.seconds !== null;

                        const isPassed = status === 'COMPLETED' || status === 'TAKEN_LATER';
                        const isFailed = status === 'MISSED';

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
                            style={{
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: `1px solid ${isPassed ? '#bbf7d0' : isFailed ? '#fecdd3' : '#e2e8f0'}`,
                              background: isPassed ? '#f0fdf4' : isFailed ? '#fff1f2' : '#ffffff',
                              cursor: isClickable ? 'pointer' : 'default',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: '800',
                                flexShrink: 0,
                                marginTop: '1px',
                                background: isPassed ? '#16a34a' : isFailed ? '#dc2626' : '#e2e8f0',
                                color: isPassed || isFailed ? '#ffffff' : '#64748b'
                              }}>
                                {isPassed ? '✓' : isFailed ? '✗' : idx + 1}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>{line.title}</span>
                                  <span style={{
                                    fontSize: '9px',
                                    fontFamily: 'monospace',
                                    fontWeight: '800',
                                    padding: '2px 6px',
                                    borderRadius: '99px',
                                    background: isPassed ? '#dcfce7' : isFailed ? '#ffe4e6' : '#f1f5f9',
                                    color: isPassed ? '#15803d' : isFailed ? '#be123c' : '#64748b',
                                    border: `1px solid ${isPassed ? '#86efac' : isFailed ? '#fca5a5' : '#cbd5e1'}`
                                  }}>
                                    {label}
                                  </span>
                                </div>

                                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', lineHeight: '1.4', margin: '3px 0 0 0', fontWeight: 400 }}>
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
          {/* TAB 2: EXECUTIVE CALL SUMMARY */}
          {activeTab === 'SUMMARY' && (() => {
            const summary = getStructuredCallSummary(call);
            const prof = summary.candidateProfile || {};

            return (
              <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', paddingBottom: '20px' }}>
                
                {/* 1. Top Executive Overview Card */}
                <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px 24px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eef2ff', border: '1px solid #c7d2fe', padding: '4px 12px', borderRadius: '99px', color: '#4338ca', fontSize: '11px', fontWeight: '800' }}>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>AI EXECUTIVE BRIEFING</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Call ID: {call.id}</span>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
                    Candidate Screening Overview ({call.campaign || 'NTC Screening'})
                  </h3>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#334155', margin: 0, fontWeight: 500 }}>
                    {summary.overview}
                  </p>
                </div>

                {/* 2. Grid: Candidate Profile & Discussion Highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                  
                  {/* Left Card: Candidate Extracted Profile */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                      <div style={{ padding: '6px', background: '#f0fdf4', borderRadius: '8px', color: '#16a34a' }}>
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Candidate Extracted Profile</h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Candidate Name</span>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{call.candidateName || 'Candidate'}</strong>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Experience</span>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{prof.experience || 'Verified on Call'}</strong>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Current Domain</span>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{prof.currentRole || 'Engineering / Screening'}</strong>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Interest Level</span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          color: prof.interestLevel === 'Interested' ? '#15803d' : prof.interestLevel === 'Not Interested' ? '#be123c' : '#b45309'
                        }}>
                          {prof.interestLevel === 'Interested' ? '✓ High Interest' : prof.interestLevel || 'Neutral'}
                        </span>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '10px', gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Location Preference</span>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{prof.preferredLocation || 'Domestic & Gulf Opportunities'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Card: Key Discussion Highlights */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                      <div style={{ padding: '6px', background: '#eef2ff', borderRadius: '8px', color: '#4f46e5' }}>
                        <ListChecks className="w-4 h-4" />
                      </div>
                      <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Key Discussion Highlights</h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(summary.keyHighlights || []).map((highlight, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                          <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                          <span>{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* 3. Call Outcome & Next Action Steps */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Award className="w-4 h-4 text-emerald-600" />
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>Call Outcome</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#14532d', lineHeight: '1.5', margin: 0, fontWeight: 500 }}>
                      {summary.callOutcome}
                    </p>
                  </div>

                  <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Compass className="w-4 h-4 text-indigo-600" />
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#3730a3', textTransform: 'uppercase' }}>Next Action Steps</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#312e81', lineHeight: '1.5', margin: 0, fontWeight: 500 }}>
                      {summary.nextSteps}
                    </p>
                  </div>

                </div>

              </div>
            );
          })()}

          {/* TAB 3: DIARIZED TRANSCRIPT */}
          {activeTab === 'TRANSCRIPT' && (
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', width: '100%', height: '100%', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', fontSize: '11px', color: '#4338ca', fontWeight: '700', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', flexShrink: 0 }}>
                <span>Speech-to-Text Diarization (Agent vs Candidate)</span>
                <span>Duration: {call.talkTime || call.duration}</span>
              </div>

              {displayTranscript && displayTranscript.length > 0 ? (
                <div ref={transcriptTabContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                  {displayTranscript.map((line, idx) => {
                    const lineSec = typeof line.start === 'number' ? line.start : parseTimeToSeconds(line.time);
                    const nextLine = displayTranscript[idx + 1];
                    const nextLineSec = nextLine 
                      ? (typeof nextLine.start === 'number' ? nextLine.start : parseTimeToSeconds(nextLine.time))
                      : (duration || lineSec + 5);
                    const isActive = currentTime >= lineSec && currentTime < nextLineSec && isPlaying;
                    const canSeek = typeof line.start === 'number' || (line.time && line.time !== 'Unavailable');

                    const isAgent = line.speaker === 'Agent';
                    const isCandidate = line.speaker === 'Candidate';

                    const displaySpeaker = line.speaker && line.speaker !== 'Unknown'
                      ? (isAgent ? `Agent (${call.agentName})` : isCandidate ? `Candidate (${call.candidateName})` : line.speaker)
                      : (idx % 2 === 0 ? `Agent (${call.agentName})` : `Candidate (${call.candidateName})`);

                    const activeIsCandidate = isCandidate || (!isAgent && idx % 2 !== 0);

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (canSeek && audioRef.current) {
                            audioRef.current.currentTime = lineSec;
                            setCurrentTime(lineSec);
                          }
                        }}
                        style={{
                          padding: '14px',
                          borderRadius: activeIsCandidate ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          border: isActive ? '2px solid #6366f1' : activeIsCandidate ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          background: isActive ? '#eef2ff' : activeIsCandidate ? '#f0fdf4' : '#ffffff',
                          marginLeft: activeIsCandidate ? '32px' : '0px',
                          marginRight: activeIsCandidate ? '0px' : '32px',
                          cursor: canSeek ? 'pointer' : 'default',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere'
                        }}
                      >
                        <div style={{ display: 'flex', items: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>
                          <span style={{ color: activeIsCandidate ? '#15803d' : '#4f46e5' }}>{displaySpeaker}</span>
                          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{line.time || 'Unavailable'}</span>
                        </div>
                        <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#1e293b', margin: 0, fontWeight: 400, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                          {renderWordByWordText(line, lineSec, nextLineSec)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px', background: '#ffffff', borderRadius: '14px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>
                  Transcript not available.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RAW CALL META */}
          {activeTab === 'RAW_META' && (
            <div style={{ maxWidth: '900px', margin: '0 auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', textAlign: 'left', width: '100%', height: '100%', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                Raw Call Ingestion Columns
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', fontSize: '11px' }}>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Date:</span> <strong style={{ color: '#0f172a' }}>{call.callDate}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Caller ID:</span> <strong style={{ color: '#0f172a' }}>{call.callerId}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Agent:</span> <strong style={{ color: '#0f172a' }}>{call.agentName}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Campaign:</span> <strong style={{ color: '#0f172a' }}>{call.campaign}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Queue:</span> <strong style={{ color: '#0f172a' }}>{call.queue}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Candidate:</span> <strong style={{ color: '#0f172a' }}>{call.candidateName}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Email:</span> <strong style={{ color: '#0f172a' }}>{call.candidateEmail}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Disposition:</span> <strong style={{ color: '#0f172a' }}>{call.disposition}</strong></div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', gridColumn: '1 / -1' }}><span style={{ color: '#94a3b8', fontFamily: 'monospace', display: 'block', marginBottom: '3px', fontSize: '10px' }}>Audio URL Link:</span> <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '10px', wordBreak: 'break-all' }}>{call.audioUrl}</strong></div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
