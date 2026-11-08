import React, { useState } from 'react';
import { X, Key, Sliders, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settingsConfig,
  onSaveSettings,
  apiUrl
}) {
  if (!isOpen) return null;

  const [hfToken, setHfToken] = useState('');
  const [k, setK] = useState(settingsConfig.k || 5);
  const [useHybrid, setUseHybrid] = useState(settingsConfig.useHybrid || false);
  const [comparePlain, setComparePlain] = useState(settingsConfig.comparePlain !== false);
  const [llmModel, setLlmModel] = useState(settingsConfig.llmModel || 'deepseek-ai/DeepSeek-V3-0324');
  const [threshold, setThreshold] = useState(settingsConfig.threshold || 0.40);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableModels = [
    { id: 'deepseek-ai/DeepSeek-V3-0324', name: 'DeepSeek-V3-0324 (Course Default)' },
    { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', name: 'DeepSeek R1 Distill Qwen' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct' },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B Instruct' }
  ];

  const handleSave = async () => {
    // Save to local parent state
    onSaveSettings({
      k,
      useHybrid,
      comparePlain,
      llmModel,
      threshold
    });

    // If HF token was entered or threshold changed, post to backend
    try {
      const payload = {
        similarity_threshold: threshold,
        llm_model: llmModel
      };
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
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">RAG Hyperparameters & Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hugging Face Token */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-blue-400" />
            Hugging Face Access Token (HF_TOKEN)
          </label>
          <input
            type="password"
            value={hfToken}
            onChange={(e) => setHfToken(e.target.value)}
            placeholder="Paste hf_... token to enable live DeepSeek API"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <p className="text-[11px] text-slate-400">
            Never committed to Git. Saved securely into the running server session or your backend/.env.
          </p>
        </div>

        {/* LLM Model Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Generation Model (DeepSeek / HF Inference)
          </label>
          <select
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

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
          <p className="text-[11px] text-slate-500">
            Notebook Step 4 compares k=3 vs k=5 vs k=10.
          </p>
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
          <p className="text-[11px] text-slate-500">
            Default 0.40. Scores below this trigger the honest out-of-domain warning badge.
          </p>
        </div>

        {/* Toggles */}
        <div className="pt-2 space-y-3 border-t border-slate-800/80">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-slate-200">Hybrid Search (Stretch Step 8)</p>
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
              <p className="text-xs font-semibold text-slate-200">Side-by-Side Plain Comparison</p>
              <p className="text-[11px] text-slate-400">Notebook Step 6: With RAG vs Without RAG generation</p>
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
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
