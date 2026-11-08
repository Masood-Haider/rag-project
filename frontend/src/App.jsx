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

  const [settingsConfig, setSettingsConfig] = useState({
    k: 5,
    useHybrid: false,
    comparePlain: true,
    llmModel: 'deepseek-ai/DeepSeek-V3-0324',
    threshold: 0.40
  });

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn("Backend not reached yet:", e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
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
  }, []);

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const res = await fetch(`${API_BASE}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk_size: 300, chunk_overlap: 50 })
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'chat' && (
          <ChatView
            apiUrl={API_BASE}
            settingsConfig={settingsConfig}
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
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settingsConfig={settingsConfig}
        onSaveSettings={(newCfg) => setSettingsConfig(newCfg)}
        apiUrl={API_BASE}
      />
    </div>
  );
}
