import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, FileText, AlertCircle, Copy, Check, ChevronDown, ChevronUp, Terminal, Download, Trash2 } from 'lucide-react';
import ChunkInspector from './ChunkInspector';

// Lightweight, clean Markdown & Code renderer without heavy dependencies
function FormattedMessage({ text }) {
  if (!text) return null;

  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const lang = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
          const code = lang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={index} className="my-2 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs">
              {lang && (
                <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 uppercase font-semibold">
                  {lang}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-zinc-800 dark:text-zinc-200 leading-relaxed">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Parse paragraphs, bold text, bullet points
        const paragraphs = part.split(/\n\n+/);
        return paragraphs.map((para, pIdx) => {
          const lines = para.split('\n');
          return (
            <p key={`${index}-${pIdx}`} className="leading-relaxed">
              {lines.map((line, lIdx) => {
                const trimmed = line.trim();
                const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
                const content = isBullet ? trimmed.slice(2) : line;

                // Simple inline bold and code formatting
                const formattedContent = content.split(/(\*\*.*?\*\*|`.*?`)/g).map((sub, sIdx) => {
                  if (sub.startsWith('**') && sub.endsWith('**')) {
                    return <strong key={sIdx} className="font-semibold text-zinc-900 dark:text-zinc-100">{sub.slice(2, -2)}</strong>;
                  }
                  if (sub.startsWith('`') && sub.endsWith('`')) {
                    return <code key={sIdx} className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[12px] border border-zinc-200/60 dark:border-zinc-700/60">{sub.slice(1, -1)}</code>;
                  }
                  return sub;
                });

                if (isBullet) {
                  return (
                    <span key={lIdx} className="block pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-zinc-400">
                      {formattedContent}
                    </span>
                  );
                }

                return (
                  <React.Fragment key={lIdx}>
                    {formattedContent}
                    {lIdx < lines.length - 1 && <br />}
                  </React.Fragment>
                );
              })}
            </p>
          );
        });
      })}
    </div>
  );
}

export default function ChatView({ apiUrl, settingsConfig, sessionId }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'System ready. Ask any question against your indexed documents. Answers are strictly grounded in retrieved vector chunks.',
      result: null
    }
  ]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [expandedChunksIdx, setExpandedChunksIdx] = useState(null);

  const lastUserMsgRef = useRef(null);
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll so user query and assistant answer start are prominently in view
  useEffect(() => {
    if (loading && lastUserMsgRef.current) {
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && messages.length > 1 && lastUserMsgRef.current) {
      const timer = setTimeout(() => {
        lastUserMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [loading, messages.length]);

  const quickQuestions = [
    "Summarize the main topics in the uploaded documents",
    "What are the key technical concepts and definitions?",
    "What accuracy did fine-tuning reach on SMS spam, and what is RAG?",
    "Explain the methodology and steps described in the documents"
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
          compare_plain: false,
          model_name: settingsConfig.llmModel,
          session_id: sessionId
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
        // Note: retrieved chunks remain collapsed / hidden by default as requested
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
          content: `Connection error: ${err.message}. Ensure the backend service is running.`,
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

  const exportChat = () => {
    const markdown = messages.map(m => {
      const sender = m.role === 'user' ? '### User' : '### Assistant';
      const sources = m.result?.sources?.length ? `\n\n*Sources: ${m.result.sources.join(', ')}*` : '';
      return `${sender}\n${m.content}${sources}\n`;
    }).join('\n---\n\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rag-qa-session-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'System ready. Ask any question against your indexed documents. Answers are strictly grounded in retrieved vector chunks.',
        result: null
      }
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-3.5rem)]">
      
      {/* Top Session Actions (Export, Clear) */}
      <div className="flex items-center justify-between pb-2 mb-2 text-xs border-b border-zinc-100 dark:border-zinc-800/60">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
          Query Session
        </span>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <>
              <button
                onClick={exportChat}
                className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
                title="Export session to Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .md</span>
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <button
                onClick={clearChat}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-5 pr-1 mb-3 scroll-smooth">
        {messages.map((msg, idx) => {
          const isLatestUser = msg.role === 'user' && idx === messages.map(m => m.role).lastIndexOf('user');
          return (
            <div
              key={idx}
              ref={isLatestUser ? lastUserMsgRef : null}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} scroll-mt-4`}
            >
              {/* Sender Label */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                {msg.role === 'user' ? (
                  <span>You</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-zinc-500" />
                    <span>Assistant</span>
                    {msg.result?.model_used && (
                      <span className="text-[10px] text-zinc-500">
                        • {msg.result.model_used}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Bubble Card */}
              <div
                className={`max-w-2xl text-[13.5px] leading-relaxed transition-all ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-2xl shadow-sm'
                    : 'bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 p-4 rounded-xl shadow-xs w-full'
                }`}
              >
                {/* Out-of-Domain Honest Test Alert */}
                {msg.result?.is_low_confidence && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold">Honest Test Alert:</span> Top similarity score ({msg.result.top_score}) is below the {msg.result.threshold} threshold. The context may not contain the answer.
                    </div>
                  </div>
                )}

                {/* Message Content with Markdown parsing */}
                <div className="text-[13.5px]">
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <FormattedMessage text={msg.content} />
                  )}
                </div>

                {/* Grounded Sources */}
                {msg.result?.sources?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium text-[11px]">Sources:</span>
                    {msg.result.sources.map((src, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono border border-zinc-200/60 dark:border-zinc-700/60"
                      >
                        <FileText className="w-3 h-3 text-zinc-400" />
                        {src}
                      </span>
                    ))}
                  </div>
                )}

                {/* Copy Action */}
                {msg.role === 'assistant' && !msg.error && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => copyText(msg.content, idx)}
                      className="text-[11px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 transition"
                    >
                      {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Retrieved Chunks Toggle (Hidden by default, expandable on click) */}
              {msg.result?.retrieved_chunks && msg.result.retrieved_chunks.length > 0 && (
                <div className="mt-2 w-full max-w-2xl">
                  <button
                    onClick={() => setExpandedChunksIdx(expandedChunksIdx === idx ? null : idx)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
                  >
                    <span>{expandedChunksIdx === idx ? 'Hide retrieved chunks' : `View ${msg.result.retrieved_chunks.length} retrieved chunks`}</span>
                    {expandedChunksIdx === idx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expandedChunksIdx === idx && (
                    <div className="mt-2">
                      <ChunkInspector
                        chunks={msg.result.retrieved_chunks}
                        topScore={msg.result.top_score}
                        threshold={msg.result.threshold}
                        retrievalMode={msg.result.retrieval_mode}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-zinc-600 dark:bg-zinc-400 animate-pulse"></span>
            <span>Querying vector index & generating grounded response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Queries */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <span className="text-zinc-600 dark:text-zinc-400 font-mono text-[10px] uppercase flex-shrink-0">
            Benchmarks:
          </span>
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="whitespace-nowrap px-2.5 py-1 rounded-md bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Query Input */}
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
          placeholder="Ask a question about your knowledge corpus..."
          disabled={loading}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600 rounded-xl pl-4 pr-12 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-600 dark:placeholder-zinc-400 focus:outline-none shadow-xs transition"
        />

        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="absolute right-2 top-2 p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 disabled:opacity-30 transition"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
