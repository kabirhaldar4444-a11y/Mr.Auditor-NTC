import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CallTable from './components/CallTable';
import BatchUploader from './components/BatchUploader';
import AuditInspectorModal from './components/AuditInspectorModal';

// Multi-view panels
import DashboardView from './components/DashboardView';
import AgentPerformanceView from './components/AgentPerformanceView';
import ScriptCheckpointsView from './components/ScriptCheckpointsView';

import { SAMPLE_INITIAL_DATA } from './data/scriptData';
import { 
  ShieldCheck, LayoutDashboard, ListTodo, Users, FileText, 
  Settings, Lock, Key, Cpu, Sparkles, Check, ShieldAlert, ExternalLink, Database, X
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
    isRealTranscribed: dbCall.is_real_transcribed
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

export default function App() {
  const [calls, setCalls] = useState(SAMPLE_INITIAL_DATA);
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
    // Priority: Vite build-time env (from Vercel/local .env) → localStorage (saved from Settings)
    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    const savedKey = localStorage.getItem('openai_api_key');
    const resolved = envKey || savedKey || '';
    if (resolved && resolved !== savedKey) {
      localStorage.setItem('openai_api_key', resolved);
    }
    return resolved;
  });

  // Persist apiKey to localStorage whenever user updates it in Settings
  useEffect(() => {
    if (apiKey) localStorage.setItem('openai_api_key', apiKey);
  }, [apiKey]);

  // SlashRTC credential form bindings inside Settings view
  const [username, setUsername] = useState('SupportEngineer');
  const [password, setPassword] = useState('Enginer#321');
  const [portalUrl, setPortalUrl] = useState('https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1');

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
        setCalls(SAMPLE_INITIAL_DATA);
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
          setCalls([]);
        } else {
          if (data.length === 0) {
            console.log("Supabase table is empty. Seeding initial demo data...");
            const dbRows = SAMPLE_INITIAL_DATA.map(mapCallToDb);
            const { error: seedError } = await supabase.from('calls').insert(dbRows);
            
            if (seedError) {
              console.error("Failed to seed initial data to Supabase:", seedError);
              setDbError(seedError.message);
              setCalls([]);
            } else {
              // Re-fetch seeded data
              const { data: seededData, error: refetchError } = await supabase
                .from('calls')
                .select('*')
                .order('created_at', { ascending: false });
                
              if (refetchError) {
                console.error("Failed to fetch seeded data:", refetchError);
                setDbError(refetchError.message);
                setCalls([]);
              } else {
                setCalls(seededData.map(mapCallFromDb));
              }
            }
          } else {
            setCalls(data.map(mapCallFromDb));
          }
        }
      } catch (err) {
        console.error("Unexpected error loading calls:", err);
        setDbError(err.message || String(err));
        setCalls([]);
      } finally {
        setIsDbLoading(false);
      }
    };
    
    loadCalls();
  }, [supabaseConfigured]);

  // Handle CSV / Excel file import
  const handleImportData = async (newCalls) => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const dbRows = newCalls.map(mapCallToDb);
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

    setCalls((prev) => [...newCalls, ...prev]);
    setIsUploadOpen(false);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });

    // Open the custom import success modal instead of alert/auto auditing
    setImportSuccessData({ count: newCalls.length, newCalls });
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

    let finalResult = null;
    let currentCallTranscript = callToAudit.transcript || [];
    let isRealTranscribed = callToAudit.isRealTranscribed;

    try {
      if (!apiKey) {
        throw new Error('Missing OpenAI API Key. Please configure your key in Settings.');
      }

      // STEP 1: If audio URL exists and not yet transcribed — use OpenAI Whisper to transcribe
      if (callToAudit.audioUrl && !isRealTranscribed) {
        setAuditProgressStatus('Fetching audio...');
        const audioProxyUrl = `/api/audio-proxy?url=${encodeURIComponent(callToAudit.audioUrl)}&username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&portalUrl=${encodeURIComponent(portalUrl || '')}`;
        const audioBlob = await fetch(audioProxyUrl).then(res => {
          if (!res.ok) throw new Error(`Audio fetch failed from SlashRTC portal. Ensure you are logged in.`);
          return res.blob();
        });

        // If audio is empty or too small, skip to transcript-only audit
        if (audioBlob.size < 1000) {
          console.warn('Audio blob too small — likely an auth redirect or empty response. Skipping Whisper.');
        } else {
          setAuditProgressStatus('Transcribing Audio (Whisper)...');

          // ── Magic-bytes detection ──────────────────────────────────────────
          // Read first 12 bytes to identify real file format, ignoring MIME type
          // (SlashRTC generateLink may return audio/x-wav, octet-stream, etc.)
          const headerBuffer = await audioBlob.slice(0, 12).arrayBuffer();
          const hdr = new Uint8Array(headerBuffer);

          // Detect HTML page returned instead of audio (auth failure)
          const isHtml = (hdr[0] === 0x3C); // '<' — starts with <html or <!DOCTYPE
          if (isHtml) {
            throw new Error('SlashRTC returned an HTML page instead of audio. Session may have expired — please ensure you are logged into the SlashRTC portal.');
          }

          let detectedExt = 'wav'; // safe default
          let detectedMime = 'audio/wav';

          // WAV: RIFF....WAVE
          if (hdr[0]===0x52 && hdr[1]===0x49 && hdr[2]===0x46 && hdr[3]===0x46) {
            detectedExt = 'wav'; detectedMime = 'audio/wav';
          }
          // MP3 with ID3v2 tag
          else if (hdr[0]===0x49 && hdr[1]===0x44 && hdr[2]===0x33) {
            detectedExt = 'mp3'; detectedMime = 'audio/mpeg';
          }
          // MP3 sync word (0xFF 0xEX)
          else if (hdr[0]===0xFF && (hdr[1] & 0xE0)===0xE0) {
            detectedExt = 'mp3'; detectedMime = 'audio/mpeg';
          }
          // OGG: OggS
          else if (hdr[0]===0x4F && hdr[1]===0x67 && hdr[2]===0x67 && hdr[3]===0x53) {
            detectedExt = 'ogg'; detectedMime = 'audio/ogg';
          }
          // FLAC: fLaC
          else if (hdr[0]===0x66 && hdr[1]===0x4C && hdr[2]===0x61 && hdr[3]===0x43) {
            detectedExt = 'flac'; detectedMime = 'audio/flac';
          }
          // MP4 / M4A: ftyp box at offset 4
          else if (hdr[4]===0x66 && hdr[5]===0x74 && hdr[6]===0x79 && hdr[7]===0x70) {
            detectedExt = 'mp4'; detectedMime = 'audio/mp4';
          }
          // WebM: EBML header
          else if (hdr[0]===0x1A && hdr[1]===0x45 && hdr[2]===0xDF && hdr[3]===0xA3) {
            detectedExt = 'webm'; detectedMime = 'audio/webm';
          }

          console.log(`SlashRTC audio — size: ${audioBlob.size} bytes, MIME: ${audioBlob.type}, detected: ${detectedExt}`);

          // Recreate blob with correct MIME so FormData sets the right content-type
          const audioFile = new File([audioBlob], `audio.${detectedExt}`, { type: detectedMime });

          // Build multipart/form-data for OpenAI Whisper
          const formData = new FormData();
          formData.append('file', audioFile, `audio.${detectedExt}`);
          formData.append('model', 'whisper-1');
          formData.append('language', 'hi'); // Hindi / Hinglish
          formData.append('response_format', 'verbose_json');
          formData.append('timestamp_granularities[]', 'segment');

          const whisperRes = await fetch('/api/openai-whisper-proxy', {
            method: 'POST',
            headers: { 'x-api-key': apiKey },
            body: formData
          });

          if (!whisperRes.ok) {
            const errText = await whisperRes.text();
            let msg = `Whisper transcription failed (${whisperRes.status})`;
            try { msg = JSON.parse(errText).error?.message || msg; } catch (_) {}
            throw new Error(msg);
          }

          const whisperData = await whisperRes.json();
          const rawTranscript = whisperData.text || '';
          // Build simple diarized segments from Whisper timestamps
          const segments = (whisperData.segments || []).map(s => ({
            speaker: 'Agent',
            time: new Date(s.start * 1000).toISOString().substr(14, 5),
            text: s.text.trim()
          }));
          currentCallTranscript = segments.length > 0
            ? segments
            : [{ speaker: 'Agent', time: '00:00', text: rawTranscript }];
          isRealTranscribed = true;

          setAuditProgressStatus('Auditing Compliance (GPT-4o-mini)...');

          const systemPrompt = `You are a Senior QA Compliance Auditor. Evaluate the call transcript and return a JSON object with exactly these keys:
{
  "overallScore": <integer 0-100>,
  "complianceStatus": "Passed" | "Critical Fail",
  "redFlags": [ { "code": string, "severity": string, "title": string, "snippet": string } ],
  "callQuality": { "voiceClarity": string, "networkIssues": string, "backgroundNoise": string, "agentTone": string, "agentPacing": string, "candidateSentiment": string },
  "evaluation": { "greetingPassed": bool, "hrIntroPassed": bool, "eligibilityPassed": bool, "companyOverviewPassed": bool, "screeningQuestionsPassed": bool, "globalPitchPassed": bool, "behavioralPassed": bool, "certificationsPassed": bool, "joiningBonusPassed": bool, "websiteRedirectPassed": bool },
  "diarizedSegments": [ { "speaker": "Agent" | "Candidate", "time": "MM:SS", "text": string } ],
  "feedback": string
}`;

          const userPrompt = `Transcript:\n${rawTranscript}\n\nScript Checkpoints to evaluate (true/false):
CP1 greetingPassed: Introduced as RM from Naukri.com, confirmed candidate name, asked if good time, no Sir/Ma'am.
CP2 hrIntroPassed: Job opportunity stated, call recorded disclosed, Naukri never asks for money, no job guarantee.
CP3 eligibilityPassed: Asked if open to job switch, asked current/last job title.
CP4 companyOverviewPassed: Pitched DPR Construction, mentioned offices (BKC/Dubai/Tokyo/Australia), www.dprusa.in.
CP5 screeningQuestionsPassed: Addressed applied/not-applied cases (re-apply without cost / future assignments).
CP6 globalPitchPassed: Asked verification Qs — experience, current org, roles, qualification, salary, joining.
CP7 behavioralPassed: Mentioned domestic (Mumbai/Pune/Delhi) or international (Dubai/Tokyo/Paris) locations.
CP8 certificationsPassed: Stated benefits (EPF/ESIC/insurance) and mandatory certs (PMP/AutoCAD/Primavera).
CP9 joiningBonusPassed: Mentioned resume upload, 10% joining bonus within 30 days.
CP10 websiteRedirectPassed: Directed candidate to visit www.dprusa.in.

Red Flags:
- RF_USED_SIR_MAAM (MEDIUM, -5pts): agent used Sir/Ma'am.
- RF_FAKE_CERT_SELLING (CRITICAL, -50pts): agent suggested buying certs without study.
- RF_UNAUTHORIZED_FEE (CRITICAL, -100pts): agent asked for money/deposit.
- RF_MISSING_WEBSITE_REDIRECT (HIGH, -15pts): failed to mention www.dprusa.in.

For callQuality, infer from transcript content. For diarizedSegments, try to split Agent vs Candidate turns. Return ONLY valid JSON.`;

          const aiResult = await callOpenAiApi(apiKey, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]);

          // Override transcript with diarized version if AI provided it
          if (aiResult.diarizedSegments && aiResult.diarizedSegments.length > 0) {
            currentCallTranscript = aiResult.diarizedSegments;
          }

          finalResult = {
            overallScore: aiResult.overallScore,
            complianceStatus: aiResult.complianceStatus,
            hasRedFlags: (aiResult.redFlags || []).length > 0,
            redFlagsCount: (aiResult.redFlags || []).length,
            redFlags: aiResult.redFlags || [],
            callQuality: aiResult.callQuality,
            evaluation: {
              ...aiResult.evaluation,
              feedback: aiResult.feedback || 'OpenAI Whisper + GPT-4o-mini audio evaluation completed.'
            }
          };
        } // end else (audio blob valid)
      }

      // STEP 2: If transcript already exists (no audio), evaluate with GPT-4o-mini only
      if (!finalResult) {
        setAuditProgressStatus('Auditing Compliance (GPT-4o-mini)...');
        const transcriptText = currentCallTranscript
          ? currentCallTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n')
          : '';

        const systemPrompt = `You are a Senior QA Compliance Auditor. Evaluate the call transcript and return a JSON object with exactly these keys:
{
  "overallScore": <integer 0-100>,
  "complianceStatus": "Passed" | "Critical Fail",
  "redFlags": [ { "code": string, "severity": string, "title": string, "snippet": string } ],
  "callQuality": { "voiceClarity": string, "networkIssues": string, "backgroundNoise": string, "agentTone": string, "agentPacing": string, "candidateSentiment": string },
  "evaluation": { "greetingPassed": bool, "hrIntroPassed": bool, "eligibilityPassed": bool, "companyOverviewPassed": bool, "screeningQuestionsPassed": bool, "globalPitchPassed": bool, "behavioralPassed": bool, "certificationsPassed": bool, "joiningBonusPassed": bool, "websiteRedirectPassed": bool },
  "feedback": string
}`;

        const userPrompt = `Transcript:\n${transcriptText}\n\nScript Checkpoints to evaluate (true/false):
CP1 greetingPassed: Introduced as RM from Naukri.com, confirmed candidate name, asked if good time, no Sir/Ma'am.
CP2 hrIntroPassed: Job opportunity stated, call recorded disclosed, Naukri never asks for money, no job guarantee.
CP3 eligibilityPassed: Asked if open to job switch, asked current/last job title.
CP4 companyOverviewPassed: Pitched DPR Construction, mentioned offices (BKC/Dubai/Tokyo/Australia), www.dprusa.in.
CP5 screeningQuestionsPassed: Addressed applied/not-applied cases (re-apply without cost / future assignments).
CP6 globalPitchPassed: Asked verification Qs — experience, current org, roles, qualification, salary, joining.
CP7 behavioralPassed: Mentioned domestic (Mumbai/Pune/Delhi) or international (Dubai/Tokyo/Paris) locations.
CP8 certificationsPassed: Stated benefits (EPF/ESIC/insurance) and mandatory certs (PMP/AutoCAD/Primavera).
CP9 joiningBonusPassed: Mentioned resume upload, 10% joining bonus within 30 days.
CP10 websiteRedirectPassed: Directed candidate to visit www.dprusa.in.

Red Flags:
- RF_USED_SIR_MAAM (MEDIUM, -5pts): agent used Sir/Ma'am.
- RF_FAKE_CERT_SELLING (CRITICAL, -50pts): agent suggested buying certs without study.
- RF_UNAUTHORIZED_FEE (CRITICAL, -100pts): agent asked for money/deposit.
- RF_MISSING_WEBSITE_REDIRECT (HIGH, -15pts): failed to mention www.dprusa.in.

For callQuality, infer from the text. Return ONLY valid JSON.`;

        const aiResult = await callOpenAiApi(apiKey, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]);

        finalResult = {
          overallScore: aiResult.overallScore,
          complianceStatus: aiResult.complianceStatus,
          hasRedFlags: (aiResult.redFlags || []).length > 0,
          redFlagsCount: (aiResult.redFlags || []).length,
          redFlags: aiResult.redFlags || [],
          callQuality: aiResult.callQuality,
          evaluation: {
            ...aiResult.evaluation,
            feedback: aiResult.feedback || 'GPT-4o-mini transcript compliance evaluation completed.'
          }
        };
      }

      if (!finalResult) {
        throw new Error('Compliance evaluation could not be completed.');
      }

      const updatedCall = {
        ...callToAudit,
        transcript: currentCallTranscript,
        isRealTranscribed,
        status: finalResult.status || 'Audited',
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
          const dbRow = mapCallToDb(updatedCall);
          const { error } = await supabase
            .from('calls')
            .upsert(dbRow);
          
          if (error) {
            console.error(`Failed to save audited call ${updatedCall.id} in Supabase:`, error);
            setDbError(`Failed to save audit result for ${updatedCall.id}: ` + error.message);
          }
        } catch (err) {
          console.error(`Exception saving audited call ${updatedCall.id} to Supabase:`, err);
          setDbError(`Failed to save audit result: ` + (err.message || err));
        }
      }

      setCalls((prev) => prev.map(c => c.id === callToAudit.id ? updatedCall : c));
      if (selectedCall && selectedCall.id === callToAudit.id) {
        setSelectedCall(updatedCall);
      }

      return updatedCall;

    } catch (err) {
      console.error("AI Audit failed:", err);
      
      const failedCall = {
        ...callToAudit,
        status: 'Failed',
        complianceStatus: 'Error',
        overallScore: 0,
        evaluation: {
          ...(callToAudit.evaluation || {}),
          feedback: `Real AI Audit Failed: ${err.message || err}`
        }
      };

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('calls').upsert(mapCallToDb(failedCall));
        } catch (dbErr) {
          console.error("Failed to save failed status to Supabase:", dbErr);
        }
      }

      setCalls((prev) => prev.map(c => c.id === callToAudit.id ? failedCall : c));
      if (selectedCall && selectedCall.id === callToAudit.id) {
        setSelectedCall(failedCall);
      }

      if (!silentOnFailure) {
        alert(`AI Audit failed for Call ID ${callToAudit.id}:\n${err.message || err}`);
      }
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
            <div className="space-y-6 max-w-4xl animate-in fade-in duration-200">
              
              {/* SlashRTC proxy logins */}
              <div className="card-white p-8 space-y-6 max-w-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-base">SlashRTC Integrations Proxy</h3>
                    <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Configure credentials for AramcoIndia SlashRTC dialer portals</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[13px] text-amber-800 leading-relaxed">
                  <p className="flex items-center gap-2 font-semibold text-amber-700 mb-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Browser Playback Protocol</span>
                  </p>
                  <span>
                    Recording playback links require your current browser session to be authenticated at <strong className="font-semibold">aramcoindia.slashrtc.in</strong>.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="block text-[13px] font-medium text-[var(--text-secondary)]">SlashRTC Base Portal URL</label>
                    <input 
                      type="text" 
                      value={portalUrl} 
                      onChange={(e) => setPortalUrl(e.target.value)}
                      className="input-field font-mono text-[13px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)]">Username</label>
                      <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[13px] font-medium text-[var(--text-secondary)]">Password</label>
                      <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-5 flex items-center justify-between border-t border-[var(--border-color)]">
                  <a 
                    href={portalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[13px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1.5"
                  >
                    <span>Open SlashRTC Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSlashRtcActive(prev => !prev)}
                      className={`btn-secondary py-2 px-4 text-sm font-medium ${slashRtcActive ? 'text-red-600 hover:bg-red-50 border-red-200' : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'}`}
                    >
                      {slashRtcActive ? 'Disconnect' : 'Activate Auth'}
                    </button>
                    <button 
                      onClick={() => {
                        confetti({ particleCount: 20, spread: 40 });
                        setSlashRtcActive(true);
                      }}
                      className="btn-primary py-2 px-5 text-sm font-semibold"
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
          auditProgressStatus={auditProgressStatus}
        />
      )}

    </div>
  );
}
