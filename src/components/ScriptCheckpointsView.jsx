import React, { useState } from 'react';
import { CheckCircle2, ShieldAlert, BookOpen, FileText, Sparkles, PhoneCall, HelpCircle, ExternalLink, Award, DollarSign, Globe, Check } from 'lucide-react';
import { SCRIPT_CHECKPOINTS, RED_FLAG_RULES } from '../data/scriptData';

const NTC_FAQS = [
  { q: "1. Where is DPR Construction headquartered?", a: "Global HQ : Carnegie Hall Tower, 200 West 57th Street, New York, NY 10019, United States" },
  { q: "2. Where is DPR Construction Indian branch located, may I have office address?", a: "Asia HQ: Office No. 202, Second Floor, Pinnacle Corporate Park, Kolivery Village, MMRDA Area, Bandra Kurla Complex, Santacruz East, Mumbai, Maharashtra – 400051" },
  { q: "3. What will be the mode of interview?", a: "The initial phase of the interview will be conducted over the phone. You will be contacted by the HR team of DPR Construction. There might also be a requirement for an online interview." },
  { q: "4. What is the Name of DPR Construction HR?", a: "Anyone from the DPR Construction HR staff can contact you, and you may receive a call from their official landline number." },
  { q: "5. What are the Naukri Contact details?", a: "Email: contact@naukriedge.com or Desk Phone: 8042364767" },
  { q: "6. How can I check DPR Construction details online?", a: "You can find detailed information about DPR Construction by visiting their official website: www.dprusa.in" },
  { q: "7. Why can't you provide job description details?", a: "When you get a call from the DPR Construction Group HR department, they will go over your job role and responsibilities with you." },
  { q: "8. Why can't you email, or text message me?", a: "Sorry but being from Naukri.com, we take data privacy very seriously so we are unable to do that." },
  { q: "9. Are these paid services?", a: "Our company does not impose any fees on job candidates. Our business model solely involves charging employers or companies for our services." },
  { q: "10. How can I trust you are offering genuine job opportunities?", a: "Rest assured; we will not impose any charges on you. We are solely affiliated with Naukri.com and are reaching out to you because your qualifications perfectly match the company’s vacancies." },
  { q: "11. If I do not receive any call from the DPR Construction HR team in the next couple of days, how can I contact you?", a: "We can be reached at the same number between 10 a.m. to 7 p.m. at contact@naukriedge.com or 8042364767." },
  { q: "12. If a candidate says, how can you record my calls without my concern?", a: "Certainly, We are able to record all calls as they are commercial in nature. When you opened an account with naukri.com, you agreed to the terms and conditions that permit us to call or SMS you." },
  { q: "13. What are Professional Certificates (PC) OR I never heard about professional certificates?", a: "DPR Construction is primarily working with Government projects and the same has been made mandate for the candidate to hold the PC in order to join DPR Construction as all the projects are using international technology." },
  { q: "14. I never heard of any company asking for such certificates.", a: "DPR Construction focuses on working on government projects worldwide... Hence, having professional certifications is important to qualify for these projects." },
  { q: "15. Which are the professional certifications required in DPR Construction?", a: "Required by domain: Safety (OSHA/NEBOSH/IOSH), Project Management (PMP/Primavera P6/MSP), Construction Tech (AutoCAD/Revit/BIM), Civil Inspection (QA/QC/ACI/NDT)." },
  { q: "16. What happens if I'm unable to give DPR Construction a Professional Certification?", a: "There’s no need to worry. If you don’t have the necessary professional certifications, DPR Construction will certainly assist you. However, you will be required to enroll immediately after selection." },
  { q: "17. Can I give professional certification after joining DPR Construction?", a: "Before a job offer is made public, every reputable company requires candidates to submit the necessary documents. Proof of enrolment must be submitted." },
  { q: "18. What regions in India do they serve?", a: "DPR Construction operates across key infrastructure corridors in 6 major Indian states: Assam, Tripura, Gujarat, Andhra Pradesh, Madhya Pradesh." },
  { q: "19. What projects have you completed in India?", a: "Notable projects include: Guwahati International Airport New Terminal, Agartala–Akhaura Rail Link, NP Kunta Ultra Mega Solar Park, Jamnagar Refinery Expansion, Gangavaram Port." },
  { q: "20. Are they working with the Indian government?", a: "Yes, DPR Construction has collaborated with various state and central government bodies for Construction & Infrastructure." },
  { q: "21. Where is your office located in Bangalore?", a: "Office address: 203, 2ND FLOOR, NORTH BLOCK, MANIPAL CENTER, FRONT WING, Dickenson Rd, Bengaluru, Karnataka 560042" }
];

