// DPR Construction Telephonic Screening Script Checkpoints & AI Evaluation Criteria
// Strictly matching the Naukri Candidate Screening Script for DPR Construction

export const SCRIPT_CHECKPOINTS = [
  {
    id: "CP1",
    title: "Greeting & Candidate Confirmation",
    section: "Greeting",
    required: true,
    weight: 10,
    description: "Greet candidate (Morning/Afternoon/Evening), confirm name, introduce self as Relationship Manager from Naukri.com, and check if it is a good time to connect. Maintain a neutral tone & AVOID 'Sir/Ma'am'.",
    standardPhrases: ["Good morning", "Good afternoon", "Good evening", "Am I speaking with", "Relationship Manager from Naukri.com", "good time to connect"],
    prohibitedPhrases: ["Sir", "Ma'am", "Madam"]
  },
  {
    id: "CP2",
    title: "Purpose of Call & Disclaimers",
    section: "Purpose",
    required: true,
    weight: 10,
    description: "State the purpose of the call (exciting job opportunity with premium hiring partner). Note call recording, disclaimer that Naukri never asks for money, and no guarantee of job offers.",
    standardPhrases: ["job opportunity", "premium hiring partners", "recorded for training", "never asks for any money", "do not guarantee job offers"]
  },
  {
    id: "CP3",
    title: "Job Switch Confirmation & Basic Questions",
    section: "Basic Screening",
    required: true,
    weight: 10,
    description: "Confirm if candidate is currently open to a job switch or new job. If interested, ask four basic questions: recent job title, preferred job title, recent work location, and preferred work location.",
    standardPhrases: ["open to a job switch", "new job", "recent job title", "preferred job title", "recent work location", "preferred work location"]
  },
  {
    id: "CP4",
    title: "DPR Construction Overview",
    section: "About DPR",
    required: true,
    weight: 10,
    description: "Give a quick overview of DPR Construction: multinational engineering company since 1990, expanded beyond India in 2015, US HQ, offices in Mumbai BKC, Paris, Dubai, etc. Encourage visiting www.dprusa.in post-call.",
    standardPhrases: ["DPR Construction", "multinational engineering company", "since 1990", "expanded its footprint", "headquarters in USA", "Mumbai", "dprusa.in"]
  },
  {
    id: "CP5",
    title: "Applied / Current Status Cases",
    section: "Cases",
    required: false,
    weight: 5,
    description: "Address applicant status: Case 1 (if candidate applied earlier, new openings released under fresh cycles, eligible to reapply without cost) or Case 2 (if currently working or not interested, consider for future assignments).",
    standardPhrases: ["applied earlier", "reapply without any cost", "industry leader", "future assignments"]
  },
  {
    id: "CP6",
    title: "Eligibility Verification Questions",
    section: "Eligibility Qs",
    required: true,
    weight: 15,
    description: "Ask the 13 verification questions (experience, current employment, last org, roles, department, qualification, graduation year, certifications, current salary, expected salary, previous interview, age, joining timeline) and state response logging.",
    standardPhrases: ["verification questions", "years of experience", "currently employed", "last organization", "roles and responsibilities", "qualification", "in-hand salary", "how soon can you join"]
  },
  {
    id: "CP7",
    title: "Domestic vs International Opportunities",
    section: "Opportunities",
    required: true,
    weight: 10,
    description: "Ask preference for domestic projects in India or openness to international roles, listing countries like USA, Australia, Singapore, Malaysia, Dubai/UAE, Saudi Arabia, etc.",
    standardPhrases: ["domestic projects in India", "open to international roles", "currently hiring for major international", "Singapore", "Australia", "UAE", "Saudi Arabia"]
  },
  {
    id: "CP8",
    title: "Key Benefits & Mandatory Certifications",
    section: "Benefits & PC",
    required: true,
    weight: 10,
    description: "State Key International Benefits (100% salary hike, visa, accommodation, travel, insurance). Explain mandatory certifications note (OSHA, PMP, Primavera, AutoCAD, QA/QC) and the immediate enrolment warning.",
    standardPhrases: ["100% Salary Hike", "work visa", "accommodation", "professional certifications", "OSHA", "PMP", "Primavera P6", "enrol in", "cancellation of your job offer"]
  },
  {
    id: "CP9",
    title: "Shortlist Next Steps & Joining Bonus",
    section: "Incentives & Next",
    required: true,
    weight: 10,
    description: "State profile submission, response in 2-3 business days, resume submission to contact@naukriedge.com, contact number 8042364767. Pitch joining bonus of approximately ₹5,0,000 INR.",
    standardPhrases: ["submitted to the DPR Construction", "2-3 business days", "naukriedge.com", "8042364767", "joining bonus", "5,0,000 INR"]
  },
  {
    id: "CP10",
    title: "Closing & Mandatory Website Visit",
    section: "Closing",
    required: true,
    weight: 10,
    description: "Provide polite final note and clearly instruct candidate to visit the official website www.dprusa.in to review Project Details, Branch Address, and Leadership Team details.",
    standardPhrases: ["great speaking with you", "thank you for your time", "wishing you all the best", "visit the website", "www.dprusa.in", "project details", "branch address", "leadership team"]
  }
];

