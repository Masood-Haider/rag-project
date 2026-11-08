import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, FileText, Trash2, RefreshCw, CheckCircle, AlertCircle, HardDrive, Lock, Unlock, X } from 'lucide-react';

export default function DocumentManager({
  documents,
  corpusDirectory,
  onRefreshDocs,
  onReindex,
  isReindexing,
  apiUrl,
  sessionId,
  isAdmin,
  setIsAdmin,
  adminPassword,
  setAdminPassword
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const fileInputRef = useRef(null);
  const modalInputRef = useRef(null);

  // Prevent scroll & white-space jump when popup opens
  useEffect(() => {
    if (showPasswordDialog) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        modalInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [showPasswordDialog]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showPasswordDialog) {
        setShowPasswordDialog(false);
        setPasswordError('');
        setInputPassword('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPasswordDialog]);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!inputPassword.trim()) {
      setPasswordError('Please enter a password.');
      return;
    }

    setPasswordError('');
    setIsVerifying(true);

    try {
      const res = await fetch(`${apiUrl}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: inputPassword })
      });

      // Handle non-OK status or connection failures safely without crashing on res.json()
      if (!res.ok) {
        if (res.status === 502 || res.status === 504 || res.status === 500) {
          throw new Error('Backend server is unreachable. Please ensure "python run.py" is running in the backend folder.');
        }
        let errMsg = 'Verification failed.';
        try {
          const errData = await res.json();
          errMsg = errData.detail || errData.message || errMsg;
        } catch (_) {}
        setPasswordError(errMsg);
        return;
      }

      const text = await res.text();
      if (!text) {
        throw new Error('Server returned an empty response. Verify the FastAPI backend is running.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Invalid response from server. Check backend terminal for errors.');
      }

      if (data.success) {
        setIsAdmin(true);
        setAdminPassword(inputPassword);
        setShowPasswordDialog(false);
        setInputPassword('');
        onRefreshDocs();
      } else {
        setPasswordError('Incorrect admin password.');
      }
    } catch (err) {
      const isNetworkErr = err.message.includes('fetch') || err.message.includes('Failed to execute') || err.message.includes('unreachable');
      setPasswordError(
        isNetworkErr
          ? 'Backend offline: Please start the FastAPI backend (run "python run.py" in backend folder).'
          : err.message
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogoutAdmin = () => {
    setIsAdmin(false);
    setAdminPassword('');
    onRefreshDocs();
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    if (isAdmin && adminPassword) {
      formData.append('admin_password', adminPassword);
    } else {
      formData.append('session_id', sessionId);
    }

    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
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
        text: data.message || `Uploaded ${data.uploaded_files.length} document(s).`
      });
      onRefreshDocs();
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

  const handleDelete = async (doc) => {
    if (doc.is_permanent && !isAdmin) {
      alert("Only the administrator can delete permanent corpus documents.");
      return;
    }

    if (!confirm(`Remove ${doc.filename}?`)) return;

    try {
      const headers = { 'x-session-id': sessionId };
      if (isAdmin && adminPassword) {
        headers['x-admin-password'] = adminPassword;
      }

      const res = await fetch(`${apiUrl}/documents/${encodeURIComponent(doc.filename)}`, {
        method: 'DELETE',
        headers
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

  const handleClearSession = async () => {
    if (!confirm("Clear all your temporary files from this session?")) return;
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      await fetch(`${apiUrl}/session/clear`, {
        method: 'POST',
        body: formData
      });
      onRefreshDocs();
    } catch (e) {
      console.error(e);
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
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Knowledge Base
            </h1>
            {isAdmin ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                <Unlock className="w-3 h-3" />
                Admin (Permanent)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Guest Session (Temporary)
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isAdmin
              ? 'Admin Mode active. Any document uploaded will be stored permanently in the database.'
              : 'Guest Mode active. Uploaded files are private to you and will be deleted when you leave.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              onClick={handleLogoutAdmin}
              className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              Lock Admin
            </button>
          ) : (
            <button
              onClick={() => setShowPasswordDialog(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              title="Unlock Permanent Admin Uploads"
            >
              <Lock className="w-3 h-3" />
              <span>Admin Login</span>
            </button>
          )}

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

      {/* Admin Unlock Modal Dialog - Portaled directly to document.body to prevent any layout shift or top white space */}
      {showPasswordDialog && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPasswordDialog(false);
              setPasswordError('');
              setInputPassword('');
            }
          }}
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 w-full max-w-sm shadow-xl space-y-3 relative">
            <button
              type="button"
              onClick={() => setShowPasswordDialog(false)}
              className="absolute right-3.5 top-3.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              Unlock Permanent Admin Storage
            </h3>
            <p className="text-xs text-zinc-500">
              Enter your admin password from <code className="font-mono">backend/.env</code> to permanently add or remove database files.
            </p>

            <form onSubmit={handleVerifyPassword} className="space-y-3 pt-1">
              <input
                ref={modalInputRef}
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="Admin password"
                disabled={isVerifying}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
              {passwordError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-tight">{passwordError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordDialog(false)}
                  disabled={isVerifying}
                  className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !inputPassword.trim()}
                  className="px-3.5 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium disabled:opacity-50 transition"
                >
                  {isVerifying ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Drag & Drop Upload Zone */}
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
          <UploadCloud className="w-6 h-6 text-zinc-400" />
          <div className="text-xs">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {isUploading ? 'Uploading...' : 'Click to upload files'}
            </span>
            <span className="text-zinc-500"> or drag and drop</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            {isAdmin
              ? 'Stored permanently in backend/data/corpus for all queries'
              : 'Stored temporarily in your private sandbox, deleted on exit'}
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
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-medium text-zinc-500">
          <span>Available Documents ({documents.length})</span>
          {!isAdmin && documents.some(d => !d.is_permanent) && (
            <button
              onClick={handleClearSession}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
            >
              Clear Temporary Files
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">
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
                  <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{doc.filename}</p>
                      {doc.is_permanent ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          Permanent
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                          Private Sandbox
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      {doc.size_kb} KB • {doc.char_count?.toLocaleString()} chars • {doc.last_modified}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(doc)}
                  disabled={doc.is_permanent && !isAdmin}
                  className={`p-1.5 rounded-md transition ${
                    doc.is_permanent && !isAdmin
                      ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                      : 'text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400'
                  }`}
                  title={doc.is_permanent && !isAdmin ? "Only administrator can delete permanent files" : "Delete file"}
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
