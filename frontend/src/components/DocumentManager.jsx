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
          text: `Successfully uploaded ${data.uploaded_files.length} document(s) and rebuilt FAISS index!`
        });
        onRefreshDocs();
      } else {
        setUploadMessage({
          type: 'error',
          text: data.detail || 'Failed to upload files.'
        });
      }
    } catch (err) {
      setUploadMessage({
        type: 'error',
        text: `Upload error: ${err.message}`
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Are you sure you want to delete ${filename}? The index will be rebuilt.`)) return;

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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner / Explainer */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Folder className="w-5 h-5 text-blue-400" />
              RAG Knowledge Base & Database Files
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Upload your notes, guides, and database documents here. Every file uploaded is automatically cut into chunks with recursive chunking, embedded, and stored into the FAISS vector database.
            </p>
          </div>

          <button
            onClick={onReindex}
            disabled={isReindexing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 text-white font-medium text-sm transition shadow-lg shadow-blue-600/20 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${isReindexing ? 'animate-spin' : ''}`} />
            <span>{isReindexing ? 'Rebuilding Index...' : 'Rebuild FAISS Index'}</span>
          </button>
        </div>

        {/* Local Folder Location Info */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
          <HardDrive className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span>Local Corpus Storage Path:</span>
          <code className="bg-slate-950 px-2 py-0.5 rounded text-blue-300 border border-slate-800 truncate">
            {corpusDirectory || 'backend/data/corpus'}
          </code>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
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
        
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              {isUploading ? 'Uploading and indexing...' : 'Click or drag database files to upload'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports <span className="text-slate-300 font-medium">.txt, .md, .pdf, .csv, .json</span> documents
            </p>
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {uploadMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm border ${
          uploadMessage.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
            : 'bg-rose-950/40 border-rose-800 text-rose-200'
        }`}>
          {uploadMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span>{uploadMessage.text}</span>
        </div>
      )}

      {/* Uploaded Documents Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-white text-sm">Indexed Documents in Corpus</h2>
          </div>
          <span className="text-xs text-slate-400">
            {documents.length} document{documents.length !== 1 ? 's' : ''} total
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Folder className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm">No documents found in corpus.</p>
            <p className="text-xs text-slate-600 mt-1">Upload a .txt or .pdf file above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {documents.map((doc) => (
              <div
                key={doc.filename}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{doc.filename}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.size_kb} KB • {doc.char_count?.toLocaleString()} characters • Modified {doc.last_modified}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(doc.filename)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Delete document and rebuild index"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
