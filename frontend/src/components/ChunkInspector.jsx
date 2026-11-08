import React from 'react';
import { Layers, FileCode } from 'lucide-react';

export default function ChunkInspector({ chunks, topScore, threshold, retrievalMode }) {
  if (!chunks || chunks.length === 0) return null;

  return (
    <div className="space-y-2.5 pt-1 text-xs">
      <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
        <span>{chunks.length} chunks retrieved • mode: {retrievalMode}</span>
        <span>threshold: {threshold}</span>
      </div>

      <div className="space-y-2">
        {chunks.map((hit, idx) => {
          const isAboveThreshold = hit.score >= threshold;
          return (
            <div
              key={idx}
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    #{idx + 1}
                  </span>
                  <FileCode className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span className="truncate max-w-[240px]">{hit.source}</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  {hit.keyword_score !== undefined && (
                    <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">
                      sem: {hit.semantic_score?.toFixed(3)} | key: {hit.keyword_score?.toFixed(3)}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                    isAboveThreshold
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40'
                      : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40'
                  }`}>
                    {hit.score.toFixed(3)}
                  </span>
                </div>
              </div>

              <p className="text-zinc-700 dark:text-zinc-300 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap bg-white dark:bg-zinc-900 p-2.5 rounded border border-zinc-200/60 dark:border-zinc-800/80">
                {hit.chunk}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
