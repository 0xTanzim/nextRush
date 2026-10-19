// Floor: no framework. Deno.serve / Bun.serve / node:http.
import http from 'node:http';
const port = Number(process.env.PORT);
const D = (globalThis as { Deno?: { serve: (o: unknown) => unknown } }).Deno;
const B = (globalThis as { Bun?: { serve: (o: unknown) => unknown } }).Bun;
if (D) D.serve({ port, handler: () => Response.json({ hello: 'world' }) });
else if (B) B.serve({ port, fetch: () => Response.json({ hello: 'world' }) });
else http.createServer((_q, r) => { const s = '{"hello":"world"}'; r.writeHead(200, { 'content-type': 'application/json', 'content-length': s.length }); r.end(s); }).listen(port);
