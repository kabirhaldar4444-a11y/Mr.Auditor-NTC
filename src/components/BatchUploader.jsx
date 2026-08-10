import React, { useState } from 'react';
import { UploadCloud, Check, AlertCircle, Sparkles, X, Database } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
// generateRealisticHinglishTranscript import removed to keep audits 100% real

export default function BatchUploader({ onImportData, onClose, sampleInitialRow }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [importedCount, setImportedCount] = useState(null);

  const processFile = (file) => {
    setLoading(true);
    setErrorMsg(null);

    const filename = file.name.toLowerCase();
    if (filename.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          handleRawParsedData(results.data);
        },
        error: (err) => {
          setErrorMsg("CSV parse failed: " + err.message);
          setLoading(false);
        }
      });
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          handleRawParsedData(jsonData);
        } catch (err) {
          setErrorMsg("Excel parse failed: " + err.message);
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrorMsg("Please upload a valid .csv, .xlsx, or .xls file.");
      setLoading(false);
    }
  };

  const handleRawParsedData = (rows) => {
    if (!rows || rows.length === 0) {
      setErrorMsg("The uploaded file is empty.");
      setLoading(false);
      return;
    }

    // Identify header row index mappings dynamically!
    const headerRow = rows[0];
    const isHeaderValid = Array.isArray(headerRow) && headerRow.some(col => typeof col === 'string' && (col.includes('DATE') || col.includes('AGENT') || col.includes('RECORDING')));
    
    // Default indexes mapped to AUDITDATA30JUL26 format
    let dateIdx = 0;
    let leadIdIdx = 2;
    let agentFullNameIdx = 4;
    let agentNameIdx = 5;
    let campaignIdx = 7;
    let processIdx = 8;
    let callTimeIdx = 11;
    let talkTimeIdx = 13;
    let holdIdx = 14;
    let disposeIdx = 22;
    let hangupCauseIdx = 23;
    let recordingPathIdx = 28;
    
    // Default candidate indexes
    let candidateNameIdx = 132;
    let candidateEmailIdx = 133;
    let campaignStageIdx = 135;

    if (isHeaderValid) {
      // Find indexes by exact or partial column names dynamically!
      const findHeaderIdx = (names) => {
        return headerRow.findIndex(col => 
          typeof col === 'string' && names.some(n => col.toUpperCase().trim() === n.toUpperCase().trim())
        );
      };

      const dateFound = findHeaderIdx(['DATE-TIME', 'DATE', 'CALL DATE']);
      if (dateFound !== -1) dateIdx = dateFound;

      const leadIdFound = findHeaderIdx(['LEAD ID', 'CALL ID', 'CALLER ID']);
      if (leadIdFound !== -1) leadIdIdx = leadIdFound;

      const agentFullFound = findHeaderIdx(['AGENT FULL NAME', 'AGENT_FULL_NAME', 'FULL NAME']);
      if (agentFullFound !== -1) agentFullNameIdx = agentFullFound;

      const agentNameFound = findHeaderIdx(['AGENT NAME', 'AGENT']);
      if (agentNameFound !== -1) agentNameIdx = agentNameFound;

      const campaignFound = findHeaderIdx(['CAMPAIGN']);
      if (campaignFound !== -1) campaignIdx = campaignFound;

      const processFound = findHeaderIdx(['PROCESS', 'QUEUE']);
      if (processFound !== -1) processIdx = processFound;

      const callTimeFound = findHeaderIdx(['CALL TIME', 'DURATION', 'CALL_TIME']);
      if (callTimeFound !== -1) callTimeIdx = callTimeFound;

      const talkTimeFound = findHeaderIdx(['TALKTIME', 'TALK TIME', 'TALK_TIME']);
      if (talkTimeFound !== -1) talkTimeIdx = talkTimeFound;

      const holdFound = findHeaderIdx(['HOLD', 'HOLD TIME', 'HOLD_TIME']);
      if (holdFound !== -1) holdIdx = holdFound;

      // The actual call category/type is typically the second DISPOSE or custom
      const disposeFound = headerRow.lastIndexOf('DISPOSE');
      if (disposeFound !== -1) disposeIdx = disposeFound;

      const hangupFound = findHeaderIdx(['HANGUP CAUSE', 'DISPOSITION', 'HANGUP_CAUSE']);
      if (hangupFound !== -1) hangupCauseIdx = hangupFound;

      const recordingFound = findHeaderIdx(['RECORDING PATH', 'AUDIO URL', 'RECORDING_PATH', 'AUDIO_URL']);
      if (recordingFound !== -1) recordingPathIdx = recordingFound;

      const nameFound = findHeaderIdx(['NAME', 'CANDIDATENAME', 'CANDIDATE_NAME']);
      if (nameFound !== -1) candidateNameIdx = nameFound;

      const emailFound = findHeaderIdx(['EMAIL', 'CANDIDATEEMAIL', 'CANDIDATE_EMAIL', 'CUSTOMER EMAIL']);
      if (emailFound !== -1) candidateEmailIdx = emailFound;

      const stageFound = findHeaderIdx(['JOBTITLE', 'CAMPAIGNSTAGE', 'STAGE', 'LEADSET NAME']);
      if (stageFound !== -1) campaignStageIdx = stageFound;
    }

    const dataRows = isHeaderValid ? rows.slice(1) : rows;
    const parsedCalls = [];

    dataRows.forEach((row, idx) => {
      if (!row || (Array.isArray(row) && row.length < 5)) return;

      const callId = `CALL-LOG-${idx + 1000}`;
      const isArray = Array.isArray(row);

      const callDate = isArray ? (row[dateIdx] || '07/30/26') : (row['DATE-TIME'] || row['Date'] || '07/30/26');
      const callerId = isArray ? (row[leadIdIdx] || '') : (row['LEAD ID'] || row['Call ID'] || '');
      const agentName = isArray ? (row[agentFullNameIdx] || 'Agent') : (row['AGENT FULL NAME'] || row['Agent'] || 'Agent');
      const agentCode = isArray ? (row[agentNameIdx] || '') : (row['AGENT NAME'] || row['Agent Code'] || '');
      const campaign = isArray ? (row[campaignIdx] || '') : (row['CAMPAIGN'] || '');
      const queue = isArray ? (row[processIdx] || '') : (row['PROCESS'] || '');
      const duration = isArray ? (row[callTimeIdx] || '0:00:00') : (row['CALL TIME'] || row['Duration'] || '0:00:00');
      const talkTime = isArray ? (row[talkTimeIdx] || '0:00:00') : (row['TALKTIME'] || row['Talk Time'] || '0:00:00');
      const holdTime = isArray ? (row[holdIdx] || '0:00:00') : (row['HOLD'] || '0:00:00');
      const callType = isArray ? (row[disposeIdx] || '') : (row['DISPOSE'] || '');
      const disposition = isArray ? (row[hangupCauseIdx] || '') : (row['HANGUP CAUSE'] || '');
      
      let audioUrl = "";
      if (isArray) {
        audioUrl = row[recordingPathIdx] || "";
        if (!audioUrl || !audioUrl.includes('http')) {
          const foundLink = row.find(val => typeof val === 'string' && val.includes('slashrtc.in'));
          if (foundLink) audioUrl = foundLink;
        }
      } else {
        audioUrl = row['RECORDING PATH'] || row['Audio Link'] || "";
      }

      if (audioUrl) {
        audioUrl = String(audioUrl).replace(/^["']|["']$/g, '').trim();
      }

      let candidateName = '';
      let candidateEmail = '';
      let campaignStage = '';
      
      if (isArray) {
        candidateName = row[candidateNameIdx];
        candidateEmail = row[candidateEmailIdx];
        campaignStage = row[campaignStageIdx];
        
        if (!candidateName || candidateName === '--') {
          const altNameIdxs = [132, 83, 39]; // name, Candidate_Name, CandidateName
          for (const altIdx of altNameIdxs) {
            if (row[altIdx] && row[altIdx] !== '--') {
              candidateName = row[altIdx];
              break;
            }
          }
        }
        
        if (!candidateEmail || candidateEmail === '--') {
          const altEmailIdxs = [133, 84, 40]; // email, Candidate_Email, Customer Email
          for (const altIdx of altEmailIdxs) {
            if (row[altIdx] && row[altIdx] !== '--') {
              candidateEmail = row[altIdx];
              break;
            }
          }
        }
        
        if (!campaignStage || campaignStage === '--') {
          const altStageIdxs = [135, 134, 160]; // jobTitle, leadsetName, leadset_name
          for (const altIdx of altStageIdxs) {
            if (row[altIdx] && row[altIdx] !== '--') {
              campaignStage = row[altIdx];
              break;
            }
          }
        }
      } else {
        candidateName = row['name'] || row['CandidateName'] || 'Nataraj';
        candidateEmail = row['email'] || row['CandidateEmail'] || 'natarajgg123@gmail.com';
        campaignStage = row['jobTitle'] || row['leadsetName'] || '';
      }

      if (!candidateName || candidateName === '--') candidateName = 'Nataraj';
      if (!candidateEmail || candidateEmail === '--') candidateEmail = 'natarajgg123@gmail.com';

      // Find candidate details from row dynamically
      const getRowField = (keys) => {
        if (isArray) {
          const idx = headerRow.findIndex(h => keys.some(k => String(h).toLowerCase().includes(k.toLowerCase())));
          return idx !== -1 ? row[idx] : null;
        } else {
          const key = Object.keys(row).find(k => keys.some(s => String(k).toLowerCase().includes(s.toLowerCase())));
          return key ? row[key] : null;
        }
      };

      const details = {
        experience: getRowField(['experience', 'exp', 'years']),
        currentTitle: getRowField(['title', 'role', 'designation', 'jobTitle']),
        location: getRowField(['location', 'city', 'address']),
        expectedSalary: getRowField(['expected', 'salary', 'lpa'])
      };

      // Preload a professional realistic transcript mapped to candidate details
      // Initially, the transcript is empty (not audited yet) to keep it 100% real and prevent fake transcripts
      const transcript = [];

      // Store all raw columns dynamically as strings to prevent React child rendering errors
      const rawFields = {};
      if (isArray) {
        headerRow.forEach((hCol, hIdx) => {
          if (hCol) {
            let val = row[hIdx];
            if (val instanceof Date) {
              val = val.toLocaleString();
            } else if (val && typeof val === 'object') {
              val = JSON.stringify(val);
            }
            rawFields[hCol] = val !== undefined ? String(val) : '';
          }
        });
      } else {
        Object.keys(row).forEach(key => {
          let val = row[key];
          if (val instanceof Date) {
            val = val.toLocaleString();
          } else if (val && typeof val === 'object') {
              val = JSON.stringify(val);
          }
          rawFields[key] = val !== undefined ? String(val) : '';
        });
      }

      parsedCalls.push({
        id: callId,
        callDate,
        callerId,
        agentName,
        agentCode,
        campaign,
        queue,
        duration,
        talkTime,
        holdTime,
        callType,
        disposition,
        candidateName,
        candidateEmail,
        campaignStage,
        audioUrl,
        audioStatus: "ACTIVE_SLASH_LINK",
        status: "Pending AI Audit",
        overallScore: null,
        complianceStatus: "Pending",
        hasRedFlags: false,
        redFlagsCount: 0,
        redFlags: [],
        transcript,
        rawFields
      });
    });

    setLoading(false);
    setImportedCount(parsedCalls.length);
    setTimeout(() => {
      onImportData(parsedCalls);
    }, 400);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="bg-[var(--bg-card-solid)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-xl w-full p-6 relative modal-content transition-colors">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-card-subtle)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-lg">Batch Excel/CSV Ingestion</h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">Supports 50,000 to 60,000 input rows with automatic column mapping</p>
          </div>
        </div>

        {/* Drag & Drop Box */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10 shadow-inner'
              : 'border-[var(--border-color)] hover:border-[var(--border-hover)] bg-[var(--bg-card-subtle)]/40 hover:bg-[var(--bg-card-subtle)]/60'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-[var(--bg-card-solid)] border border-[var(--border-color)] shadow-2xs text-blue-500 flex items-center justify-center mx-auto mb-3 transition-transform duration-300 hover:scale-105">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-[var(--text-primary)] text-sm">Drag and drop your Excel or CSV dataset here</h4>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-snug font-medium">Supports .XLSX, .XLS, or .CSV formatted reports from SlashRTC</p>
          
          <label className="mt-4 inline-flex btn-primary text-xs py-2 px-4 cursor-pointer">
            <span>Browse Files</span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              className="hidden"
              onChange={(e) => e.target.files[0] && processFile(e.target.files[0])}
            />
          </label>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="mt-4 p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
            <Sparkles className="w-4 h-4 animate-spin shrink-0" />
            <span>Parsing 50,000+ data rows & mapping SlashRTC recording links...</span>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 animate-bounce" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success count */}
        {importedCount !== null && (
          <div className="mt-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Successfully imported {importedCount.toLocaleString()} call records into AI Audit Pipeline!</span>
          </div>
        )}

        {/* Quick sample loader footer */}
        <div className="mt-6 pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)] font-medium">Need to test sample SlashRTC row?</span>
          <button
            onClick={() => {
              onImportData(sampleInitialRow);
              onClose();
            }}
            className="btn-secondary text-xs py-1.5 px-3 border-blue-500/20 text-blue-600 hover:bg-blue-500/10 font-bold transition-all duration-200"
          >
            Load User Sample Row
          </button>
        </div>

      </div>
    </div>
  );
}
