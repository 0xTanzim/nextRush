/*eslint no-undef: "error"*/
import {
  createApp,
  createRouter,
  LoggerPlugin,
  StaticFilesPlugin,
  WebSocketPlugin,
} from '../dist/index.mjs';

const app = createApp({});
const userRouter = createRouter();

const ws = new WebSocketPlugin({
  path: '/ws',
  heartbeatMs: 30000,
  maxConnections: 1000,
});
ws.install(app);


app.ws('/echo', socket => {
  socket.send('Welcome! 👋');

  socket.onMessage(data => {
    socket.send(`Echo: ${data}`);
  });
});

app.wsBroadcast('/broadcast', socket => {
  socket.send('Welcome to the broadcast channel! 📢');

  socket.onMessage(data => {
    app.wsBroadcast('/broadcast', socket => {
      socket.send(`Broadcast: ${data}`);
    });
  });
});

const logger = new LoggerPlugin({
  level: 'info',
  format: 'json',
  transports: ['console', 'file'],
});
logger.install(app);

const staticFiles = new StaticFilesPlugin({
  root: './public',
  maxAge: 3600,
  gzip: true,
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

app.use('user', userRouter);

const requireAuth = async (ctx, next) => {
  const token = ctx.headers.authorization;
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
