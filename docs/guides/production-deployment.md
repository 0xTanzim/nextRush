# 🚀 Production Deployment Guide

Comprehensive guide to deploying NextRush v2 applications to production environments with best practices for security, performance, and reliability.

---

## 📖 **Table of Contents**

1. [Pre-Deployment Checklist](#-pre-deployment-checklist)
2. [Environment Configuration](#-environment-configuration)
3. [Docker Deployment](#-docker-deployment)
4. [Cloud Platform Deployment](#-cloud-platform-deployment)
5. [Process Management](#-process-management)
6. [Load Balancing](#-load-balancing)
7. [SSL/TLS Configuration](#-ssltls-configuration)
8. [Monitoring and Logging](#-monitoring-and-logging)
9. [CI/CD Pipeline](#-cicd-pipeline)

---

## ✅ **Pre-Deployment Checklist**

### **Code Quality Checks**

```bash
# Run all tests
npm test

# Check code coverage (should be >90%)
npm run test:coverage

# Run linting
npm run lint

# Run type checking
npm run type-check

# Build production bundle
npm run build

# Security audit
npm audit --audit-level high

# Check for outdated dependencies
npm outdated
```

### **Security Hardening**

```typescript
// production-security.ts
import { createApp, helmet, rateLimit, cors } from 'nextrush';

const app = createApp();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Remove sensitive headers
app.use((ctx, next) => {
  ctx.res.removeHeader('X-Powered-By');
  ctx.res.removeHeader('Server');
  return next();
});
```

### **Performance Optimization**

```typescript
// production-performance.ts
import { createApp, compression, etag } from 'nextrush';

const app = createApp({
  // Production optimizations
  trustProxy: true,
  env: 'production',

  // HTTP settings
  keepAliveTimeout: 65000,
  headersTimeout: 66000,
  requestTimeout: 30000,
  maxConnections: 1000,

  // Memory settings
  maxOldSpaceSize: '4gb',
  maxSemiSpaceSize: '256mb',
});

// Compression
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// ETag support
app.use(etag());

// Static file caching
app.use(
  '/static',
  express.static('public', {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes for HTML
      }
    },
  })
);
```

---

## ⚙️ **Environment Configuration**

### **Environment Variables**

```bash
# .env.production
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://host:port/0

# Security
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key
SESSION_SECRET=your-session-secret

# External services
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key

# API keys
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG....

# Performance
CLUSTER_WORKERS=4
MAX_MEMORY=4096
CACHE_TTL=3600

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### **Configuration Management**

```typescript
// config/production.ts
import { z } from 'zod';

const productionConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.literal('production'),

  database: z.object({
    url: z.string().url(),
    maxConnections: z.number().default(20),
    idleTimeout: z.number().default(30000),
  }),

  redis: z.object({
    url: z.string().url(),
    maxRetriesPerRequest: z.number().default(3),
  }),

  security: z.object({
    jwtSecret: z.string().min(32),
    encryptionKey: z.string().length(32),
    sessionSecret: z.string().min(32),
  }),

  aws: z.object({
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    region: z.string(),
  }),

  monitoring: z.object({
    sentryDsn: z.string().url().optional(),
    newRelicKey: z.string().optional(),
  }),

  performance: z.object({
    clusterWorkers: z.number().default(require('os').cpus().length),
    maxMemory: z.number().default(4096),
    cacheTtl: z.number().default(3600),
  }),
});

export const config = productionConfigSchema.parse({
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV,

  database: {
    url: process.env.DATABASE_URL,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  },

  redis: {
    url: process.env.REDIS_URL,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
    sessionSecret: process.env.SESSION_SECRET,
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  },

  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    newRelicKey: process.env.NEW_RELIC_LICENSE_KEY,
  },

  performance: {
    clusterWorkers: parseInt(
      process.env.CLUSTER_WORKERS || String(require('os').cpus().length)
    ),
    maxMemory: parseInt(process.env.MAX_MEMORY || '4096'),
    cacheTtl: parseInt(process.env.CACHE_TTL || '3600'),
  },
});
```

---

## 🐳 **Docker Deployment**

### **Dockerfile**

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "dist/index.js"]
```

### **Docker Compose for Production**

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: nextrush-app:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/nextrush
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/app/logs
    networks:
      - app-network
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=nextrush
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 256M

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

### **Health Check Script**

```javascript
// healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
  timeout: 2000,
};

const req = http.request(options, res => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    console.error(`Health check failed with status: ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', err => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();
```

---

## ☁️ **Cloud Platform Deployment**

### **AWS ECS Deployment**

```json
{
  "family": "nextrush-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "nextrush-app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/nextrush:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/nextrush-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node healthcheck.js"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### **Kubernetes Deployment**

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nextrush-app
  labels:
    app: nextrush-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nextrush-app
  template:
    metadata:
      labels:
        app: nextrush-app
    spec:
      containers:
        - name: nextrush-app
          image: nextrush-app:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: redis-url
          resources:
            requests:
              memory: '512Mi'
              cpu: '500m'
            limits:
              memory: '1Gi'
              cpu: '1000m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: nextrush-service
spec:
  selector:
    app: nextrush-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nextrush-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.yourdomain.com
      secretName: nextrush-tls
  rules:
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nextrush-service
                port:
                  number: 80
```

### **Vercel Deployment**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/index.ts": {
      "maxDuration": 30
    }
  },
  "regions": ["iad1"]
}
```

---

## ⚡ **Process Management**

### **PM2 Configuration**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'nextrush-app',
      script: './dist/index.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Performance
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',

      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Auto restart
      watch: false,
      ignore_watch: ['node_modules', 'logs'],

      // Graceful reload
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Health monitoring
      min_uptime: '10s',
      max_restarts: 10,

      // Source maps
      source_map_support: true,

      // Cron restart (optional)
      cron_restart: '0 2 * * *', // Restart daily at 2 AM
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:username/nextrush-app.git',
      path: '/var/www/nextrush-app',
      'post-deploy':
        'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
```

### **Systemd Service**

```ini
# /etc/systemd/system/nextrush-app.service
[Unit]
Description=NextRush Application
After=network.target

[Service]
Type=simple
User=nextrush
WorkingDirectory=/opt/nextrush-app
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nextrush-app
Environment=NODE_ENV=production
Environment=PORT=3000

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/nextrush-app/logs

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

---

## ⚖️ **Load Balancing**

### **Nginx Configuration**

```nginx
# /etc/nginx/sites-available/nextrush-app
upstream nextrush_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3003 max_fails=3 fail_timeout=30s;

    # Health check
    keepalive 32;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

# Cache zones
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m use_temp_path=off;

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # API routes
    location /api/ {
        # Rate limiting
        limit_req zone=api burst=20 nodelay;

        # Proxy settings
        proxy_pass http://nextrush_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Caching for GET requests
        proxy_cache api_cache;
        proxy_cache_methods GET HEAD;
        proxy_cache_valid 200 302 5m;
        proxy_cache_valid 404 1m;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;
    }

    # Auth routes (stricter rate limiting)
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;

        proxy_pass http://nextrush_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # No caching for auth
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }

    # Health check
    location /health {
        proxy_pass http://nextrush_backend;
        access_log off;
    }

    # Static files
    location /static/ {
        root /var/www/nextrush-app;
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip_static on;
    }
}
```

### **HAProxy Configuration**

```
# /etc/haproxy/haproxy.cfg
global
    daemon
    maxconn 4096
    log stdout local0

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    option dontlognull

frontend nextrush_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/nextrush.pem
    redirect scheme https if !{ ssl_fc }

    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request reject if { sc_http_req_rate(0) gt 20 }

    default_backend nextrush_backend

backend nextrush_backend
    balance roundrobin
    option httpchk GET /health HTTP/1.1\r\nHost:\ api.yourdomain.com

    server app1 127.0.0.1:3000 check inter 5s
    server app2 127.0.0.1:3001 check inter 5s
    server app3 127.0.0.1:3002 check inter 5s
    server app4 127.0.0.1:3003 check inter 5s
```

---

## 🔒 **SSL/TLS Configuration**

### **Let's Encrypt with Certbot**

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### **SSL Configuration for Express**

```typescript
// ssl-server.ts
import https from 'https';
import fs from 'fs';
import { createApp } from 'nextrush';

const app = createApp();

// SSL options
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/api.yourdomain.com/privkey.pem'),
  cert: fs.readFileSync(
    '/etc/letsencrypt/live/api.yourdomain.com/fullchain.pem'
  ),

  // Security settings
  secureProtocol: 'TLSv1_2_method',
  honorCipherOrder: true,
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384',
  ].join(':'),
};

// Create HTTPS server
const server = https.createServer(sslOptions, app.callback());

server.listen(443, () => {
  console.log('HTTPS Server running on port 443');
});

// Redirect HTTP to HTTPS
const http = require('http');
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers.host + req.url });
    res.end();
  })
  .listen(80);
```

---

## 📊 **Monitoring and Logging**

### **Structured Logging**

```typescript
// logging.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'nextrush-app',
    version: process.env.npm_package_version,
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File output
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),

    // Elasticsearch (for production)
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD,
        },
      },
      index: 'nextrush-logs',
    }),
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],

  // Handle unhandled rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Request logging middleware
export const requestLogger = () => {
  return async (ctx: Context, next: () => Promise<void>) => {
    const start = Date.now();

    try {
      await next();

      const duration = Date.now() - start;

      logger.info('Request completed', {
        method: ctx.method,
        path: ctx.path,
        status: ctx.res.statusCode,
        duration,
        userAgent: ctx.req.headers['user-agent'],
        ip: ctx.ip,
        userId: ctx.user?.id,
      });
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Request failed', {
        method: ctx.method,
        path: ctx.path,
        status: 500,
        duration,
        error: error.message,
        stack: error.stack,
        userAgent: ctx.req.headers['user-agent'],
        ip: ctx.ip,
        userId: ctx.user?.id,
      });

      throw error;
    }
  };
};
```

### **Application Monitoring**

```typescript
// monitoring.ts
import Prometheus from 'prom-client';
import { EventEmitter } from 'events';

// Create metrics
const metrics = {
  httpRequestsTotal: new Prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'status', 'route'],
  }),

  httpRequestDuration: new Prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5],
  }),

  activeConnections: new Prometheus.Gauge({
    name: 'http_active_connections',
    help: 'Active HTTP connections',
  }),

  memoryUsage: new Prometheus.Gauge({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage',
    labelNames: ['type'],
  }),

  eventLoopLag: new Prometheus.Gauge({
    name: 'nodejs_eventloop_lag_seconds',
    help: 'Event loop lag',
  }),

  databaseConnections: new Prometheus.Gauge({
    name: 'database_connections',
    help: 'Database connections',
    labelNames: ['state'],
  }),
};

// Collect default metrics
Prometheus.collectDefaultMetrics({ prefix: 'nodejs_' });

// Custom metrics collection
class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    this.startCollection();
  }

  private startCollection() {
    // Memory metrics
    setInterval(() => {
      const usage = process.memoryUsage();
      metrics.memoryUsage.set({ type: 'heap_used' }, usage.heapUsed);
      metrics.memoryUsage.set({ type: 'heap_total' }, usage.heapTotal);
      metrics.memoryUsage.set({ type: 'rss' }, usage.rss);
      metrics.memoryUsage.set({ type: 'external' }, usage.external);
    }, 30000);

    // Event loop lag
    setInterval(() => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e9;
        metrics.eventLoopLag.set(lag);
      });
    }, 5000);
  }

  recordRequest(
    method: string,
    route: string,
    status: number,
    duration: number
  ) {
    metrics.httpRequestsTotal.inc({ method, status: status.toString(), route });
    metrics.httpRequestDuration.observe({ method, route }, duration / 1000);
  }

  setActiveConnections(count: number) {
    metrics.activeConnections.set(count);
  }

  setDatabaseConnections(active: number, idle: number) {
    metrics.databaseConnections.set({ state: 'active' }, active);
    metrics.databaseConnections.set({ state: 'idle' }, idle);
  }
}

export const metricsCollector = new MetricsCollector();

// Monitoring middleware
export const monitoringMiddleware = () => {
  return async (ctx: Context, next: () => Promise<void>) => {
    const start = Date.now();

    try {
      await next();

      const duration = Date.now() - start;
      const route = ctx.route?.path || ctx.path;

      metricsCollector.recordRequest(
        ctx.method,
        route,
        ctx.res.statusCode,
        duration
      );
    } catch (error) {
      const duration = Date.now() - start;
      const route = ctx.route?.path || ctx.path;

      metricsCollector.recordRequest(ctx.method, route, 500, duration);

      throw error;
    }
  };
};

// Metrics endpoint
export const setupMetricsEndpoint = (app: any) => {
  app.get('/metrics', ctx => {
    ctx.res.setHeader('Content-Type', Prometheus.register.contentType);
    ctx.body = Prometheus.register.metrics();
  });
};
```

---

## 🔄 **CI/CD Pipeline**

### **GitHub Actions**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Check test coverage
        run: npm run test:coverage

      - name: Security audit
        run: npm audit --audit-level high

  build:
    needs: test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [test, build]
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to production
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            # Pull latest image
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main

            # Stop current container
            docker stop nextrush-app || true
            docker rm nextrush-app || true

            # Start new container
            docker run -d \
              --name nextrush-app \
              --restart unless-stopped \
              -p 3000:3000 \
              --env-file /opt/nextrush/.env.production \
              ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main

            # Health check
            sleep 30
            curl -f http://localhost:3000/health || exit 1

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### **Deployment Scripts**

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Starting deployment..."

# Configuration
APP_NAME="nextrush-app"
IMAGE_NAME="nextrush-app:latest"
CONTAINER_NAME="nextrush-app"
ENV_FILE="/opt/nextrush/.env.production"

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

# Build new image
echo "🏗️ Building new image..."
docker build -t $IMAGE_NAME .

# Run tests in container
echo "🧪 Running tests..."
docker run --rm \
    -e NODE_ENV=test \
    -e DATABASE_URL=postgresql://test:test@db:5432/test \
    $IMAGE_NAME npm test

# Stop current container gracefully
echo "⏹️ Stopping current container..."
if docker ps -q --filter name=$CONTAINER_NAME | grep -q .; then
    docker stop $CONTAINER_NAME
    docker wait $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# Start new container
echo "▶️ Starting new container..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p 3000:3000 \
    --env-file $ENV_FILE \
    --log-driver=json-file \
    --log-opt max-size=100m \
    --log-opt max-file=3 \
    $IMAGE_NAME

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 10

# Health check
echo "🏥 Running health check..."
for i in {1..30}; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
        break
    fi

    if [ $i -eq 30 ]; then
        echo "❌ Health check failed"
        docker logs $CONTAINER_NAME
        exit 1
    fi

    sleep 2
done

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "🎉 Deployment completed successfully!"

# Send notification (optional)
if [ ! -z "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"✅ Production deployment completed successfully"}' \
        $SLACK_WEBHOOK
fi
```

---

## 💡 **Production Best Practices**

### **1. Zero-Downtime Deployment**

```bash
# Blue-green deployment script
./scripts/deploy-blue-green.sh
```

### **2. Database Migrations**

```bash
# Run migrations before deployment
npm run db:migrate
```

### **3. Graceful Shutdown**

```typescript
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
```

### **4. Environment Validation**

```typescript
// Validate all required environment variables on startup
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];
const missing = requiredEnvVars.filter(env => !process.env[env]);

if (missing.length > 0) {
  console.error('Missing required environment variables:', missing);
  process.exit(1);
}
```

---

## 📖 **Next Steps**

1. **Set up monitoring** with Prometheus/Grafana
2. **Configure alerting** for critical metrics
3. **Implement backup strategies** for data
4. **Set up log aggregation** with ELK stack
5. **Plan disaster recovery** procedures

---

## 📖 **See Also**

- [Performance Optimization Guide](./performance-optimization.md)
- [Monitoring Guide](./monitoring.md)
- [Security Best Practices](./security-guide.md)
- [Docker Guide](./docker-guide.md)
