# NextRush 🚀

[![npm version](https://img.shields.io/npm/v/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-green.svg)](https://www.npmjs.com/package/nextrush)

**A fast, zero-dependency web framework for Node.js with Express.js compatibility.**

NextRush is a modern HTTP server framework that works just like Express.js but with zero dependencies, built-in TypeScript support, and better performance.

## Why NextRush?

- **Zero dependencies** - Express.js has 30+ dependencies
- **TypeScript built-in** - No need for @types packages
- **Better security** - Input validation and protection built-in
- **Express compatible** - Same API, easy migration
- **Better performance** - Optimized from the ground up

## Installation

```bash
npm install nextrush
```

## Quick Start

```javascript
import { createApp } from 'nextrush';

const app = createApp();

// Same API as Express.js
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.get('/users/:id', (req, res) => {
  const userId = req.param('id');
  res.json({ userId, name: `User ${userId}` });
});

app.post('/users', (req, res) => {
  const userData = req.body; // Auto-parsed JSON
  res.status(201).json({ user: userData });
});

app.listen(3000);
console.log('Server running at http://localhost:3000');
```

## Key Features

### Template Rendering

```javascript
// Path aliases - no more ../../../
await res.render('@views/user.html', userData);
await res.render('@/components/header.html', { title: 'Home' });
```

### File Operations

```javascript
res.sendFile('document.pdf'); // Auto content-type detection
res.download('data.csv', 'export.csv'); // Custom filename
```

### Built-in Validation

```javascript
const validated = req.validate({
  email: { required: true, type: 'email' },
  age: { required: true, type: 'number', min: 18 },
});
```

### Event Monitoring (Optional)

```javascript
app.on('request', (data) => {
  console.log(`${data.method} ${data.url} - ${data.duration}ms`);
});
```

## Express.js Migration

Drop-in replacement - same API:

```javascript
// Before (Express.js)
const express = require('express');
const app = express();

// After (NextRush)
import { createApp } from 'nextrush';
const app = createApp();

// Everything else stays the same!
```

## Documentation

For complete documentation and advanced features, see:

- **[User Manual](https://github.com/0xTanzim/nextrush/blob/main/docs/USER-MANUAL.md)** - Getting started guide
- **[API Reference](https://github.com/0xTanzim/nextrush/blob/main/docs/API-REFERENCE.md)** - Complete API documentation
- **[Request API](https://github.com/0xTanzim/nextrush/blob/main/docs/REQUEST.md)** - Request handling
- **[Response API](https://github.com/0xTanzim/nextrush/blob/main/docs/RESPONSE.md)** - Response methods
- **[Middleware Guide](https://github.com/0xTanzim/nextrush/blob/main/docs/MIDDLEWARE.md)** - Built-in middleware
- **[Event System](https://github.com/0xTanzim/nextrush/blob/main/docs/EVENT-DRIVEN-ARCHITECTURE.md)** - Monitoring & events
- **[WebSocket Support](https://github.com/0xTanzim/nextrush/blob/main/docs/WEBSOCKET.md)** - Real-time features

## Status

NextRush is **production-ready** and handles most real-world use cases. It's actively maintained and has zero dependencies.

## License

MIT © NextRush Team
