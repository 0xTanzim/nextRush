#!/usr/bin/env tsx

/**
 * 🚀 Express.js Benchmark Adapter
 *
 * Comprehensive Express.js server setup for benchmarking
 */

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

export class ExpressAdapter {
  private app: express.Application;
  private server: any;
  private port: number = 0;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());

    // Performance middleware
    this.app.use(compression());

    // Rate limiting - DISABLED for benchmarks
    // const limiter = rateLimit({
    //   windowMs: 15 * 60 * 1000, // 15 minutes
    //   max: 1000, // limit each IP to 1000 requests per windowMs
    //   message: 'Too many requests from this IP',
    // });
    // this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
          `← ${new Date().toISOString()} ${req.ip} ${req.method} ${req.path} ${res.statusCode} ${duration}ms ${res.get('content-length') || 0}b "${req.get('user-agent') || '-'}" "${req.get('referer') || '-'}"`
        );
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Basic API
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Express.js API',
        version: '4.18.2',
        timestamp: Date.now(),
        uptime: process.uptime(),
      });
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      });
    });

    // CRUD operations
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
    ];

    // List users
    this.app.get('/api/users', (req, res) => {
      res.json({
        users,
        total: users.length,
        page: 1,
        limit: 10,
      });
    });

    // Get user by ID
    this.app.get('/api/users/:id', (req, res) => {
      const user = users.find(u => u.id === parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    });

    // Create user
    this.app.post('/api/users', (req, res) => {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }
      const newUser = {
        id: users.length + 1,
        name,
        email,
      };
      users.push(newUser);
      res.status(201).json(newUser);
    });

    // Update user
    this.app.put('/api/users/:id', (req, res) => {
      const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      const { name, email } = req.body;
      users[userIndex] = { ...users[userIndex], name, email };
      res.json(users[userIndex]);
    });

    // Search functionality
    this.app.get('/api/search', (req, res) => {
      const { q, page = 1, limit = 20 } = req.query;
      const results = users.filter(
        user =>
          user.name
            .toLowerCase()
            .includes(((q as string) || '').toLowerCase()) ||
          user.email.toLowerCase().includes(((q as string) || '').toLowerCase())
      );
      res.json({
        results,
        total: results.length,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        query: q,
      });
    });

    // Large payload test
    this.app.post('/api/upload', (req, res) => {
      const data = req.body;
      res.json({
        message: 'Data received',
        size: JSON.stringify(data).length,
        items: Array.isArray(data) ? data.length : 1,
        timestamp: Date.now(),
      });
    });

    // Error handling
    this.app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error('Express error:', err);
        res.status(500).json({
          error: 'Internal server error',
          message: err.message,
          timestamp: Date.now(),
        });
      }
    );

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
      });
    });
  }

  async setup(): Promise<{ port: number; server: any }> {
    return new Promise(resolve => {
      this.server = this.app.listen(0, () => {
        const address = this.server.address();
        this.port = (address as any).port;
        console.log(`📡 Express server started on port ${this.port}`);
        resolve({ port: this.port, server: this.server });
      });
    });
  }

  async teardown(): Promise<void> {
    if (this.server) {
      return new Promise(resolve => {
        this.server.close(() => {
          console.log('🧹 Express server shutdown complete');
          resolve();
        });
      });
    }
  }

  getName(): string {
    return 'Express.js';
  }

  getVersion(): string {
    return '4.18.2';
  }
}
