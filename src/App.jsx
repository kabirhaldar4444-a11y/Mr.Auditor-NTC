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

// Google Gemini API REST client helper
const callGeminiApi = async (apiKey, payload, retriesLeft = 5) => {
  const url = `/api/gemini-proxy`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Handle Rate Limit Error (HTTP 429)
    if (response.status === 429 && retriesLeft > 0) {
      const errText = await response.text();
      let delayMs = 15000; // Default wait 15 seconds
      
      try {
        const errJson = JSON.parse(errText);
        const errMsg = errJson.error?.message || '';
        // Extract retry delay from message (e.g., "Please retry in 11.481715445s.")
        const match = errMsg.match(/retry in ([\d\.]+)s/i);
        if (match && match[1]) {
          delayMs = Math.ceil(parseFloat(match[1]) * 1000) + 1500; // Add 1.5s buffer
        }
      } catch (_) {}
      
      console.warn(`Gemini API Rate limit (429) hit. Waiting ${delayMs / 1000}s before retrying... (${retriesLeft} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return callGeminiApi(apiKey, payload, retriesLeft - 1);
    }

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Gemini API error: ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error("Gemini API returned an empty response.");
    }

    // Handle markdown formatting blocks if Gemini outputs them (e.g. ```json ... ```)
    const cleanJsonText = textResponse.replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(cleanJsonText);
  } catch (err) {
    if (retriesLeft > 0 && (err.message?.includes('429') || err.message?.includes('Quota exceeded'))) {
      console.warn(`Retrying caught rate limit error: ${err.message}. Waiting 15s...`);
      await new Promise(resolve => setTimeout(resolve, 15000));
      return callGeminiApi(apiKey, payload, retriesLeft - 1);
    }
    throw err;
  }
};

export default function App() {
  const [calls, setCalls] = useState([]);
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
  const [apiKey, setApiKey] = useState(() => 'AQ.Ab8RN6KIU-W1ienOfMmHx1AV9rRF7t_D7Lie-1YXtSxkMhlckQ');
  
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
        // Start with empty state if Supabase is not configured
        setCalls([]);
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
        throw new Error("Missing Gemini API Key. Please configure your key in Settings.");
      }

      if (callToAudit.audioUrl && !isRealTranscribed) {
        setAuditProgressStatus('Fetching audio...');
        const audioProxyUrl = `/api/audio-proxy?url=${encodeURIComponent(callToAudit.audioUrl)}&username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&portalUrl=${encodeURIComponent(portalUrl || '')}`;
        const audioBlob = await fetch(audioProxyUrl).then(res => {
          if (!res.ok) throw new Error(`Audio fetch failed from SlashRTC portal. Ensure you are logged in.`);
          return res.blob();
        });

        setAuditProgressStatus('Evaluating Audio (Gemini)...');
        const base64Data = await blobToBase64(audioBlob);

        const promptText = `You are a Senior QA Compliance Auditor evaluating a candidate screening call.
Perform three tasks:
1. Identify speakers ("Agent" and "Candidate"), transcribe and diarize the conversation with start times, and format it as segments (each segment with speaker, time in MM:SS, and text).
   - CRITICAL REQUIREMENT: You MUST transcribe the conversation EXACTLY word-for-word (literal transcript). Do NOT paraphrase, summarize, omit words, or correct grammar/filler words.
   - The transcript must be 100% identical and similar to the spoken audio.
   - Transcribe in the language spoken: if they speak in Hinglish (Hindi/English mix), write down the exact Hinglish/Hindi words in Latin script or Devnagari.
   - Do NOT bias the transcript to match the compliance checkpoints or templates. If the agent deviates, makes mistakes, uses prohibited terms (like "Sir" or "Ma'am"), or skips parts, the transcript MUST capture those exact words and deviations.
2. Perform a compliance script audit against the 10 checkpoints and compliance red flags.
3. Audit the call's technical voice quality and soft skills.

The audio is a recording of an HR Relationship Manager screening a job seeker. It can be in English, Hindi, or a mix of English and Hindi (Hinglish). You must detect the language, understand the meaning, and evaluate compliance and diarization segment content accurately based on the literal transcript of the audio.

SCRIPT CHECKPOINTS (Evaluate as true/false):
- CP1 (greetingPassed): Introduce themselves as a Relationship Manager from Naukri.com, verify the candidate's name, and ask if it's a good time to connect. Maintain a neutral tone & AVOID 'Sir/Ma'am'.
- CP2 (hrIntroPassed): State the job opportunity with premium hiring partners, mention the call is recorded, state that Naukri never asks for money, and state that we do not guarantee job offers.
- CP3 (eligibilityPassed): Confirm if the candidate is open to a job switch or new job, and ask for their current/last job title.
- CP4 (companyOverviewPassed): Pitch DPR Construction as a multinational engineering company delivering roads, metro, railway, power, mining, manufacturing, and high-rise infrastructure, with offices in Mumbai BKC, Paris, Dubai, Tokyo, Australia, Mexico, and official website www.dprusa.in.
- CP5 (screeningQuestionsPassed): Address candidate's applied cases (Case 1: re-apply under fresh cycles without cost, Case 2: considered for future assignments).
- CP6 (globalPitchPassed): Ask verification questions: total years of experience, current employment, last organization, key roles, department, education, graduation year, certifications, current salary, expected salary, interviewed in 6 months, age, and joining timeline.
- CP7 (behavioralPassed): Mention domestic locations (Mumbai, Pune, Chennai, Delhi NCR) or international sites (Tokyo, Dubai, Paris).
- CP8 (certificationsPassed): State corporate benefits (EPF, ESIC, family medical insurance, gratuity, performance bonus, travel allowance, site accommodation) and explain certifications like PMP, AutoCAD, Primavera P6, or Revit are mandatory.
- CP9 (joiningBonusPassed): Mention registration link, resume upload, and 10% sign-on joining bonus if joining within 30 days.
- CP10 (websiteRedirectPassed): Direct the candidate to visit www.dprusa.in for branch address and project details.

COMPLIANCE RED FLAGS (Deduct points if found):
1. Used formal titles like "Sir" or "Ma'am" (RF_USED_SIR_MAAM, Severity: MEDIUM). Deduct 5 points.
2. Paid Fake Certification Selling Violation: Agent tells candidate they can get/buy a certificate without study/exams (RF_FAKE_CERT_SELLING, Severity: CRITICAL). Deduct 50 points.
3. Demand of Upfront Fee or Processing Charges: Asking candidate to pay money or deposit for certification or job registration, instead of emphasizing that Naukri never asks for money (RF_UNAUTHORIZED_FEE, Severity: CRITICAL). Deduct 100 points.
4. Missing Mandatory Website Navigation: Failure to direct the candidate to navigate to www.dprusa.in (RF_MISSING_WEBSITE_REDIRECT, Severity: HIGH). Deduct 15 points.

TECHNICAL & QUALITY EVALUATIONS:
- Voice Clarity: Is the audio volume good and voice clear? Value: "Good" or "Muffled / Low Volume".
- Connectivity / Network Issues: Any voice breakups, network latency delays, or long silences? Value: "None" or "Voice Breakups / Latency".
- Ambient Background Noise: Any traffic, keyboard clicks, static, or background talk? Value: "None" or "High Static / Center Noise".
- Agent Tone & Attitude: Professional, polite and empathetic, or impatient/robotic? Value: "Professional & Polite" or "Impatient / Robotic".
- Agent Speaking Pacing: Is speaking speed normal, too fast, or too slow? Value: "Normal", "Too Fast", "Too Slow".
- Candidate Sentiment: How does the candidate sound? Value: "Interested", "Neutral", "Frustrated / Refused".

Please return the diarized segments and complete compliance audit results matching the response schema.`;

        const payload = {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: audioBlob.type || 'audio/wav',
                    data: base64Data
                  }
                },
                {
                  text: promptText
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                diarizedSegments: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      speaker: { type: 'STRING', enum: ['Agent', 'Candidate'] },
                      time: { type: 'STRING' },
                      text: { type: 'STRING' }
                    },
                    required: ['speaker', 'time', 'text']
                  }
                },
                overallScore: { type: 'INTEGER' },
                complianceStatus: { type: 'STRING', enum: ['Passed', 'Critical Fail'] },
                redFlags: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      code: { type: 'STRING' },
                      severity: { type: 'STRING' },
                      title: { type: 'STRING' },
                      snippet: { type: 'STRING' }
                    },
                    required: ['code', 'severity', 'title', 'snippet']
                  }
                },
                callQuality: {
                  type: 'OBJECT',
                  properties: {
                    voiceClarity: { type: 'STRING' },
                    networkIssues: { type: 'STRING' },
                    backgroundNoise: { type: 'STRING' },
                    agentTone: { type: 'STRING' },
                    agentPacing: { type: 'STRING' },
                    candidateSentiment: { type: 'STRING' }
                  },
                  required: ['voiceClarity', 'networkIssues', 'backgroundNoise', 'agentTone', 'agentPacing', 'candidateSentiment']
                },
                evaluation: {
                  type: 'OBJECT',
                  properties: {
                    greetingPassed: { type: 'BOOLEAN' },
                    hrIntroPassed: { type: 'BOOLEAN' },
                    eligibilityPassed: { type: 'BOOLEAN' },
                    companyOverviewPassed: { type: 'BOOLEAN' },
                    screeningQuestionsPassed: { type: 'BOOLEAN' },
                    globalPitchPassed: { type: 'BOOLEAN' },
                    behavioralPassed: { type: 'BOOLEAN' },
                    certificationsPassed: { type: 'BOOLEAN' },
                    joiningBonusPassed: { type: 'BOOLEAN' },
                    websiteRedirectPassed: { type: 'BOOLEAN' }
                  },
                  required: [
                    'greetingPassed', 'hrIntroPassed', 'eligibilityPassed', 'companyOverviewPassed',
                    'screeningQuestionsPassed', 'globalPitchPassed', 'behavioralPassed',
                    'certificationsPassed', 'joiningBonusPassed', 'websiteRedirectPassed'
                  ]
                },
                feedback: { type: 'STRING' }
              },
              required: ['diarizedSegments', 'overallScore', 'complianceStatus', 'redFlags', 'callQuality', 'evaluation', 'feedback']
            }
          }
        };

        const geminiResult = await callGeminiApi(apiKey, payload);

        currentCallTranscript = geminiResult.diarizedSegments || [];
        isRealTranscribed = true;

        finalResult = {
          overallScore: geminiResult.overallScore,
          complianceStatus: geminiResult.complianceStatus,
          hasRedFlags: (geminiResult.redFlags || []).length > 0,
          redFlagsCount: (geminiResult.redFlags || []).length,
          redFlags: geminiResult.redFlags || [],
          callQuality: geminiResult.callQuality,
          evaluation: {
            ...geminiResult.evaluation,
            feedback: geminiResult.feedback || 'Gemini native audio evaluation completed.'
          }
        };
      }

      if (isRealTranscribed && !finalResult) {
        setAuditProgressStatus('Evaluating Transcript (Gemini)...');
        const transcriptText = currentCallTranscript ? currentCallTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n') : '';

        const promptText = `You are a Senior QA Compliance Auditor evaluating a candidate screening call transcript.
Perform two tasks:
1. Perform a compliance script audit against the 10 checkpoints and compliance red flags.
2. Audit the call's technical voice quality and soft skills based on conversation indicators.

Here is the transcript of the call to evaluate:
${transcriptText}

SCRIPT CHECKPOINTS (Evaluate as true/false):
- CP1 (greetingPassed): Introduce themselves as a Relationship Manager from Naukri.com, verify the candidate's name, and ask if it's a good time to connect. Maintain a neutral tone & AVOID 'Sir/Ma'am'.
- CP2 (hrIntroPassed): State the job opportunity with premium hiring partners, mention the call is recorded, state that Naukri never asks for money, and state that we do not guarantee job offers.
- CP3 (eligibilityPassed): Confirm if the candidate is open to a job switch or new job, and ask for their current/last job title.
- CP4 (companyOverviewPassed): Pitch DPR Construction as a multinational engineering company delivering roads, metro, railway, power, mining, manufacturing, and high-rise infrastructure, with offices in Mumbai BKC, Paris, Dubai, Tokyo, Australia, Mexico, and official website www.dprusa.in.
- CP5 (screeningQuestionsPassed): Address candidate's applied cases (Case 1: re-apply under fresh cycles without cost, Case 2: considered for future assignments).
- CP6 (globalPitchPassed): Ask verification questions: total years of experience, current employment, last organization, key roles, department, education, graduation year, certifications, current salary, expected salary, interviewed in 6 months, age, and joining timeline.
- CP7 (behavioralPassed): Mention domestic locations (Mumbai, Pune, Chennai, Delhi NCR) or international sites (Tokyo, Dubai, Paris).
- CP8 (certificationsPassed): State corporate benefits (EPF, ESIC, family medical insurance, gratuity, performance bonus, travel allowance, site accommodation) and explain certifications like PMP, AutoCAD, Primavera P6, or Revit are mandatory.
- CP9 (joiningBonusPassed): Mention registration link, resume upload, and 10% sign-on joining bonus if joining within 30 days.
- CP10 (websiteRedirectPassed): Direct the candidate to visit www.dprusa.in for branch address and project details.

COMPLIANCE RED FLAGS (Deduct points if found):
1. Used formal titles like "Sir" or "Ma'am" (RF_USED_SIR_MAAM, Severity: MEDIUM). Deduct 5 points.
2. Paid Fake Certification Selling Violation: Agent tells candidate they can get/buy a certificate without study/exams (RF_FAKE_CERT_SELLING, Severity: CRITICAL). Deduct 50 points.
3. Demand of Upfront Fee or Processing Charges: Asking candidate to pay money or deposit for certification or job registration, instead of emphasizing that Naukri never asks for money (RF_UNAUTHORIZED_FEE, Severity: CRITICAL). Deduct 100 points.
4. Missing Mandatory Website Navigation: Failure to direct the candidate to navigate to www.dprusa.in (RF_MISSING_WEBSITE_REDIRECT, Severity: HIGH). Deduct 15 points.

TECHNICAL & QUALITY EVALUATIONS:
- Voice Clarity: Is the audio volume good and voice clear? Value: "Good" or "Muffled / Low Volume".
- Connectivity / Network Issues: Any voice breakups, network latency delays, or long silences? Value: "None" or "Voice Breakups / Latency".
- Ambient Background Noise: Any traffic, keyboard clicks, static, or background talk? Value: "None" or "High Static / Center Noise".
- Agent Tone & Attitude: Professional, polite and empathetic, or impatient/robotic? Value: "Professional & Polite" or "Impatient / Robotic".
- Agent Speaking Pacing: Is speaking speed normal, too fast, or too slow? Value: "Normal", "Too Fast", "Too Slow".
- Candidate Sentiment: How does the candidate sound? Value: "Interested", "Neutral", "Frustrated / Refused".

Please return the complete compliance audit results matching the response schema.`;

        const payload = {
          contents: [
            {
              parts: [
                {
                  text: promptText
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                overallScore: { type: 'INTEGER' },
                complianceStatus: { type: 'STRING', enum: ['Passed', 'Critical Fail'] },
                redFlags: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      code: { type: 'STRING' },
                      severity: { type: 'STRING' },
                      title: { type: 'STRING' },
                      snippet: { type: 'STRING' }
                    },
                    required: ['code', 'severity', 'title', 'snippet']
                  }
                },
                callQuality: {
                  type: 'OBJECT',
                  properties: {
                    voiceClarity: { type: 'STRING' },
                    networkIssues: { type: 'STRING' },
                    backgroundNoise: { type: 'STRING' },
                    agentTone: { type: 'STRING' },
                    agentPacing: { type: 'STRING' },
                    candidateSentiment: { type: 'STRING' }
                  },
                  required: ['voiceClarity', 'networkIssues', 'backgroundNoise', 'agentTone', 'agentPacing', 'candidateSentiment']
                },
                evaluation: {
                  type: 'OBJECT',
                  properties: {
                    greetingPassed: { type: 'BOOLEAN' },
                    hrIntroPassed: { type: 'BOOLEAN' },
                    eligibilityPassed: { type: 'BOOLEAN' },
                    companyOverviewPassed: { type: 'BOOLEAN' },
                    screeningQuestionsPassed: { type: 'BOOLEAN' },
                    globalPitchPassed: { type: 'BOOLEAN' },
                    behavioralPassed: { type: 'BOOLEAN' },
                    certificationsPassed: { type: 'BOOLEAN' },
                    joiningBonusPassed: { type: 'BOOLEAN' },
                    websiteRedirectPassed: { type: 'BOOLEAN' }
                  },
                  required: [
                    'greetingPassed', 'hrIntroPassed', 'eligibilityPassed', 'companyOverviewPassed',
                    'screeningQuestionsPassed', 'globalPitchPassed', 'behavioralPassed',
                    'certificationsPassed', 'joiningBonusPassed', 'websiteRedirectPassed'
                  ]
                },
                feedback: { type: 'STRING' }
              },
              required: ['overallScore', 'complianceStatus', 'redFlags', 'callQuality', 'evaluation', 'feedback']
            }
          }
        };

        const geminiResult = await callGeminiApi(apiKey, payload);

        finalResult = {
          overallScore: geminiResult.overallScore,
          complianceStatus: geminiResult.complianceStatus,
          hasRedFlags: (geminiResult.redFlags || []).length > 0,
          redFlagsCount: (geminiResult.redFlags || []).length,
          redFlags: geminiResult.redFlags || [],
          callQuality: geminiResult.callQuality,
          evaluation: {
            ...geminiResult.evaluation,
            feedback: geminiResult.feedback || 'Gemini transcript compliance evaluation completed.'
          }
        };
      }

      if (!finalResult) {
        throw new Error("Compliance evaluation could not be completed.");
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

    const concurrencyLimit = 3;
    let currentIndex = 0;
    
    const worker = async () => {
      while (currentIndex < queue.length && !cancelBatchRef.current) {
        const index = currentIndex++;
        const callRecord = queue[index];
        
        // Add a 4-second stagger delay between starting calls to stay safely under Gemini 20 RPM Free Tier limit
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 4000));
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
        <div className="h-16 border-b border-slate-800 px-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block">CallPulse <strong className="text-blue-500">AI</strong></span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Compliance QA</span>
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button 
            onClick={() => { setActiveView('dashboard'); }}
            className={`w-full sidebar-link ${activeView === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard Overview</span>
          </button>

          <button 
            onClick={() => { setActiveView('audits'); }}
            className={`w-full sidebar-link ${activeView === 'audits' ? 'active' : ''}`}
          >
            <ListTodo className="w-4 h-4 shrink-0" />
            <span>Call Audits Log</span>
          </button>

          <button 
            onClick={() => { setActiveView('agents'); }}
            className={`w-full sidebar-link ${activeView === 'agents' ? 'active' : ''}`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Agent Performance</span>
          </button>

          <button 
            onClick={() => { setActiveView('script'); }}
            className={`w-full sidebar-link ${activeView === 'script' ? 'active' : ''}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Script Guidelines</span>
          </button>

          <button 
            onClick={() => { setActiveView('settings'); }}
            className={`w-full sidebar-link ${activeView === 'settings' ? 'active' : ''}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>System Settings</span>
          </button>
        </nav>

        {/* Sidebar Footer User Summary */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 text-xs font-semibold space-y-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${slashRtcActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="text-slate-400 font-mono text-[10px]">SlashRTC Status:</span>
            <strong className="text-slate-200 font-bold">{slashRtcActive ? 'Connected' : 'Offline'}</strong>
          </div>
          <div className="text-[10px] text-slate-500 font-mono leading-none">
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
              <div className="w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin aspect-square"></div>
              <p className="text-xs text-[var(--text-secondary)] font-semibold tracking-wide animate-pulse">Synchronizing with Supabase...</p>
            </div>
          ) : (
            <>
              {batchProgress && (
                <div className="max-w-7xl mx-auto mb-6 bg-[var(--bg-card-solid)] border border-[var(--border-color)] rounded-2xl p-5 shadow-lg relative overflow-hidden animate-in slide-in-from-top duration-300">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 text-left">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                        <span className="font-extrabold text-sm text-[var(--text-primary)]">
                          {batchProgress.active ? 'Active Batch Audit Processing' : 'Batch Audit Process Stopped'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                          Concurrency: {batchProgress.active ? '3 Workers' : 'None'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] font-medium">
                        Evaluated <strong className="text-[var(--text-primary)]">{batchProgress.processed}</strong> of <strong className="text-[var(--text-primary)]">{batchProgress.total}</strong> calls 
                        {batchProgress.active && batchProgress.processed > 0 && (
                          <span> (Est. Time Remaining: {Math.round(((Date.now() - batchProgress.startTime) / batchProgress.processed) * (batchProgress.total - batchProgress.processed) / 1000)} seconds)</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 text-xs font-bold font-mono">
                        <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Passed: {batchProgress.success}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-rose-500/10 text-rose-600 rounded-lg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>Errors: {batchProgress.failed}</span>
                        </div>
                      </div>

                      {batchProgress.active && (
                        <button
                          onClick={() => {
                            cancelBatchRef.current = true;
                          }}
                          className="btn-secondary py-1.5 px-4 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 cursor-pointer"
                        >
                          Cancel / Pause Queue
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-[var(--border-color)] h-2 rounded-full mt-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300"
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
            <div className="space-y-6 max-w-4xl">
              


              {/* SlashRTC proxy logins */}
              <div className="card-white p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[var(--text-primary)] text-sm">SlashRTC Integrations Proxy</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium">Verify credentials for AramcoIndia SlashRTC dialer portals</p>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-[var(--text-secondary)] font-medium">
                  <p className="flex items-center gap-1.5 font-bold text-amber-600 mb-1">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Browser Playback Protocol</span>
                  </p>
                  <span className="leading-relaxed">
                    Recording playback links require your current browser session to be authenticated at <strong className="text-[var(--text-primary)] font-bold">aramcoindia.slashrtc.in</strong>.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[var(--text-secondary)]">SlashRTC Base Portal Link</label>
                    <input 
                      type="text" 
                      value={portalUrl} 
                      onChange={(e) => setPortalUrl(e.target.value)}
                      className="input-field font-mono text-[11px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[var(--text-secondary)]">Username</label>
                      <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[var(--text-secondary)]">Password</label>
                      <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[var(--border-color)]">
                  <a 
                    href={portalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1"
                  >
                    <span>Open SlashRTC Portal Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSlashRtcActive(prev => !prev)}
                      className={`btn-secondary py-1.5 text-xs font-bold ${slashRtcActive ? 'text-rose-500' : 'text-emerald-600'}`}
                    >
                      {slashRtcActive ? 'Disconnect Auth' : 'Activate Auth'}
                    </button>
                    <button 
                      onClick={() => {
                        confetti({ particleCount: 20, spread: 40 });
                        setSlashRtcActive(true);
                      }}
                      className="btn-primary py-1.5 text-xs font-bold"
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
          <div className="bg-[var(--bg-card-solid)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-md w-full p-6 relative modal-content text-left animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={handleCloseImportSuccess}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-card-subtle)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-[var(--text-primary)] text-lg">Import Complete</h3>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Successfully processed {importSuccessData.count} call records</p>
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-xs text-[var(--text-secondary)] font-medium mb-6 leading-relaxed">
              <p className="font-bold text-blue-500 flex items-center gap-1.5 mb-1">
                <Database className="w-4 h-4" /> Ready for AI compliance auditing
              </p>
              Your dataset has been ingested into the system database. You can start the automated AI compliance evaluation immediately, or browse the imported records.
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-color)] pt-4">
              <button
                onClick={handleCloseImportSuccess}
                className="btn-secondary py-2 px-4 text-xs font-bold"
              >
                Just View Records
              </button>
              <button
                onClick={handleStartImportAudit}
                className="btn-primary py-2 px-4 text-xs font-bold shadow-md shadow-blue-500/10 flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start AI Audit Immediately</span>
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