export const RED_FLAG_RULES = [
  {
    code: "RF_FAKE_CERT_SELLING",
    severity: "CRITICAL",
    title: "Fake Certification / Paid Naukri Certificate Purchase",
    description: "Agent inappropriately advised candidate to pay or purchase unverified certificates from Naukri without exams or training (Script Violation / Scam Warning).",
    penalty: 50
  },
  {
    code: "RF_UNAUTHORIZED_FEE",
    severity: "CRITICAL",
    title: "Demand of Upfront Fee or Processing Charges",
    description: "Agent requested money, deposit, or registration fees before interview or joining.",
    penalty: 100
  },
  {
    code: "RF_MISSING_WEBSITE_REDIRECT",
    severity: "HIGH",
    title: "Failure to Instruct Candidate to Visit www.dprusa.in",
    description: "Script mandate: Associate MUST instruct candidate on every call to visit www.dprusa.in for branch address, project details, and leadership team details.",
    penalty: 15
  },
  {
    code: "RF_USED_SIR_MAAM",
    severity: "MEDIUM",
    title: "Used Submissive/Over-formal Titles (Sir/Ma'am)",
    description: "Agent used 'Sir' or 'Ma'am' instead of maintaining a neutral, professional HR persona.",
    penalty: 5
  }
];

