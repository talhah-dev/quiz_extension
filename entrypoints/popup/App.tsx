import { useState, useEffect } from 'react';
import './App.css';

interface HistoryItem {
  id: string;
  question: string;
  correctAnswer: string;
  explanation: string;
  confidence: string;
  timestamp: number;
}

export default function App() {
  // Default tab is settings (Key tab) as requested
  const [activeTab, setActiveTab] = useState<'settings' | 'solve' | 'history'>('settings');
  
  // Manual solve state
  const [manualQuestion, setManualQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualResult, setManualResult] = useState<{
    correctAnswer: string;
    explanation: string;
    confidence: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // History & Usage state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usedToday, setUsedToday] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const DAILY_LIMIT = 1500;

  // Load history, usage, and key from chrome.storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const today = new Date().toISOString().slice(0, 10);
      chrome.storage.local.get(['solved_history', 'gemini_usage', 'gemini_api_key'], (res) => {
        if (Array.isArray(res.solved_history)) {
          setHistory(res.solved_history as HistoryItem[]);
        }
        const usage = res.gemini_usage as { date?: string; count?: number } | undefined;
        if (usage && usage.date === today) {
          setUsedToday(usage.count || 0);
        }
        if (typeof res.gemini_api_key === 'string' && res.gemini_api_key) {
          setSavedKey(res.gemini_api_key);
          setApiKey(res.gemini_api_key);
        }
      });
    }
  }, []);

  const handleSaveKey = (keyToSave?: string) => {
    const trimmed = (keyToSave !== undefined ? keyToSave : apiKey).trim();
    if (!trimmed) return;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ gemini_api_key: trimmed }, () => {
        setSavedKey(trimmed);
        setApiKey(trimmed);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      });
    }
  };

  const handleManualSolve = () => {
    if (!manualQuestion.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setManualResult(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { action: 'SOLVE_MCQ', question: manualQuestion },
        (response) => {
          setLoading(false);
          if (!response || !response.success) {
            setErrorMsg(response?.error || 'Failed to solve question.');
          } else {
            setManualResult(response.data);
            // Refresh history and usage
            const today = new Date().toISOString().slice(0, 10);
            chrome.storage.local.get(['solved_history', 'gemini_usage'], (res) => {
              if (Array.isArray(res.solved_history)) setHistory(res.solved_history as HistoryItem[]);
              const currentUsage = res.gemini_usage as { date?: string; count?: number } | undefined;
              if (currentUsage && currentUsage.date === today) {
                setUsedToday(currentUsage.count || 0);
              }
            });
          }
        }
      );
    } else {
      setTimeout(() => {
        setLoading(false);
        setManualResult({
          correctAnswer: 'B) Mitochondria',
          explanation: 'Mitochondria generate most of the chemical energy needed to power the cell.',
          confidence: 'High',
        });
      }, 1000);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ solved_history: [] });
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <span className="brand-title">AI MCQ Solver</span>
        </div>

        {savedKey ? (
          <span className="status-badge active">● AI Ready</span>
        ) : (
          <span className="status-badge missing">● Key Needed</span>
        )}
      </header>

      {/* Free Tier Usage Meter */}
      <div className="usage-card">
        <div className="usage-header">
          <span className="usage-title">Free Tier Daily Quota</span>
          <span className="usage-stats">
            {usedToday} / {DAILY_LIMIT.toLocaleString()} Used
          </span>
        </div>
        <div className="usage-bar-bg">
          <div
            className="usage-bar-fill"
            style={{ width: `${Math.max(1, Math.min(100, (usedToday / DAILY_LIMIT) * 100))}%` }}
          />
        </div>
        <div className="usage-footer">
          <span>{Math.max(0, DAILY_LIMIT - usedToday).toLocaleString()} left today</span>
          <a
            href="https://aistudio.google.com/app/plan_information"
            target="_blank"
            rel="noreferrer"
            className="usage-link"
          >
            Google Cloud Quota ↗
          </a>
        </div>
      </div>

      {/* Subtle Tab Navigation Links */}
      <div className="tab-nav">
        <button
          className={`tab-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Key
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'solve' ? 'active' : ''}`}
          onClick={() => setActiveTab('solve')}
        >
          ⚡ Test
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 History ({history.length})
        </button>
      </div>

      {/* TAB 1: KEY (DEFAULT) */}
      {activeTab === 'settings' && (
        <div className="api-card">
          <div className="card-title-row">
            <span>Gemini API Key</span>
            {saveSuccess ? (
              <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>Saved! ✓</span>
            ) : (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="api-link"
              >
                Get Free Key ↗
              </a>
            )}
          </div>

          <div className="input-row">
            <input
              type="password"
              className="api-input"
              placeholder="Paste key and press Enter..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveKey();
                }
              }}
            />
            <button className="primary-btn" onClick={() => handleSaveKey()}>
              {saveSuccess ? 'Saved ✓' : 'Save'}
            </button>
          </div>

          <p style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
            Press <strong>Enter</strong> to save. Stored privately on this computer only.
          </p>
        </div>
      )}

      {/* TAB 2: TEST SOLVER */}
      {activeTab === 'solve' && (
        <div className="manual-box">
          <div className="tip-card">
            <span>💡</span>
            <div>
              <strong>Highlight anywhere:</strong> On any website, simply <strong>highlight the question</strong> with your mouse and click the <strong>tiny corner square</strong> at the bottom-right!
            </div>
          </div>

          <textarea
            className="question-textarea"
            placeholder="Or paste an MCQ question here to test (e.g. Which planet is closest to the Sun? A) Venus B) Mercury C) Mars)..."
            value={manualQuestion}
            onChange={(e) => setManualQuestion(e.target.value)}
          />

          <button
            className="solve-action-btn"
            disabled={loading || !manualQuestion.trim()}
            onClick={handleManualSolve}
          >
            {loading ? '🧠 Finding Answer...' : '⚡ Solve MCQ Now'}
          </button>

          {errorMsg && (
            <div style={{ color: '#f87171', fontSize: 11, background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 6 }}>
              {errorMsg}
            </div>
          )}

          {manualResult && (
            <div className="result-box">
              <div className="result-header">
                <span className="answer-badge">✓ Correct Option</span>
                <span style={{ fontSize: 10, color: '#34d399' }}>{manualResult.confidence} Confidence</span>
              </div>
              <div className="answer-value">{manualResult.correctAnswer}</div>
              <div className="explanation-value">
                <strong>Why:</strong> {manualResult.explanation}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div className="history-list">
          {history.length === 0 ? (
            <div className="empty-history">
              No solved MCQs yet. Highlight questions on any quiz website to start!
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleClearHistory}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}
                >
                  Clear History
                </button>
              </div>
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-q">"{item.question}"</div>
                  <div className="history-a">{item.correctAnswer}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.explanation}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
