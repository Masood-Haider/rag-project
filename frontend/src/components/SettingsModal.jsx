import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sliders, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settingsConfig,
  onSaveSettings,
  apiUrl,
  isAdmin = false,
  adminPassword = '',
  sessionId = '',
  stats = null,
  onReindexComplete
}) {
  if (!isOpen) return null;

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const [groqModel, setGroqModel] = useState(settingsConfig.groqModel || 'qwen/qwen3.8-27b');
  const [chunkSize, setChunkSize] = useState(settingsConfig.chunkSize || 300);
  const [chunkOverlap, setChunkOverlap] = useState(settingsConfig.chunkOverlap || 50);
  const [k, setK] = useState(settingsConfig.k || 5);
  const [useHybrid, setUseHybrid] = useState(settingsConfig.useHybrid || false);
  const [threshold, setThreshold] = useState(settingsConfig.threshold || 0.40);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Free models hosted on Groq
  const groqFreeModels = [
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Free & Fast • Recommended)' },
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Free)' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Lightweight • Free)' },
    { id: 'allam-2-7b', name: 'Allam 2 7B (Free)' }
  ];

  const handleSave = async () => {
    setIsApplying(true);
    setStatusMessage('Rebuilding vector index...');

    try {
      const payload = {
        groq_model: groqModel,
        similarity_threshold: threshold,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        k,
        session_id: sessionId || null
      };

      const headers = { 'Content-Type': 'application/json' };
      if (isAdmin && adminPassword) {
        headers['x-admin-password'] = adminPassword;
      }
      if (sessionId) {
        headers['x-session-id'] = sessionId;
      }

      const res = await fetch(`${apiUrl}/settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      onSaveSettings({
        groqModel,
        k,
        useHybrid,
        comparePlain: false,
        llmModel: groqModel,
        threshold,
        chunkSize,
        chunkOverlap
      });

      if (onReindexComplete) {
        await onReindexComplete();
      }

      setSavedSuccess(true);
      setStatusMessage(data.message || (isAdmin ? 'Saved permanent server defaults!' : 'Saved for your session!'));
      setTimeout(() => {
        setSavedSuccess(false);
        setIsApplying(false);
        setStatusMessage('');
        onClose();
      }, 900);
    } catch (e) {
      console.error(e);
      setIsApplying(false);
      setStatusMessage('Error updating settings');
      setTimeout(() => setStatusMessage(''), 2500);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-xl p-5 shadow-xl relative space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Engine Hyperparameters</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isApplying}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Admin vs Visitor Mode Banner */}
        {isAdmin ? (
          <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Admin Mode:</span> Changes apply permanently as global defaults and automatically rebuild the central knowledge base index.
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <Sliders className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Visitor Session:</span> Changes apply temporarily to your active session only. Server defaults stay untouched.
            </div>
          </div>
        )}

        {/* Model Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Active Groq Model</label>
          <select
            value={groqModel}
            onChange={(e) => setGroqModel(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
          >
            {groqFreeModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Chunk Size & Overlap */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Chunk Size</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{chunkSize} chars</span>
            </div>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value))}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
            />
            <p className="text-[10px] text-zinc-500">Auto-rebuilds index on save.</p>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Overlap</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{chunkOverlap} chars</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
            />
            <p className="text-[10px] text-zinc-500">Adjacent overlap chars.</p>
          </div>
        </div>

        {/* Top-K Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Top-k Retrieved Chunks</span>
            <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{k}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={k}
            onChange={(e) => setK(parseInt(e.target.value))}
            className="w-full accent-zinc-900 dark:accent-zinc-100"
          />
          <p className="text-[10px] text-zinc-500">Controls how many context chunks are sent to the LLM prompt.</p>
        </div>

        {/* Threshold Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Honest Confidence Threshold</span>
            <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{threshold}</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="0.80"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-zinc-900 dark:accent-zinc-100"
          />
          <p className="text-[10px] text-zinc-500">Retrieval scores below this threshold trigger an out-of-domain alert.</p>
        </div>

        {/* Toggles */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">Hybrid Search</span>
              <p className="text-[10px] text-zinc-500">Combines FAISS dense embeddings with TF-IDF keyword search</p>
            </div>
            <input
              type="checkbox"
              checked={useHybrid}
              onChange={(e) => setUseHybrid(e.target.checked)}
              className="w-4 h-4 accent-zinc-900 dark:accent-zinc-100 rounded"
            />
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs">
            {isApplying && (
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {statusMessage || 'Rebuilding index...'}
              </span>
            )}
            {!isApplying && savedSuccess && (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved & Reindexed!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Rebuilding...</span>
                </>
              ) : (
                <span>Apply Changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
