import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, XCircle } from 'lucide-react';

export default function ReplayControl({ activeWebhook, backendUrl }) {
  const [targetUrl, setTargetUrl] = useState('http://localhost:3000/webhook');
  const [method, setMethod] = useState('POST');
  const [bodyString, setBodyString] = useState('');
  const [headersString, setHeadersString] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [responseResult, setResponseResult] = useState(null);

  useEffect(() => {
    if (activeWebhook) {
      setMethod(activeWebhook.method || 'POST');
      setBodyString(JSON.stringify(activeWebhook.body || {}, null, 2));
      
      // Filter out system headers for cleaner display
      const filteredHeaders = { ...activeWebhook.headers };
      delete filteredHeaders.host;
      delete filteredHeaders.connection;
      delete filteredHeaders['content-length'];
      delete filteredHeaders['content-type']; // We will force application/json
      
      setHeadersString(JSON.stringify(filteredHeaders || {}, null, 2));
      setResponseResult(null);
    }
  }, [activeWebhook]);

  const handleReplay = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setResponseResult(null);

    try {
      let parsedBody = null;
      if (bodyString.trim()) {
        parsedBody = JSON.parse(bodyString);
      }
      
      let parsedHeaders = {};
      if (headersString.trim()) {
        parsedHeaders = JSON.parse(headersString);
      }

      const res = await fetch(`${backendUrl}/v1/replay`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          target_url: targetUrl,
          method,
          headers: parsedHeaders,
          body: parsedBody
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to replay request');
      }

      setResponseResult({
        status: data.status,
        headers: data.headers,
        body: data.body,
        latency_ms: data.latency_ms,
        success: data.success || (data.status >= 200 && data.status < 300)
      });
    } catch (err) {
      setResponseResult({
        status: 'Connection Failed',
        error: err.message,
        success: false
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!activeWebhook) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '12px' }}>Select a webhook event above to configure and execute a request replay.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '4px' }}>
      <div className="spec-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span>Replay Engine Config</span>
        <span className="tag-amber" style={{ textTransform: 'none', position: 'static' }}>Target local stack</span>
      </div>

      <form onSubmit={handleReplay} className="replay-panel">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Method</label>
            <select
              className="form-input"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', width: '100%' }}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Forward Target URL</label>
            <input
              type="text"
              className="form-input form-input-mono"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="http://localhost:3000/webhook"
              style={{ width: '100%' }}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Headers (JSON)</label>
            <textarea
              className="replay-json-editor"
              value={headersString}
              onChange={(e) => setHeadersString(e.target.value)}
              placeholder="{}"
              style={{ height: '110px', width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Payload Body (JSON)</label>
            <textarea
              className="replay-json-editor"
              value={bodyString}
              onChange={(e) => setBodyString(e.target.value)}
              placeholder="{}"
              style={{ height: '130px', width: '100%' }}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={isSending}>
          {isSending ? (
            <>
              <span className="spinner"></span> Replaying...
            </>
          ) : (
            <>
              <Send size={14} /> Trigger Local Replay
            </>
          )}
        </button>
      </form>

      {responseResult && (
        <div className="replay-response-box">
          <div className="section-label">Replay Delivery Report</div>
          <div className="glass-strong" style={{ padding: '14px', marginTop: '6px' }}>
            <div className="response-meta-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {responseResult.success ? (
                  <CheckCircle2 size={16} className="code-green" />
                ) : (
                  <XCircle size={16} className="code-red" />
                )}
                <span className="response-status" style={{ color: responseResult.success ? 'var(--color-green)' : 'var(--color-red)' }}>
                  Status: {responseResult.status}
                </span>
              </div>
              {responseResult.latency_ms !== undefined && (
                <span className="response-latency">
                  Latency: {responseResult.latency_ms}ms
                </span>
              )}
            </div>
            
            {responseResult.error && (
              <div style={{ color: 'var(--color-red)', fontSize: '11.5px', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                Error: {responseResult.error}
              </div>
            )}
            
            {responseResult.body && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>RESPONSE BODY</div>
                <pre className="code-block" style={{ maxHeight: '150px', fontSize: '10px', padding: '10px' }}>
                  {typeof responseResult.body === 'object' 
                    ? JSON.stringify(responseResult.body, null, 2) 
                    : responseResult.body}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
