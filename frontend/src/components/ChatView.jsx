import React, { useState } from 'react';
import { Send, Sparkles, AlertCircle, FileCheck, Copy, Check, ChevronDown, ChevronUp, Bot, User, Compass } from 'lucide-react';
import ChunkInspector from './ChunkInspector';

export default function ChatView({ apiUrl, settingsConfig }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your RAG Assistant. Ask me anything about your uploaded documents, or try one of the quick test queries below to test retrieval grounding and honest scoring.',
      result: null
    }
  ]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [expandedChunksIdx, setExpandedChunksIdx] = useState(null);

  const quickQuestions = [
    "What is precision?",
    "What does top-k mean in retrieval?",
    "What accuracy did fine-tuning reach on SMS spam, and what is RAG?",
    "What is the difference between classification and regression?",
    "What is LangChain?" // Notebook Step 7 honest test (out of domain)
  ];

  const handleSend = async (qToSend) => {
    const queryText = (qToSend || question).trim();
    if (!queryText || loading) return;

    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: queryText }]);
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: queryText,
          k: settingsConfig.k,
          use_hybrid: settingsConfig.useHybrid,
          compare_plain: settingsConfig.comparePlain,
          model_name: settingsConfig.llmModel
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            result: data
          }
        ]);
        // Auto expand retrieved chunks for the latest message
        setExpandedChunksIdx(messages.length + 1);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${data.detail || 'Unable to retrieve answer.'}`,
            error: true
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Connection error: ${err.message}. Ensure the FastAPI backend is running.`,
          error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-5rem)]">
      
      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-3xl space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {/* Message Bubble */}
              <div className={`p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                  : 'bg-slate-900 border border-slate-800 rounded-bl-none text-slate-100 shadow-sm'
              }`}>
                {/* Out-of-domain Warning Badge (Notebook Step 7 Honest Test) */}
                {msg.result && msg.result.is_low_confidence && (
                  <div className="mb-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>
                      <strong>Honest Test Alert:</strong> Top similarity score ({msg.result.top_score}) is below the {msg.result.threshold} threshold. This question appears out-of-domain!
                    </span>
                  </div>
                )}

                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Sources list if available */}
                {msg.result && msg.result.sources && msg.result.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-medium text-slate-300">Grounded Sources:</span>
                    {msg.result.sources.map((src, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[11px]">
                        {src}
                      </span>
                    ))}
                  </div>
                )}

                {/* Copy button */}
                {msg.role === 'assistant' && !msg.error && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => copyText(msg.content, idx)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 p-1 rounded hover:bg-slate-800/50 transition"
                      title="Copy Answer"
                    >
                      {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Side-by-Side Plain LLM Comparison (Notebook Step 6) */}
              {msg.result && msg.result.answer_without_rag && (
                <div className="bg-slate-900/40 border border-dashed border-slate-800 p-3.5 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px] uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Comparison: WITHOUT RAG (Plain Prompting)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                    "{msg.result.answer_without_rag}"
                  </p>
                </div>
              )}

              {/* Retrieved Chunks Toggle */}
              {msg.result && msg.result.retrieved_chunks && (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                  <button
                    onClick={() => setExpandedChunksIdx(expandedChunksIdx === idx ? null : idx)}
                    className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition font-medium"
                  >
                    <span>
                      {expandedChunksIdx === idx ? 'Hide Retrieved Context' : 'Show Retrieved Context & Similarity Scores'}
                    </span>
                    {expandedChunksIdx === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {expandedChunksIdx === idx && (
                    <ChunkInspector
                      chunks={msg.result.retrieved_chunks}
                      topScore={msg.result.top_score}
                      threshold={msg.result.threshold}
                      retrievalMode={msg.result.retrieval_mode}
                    />
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 text-slate-400 text-sm p-4 bg-slate-900/40 border border-slate-800 rounded-2xl animate-pulse">
            <Bot className="w-5 h-5 text-blue-400 animate-bounce" />
            <span>Retrieving nearest chunks from FAISS and generating grounded answer...</span>
          </div>
        )}
      </div>

      {/* Quick Test Queries from Notebook */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <Compass className="w-3.5 h-3.5 text-blue-400" />
          <span>Quick Benchmark Queries:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Query Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your indexed course documents..."
          disabled={loading}
          className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-2xl pl-4 pr-24 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-lg"
        />

        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 transition shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

