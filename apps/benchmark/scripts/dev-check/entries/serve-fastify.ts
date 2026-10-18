import Fastify from 'fastify';
const app = Fastify();
app.get('/', async () => ({ hello: 'world' }));
await app.listen({ port: Number(process.env.PORT), host: '127.0.0.1' });
