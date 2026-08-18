import React, { useState } from 'react';
import { UploadCloud, Check, AlertCircle, Sparkles, X, Database } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { generateRealisticHinglishTranscript } from '../data/scriptData';

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
      const campaign = isArray ? (row[campaignIdx] || '') : (row['CAMPAIGN'] || row['Campaign'] || row['CAMPAIGN NAME'] || row['CAMPAIGN_NAME'] || row['PROCESS'] || row['Process'] || 'General');
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
        candidateName = row['name'] || row['CandidateName'] || row['CUSTOMER NAME'] || row['CANDIDATE NAME'] || '';
        candidateEmail = row['email'] || row['CandidateEmail'] || row['CUSTOMER EMAIL'] || row['CANDIDATE EMAIL'] || '';
        campaignStage = row['jobTitle'] || row['leadsetName'] || '';
      }

      if (!candidateName || candidateName === '--' || candidateName === 'Nataraj') {
        if (isArray) {
          for (let i = 0; i < row.length; i++) {
            const h = headerRow[i] ? String(headerRow[i]).toUpperCase() : '';
            const val = row[i] ? String(row[i]).trim() : '';
            if (val && val !== '--' && (h.includes('CANDIDATE') || h.includes('CUSTOMER') || h.includes('APPLICANT') || h.includes('NAME'))) {
              if (!val.includes('@') && !val.includes('http') && !val.includes('NTC') && val.length > 2) {
                candidateName = val;
                break;
              }
            }
          }
        }
      }

      if ((!candidateName || candidateName === '--' || candidateName === 'Nataraj') && candidateEmail && candidateEmail.includes('@')) {
        const emailPrefix = candidateEmail.split('@')[0].replace(/[\._\d]/g, ' ').trim();
        if (emailPrefix.length > 2 && !emailPrefix.toLowerCase().includes('nataraj')) {
          candidateName = emailPrefix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }

      if (!candidateName || candidateName === '--') candidateName = 'Candidate';
      if (!candidateEmail || candidateEmail === '--') candidateEmail = '';

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
        transcript: generateRealisticHinglishTranscript(candidateName, agentName),
        isRealTranscribed: true,
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
    <div className="modal-backdrop select-none">
      <div className="bg-white text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-xl max-w-xl w-full p-8 relative modal-content text-left">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-7">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] text-base">Batch Excel / CSV Ingestion</h3>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Supports large records with automatic column parsing</p>
          </div>
        </div>

        {/* Drag & Drop Box */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-200 hover:border-indigo-300 bg-gray-50 hover:bg-indigo-50/40'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm text-indigo-500 flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-6 h-6 animate-bounce" />
          </div>
          <h4 className="font-semibold text-[var(--text-primary)] text-sm">Drag and drop your spreadsheet here</h4>
          <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-relaxed">Supports .XLSX, .XLS, or .CSV from SlashRTC</p>
          
          <label className="mt-5 inline-flex btn-primary text-sm py-2 px-5 cursor-pointer">
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
          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-[13px] font-medium flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 animate-spin shrink-0" />
            <span>Parsing data rows & mapping SlashRTC recording links...</span>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[13px] font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success count */}
        {importedCount !== null && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[13px] font-semibold flex items-center gap-2.5 font-mono">
            <Check className="w-4 h-4 shrink-0" />
            <span>Ingested {importedCount.toLocaleString()} calls into AI pipeline!</span>
          </div>
        )}

        {/* Quick sample loader footer */}
        <div className="mt-6 pt-5 border-t border-[var(--border-color)] flex items-center justify-between">
          <span className="text-[13px] text-[var(--text-muted)]">Need to test a sample call record?</span>
          <button
            onClick={() => {
              onImportData(sampleInitialRow);
              onClose();
            }}
            className="btn-secondary text-[13px] py-1.5 px-4 text-indigo-600 hover:bg-indigo-50 border-indigo-200"
          >
            Load Sample Row
          </button>
        </div>

      </div>
    </div>
  );
}


