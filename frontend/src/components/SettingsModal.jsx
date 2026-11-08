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

  // 100% Free models available on your Groq developer tier
  const groqFreeModels = [
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Alibaba Cloud • Free & Fast)' },
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (High Capability • Free)' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Lightweight • Free)' },
    { id: 'allam-2-7b', name: 'Allam 2 7B (Free)' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' }
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
      }, 1000);
    } catch (e) {
      console.error(e);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">RAG Hyperparameters & API Keys</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">LLM Provider</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProvider('groq')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition ${
                provider === 'groq'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Groq (Free Models)</span>
            </button>
            <button
              type="button"
              onClick={() => setProvider('huggingface')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition ${
                provider === 'huggingface'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Hugging Face</span>
            </button>
          </div>
        </div>

        {/* Groq Configuration */}
        {provider === 'groq' && (
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Groq API Key (GROQ_API_KEY)
                </span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  Get free key ↗
                </a>
              </label>
              <input
                type="password"
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                placeholder="Paste gsk_... key from Groq Console"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500">
                You can also set this in <code>backend/.env</code> as <code>GROQ_API_KEY</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Free Groq Model</label>
              <select
                value={groqModel}
                onChange={(e) => setGroqModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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

        {/* Hugging Face Configuration */}
        {provider === 'huggingface' && (
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-blue-400" />
                Hugging Face Token (HF_TOKEN)
              </label>
              <input
                type="password"
                value={hfToken}
                onChange={(e) => setHfToken(e.target.value)}
                placeholder="Paste hf_... token"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">HF Model Name</label>
              <input
                type="text"
                value={hfModel}
                onChange={(e) => setHfModel(e.target.value)}
                placeholder="deepseek-ai/DeepSeek-V3-0324"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Top-K Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-300">Top-k Retrieved Chunks</span>
            <span className="font-mono text-blue-400 font-bold">{k}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={k}
            onChange={(e) => setK(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Similarity Threshold */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-300">Honest Test Threshold</span>
            <span className="font-mono text-blue-400 font-bold">{threshold}</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="0.80"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Toggles */}
        <div className="pt-2 space-y-3 border-t border-slate-800/80">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-slate-200">Hybrid Search</p>
              <p className="text-[11px] text-slate-400">Combine FAISS semantic search with TF-IDF keyword search</p>
            </div>
            <input
              type="checkbox"
              checked={useHybrid}
              onChange={(e) => setUseHybrid(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-slate-200">Side-by-Side Comparison</p>
              <p className="text-[11px] text-slate-400">Generate both WITH RAG and WITHOUT RAG</p>
            </div>
            <input
              type="checkbox"
              checked={comparePlain}
              onChange={(e) => setComparePlain(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 mr-auto">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-md shadow-blue-600/20"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
