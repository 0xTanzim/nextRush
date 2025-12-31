---
title: Router Internals
description: How NextRush's radix tree router achieves O(k) route matching — data structures, algorithms, and performance.
---

# Router Internals

> Understanding the radix tree data structure and route matching algorithm that powers NextRush routing.

## Overview

The `@nextrush/router` package uses a **radix tree** (compact trie) for route matching:

- **O(k) lookup** where k = path length (not route count!)
- **Memory efficient** for routes with common prefixes
- **Supports parameters** (`:id`) and wildcards (`*`)

---

## Radix Tree Structure

### What is a Radix Tree?

A radix tree (also called Patricia trie or compact trie) compresses paths with single children:

```
Regular Trie (inefficient):
/
└── u
    └── s
        └── e
            └── r
                └── s
                    ├── (end) → handler1
                    └── /
                        └── :
                            └── i
                                └── d
                                    └── (end) → handler2

Radix Tree (compact):
/users
├── (end) → handler1
└── /:id
    └── (end) → handler2
```

### Node Structure

```typescript
interface RadixNode {
  /** Path segment: "users", ":id", "*" */
  segment: string;

  /** Node type: STATIC, PARAM, WILDCARD */
  type: NodeType;

  /** Children keyed by first character */
  children: Map<string, RadixNode>;

  /** Parameter name if type === PARAM */
  paramName?: string;

  /** Handlers keyed by HTTP method */
  handlers: Map<HttpMethod, HandlerEntry>;

  /** Fast-path child references */
  paramChild?: RadixNode;
  wildcardChild?: RadixNode;
}

enum NodeType {
  STATIC = 0,   // /users
  PARAM = 1,    // /:id
  WILDCARD = 2, // /*
}
```

### Visual Example

Given these routes:
```typescript
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.get('/users/:id/posts', getUserPosts);
router.get('/posts', listPosts);
router.get('/posts/:id', getPost);
```

The radix tree looks like:

```
(root)
├── /users
│   ├── handlers: { GET: listUsers }
│   └── /:id
│       ├── handlers: { GET: getUser }
│       └── /posts
│           └── handlers: { GET: getUserPosts }
│
└── /posts
    ├── handlers: { GET: listPosts }
    └── /:id
        └── handlers: { GET: getPost }
```

---

## Route Registration

### How Routes Are Added

```typescript
router.get('/users/:id/posts', handler);
```

**Step 1: Parse path into segments**

```typescript
parseSegments('/users/:id/posts')
// Returns:
[
  { segment: 'users', type: STATIC },
  { segment: ':id', type: PARAM, paramName: 'id' },
  { segment: 'posts', type: STATIC }
]
```

**Step 2: Traverse/create nodes**

```typescript
function insert(node: RadixNode, segments: ParsedSegment[], handler: HandlerEntry) {
  if (segments.length === 0) {
    // Reached destination - store handler
    node.handlers.set(method, handler);
    return;
  }

  const [current, ...rest] = segments;

  if (current.type === NodeType.PARAM) {
    // Create or get param child
    if (!node.paramChild) {
      node.paramChild = createNode(current.segment, NodeType.PARAM);
      node.paramChild.paramName = current.paramName;
    }
    insert(node.paramChild, rest, handler);

  } else if (current.type === NodeType.WILDCARD) {
    // Create wildcard node
    node.wildcardChild = createNode('*', NodeType.WILDCARD);
    node.wildcardChild.handlers.set(method, handler);

  } else {
    // Static segment - use children map
    const key = current.segment[0]; // First char for lookup
    let child = node.children.get(key);

    if (!child) {
      child = createNode(current.segment, NodeType.STATIC);
      node.children.set(key, child);
    }

    insert(child, rest, handler);
  }
}
```

---

## Route Matching

### Matching Algorithm

```typescript
function match(node: RadixNode, path: string, params: Record<string, string>): RouteMatch | null {
  const segments = path.split('/').filter(Boolean);

  return matchSegments(node, segments, 0, params);
}

function matchSegments(
  node: RadixNode,
  segments: string[],
  index: number,
  params: Record<string, string>
): RouteMatch | null {
  // Base case: consumed all segments
  if (index >= segments.length) {
    const handler = node.handlers.get(method);
    if (handler) {
      return { handler, params };
    }
    return null;
  }

  const segment = segments[index];

  // 1. Try static children first (exact match)
  const staticChild = node.children.get(segment[0]);
  if (staticChild && staticChild.segment === segment) {
    const result = matchSegments(staticChild, segments, index + 1, params);
    if (result) return result;
  }

  // 2. Try parameter child
  if (node.paramChild) {
    const newParams = { ...params, [node.paramChild.paramName!]: segment };
    const result = matchSegments(node.paramChild, segments, index + 1, newParams);
    if (result) return result;
  }

  // 3. Try wildcard child (catches everything remaining)
  if (node.wildcardChild) {
    const remaining = segments.slice(index).join('/');
    return {
      handler: node.wildcardChild.handlers.get(method)!,
      params: { ...params, '*': remaining }
    };
  }

  return null;
}
```

### Match Priority

Routes are matched in this priority order:

1. **Static segments** — Exact match
2. **Parameter segments** — Named capture
3. **Wildcard** — Catch-all