// Must be defined BEFORE SAMPLE_INITIAL_DATA which calls it
export const generateRealisticHinglishTranscript = (candidateName, agentName, details = {}) => {
  const exp = details.experience || "8 years";
  const curTitle = details.currentTitle || "Planning Engineer";
  const location = details.location || "Mumbai";
  const expectedSalary = details.expectedSalary || "12 LPA";

  return [
    { speaker: "Agent", time: "00:02", text: `Good morning! Am I speaking with ${candidateName}?` },
    { speaker: "Candidate", time: "00:07", text: `Haan ji, main ${candidateName} baat kar raha hoon. Aap kaun?` },
    { speaker: "Agent", time: "00:10", text: `Hi ${candidateName}, main ${agentName || 'Vikalp'} baat kar raha hoon Naukri.com se, as your Relationship Manager. I hope you are doing well! Is this a good time to connect?` },
    { speaker: "Candidate", time: "00:18", text: `Haan, abhi main free hoon. Bataiye kya baat hai?` },
    { speaker: "Agent", time: "00:22", text: `Main aapko ek exciting job opportunity ke baare mein batane ke liye call kar raha hoon with one of our premium hiring partners. Please note ki yeh call training aur quality purposes ke liye record kiya ja raha hai. Dhyan rakhiyega ki Naukri.com kabhi bhi interview ya job confirmation ke liye koi paise nahi maangta, aur hum job offer ki guarantee nahi dete.` },
    { speaker: "Candidate", time: "00:41", text: `Theek hai, information ke liye dhanyawad.` },
    { speaker: "Agent", time: "00:46", text: `Just wanted to confirm — are you currently open to a job switch or New Job? Aur aapka current or last Job Title aur location kya hai?` },
    { speaker: "Candidate", time: "00:52", text: `Haan, main job change dekh raha hoon. Abhi main ${curTitle} hoon ${location} mein.` },
    { speaker: "Agent", time: "01:21", text: `Bahut achha. Yeh profile DPR Construction ke liye hai. DPR Construction ek multinational engineering company hai jo roads, metro, railway, aur high-rise infrastructure projects delivers karti hai worldwide since 1990. Inki headquarter USA mein hai, aur Mumbai BKC, Paris, Dubai, Tokyo, Australia, Mexico mein offices hain. Inki official website www.dprusa.in hai.` },
    { speaker: "Candidate", time: "01:45", text: `Accha, company toh badi lag rahi hai. Verification ke liye aapko kya details chahiye?` },
    { speaker: "Agent", time: "02:15", text: `Aage badhne se pehle, main aapse kuch quick verification questions poochna chahta hoon. Aapka total years of experience kitna hai? Aur expected salary kitni hai?` },
    { speaker: "Candidate", time: "02:35", text: `Mera total experience ${exp} hai, aur expected salary ${expectedSalary} hai. Aur main notice period ke baad join kar sakta hoon.` },
    { speaker: "Agent", time: "02:58", text: `Theek hai, main yeh details system mein log kar raha hoon. Humare paas projects domestic locations jaise Mumbai, Pune aur international sites jaise Dubai aur Tokyo ke liye openings hain.` },
    { speaker: "Candidate", time: "03:15", text: `International ke liye main open hoon. Aur koi benefits ya requirements?` },
    { speaker: "Agent", time: "03:22", text: `Yes! Benefits mein aapko PF, medical insurance, relocation support aur bonus milega. Lekin dhyan rakhiyega ki technical standards ke liye certifications jaise PMP, AutoCAD, Primavera P6, or Revit mandatory hain. Agar aapke paas nahi hain, toh selection ke baad aapko immediately enroll karna hoga, nahi toh job offer cancel ho sakta hai.` },
    { speaker: "Candidate", time: "03:52", text: `Mere paas certifications hain, main submit kar dunga.` },
    { speaker: "Agent", time: "03:58", text: `Perfect! Selected candidates ko 10% sign-on joining bonus bhi milega agar 30 days mein join karte hain. Aur please make sure ki aap www.dprusa.in website par jaakar project details aur branch address zaroor check karein.` },
    { speaker: "Candidate", time: "04:30", text: `Sure, main check kar lunga. Thank you.` },
    { speaker: "Agent", time: "04:38", text: `Dhanyawad, wish you all the best! Have a great day!` },
    { speaker: "Candidate", time: "04:44", text: `Thank you, goodbye!` }
  ];
};

const candidateNames = [
  "Nataraj Krishnan", "Rohan Verma", "Priya Sharma", "Ajay Verma", "Vikramaditya Rao",
  "Sneha Kulkarni", "Arjun Mehta", "Kavita Reddy", "Rajesh Gupta", "Meera Iyer",
  "Siddharth Joshi", "Neha Malhotra", "Suresh Nair", "Pooja Deshmukh", "Alok Tripathi",
  "Deepa Choudhury", "Manoj Saxena", "Swati Pillai", "Varun Bhatia", "Ritu Sen",
  "Ishaan Kapoor", "Sunita Mishra", "Deepak Prasad", "Anjali Shetty", "Harish Chandra",
  "Divya Sundaram", "Rohit Agarwal", "Simran Kaur", "Pankaj Yadav", "Tarun Das",
  "Nisha Menon", "Vivek Nambiar", "Archana Hegde", "Gaurav Panday", "Shweta Rastogi",
  "Naveen Kumar", "Monali Ghosh", "Kirti Singhania", "Sandeep Bose", "Preeti Solanki",
  "Yashwardhan Jha", "Vandana Bajaj", "Nitin Roy", "Smita Biswas", "Abhinav Kaushik",
  "Shruti Patwardhan", "Himanshu Tyagi", "Tanvi Mahajan", "Rameshwar Naik", "Bhavna Parekh"
];

const agentNames = ["Naukri Vikalp", "Ananya Sharma", "Rahul Verma", "Priya Singh", "Amit Kumar"];

