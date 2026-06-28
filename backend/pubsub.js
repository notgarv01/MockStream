import { createClient } from 'redis';
import { EventEmitter } from 'events';

let redisEnabled = false;
let pubClient = null;
let subClient = null;
const localEmitter = new EventEmitter();

export async function init() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      pubClient = createClient({ url: redisUrl });
      subClient = pubClient.duplicate();
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      redisEnabled = true;
      console.log('PubSub initialized: Redis');
    } catch (err) {
      console.error('Failed to connect to Redis, falling back to local EventEmitter:', err.message);
      redisEnabled = false;
    }
  } else {
    console.log('PubSub initialized: In-Memory EventEmitter');
  }
}

export async function publish(channel, message) {
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  if (redisEnabled && pubClient) {
    await pubClient.publish(channel, payload);
  } else {
    localEmitter.emit(channel, payload);
  }
}

export async function subscribe(channel, callback) {
  if (redisEnabled && subClient) {
    const handler = (message) => {
      callback(message);
    };
    await subClient.subscribe(channel, handler);
    return async () => {
      await subClient.unsubscribe(channel, handler);
    };
  } else {
    const handler = (message) => {
      callback(message);
    };
    localEmitter.on(channel, handler);
    return () => {
      localEmitter.off(channel, handler);
    };
  }
}
