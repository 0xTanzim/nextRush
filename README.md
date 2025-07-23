# 🦊 NextRush - Learning Project

<div align="center">

[![Learning Project](https://img.shields.io/badge/Status-Learning%20Project-orange.svg)](https://github.com/0xTanzim/nextRush)
[![NPM Version](https://img.shields.io/npm/v/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![TypeScript](https://img.shields.io/badge/TypeScript-Learning-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**🎓 My first web framework - Built for learning, not production**

</div>

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.listen(3000);
// 🚀 Express.js-compatible API with zero dependencies
```

## ⚠️ **Learning Project Notice**

This is my **first attempt** at building a Node.js web framework. Created for **educational purposes only**.

**🚨 For Production**: Use [Express.js](https://expressjs.com/), [Fastify](https://fastify.dev/), or [Koa](https://koajs.com/) instead.

## 🏆 **Latest Benchmark Results** _(July 2025)_

> **Ultimate Fox Test** - Maximum RPS testing with Apache Bench on Intel i5-8300H, 14GB RAM

### **🥇 Overall Performance Rankings:**

| Rank | Framework    | **Peak RPS** | **Best At**     | **Avg Latency** |
| ---- | ------------ | ------------ | --------------- | --------------- |
| 🥇   | **Fastify**  | **9,491**    | Low concurrency | **5.3ms**       |
| 🥈   | **Express**  | **7,146**    | All loads       | **14.0ms**      |
| 🥉   | **NextRush** | **5,784**    | Medium loads    | **34.6ms**      |

### **📊 Detailed Performance by Connection Count:**

#### **50 Connections (Light Load):**

| Framework    | RPS       | Latency | Status        |
| ------------ | --------- | ------- | ------------- |
| **Fastify**  | **9,491** | 5.3ms   | 🏆 **Winner** |
| **Express**  | **6,934** | 7.2ms   | 🥈 Good       |
| **NextRush** | **5,612** | 8.9ms   | 🥉 Decent     |

#### **100 Connections (Medium Load):**

| Framework    | RPS       | Latency | Status        |
| ------------ | --------- | ------- | ------------- |
| **Express**  | **7,146** | 14.0ms  | 🏆 **Winner** |
| **Fastify**  | **9,154** | 10.9ms  | 🥈 Close      |
| **NextRush** | **5,669** | 17.6ms  | 🥉 Stable     |

#### **200 Connections (High Load):**

| Framework    | RPS       | Latency | Status        |
| ------------ | --------- | ------- | ------------- |
| **Fastify**  | **9,405** | 21.3ms  | 🏆 **Winner** |
| **Express**  | **6,890** | 29.0ms  | � Good        |
| **NextRush** | **5,784** | 34.6ms  | 🥉 **Peak**   |

#### **500+ Connections (Extreme Load):**

| Framework    | RPS       | Latency | Performance |
| ------------ | --------- | ------- | ----------- |
| **Fastify**  | **8,598** | 58.2ms  | Declining   |
| **Express**  | **7,068** | 70.7ms  | Consistent  |
| **NextRush** | **5,539** | 90.3ms  | Dropping    |

### **🎯 Performance Analysis:**

#### **🚀 Fastify Strengths:**

- **Dominates low concurrency** (50-200 connections)
- **Excellent latency** across all loads
- **9.5K RPS peak** - industry-leading performance

#### **💪 Express Strengths:**

- **Most consistent** across all connection counts
- **Handles high loads well** (500+ connections)
- **Proven stability** under stress

#### **🎓 NextRush Analysis:**

- **Best at 200 connections** (architectural sweet spot)
- **Competitive performance** for a learning project
- **Room for optimization** - performance gap shows learning opportunities

### **� Key Performance Insights:**

- **NextRush achieves 61% of Fastify's peak performance** - respectable for first framework
- **Zero memory leaks** detected across all test scenarios
- **Performance gap mainly due to** architecture complexity vs. mature optimization
- **Learning-focused development** prioritized features over raw speed
- **Plugin architecture overhead** impacts performance but provides flexibility

### **🔬 Test Configuration:**

- **Tool**: Apache Bench (ab) for accurate RPS measurement
- **Requests**: 10,000 per test for statistical significance
- **Duration**: 60-second timeout per test
- **Hardware**: Intel i5-8300H, 14GB RAM, Ubuntu 25.04
- **Node.js**: v24.4.1 (latest LTS)
- **Methodology**: Multiple runs, averaged results

## ✨ **What Makes NextRush Special**

### **🔥 Built-in Features Comparison:**

| Feature                     | NextRush | Express | Fastify | Dependencies Needed          |
| --------------------------- | -------- | ------- | ------- | ---------------------------- |
| **Zero Dependencies**       | ✅       | ❌      | ❌      | NextRush: 0, Others: 10+     |
| **Express Compatible**      | ✅       | ✅      | ❌      | Drop-in replacement          |
| **TypeScript First**        | ✅       | ⚠️      | ✅      | Built-in vs. @types packages |
| **Built-in Body Parser**    | ✅       | ❌      | ✅      | express requires body-parser |
| **Built-in File Uploads**   | ✅       | ❌      | ❌      | express requires multer      |
| **Built-in WebSocket**      | ✅       | ❌      | ❌      | Others require socket.io     |
| **Built-in Templates**      | ✅       | ❌      | ❌      | Others require view engines  |
| **Built-in Security**       | ✅       | ❌      | ❌      | Others require helmet + more |
| **Built-in Rate Limiting**  | ✅       | ❌      | ❌      | express-rate-limit needed    |
| **Built-in Authentication** | ✅       | ❌      | ❌      | passport + sessions needed   |
| **API Documentation**       | ✅       | ❌      | ❌      | swagger packages needed      |
| **Performance Ranking**     | 3rd      | 2nd     | 1st     | Speed vs. Features trade-off |

### **🔥 Core Features:**

#### **🛡️ Security & Validation:**

- **Input Validation** - Built-in request validation with custom rules
- **XSS Protection** - Automatic cross-site scripting prevention
- **SQL Injection Prevention** - Query sanitization and parameterization
- **CORS Management** - Flexible cross-origin resource sharing
- **Rate Limiting** - Configurable request throttling per IP/user

#### **📁 File Handling:**

- **Static File Serving** - High-performance with compression & caching
- **File Uploads** - Multipart form data with size limits
- **Download Management** - Secure file downloads with access control
- **Image Processing** - Basic resize and format conversion

#### **🌐 Real-time Features:**

- **WebSocket Support** - Built-in WebSocket server with room management
- **Server-Sent Events** - Real-time data streaming to clients
- **Long Polling** - Fallback for real-time communication

#### **📊 Monitoring & Debugging:**

- **Request Metrics** - Built-in performance monitoring
- **Health Checks** - Automated endpoint health verification
- **Error Tracking** - Comprehensive error logging and reporting
- **Memory Monitoring** - Real-time memory usage tracking

### **🏗️ Architecture Highlights:**

#### **Plugin System:**

```typescript
// Load only what you need for maximum performance
const app = createApp({
  pluginMode: PluginMode.PERFORMANCE, // Only 4 essential plugins
  // vs
  pluginMode: PluginMode.FULL, // All 15+ plugins loaded
});
```

#### **Memory Efficiency:**

- **Zero Dependencies** - No bloated node_modules
- **Smart Caching** - Intelligent memory usage with TTL
- **Buffer Pooling** - Optimized memory allocation for high-traffic
- **Garbage Collection** - Minimal GC pressure design

## 🚀 **Quick Start**

### **Installation**

```bash
# NPM (recommended)
npm install nextrush

# Yarn
yarn add nextrush

# PNPM
pnpm add nextrush
```

### **Basic Usage**

```typescript
import { createApp, PluginMode } from 'nextrush';

// Create app with full features (development)
const app = createApp();

// Or create app with performance mode (production)
const productionApp = createApp({
  pluginMode: PluginMode.PERFORMANCE, // 4 essential plugins only
  enableEvents: false,
  enableWebSocket: false,
});

// Express.js-compatible routes work unchanged
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { format } = req.query;

  res.json({
    id,
    name: 'John Doe',
    format: format || 'default',
  });
});

// POST with automatic body parsing
app.post('/api/users', (req, res) => {
  const userData = req.body; // Automatically parsed JSON
  res.status(201).json({ created: userData });
});

app.listen(3000, () => {
  console.log('🚀 NextRush server running on http://localhost:3000');
});
```

### **🔥 Advanced Features**

#### **File Uploads (Built-in)**

```typescript
// No multer needed - built-in file handling
app.post('/upload', (req, res) => {
  const file = req.file('document');
  const metadata = req.body;

  if (file) {
    res.json({
      uploaded: file.filename,
      size: file.size,
      metadata,
    });
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
});
```

#### **WebSocket Support (Built-in)**

```typescript
// No socket.io needed - built-in WebSocket
app.ws('/chat', (ws, req) => {
  console.log('New WebSocket connection');

  ws.on('message', (data) => {
    // Echo message to all connected clients
    app.broadcast('chat', `User: ${data}`);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});
```

#### **Template Rendering (Built-in)**

```typescript
// No view engine setup needed
app.get('/profile/:username', (req, res) => {
  const data = {
    username: req.params.username,
    posts: ['Hello World', 'Learning NextRush'],
  };

  // Supports Mustache, Handlebars, EJS
  res.render('profile.mustache', data);
});
```

#### **Authentication & Security (Built-in)**

```typescript
// Built-in JWT and session support
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (await validateUser(username, password)) {
    const token = req.signJWT({ username }, '24h');
    res.json({ token, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Protected route with built-in middleware
app.get('/dashboard', req.requireAuth(), (req, res) => {
  res.json({
    message: `Welcome ${req.user.username}`,
    dashboard: 'data',
  });
});
```

### **🔄 Migrating from Express.js**

Most Express.js code works **unchanged** with NextRush:

```diff
- const express = require('express');
- const bodyParser = require('body-parser');
- const cors = require('cors');
- const helmet = require('helmet');
- const multer = require('multer');

+ import { createApp } from 'nextrush';

- const app = express();
- app.use(bodyParser.json());
- app.use(cors());
- app.use(helmet());
- const upload = multer({ dest: 'uploads/' });

+ const app = createApp(); // All middleware built-in!

// All your existing routes work exactly the same
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

- app.post('/upload', upload.single('file'), (req, res) => {
+ app.post('/upload', (req, res) => {
-   res.json({ file: req.file });
+   res.json({ file: req.file('file') }); // Built-in file handling
});
```

### **⚡ Performance Optimization**

```typescript
// For maximum performance (production)
const app = createApp({
  pluginMode: PluginMode.PERFORMANCE,
  enableEvents: false,
  enableWebSocket: false,
  enableMetrics: false,
  maxRequestSize: 1024 * 1024, // 1MB limit
  timeout: 30000, // 30 second timeout
});

// Results in ~20% better performance
// NextRush: 5,784 RPS → ~7,000 RPS (estimated)
```

## 📚 **Learning Documentation**

- **[📖 Lessons Learned](./LESSONS-LEARNED.md)** - My complete learning journey
- **[📋 Project Status](./PROJECT-STATUS.md)** - Final achievements and metrics
- **[🚪 Exit Plan](./EXIT-PLAN.md)** - How to properly conclude a learning project
- **[📊 Benchmarks](./professional-benchmarks/)** - Complete performance testing suite

## 🎓 **Educational Value**

### **What I Learned:**

- Framework architecture and design patterns
- Plugin systems and extensible architectures
- TypeScript advanced patterns and techniques
- Performance testing and optimization
- NPM package development and publishing

### **Key Insights:**

- **Architecture planning** is more important than coding speed
- **Simple solutions** often outperform complex optimizations
- **Plugin systems** must be designed from day 1
- **Testing** should come before features, not after

## 🚀 **Next Steps**

This project achieved its educational goals. The knowledge gained will be applied to **NextRush v2.0** - a complete rewrite with:

- ✅ Architecture-first approach
- ✅ Test-driven development
- ✅ Incremental feature addition
- ✅ Performance optimization from day 1

## 📄 **License**

MIT License - see [LICENSE](./LICENSE) file for details.

---

<div align="center">

**🎓 Successfully completed learning project!**

_Built with ❤️ for education and shared for learning_

[⭐ Star on GitHub](https://github.com/0xTanzim/nextRush) • [📖 Learn More](./LESSONS-LEARNED.md) • [🚀 NextRush v2.0 Coming Soon]

</div>
