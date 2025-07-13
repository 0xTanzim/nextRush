/**
 * NextRush API Comparison Example
 *
 * This example shows both the Express-style API and Context-based API
 * so you can choose which one you prefer.
 */
import { createApp, RequestContext } from '../src';

const app = createApp();

console.log('🔄 NextRush API Comparison\n');

// ===== EXPRESS-STYLE API (Recommended for most users) =====
console.log('✅ Express-Style API - Familiar and Easy:');

// Express-style middleware
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.path}`);
  next();
});

// Express-style routes
app.get('/express/hello', (req, res) => {
  res.json({
    api: 'Express-style',
    message: 'This feels just like Express.js!',
    easy: true,
  });
});

app.get('/express/users/:id', (req, res) => {
  const userId = req.param('id');
  res.json({
    api: 'Express-style',
    userId,
    name: `User ${userId}`,
    familiar: true,
  });
});

// ===== CONTEXT-BASED API (For advanced users) =====
console.log('⚡ Context-Based API - Advanced and Testable:');

// Context-based route
app.get('/context/hello', async (context: RequestContext) => {
  const { response } = context;

  console.log('[Context] GET /context/hello');

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json');
  response.end(
    JSON.stringify({
      api: 'Context-based',
      message: 'More control and better for testing',
      advanced: true,
    })
  );
});

app.get('/context/users/:id', async (context: RequestContext) => {
  const { response, params } = context;

  console.log(`[Context] GET /context/users/${params.id}`);

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json');
  response.end(
    JSON.stringify({
      api: 'Context-based',
      userId: params.id,
      name: `User ${params.id}`,
      testable: true,
    })
  );
});

// Mixed usage - you can use both in the same app!
app.get('/mixed', (req, res) => {
  res.json({
    message: 'You can mix both APIs in the same application!',
    flexibility: 'maximum',
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`\n🚀 NextRush server running on http://localhost:${PORT}`);
  console.log('\n📍 Test both APIs:');
  console.log('\n🎯 Express-style endpoints:');
  console.log(`   curl http://localhost:${PORT}/express/hello`);
  console.log(`   curl http://localhost:${PORT}/express/users/123`);
  console.log('\n⚡ Context-based endpoints:');
  console.log(`   curl http://localhost:${PORT}/context/hello`);
  console.log(`   curl http://localhost:${PORT}/context/users/456`);
  console.log('\n🔄 Mixed endpoint:');
  console.log(`   curl http://localhost:${PORT}/mixed`);

  console.log('\n💡 Recommendation:');
  console.log('   → Use Express-style API for familiarity and speed');
  console.log('   → Use Context-based API for advanced testing and control');
  console.log('   → You can mix both approaches in the same application!');
});

export default app;
