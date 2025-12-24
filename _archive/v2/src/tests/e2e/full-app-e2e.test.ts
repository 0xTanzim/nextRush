/**
 * End-to-End tests for NextRush v2 application
 *
 * Tests the complete application from a user perspective
 */

import {
  GlobalExceptionFilter,
  ValidationExceptionFilter,
} from '@/errors/custom-errors';
import { createApp } from '@/index';
import type { Application } from '@/types/context';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Full Application E2E', () => {
  let app: Application;
  let server: any;
  const PORT = 3002;

  beforeAll(async () => {
    app = createApp({
      port: PORT,
      host: 'localhost',
      debug: true,
    });

    // Set up production-like middleware stack

    // Add exception filter first
    app.use(
      app.exceptionFilter([
        new ValidationExceptionFilter(),
        new GlobalExceptionFilter(),
      ])
    );

    app.use(
      app.helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
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

    app.use(
      app.cors({
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
        exposedHeaders: ['X-Request-ID', 'X-Response-Time'],
        maxAge: 86400,
      })
    );

    // Add body parser middleware
    app.use(app.smartBodyParser());

    app.use(
      app.requestId({
        headerName: 'X-Request-ID',
        generator: () =>
          `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        addResponseHeader: true,
        echoHeader: false,
        setInContext: true,
        includeInLogs: true,
      })
    );
    app.use(
      app.timer({
        header: 'X-Response-Time',
        digits: 3,
        format: 'milliseconds',
        includeStartTime: true,
        includeEndTime: true,
        includeDuration: true,
        logSlow: true,
        logSlowThreshold: 1000,
      })
    );
    app.use(
      app.rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // limit each IP to 1000 requests per windowMs for testing
        message: 'Too many requests from this IP',
        headers: true,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
      })
    );
    app.use(
      app.logger({
        format: 'combined',
        level: 'info',
        colorize: true,
        timestamp: true,
        showHeaders: true,
        showBody: false,
        showQuery: true,
        showResponseTime: true,
        showUserAgent: true,
        showIP: true,
      })
    );

    // Set up comprehensive API routes
    setupRoutes();

    // Global error handler
    app.use(async (ctx: any, next: () => Promise<void>) => {
      try {
        await next();
      } catch (error) {
        console.error('Global error handler:', error);

        if (ctx.res.headersSent) {
          return;
        }

        ctx.res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          requestId: ctx.id,
        });
      }
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      server = app.listen(PORT, 'localhost', () => {
        console.log(`E2E test server started on port ${PORT}`);
        resolve();
      });

      server.on('error', (err: Error) => {
        console.error('Server failed to start:', err);
        reject(err);
      });
    });

    // Additional readiness check - wait for server to accept connections
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (server) {
      await app.shutdown();
    }
  });

  function setupRoutes() {
    // Health and status endpoints
    app.get('/', ctx => {
      ctx.res.json({
        message: 'Welcome to NextRush v2 API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          users: '/api/users',
          posts: '/api/posts',
          comments: '/api/comments',
        },
      });
    });

    app.get('/health', ctx => {
      ctx.res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env['NODE_ENV'] || 'development',
      });
    });

    app.get('/status', ctx => {
      ctx.res.json({
        status: 'operational',
        services: {
          api: 'operational',
          database: 'operational',
          cache: 'operational',
        },
        lastChecked: new Date().toISOString(),
      });
    });

    // User management API
    app.get('/api/users', ctx => {
      const { page = '1', limit = '10', search = '' } = ctx.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // Mock user data
      const users = Array.from({ length: 50 }, (_, i) => ({
        id: `user_${i + 1}`,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: i === 0 ? 'admin' : 'user',
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      }));

      const filteredUsers = search
        ? users.filter(
            user =>
              user.name
                .toLowerCase()
                .includes((search as string).toLowerCase()) ||
              user.email
                .toLowerCase()
                .includes((search as string).toLowerCase())
          )
        : users;

      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      ctx.res.json({
        users: paginatedUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filteredUsers.length,
          pages: Math.ceil(filteredUsers.length / limitNum),
        },
      });
    });

    app.post('/api/users', ctx => {
      const {
        name,
        email,
        role = 'user',
      } = ctx.body as {
        name: string;
        email: string;
        role?: string;
      };

      if (!name || !email) {
        ctx.res.status(400).json({
          error: 'Validation failed',
          details: {
            name: !name ? 'Name is required' : undefined,
            email: !email ? 'Email is required' : undefined,
          },
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        ctx.res.status(400).json({
          error: 'Invalid email format',
          field: 'email',
        });
        return;
      }

      const newUser = {
        id: `user_${Date.now()}`,
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      };

      ctx.res.status(201).json(newUser);
    });

    app.get('/api/users/:id', ctx => {
      const { id } = ctx.params;

      // Mock user lookup
      if (id === 'user_1') {
        ctx.res.json({
          id: 'user_1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'admin',
          createdAt: new Date().toISOString(),
          profile: {
            bio: 'Software developer',
            location: 'San Francisco, CA',
            website: 'https://johndoe.com',
          },
        });
      } else {
        ctx.res.status(404).json({
          error: 'User not found',
          message: `User with ID ${id} does not exist`,
        });
      }
    });

    app.put('/api/users/:id', ctx => {
      const { id } = ctx.params;
      const { name, email, role } = ctx.body as {
        name?: string;
        email?: string;
        role?: string;
      };

      if (id === 'user_1') {
        ctx.res.json({
          id: 'user_1',
          name: name || 'John Doe',
          email: email || 'john@example.com',
          role: role || 'admin',
          updatedAt: new Date().toISOString(),
        });
      } else {
        ctx.res.status(404).json({
          error: 'User not found',
          message: `User with ID ${id} does not exist`,
        });
      }
    });

    app.delete('/api/users/:id', ctx => {
      const { id } = ctx.params;

      if (id === 'user_1') {
        ctx.res.status(204).end();
      } else {
        ctx.res.status(404).json({
          error: 'User not found',
          message: `User with ID ${id} does not exist`,
        });
      }
    });

    // Post management API
    app.get('/api/posts', ctx => {
      const { page = '1', limit = '10', category } = ctx.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // Mock posts data
      const posts = Array.from({ length: 100 }, (_, i) => ({
        id: `post_${i + 1}`,
        title: `Post ${i + 1}`,
        content: `This is the content for post ${i + 1}`,
        author: `user_${(i % 10) + 1}`,
        category: ['tech', 'lifestyle', 'news'][i % 3],
        tags: [`tag${i + 1}`, `tag${i + 2}`],
        publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
        readTime: Math.floor(Math.random() * 10) + 1,
      }));

      const filteredPosts = category
        ? posts.filter(post => post.category === category)
        : posts;

      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

      ctx.res.json({
        posts: paginatedPosts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filteredPosts.length,
          pages: Math.ceil(filteredPosts.length / limitNum),
        },
      });
    });

    app.post('/api/posts', ctx => {
      const {
        title,
        content,
        category,
        tags = [],
      } = ctx.body as {
        title: string;
        content: string;
        category: string;
        tags?: string[];
      };

      if (!title || !content || !category) {
        ctx.res.status(400).json({
          error: 'Validation failed',
          details: {
            title: !title ? 'Title is required' : undefined,
            content: !content ? 'Content is required' : undefined,
            category: !category ? 'Category is required' : undefined,
          },
        });
        return;
      }

      const newPost = {
        id: `post_${Date.now()}`,
        title,
        content,
        category,
        tags,
        author: 'user_1', // Mock author
        publishedAt: new Date().toISOString(),
        readTime: Math.ceil(content.length / 200), // Rough estimate
      };

      ctx.res.status(201).json(newPost);
    });

    // Comment management API
    app.get('/api/posts/:postId/comments', ctx => {
      const { postId } = ctx.params;
      const { page = '1', limit = '10' } = ctx.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // Mock comments data
      const comments = Array.from({ length: 20 }, (_, i) => ({
        id: `comment_${i + 1}`,
        postId,
        content: `Comment ${i + 1} on post ${postId}`,
        author: `user_${(i % 5) + 1}`,
        createdAt: new Date(Date.now() - i * 1800000).toISOString(),
        likes: Math.floor(Math.random() * 50),
      }));

      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedComments = comments.slice(startIndex, endIndex);

      ctx.res.json({
        comments: paginatedComments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: comments.length,
          pages: Math.ceil(comments.length / limitNum),
        },
      });
    });

    app.post('/api/posts/:postId/comments', ctx => {
      const { postId } = ctx.params;
      const body = (ctx.body as { content?: string }) || {};
      const { content } = body;

      if (!content) {
        ctx.res.status(400).json({
          error: 'Content is required',
        });
        return;
      }

      const newComment = {
        id: `comment_${Date.now()}`,
        postId,
        content,
        author: 'user_1', // Mock author
        createdAt: new Date().toISOString(),
        likes: 0,
      };

      ctx.res.status(201).json(newComment);
    });

    // Search API
    app.get('/api/search', ctx => {
      const { q, type = 'all', page = '1', limit = '10' } = ctx.query;
      const query = q as string;
      const searchType = type as string;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      if (!query) {
        ctx.res.status(400).json({
          error: 'Search query is required',
        });
        return;
      }

      // Mock search results
      const results = {
        users: Array.from({ length: 5 }, (_, i) => ({
          id: `user_${i + 1}`,
          name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`,
          type: 'user',
        })),
        posts: Array.from({ length: 5 }, (_, i) => ({
          id: `post_${i + 1}`,
          title: `Post ${i + 1}`,
          content: `Content for post ${i + 1}`,
          type: 'post',
        })),
        comments: Array.from({ length: 5 }, (_, i) => ({
          id: `comment_${i + 1}`,
          content: `Comment ${i + 1}`,
          type: 'comment',
        })),
      };

      const searchResults: any[] = [];
      if (searchType === 'all' || searchType === 'users') {
        searchResults.push(...results.users);
      }
      if (searchType === 'all' || searchType === 'posts') {
        searchResults.push(...results.posts);
      }
      if (searchType === 'all' || searchType === 'comments') {
        searchResults.push(...results.comments);
      }

      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedResults = searchResults.slice(startIndex, endIndex);

      ctx.res.json({
        query,
        type: searchType,
        results: paginatedResults,
        total: searchResults.length,
        pagination: {
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(searchResults.length / limitNum),
        },
      });
    });
  }

  describe('API Health and Status', () => {
    it('should return welcome message on root endpoint', async () => {
      const response = await fetch(`http://localhost:${PORT}/`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('message', 'Welcome to NextRush v2 API');
      expect(data).toHaveProperty('version', '2.0.0');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('endpoints');
    });

    it('should return health status', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('memory');
      expect(data).toHaveProperty('environment');
    });

    it('should return service status', async () => {
      const response = await fetch(`http://localhost:${PORT}/status`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'operational');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('lastChecked');
    });
  });

  describe('User Management API', () => {
    it('should list users with pagination', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/users?page=1&limit=5`
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBeLessThanOrEqual(5);
    });

    it('should search users', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/users?search=User`
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('users');
      expect(Array.isArray(data.users)).toBe(true);
    });

    it('should create a new user', async () => {
      const userData = {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'user',
      };

      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name', 'Jane Smith');
      expect(data).toHaveProperty('email', 'jane.smith@example.com');
      expect(data).toHaveProperty('role', 'user');
      expect(data).toHaveProperty('createdAt');
    });

    it('should validate user creation data', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'John' }), // Missing email
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Validation failed');
      expect(data).toHaveProperty('details');
    });

    it('should validate email format', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'invalid-email',
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid email format');
    });

    it('should get user by ID', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/users/user_1`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id', 'user_1');
      expect(data).toHaveProperty('name', 'John Doe');
      expect(data).toHaveProperty('email', 'john@example.com');
      expect(data).toHaveProperty('role', 'admin');
      expect(data).toHaveProperty('profile');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/users/non-existent`
      );
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'User not found');
    });

    it('should update user', async () => {
      const updateData = {
        name: 'John Updated',
        email: 'john.updated@example.com',
      };

      const response = await fetch(
        `http://localhost:${PORT}/api/users/user_1`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id', 'user_1');
      expect(data).toHaveProperty('name', 'John Updated');
      expect(data).toHaveProperty('email', 'john.updated@example.com');
      expect(data).toHaveProperty('updatedAt');
    });

    it('should delete user', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/users/user_1`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(204);
    });
  });

  describe('Post Management API', () => {
    it('should list posts with pagination', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/posts?page=1&limit=5`
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('posts');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.posts)).toBe(true);
    });

    it('should filter posts by category', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/posts?category=tech`
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('posts');
      expect(Array.isArray(data.posts)).toBe(true);
    });

    it('should create a new post', async () => {
      const postData = {
        title: 'Test Post',
        content: 'This is a test post content.',
        category: 'tech',
        tags: ['test', 'api'],
      };

      const response = await fetch(`http://localhost:${PORT}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title', 'Test Post');
      expect(data).toHaveProperty('content', 'This is a test post content.');
      expect(data).toHaveProperty('category', 'tech');
      expect(data).toHaveProperty('tags');
      expect(data).toHaveProperty('publishedAt');
      expect(data).toHaveProperty('readTime');
    });

    it('should validate post creation data', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test Post' }), // Missing content and category
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Validation failed');
      expect(data).toHaveProperty('details');
    });
  });

  describe('Comment Management API', () => {
    it('should list comments for a post', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/posts/post_1/comments?page=1&limit=5`
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('comments');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.comments)).toBe(true);
    });

    it('should create a new comment', async () => {
      const commentData = {
        content: 'This is a test comment.',
      };

      const response = await fetch(
        `http://localhost:${PORT}/api/posts/post_1/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(commentData),
        }
      );

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('postId', 'post_1');
      expect(data).toHaveProperty('content', 'This is a test comment.');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('likes', 0);
    });

    it('should validate comment creation data', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/posts/post_1/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}), // Missing content
        }
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Content is required');
    });
  });

  describe('Search API', () => {
    it('should search across all content types', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/search?q=test&type=all&page=1&limit=10`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('query', 'test');
      expect(data).toHaveProperty('type', 'all');
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('pagination');
    });

    it('should search specific content types', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/api/search?q=user&type=users`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('type', 'users');
      expect(data).toHaveProperty('results');
    });

    it('should require search query', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/search`);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Search query is required');
    });
  });

  describe('Middleware Integration', () => {
    it('should include all security headers', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      // Security headers
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
      expect(response.headers.get('strict-transport-security')).toContain(
        'max-age=31536000'
      );
    });

    it('should handle CORS properly', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`, {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(response.status).toBe(200);

      expect(response.headers.get('access-control-allow-origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      );
    });

    it('should include request tracking headers', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);

      const requestId = response.headers.get('X-Request-ID');
      const responseTime = response.headers.get('X-Response-Time');

      expect(requestId).toBeTruthy();
      expect(responseTime).toBeTruthy();
      expect(responseTime).toMatch(/^\d+ms$/);
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests to test rate limiting
      const promises = Array.from({ length: 20 }, () =>
        fetch(`http://localhost:${PORT}/health`)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed within the rate limit
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes gracefully', async () => {
      const response = await fetch(
        `http://localhost:${PORT}/non-existent-endpoint`
      );
      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"name": "John", "email": "john@example.com",}', // Malformed JSON
      });

      expect(response.status).toBe(400);
    });

    it('should handle large payloads gracefully', async () => {
      const largeData = {
        name: 'Test User',
        email: 'test@example.com',
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `Value ${i}`,
        })),
      };

      const response = await fetch(`http://localhost:${PORT}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(largeData),
      });

      // Should handle large payloads gracefully
      expect(response.status).toBe(201);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 100;
      const promises = Array.from({ length: concurrentRequests }, () =>
        fetch(`http://localhost:${PORT}/health`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should maintain reasonable response times under load', async () => {
      const requests = Array.from({ length: 50 }, () =>
        fetch(`http://localhost:${PORT}/api/users?page=1&limit=5`)
      );

      const responses = await Promise.all(requests);

      // Check response times
      responses.forEach(response => {
        const responseTime = response.headers.get('x-response-time');
        const timeInMs = parseInt(responseTime?.replace('ms', '') || '0');

        // Response time should be reasonable (less than 500ms under load)
        expect(timeInMs).toBeLessThan(500);
      });
    });
  });
});
