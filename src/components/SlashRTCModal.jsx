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
    <div className="modal-backdrop">
      <div className="bg-[var(--bg-card-solid)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-lg w-full p-6 relative modal-content transition-colors">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-card-subtle)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-base">SlashRTC Session Credentials</h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">Audio recordings require an active SlashRTC portal tab session</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-[var(--text-secondary)] font-medium mb-5">
          <p className="flex items-center gap-1.5 font-bold text-amber-600 mb-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Browser Playback Protocol Note</span>
          </p>
          <span className="leading-relaxed">SlashRTC audio links are dynamic and require your browser tab to be logged in at <strong className="text-[var(--text-primary)]">aramcoindia.slashrtc.in</strong>.</span>
        </div>

        <form onSubmit={handleConnect} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-[var(--text-secondary)] font-bold mb-1.5">SlashRTC Portal Login URL</label>
            <input
              type="text"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              className="input-field font-mono text-[11px] bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-secondary)] font-bold mb-1.5">Username / ID</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field font-bold bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-bold mb-1.5">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field font-mono bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1"
            >
              <span>Open SlashRTC Login Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold">
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Session Connected!</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save Session Proxy</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
