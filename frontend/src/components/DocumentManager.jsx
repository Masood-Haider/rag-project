import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Trash2, RefreshCw, Folder, CheckCircle, AlertCircle, HardDrive } from 'lucide-react';

export default function DocumentManager({
  documents,
  corpusDirectory,
  onRefreshDocs,
  onReindex,
  isReindexing,
  apiUrl
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMessage({
          type: 'success',
          text: `Uploaded ${data.uploaded_files.length} document(s) and synchronized FAISS index.`
        });
        onRefreshDocs();
      } else {
        setUploadMessage({
          type: 'error',
          text: data.detail || 'Upload failed.'
        });
      }
    } catch (err) {
      setUploadMessage({
        type: 'error',
        text: `Network error: ${err.message}`
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Remove ${filename} and re-index corpus?`)) return;

    try {
      const res = await fetch(`${apiUrl}/documents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onRefreshDocs();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to delete file.');
      }
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      
      {/* Header & Reindex Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Knowledge Corpus
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
            Manage files referenced by the vector search index.
          </p>
        </div>

        <button
          onClick={onReindex}
          disabled={isReindexing}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
          <span>{isReindexing ? 'Reindexing...' : 'Rebuild Index'}</span>
        </button>
      </div>

      {/* Directory location indicator */}
      <div className="px-3.5 py-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2 truncate">
          <HardDrive className="w-4 h-4 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Local Directory:</span>
          <code className="font-mono text-[11px] truncate">{corpusDirectory || 'backend/data/corpus'}</code>
        </div>
        <span className="text-[11px] text-zinc-600 dark:text-zinc-400 hidden sm:inline">Drop files directly here</span>
      </div>

      {/* Drag & Drop Upload Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/50 dark:bg-zinc-900/50'
            : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".txt,.md,.markdown,.pdf,.csv,.json"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        
        <div className="flex flex-col items-center justify-center gap-2">
          <UploadCloud className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
          <div className="text-xs">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {isUploading ? 'Ingesting documents...' : 'Click to upload'}
            </span>
            <span className="text-zinc-600 dark:text-zinc-400"> or drag files here</span>
          </div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            Accepts .txt, .pdf, .md, .csv, and .json
          </p>
        </div>
      </div>

      {/* Upload Notification */}
      {uploadMessage && (
        <div className={`px-3 py-2 rounded-lg flex items-center gap-2 text-xs border ${
          uploadMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          {uploadMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          )}
          <span>{uploadMessage.text}</span>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <span>Files in Corpus</span>
          <span>{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 dark:text-zinc-400 text-xs">
            No documents in corpus. Upload files above to index knowledge.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {documents.map((doc) => (
              <div
                key={doc.filename}
                className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{doc.filename}</p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono mt-0.5">
                      {doc.size_kb} KB • {doc.char_count?.toLocaleString()} chars • {doc.last_modified}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(doc.filename)}
                  className="p-1.5 text-zinc-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-md transition"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
