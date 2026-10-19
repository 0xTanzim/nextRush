// Floor: no framework. Bun.serve on Bun, node:http on Node.
import http from 'node:http';
const port = Number(process.env.PORT);
const B = (globalThis as { Bun?: { serve: (o: unknown) => unknown } }).Bun;
if (B) B.serve({ port, fetch: () => Response.json({ hello: 'world' }) });
else http.createServer((_q, r) => { const s = '{"hello":"world"}'; r.writeHead(200, { 'content-type': 'application/json', 'content-length': s.length }); r.end(s); }).listen(port);
