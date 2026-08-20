import React, { useState } from 'react';
import { Lock, ShieldCheck, Check, ExternalLink, AlertCircle, X } from 'lucide-react';

export default function SlashRTCModal({ isOpen, onClose, slashRtcActive, setSlashRtcActive }) {
  const [username, setUsername] = useState('SupportEngineer');
  const [password, setPassword] = useState('Enginer#321');
  const [portalUrl, setPortalUrl] = useState('https://aramcoindia.slashrtc.in/index.php/report/dashboardView?1=1');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleConnect = (e) => {
    e.preventDefault();
    setSlashRtcActive(true);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
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
          maxWidth: '520px',
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
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Lock style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                  SlashRTC Session Credentials
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '400' }}>
                Audio recordings require an active SlashRTC portal session
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

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div 
            style={{
              padding: '14px 16px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#92400e'
            }}
          >
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', margin: '0 0 4px 0', color: '#b45309' }}>
              <AlertCircle style={{ width: '15px', height: '15px', flexShrink: 0 }} />
              <span>Browser Playback Protocol Note</span>
            </p>
            <span style={{ color: '#78350f', lineHeight: 1.5 }}>
              SlashRTC audio links are dynamic and require your browser tab to be logged in at <strong style={{ color: '#0f172a' }}>aramcoindia.slashrtc.in</strong>.
            </span>
          </div>

          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                SlashRTC Portal Login URL
              </label>
              <input
                type="text"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Username / ID
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    color: '#0f172a',
                    fontWeight: '600',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px' }}>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '12px',
                  color: '#4f46e5',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none'
                }}
              >
                <span>Open SlashRTC Portal</span>
                <ExternalLink style={{ width: '14px', height: '14px' }} />
              </a>

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
                    <span>Session Connected!</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck style={{ width: '16px', height: '16px' }} />
                    <span>Save Session Proxy</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
