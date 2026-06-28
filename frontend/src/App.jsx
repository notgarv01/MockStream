import React, { useState, useEffect, useRef } from 'react';
import EndpointSidebar from './components/EndpointSidebar';
import PipelineVisualizer from './components/PipelineVisualizer';
import WebhookTerminal from './components/WebhookTerminal';
import AuthScreen from './components/AuthScreen';
import { Copy, Check, Terminal, Play, Zap, Database } from 'lucide-react';
import { auth, isFirebaseConfigured, signOut } from './firebase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mockUserActive, setMockUserActive] = useState(false);

  const [endpoints, setEndpoints] = useState([]);
  const [activeEndpointId, setActiveEndpointId] = useState('');
  const [webhooks, setWebhooks] = useState([]);
  const [activeWebhook, setActiveWebhook] = useState(null);
  const [latestWebhook, setLatestWebhook] = useState(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const socketRef = useRef(null);

  // Monitor Firebase Auth State
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setMockUserActive(false);
      } else {
        setUser(null);
        setMockUserActive(false);
        // Clear state on log out
        setEndpoints([]);
        setActiveEndpointId('');
        setWebhooks([]);
        setActiveWebhook(null);
        setLatestWebhook(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMockLogin = (mockedUser) => {
    setUser(mockedUser);
    setMockUserActive(true);
  };

  const handleLogOut = async () => {
    if (isFirebaseConfigured && !mockUserActive) {
      await signOut(auth);
    } else {
      setUser(null);
      setMockUserActive(false);
      setEndpoints([]);
      setActiveEndpointId('');
      setWebhooks([]);
      setActiveWebhook(null);
      setLatestWebhook(null);
    }
  };

  // Helper to fetch authorization header
  const getAuthHeaders = async () => {
    const headers = {};
    if (mockUserActive || !isFirebaseConfigured) {
      headers['Authorization'] = 'Bearer mock-dev-token';
    } else if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Check backend availability on mount using public health check API
  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch(`${BACKEND_URL}/v1/health`);
        if (!res.ok) throw new Error('Health check failed');
        setIsDemoMode(false);
      } catch (err) {
        console.warn('Backend server not detected, falling back to Demo Mode');
        setIsDemoMode(true);
        // Setup initial demo endpoints
        const demoEps = [
          { id: 'ep_8f9a2b', token: 'ms_live_99217', name: 'Stripe Sandbox', created_at: new Date().toISOString() },
          { id: 'ep_12c34d', token: 'ms_live_88316', name: 'Shopify Prod Store', created_at: new Date().toISOString() }
        ];
        setEndpoints(demoEps);
        setActiveEndpointId(demoEps[0].id);
      }
    }
    checkBackend();
  }, []);

  // Fetch initial data once user is authenticated and backend is detected online
  useEffect(() => {
    if (!user || isDemoMode) return;

    async function loadInitialData() {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`${BACKEND_URL}/v1/endpoints`, {
          headers: authHeaders
        });
        if (!res.ok) throw new Error('Failed to load endpoints');
        const data = await res.json();
        setEndpoints(data);
        if (data.length > 0) {
          setActiveEndpointId(data[0].id);
        }
      } catch (err) {
        console.error('API loading error:', err);
      }
    }
    loadInitialData();
  }, [user, isDemoMode]);

  // Fetch webhook logs when active endpoint changes
  useEffect(() => {
    if (!activeEndpointId || !user) return;

    if (isDemoMode) {
      // Mock history for demo endpoints
      const mockLogs = getMockWebhookLogs(activeEndpointId);
      setWebhooks(mockLogs);
      setActiveWebhook(mockLogs[0] || null);
      return;
    }

    async function fetchLogs() {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`${BACKEND_URL}/v1/endpoints/${activeEndpointId}/webhooks`, {
          headers: authHeaders
        });
        if (!res.ok) throw new Error('Failed to fetch logs');
        const data = await res.json();
        setWebhooks(data);
        setActiveWebhook(data[0] || null);
      } catch (err) {
        console.error('Failed to fetch webhook logs:', err);
      }
    }
    fetchLogs();
  }, [activeEndpointId, isDemoMode, user]);

  // Manage WS connection for active endpoint
  useEffect(() => {
    if (!activeEndpointId || isDemoMode || !user) {
      setWsConnected(false);
      return;
    }

    // Close existing socket
    if (socketRef.current) {
      socketRef.current.close();
    }

    const endpoint = endpoints.find(e => e.id === activeEndpointId);
    if (!endpoint) return;

    const ws = new WebSocket(`${WS_URL}/v1/stream?endpoint_id=${endpoint.id}&token=${endpoint.token}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log(`WebSocket streaming active for endpoint: ${endpoint.id}`);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setWebhooks(prev => [payload, ...prev]);
        setLatestWebhook(payload);
        // Default select newly incoming webhook
        setActiveWebhook(payload);
      } catch (err) {
        console.error('Error parsing WS message payload:', err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log(`WebSocket disconnected for endpoint: ${endpoint.id}`);
    };

    return () => {
      if (ws) ws.close();
    };
  }, [activeEndpointId, endpoints, isDemoMode, user]);

  // Endpoint CRUD
  const handleCreateEndpoint = async (name) => {
    setIsCreating(true);
    if (isDemoMode) {
      // Mock creation
      const mockId = 'ep_' + Math.random().toString(36).substring(2, 10);
      const mockToken = 'ms_live_' + Math.random().toString(36).substring(2, 14);
      const newEp = { id: mockId, token: mockToken, name, created_at: new Date().toISOString() };
      setEndpoints(prev => [newEp, ...prev]);
      setActiveEndpointId(mockId);
      setIsCreating(false);
      return;
    }

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/v1/endpoints`, {
        method: 'POST',
        headers: { 
          'content-type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      setEndpoints(prev => [data, ...prev]);
      setActiveEndpointId(data.id);
    } catch (err) {
      console.error('Failed to create endpoint:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClearWebhooks = () => {
    setWebhooks([]);
    setActiveWebhook(null);
  };

  // Demo simulator trigger
  const handleSimulateWebhook = () => {
    const providers = ['Stripe', 'Shopify', 'GitHub'];
    const activeEp = endpoints.find(e => e.id === activeEndpointId);
    const provider = providers[Math.floor(Math.random() * providers.length)];
    
    let mockWebhook = {};
    const randomId = 'wh_demo' + Math.random().toString(36).substring(2, 8);
    const start = Date.now();

    if (provider === 'Stripe') {
      mockWebhook = {
        id: randomId,
        endpoint_id: activeEndpointId,
        method: 'POST',
        path: '/v1/stripe/charges',
        headers: {
          host: 'api.mockstream.dev',
          'content-type': 'application/json',
          'user-agent': 'Stripe/v1 webhook-delivery',
          'stripe-signature': 't=1672531199,v1=sha256_mock_sig_value_992'
        },
        body: {
          id: 'evt_stripe_' + Math.random().toString(36).substring(2, 10),
          object: 'event',
          api_version: '2023-10-16',
          created: Math.floor(Date.now() / 1000),
          data: {
            object: {
              id: 'ch_stripe_' + Math.random().toString(36).substring(2, 10),
              amount: Math.floor(Math.random() * 10000) + 500,
              currency: 'usd',
              customer: 'cus_mock_9921',
              status: 'succeeded'
            }
          },
          type: 'charge.succeeded'
        },
        query: {},
        status: 202,
        latency_ms: Math.floor(Math.random() * 30) + 5,
        received_at: new Date().toISOString()
      };
    } else if (provider === 'Shopify') {
      mockWebhook = {
        id: randomId,
        endpoint_id: activeEndpointId,
        method: 'POST',
        path: '/webhooks/orders/create',
        headers: {
          host: 'api.mockstream.dev',
          'content-type': 'application/json',
          'user-agent': 'Shopify-Webhook-Ingress',
          'x-shopify-topic': 'orders/create',
          'x-shopify-shop-domain': 'my-mock-store.myshopify.com'
        },
        body: {
          id: Math.floor(Math.random() * 90000000) + 10000000,
          email: 'customer@email.com',
          total_price: (Math.random() * 150 + 20).toFixed(2),
          currency: 'USD',
          line_items: [
            { id: 4992102, title: 'Mock Developer Hoodie', price: '45.00', quantity: 1 }
          ],
          shipping_address: { city: 'San Francisco', country: 'United States' }
        },
        query: { shop: 'my-mock-store.myshopify.com' },
        status: 202,
        latency_ms: Math.floor(Math.random() * 30) + 5,
        received_at: new Date().toISOString()
      };
    } else {
      mockWebhook = {
        id: randomId,
        endpoint_id: activeEndpointId,
        method: 'POST',
        path: '/github/push-event',
        headers: {
          host: 'api.mockstream.dev',
          'content-type': 'application/json',
          'user-agent': 'GitHub-Hookshot/9f91a',
          'x-github-event': 'push',
          'x-github-delivery': '7f2a1b9c-499d-11ee'
        },
        body: {
          ref: 'refs/heads/main',
          before: '9b3c4f2d1e0a9b3c4f2d1e0a9b3c4f2d1e0a9b3c',
          after: '5a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b',
          repository: {
            name: 'MockStream',
            full_name: 'dev-workspace/MockStream',
            owner: { name: 'developer' }
          },
          pusher: { name: 'git-coder', email: 'coder@workspace.dev' },
          commits: [
            { id: '5a2b1c0', message: 'feat: add interactive graph simulation', author: { name: 'git-coder' } }
          ]
        },
        query: {},
        status: 202,
        latency_ms: Math.floor(Math.random() * 30) + 5,
        received_at: new Date().toISOString()
      };
    }

    setWebhooks(prev => [mockWebhook, ...prev]);
    setLatestWebhook(mockWebhook);
    setActiveWebhook(mockWebhook);
  };

  const activeEp = endpoints.find(e => e.id === activeEndpointId);
  const ingestUrl = activeEp ? `${BACKEND_URL}/ingest/${activeEp.id}` : '';
  const curlCommand = activeEp ? `curl -X POST ${ingestUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"event": "test.ping", "data": {"status": "active", "timestamp": ${Math.floor(Date.now() / 1000)}}}'` : '';

  const copyToClipboard = (text, setCopiedState) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#06060f',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span className="spinner" style={{ width: '32px', height: '32px' }}></span>
          <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Securing Gateway Connection...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onMockLogin={handleMockLogin} />;
  }

  return (
    <div className="app-container">
      <EndpointSidebar
        endpoints={endpoints}
        activeEndpointId={activeEndpointId}
        onSelectEndpoint={setActiveEndpointId}
        onCreateEndpoint={handleCreateEndpoint}
        isCreating={isCreating}
        wsConnected={wsConnected}
        user={user}
        onLogOut={handleLogOut}
      />

      <main className="main-content">
        {/* Header */}
        <div className="header-wrapper">
          <span className="badge badge-purple">
            <span className={`dot ${wsConnected || isDemoMode ? 'dot-green' : ''}`}></span>
            {isDemoMode ? 'SIMULATOR ON' : wsConnected ? 'LIVE STREAM ACTIVE' : 'CONNECTING BACKEND'}
          </span>
          <h1 className="header-title">MockStream Dashboard</h1>
          <p className="header-subtitle">Real-time Webhook Ingestion, Inspection, and Request Replay</p>
        </div>

        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="demo-banner">
            <div>
              <strong>⚠️ Developer sandbox mode active:</strong> The backend server was not detected on port 5000. Running with mock simulations.
            </div>
            <button className="btn-demo-trigger" onClick={handleSimulateWebhook}>
              <Zap size={12} style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }} />
              Simulate Ingress Event
            </button>
          </div>
        )}

        {activeEp && (
          <>
            {/* Endpoint Configuration Card */}
            <div className="glass endpoint-setup-card">
              <div className="spec-title" style={{ color: 'var(--color-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} />
                Endpoint Route configurations
              </div>
              <div className="endpoint-setup-grid">
                <div>
                  <div className="form-label" style={{ fontSize: '10px' }}>Static Public Webhook URL</div>
                  <div className="url-box">
                    <input type="text" readOnly className="url-input" value={ingestUrl} />
                    <button className="btn-icon" onClick={() => copyToClipboard(ingestUrl, setCopiedUrl)}>
                      {copiedUrl ? <Check size={14} className="code-green" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="form-label" style={{ fontSize: '10px' }}>WebSocket Token Credentials</div>
                  <div className="url-box">
                    <input type="text" readOnly className="url-input" style={{ color: '#c4b5fd' }} value={`endpoint_id=${activeEp.id}&token=${activeEp.token}`} />
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '16px' }}>
                <div className="form-label" style={{ fontSize: '10px' }}>Send Quick Test Command (curl)</div>
                <div className="url-box">
                  <input type="text" readOnly className="url-input" style={{ color: '#e2e8f0', fontSize: '10.5px' }} value={curlCommand} />
                  <button className="btn-icon" onClick={() => copyToClipboard(curlCommand, setCopiedCurl)}>
                    {copiedCurl ? <Check size={14} className="code-green" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Ingestion Visual Pipeline */}
            <PipelineVisualizer lastWebhook={latestWebhook} />

            {/* Dashboard Terminal & Details Panel */}
            <WebhookTerminal
              webhooks={webhooks}
              activeWebhook={activeWebhook}
              onSelectWebhook={setActiveWebhook}
              onClearWebhooks={handleClearWebhooks}
              backendUrl={BACKEND_URL}
            />

            <div className="divider"></div>

            {/* Performance metrics & SLAs */}
            <div className="section-label">05 — Performance SLA Diagnostics</div>
            <div className="metrics-row">
              <div className="metric-card glass">
                <div className="metric-value color-green">
                  {latestWebhook ? `${latestWebhook.latency_ms || 2}ms` : '≤100ms'}
                </div>
                <div className="metric-label">Ingestion Response ACK</div>
              </div>
              <div className="metric-card glass">
                <div className="metric-value color-blue">
                  {isDemoMode ? '~0ms' : wsConnected ? '<1ms' : 'Offline'}
                </div>
                <div className="metric-label">WS Streaming Latency</div>
              </div>
              <div className="metric-card glass">
                <div className="metric-value color-purple">
                  <Database size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  ACID
                </div>
                <div className="metric-label">Persistence Guarantee</div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Mock database values for simulation
function getMockWebhookLogs(endpointId) {
  if (endpointId === 'ep_8f9a2b') {
    return [
      {
        id: 'wh_st_22109',
        endpoint_id: endpointId,
        method: 'POST',
        path: '/v1/stripe/charges',
        headers: {
          'host': 'api.mockstream.dev',
          'content-type': 'application/json',
          'user-agent': 'Stripe/v1 webhook-delivery',
          'stripe-signature': 't=1672531199,v1=sha256_sig_value_9a2b'
        },
        body: {
          id: 'evt_1O5S3K2eZvKYlo2C8891d2c',
          object: 'event',
          api_version: '2023-10-16',
          created: 1698305020,
          data: {
            object: {
              id: 'ch_3O5S3K2eZvKYlo2C33f11b2',
              amount: 4900,
              currency: 'usd',
              customer: 'cus_O5S3K2eZvKY',
              status: 'succeeded',
              receipt_email: 'buyer@example.com'
            }
          },
          type: 'charge.succeeded'
        },
        query: {},
        status: 202,
        latency_ms: 12,
        received_at: new Date(Date.now() - 60000).toISOString()
      },
      {
        id: 'wh_st_11902',
        endpoint_id: endpointId,
        method: 'POST',
        path: '/v1/stripe/charges',
        headers: {
          'host': 'api.mockstream.dev',
          'content-type': 'application/json',
          'user-agent': 'Stripe/v1 webhook-delivery'
        },
        body: {
          id: 'evt_1O5S3K2eZvKYlo2C991823d',
          object: 'event',
          type: 'customer.created',
          created: 1698304900,
          data: {
            object: {
              id: 'cus_O5S3K2eZvKY',
              email: 'buyer@example.com',
              name: 'Developer Workspace'
            }
          }
        },
        query: {},
        status: 202,
        latency_ms: 9,
        received_at: new Date(Date.now() - 180000).toISOString()
      }
    ];
  } else if (endpointId === 'ep_12c34d') {
    return [
      {
        id: 'wh_sh_44821',
        endpoint_id: endpointId,
        method: 'POST',
        path: '/webhooks/orders/create',
        headers: {
          'host': 'api.mockstream.dev',
          'content-type': 'application/json',
          'user-agent': 'Shopify-Webhook-Ingress',
          'x-shopify-topic': 'orders/create'
        },
        body: {
          id: 5678229103,
          email: 'shopify-buyer@gmail.com',
          total_price: '89.90',
          currency: 'USD',
          line_items: [
            { id: 9811228, title: 'Glassmorphic Developer Deskpad', price: '89.90', quantity: 1 }
          ]
        },
        query: { shop: 'my-mock-store.myshopify.com' },
        status: 202,
        latency_ms: 22,
        received_at: new Date(Date.now() - 40000).toISOString()
      }
    ];
  }
  return [];
}
