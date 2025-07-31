const { createApp } = require('./src/index');

const app = createApp();

// Only register body parser middleware
app.use(app.json());

app.post('/test', ctx => {
  console.log('Route handler called');
  console.log('ctx.body:', ctx.body);
  console.log('ctx.req.body:', ctx.req.body);

  ctx.res.json({
    received: ctx.body,
    success: true,
  });
});

app.listen(3002, () => {
  console.log('Minimal test server running on http://localhost:3002');
});