```typescript
router.get('/users/me', meHandler);        // Priority 1: static
router.get('/users/:id', userHandler);     // Priority 2: param
router.get('/users/*', catchAllHandler);   // Priority 3: wildcard

// GET /users/me     → meHandler (static wins)
// GET /users/123    → userHandler (param matches)
// GET /users/a/b/c  → catchAllHandler (wildcard catches rest)
```

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Route registration | O(k) | k = path segment count |
| Route lookup | O(k) | k = path segment count |
| Parameter extraction | O(p) | p = parameter count |

**Key insight:** Route count doesn't affect lookup time!

```typescript
// These have identical lookup performance:
// 10 routes:    ~0.02ms per request
// 1,000 routes: ~0.02ms per request
// 10,000 routes: ~0.02ms per request
```

### Space Complexity

| Structure | Space |
|-----------|-------|
| Per node | ~100 bytes (base) |
| Per handler | ~50 bytes |
| Children map | O(c) where c = unique first chars |

**Memory is proportional to unique path prefixes, not route count.**

### Benchmark Results

```
Route matching (10,000 routes):
  Static path /users           : 45,000,000 ops/sec
  Single param /users/:id      : 38,000,000 ops/sec
  Multi param /users/:id/posts : 32,000,000 ops/sec
  Wildcard /files/*            : 35,000,000 ops/sec
```

---

## Advanced Features

### Route Parameters

```typescript
router.get('/users/:userId/posts/:postId', (ctx) => {
  const { userId, postId } = ctx.params;
  // userId = '123', postId = '456' for /users/123/posts/456
});
```

**How parameters are captured:**

1. PARAM node stores `paramName`
2. During matching, current segment value captured
3. Params accumulated in object passed through recursion
4. Final params attached to `ctx.params`

### Wildcards

```typescript
router.get('/files/*', (ctx) => {
  const path = ctx.params['*'];
  // path = 'docs/readme.md' for /files/docs/readme.md
});
```

**How wildcards work:**

1. WILDCARD node created at that position
2. Matching stops and captures remaining path
3. Everything after wildcard stored in `params['*']`

### Route Middleware

```typescript
router.get('/admin/:id', adminAuth, (ctx) => {
  // adminAuth runs before handler
});
```

**How middleware is stored:**

```typescript
interface HandlerEntry {
  handler: RouteHandler;
  middleware: Middleware[];  // Stored with route
}
```

During execution:
1. Route matched
2. Route middleware composed with handler
3. Composed function executed

---

## Router Composition

### Nested Routers

```typescript
const userRouter = createRouter();
userRouter.get('/', listUsers);
userRouter.get('/:id', getUser);

const apiRouter = createRouter();
apiRouter.use('/users', userRouter.routes());

app.use(apiRouter.routes());
// Routes: GET /users, GET /users/:id
```

**How nesting works:**

1. Child router's routes extracted
2. Each route prefixed with parent path
3. Combined into parent's radix tree

### `routes()` Middleware

```typescript
router.routes(): Middleware
```

Returns a middleware function that:
1. Matches incoming request against radix tree
2. If match found, executes route middleware + handler
3. If no match, calls `next()` (passes to next middleware)

```typescript
function routes(): Middleware {
  return async (ctx) => {
    const match = this.match(ctx.method, ctx.path);

    if (!match) {
      return ctx.next();
    }

    ctx.params = match.params;

    // Compose route middleware with handler
    const fn = compose([...match.middleware, match.handler]);
    await fn(ctx);
  };
}
```

---

## Internal API

### Public Exports

| Export | Description |
|--------|-------------|
| `createRouter()` | Create new router instance |
| `Router` | Router class |

### Internal Exports (Advanced)

| Export | Description |
|--------|-------------|
| `createNode()` | Create radix tree node |
| `parseSegments()` | Parse path into segments |
| `NodeType` | Node type enum |

### Router Methods

| Method | Description |
|--------|-------------|
| `get(path, ...handlers)` | Register GET route |
| `post(path, ...handlers)` | Register POST route |
| `put(path, ...handlers)` | Register PUT route |
| `patch(path, ...handlers)` | Register PATCH route |
| `delete(path, ...handlers)` | Register DELETE route |
| `all(path, ...handlers)` | Register all methods |
| `use(path?, ...middleware)` | Register middleware |
| `routes()` | Get routes middleware |
| `match(method, path)` | Match route (internal) |

---

## Comparison to Other Routers

| Router | Algorithm | Lookup | Parameters |
|--------|-----------|--------|------------|
| NextRush | Radix tree | O(k) | ✅ Named, Wildcard |
| Express | Linear | O(n) | ✅ Named, Regex |
| Fastify | Radix tree | O(k) | ✅ Named, Wildcard |
| Koa-router | Linear | O(n) | ✅ Named |

**NextRush and Fastify use similar radix tree approaches.**

Linear routers (Express, Koa) check routes one-by-one:
- 100 routes: ~100 comparisons worst case
- 1000 routes: ~1000 comparisons worst case

Radix tree routers check path segments:
- 100 routes: ~5 comparisons (path depth)
- 1000 routes: ~5 comparisons (same path depth)

---

## See Also

- [Core & Application](./core-application) — Middleware composition
- [Adapter Architecture](./adapters) — Request handling
- [Routing Concept](/concepts/routing) — Usage guide
