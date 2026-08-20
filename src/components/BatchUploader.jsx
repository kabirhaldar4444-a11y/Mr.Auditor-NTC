import React, { useState } from 'react';
import { UploadCloud, Check, AlertCircle, Sparkles, X, Database } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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
        transcript: null,
        rawFields
      });
    });

    setLoading(false);
    setImportedCount(parsedCalls.length);
    onImportData(parsedCalls);
    setTimeout(() => {
      onClose();
    }, 350);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className="modal-backdrop select-none"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div 
        style={{ 
          maxWidth: '560px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left'
        }}
        className="modal-content"
      >
        
        {/* Modal Header */}
        <div 
          style={{
            padding: '20px 24px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#eef2ff',
                border: '1px solid #e0e7ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Database style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                  Batch Excel / CSV Ingestion
                </h3>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#eef2ff',
                    color: '#4f46e5',
                    border: '1px solid #e0e7ff'
                  }}
                >
                  Telephony
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '400' }}>
                Upload call records with automatic SlashRTC column & audio link mapping
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#334155';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
            title="Close"
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '36px 20px',
              borderRadius: '16px',
              border: isDragging ? '2px dashed #6366f1' : '2px dashed #cbd5e1',
              backgroundColor: isDragging ? '#eef2ff' : '#f8fafc',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
          >
            <div 
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}
            >
              <UploadCloud style={{ width: '28px', height: '28px' }} />
            </div>

            <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
              Drag and drop your spreadsheet here
            </h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px 0', maxWidth: '360px', lineHeight: 1.5 }}>
              Accepts exported call logs from SlashRTC with dynamic column recognition
            </p>
            
            <label 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                border: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4338ca'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4f46e5'; }}
            >
              <UploadCloud style={{ width: '16px', height: '16px' }} />
              <span>Browse Files</span>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files[0] && processFile(e.target.files[0])}
              />
            </label>

            {/* File format pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '600', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #e2e8f0' }}>.CSV</span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '600', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #e2e8f0' }}>.XLSX</span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '600', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #e2e8f0' }}>.XLS</span>
              <span style={{ color: '#cbd5e1', margin: '0 2px' }}>•</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#4f46e5' }}>SlashRTC Telephony Format</span>
            </div>
          </div>

          {/* Loading Spinner */}
          {loading && (
            <div style={{ padding: '14px 16px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '500', color: '#3730a3' }}>
              <Sparkles className="animate-spin" style={{ width: '16px', height: '16px', color: '#4f46e5', flexShrink: 0 }} />
              <span>Parsing spreadsheet rows & mapping SlashRTC recording links...</span>
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div style={{ padding: '14px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '500', color: '#991b1b' }}>
              <AlertCircle style={{ width: '16px', height: '16px', color: '#dc2626', flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success count */}
          {importedCount !== null && (
            <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#166534', fontFamily: 'monospace' }}>
                <Check style={{ width: '16px', height: '16px', color: '#16a34a', flexShrink: 0 }} />
                <span>Successfully ingested {importedCount.toLocaleString()} call records!</span>
              </div>
              <button
                onClick={() => onClose()}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                Proceed &rarr;
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div 
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            Need to test a sample call record?
          </span>
          <button
            onClick={() => {
              onImportData(sampleInitialRow);
              onClose();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#ffffff',
              color: '#4f46e5',
              border: '1px solid #c7d2fe',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#eef2ff';
              e.currentTarget.style.borderColor = '#818cf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#c7d2fe';
            }}
          >
            <Sparkles style={{ width: '14px', height: '14px', color: '#4f46e5' }} />
            <span>Load Sample Record</span>
          </button>
        </div>

      </div>
    </div>
  );
}


