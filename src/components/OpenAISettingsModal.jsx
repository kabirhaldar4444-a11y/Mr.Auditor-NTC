import React, { useState } from 'react';
import { Key, Check, ShieldCheck, X } from 'lucide-react';

export default function OpenAISettingsModal({ isOpen, onClose, apiKey, setApiKey, useSimulatedAI, setUseSimulatedAI }) {
  const [localKey, setLocalKey] = useState(apiKey || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setApiKey(localKey);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
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
          maxWidth: '480px',
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
        
        {/* Header */}
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
              <Key style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                  ChatGPT AI Engine Config
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '400' }}>
                Configure OpenAI API Key or use built-in evaluation model
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

        <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Mode Toggle */}
          <div 
            style={{
              padding: '16px 18px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Use Built-in Fast AI Engine</span>
              <input
                type="checkbox"
                checked={useSimulatedAI}
                onChange={(e) => setUseSimulatedAI(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
            </label>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0 0', lineHeight: 1.5 }}>
              Runs instant audio transcript analysis against all 10 DPR script rubrics without needing an external API key.
            </p>
          </div>

          {/* OpenAI API Key Input */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              OpenAI API Key (ChatGPT-4o)
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              disabled={useSimulatedAI}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '12px',
                fontFamily: 'monospace',
                backgroundColor: useSimulatedAI ? '#f1f5f9' : '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                color: '#0f172a',
                outline: 'none',
                opacity: useSimulatedAI ? 0.6 : 1
              }}
            />
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 0 0' }}>
              Key is stored locally in browser session memory only. Never transmitted to third-party servers.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
            <button 
              type="submit" 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4338ca'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4f46e5'; }}
            >
              {savedSuccess ? (
                <>
                  <Check style={{ width: '16px', height: '16px' }} />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <>
                  <ShieldCheck style={{ width: '16px', height: '16px' }} />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
