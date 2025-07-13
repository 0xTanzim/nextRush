/**
 * NextRush Express-Style Example
 *
 * This example shows how to use NextRush with the familiar Express.js API
 */
import { createApp } from '../src';

const app = createApp();

// Express-style middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Express-style routes
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from NextRush!',
    framework: 'NextRush',
    style: 'Express-compatible',
  });
});

app.get('/users/:id', (req, res) => {
  const userId = req.param('id');
  res.json({
    userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
  });
});

app.post('/users', (req, res) => {
  const userData = req.body;
  res.status(201).json({
    message: 'User created successfully',
    user: {
      id: Math.floor(Math.random() * 1000),
      ...userData,
      createdAt: new Date().toISOString(),
    },
  });
});

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Start server
const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`🚀 NextRush server running on http://localhost:${PORT}`);
  console.log('\n📍 Available routes:');
  console.log('   GET  /                - Welcome message');
  console.log('   GET  /users/:id       - Get user by ID');
  console.log('   POST /users           - Create new user');
  console.log('\n🧪 Test with:');
  console.log(`   curl http://localhost:${PORT}/`);
  console.log(`   curl http://localhost:${PORT}/users/123`);
  console.log(
    `   curl -X POST http://localhost:${PORT}/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'`
  );
});

export default app;
