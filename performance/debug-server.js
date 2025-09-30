#!/usr/bin/env node

/**
 * Performance Debug Test
 * Test ctx.body vs ctx.json() vs ctx.res.json()
 */

const { createApp } = require('../../dist/index.js');

const app = createApp({ port: 3001, debug: false });

// Test 1: ctx.json() - Your current approach
app.get('/test1', async ctx => {
  ctx.json({ message: 'test1' });
});

// Test 2: ctx.body assignment (Koa-style) - Does this work?
app.get('/test2', async ctx => {
  ctx.body = { message: 'test2' };
});

// Test 3: ctx.res.json() - Express-style
app.get('/test3', async ctx => {
  ctx.res.json({ message: 'test3' });
});

// Test 4: Direct response.end()
app.get('/test4', async ctx => {
  ctx.res.setHeader('Content-Type', 'application/json');
  ctx.res.end(JSON.stringify({ message: 'test4' }));
});

app.listen(3001, () => {
  console.log('Debug server running on http://localhost:3001');
  console.log('\nTest endpoints:');
  console.log('  curl http://localhost:3001/test1  # ctx.json()');
  console.log('  curl http://localhost:3001/test2  # ctx.body =');
  console.log('  curl http://localhost:3001/test3  # ctx.res.json()');
  console.log('  curl http://localhost:3001/test4  # direct end()');
});
