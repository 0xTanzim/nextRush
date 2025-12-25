
/**
 * NextRush v2 Server
 * This file sets up a simple NextRush v2 server with basic routes.
 */

import { bodyParser, createApp } from "nextrush";

const app = createApp({
  debug: false,
});

// Body parser middleware for JSON
app.use(
  bodyParser({
    maxSize: 1024 * 1024,
    enableStreaming: false,
  })
);

// 1. Hello World
app.get("/", (c) => {
  return c.json({ message: "Hello World" });
});

// 2. Route Parameters
app.get("/users/:id", (c) => {
  const { id } = c.params;
  return c.json({ id, name: `User ${id}` });
});

// 3. POST JSON
app.post("/users", (c) => {
  const data = c.body;
  return c.json({ success: true, user: data });
});

const port = process.env.PORT || 3001;
app.listen(port);

console.log(`NextRush v2 running on :${port}`);
