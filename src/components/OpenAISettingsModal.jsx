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
    <div className="modal-backdrop">
      <div className="bg-[var(--bg-card-solid)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-color)] shadow-2xl max-w-md w-full p-6 relative modal-content transition-colors">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-card-subtle)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-base">ChatGPT AI Engine Config</h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">Configure API Key or use built-in evaluation model</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs font-semibold">
          
          {/* Mode Toggle */}
          <div className="p-3 bg-[var(--bg-card-subtle)] border border-[var(--border-color)] rounded-xl transition-colors">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-bold text-[var(--text-primary)]">Use Built-in Fast AI Engine</span>
              <input
                type="checkbox"
                checked={useSimulatedAI}
                onChange={(e) => setUseSimulatedAI(e.target.checked)}
                className="w-4 h-4 text-blue-500 rounded cursor-pointer"
              />
            </label>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed font-medium">
              Runs instant audio transcript analysis against all 10 DPR script rubrics without needing an external API key.
            </p>
          </div>

          {/* OpenAI API Key Input */}
          <div>
            <label className="block text-[var(--text-secondary)] font-bold mb-1.5">OpenAI API Key (ChatGPT-4o)</label>
            <input
              type="password"
              placeholder="sk-..."
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              disabled={useSimulatedAI}
              className="input-field font-mono text-xs bg-[var(--bg-card-solid)] border-[var(--border-color)] text-[var(--text-primary)] disabled:opacity-40 disabled:bg-[var(--bg-card-subtle)]"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed font-medium">
              Key is stored locally in memory only. Never transmitted to third-party servers.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold">
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
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
