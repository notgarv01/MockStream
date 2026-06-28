import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import * as db from './database.js';
import * as pubsub from './pubsub.js';

dotenv.config();

let isFirebaseConfigured = false;
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    isFirebaseConfigured = true;
    console.log('Firebase Auth initialized successfully');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err.message);
  }
} else {
  console.warn('⚠️ WARNING: Firebase environment variables are not fully configured. API endpoints will run without authentication controls.');
}

const fastify = Fastify({
  logger: {
    level: 'info'
  }
});

// Register CORS
await fastify.register(cors, {
  origin: '*'
});

// Register WebSocket
await fastify.register(websocket);

// Authenticate decorator hook
fastify.decorate('authenticate', async (request, reply) => {
  if (!isFirebaseConfigured) {
    // Development fallback
    request.user = { uid: 'dev_user_uid', email: 'dev@mockstream.dev' };
    return;
  }
  
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Missing Authorization header' });
    }
    const token = authHeader.split('Bearer ')[1];
    
    // Allow local dev bypass
    if (token === 'mock-dev-token' && process.env.NODE_ENV !== 'production') {
      request.user = { uid: 'dev_user_uid', email: 'dev@mockstream.dev' };
      return;
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    request.user = decodedToken;
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired Firebase ID token' });
  }
});

// Initialize DB and PubSub
await db.init();
await pubsub.init();

// Ingestion Endpoint (POST /ingest/:endpoint_id)
fastify.all('/ingest/:endpoint_id', async (request, reply) => {
  const { endpoint_id } = request.params;
  const start = Date.now();
  
  // Check if endpoint exists
  const endpoint = await db.getEndpoint(endpoint_id);
  if (!endpoint) {
    return reply.code(404).send({ error: 'Endpoint not found' });
  }

  const method = request.method;
  const path = request.url.replace(`/ingest/${endpoint_id}`, '') || '/';
  const headers = request.headers;
  const body = request.body;
  const query = request.query;

  // Acknowledge immediately (guaranteed <100ms)
  reply.code(202).send({ status: 'Accepted', message: 'Webhook received' });
  const latencyMs = Date.now() - start;

  // Process database write and websocket publish asynchronously
  (async () => {
    const webhookId = 'wh_' + uuidv4().replace(/-/g, '').slice(0, 12);
    await db.saveWebhook(
      webhookId,
      endpoint_id,
      method,
      path,
      headers,
      body,
      query,
      202,
      latencyMs
    );
    
    await pubsub.publish(`endpoint:${endpoint_id}`, {
      id: webhookId,
      endpoint_id,
      method,
      path,
      headers,
      body,
      query,
      status: 202,
      latency_ms: latencyMs,
      received_at: new Date().toISOString()
    });
  })().catch(err => {
    fastify.log.error(`Error processing webhook asynchronously: ${err.message}`);
  });
});

// Also support routes with subpaths (e.g. /ingest/:endpoint_id/*)
fastify.all('/ingest/:endpoint_id/*', async (request, reply) => {
  const { endpoint_id } = request.params;
  const start = Date.now();
  
  const endpoint = await db.getEndpoint(endpoint_id);
  if (!endpoint) {
    return reply.code(404).send({ error: 'Endpoint not found' });
  }

  const method = request.method;
  const path = '/' + request.params['*'];
  const headers = request.headers;
  const body = request.body;
  const query = request.query;

  reply.code(202).send({ status: 'Accepted', message: 'Webhook received' });
  const latencyMs = Date.now() - start;

  (async () => {
    const webhookId = 'wh_' + uuidv4().replace(/-/g, '').slice(0, 12);
    await db.saveWebhook(
      webhookId,
      endpoint_id,
      method,
      path,
      headers,
      body,
      query,
      202,
      latencyMs
    );
    
    await pubsub.publish(`endpoint:${endpoint_id}`, {
      id: webhookId,
      endpoint_id,
      method,
      path,
      headers,
      body,
      query,
      status: 202,
      latency_ms: latencyMs,
      received_at: new Date().toISOString()
    });
  })().catch(err => {
    fastify.log.error(`Error processing subpath webhook: ${err.message}`);
  });
});

