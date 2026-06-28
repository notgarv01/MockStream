import React, { useState } from 'react';
import { Plus, Terminal, Wifi, Copy, Check } from 'lucide-react';

export default function EndpointSidebar({ 
  endpoints, 
  activeEndpointId, 
  onSelectEndpoint, 
  onCreateEndpoint, 
  isCreating,
  wsConnected,
  user,
  onLogOut
}) {
  const [newEndpointName, setNewEndpointName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newEndpointName.trim()) return;
    onCreateEndpoint(newEndpointName);
    setNewEndpointName('');
    setShowAddForm(false);
  };

  const handleCopy = (e, text, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">
          <Terminal size={22} className="code-purple" />
          MockStream
        </h1>
        <div className="header-subtitle">Real-Time Webhook Pipeline</div>
      </div>

      <div className="sidebar-endpoints">
        <div className="sidebar-section-title">Webhook Endpoints</div>
        
        {endpoints.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 10px', height: 'auto' }}>
            <div className="empty-state-icon" style={{ fontSize: '24px' }}>🔌</div>
            <p style={{ fontSize: '11.5px' }}>No endpoints created yet.</p>
          </div>
        ) : (
          endpoints.map((ep) => {
            const isActive = ep.id === activeEndpointId;
            return (
              <div
                key={ep.id}
                className={`endpoint-item glass ${isActive ? 'active' : ''}`}
                onClick={() => onSelectEndpoint(ep.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="endpoint-item-name">{ep.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isActive && wsConnected ? (
                      <Wifi size={12} className="code-green" title="Live WS connection open" />
                    ) : null}
                    <button
                      onClick={(e) => handleCopy(e, ep.id, ep.id)}
                      className="btn-icon"
                      style={{ padding: '3px', background: 'transparent', border: 'none' }}
                      title="Copy Endpoint ID"
                    >
                      {copiedId === ep.id ? (
                        <Check size={11} className="code-green" />
                      ) : (
                        <Copy size={11} style={{ opacity: 0.6 }} />
                      )}
                    </button>
                  </div>
                </div>
                <span className="endpoint-item-id">{ep.id}</span>
              </div>
            );
          })
        )}

        {showAddForm ? (
          <form onSubmit={handleSubmit} style={{ padding: '8px', marginTop: '8px' }}>
            <input
              type="text"
              className="form-input form-input-mono"
              placeholder="Endpoint Name (e.g. Stripe Dev)"
              value={newEndpointName}
              onChange={(e) => setNewEndpointName(e.target.value)}
              autoFocus
              style={{ width: '100%', marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>
                Save
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowAddForm(false)}
                style={{ padding: '6px 12px', fontSize: '11px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          endpoints.length > 0 && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', marginTop: '8px', color: '#c4b5fd' }}
            >
              <Plus size={14} /> Add Endpoint
            </button>
          )
        )}
      </div>

      <div className="endpoint-actions">
        {endpoints.length === 0 && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary"
            disabled={isCreating}
          >
            {isCreating ? <span className="spinner"></span> : <Plus size={16} />}
            Create New Endpoint
          </button>
        )}
      </div>

      {user && (
        <div className="sidebar-footer" style={{
          marginTop: 'auto',
          padding: '16px 8px 0px 8px',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: 'transparent'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logged in as</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.email}>
              {user.email}
            </span>
          </div>
          <button 
            onClick={onLogOut}
            className="btn-icon" 
            style={{ 
              width: '100%', 
              padding: '6px 12px', 
              fontSize: '11px',
              color: '#fda4af',
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center',
              display: 'block'
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
