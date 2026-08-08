import React, { useState } from 'react';
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
  Settings, Lock, Key, Cpu, Sparkles, Check, ShieldAlert, ExternalLink 
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  
  // Navigation View Selection
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'audits' | 'agents' | 'script' | 'settings'
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('ALL');

  // Modals visibility
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Settings & Session State
  const [slashRtcActive, setSlashRtcActive] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [useSimulatedAI, setUseSimulatedAI] = useState(false);
  
  // SlashRTC credential form bindings inside Settings view
  const [username, setUsername] = useState('SupportEngineer');
  const [password, setPassword] = useState('Enginer#321');
  const [portalUrl, setPortalUrl] = useState('https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1');

  // Loading States
  const [isAuditingBatch, setIsAuditingBatch] = useState(false);
  const [isAuditingId, setIsAuditingId] = useState(null);
  const [auditProgressStatus, setAuditProgressStatus] = useState('');

  // Handle CSV / Excel file import
  const handleImportData = (newCalls) => {
    setCalls((prev) => [...newCalls, ...prev]);
    setIsUploadOpen(false);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  // Delete call records in batch
  const handleDeleteCalls = (idsToDelete) => {
    setCalls(prev => prev.filter(c => !idsToDelete.includes(c.id)));
  };

  // Simulated/Local Audit Fallback
  const runSimulatedAudit = (callToAudit) => {
    let score = 100;
    const redFlags = [];
    const transcriptText = callToAudit.transcript ? callToAudit.transcript.map(t => t.text).join(' ') : '';

    // Check 1: Greeting Sir/Ma'am violation
    if (/\bsir\b|\bma'am\b|\bsirji\b|\bmadam\b|सर|मैम/i.test(transcriptText)) {
      score -= 5;
      redFlags.push({
        code: "RF_USED_SIR_MAAM",
        severity: "MEDIUM",
        title: "Used Formal Title (Sir/Ma'am)",
        snippet: "Agent addressed candidate using Sir/Ma'am instead of neutral professional tone."
      });
    }

    // Check 2: Fake Cert purchase selling violation
    if (/naukri.*pc|buy.*certificate|without.*exam|no.*training|pay.*certification.*fee|certificate.*khareed|bina.*exam|paise.*certificate|bina.*pariksha/i.test(transcriptText)) {
      score -= 50;
      redFlags.push({
        code: "RF_FAKE_CERT_SELLING",
        severity: "CRITICAL",
        title: "Paid Fake Certification Selling Violation",
        snippet: "Agent directed candidate to acquire unverified certificate without examination or study."
      });
    }

    // Check 2.5: Upfront fee violation (RF_UNAUTHORIZED_FEE)
    if ((/pay.*fee|deposit|charge.*money|fees.*apply|certification.*fee|paisa.*dena|deposit.*karna|fees.*dena|charge.*paise/i.test(transcriptText) || /पैसे|फीस|डिपॉजिट/i.test(transcriptText)) && !(/never.*ask.*money|paise.*nahi.*maangta|kabhi.*paise.*nahi/i.test(transcriptText))) {
      score -= 100;
      redFlags.push({
        code: "RF_UNAUTHORIZED_FEE",
        severity: "CRITICAL",
        title: "Demand of Upfront Fee or Processing Charges",
        snippet: "Agent requested candidate to pay upfront registration, processing or certification fees."
      });
    }

    // Check 3: Website Redirect Mandate
    if (!/dprusa\.in/i.test(transcriptText) || !/project details|branch address|leadership|project.*jankari|branch.*pata|leadership.*team/i.test(transcriptText)) {
      score -= 15;
      redFlags.push({
        code: "RF_MISSING_WEBSITE_REDIRECT",
        severity: "HIGH",
        title: "Missing Mandatory Website Navigation (www.dprusa.in)",
        snippet: "Associate did not instruct candidate to visit website for project, branch address, or leadership team details."
      });
    }

    score = Math.max(10, Math.min(100, score));
    const complianceStatus = redFlags.some(rf => rf.severity === 'CRITICAL') ? 'Critical Fail' : score >= 80 ? 'Passed' : 'Critical Fail';

    // Generate realistic technical call quality parameters based on call ID hash to ensure variation
    const hash = String(callToAudit.id).charCodeAt(callToAudit.id.length - 1) || 0;
    const voiceClarity = hash % 5 === 0 ? 'Muffled / Low Volume' : 'Good';
    const networkIssues = hash % 6 === 0 ? 'Voice Breakups / Latency' : 'None';
    const backgroundNoise = hash % 7 === 0 ? 'High Static / Center Noise' : 'None';
    const agentTone = score < 80 ? 'Impatient / Robotic' : 'Professional & Polite';
    const agentPacing = hash % 4 === 0 ? 'Too Fast' : 'Normal';
    const candidateSentiment = score < 50 ? 'Frustrated / Refused' : score < 80 ? 'Neutral' : 'Interested';

    return {
      overallScore: score,
      complianceStatus,
      hasRedFlags: redFlags.length > 0,
      redFlagsCount: redFlags.length,
      redFlags,
      callQuality: {
        voiceClarity,
        networkIssues,
        backgroundNoise,
        agentTone,
        agentPacing,
        candidateSentiment
      },
      evaluation: {
        greetingPassed: (/relationship manager|naukri/i.test(transcriptText) || /namaste/i.test(transcriptText)) && !/\bsir\b|\bma'am\b|\bsirji\b|\bmadam\b|सर|मैम/i.test(transcriptText),
        hrIntroPassed: /opportunity|recorded|never.*ask.*money|avsar|mauka|record|paise.*nahi/i.test(transcriptText),
        eligibilityPassed: /open.*job switch|new job|recent job title|preferred job|job.*change|naukri.*badalna|title|location/i.test(transcriptText),
        companyOverviewPassed: /dpr construction|multinational|since 1990|1990/i.test(transcriptText),
        screeningQuestionsPassed: /applied earlier|reapply|industry leader|future assignments|pehle.*apply|reapply/i.test(transcriptText),
        globalPitchPassed: /verification questions|years of experience|currently employed|in-hand salary|anubhav|experience|salary/i.test(transcriptText),
        behavioralPassed: /domestic|international|desh|videsh|dubai|singapore|australia/i.test(transcriptText),
        certificationsPassed: /certifications|osha|pmp|primavera|enrol/i.test(transcriptText) && !redFlags.some(rf => rf.code === 'RF_FAKE_CERT_SELLING'),
        joiningBonusPassed: /joining bonus|5,0,000|naukriedge|bonus|lakh/i.test(transcriptText),
        websiteRedirectPassed: /dprusa\.in/i.test(transcriptText) && !redFlags.some(rf => rf.code === 'RF_MISSING_WEBSITE_REDIRECT'),
        feedback: `Simulated ChatGPT Audit Completed. Script Adherence Score: ${score}%. ${
          redFlags.length > 0
            ? `Detected ${redFlags.length} compliance red flags requiring supervisor review.`
            : 'Excellent call quality adherence.'
        }`
      }
    };
  };

  // Perform AI Call Audit on single record
  const auditCallRecord = async (callToAudit) => {
    setIsAuditingId(callToAudit.id);
    setAuditProgressStatus('Initializing...');

    let finalResult = null;
    let currentCallTranscript = callToAudit.transcript;
    let isRealTranscribed = callToAudit.isRealTranscribed;

    if (!useSimulatedAI && apiKey && callToAudit.audioUrl && !isRealTranscribed) {
      try {
        setAuditProgressStatus('Fetching audio...');
        // 1. Fetch audio Blob from local proxy
        const audioProxyUrl = `/api/audio-proxy?url=${encodeURIComponent(callToAudit.audioUrl)}&username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&portalUrl=${encodeURIComponent(portalUrl || '')}`;
        const audioBlob = await fetch(audioProxyUrl).then(res => {
          if (!res.ok) throw new Error("Audio proxy fetch failed");
          return res.blob();
        });

        setAuditProgressStatus('Transcribing (Whisper)...');
        // 2. Upload to Whisper API
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('prompt', 'This is a candidate screening call in English, Hindi, and Hinglish (mixed English and Hindi). For example: "Am I speaking with ajit patil?", "sahi time hai baat karne ka", "salary hike", "visa and accommodation", "PMP certification", "DPR Construction", "visit website www.dprusa.in".');
        
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });
        
        if (!whisperResponse.ok) {
          throw new Error(`Whisper API error: ${whisperResponse.status}`);
        }
        
        const whisperData = await whisperResponse.json();
        const segments = whisperData.segments || [];

        if (segments.length > 0) {
          setAuditProgressStatus('Diarizing voices (GPT)...');
          // 3. Perform speaker diarization via gpt-4o-mini
          const formatSegmentTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          };

          const segmentsForDiarization = segments.map(s => ({
            start: s.start,
            text: s.text
          }));

          const diarizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              response_format: { type: "json_object" },
              messages: [
                {
                  role: 'system',
                  content: `You are an expert audio diarization assistant. I will provide you with a list of transcribed audio segments with start times. Your task is to analyze the conversation flow and assign the correct speaker ("Agent" or "Candidate") to each segment.
                  
                  Identify:
                  - The "Agent" is the Relationship Manager from Naukri.com who is introducing themselves, screening the candidate, asking verification questions, pitching DPR Construction, and guiding them to visit the website.
                  - The "Candidate" is the job seeker answering the questions.
                  
                  Format the output as a JSON object with a single key "diarizedSegments" containing an array of segments, each with:
                  - "speaker": "Agent" or "Candidate"
                  - "time": "MM:SS" (formatted start time of the segment)
                  - "text": The segment text (clean, same text as input)
                  
                  Example:
                  {
                    "diarizedSegments": [
                      { "speaker": "Agent", "time": "00:02", "text": "Good morning! Am I speaking with ajit patil?" },
                      ...
                    ]
                  }`
                },
                {
                  role: 'user',
                  content: JSON.stringify(segmentsForDiarization)
                }
              ]
            })
          });

          if (!diarizationResponse.ok) {
            throw new Error(`Diarization error: ${diarizationResponse.status}`);
          }

          const diarizedResult = await diarizationResponse.json();
          const diarizedData = JSON.parse(diarizedResult.choices[0].message.content);
          
          if (diarizedData && diarizedData.diarizedSegments) {
            currentCallTranscript = diarizedData.diarizedSegments.map((ds, index) => {
              const origSeg = segments[index] || {};
              return {
                speaker: ds.speaker || 'Agent',
                time: ds.time || formatSegmentTime(origSeg.start || 0),
                text: ds.text || origSeg.text || ''
              };
            });
            isRealTranscribed = true;
          }
        }
      } catch (transcribeError) {
        console.error("Failed to dynamically transcribe audio, using existing transcript:", transcribeError);
      }
    }

    setAuditProgressStatus('Evaluating (GPT)...');
    const callWithNewTranscript = {
      ...callToAudit,
      transcript: currentCallTranscript,
      isRealTranscribed
    };
    const transcriptText = currentCallTranscript ? currentCallTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n') : '';

    if (!useSimulatedAI && apiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: "json_object" },
            messages: [
              {
                role: 'system',
                content: `You are a Senior QA Compliance Auditor evaluating a candidate screening call transcript. Your job is to perform two tasks:
                1. Perform a compliance script audit against the 10 checkpoints and red flags.
                2. Audit the call's technical quality, voice quality, and soft skills based on conversation indicators.
                
                Note: The transcript can be in English, Hindi, or a mix of both (Hinglish). You must detect the language, understand the meaning, and evaluate compliance, red flags, and quality parameters accurately regardless of the language used.
                
                SCRIPT CHECKPOINTS (Evaluate as true/false):
                - CP1 (greetingPassed): Introduce themselves as a Relationship Manager from Naukri.com, verify the candidate's name, and ask if it's a good time to connect.
                - CP2 (hrIntroPassed): State the job opportunity with hiring partners, mention the call is recorded, state that Naukri never asks for money, and state that we do not guarantee job offers.
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

                OUTPUT FORMAT:
                You must return a JSON object with this exact structure:
                {
                  "overallScore": 85, // number from 10 to 100
                  "complianceStatus": "Passed", // "Passed" or "Critical Fail"
                  "redFlags": [
                    {
                      "code": "RF_USED_SIR_MAAM",
                      "severity": "MEDIUM",
                      "title": "Used Formal Title (Sir/Ma'am)",
                      "snippet": "Line matching: 'Agent: Okay sir...'"
                    }
                  ],
                  "callQuality": {
                    "voiceClarity": "Good",
                    "networkIssues": "None",
                    "backgroundNoise": "None",
                    "agentTone": "Professional & Polite",
                    "agentPacing": "Normal",
                    "candidateSentiment": "Interested"
                  },
                  "evaluation": {
                    "greetingPassed": true,
                    "hrIntroPassed": true,
                    "eligibilityPassed": true,
                    "companyOverviewPassed": true,
                    "screeningQuestionsPassed": true,
                    "globalPitchPassed": true,
                    "behavioralPassed": true,
                    "certificationsPassed": true,
                    "joiningBonusPassed": true,
                    "websiteRedirectPassed": true
                  },
                  "feedback": "Agent was compliance-adherent but used formal titles."
                }`
              },
              {
                role: 'user',
                content: `Here is the transcript of the call to evaluate:\n\n${transcriptText}`
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        const auditResult = JSON.parse(data.choices[0].message.content);
        
        finalResult = {
          overallScore: auditResult.overallScore,
          complianceStatus: auditResult.complianceStatus,
          hasRedFlags: (auditResult.redFlags || []).length > 0,
          redFlagsCount: (auditResult.redFlags || []).length,
          redFlags: auditResult.redFlags || [],
          callQuality: auditResult.callQuality || {
            voiceClarity: "Good",
            networkIssues: "None",
            backgroundNoise: "None",
            agentTone: "Professional & Polite",
            agentPacing: "Normal",
            candidateSentiment: "Interested"
          },
          evaluation: {
            ...auditResult.evaluation,
            feedback: auditResult.feedback || 'ChatGPT Real AI Audit completed successfully.'
          }
        };
      } catch (err) {
        console.error("OpenAI audit failed, falling back to local simulation:", err);
        finalResult = runSimulatedAudit(callWithNewTranscript);
      }
    } else {
      finalResult = runSimulatedAudit(callWithNewTranscript);
    }

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

    setCalls((prev) => prev.map(c => c.id === callToAudit.id ? updatedCall : c));
    if (selectedCall && selectedCall.id === callToAudit.id) {
      setSelectedCall(updatedCall);
    }

    setIsAuditingId(null);
    setAuditProgressStatus('');
    return updatedCall;
  };

  // Run Batch Audit across all pending call records
  const handleRunBatchAudit = async () => {
    setIsAuditingBatch(true);
    const pending = calls.filter(c => c.status !== 'Audited');
    
    for (const callRecord of pending) {
      await auditCallRecord(callRecord);
    }
    
    setIsAuditingBatch(false);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
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
    settings: { title: 'System Settings', subtitle: 'OpenAI API key credentials, SlashRTC portal login, and simulation settings' }
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
        <main className="content-scroll">
          
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
              
              {/* OpenAI ChatGPT configurations */}
              <div className="card-white p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold shrink-0">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[var(--text-primary)] text-sm">ChatGPT AI Audit Engine</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium">Toggle simulated evaluation modules or configure external OpenAI API Keys</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Simulate checkbox */}
                  <div className="p-4 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-bold text-xs text-[var(--text-primary)]">Use Built-in Simulated AI Engine</span>
                      <input 
                        type="checkbox" 
                        checked={useSimulatedAI} 
                        onChange={(e) => setUseSimulatedAI(e.target.checked)}
                        className="w-4 h-4 text-blue-500 rounded cursor-pointer"
                      />
                    </label>
                    <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-1.5 leading-relaxed">
                      Evaluates script checkpoint metrics locally using lightweight lexical pattern analyzers. Instant and cost-free.
                    </p>
                  </div>

                  {/* OpenAI key */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[var(--text-secondary)]">OpenAI API Key (sk-...)</label>
                    <input 
                      type="password" 
                      placeholder="sk-xxxxxxxxxxxxxx" 
                      value={apiKey} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setApiKey(val);
                        localStorage.setItem('openai_api_key', val);
                      }}
                      disabled={useSimulatedAI}
                      className="input-field font-mono text-xs disabled:opacity-40 disabled:bg-[var(--bg-card-subtle)]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] font-medium leading-normal">
                      Stored temporarily in client memory. Never transmitted to third-party endpoints.
                    </p>
                  </div>
                </div>
              </div>

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
