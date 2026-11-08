import React, { useState } from 'react';
import { X, Sliders, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settingsConfig,
  onSaveSettings,
  apiUrl
}) {
  if (!isOpen) return null;

  const [groqModel, setGroqModel] = useState(settingsConfig.groqModel || 'qwen/qwen3.8-27b');
  const [k, setK] = useState(settingsConfig.k || 5);
  const [useHybrid, setUseHybrid] = useState(settingsConfig.useHybrid || false);
  const [comparePlain, setComparePlain] = useState(settingsConfig.comparePlain !== false);
  const [threshold, setThreshold] = useState(settingsConfig.threshold || 0.40);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Free models hosted on Groq
  const groqFreeModels = [
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Free & Fast • Recommended)' },
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Free)' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Lightweight • Free)' },
    { id: 'allam-2-7b', name: 'Allam 2 7B (Free)' }
  ];

  const handleSave = async () => {
    onSaveSettings({
      groqModel,
      k,
      useHybrid,
      comparePlain,
      llmModel: groqModel,
      threshold
    });

    try {
      const payload = {
        groq_model: groqModel,
        similarity_threshold: threshold
      };

      await fetch(`${apiUrl}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (e) {
      console.error(e);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-xl p-5 shadow-xl relative space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Engine Hyperparameters</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Server Security Notice */}
        <div className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-2 text-[11px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>API keys are stored securely on the server (<code className="font-mono">backend/.env</code>)</span>
        </div>

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
        <div className="pt-2 space-y-2.5 border-t border-zinc-100 dark:border-zinc-800 text-xs">
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

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">Side-by-side Plain Comparison</span>
              <p className="text-[10px] text-zinc-500">Generates answers both WITH retrieval and WITHOUT retrieval</p>
            </div>
            <input
              type="checkbox"
              checked={comparePlain}
              onChange={(e) => setComparePlain(e.target.checked)}
              className="w-4 h-4 accent-zinc-900 dark:accent-zinc-100 rounded"
            />
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {savedSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mr-auto font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
