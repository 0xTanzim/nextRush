# 🔄 Migration Guide: Express.js to NextRush

NextRush is designed as a **drop-in replacement** for Express.js with enhanced features. This guide helps you migrate your existing Express.js application to NextRush.

## Quick Migration Steps

### 1. Install NextRush

```bash
# Remove Express.js
npm uninstall express

# Install NextRush
npm install nextrush
```

### 2. Update Imports

**Before (Express.js):**

```javascript
const express = require('express');
const app = express();
```

**After (NextRush):**

```typescript
import { createApp } from 'nextrush';
const app = createApp();
```

### 3. Basic Routes (No Changes Needed!)

Your existing routes work exactly the same:

```typescript
// These work identically in both Express.js and NextRush
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.post('/users', (req, res) => {
  const user = req.body;
  res.status(201).json({ created: user });
});

app.use('/api', middleware);
app.listen(3000);
```

## Feature-by-Feature Migration

### Middleware Migration

**Express.js middleware works unchanged:**

```typescript
// All of these work identically in NextRush
app.use(express.json()); // ✅ Works (but auto-enabled in NextRush)
app.use(express.urlencoded()); // ✅ Works (but auto-enabled in NextRush)
app.use(cors()); // ✅ Works
app.use(helmet()); // ✅ Works
app.use(morgan('combined')); // ✅ Works

// Custom middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

**NextRush enhancements (optional):**

```typescript
// Enhanced features automatically available
app.get('/info', (req, res) => {
  res.json({
    // New methods available
    ip: req.ip(), // Smart IP detection
    secure: req.secure(), // HTTPS detection
    protocol: req.protocol(), // http/https
  });
});
```

### Static Files Migration

**Express.js:**

```javascript
app.use(express.static('public'));
app.use('/assets', express.static('assets'));
```

**NextRush (same API, enhanced features):**

```typescript
app.static('/public', './public');
app.static('/assets', './assets');

// Enhanced features available
app.static('/assets', './public', {
  compression: true, // Auto compression
  caching: true, // Smart caching
  spa: true, // SPA support
});
```

### Body Parsing Migration

**Express.js:**

```javascript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(multer().single('file')); // For file uploads
```

**NextRush (automatic):**

```typescript
// Body parsing is automatic - no setup needed!
app.post('/upload', (req, res) => {
  const data = req.body; // Auto-parsed JSON/form
  const file = req.file('avatar'); // Auto-parsed files
  res.json({ success: true });
});
```

### Error Handling Migration

**Express.js:**

```javascript
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
```

**NextRush (identical API):**

```typescript
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
```

## Common Express.js Packages and NextRush Equivalents

| Express.js Package     | NextRush Equivalent  | Notes                              |
| ---------------------- | -------------------- | ---------------------------------- |
| `express.json()`       | **Built-in**         | Automatic JSON parsing             |
| `express.urlencoded()` | **Built-in**         | Automatic form parsing             |
| `express.static()`     | `app.static()`       | Enhanced with compression, caching |
| `multer`               | **Built-in**         | `req.file()`, `req.files()`        |
| `cookie-parser`        | **Built-in**         | `req.parseCookies()`               |
| `cors`                 | Use existing package | Works unchanged                    |
| `helmet`               | Use existing package | Works unchanged                    |
| `morgan`               | Use existing package | Works unchanged                    |
| `compression`          | **Built-in**         | Auto-enabled in `app.static()`     |

## Step-by-Step Migration Example

Let's migrate a real Express.js application:

### Original Express.js App

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload setup
const upload = multer({ dest: 'uploads/' });

// Static files
app.use('/public', express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ user: { id: userId } });
});

app.post('/users', (req, res) => {
  const user = req.body;
  res.status(201).json({ created: user });
});

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({
    file: req.file.filename,
    body: req.body,
  });
});

// Error handling
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Migrated NextRush App

```typescript
import { createApp } from 'nextrush';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = createApp();

// Middleware (same as Express.js)
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
// Note: JSON/form parsing is automatic in NextRush

// Static files (enhanced)
app.static('/public', './public', {
  compression: true,
  caching: true,
});

// Routes (identical API)
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ user: { id: userId } });
});

app.post('/users', (req, res) => {
  const user = req.body; // Auto-parsed
  res.status(201).json({ created: user });
});

// File upload (simplified)
app.post('/upload', (req, res) => {
  const file = req.file('file'); // Built-in file handling
  res.json({
    file: file?.filename,
    body: req.body,
  });
});

// Error handling (identical)
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### What Changed:

1. ✅ **Import statement** - `require('express')` → `import { createApp } from 'nextrush'`
2. ✅ **App creation** - `express()` → `createApp()`
3. ✅ **Removed packages** - No more `multer`, automatic body parsing
4. ✅ **Enhanced static files** - Added compression and caching
5. ✅ **Simplified file uploads** - Built-in `req.file()` method

**Everything else works exactly the same!**

## Advanced Migration Scenarios

