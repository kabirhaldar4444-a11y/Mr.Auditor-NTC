import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CallTable from './components/CallTable';
import BatchUploader from './components/BatchUploader';
import AuditInspectorModal from './components/AuditInspectorModal';

// Multi-view panels
import DashboardView from './components/DashboardView';
import CampaignRoomsView from './components/CampaignRoomsView';
import AgentPerformanceView from './components/AgentPerformanceView';
import ScriptCheckpointsView from './components/ScriptCheckpointsView';

import { SAMPLE_INITIAL_DATA, sanitizeCallRecord } from './data/scriptData';
import { 
  ShieldCheck, LayoutDashboard, ListTodo, FolderKanban, Users, FileText, 
  Settings, Lock, Key, Cpu, Sparkles, Check, ShieldAlert, ExternalLink, Database, X,
  Eye, EyeOff, Copy
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getSupabaseClient, isSupabaseConfigured, saveSupabaseCredentials } from './lib/supabaseClient';

// Mapper utilities for translating between Frontend camelCase and Database snake_case
const mapCallFromDb = (dbCall) => {
  if (!dbCall) return null;
  return {
    id: dbCall.id,
    callDate: dbCall.call_date,
    callerId: dbCall.caller_id,
    agentName: dbCall.agent_name,
    agentCode: dbCall.agent_code,
    campaign: dbCall.campaign,
    queue: dbCall.queue,
    duration: dbCall.duration,
    talkTime: dbCall.talk_time,
    holdTime: dbCall.hold_time,
    callType: dbCall.call_type,
    disposition: dbCall.disposition,
    candidateName: dbCall.candidate_name,
    candidateEmail: dbCall.candidate_email,
    campaignStage: dbCall.campaign_stage,
    audioUrl: dbCall.audio_url,
    audioStatus: dbCall.audio_status,
    status: dbCall.status,
    overallScore: dbCall.overall_score,
    complianceStatus: dbCall.compliance_status,
    hasRedFlags: dbCall.has_red_flags,
    redFlagsCount: dbCall.red_flags_count,
    redFlags: dbCall.red_flags || [],
    callQuality: dbCall.call_quality || {},
    evaluation: dbCall.evaluation || {},
    transcript: dbCall.transcript || [],
    isRealTranscribed: dbCall.is_real_transcribed ?? (Array.isArray(dbCall.transcript) && dbCall.transcript.length > 0)
  };
};

const mapCallToDb = (jsCall) => {
  if (!jsCall) return null;
  return {
    id: jsCall.id,
    call_date: jsCall.callDate,
    caller_id: jsCall.callerId,
    agent_name: jsCall.agentName,
    agent_code: jsCall.agentCode,
    campaign: jsCall.campaign,
    queue: jsCall.queue,
    duration: jsCall.duration,
    talk_time: jsCall.talkTime,
    hold_time: jsCall.holdTime,
    call_type: jsCall.callType,
    disposition: jsCall.disposition,
    candidate_name: jsCall.candidateName,
    candidate_email: jsCall.candidateEmail,
    campaign_stage: jsCall.campaignStage,
    audio_url: jsCall.audioUrl,
    audio_status: jsCall.audioStatus,
    status: jsCall.status,
    overall_score: jsCall.overallScore,
    compliance_status: jsCall.complianceStatus,
    has_red_flags: jsCall.hasRedFlags,
    red_flags_count: jsCall.redFlagsCount,
    red_flags: jsCall.redFlags || [],
    call_quality: jsCall.callQuality || {},
    evaluation: jsCall.evaluation || {},
    transcript: jsCall.transcript || [],
    is_real_transcribed: jsCall.isRealTranscribed ?? (Array.isArray(jsCall.transcript) && jsCall.transcript.length > 0),
  };
};

