import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbType = 'sqlite'; // 'sqlite', 'postgres', or 'mongodb'
let sqliteDb = null;
let pgPool = null;
let mongoClient = null;
let mongoDb = null;

export async function init() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString && (connectionString.startsWith('mongodb://') || connectionString.startsWith('mongodb+srv://'))) {
    dbType = 'mongodb';
    mongoClient = new MongoClient(connectionString);
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    
    // Create indexes for optimization
    await mongoDb.collection('endpoints').createIndex({ id: 1 }, { unique: true });
    await mongoDb.collection('webhooks').createIndex({ endpoint_id: 1 });
    await mongoDb.collection('webhooks').createIndex({ received_at: -1 });
    
    console.log('Database initialized: MongoDB');
  } else if (connectionString && connectionString.startsWith('postgres')) {
    dbType = 'postgres';
    pgPool = new pg.Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    
    // Create PostgreSQL tables
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS endpoints (
        id VARCHAR(50) PRIMARY KEY,
        token VARCHAR(100) NOT NULL,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id VARCHAR(50) PRIMARY KEY,
        endpoint_id VARCHAR(50) NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(255) NOT NULL,
        headers JSONB,
        body JSONB,
        query JSONB,
        status INTEGER,
        latency_ms INTEGER,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database initialized: PostgreSQL');
  } else {
    dbType = 'sqlite';
    const dbPath = path.join(__dirname, 'mockstream.db');
    sqliteDb = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Create SQLite tables
    await sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS endpoints (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        endpoint_id TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        query TEXT,
        status INTEGER,
        latency_ms INTEGER,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
      );
    `);
    
    console.log(`Database initialized: SQLite at ${dbPath}`);
  }
}

export async function createEndpoint(id, token, name) {
  if (dbType === 'mongodb') {
    const doc = { id, token, name, created_at: new Date() };
    await mongoDb.collection('endpoints').insertOne(doc);
    return doc;
  } else if (dbType === 'postgres') {
    await pgPool.query(
      'INSERT INTO endpoints (id, token, name) VALUES ($1, $2, $3)',
      [id, token, name]
    );
  } else {
    await sqliteDb.run(
      'INSERT INTO endpoints (id, token, name) VALUES (?, ?, ?)',
      [id, token, name]
    );
  }
  return { id, token, name };
}

export async function getEndpoint(id) {
  if (dbType === 'mongodb') {
    return await mongoDb.collection('endpoints').findOne({ id });
  } else if (dbType === 'postgres') {
    const res = await pgPool.query('SELECT * FROM endpoints WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    const row = await sqliteDb.get('SELECT * FROM endpoints WHERE id = ?', [id]);
    return row || null;
  }
}

export async function getEndpoints() {
  if (dbType === 'mongodb') {
    return await mongoDb.collection('endpoints')
      .find({})
      .sort({ created_at: -1 })
      .toArray();
  } else if (dbType === 'postgres') {
    const res = await pgPool.query('SELECT * FROM endpoints ORDER BY created_at DESC');
    return res.rows;
  } else {
    const rows = await sqliteDb.all('SELECT * FROM endpoints ORDER BY created_at DESC');
    return rows;
  }
}

export async function saveWebhook(id, endpoint_id, method, path, headers, body, query, status, latency_ms) {
  if (dbType === 'mongodb') {
    const doc = {
      id,
      endpoint_id,
      method,
      path,
      headers: headers || {},
      body: body || {},
      query: query || {},
      status,
      latency_ms,
      received_at: new Date()
    };
    await mongoDb.collection('webhooks').insertOne(doc);
  } else {
    const headersStr = JSON.stringify(headers || {});
    const bodyStr = JSON.stringify(body || {});
    const queryStr = JSON.stringify(query || {});
    
    if (dbType === 'postgres') {
      await pgPool.query(
        `INSERT INTO webhooks (id, endpoint_id, method, path, headers, body, query, status, latency_ms) 
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)`,
        [id, endpoint_id, method, path, headersStr, bodyStr, queryStr, status, latency_ms]
      );
    } else {
      await sqliteDb.run(
        `INSERT INTO webhooks (id, endpoint_id, method, path, headers, body, query, status, latency_ms) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, endpoint_id, method, path, headersStr, bodyStr, queryStr, status, latency_ms]
      );
    }
  }
}

export async function getWebhooks(endpoint_id) {
  if (dbType === 'mongodb') {
    return await mongoDb.collection('webhooks')
      .find({ endpoint_id })
      .sort({ received_at: -1 })
      .limit(100)
      .toArray();
  } else if (dbType === 'postgres') {
    const res = await pgPool.query(
      'SELECT * FROM webhooks WHERE endpoint_id = $1 ORDER BY received_at DESC LIMIT 100',
      [endpoint_id]
    );
    return res.rows;
  } else {
    const rows = await sqliteDb.all(
      'SELECT * FROM webhooks WHERE endpoint_id = ? ORDER BY received_at DESC LIMIT 100',
      [endpoint_id]
    );
    return rows.map(r => ({
      ...r,
      headers: JSON.parse(r.headers || '{}'),
      body: JSON.parse(r.body || '{}'),
      query: JSON.parse(r.query || '{}')
    }));
  }
}
