/**
 * NextRush v3 Server
 * This file sets up a simple NextRush v3 server with basic routes.
 */


import { json } from '@nextrush/body-parser';
import { createApp, createRouter, listen } from "nextrushx";

const app = createApp();
const router = createRouter();

app.use(json({
  limit: 1024 * 1024,
  enableStreaming: false,
}));

// 1. Hello World
router.get("/", (c) => {
  return c.json({ message: "Hello World" });
});

// 2. Route Parameters
router.get("/users/:id", (c) => {
  const { id } = c.params;
  return c.json({ id, name: `User ${id}` });
});

// 3. POST JSON
router.post("/users", (c) => {
  const data = c.body;
  return c.json({ success: true, user: data });
});

app.use(router.routes());

const port = process.env.PORT || 3002;
listen(app, port);

console.log(`NextRush v3 running on :${port}`);