export default function ScriptCheckpointsView() {
  const [activeTab, setActiveTab] = useState('SCRIPT'); // 'SCRIPT' | 'RUBRICS' | 'FAQS' | 'RED_FLAGS'

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '64px' }} className="space-y-8 animate-in fade-in duration-200 text-left">
      
      {/* Dark Hero Header Banner */}
      <div className="campaign-hub-hero">
        <div style={{ zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>NTC Campaign Standard Operating Procedure</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', lineHeight: '1.2', margin: '0 0 8px 0' }}>
            NTC Campaign Screening Script & QA Standard
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '650px', lineHeight: '1.6' }}>
            Official Naukri Candidate Screening Script for DPR Construction. Contains exact dialogue lines, 13 verification questions, domain certification rules, ₹5 Lakhs joining bonus, and FAQs.
          </p>
        </div>

        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(51, 65, 85, 0.8)', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>NTC Target Score</span>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#10b981', display: 'block', marginTop: '2px' }}>100 Pts</span>
          </div>
        </div>
      </div>

      {/* Tab Controls Bar */}
      <div className="bg-white p-2 rounded-2xl border border-[var(--border-color)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('SCRIPT')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'SCRIPT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>Full NTC Script Text</span>
          </button>

          <button
            onClick={() => setActiveTab('RUBRICS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'RUBRICS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>10 AI Checkpoint Rubrics</span>
          </button>

          <button
            onClick={() => setActiveTab('FAQS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'FAQS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Candidate FAQs (1-22)</span>
          </button>

          <button
            onClick={() => setActiveTab('RED_FLAGS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'RED_FLAGS' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Critical Red Flags</span>
          </button>
        </div>

        <span className="text-xs font-bold text-slate-500 pr-3">
          Campaign: <strong className="text-indigo-600">NTC Screening (DPR Construction)</strong>
        </span>
      </div>

      {/* TAB 1: FULL NTC SCRIPT VERBATIM */}
      {activeTab === 'SCRIPT' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
            
            {/* Section 1: Greeting */}
            <div className="border-b border-slate-100 pb-6">
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block mb-2">Phase 1 · Greeting & Intro</span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-mono text-slate-800 space-y-2">
                <p>“Good morning/Afternoon/Evening! Am I speaking with <strong>[Candidate’s Name]</strong>?”</p>
                <p>“This is <strong>[Your Pseudo Name]</strong>, your Relationship Manager from Naukri.com. I hope you are doing well! Is this a good time to connect?”</p>
              </div>
              <p className="text-[11px] text-rose-600 font-bold mt-2">⚠️ MANDATORY: Maintain professional neutral tone. DO NOT use submissive titles (Sir / Ma'am).</p>
            </div>

            {/* Section 2: Purpose & Disclaimers */}
            <div className="border-b border-slate-100 pb-6">
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block mb-2">Phase 2 · Purpose & Disclaimers</span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-mono text-slate-800 space-y-2">
                <p>“I’m reaching out to inform you about an exciting job opportunity with one of our premium hiring partners – But before we continue, please note:”</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>This call is recorded for training and quality purposes.</li>
                  <li><strong>Naukri.com never asks for any money</strong> to appear for interviews or for job confirmations.</li>
                  <li>We also do not guarantee job offers.</li>
                </ul>
                <p className="pt-2">“Just wanted to confirm — <strong>are you currently open to a job switch or New Job?</strong>”</p>
              </div>
            </div>

            {/* Section 3: Basic Questions */}
            <div className="border-b border-slate-100 pb-6">
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block mb-2">Phase 3 · Basic Screening Questions</span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-mono text-slate-800">
                <p className="font-bold mb-2">If Candidate is Interested, Associate must ask:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>May I know your last/Recent Job Title?</li>
                  <li>May I know your Preferred Job Title?</li>
                  <li>May I know your last/Recent Work Location?</li>
                  <li>May I know your Preferred Work Location? (State or Country)</li>
                </ol>
                <p className="mt-3 font-semibold text-indigo-700">“Great! Based on your profile, I’d like to inform you that DPR Construction has exciting openings that match your experience and preferences.”</p>
              </div>
            </div>

            {/* Section 4: About DPR Construction */}
            <div className="border-b border-slate-100 pb-6">
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block mb-2">Phase 4 · About DPR Construction Pitch</span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-mono text-slate-800 space-y-2">
                <p>“DPR Construction is a multinational engineering company delivering roads, metro, railway, power, mining, manufacturing, and high-rise infrastructure projects worldwide since 1990.”</p>
                <p>“In 2015, DPR Construction expanded its footprint beyond India, collaborating with governments, developers, and private enterprises worldwide to deliver mega-level projects that shape skylines and transform communities.”</p>
                <p>“Their headquarters in USA and offices in Mumbai (India), Paris, Dubai, Tokyo, Australia, and Mexico ensure that they remain close to their clients while managing projects across continents.”</p>
                <p className="text-indigo-600 font-bold pt-1">🌐 Website: www.dprusa.in (Encourage candidate to visit post-call for deeper insight.)</p>
              </div>
            </div>

            {/* Section 5: Verification Questions (13 Qs) */}
            <div className="border-b border-slate-100 pb-6">
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block mb-2">Phase 5 · 13 Eligibility Verification Questions</span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-mono text-slate-800">
                <p className="font-bold mb-2">“Before we proceed, I need to ask you a few quick verification questions:”</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                  <p>1. Total years of experience?</p>
                  <p>2. Are you currently employed?</p>
                  <p>3. Your last organization & work location?</p>
                  <p>4. Key roles & responsibilities in recent role?</p>
                  <p>5. Department/Division you were part of?</p>
                  <p>6. Highest educational qualification?</p>
                  <p>7. Year of graduation?</p>
                  <p>8. Any domain-specific certifications?</p>
                  <p>9. Last drawn monthly in-hand salary?</p>
                  <p>10. Expected in-hand salary from next job?</p>
                  <p>11. Interviewed with DPR Construction in last 6 months?</p>
                  <p>12. Your current age?</p>
                  <p className="col-span-2">13. If selected, how soon can you join?</p>
                </div>
              </div>
            </div>

            {/* Section 6: Benefits & Certifications */}
            <div className="border-b border-slate-100 pb-6">
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block mb-2">Phase 6 · Mandatory Certifications & Benefits</span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-mono text-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <span className="font-bold block text-slate-900 mb-1">Key International Benefits:</span>
                    <p>✓ 100% Salary Hike</p>
                    <p>✓ Employer-Sponsored Work Visa</p>
                    <p>✓ Family Accommodation & Dependent Visa</p>
                    <p>✓ Travel, Relocation & Onsite Benefits</p>
                  </div>
                  <div>
                    <span className="font-bold block text-slate-900 mb-1">Domain Certifications:</span>
                    <p>• Safety: OSHA / NEBOSH / IOSH</p>
                    <p>• Project Management: PMP / Primavera P6 / MSP</p>
                    <p>• Construction Tech: AutoCAD / Revit / BIM</p>
                    <p>• Civil Inspection: QA/QC / ACI / NDT</p>
                  </div>
                </div>
                <p className="text-rose-700 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                  ⚠️ MANDATORY CERTIFICATION NOTE: If candidate does not currently hold these certifications, they are required to enroll in an accredited institution immediately after selection. Failure to submit required certifications will result in cancellation of job offer.
                </p>
              </div>
            </div>

            {/* Section 7: Next Steps & Website Mandate */}
            <div>
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block mb-2">Phase 7 · ₹5 Lakhs Joining Bonus & Website Navigation Mandate</span>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-mono text-slate-800 space-y-2">
                <p>“As part of their selection process, if shortlisted and selected with DPR Construction, you will be eligible for a <strong>Joining Bonus of approximately ₹5,0,000 INR</strong>.”</p>
                <p>“Kindly email your updated resume to <strong>contact@naukriedge.com</strong> or call 8042364767.”</p>
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl font-bold mt-2">
                  📌 MANDATORY SCRIPT END RULE: Associate MUST explicitly instruct the candidate on every call to visit www.dprusa.in to check Project Details, Branch Address, and Leadership Team details before hanging up.
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: 10 CHECKPOINT RUBRICS */}
      {activeTab === 'RUBRICS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>NTC Screening Script Checkpoints</h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>10 checkpoints mapped to point weights — Total: 100 points</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {SCRIPT_CHECKPOINTS.map((cp) => (
                <div key={cp.id} style={{ padding: '18px 20px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '18px' }} className="space-y-3">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                        {cp.id.replace('CP', '')}
                      </span>
                      <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{cp.title}</h4>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: '700' }}>
                      {cp.section} · {cp.weight} pts
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: 0, paddingLeft: '44px' }}>{cp.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>Evaluation Logic</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: 0 }}>
                OpenAI STT (Whisper) transcribes real audio. GPT-4o-mini checks positive coverage of each checkpoint. Deduction is applied if key disclaimers or website redirect are omitted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CANDIDATE FAQS (1-22) */}
      {activeTab === 'FAQS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-base font-extrabold text-slate-900">Official NTC Candidate FAQ Reference (22 Questions)</h3>
            <p className="text-xs text-slate-500 mt-1">Standard responses provided in the PDF for candidate inquiries during screening calls.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {NTC_FAQS.map((faq, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1.5">
                <h4 className="font-extrabold text-xs text-indigo-700">{faq.q}</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RED FLAGS */}
      {activeTab === 'RED_FLAGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-extrabold text-slate-900">NTC Script Red Flag Violations</h3>
            <p className="text-xs text-slate-500 mt-1">Automatic score penalties and critical failure triggers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RED_FLAG_RULES.map((rule) => (
              <div key={rule.code} className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-rose-800 uppercase tracking-wide">{rule.title}</span>
                  <span className="badge badge-danger">Penalty: -{rule.penalty || 20} pts</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