export const SAMPLE_INITIAL_DATA = candidateNames.map((name, i) => {
  const numStr = String(i + 1).padStart(3, '0');
  const agent = agentNames[i % agentNames.length];
  const isFailed = (i % 7 === 1);
  const isAudited = (i % 2 === 0);
  
  return {
    id: `CALL-2026-0807-${numStr}`,
    callDate: `08/07/26 ${17 - Math.floor(i / 4)}:${Math.abs(55 - (i * 7) % 60).toString().padStart(2, '0')}`,
    callerId: `${2498500 + i}`,
    agentName: agent,
    agentCode: agent.split(' ')[0].toUpperCase() + '01',
    campaign: "Naukri Screening",
    queue: "DPRScreening1",
    duration: `0:0${3 + (i % 3)}:${(15 + (i * 9) % 45).toString().padStart(2, '0')}`,
    talkTime: `0:0${3 + (i % 3)}:${(10 + (i * 9) % 45).toString().padStart(2, '0')}`,
    holdTime: "0:00:05",
    callType: "Candidate Screening / Job Pitch",
    disposition: isFailed ? "COMPLIANCE_FAILED" : "INTERESTED_AUDITED",
    candidateName: name,
    candidateEmail: `${name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
    campaignStage: isFailed ? "Failed_Review" : "Initial_Screening_Pass",
    audioUrl: `https://aramcoindia.slashrtc.in/index.php/download/generateLink/recording/dpr-call-${numStr}/play/${9964757500 + i}/2026-08-07/out/false`,
    audioStatus: "ACTIVE_SLASH_LINK",
    status: isAudited ? "Audited" : "Pending",
    overallScore: isAudited ? (isFailed ? 45 : 95 + (i % 6)) : 0,
    complianceStatus: isAudited ? (isFailed ? "Critical Fail" : "Passed") : "Pending",
    hasRedFlags: isAudited && isFailed,
    redFlagsCount: isAudited && isFailed ? 1 : 0,
    redFlags: isAudited && isFailed ? [
      {
        code: "RF_USED_SIR_MAAM",
        severity: "MEDIUM",
        title: "Used Formal Title (Sir/Ma'am)",
        snippet: "Agent addressed candidate as 'Sir' during call introduction."
      }
    ] : [],
    transcript: generateRealisticHinglishTranscript(name, agent, {
      experience: `${5 + (i % 8)} years`,
      currentTitle: i % 2 === 0 ? "Planning Engineer" : "Safety Officer",
      location: i % 3 === 0 ? "Mumbai" : "Pune",
      expectedSalary: `${8 + (i % 6)} LPA`
    }),
    evaluation: isAudited ? {
      greetingPassed: !isFailed,
      hrIntroPassed: true,
      eligibilityPassed: true,
      companyOverviewPassed: true,
      screeningQuestionsPassed: true,
      globalPitchPassed: true,
      behavioralPassed: true,
      certificationsPassed: true,
      joiningBonusPassed: true,
      websiteRedirectPassed: true,
      feedback: isFailed ? "Used formal title Sir/Ma'am." : "Excellent compliance. All checkpoints verified."
    } : null
  };
});