// Health check
fastify.get('/v1/health', async (request, reply) => {
  return {
    status: 'ok',
    database: db.dbType,
    timestamp: new Date().toISOString()
  };
});

// List endpoints
fastify.get('/v1/endpoints', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const endpoints = await db.getEndpointsForUser(request.user.uid);
  return endpoints;
});

// Create endpoint
fastify.post('/v1/endpoints', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { name } = request.body || {};
  const endpointId = 'ep_' + uuidv4().replace(/-/g, '').slice(0, 8);
  const token = 'ms_live_' + uuidv4().replace(/-/g, '').slice(0, 12);
  
  const newEndpoint = await db.createEndpoint(endpointId, token, name || 'Unnamed Endpoint', request.user.uid);
  return newEndpoint;
});

// Get webhook history
fastify.get('/v1/endpoints/:endpoint_id/webhooks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { endpoint_id } = request.params;
  
  const endpoint = await db.getEndpoint(endpoint_id);
  if (!endpoint) {
    return reply.code(404).send({ error: 'Endpoint not found' });
  }
  if (isFirebaseConfigured && endpoint.userId !== request.user.uid) {
    return reply.code(403).send({ error: 'Forbidden', message: 'You do not own this endpoint' });
  }
  
  const webhooks = await db.getWebhooks(endpoint_id);
  return webhooks;
});

// Replay Engine Endpoint
fastify.post('/v1/replay', async (request, reply) => {
  const { target_url, method, headers, body } = request.body;
  
  if (!target_url) {
    return reply.code(400).send({ error: 'target_url is required' });
  }

  const start = Date.now();
  try {
    const cleanHeaders = { ...headers };
    // Remove conflicting header values
    delete cleanHeaders.host;
    delete cleanHeaders.connection;
    delete cleanHeaders['content-length'];

    const response = await fetch(target_url, {
      method: method || 'POST',
      headers: {
        'content-type': 'application/json',
        ...cleanHeaders
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const latencyMs = Date.now() - start;
    const resBodyText = await response.text();
    let resBody = resBodyText;
    try {
      resBody = JSON.parse(resBodyText);
    } catch {}

    const resHeaders = {};
    response.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    return {
      status: response.status,
      headers: resHeaders,
      body: resBody,
      latency_ms: latencyMs,
      success: response.ok
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return reply.code(502).send({
      error: 'Failed to deliver replayed request',
      message: err.message,
      latency_ms: latencyMs
    });
  }
});

// WebSocket Stream
fastify.get('/v1/stream', { websocket: true }, (connection, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const endpoint_id = url.searchParams.get('endpoint_id');
  const token = url.searchParams.get('token');

  if (!endpoint_id || !token) {
    connection.close(4001, 'Missing endpoint_id or token');
    return;
  }

  (async () => {
    // Validate credentials
    const endpoint = await db.getEndpoint(endpoint_id);
    if (!endpoint || endpoint.token !== token) {
      connection.close(4003, 'Unauthorized credentials');
      return;
    }

    // Subscribe to PubSub
    const unsubscribe = await pubsub.subscribe(`endpoint:${endpoint_id}`, (message) => {
      connection.send(message);
    });

    // Stream Maintenance / Keepalive
    let isAlive = true;
    connection.on('pong', () => {
      isAlive = true;
    });

    const T_interval = 10000; // 10s
    const pingInterval = setInterval(() => {
      if (isAlive === false) {
        clearInterval(pingInterval);
        unsubscribe();
        connection.terminate();
        return;
      }
      isAlive = false;
      connection.ping();
    }, T_interval);

    connection.on('close', () => {
      clearInterval(pingInterval);
      unsubscribe();
    });

    connection.on('error', (err) => {
      console.error(`WebSocket socket error: ${err.message}`);
      clearInterval(pingInterval);
      unsubscribe();
      connection.terminate();
    });
    
  })().catch(err => {
    console.error('Error starting WebSocket connection:', err);
    connection.close(5000, 'Internal server error');
  });
});

// Start Server
const start = async () => {
  try {
    const port = process.env.PORT || 5000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`MockStream server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