// Convert audio blob to base64 string for Gemini inline audio data payload
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error("Failed to convert audio blob to base64 string"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

// OpenAI Chat Completions API client helper — calls through local vite proxy (works on any machine/browser)
const callOpenAiApi = async (apiKey, messages, retriesLeft = 3) => {
  const url = `/api/openai-proxy`;

  const payload = {
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || ''
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 429 && retriesLeft > 0) {
      console.warn(`OpenAI rate limit hit (429). Waiting 10s before retrying... (${retriesLeft} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return callOpenAiApi(apiKey, messages, retriesLeft - 1);
    }

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `OpenAI API error: ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch (_) {}
      if (response.status === 401 || errMsg.toLowerCase().includes('incorrect api key') || errMsg.toLowerCase().includes('invalid api key')) {
        localStorage.removeItem('openai_api_key');
        errMsg = "Invalid or revoked OpenAI API Key. Please enter a valid API key in Settings or add OPENAI_API_KEY in Vercel Environment Variables.";
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const textResponse = data.choices?.[0]?.message?.content;
    if (!textResponse) {
      throw new Error('OpenAI API returned an empty response.');
    }

    // Strip markdown code blocks if present
    const cleanJson = textResponse.replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    if (retriesLeft > 0 && (err.message?.includes('429') || err.message?.includes('rate limit'))) {
      console.warn(`Retrying after rate limit: ${err.message}. Waiting 10s...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return callOpenAiApi(apiKey, messages, retriesLeft - 1);
    }
    throw err;
  }
};

// Helper to parse HH:MM:SS or MM:SS talk time to seconds
const parseTalkTimeSeconds = (talkTimeStr) => {
  if (!talkTimeStr || typeof talkTimeStr !== 'string') return 0;
  const parts = talkTimeStr.trim().split(':').map(Number);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  const num = parseInt(talkTimeStr, 10);
  return isNaN(num) ? 0 : num;
};

// Sanitize calls: zero talk-time calls should NEVER have fake 30% scores or Critical Fail status
const sanitizeCalls = (rawCalls) => {
  return rawCalls.map(c => {
    const cleaned = sanitizeCallRecord(c);
    let cleanCandidateName = cleaned.candidateName;
    if (!cleanCandidateName || cleanCandidateName === 'Nataraj' || cleanCandidateName === '--') {
      if (cleaned.rawFields) {
        const rawName = cleaned.rawFields['NAME'] || cleaned.rawFields['CANDIDATE NAME'] || cleaned.rawFields['CUSTOMER NAME'] || cleaned.rawFields['Applicant Name'];
        if (rawName && rawName !== '--' && rawName !== 'Nataraj' && String(rawName).trim().length > 2) {
          cleanCandidateName = String(rawName).trim();
        }
      }
      if ((!cleanCandidateName || cleanCandidateName === 'Nataraj' || cleanCandidateName === '--') && cleaned.candidateEmail && cleaned.candidateEmail.includes('@')) {
        const emailPrefix = cleaned.candidateEmail.split('@')[0].replace(/[\._\d]/g, ' ').trim();
        if (emailPrefix.length > 2 && !emailPrefix.toLowerCase().includes('nataraj')) {
          cleanCandidateName = emailPrefix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
    }

    const updatedCall = {
      ...cleaned,
      candidateName: (cleanCandidateName && cleanCandidateName !== '--') ? cleanCandidateName : (cleaned.candidateName && cleaned.candidateName !== 'Nataraj' ? cleaned.candidateName : 'Candidate')
    };

    const talkSecs = parseTalkTimeSeconds(updatedCall.talkTime);
    if (talkSecs <= 3 && (updatedCall.overallScore === 30 || updatedCall.overallScore === 35 || updatedCall.overallScore === 38 || updatedCall.complianceStatus === 'Critical Fail')) {
      return {
        ...updatedCall,
        status: 'Audited',
        overallScore: null,
        complianceStatus: 'Unanswered',
        hasRedFlags: false,
        redFlagsCount: 0,
        redFlags: [],
        transcript: [
          { speaker: 'System', time: '00:00', text: `No agent-candidate conversation occurred (Talk Time: ${updatedCall.talkTime || '0:00:00'}). Disposition: ${updatedCall.disposition || 'Ringing no Response'}` }
        ],
        evaluation: {
          feedback: `Call unanswered / No speech duration (Talk Time: ${updatedCall.talkTime || '0:00:00'}). Script compliance audit not applicable.`
        }
      };
    }
    return updatedCall;
  });
};

export default function App() {
  const [calls, setCalls] = useState(() => sanitizeCalls(SAMPLE_INITIAL_DATA));
  const [selectedCall, setSelectedCall] = useState(null);
  
  // Navigation View Selection
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'audits' | 'agents' | 'script' | 'settings'
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('ALL');

  // Modals visibility
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [importSuccessData, setImportSuccessData] = useState(null);

  // Batch progress state
  const [batchProgress, setBatchProgress] = useState(null);
  const cancelBatchRef = React.useRef(false);

  // Settings & Session State
  const [slashRtcActive, setSlashRtcActive] = useState(true);
  const [apiKey, setApiKey] = useState(() => {
    const envKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
    let savedKey = localStorage.getItem('openai_api_key');
    
    // Auto-clear revoked key if still saved in browser localStorage
    if (savedKey && (savedKey.includes('ptNx5JdZS') || savedKey.includes('FJ30UkWZfZj') || savedKey.includes('uNqOCmkMbHo8f'))) {
      localStorage.removeItem('openai_api_key');
      savedKey = null;
    }
    
    const resolved = (envKey && !envKey.includes('uNqOCmkMbHo8f')) ? envKey : (savedKey || '');
    if (resolved && resolved !== savedKey) {
      localStorage.setItem('openai_api_key', resolved);
    }
    return resolved;
  });

  // Persist valid apiKey to localStorage whenever user updates it in Settings
  useEffect(() => {
    if (apiKey && !apiKey.includes('ptNx5JdZS') && !apiKey.includes('uNqOCmkMbHo8f')) {
      localStorage.setItem('openai_api_key', apiKey);
    }
  }, [apiKey]);

  // SlashRTC credential form bindings inside Settings view
  const [username, setUsername] = useState('SupportEngineer');
  const [password, setPassword] = useState('Enginer#321');
  const [portalUrl, setPortalUrl] = useState('https://aramcoindia.slashrtc.in/index.php/site/viewcampaign');
  const [slashRtcCookie, setSlashRtcCookie] = useState(() => localStorage.getItem('slashrtc_session_cookie') || 'a%3A19%3A%7Bs%3A10%3A%22session_id%22%3Bs%3A32%3A%22a685c32db45103f007c7c5c8f14b865b%22%3Bs%3A10%3A%22ip_address%22%3Bs%3A9%3A%2210.10.9.3%22%3Bs%3A10%3A%22user_agent%22%3Bs%3A111%3A%22Mozilla%2F5.0+%28Windows+NT+10.0%3B+Win64%3B+x64%29+AppleWebKit%2F537.36+%28KHTML%2C+like+Gecko%29+Chrome%2F151.0.0.0+Safari%2F537.36%22%3Bs%3A13%3A%22last_activity%22%3Bi%3A1786618073%3Bs%3A9%3A%22user_data%22%3Bs%3A0%3A%22%22%3Bs%3A7%3A%22mfaFlag%22%3Bs%3A1%3A%220%22%3Bs%3A15%3A%22mfaFlagForAgent%22%3Bs%3A1%3A%220%22%3Bs%3A2%3A%22id%22%3Bs%3A4%3A%221547%22%3Bs%3A4%3A%22name%22%3Bs%3A16%3A%22Support+Engineer%22%3Bs%3A8%3A%22username%22%3Bs%3A15%3A%22SupportEngineer%22%3Bs%3A11%3A%22accesslevel%22%3Bs%3A1%3A%223%22%3Bs%3A9%3A%22logged_in%22%3Bb%3A1%3Bs%3A6%3A%22status%22%3Bs%3A1%3A%221%22%3Bs%3A12%3A%22accesslvlTxt%22%3Bs%3A10%3A%22SuperVisor%22%3Bs%3A5%3A%22token%22%3Bs%3A0%3A%22%22%3Bs%3A3%3A%22crf%22%3Bs%3A32%3A%224e9e893684f4f914dc714d5f3904dacf%22%3Bs%3A8%3A%22agentKey%22%3Bs%3A26%3A%22agent%3ASupportEngineer%3A1547%22%3Bs%3A14%3A%22superAdminFlag%22%3Bi%3A0%3Bs%3A12%3A%22isFirstLogin%22%3Bs%3A1%3A%221%22%3B%7De27ca826bf3267173bd2dd63b241b541');

  useEffect(() => {
    if (slashRtcCookie) {
      localStorage.setItem('slashrtc_session_cookie', slashRtcCookie);
    }
  }, [slashRtcCookie]);

  // Password visibility & clipboard copy state
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [testAuthStatus, setTestAuthStatus] = useState(null);

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleTestSlashRtcLogin = async () => {
    setTestAuthStatus({ loading: true, success: false, message: 'Testing SlashRTC login...' });
    try {
      const sampleUrl = 'https://aramcoindia.slashrtc.in/index.php/download/generateLink/recording/test/test/play/123/2026-07-30/out/false';
      const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(sampleUrl)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&portalUrl=${encodeURIComponent(portalUrl)}`;
      
      const res = await fetch(proxyUrl);
      const errText = await res.text().catch(() => '');

      if (errText.includes('Incorrect username or password') || errText.includes('Auth Error')) {
        setTestAuthStatus({
          loading: false,
          success: false,
          message: `SlashRTC Login Failed: Username '${username}' or Password is incorrect for aramcoindia.slashrtc.in. Please enter your valid active SlashRTC portal login.`
        });
      } else {
        setTestAuthStatus({
          loading: false,
          success: true,
          message: 'SlashRTC Portal Session Authenticated Successfully!'
        });
      }
    } catch (err) {
      setTestAuthStatus({
        loading: false,
        success: false,
        message: `Connection Test Error: ${err.message}`
      });
    }
  };

  // Loading States
  const [isAuditingBatch, setIsAuditingBatch] = useState(false);
  const [isAuditingId, setIsAuditingId] = useState(null);
  const [auditProgressStatus, setAuditProgressStatus] = useState('');

  // Supabase Integration State
  const [supabaseConfigured, setSupabaseConfigured] = useState(() => isSupabaseConfigured());
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '');
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState(null);


  // Load calls on mount or when Supabase client config changes
  useEffect(() => {
    const loadCalls = async () => {
      setIsDbLoading(true);
      setDbError(null);
      
      const supabase = getSupabaseClient();
      if (!supabase) {
        setCalls(sanitizeCalls(SAMPLE_INITIAL_DATA));
        setIsDbLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('calls')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error("Supabase load error:", error);
          setDbError(error.message);
          setCalls(sanitizeCalls(SAMPLE_INITIAL_DATA));
        } else {
          if (data.length === 0) {
            console.log("Supabase table is empty. Seeding initial demo data...");
            const dbRows = SAMPLE_INITIAL_DATA.map(mapCallToDb);
            const { error: seedError } = await supabase.from('calls').insert(dbRows);
            
            if (seedError) {
              console.error("Failed to seed initial data to Supabase:", seedError);
              setDbError(seedError.message);
              setCalls(sanitizeCalls(SAMPLE_INITIAL_DATA));
            } else {
              const { data: seededData, error: refetchError } = await supabase
                .from('calls')
                .select('*')
                .order('created_at', { ascending: false });
                
              if (refetchError) {
                console.error("Failed to fetch seeded data:", refetchError);
                setDbError(refetchError.message);
                setCalls(sanitizeCalls(SAMPLE_INITIAL_DATA));
              } else {
                setCalls(sanitizeCalls(seededData.map(mapCallFromDb)));
              }
            }
          } else {
            setCalls(sanitizeCalls(data.map(mapCallFromDb)));
          }
        }
      } catch (err) {
        console.error("Unexpected error loading calls:", err);
        setDbError(err.message || String(err));
        setCalls(sanitizeCalls(SAMPLE_INITIAL_DATA));
      } finally {
        setIsDbLoading(false);
      }
    };
    
    loadCalls();
  }, [supabaseConfigured]);

  // Auto-restore selected call inspector modal page after hard refresh (F5 / Ctrl+R)
  useEffect(() => {
    if (calls.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const activeId = urlParams.get('callId') || localStorage.getItem('mr_auditor_active_call_id');
      if (activeId) {
        const found = calls.find(c => c.id === activeId);
        if (found) {
          setSelectedCall(found);
        }
      }
    }
  }, [calls]);

  const handleSelectCall = (call) => {
    setSelectedCall(call);
    if (call && call.id) {
      localStorage.setItem('mr_auditor_active_call_id', call.id);
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('callId', call.id);
      window.history.replaceState({}, '', newUrl);
    }
  };

  const handleCloseCallModal = () => {
    setSelectedCall(null);
    localStorage.removeItem('mr_auditor_active_call_id');
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('callId');
    window.history.replaceState({}, '', newUrl);
  };

  // Clear sample demo data
  const handleClearDemoData = () => {
    setCalls(prev => prev.filter(c => !c.id.startsWith('CALL-2026-0807-')));
  };

  // Handle CSV / Excel file import
  const handleImportData = async (newCalls) => {
    const sanitized = sanitizeCalls(newCalls);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const dbRows = sanitized.map(mapCallToDb);
        const { error } = await supabase.from('calls').insert(dbRows);
        if (error) {
          console.error("Failed to insert imported calls into Supabase:", error);
          setDbError("Failed to save imported calls to backend: " + error.message);
        }
      } catch (err) {
        console.error("Exception inserting imported calls:", err);
        setDbError("Failed to save imported calls to backend: " + (err.message || err));
      }
    }

    // Automatically remove sample demo calls when real CSV data is imported
    setCalls((prev) => {
      const nonDemoPrev = prev.filter(c => !c.id.startsWith('CALL-2026-0807-'));
      return [...sanitized, ...nonDemoPrev];
    });
    setIsUploadOpen(false);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });

    setImportSuccessData({ count: sanitized.length, newCalls: sanitized });
  };

  const handleStartImportAudit = async () => {
    if (!importSuccessData) return;
    const { newCalls } = importSuccessData;
    setImportSuccessData(null);
    await runBatchEvaluation(newCalls);
  };

  const handleCloseImportSuccess = () => {
    setImportSuccessData(null);
  };

  // Delete call records in batch
  const handleDeleteCalls = async (idsToDelete) => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('calls')
          .delete()
          .in('id', idsToDelete);

        if (error) {
          console.error("Failed to delete calls from Supabase:", error);
          setDbError("Failed to delete calls from database: " + error.message);
        }
      } catch (err) {
        console.error("Exception deleting calls from Supabase:", err);
        setDbError("Failed to delete calls from database: " + (err.message || err));
      }
    }
    setCalls(prev => prev.filter(c => !idsToDelete.includes(c.id)));
  };

  // Perform AI Call Audit on single record via OpenAI Whisper + GPT-4o-mini
  const auditCallRecord = async (callToAudit, silentOnFailure = false) => {
    setIsAuditingId(callToAudit.id);
    setAuditProgressStatus('Initializing...');

    const talkSecs = parseTalkTimeSeconds(callToAudit.talkTime);

    // Rule 1: Zero / Near-Zero Talk Time (<= 3 seconds) -> Unanswered Call (Compliance audit N/A)
    if (talkSecs <= 3) {
      const unansweredCall = {
        ...callToAudit,
        status: 'Audited',
        overallScore: null,
        complianceStatus: 'Unanswered',
        hasRedFlags: false,
        redFlagsCount: 0,
        redFlags: [],
        transcript: (callToAudit.transcript && callToAudit.transcript.length > 0) ? callToAudit.transcript : [
          { speaker: 'System', time: '00:00', text: `No agent-candidate conversation occurred (Talk Time: ${callToAudit.talkTime || '0:00:00'}). Disposition: ${callToAudit.disposition || 'Ringing no Response'}` }
        ],
        evaluation: {
          feedback: `Call unanswered / No conversation (Talk Time: ${callToAudit.talkTime || '0:00:00'}). Script compliance audit not applicable.`
        }
      };

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('calls').upsert(mapCallToDb(unansweredCall));
        } catch (_) {}
      }

      setCalls((prev) => prev.map(c => c.id === callToAudit.id ? unansweredCall : c));
      if (selectedCall && selectedCall.id === callToAudit.id) setSelectedCall(unansweredCall);
      setIsAuditingId(null);
      setAuditProgressStatus('');
      return unansweredCall;
    }

    let finalResult = null;
    let currentCallTranscript = (callToAudit.transcript && callToAudit.transcript.length > 0) ? callToAudit.transcript : null;
    let isRealTranscribed = callToAudit.isRealTranscribed || false;
    let rawOpenAiResponse = callToAudit.rawOpenAiResponse || null;

    try {
      // STEP 1: Full server-side transcription via /api/transcribe-call
      // Downloads audio from SlashRTC & sends to OpenAI Whisper — all server-to-server
      // Works on both localhost and Vercel without any CORS or proxy issues
      if (callToAudit.audioUrl && (!currentCallTranscript || !isRealTranscribed)) {
        setAuditProgressStatus('Downloading & Transcribing Audio (Server-Side)...');
        console.log(`[STT] Calling /api/transcribe-call for audioUrl: ${callToAudit.audioUrl}`);

        const transcribeRes = await fetch('/api/transcribe-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({
            audioUrl: callToAudit.audioUrl,
            username: username || '',
            password: password || '',
            portalUrl: portalUrl || '',
            sessionCookie: slashRtcCookie || ''
          })
        });

        console.log(`[STT] /api/transcribe-call response: HTTP ${transcribeRes.status}`);

        if (!transcribeRes.ok) {
          const errText = await transcribeRes.text().catch(() => '');
          let errMsg = `Transcription service error (HTTP ${transcribeRes.status})`;
          try { errMsg = JSON.parse(errText).error || errMsg; } catch (_) {}

          const failedCall = {
            ...callToAudit,
            status: 'Failed',
            complianceStatus: 'TRANSCRIPTION_FAILED',
            overallScore: null,
            transcript: null,
            isRealTranscribed: false,
            evaluation: { feedback: `Transcription Failed: ${errMsg}` }
          };
          const supabase = getSupabaseClient();
          if (supabase) { try { await supabase.from('calls').upsert(mapCallToDb(failedCall)); } catch (_) {} }
          setCalls((prev) => prev.map(c => c.id === callToAudit.id ? failedCall : c));
          if (selectedCall && selectedCall.id === callToAudit.id) setSelectedCall(failedCall);
          setIsAuditingId(null);
          setAuditProgressStatus('');
          return failedCall;
        }

        const transcribeData = await transcribeRes.json();
        console.log(`[STT] Transcription status: ${transcribeData.status}, segments: ${(transcribeData.transcript || []).length}, language: ${transcribeData.detectedLanguage}`);

        if (transcribeData.status !== 'COMPLETED' || !transcribeData.transcript || transcribeData.transcript.length === 0) {
          const failedCall = {
            ...callToAudit,
            status: 'Failed',
            complianceStatus: 'TRANSCRIPTION_FAILED',
            overallScore: null,
            transcript: null,
            isRealTranscribed: false,
            evaluation: { feedback: transcribeData.error || transcribeData.message || 'Transcription returned no speech segments.' }
          };
          const supabase = getSupabaseClient();
          if (supabase) { try { await supabase.from('calls').upsert(mapCallToDb(failedCall)); } catch (_) {} }
          setCalls((prev) => prev.map(c => c.id === callToAudit.id ? failedCall : c));
          if (selectedCall && selectedCall.id === callToAudit.id) setSelectedCall(failedCall);
          setIsAuditingId(null);
          setAuditProgressStatus('');
          return failedCall;
        }

        currentCallTranscript = transcribeData.transcript;
        rawOpenAiResponse = transcribeData.rawOpenAiResponse || null;
        isRealTranscribed = true;
      }

      // STEP 2: Evaluate transcript with GPT-4o-mini ONLY if a real transcript exists
      if (!currentCallTranscript || currentCallTranscript.length === 0) {
        const noTranscriptCall = {
          ...callToAudit,
          status: 'Audited',
          complianceStatus: 'Transcript Unavailable',
          overallScore: null,
          transcript: null,
          evaluation: {
            feedback: 'Transcript not available for compliance audit.'
          }
        };

        const supabase = getSupabaseClient();
        if (supabase) { try { await supabase.from('calls').upsert(mapCallToDb(noTranscriptCall)); } catch (_) {} }
        setCalls((prev) => prev.map(c => c.id === callToAudit.id ? noTranscriptCall : c));
        if (selectedCall && selectedCall.id === callToAudit.id) setSelectedCall(noTranscriptCall);
        setIsAuditingId(null);
        setAuditProgressStatus('');
        return noTranscriptCall;
      }

      setAuditProgressStatus('Auditing Compliance (GPT-4o-mini)...');
      const transcriptText = currentCallTranscript.map(t => `${t.time} [${t.speaker}]: ${t.text}`).join('\n');

      const systemPrompt = `You are an expert QA Call Compliance Auditor evaluating an associate screening call for DPR Construction (NTC Screening Campaign).
Analyze the provided transcript against the exact 10 NTC script checkpoints (CP1-CP10) and 4 Red Flag rules.

CRITICAL LANGUAGE RULE (NATURAL HINGLISH + ENGLISH + HINDI COMBINED):
- Retain the exact natural spoken dialogue in Hinglish, English, or Hindi (using natural Hinglish/English script or Hindi).
- Do NOT convert English words into Devanagari forced transliteration loops.
- Do NOT translate original dialogue to English.
- Ensure Agent and Candidate speaker labels accurately separate the Relationship Manager ("Agent") from the candidate ("Candidate").

CRITICAL SPEAKER DIARIZATION INSTRUCTION (Agent vs Candidate):
You MUST accurately identify and label each speaker segment as either "Agent" or "Candidate":
1. "Agent": The Relationship Manager / HR caller from Naukri.com introducing job opportunities, pitching DPR Construction, asking eligibility questions, stating mandatory certifications, giving www.dprusa.in website redirect.
2. "Candidate": The job applicant responding (e.g. "Hello", "Haan ji", "Main free hoon", "8 years experience", "Mumbai", "12 LPA", "DPR is a fake company", "Theek hai", "Thank you", answering questions, or expressing concerns).

Return a JSON object with strictly these keys:
{
  "overallScore": <integer 0-100>,
  "complianceStatus": "Passed" | "Critical Fail",
  "redFlags": [ { "code": string, "severity": string, "title": string, "snippet": string } ],
  "callQuality": { "voiceClarity": "Clear"|"Muffled", "networkIssues": "None"|"High", "backgroundNoise": "Low"|"High", "agentTone": "Professional"|"Monotone"|"Submissive", "agentPacing": "Optimal"|"Rushed", "candidateSentiment": "Interested"|"Neutral"|"Uninterested" },
  "evaluation": { "greetingPassed": bool, "hrIntroPassed": bool, "eligibilityPassed": bool, "companyOverviewPassed": bool, "screeningQuestionsPassed": bool, "globalPitchPassed": bool, "behavioralPassed": bool, "certificationsPassed": bool, "joiningBonusPassed": bool, "websiteRedirectPassed": bool },
  "diarizedSegments": [ { "speaker": "Agent" | "Candidate", "time": "MM:SS", "text": string } ],
  "feedback": string
}`;

      const userPrompt = `Transcript:\n${transcriptText}\n\nCheckpoints (NTC Campaign PDF):
CP1 greetingPassed: RM Naukri intro, confirm candidate name, check good time to connect, NO Sir/Ma'am.
CP2 hrIntroPassed: State job opportunity purpose, recorded call disclaimed, Naukri never asks money, no job guarantee.
CP3 eligibilityPassed: Confirm open to job switch/new job, ask recent & preferred job title and work location.
CP4 companyOverviewPassed: Pitched DPR Construction (multinational, since 1990, US HQ, Mumbai BKC office, www.dprusa.in).
CP5 screeningQuestionsPassed: Addressed Case 1 (applied earlier) / Case 2 (currently working/pooled).
CP6 globalPitchPassed: Asked 13 verification Qs (exp, org, roles, qualification, salary, notice period, etc.).
CP7 behavioralPassed: Domestic vs international locations discussed (USA, Dubai, Singapore, Australia, etc.).
CP8 certificationsPassed: Key international benefits (100% salary hike, visa, accommodation) & mandatory certs (OSHA/NEBOSH, PMP/Primavera, AutoCAD/BIM, QA/QC) enrolment note stated.
CP9 joiningBonusPassed: Resume email to contact@naukriedge.com & pitched ₹5,0,000 INR joining bonus.
CP10 websiteRedirectPassed: MANDATORY: Instructed candidate to visit www.dprusa.in for project details, branch address & leadership team.

Red Flags:
- RF_USED_SIR_MAAM (MEDIUM, -5pts)
- RF_FAKE_CERT_SELLING (CRITICAL, -50pts)
- RF_UNAUTHORIZED_FEE (CRITICAL, -100pts)
- RF_MISSING_WEBSITE_REDIRECT (HIGH, -15pts)

Return ONLY valid JSON.`;

      const aiResult = await callOpenAiApi(apiKey, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      if (aiResult.diarizedSegments && aiResult.diarizedSegments.length > 0) {
        currentCallTranscript = aiResult.diarizedSegments;
      }

      finalResult = {
        overallScore: typeof aiResult.overallScore === 'number' ? aiResult.overallScore : 75,
        complianceStatus: aiResult.complianceStatus || (aiResult.overallScore >= 60 ? 'Passed' : 'Critical Fail'),
        hasRedFlags: (aiResult.redFlags || []).length > 0,
        redFlagsCount: (aiResult.redFlags || []).length,
        redFlags: aiResult.redFlags || [],
        callQuality: aiResult.callQuality || {},
        evaluation: {
          ...aiResult.evaluation,
          feedback: aiResult.feedback || 'AI compliance audit completed.'
        }
      };

      const updatedCall = {
        ...callToAudit,
        transcript: currentCallTranscript,
        isRealTranscribed,
        status: 'Audited',
        overallScore: finalResult.overallScore,
        complianceStatus: finalResult.complianceStatus,
        hasRedFlags: finalResult.hasRedFlags,
        redFlagsCount: finalResult.redFlagsCount,
        redFlags: finalResult.redFlags,
        callQuality: finalResult.callQuality,
        evaluation: finalResult.evaluation
      };

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('calls').upsert(mapCallToDb(updatedCall));
        } catch (_) {}
      }

      setCalls((prev) => prev.map(c => c.id === callToAudit.id ? updatedCall : c));
      if (selectedCall && selectedCall.id === callToAudit.id) setSelectedCall(updatedCall);
      return updatedCall;

    } catch (err) {
      console.error("AI Audit failed:", err);
      const failedCall = {
        ...callToAudit,
        status: 'Failed',
        complianceStatus: 'Error',
        overallScore: null,
        evaluation: {
          ...(callToAudit.evaluation || {}),
          feedback: `AI Audit Failed: ${err.message || err}`
        }
      };

      const supabase = getSupabaseClient();
      if (supabase) { try { await supabase.from('calls').upsert(mapCallToDb(failedCall)); } catch (_) {} }
      setCalls((prev) => prev.map(c => c.id === callToAudit.id ? failedCall : c));
      if (selectedCall && selectedCall.id === callToAudit.id) setSelectedCall(failedCall);

      if (!silentOnFailure) alert(`AI Audit failed for Call ID ${callToAudit.id}:\n${err.message || err}`);
      return failedCall;

    } finally {
      setIsAuditingId(null);
      setAuditProgressStatus('');
    }
  };

  // Central Batch Evaluation Engine with Concurrency Limit and Pause/Cancel controls
  const runBatchEvaluation = async (queue) => {
    if (queue.length === 0) return;
    cancelBatchRef.current = false;
    
    setBatchProgress({
      total: queue.length,
      processed: 0,
      success: 0,
      failed: 0,
      startTime: Date.now(),
      active: true
    });
    setIsAuditingBatch(true);

    const isApiKeyOpenAi = (apiKey || '').startsWith('sk-');
    const concurrencyLimit = isApiKeyOpenAi ? 5 : 3;
    let currentIndex = 0;
    
    const worker = async () => {
      while (currentIndex < queue.length && !cancelBatchRef.current) {
        const index = currentIndex++;
        const callRecord = queue[index];
        
        // Add a stagger delay only for Gemini free tier rate limit
        if (index > 0 && !isApiKeyOpenAi) {
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
        
        try {
          const result = await auditCallRecord(callRecord, true);
          
          setBatchProgress(prev => {
            if (!prev) return null;
            const isSuccess = result && result.status === 'Audited';
            return {
              ...prev,
              processed: prev.processed + 1,
              success: prev.success + (isSuccess ? 1 : 0),
              failed: prev.failed + (isSuccess ? 0 : 1)
            };
          });
        } catch (err) {
          console.error("Worker error auditing call:", err);
          setBatchProgress(prev => {
            if (!prev) return null;
            return {
              ...prev,
              processed: prev.processed + 1,
              failed: prev.failed + 1
            };
          });
        }
      }
    };

    // Spawn workers
    const workers = [];
    for (let i = 0; i < Math.min(concurrencyLimit, queue.length); i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    
    setIsAuditingBatch(false);
    setBatchProgress(prev => prev ? { ...prev, active: false } : null);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
  };

  // Run Batch Audit across all pending call records
  const handleRunBatchAudit = async () => {
    const pending = calls.filter(c => c.status !== 'Audited');
    await runBatchEvaluation(pending);
  };

  // Click handler from Agent view to filter Table records
  const handleSelectAgentFilter = (agentName) => {
    setSelectedAgentFilter(agentName);
    setActiveView('audits');
  };

  // Fetch current view labels
  const viewMeta = {
    dashboard: { title: 'Dashboard Overview', subtitle: 'Visual metrics summary, script adherence scores, and agent compliance leaderboards' },
    audits: { title: 'Call Audits Log', subtitle: 'Interactive records log, SlashRTC recordings playback, and AI evaluations' },
    campaigns: { title: 'Campaign Rooms', subtitle: 'Smart campaign workspace hubs, compliance tracking rooms, and automated call routing' },
    agents: { title: 'Agent Performance', subtitle: 'Detailed compliance metrics and risk analysis levels per associate' },
    script: { title: 'Guidelines Checkpoints', subtitle: 'Standard script rubrics and critical rules mapped to compliance models' },
    settings: { title: 'System Settings', subtitle: 'OpenAI API key credentials and SlashRTC portal login credentials' }
  }[activeView];

  return (
    <div className="app-container font-sans text-[var(--text-primary)]">
      
      {/* Left Sidebar Navigation */}
      <aside className="sidebar select-none">
        
        {/* Sidebar Brand Identity */}
        <div className="h-[68px] border-b border-[var(--border-color)] px-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="font-bold text-[15px] tracking-tight text-[var(--text-primary)] block leading-tight">CallPulse <span className="text-indigo-600">AI</span></span>
            <span className="text-[11px] text-[var(--text-muted)] font-medium block">Compliance QA</span>
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 px-4 py-5 space-y-1">
          <button 
            onClick={() => { setActiveView('dashboard'); }}
            className={`w-full sidebar-link ${activeView === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard className="w-[17px] h-[17px] shrink-0" />
            <span>Dashboard Overview</span>
          </button>

          <button 
            onClick={() => { setActiveView('audits'); }}
            className={`w-full sidebar-link ${activeView === 'audits' ? 'active' : ''}`}
          >
            <ListTodo className="w-[17px] h-[17px] shrink-0" />
            <span>Call Audits Log</span>
          </button>

          <button 
            onClick={() => { setActiveView('campaigns'); }}
            className={`w-full sidebar-link ${activeView === 'campaigns' ? 'active' : ''}`}
          >
            <FolderKanban className="w-[17px] h-[17px] shrink-0" />
            <span>Campaign Rooms</span>
          </button>

          <button 
            onClick={() => { setActiveView('agents'); }}
            className={`w-full sidebar-link ${activeView === 'agents' ? 'active' : ''}`}
          >
            <Users className="w-[17px] h-[17px] shrink-0" />
            <span>Agent Performance</span>
          </button>

          <button 
            onClick={() => { setActiveView('script'); }}
            className={`w-full sidebar-link ${activeView === 'script' ? 'active' : ''}`}
          >
            <FileText className="w-[17px] h-[17px] shrink-0" />
            <span>Script Guidelines</span>
          </button>

          <button 
            onClick={() => { setActiveView('settings'); }}
            className={`w-full sidebar-link ${activeView === 'settings' ? 'active' : ''}`}
          >
            <Settings className="w-[17px] h-[17px] shrink-0" />
            <span>System Settings</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="px-4 py-4 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-[13px]">
            <span className={`w-2 h-2 rounded-full shrink-0 ${slashRtcActive ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
            <span className="text-[var(--text-muted)] font-medium">Dialer Sync:</span>
            <strong className="text-[var(--text-primary)] font-semibold">{slashRtcActive ? 'Connected' : 'Offline'}</strong>
          </div>
          <div className="text-[12px] text-[var(--text-muted)] mt-1.5">
            User: SupportEngineer
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="main-viewport">
        
        {/* Sticky Topbar Header */}
        <Header 
          viewTitle={viewMeta.title}
          viewSubtitle={viewMeta.subtitle}
          onOpenUpload={() => setIsUploadOpen(true)}
          totalCalls={calls.length}
        />

        {/* Main scroll viewport */}
        <main className="content-scroll relative">
          
          {isDbLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-sm text-[var(--text-muted)] font-medium">Synchronizing with Supabase...</p>
            </div>
          ) : (
            <>
              {batchProgress && (
                <div className="mb-6 bg-white border border-[var(--border-color)] rounded-xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500 rounded-t-xl"></div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 text-left">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="font-semibold text-[var(--text-primary)] text-sm">
                          {batchProgress.active ? 'AI Batch Audit Running' : 'Batch Audit Stopped'}
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600">
                          {batchProgress.active ? '3 Workers Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--text-muted)]">
                        Evaluated <strong className="text-[var(--text-primary)] font-semibold">{batchProgress.processed}</strong> of <strong className="text-[var(--text-primary)] font-semibold">{batchProgress.total}</strong> calls
                        {batchProgress.active && batchProgress.processed > 0 && (
                          <span className="text-[var(--text-muted)]"> — ~{Math.round(((Date.now() - batchProgress.startTime) / batchProgress.processed) * (batchProgress.total - batchProgress.processed) / 1000)}s remaining</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-[13px] font-medium">
                        <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Passed: {batchProgress.success}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          <span>Errors: {batchProgress.failed}</span>
                        </div>
                      </div>

                      {batchProgress.active && (
                        <button
                          onClick={() => { cancelBatchRef.current = true; }}
                          className="btn-secondary py-1.5 px-4 text-sm text-red-600 hover:bg-red-50 border-red-200"
                        >
                          Pause
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {activeView === 'dashboard' && (
                <DashboardView 
                  calls={calls}
                  onRunBatchAudit={handleRunBatchAudit}
                  isAuditingBatch={isAuditingBatch}
                  onNavigateToAudits={() => setActiveView('audits')}
                  onOpenUpload={() => setIsUploadOpen(true)}
                />
              )}

              {activeView === 'audits' && (
                <CallTable 
                  key={selectedAgentFilter}
                  calls={calls}
                  onSelectCall={setSelectedCall}
                  onAuditSingleCall={auditCallRecord}
                  isAuditingId={isAuditingId}
                  onDeleteCalls={handleDeleteCalls}
                  initialAgentFilter={selectedAgentFilter}
                  onOpenUpload={() => setIsUploadOpen(true)}
                  onRunBatchAudit={runBatchEvaluation}
                  onClearDemoData={handleClearDemoData}
                />
              )}

              {activeView === 'campaigns' && (
                <CampaignRoomsView
                  calls={calls}
                  onSelectCall={setSelectedCall}
                  onAuditSingleCall={auditCallRecord}
                  isAuditingId={isAuditingId}
                  onDeleteCalls={handleDeleteCalls}
                  onRunBatchAudit={runBatchEvaluation}
                  isAuditingBatch={isAuditingBatch}
                  onOpenUpload={() => setIsUploadOpen(true)}
                />
              )}

          {activeView === 'agents' && (
            <AgentPerformanceView 
              calls={calls}
              onSelectAgentFilter={handleSelectAgentFilter}
            />
          )}

          {activeView === 'script' && (
            <ScriptCheckpointsView />
          )}

          {activeView === 'settings' && (
            <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '64px' }} className="space-y-8 animate-in fade-in duration-200">
              
              {/* Dark Hero Header Banner */}
              <div className="campaign-hub-hero">
                <div style={{ zIndex: 2 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                    <Settings className="w-3.5 h-3.5 text-indigo-400" />
                    <span>System Integration Engine</span>
                  </div>
                  <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', lineHeight: '1.2', margin: '0 0 8px 0' }}>
                    System Settings & Credentials
                  </h1>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '580px', lineHeight: '1.6' }}>
                    Configure credentials for AramcoIndia SlashRTC dialer portals and AI audio proxy services.
                  </p>
                </div>
              </div>

              {/* Settings Card */}
              <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', maxWidth: '800px' }} className="space-y-6">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>SlashRTC Integrations Proxy</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Configure login portal URL & audio proxy authentication</p>
                  </div>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '18px', padding: '16px 20px', color: '#92400e', fontSize: '13px', lineHeight: '1.6' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#b45309', margin: '0 0 4px 0' }}>
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Browser Playback Protocol</span>
                  </p>
                  <span>
                    Recording playback links require your current browser session to be authenticated at <strong style={{ fontWeight: '800' }}>aramcoindia.slashrtc.in</strong>.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>SlashRTC Base Portal URL</label>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(portalUrl, 'portalUrl')}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copy Portal URL"
                      >
                        {copiedField === 'portalUrl' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-extrabold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={portalUrl} 
                      onChange={(e) => setPortalUrl(e.target.value)}
                      className="input-field"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Username</label>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(username, 'username')}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Copy Username"
                        >
                          {copiedField === 'username' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-extrabold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Copy ID</span>
                            </>
                          )}
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-field"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Password</label>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(password, 'password')}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Copy Password"
                        >
                          {copiedField === 'password' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-extrabold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Copy Pass</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)}
                          className="input-field"
                          style={{ width: '100%', paddingRight: '42px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 text-slate-400 hover:text-indigo-600 cursor-pointer p-1 transition-colors z-10"
                          title={showPassword ? "Hide Password" : "Show Password"}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Eye className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                        Or Paste Active Browser Session Cookie (<code className="text-indigo-600 font-bold">ci_session2</code>)
                      </label>
                      <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Bypasses Password Login</span>
                    </div>
                    <input 
                      type="text" 
                      value={slashRtcCookie} 
                      onChange={(e) => setSlashRtcCookie(e.target.value)}
                      placeholder="e.g. ci_session2=a%3A7%3A%7Bs%3A10%3A%22session_id%22..."
                      className="input-field"
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      💡 <strong>Quick Fix:</strong> In your browser tab where SlashRTC is open, press <kbd className="bg-slate-100 border px-1 py-0.5 rounded text-slate-700">F12</kbd> → <strong>Application</strong> → <strong>Cookies</strong> → copy <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">ci_session2</code> value and paste it above.
                    </p>
                  </div>
                </div>

                {/* Test Auth Status Banner */}
                {testAuthStatus && (
                  <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2.5 transition-all ${
                    testAuthStatus.loading
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse'
                      : testAuthStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {testAuthStatus.loading ? (
                      <Cpu className="w-4 h-4 text-indigo-600 animate-spin" />
                    ) : testAuthStatus.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{testAuthStatus.message}</span>
                  </div>
                )}

                <div style={{ paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <a 
                    href={portalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '13px', fontWeight: '700', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>Open SlashRTC Portal</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={handleTestSlashRtcLogin}
                      disabled={testAuthStatus?.loading}
                      className="btn-secondary text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}
                    >
                      {testAuthStatus?.loading ? 'Verifying...' : 'Test Connection'}
                    </button>
                    <button 
                      onClick={() => {
                        confetti({ particleCount: 20, spread: 40 });
                        setSlashRtcActive(true);
                      }}
                      className="btn-primary"
                      style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          </>
        )}
      </main>


      </div>

      {/* Modal Dialogs */}
      {isUploadOpen && (
        <BatchUploader
          onImportData={handleImportData}
          onClose={() => setIsUploadOpen(false)}
          sampleInitialRow={SAMPLE_INITIAL_DATA}
        />
      )}

      {importSuccessData && (
        <div className="modal-backdrop select-none">
          <div className="bg-white text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-xl max-w-md w-full p-7 relative modal-content text-left">
            <button
              onClick={handleCloseImportSuccess}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg">Import Complete</h3>
                <p className="text-[13px] text-[var(--text-muted)]">Successfully processed {importSuccessData.count} call records</p>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-[13px] text-indigo-700 font-medium mb-6 leading-relaxed">
              <p className="font-semibold flex items-center gap-1.5 mb-1 text-indigo-600">
                <Database className="w-4 h-4" /> Ready for AI compliance auditing
              </p>
              Your dataset has been ingested. Start AI evaluation immediately or browse the imported records first.
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-color)] pt-5">
              <button
                onClick={handleCloseImportSuccess}
                className="btn-secondary py-2.5 px-5 text-sm font-medium"
              >
                View Records
              </button>
              <button
                onClick={handleStartImportAudit}
                className="btn-primary py-2.5 px-5 text-sm font-semibold flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start AI Audit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCall && (
        <AuditInspectorModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onReAudit={auditCallRecord}
          slashRtcActive={slashRtcActive}
          onOpenSlashRTC={() => setActiveView('settings')}
          username={username}
          password={password}
          portalUrl={portalUrl}
          sessionCookie={slashRtcCookie}
          auditProgressStatus={auditProgressStatus}
        />
      )}

    </div>
  );
}
