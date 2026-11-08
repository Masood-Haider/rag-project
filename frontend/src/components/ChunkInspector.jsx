import React from 'react';
import { Layers, FileCode, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export default function ChunkInspector({ chunks, topScore, threshold, retrievalMode }) {
  if (!chunks || chunks.length === 0) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Retrieved Context Chunks ({chunks.length}) • Mode: {retrievalMode}
          </h4>
        </div>
        <div className="text-xs text-slate-400">
          Threshold: <span className="font-mono text-slate-200">{threshold}</span>
        </div>
      </div>

      <div className="space-y-3">
        {chunks.map((hit, idx) => {
          const isAboveThreshold = hit.score >= threshold;
          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition-all text-xs ${
                idx === 0 && isAboveThreshold
                  ? 'bg-blue-950/20 border-blue-800/60 shadow-sm'
                  : 'bg-slate-900/40 border-slate-800/80'
              }`}
            >
              {/* Header: Rank, Source, Score */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    idx === 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    Rank {idx + 1}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-300 truncate max-w-[200px]">
                    <FileCode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {hit.source}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hit.keyword_score !== undefined && (
                    <span className="text-[10px] text-slate-400">
                      Sem: {hit.semantic_score?.toFixed(3)} | Key: {hit.keyword_score?.toFixed(3)}
                    </span>
                  )}
                  <div className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold flex items-center gap-1 ${
                    isAboveThreshold
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {isAboveThreshold ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    score: {hit.score.toFixed(3)}
                  </div>
                </div>
              </div>

              {/* Chunk Text */}
              <p className="text-slate-300 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60">
                {hit.chunk}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
