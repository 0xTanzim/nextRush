// Bundle entry for the Elysia reference arm. Bun-only: Elysia's fastest path
// depends on Bun's server and this arm exists to keep the comparison honest, not
// to claim Elysia runs everywhere.
import { Elysia } from 'elysia';
const app = new Elysia().get('/', () => ({ hello: 'world' }));
console.log(typeof app);
