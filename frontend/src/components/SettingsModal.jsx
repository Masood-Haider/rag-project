import React, { useState } from 'react';
import { X, Key, Sliders, CheckCircle2, Zap } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settingsConfig,
  onSaveSettings,
  apiUrl
}) {
  if (!isOpen) return null;

  const [provider, setProvider] = useState(settingsConfig.llmProvider || 'groq');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqModel, setGroqModel] = useState(settingsConfig.groqModel || 'qwen/qwen3.8-27b');
  const [hfToken, setHfToken] = useState('');
  const [hfModel, setHfModel] = useState(settingsConfig.llmModel || 'deepseek-ai/DeepSeek-V3-0324');
  const [k, setK] = useState(settingsConfig.k || 5);
  const [useHybrid, setUseHybrid] = useState(settingsConfig.useHybrid || false);
  const [comparePlain, setComparePlain] = useState(settingsConfig.comparePlain !== false);
  const [threshold, setThreshold] = useState(settingsConfig.threshold || 0.40);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const groqFreeModels = [
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Free & Fast • Recommended)' },
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Free)' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Lightweight • Free)' },
    { id: 'allam-2-7b', name: 'Allam 2 7B (Free)' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' }
  ];

  const handleSave = async () => {
    onSaveSettings({
      llmProvider: provider,
      groqModel,
      k,
      useHybrid,
      comparePlain,
      llmModel: provider === 'groq' ? groqModel : hfModel,
      threshold
    });

    try {
      const payload = {
        llm_provider: provider,
        groq_model: groqModel,
        similarity_threshold: threshold,
        llm_model: hfModel
      };
      if (groqApiKey.trim()) {
        payload.groq_api_key = groqApiKey.trim();
      }
      if (hfToken.trim()) {
        payload.hf_token = hfToken.trim();
      }

      await fetch(`${apiUrl}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 800);
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
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Engine Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Inference Provider</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProvider('groq')}
              className={`p-2 rounded-lg border text-xs font-medium transition ${
                provider === 'groq'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Groq (Free Tier)
            </button>
            <button
              type="button"
              onClick={() => setProvider('huggingface')}
              className={`p-2 rounded-lg border text-xs font-medium transition ${
                provider === 'huggingface'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Hugging Face
            </button>
          </div>
        </div>

        {/* Groq Settings */}
        {provider === 'groq' && (
          <div className="space-y-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-zinc-700 dark:text-zinc-300">Groq API Key</label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
                >
                  Get free key ↗
                </a>
              </div>
              <input
                type="password"
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Model</label>
              <select
                value={groqModel}
                onChange={(e) => setGroqModel(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              >
                {groqFreeModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Hugging Face Settings */}
        {provider === 'huggingface' && (
          <div className="space-y-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">HF Access Token</label>
              <input
                type="password"
                value={hfToken}
                onChange={(e) => setHfToken(e.target.value)}
                placeholder="hf_..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Model Name</label>
              <input
                type="text"
                value={hfModel}
                onChange={(e) => setHfModel(e.target.value)}
                placeholder="deepseek-ai/DeepSeek-V3-0324"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>
        )}

        {/* Top-K Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Top-k Chunks</span>
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
        </div>

        {/* Toggles */}
        <div className="pt-2 space-y-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-zinc-700 dark:text-zinc-300">Hybrid Search (TF-IDF + FAISS)</span>
            <input
              type="checkbox"
              checked={useHybrid}
              onChange={(e) => setUseHybrid(e.target.checked)}
              className="w-4 h-4 accent-zinc-900 dark:accent-zinc-100 rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-zinc-700 dark:text-zinc-300">Side-by-side Plain Comparison</span>
            <input
              type="checkbox"
              checked={comparePlain}
              onChange={(e) => setComparePlain(e.target.checked)}
              className="w-4 h-4 accent-zinc-900 dark:accent-zinc-100 rounded"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {savedSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mr-auto">
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
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
