/**
 * Simple Express-Style NextRush Example
 *
 * This shows how familiar and easy NextRush is to use
 */
const { createApp } = require('nextrush');

const app = createApp();

// Simple middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Simple routes - just like Express!
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from NextRush!',
    tip: 'This works exactly like Express.js',
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

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`🚀 NextRush server running on http://localhost:${PORT}`);
  console.log('\n📍 Try these endpoints:');
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   GET  http://localhost:${PORT}/users/123`);
  console.log(`   POST http://localhost:${PORT}/users`);
  console.log('\n🧪 Test with curl:');
  console.log(`   curl http://localhost:${PORT}/`);
  console.log(`   curl http://localhost:${PORT}/users/123`);
  console.log(
    `   curl -X POST http://localhost:${PORT}/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'`
  );
});

module.exports = app;
