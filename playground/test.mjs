import { createApp } from '../dist/index.mjs';

const app = createApp({});

// Simulated database lookup
async function findUser(id) {
  const users = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ];
  return users.find(user => user.id === id);
}

// Route with validation, schema, and <options></options>


app.get('/users/:id', {
  handler: async ctx => {
    const user = await findUser(ctx.params.id);
    ctx.json(user || { error: 'Not found' }, user ? 200 : 404);
  },
  schema: {
    params: {
      type: 'object',
      properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
    },
    response: {
      200: { type: 'object', properties: { id: { type: 'string' } } },
      404: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
  options: {
    name: 'getUser',
    description: 'Retrieve user by ID',
    tags: ['users'],
  },
});

app.listen(3004, () => {
  console.log('Server is running on http://localhost:3004');
});
