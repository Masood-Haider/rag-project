import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ChatView from './components/ChatView';
import DocumentManager from './components/DocumentManager';
import SettingsModal from './components/SettingsModal';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [corpusDirectory, setCorpusDirectory] = useState('');
  const [isReindexing, setIsReindexing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Admin authentication state (persisted across page refreshes in sessionStorage)
  const [adminPassword, setAdminPassword] = useState(() => {
    return sessionStorage.getItem('nexus_admin_pw') || '';
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    const hasAdmin = sessionStorage.getItem('nexus_is_admin') === 'true';
    const pw = sessionStorage.getItem('nexus_admin_pw');
    return hasAdmin && !!pw;
  });

  const handleSetIsAdmin = (val) => {
    setIsAdmin(val);
    sessionStorage.setItem('nexus_is_admin', val ? 'true' : 'false');
    if (!val) {
      setAdminPassword('');
      sessionStorage.removeItem('nexus_admin_pw');
    }
  };

  const handleSetAdminPassword = (val) => {
    setAdminPassword(val);
    sessionStorage.setItem('nexus_admin_pw', val || '');
  };

  // Guest session ID (unique per browser session, erased on exit)
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('nexus_session_id');
    if (!sid) {
      sid = 'guest_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      sessionStorage.setItem('nexus_session_id', sid);
    }
    return sid;
  });

  // Automatically delete temporary guest files when visitor leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isAdmin && sessionId) {
        const formData = new FormData();
        formData.append('session_id', sessionId);
        navigator.sendBeacon(`${API_BASE}/session/clear`, formData);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, isAdmin]);

  // Theme management (default light, toggleable to dark)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('nexus_theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('nexus_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [settingsConfig, setSettingsConfig] = useState({
    k: 5,
    useHybrid: false,
    comparePlain: false,
    groqModel: 'qwen/qwen3.8-27b',
    llmModel: 'qwen/qwen3.8-27b',
    threshold: 0.40,
    chunkSize: 300,
    chunkOverlap: 50
  });

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setSettingsConfig(prev => ({
          ...prev,
          groqModel: data.llm_model || prev.groqModel,
          llmModel: data.llm_model || prev.llmModel,
          threshold: data.similarity_threshold ?? prev.threshold,
          chunkSize: data.chunk_size ?? prev.chunkSize,
          chunkOverlap: data.chunk_overlap ?? prev.chunkOverlap,
          k: data.default_k ?? prev.k
        }));
      }
    } catch (e) {
      console.warn("Backend not reached yet:", e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const headers = { 'x-session-id': sessionId };
      if (isAdmin && adminPassword) {
        headers['x-admin-password'] = adminPassword;
      }
      const res = await fetch(`${API_BASE}/documents`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        setCorpusDirectory(data.corpus_directory);
      }
    } catch (e) {
      console.warn("Could not fetch documents:", e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDocuments();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [sessionId, isAdmin, adminPassword]);

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (isAdmin && adminPassword) {
        headers['x-admin-password'] = adminPassword;
      }
      if (sessionId) {
        headers['x-session-id'] = sessionId;
      }
      const res = await fetch(`${API_BASE}/reindex`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chunk_size: settingsConfig.chunkSize || 300,
          chunk_overlap: settingsConfig.chunkOverlap || 50,
          session_id: sessionId || null
        })
      });
      if (res.ok) {
        await fetchStats();
        await fetchDocuments();
      }
    } catch (err) {
      alert(`Re-index error: ${err.message}`);
    } finally {
      setIsReindexing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-150">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'chat' && (
          <ChatView
            apiUrl={API_BASE}
            settingsConfig={settingsConfig}
            sessionId={sessionId}
          />
        )}

        {activeTab === 'docs' && (
          <DocumentManager
            documents={documents}
            corpusDirectory={corpusDirectory}
            onRefreshDocs={async () => {
              await fetchDocuments();
              await fetchStats();
            }}
            onReindex={handleReindex}
            isReindexing={isReindexing}
            apiUrl={API_BASE}
            sessionId={sessionId}
            isAdmin={isAdmin}
            setIsAdmin={handleSetIsAdmin}
            adminPassword={adminPassword}
            setAdminPassword={handleSetAdminPassword}
            stats={stats}
          />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settingsConfig={settingsConfig}
        onSaveSettings={(newCfg) => setSettingsConfig(newCfg)}
        apiUrl={API_BASE}
        isAdmin={isAdmin}
        adminPassword={adminPassword}
        sessionId={sessionId}
        stats={stats}
        onReindexComplete={async () => {
          await fetchStats();
          await fetchDocuments();
        }}
      />
    </div>
  );
}
