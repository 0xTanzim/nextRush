import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'node:http';
import { ParsedUrlQuery } from 'querystring';
import { parse } from 'url';

type Handler = (req: Request, res: Response) => void;

interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
  path: string | RegExp;
  handler: Handler;
}

interface Request extends IncomingMessage {
  query?: ParsedUrlQuery;
  pathname?: string;
  body?: Record<string, any>;
}

type Response = ServerResponse;

export class MyExpress {
  private routes: Route[] = [];

  public get(path: string, handler: Handler): void {
    this.routes.push({ method: 'GET', path, handler });
  }

  public post(path: string, handler: Handler) {
    this.routes.push({ method: 'POST', path, handler });
  }

  public put(path: string, handler: Handler) {
    this.routes.push({ method: 'PUT', path, handler });
  }

  public delete(path: string, handler: Handler) {
    this.routes.push({ method: 'DELETE', path, handler });
  }

  public patch(path: string, handler: Handler) {
    this.routes.push({ method: 'PATCH', path, handler });
  }

  public options(path: string, handler: Handler) {
    this.routes.push({ method: 'OPTIONS', path, handler });
  }

  public listen(port: number, callback?: () => void) {
    const server = http.createServer((req: Request, res: Response) => {
      const parsed = parse(req.url || '', true);
      req.query = parsed.query || {};
      req.pathname = parsed.pathname || '';

      const matchedRoute = this.routes.find(
        (route) =>
          route.method === req.method &&
          (typeof route.path === 'string'
            ? route.path === req.pathname
            : route.path.test(req.pathname || ''))
      );

      if (!matchedRoute) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }

      if (req.method === 'POST') {
        let body = '';

        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          req.body = this.parseBody(req, body);
          matchedRoute.handler(req, res);
        });
      } else {
        matchedRoute.handler(req, res);
      }
    });

    server.listen(port, callback);
  }

  private parseBody(req: IncomingMessage, body: string | Buffer): any {
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(body.toString());
      } catch (err) {
        return { error: 'Invalid JSON' };
      }
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const result: Record<string, string> = {};
      body
        .toString()
        .split('&')
        .forEach((pair) => {
          const [key, value] = pair.split('=');
          result[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });
      return result;
    }

    if (contentType.includes('text/plain')) {
      return body.toString();
    }

    if (contentType.includes('multipart/form-data')) {
      return { error: 'multipart/form-data not supported yet' };
    }

    if (contentType.includes('application/octet-stream')) {
      return body;
    }

    return body.toString();
  }
}
