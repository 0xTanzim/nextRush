# Getting Started with NextRush

## Quick Installation

```bash
npm install nextrush
```

## Basic Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.listen(3000, () => {
  console.log('🚀 NextRush server running on port 3000');
});
```

## Project Structure

```text
my-nextrush-app/
├── src/
│   ├── index.ts          # Main server file
│   ├── routes/           # Route handlers
│   ├── middleware/       # Custom middleware
│   └── views/           # Template files
├── public/              # Static files
├── package.json
└── tsconfig.json
```

## Configuration Options

```typescript
const app = createApp({
  timeout: 30000, // Request timeout (30s)
  caseSensitive: false, // Route case sensitivity
  strict: false, // Strict routing
});
```

## Environment Setup

```bash
# Development
NODE_ENV=development

# Production
NODE_ENV=production
PORT=3000
```

## Next Steps

- [Routing Guide](./ROUTING.md) - Learn about HTTP methods and middleware
- [Security Guide](./SECURITY.md) - Input validation and sanitization
- [Templates](./TEMPLATE-ENGINE.md) - Server-side rendering
- [Static Files](./STATIC-FILES.md) - Serving static content
- [WebSocket](./WEBSOCKET.md) - Real-time communication
