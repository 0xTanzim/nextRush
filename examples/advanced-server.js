/**
 * Advanced NextRush Server Example with Routing
 *
 * This example demonstrates advanced features including:
 * - Router creation and mounting
 * - Middleware usage
 * - Error handling
 * - Validation
 * - CORS support
 */

const {
  createApp,
  createRouter,
  ResponseHandler,
  ValidationRules,
  validate,
} = require('nextrush');

const app = createApp();
const responseHandler = new ResponseHandler();

// CORS middleware
const corsMiddleware = async (context, next) => {
  const { response } = context;

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (context.request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  await next();
};

// Logging middleware
const loggingMiddleware = async (context, next) => {
  const start = Date.now();
  const { method, pathname } = context.request;

  console.log(`→ ${method} ${pathname}`);

  await next();

  const duration = Date.now() - start;
  console.log(`← ${method} ${pathname} (${duration}ms)`);
};

// Apply global middleware
app.use(corsMiddleware);
app.use(loggingMiddleware);

// Create API router
const apiRouter = createRouter();

// Users router
const usersRouter = createRouter();

// In-memory user storage (for demo purposes)
const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'user' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'admin' },
];

// Get all users
usersRouter.get('/', async (context) => {
  const { page = 1, limit = 10 } = context.query;

  const startIndex = (Number(page) - 1) * Number(limit);
  const endIndex = startIndex + Number(limit);
  const paginatedUsers = users.slice(startIndex, endIndex);

  responseHandler.json(context.response, {
    users: paginatedUsers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: users.length,
      pages: Math.ceil(users.length / Number(limit)),
    },
  });
});

// Get user by ID
usersRouter.get('/:id', async (context) => {
  const userId = Number(context.params.id);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return responseHandler.error(context.response, 'User not found', 404);
  }

  responseHandler.json(context.response, { user });
});

// Create new user
usersRouter.post('/', async (context) => {
  const userData = context.body;

  // Validate required fields
  const nameValidation = validate(userData?.name, [
    ValidationRules.required,
    ValidationRules.minLength(2),
  ]);

  const emailValidation = validate(userData?.email, [
    ValidationRules.required,
    ValidationRules.email,
  ]);

  if (!nameValidation.isValid || !emailValidation.isValid) {
    const errors = [...nameValidation.errors, ...emailValidation.errors];
    return responseHandler.error(context.response, errors.join(', '), 400);
  }

  const newUser = {
    id: users.length + 1,
    name: userData.name,
    email: userData.email,
    role: userData.role || 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  responseHandler.json(context.response, { user: newUser }, 201);
});

// Update user
usersRouter.put('/:id', async (context) => {
  const userId = Number(context.params.id);
  const userData = context.body;
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return responseHandler.error(context.response, 'User not found', 404);
  }

  // Update user
  users[userIndex] = {
    ...users[userIndex],
    ...userData,
    updatedAt: new Date().toISOString(),
  };

  responseHandler.json(context.response, { user: users[userIndex] });
});

// Delete user
usersRouter.delete('/:id', async (context) => {
  const userId = Number(context.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return responseHandler.error(context.response, 'User not found', 404);
  }

  const deletedUser = users.splice(userIndex, 1)[0];
  responseHandler.json(context.response, {
    message: 'User deleted',
    user: deletedUser,
  });
});

// Mount users router on API router
apiRouter.mount('/users', usersRouter);

// API health check
apiRouter.get('/health', async (context) => {
  responseHandler.json(context.response, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mount API router on main app
app.mount('/api', apiRouter);

// Root route
app.get('/', async (context) => {
  responseHandler.html(
    context.response,
    `
    <!DOCTYPE html>
    <html>
    <head>
        <title>NextRush Advanced Example</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .endpoint { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; }
            code { background: #eee; padding: 2px 4px; border-radius: 2px; }
        </style>
    </head>
    <body>
        <h1>🚀 NextRush Advanced Example</h1>
        <p>This server demonstrates advanced NextRush features including routing, middleware, and validation.</p>

        <h2>Available Endpoints:</h2>
        <div class="endpoint">
            <strong>GET /api/health</strong><br>
            Health check endpoint
        </div>
        <div class="endpoint">
            <strong>GET /api/users</strong><br>
            Get all users with pagination<br>
            Query params: <code>?page=1&limit=10</code>
        </div>
        <div class="endpoint">
            <strong>GET /api/users/:id</strong><br>
            Get user by ID
        </div>
        <div class="endpoint">
            <strong>POST /api/users</strong><br>
            Create new user<br>
            Body: <code>{"name": "John", "email": "john@example.com"}</code>
        </div>
        <div class="endpoint">
            <strong>PUT /api/users/:id</strong><br>
            Update user by ID
        </div>
        <div class="endpoint">
            <strong>DELETE /api/users/:id</strong><br>
            Delete user by ID
        </div>

        <h2>Test Commands:</h2>
        <pre>
# Get all users
curl http://localhost:3000/api/users

# Get user by ID
curl http://localhost:3000/api/users/1

# Create user
curl -X POST http://localhost:3000/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Bob","email":"bob@example.com"}'

# Update user
curl -X PUT http://localhost:3000/api/users/1 \\
  -H "Content-Type: application/json" \\
  -d '{"name":"John Updated"}'
        </pre>
    </body>
    </html>
  `
  );
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(Number(PORT)).then(() => {
  console.log(
    `🚀 NextRush advanced server started on http://localhost:${PORT}`
  );
  console.log('\n📍 Available endpoints:');
  console.log('  GET    /                  - Home page with documentation');
  console.log('  GET    /api/health        - API health check');
  console.log('  GET    /api/users         - Get all users');
  console.log('  GET    /api/users/:id     - Get user by ID');
  console.log('  POST   /api/users         - Create new user');
  console.log('  PUT    /api/users/:id     - Update user');
  console.log('  DELETE /api/users/:id     - Delete user');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await app.close();
  process.exit(0);
});