export const PDF_SCRIPT_LINES = [
  {
    id: "PL1",
    evalKey: "greetingPassed",
    title: "CP1: Greeting & Candidate Name Verification",
    summary: "Greet candidate, confirm full name, introduce as Relationship Manager from Naukri.com, and check if good time to connect. AVOID 'Sir/Ma'am'.",
    instruction: "Avoid 'Sir/Ma'am' honorifics.",
    keywords: ["speaking with", "relationship manager", "naukri.com", "time to connect", "baat", "samay", "sahi time", "naukri"],
    prohibited: ["sir", "ma'am", "madam"],
    section: "Greeting"
  },
  {
    id: "PL2",
    evalKey: "hrIntroPassed",
    title: "CP2: Call Purpose & Disclaimers Disclosure",
    summary: "State job opportunity purpose, disclose call recording, state Naukri never requests fees, and disclaim job offer guarantee.",
    instruction: "Disclose recording & no upfront fee rule.",
    keywords: ["opportunity", "recorded", "never asks", "money", "guarantee job", "avsar", "mauka", "record", "paise", "rupay", "guarantee"],
    section: "Purpose"
  },
  {
    id: "PL3",
    evalKey: "eligibilityPassed",
    title: "CP3: Job Switch & Role Confirmation",
    summary: "Confirm job search status, ask recent & preferred job titles and work locations.",
    instruction: "Capture recent and preferred job title.",
    keywords: ["job switch", "new job", "job title", "work location", "naukri badalna", "job change", "location", "position"],
    section: "Basic Screening"
  },
  {
    id: "PL4",
    evalKey: "companyOverviewPassed",
    title: "CP4: DPR Construction Overview Pitch",
    summary: "Pitch DPR Construction as multinational engineering firm (est. 1990), US HQ, Mumbai BKC office, and encourage visiting www.dprusa.in.",
    instruction: "Mention est. 1990, US HQ & BKC office.",
    keywords: ["dpr construction", "multinational", "since 1990", "dprusa.in"],
    section: "About DPR"
  },
  {
    id: "PL5",
    evalKey: "screeningQuestionsPassed",
    title: "CP5: Applicant Status & Cases Resolution",
    summary: "Address applicant cases (Case 1: re-apply under fresh cycle without cost / Case 2: pooled for future assignments).",
    instruction: "Clarify no-cost reapplication under new cycle.",
    keywords: ["applied earlier", "reapply", "industry leader", "future assignments", "apply kiya", "pehle apply"],
    section: "Cases"
  },
  {
    id: "PL6",
    evalKey: "globalPitchPassed",
    title: "CP6: Profile Verification Qs (13 Points)",
    summary: "Ask 13 verification questions: experience, employment status, last org, department, education, certifications, salary, notice period.",
    instruction: "Log all 13 verification responses.",
    keywords: ["verification questions", "years of experience", "currently employed", "graduation", "in-hand salary", "how soon", "sawal", "anubhav", "experience", "salary", "join"],
    section: "Eligibility Qs"
  },
  {
    id: "PL7",
    evalKey: "behavioralPassed",
    title: "CP7: Domestic vs International Roles Pitch",
    summary: "Check preference for domestic projects (India) vs international projects (USA, Australia, Singapore, Dubai, Saudi Arabia, etc.).",
    instruction: "Present domestic & global site options.",
    keywords: ["domestic projects", "international roles", "hiring for major international", "open to international", "domestic", "international", "bharat", "desh", "videsh", "singapore", "dubai", "australia"],
    section: "Opportunities"
  },
  {
    id: "PL8",
    evalKey: "certificationsPassed",
    title: "CP8: Benefits & Mandatory Certifications",
    summary: "State international perks (100% salary hike, visa, accommodation) & explain mandatory professional certifications (OSHA, PMP, Primavera) enrolment rule.",
    instruction: "Explain mandatory certification enrolment.",
    keywords: ["salary hike", "work visa", "certification", "osha", "pmp", "primavera", "enrol", "cancellation", "visa", "radd"],
    section: "Benefits & PC"
  },
  {
    id: "PL9",
    evalKey: "joiningBonusPassed",
    title: "CP9: Submission Steps & ₹5 Lakhs Joining Bonus",
    summary: "Explain profile submission, resume email to contact@naukriedge.com, contact desk 8042364767, and ₹5,0,000 INR joining bonus.",
    instruction: "Detail resume email & ₹5 Lakhs joining bonus.",
    keywords: ["submitted to the dpr", "2-3 business days", "naukriedge.com", "joining bonus", "5,0,000", "5 lakhs", "submit", "bonus", "5 lakh", "lakh"],
    section: "Incentives & Next"
  },
  {
    id: "PL10",
    evalKey: "websiteRedirectPassed",
    title: "CP10: Closing & Mandatory Website Redirect",
    summary: "Provide polite sign-off & explicitly instruct candidate to visit www.dprusa.in for branch address, project details & leadership team.",
    instruction: "Mandatory instruction to visit www.dprusa.in.",
    keywords: ["great speaking", "best in your journey", "visit the website", "dprusa.in", "project details", "branch address", "leadership team", "dhanyawad", "baat karke accha", "website", "leadership"],
    section: "Closing"
  }
];
