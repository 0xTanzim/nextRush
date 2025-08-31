import type { Context, Next, WSConnection } from '../dist/index.mjs';
import {
  createApp,
  createRouter,
  LoggerPlugin,
  LogLevel,
  StaticFilesPlugin,
  WebSocketPlugin,
  withWebSocket,
} from '../dist/index.mjs';

const app = createApp({});
const userRouter = createRouter();

const ws = new WebSocketPlugin({
  path: '/ws',
  heartbeatMs: 30000,
  maxConnections: 1000,
});
ws.install(app);

// Get typed WebSocket app with perfect type intelligence
const wsApp = withWebSocket(app);

wsApp.ws('/echo', (socket: WSConnection) => {
  socket.send('Welcome! 👋');

  socket.onMessage((data: string | Buffer) => {
    socket.send(`Echo: ${data}`);
  });
});

// Create a broadcast WS route; join a room and broadcast incoming messages to that room
wsApp.ws('/broadcast', (socket: WSConnection) => {
  socket.send('Welcome to the broadcast channel! 📢');
  socket.join('broadcast');

  socket.onMessage((data: string | Buffer) => {
    // Broadcast the raw message to everyone in the 'broadcast' room
    wsApp.wsBroadcast(String(data), 'broadcast');
  });
});

const logger = new LoggerPlugin({
  level: LogLevel.INFO,
  format: 'json',
  transports: [
    { type: 'console', options: {} },
    { type: 'file', options: { filename: 'app.log' } },
  ],
});
logger.install(app);

const staticFiles = new StaticFilesPlugin({
  root: './public',
  maxAge: 3600,
});
staticFiles.install(app);

app.use((ctx, next) => {
  console.log(`Request received: ${ctx.method} ${ctx.path}`);
  return next();
});

app.get('/', ctx => {
  ctx.json({ message: 'Hello, world!' });
});

async function getUsers() {
  // Simulate a database call
  return [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
  ];
}

const UserSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
  },
  required: ['id'],
};

app.get('/users', {
  handler: async ctx => ctx.json(await getUsers()),
  schema: { response: { 200: UserSchema } },
  options: { tags: ['users'] },
});
userRouter.get('/profile', async ctx => ctx.json({ user: 'profile' }));

app.use('/user', userRouter);

const requireAuth = async (ctx: Context, next: Next) => {
  const token = ctx.headers.authorization as string | undefined;
  ctx.state.user = { id: 1, name: 'John Doe' };
  await next();
};

app.use(requireAuth);

app.get('/page', async ctx => {
  ctx.res.html('<h1>Welcome</h1>'); // HTML response
});

app.get('/download', async ctx => {
  ctx.res.file('./document.pdf'); // File download
});

app.get('/redirect', async ctx => {
  ctx.redirect('/new-url', 301); // Redirect
});

app.get('/csv', async ctx => {
  ctx.res.csv('name,email\nJohn,john@example.com'); // CSV response
});

app.listen(3004, () => {
  console.log('Server is running on http://localhost:3004');
});
