import { LitePress, Router } from './LitePress';

const app = new LitePress();

const userRouter = new Router();
const adminRouter = new Router();
const apiRouter = new Router();

console.log('🔧 Created routers:', {
  userRouter: userRouter.isRouter,
  adminRouter: adminRouter.isRouter,
  apiRouter: apiRouter.isRouter,
});

userRouter.get('/:id', (req, res) => {
  res.json({ message: `Get user ${req.params?.id}` });
});

userRouter.get('/hi/:id', (req, res) => {
  res.json({ message: `Hello user ${req.params?.id}!` });
});

adminRouter.post('/user', (req, res) => {
  res.json({ received: req.body }, 201);
});

apiRouter.get('/text', (req, res) => {
  res.send('Hello world as text!', 200, 'text/plain');
});

apiRouter.get('/file', async (req, res) => {
  await res.serveHtmlFile('./index.html', 200);
});

// Mount the routers on the main app
console.log('\n🔗 Mounting routers...');
app.use('/users', userRouter); // Mount userRouter at /users
app.use('/admin', adminRouter); // Mount adminRouter at /admin
app.use('/api', apiRouter); // Mount apiRouter at /api
console.log('✅ All routers mounted');

// Add some main app routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to LitePress with Router Support!',
    routes: [
      'GET /',
      'GET /users/:id',
      'POST /admin/user',
      'GET /api/text',
      'GET /api/file',
    ],
  });
});

app.listen(3000, () => {
  console.log(`🚀 Server started at ${new Date().toISOString()}`);
  console.log('Server is running on http://localhost:3000');

  // Print all registered routes for debugging
  console.log('\n🔍 DEBUG: All registered routes:');
  app.printRoutes();

  console.log('\n📍 Available routes:');
  console.log('   GET  /              - Welcome message');
  console.log('   GET  /users/:id     - Get user by ID');
  console.log('   POST /admin/user    - Create user (admin)');
  console.log('   GET  /api/text      - Get text response');
  console.log('   GET  /api/file      - Serve HTML file');
  console.log('\n🧪 Test with:');
  console.log('   curl http://localhost:3000/users/123');
  console.log(
    '   curl -X POST http://localhost:3000/admin/user -H "Content-Type: application/json" -d \'{"name":"John"}\''
  );
});
