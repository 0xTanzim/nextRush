import Fastify from 'fastify';
const app = Fastify();
app.get('/', async () => ({ hello: 'world' }));
console.log(typeof app.ready);
