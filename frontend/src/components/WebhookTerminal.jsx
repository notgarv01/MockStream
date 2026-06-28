import React, { useState } from 'react';
import { Search, Eye } from 'lucide-react';
import ReplayControl from './ReplayControl';

function syntaxHighlightJson(json) {
  if (typeof json !== 'object') {
    try {
      json = JSON.parse(json);
    } catch {
      return json;
    }
  }
  const str = JSON.stringify(json, null, 2);
  const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'code-blue'; // numbers
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'code-purple'; // keys
      } else {
        cls = 'code-green'; // string values
      }
    } else if (/true|false/.test(match)) {
      cls = 'code-amber'; // booleans
    } else if (/null/.test(match)) {
      cls = 'code-red'; // nulls
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

export default function WebhookTerminal({ 
  webhooks, 
  activeWebhook, 
  onSelectWebhook,
  onClearWebhooks,
  backendUrl
}) {
  const [activeTab, setActiveTab] = useState('body');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWebhooks = webhooks.filter(wh => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      wh.path.toLowerCase().includes(term) ||
      wh.method.toLowerCase().includes(term) ||
      (wh.id && wh.id.toLowerCase().includes(term)) ||
      JSON.stringify(wh.body || {}).toLowerCase().includes(term)
    );
  });

  return (
    <div className="dashboard-grid">
      {/* List Panel */}
      <div className="webhook-list-panel glass">
        <div className="panel-header">
          <span>Captured Requests ({filteredWebhooks.length})</span>
          {webhooks.length > 0 && (
            <button 
              onClick={onClearWebhooks}
              className="btn-icon" 
              style={{ padding: '4px 8px', fontSize: '10px' }}
              title="Clear history"
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', opacity: 0.4 }} />
            <input
              type="text"
              className="form-input form-input-mono"
              placeholder="Filter events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: '28px', fontSize: '11px', height: '28px' }}
            />
          </div>
        </div>
        <div className="panel-list">
          {filteredWebhooks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <p style={{ fontSize: '12px' }}>No events recorded</p>
            </div>
          ) : (
            filteredWebhooks.map(wh => {
              const isActive = activeWebhook && activeWebhook.id === wh.id;
              const hasSuccess = wh.status >= 200 && wh.status < 300;
              const accentClass = 
                wh.method === 'POST' ? 'accent-blue' :
                wh.method === 'GET' ? 'accent-green' :
                wh.method === 'PUT' ? 'accent-amber' : 'accent-red';

              return (
                <div
                  key={wh.id}
                  className={`webhook-card-item glass ${isActive ? 'active' : ''} ${accentClass}`}
                  onClick={() => onSelectWebhook(wh)}
                >
                  <div className="webhook-card-meta">
                    <span className={`webhook-method method-${wh.method.toLowerCase()}`}>{wh.method}</span>
                    <span className="webhook-time">
                      {new Date(wh.received_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="webhook-path" title={wh.path}>{wh.path}</div>
                  <div className="webhook-card-footer">
                    <span>{wh.id}</span>
                    <span className={`status-pill ${hasSuccess ? '' : 'error'}`}>
                      {wh.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Details Panel */}
      <div className="webhook-detail-panel glass">
        {activeWebhook ? (
          <>
            <div className="detail-header-bar">
              <div className="detail-title">
                <span className={`webhook-method method-${activeWebhook.method.toLowerCase()}`} style={{ fontSize: '12px' }}>
                  {activeWebhook.method}
                </span>
                <span className="webhook-path" style={{ fontSize: '13px', color: '#f1f5f9' }}>{activeWebhook.path}</span>
              </div>
              <div className="detail-tabs">
                <button
                  className={`tab-btn ${activeTab === 'body' ? 'active' : ''}`}
                  onClick={() => setActiveTab('body')}
                >
                  Body
                </button>
                <button
                  className={`tab-btn ${activeTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setActiveTab('headers')}
                >
                  Headers
                </button>
                <button
                  className={`tab-btn ${activeTab === 'query' ? 'active' : ''}`}
                  onClick={() => setActiveTab('query')}
                >
                  Query Params
                </button>
                <button
                  className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
                  onClick={() => setActiveTab('replay')}
                >
                  Replay
                </button>
              </div>
            </div>

            <div className="detail-content-area">
              {activeTab === 'body' && (
                <div>
                  <div className="section-label" style={{ marginBottom: '8px' }}>Payload Document</div>
                  {activeWebhook.body && Object.keys(activeWebhook.body).length > 0 ? (
                    <pre 
                      className="code-block"
                      dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(activeWebhook.body) }}
                    />
                  ) : (
                    <div className="code-block" style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '24px' }}>
                      Empty Body
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'headers' && (
                <div>
                  <div className="section-label" style={{ marginBottom: '8px' }}>HTTP Headers</div>
                  <div className="glass-strong" style={{ padding: '8px 12px', overflowX: 'auto' }}>
                    <table className="headers-table">
                      <thead>
                        <tr>
                          <th>Header</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(activeWebhook.headers || {}).map(([key, val]) => (
                          <tr key={key}>
                            <td className="header-name">{key}</td>
                            <td className="header-value">{val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'query' && (
                <div>
                  <div className="section-label" style={{ marginBottom: '8px' }}>Query Parameters</div>
                  {activeWebhook.query && Object.keys(activeWebhook.query).length > 0 ? (
                    <div className="glass-strong" style={{ padding: '8px 12px', overflowX: 'auto' }}>
                      <table className="headers-table">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(activeWebhook.query || {}).map(([key, val]) => (
                            <tr key={key}>
                              <td className="header-name" style={{ color: 'var(--color-blue)' }}>{key}</td>
                              <td className="header-value">{val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="code-block" style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '24px' }}>
                      No Query Parameters
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'replay' && (
                <div>
                  <ReplayControl
                    activeWebhook={activeWebhook}
                    backendUrl={backendUrl}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Eye size={44} className="code-purple" style={{ opacity: 0.5 }} />
            <h3>Request Inspector Terminal</h3>
            <p>Select an incoming webhook event from the left panel to inspect the diagnostics, headers, and body parameters in real time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
