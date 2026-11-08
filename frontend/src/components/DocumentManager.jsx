import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, FileText, Trash2, RefreshCw, CheckCircle, AlertCircle, HardDrive, X, Sparkles, FolderGit2 } from 'lucide-react';

export default function DocumentManager({
  documents,
  corpusDirectory,
  onRefreshDocs,
  onReindex,
  isReindexing,
  apiUrl,
  sessionId,
  stats
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Delete modal state
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fileInputRef = useRef(null);

  // Prevent scroll when popup opens
  useEffect(() => {
    if (docToDelete || showClearModal) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [docToDelete, showClearModal]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (docToDelete) {
          setDocToDelete(null);
          setDeleteError('');
        }
        if (showClearModal) {
          setShowClearModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docToDelete, showClearModal]);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('session_id', sessionId);

    try {
      const headers = { 'x-session-id': sessionId };

      const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        let errDetail = 'Upload failed.';
        try {
          const errData = await res.json();
          errDetail = errData.detail || errDetail;
        } catch (_) {}
        setUploadMessage({ type: 'error', text: errDetail });
        return;
      }

      const data = await res.json();
      setUploadMessage({
        type: 'success',
        text: data.message || `Uploaded ${data.uploaded_files?.length || 0} document(s) to your session.`
      });
      await onRefreshDocs();
    } catch (err) {
      setUploadMessage({
        type: 'error',
        text: `Network error: ${err.message}. Check if backend is running.`
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteClick = (doc) => {
    setDocToDelete(doc);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const headers = { 'x-session-id': sessionId };

      const res = await fetch(`${apiUrl}/documents/${encodeURIComponent(docToDelete.filename)}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        let errDetail = 'Failed to delete file.';
        try {
          const errData = await res.json();
          errDetail = errData.detail || errDetail;
        } catch (_) {}
        setDeleteError(errDetail);
        return;
      }

      setDocToDelete(null);
      setUploadMessage({
        type: 'success',
        text: `Successfully deleted ${docToDelete.filename}. Vector store updated.`
      });
      await onRefreshDocs();
    } catch (err) {
      setDeleteError(`Network error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmClearSession = async () => {
    setIsClearing(true);
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);

      const res = await fetch(`${apiUrl}/session/clear`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        setShowClearModal(false);
        setUploadMessage({
          type: 'success',
          text: 'Private session documents wiped clean.'
        });
        await onRefreshDocs();
      } else {
        alert('Could not clear session documents.');
      }
    } catch (err) {
      alert(`Error clearing session: ${err.message}`);
    } finally {
      setIsClearing(false);
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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Knowledge Base
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-zinc-500" />
              RAG Workspace
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            Upload documents here for instant, private Q&amp;A in your session. Permanent repository files are placed directly in <code className="font-mono text-zinc-700 dark:text-zinc-300">backend/data/corpus</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReindex}
            disabled={isReindexing}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
            <span>{isReindexing ? 'Indexing...' : 'Rebuild Index'}</span>
          </button>
        </div>
      </div>

      {/* Permanent Corpus Info Card */}
      <div className="px-4 py-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-3">
        <FolderGit2 className="w-4 h-4 text-zinc-600 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            Permanent Corpus Location
          </div>
          <p className="text-[11px] leading-relaxed">
            To add permanent documents that survive serverless restarts, paste your <code className="font-mono">.txt</code>, <code className="font-mono">.pdf</code>, <code className="font-mono">.docx</code>, or <code className="font-mono">.md</code> files into:
          </p>
          <div className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 inline-block mt-1">
            backend/data/corpus/
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-zinc-900 bg-zinc-100/50 dark:border-zinc-100 dark:bg-zinc-900/50'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.markdown,.pdf,.docx,.doc,.csv,.json,.py,.html"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            {isUploading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
              {isUploading ? 'Uploading & Indexing...' : 'Click to upload files or drag & drop'}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Supports .txt, .pdf, .docx, .md, .csv, .json (private to your session)
            </p>
          </div>
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-medium text-zinc-500 bg-zinc-50/70 dark:bg-zinc-900/70 backdrop-blur-xs sticky top-0 z-10">
          <span>Available Documents ({documents.length})</span>
          {documents.some(d => !d.is_permanent) && (
            <button
              onClick={() => setShowClearModal(true)}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
            >
              Clear Session Files
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">
            No documents in corpus. Upload files above or add them to <code className="font-mono">backend/data/corpus</code>.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[460px] overflow-y-auto overscroll-contain">
            {documents.map((doc) => (
              <div
                key={doc.filename}
                className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{doc.filename}</p>
                      {doc.is_permanent ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          Repository (Permanent)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                          Session File
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      {doc.size_kb} KB • {doc.char_count?.toLocaleString()} chars • {doc.last_modified}
                    </p>
                  </div>
                </div>

                {!doc.is_permanent ? (
                  <button
                    onClick={() => handleDeleteClick(doc)}
                    className="p-1.5 rounded-md transition text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Delete session document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-[10px] text-zinc-400 font-mono px-2 py-1">
                    Repository File
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal (Portaled) */}
      {docToDelete && createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Remove File
                </h3>
              </div>
              <button
                onClick={() => setDocToDelete(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {docToDelete.filename}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {docToDelete.size_kb} KB
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                    Session File
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to remove this file from your session? The vector database will update immediately.
            </p>

            {deleteError && (
              <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
              >
                {isDeleting ? 'Removing...' : 'Remove File'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Clear Session Modal (Portaled) */}
      {showClearModal && createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Clear Session Files
                </h3>
              </div>
              <button
                onClick={() => setShowClearModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              All temporary documents uploaded during this session will be removed and your private session index will be cleared.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearSession}
                disabled={isClearing}
                className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition disabled:opacity-50"
              >
                {isClearing ? 'Clearing...' : 'Clear All Files'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