### Router Migration

**Express.js Router:**

```javascript
const express = require('express');
const router = express.Router();

router.get('/users', (req, res) => {
  res.json({ users: [] });
});

router.post('/users', (req, res) => {
  res.json({ created: req.body });
});

app.use('/api', router);
```

**NextRush (same pattern):**

```typescript
// Create router function (or use Express Router directly)
const apiRoutes = (app) => {
  app.get('/api/users', (req, res) => {
    res.json({ users: [] });
  });

  app.post('/api/users', (req, res) => {
    res.json({ created: req.body });
  });
};

// Apply routes
apiRoutes(app);

// Or continue using Express Router
import { Router } from 'express';
const router = Router();
// ... same router code
app.use('/api', router);
```

### Template Engine Migration

**Express.js with EJS/Handlebars:**

```javascript
app.set('view engine', 'ejs');
app.set('views', './views');

app.get('/profile', (req, res) => {
  res.render('profile', { user: req.user });
});
```

**NextRush (enhanced template engine):**

```typescript
app.setViews('./views');

app.get('/profile', (req, res) => {
  res.render('profile.html', { user: req.user });
});
```

### Database Integration Migration

**Express.js with MongoDB:**

```javascript
const mongoose = require('mongoose');

app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**NextRush (identical):**

```typescript
import mongoose from 'mongoose';

app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Testing Migration

Your existing tests work with minimal changes:

**Express.js Test:**

```javascript
const request = require('supertest');
const express = require('express');

const app = express();
app.get('/test', (req, res) => {
  res.json({ message: 'test' });
});

test('GET /test', async () => {
  const response = await request(app).get('/test').expect(200);

  expect(response.body.message).toBe('test');
});
```

**NextRush Test (minimal change):**

```typescript
import request from 'supertest';
import { createApp } from 'nextrush';

const app = createApp();
app.get('/test', (req, res) => {
  res.json({ message: 'test' });
});

test('GET /test', async () => {
  const response = await request(app).get('/test').expect(200);

  expect(response.body.message).toBe('test');
});
```

## Migration Checklist

### Pre-Migration

- [ ] Backup your existing application
- [ ] List all Express.js middleware and packages used
- [ ] Identify custom middleware functions
- [ ] Document current API endpoints
- [ ] Note any Express.js-specific features used

### During Migration

- [ ] Update package.json dependencies
- [ ] Change import/require statements
- [ ] Update app creation (`express()` → `createApp()`)
- [ ] Remove unnecessary body parsing middleware
- [ ] Update static file serving (optional enhancements)
- [ ] Test all routes and middleware
- [ ] Update file upload handling
- [ ] Verify error handling works

### Post-Migration

- [ ] Run all existing tests
- [ ] Test file uploads
- [ ] Verify static file serving
- [ ] Check middleware execution order
- [ ] Test error handling
- [ ] Performance testing
- [ ] Update documentation

### Optional Enhancements

- [ ] Add input validation with `req.validate()`
- [ ] Use built-in sanitization with `req.sanitize()`
- [ ] Enable static file compression and caching
- [ ] Add WebSocket endpoints with `app.ws()`
- [ ] Use enhanced request methods (`req.ip()`, `req.secure()`)
- [ ] Implement CSV export with `res.csv()`

## Troubleshooting Common Issues

### Issue: Middleware not working

**Solution:** Ensure middleware is registered before routes that use it.

### Issue: File uploads failing

**Solution:** Use `req.file()` instead of multer. No setup required.

### Issue: Body parsing not working

**Solution:** Body parsing is automatic. Remove `express.json()` calls.

### Issue: Static files not serving

**Solution:** Use `app.static()` instead of `express.static()`.

### Issue: TypeScript errors

**Solution:** NextRush provides full TypeScript support. Update imports to use ES modules.

## Performance Improvements After Migration

After migrating to NextRush, you'll typically see:

- **Faster startup time** - Zero dependencies for core features
- **Better memory usage** - Optimized request/response handling
- **Automatic optimizations** - Built-in compression, caching
- **Enhanced security** - Built-in validation and sanitization
- **Better developer experience** - Full TypeScript support

## Migration Timeline

| Application Size      | Estimated Migration Time |
| --------------------- | ------------------------ |
| Small (< 10 routes)   | 30 minutes - 1 hour      |
| Medium (10-50 routes) | 2-4 hours                |
| Large (50+ routes)    | 1-2 days                 |
| Enterprise            | 3-5 days                 |

Most of the time is spent testing, not actual code changes!

## Getting Help

If you encounter issues during migration:

1. **Check the documentation** - Most Express.js patterns work unchanged
2. **Compare with examples** - See working NextRush examples
3. **Test incrementally** - Migrate route by route
4. **Use TypeScript** - Better error detection during migration
5. **Ask for help** - Contact NextRush support or community

Remember: NextRush is designed to make migration as smooth as possible. Most Express.js applications can be migrated with just a few line changes!
