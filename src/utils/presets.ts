/**
 * Preset Utilities - Common middleware and configuration presets
 */

export function defaultPreset() {
  return {
    cors: true,
    json: { limit: '10mb' },
    urlencoded: { extended: true, limit: '10mb' },
    static: true,
    compression: true
  };
}

export function apiPreset() {
  return {
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    },
    json: { limit: '1mb' },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  };
}

export function webappPreset() {
  return {
    static: { root: './public' },
    views: { engine: 'mustache', directory: './views' },
    compression: true,
    session: {
      secret: 'your-secret-key',
      resave: false,
      saveUninitialized: false
    }
  };
}

export function securityPreset() {
  return {
    helmet: true,
    cors: {
      origin: false,
      credentials: false
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50
    },
    compression: false
  };
}
