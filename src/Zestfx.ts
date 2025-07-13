import { readFile } from 'fs/promises';
import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'path';
import { ParsedUrlQuery } from 'querystring';
import { parse as parseUrl } from 'url';

const contentTypes = {
  html: 'text/html',
  json: 'application/json',
  js: 'application/javascript',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  file: 'application/octet-stream',
} as const;

type ContentType = (typeof contentTypes)[keyof typeof contentTypes];

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
type Path = string | RegExp;

interface Request extends IncomingMessage {
  query: ParsedUrlQuery;
  pathname: string;
  body?: unknown;
  params?: Record<string, string>;
}

// Branded type to indicate response is finished
type FinishedResponse = Response & { __finished: true };

interface Response extends ServerResponse {
  json: (data: unknown, status?: number) => FinishedResponse;
  send: (
    data: string,
    status?: number,
    contentType?: ContentType
  ) => FinishedResponse;
  status: (code: number) => Response;
  serveHtmlFile: (
    relativePath: string,
    status?: number
  ) => Promise<FinishedResponse>;
}

type Handler = (req: Request, res: Response) => void | Promise<void>;

interface Route {
  method: Method;
  path: Path;
  handler: Handler;
}

export class Zestfx {
  private routes: Route[] = [];
  private readonly methodsWithBody: Method[] = [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ];

  // Route Registration
  private register(method: Method, path: Path, handler: Handler) {
    this.routes.push({ method, path, handler });
  }

  public get(path: Path, handler: Handler) {
    this.register('GET', path, handler);
  }
  public post(path: Path, handler: Handler) {
    this.register('POST', path, handler);
  }
  public put(path: Path, handler: Handler) {
    this.register('PUT', path, handler);
  }
  public delete(path: Path, handler: Handler) {
    this.register('DELETE', path, handler);
  }
  public patch(path: Path, handler: Handler) {
    this.register('PATCH', path, handler);
  }
  public options(path: Path, handler: Handler) {
    this.register('OPTIONS', path, handler);
  }

  // Content-Type Detection (encapsulated)
  private getContentType(filePath: string): ContentType {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
        return 'text/html';
      case 'js':
        return 'application/javascript';
      case 'json':
        return 'application/json';
      case 'png':
        return 'image/png';
      case 'svg':
        return 'image/svg+xml';
      case 'txt':
        return 'text/plain';
      case 'file':
        return 'application/octet-stream';
      default:
        return 'application/octet-stream';
    }
  }

  // Body Parser
  private async parseBody(req: Request): Promise<unknown> {
    const contentType = req.headers['content-type'] || 'application/json';
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks);
        const bodyStr = raw.toString();
        try {
          if (contentType.includes('application/json')) {
            resolve(bodyStr ? JSON.parse(bodyStr) : {});
          } else if (
            contentType.includes('application/x-www-form-urlencoded')
          ) {
            const result: Record<string, string> = {};
            bodyStr.split('&').forEach((pair) => {
              const [key, value] = pair.split('=');
              result[decodeURIComponent(key)] = decodeURIComponent(value || '');
            });
            resolve(result);
          } else if (contentType.includes('text/plain')) {
            resolve(bodyStr);
          } else if (contentType.includes('application/octet-stream')) {
            resolve(raw);
          } else {
            resolve(bodyStr); // fallback
          }
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  // Route Matcher
  private matchRoute(req: Request): Route | undefined {
    return this.routes.find((route) => {
      if (route.method !== req.method) return false;
      if (typeof route.path === 'string') return route.path === req.pathname;
      const match = req.pathname.match(route.path);
      if (match?.groups) req.params = match.groups;
      return !!match;
    });
  }

  // Helper method for serving files
  private async _serveHtmlFile(
    res: Response,
    relativePath: string,
    status = 200
  ): Promise<void> {
    try {
      const fullPath = path.join(__dirname, relativePath);
      const html = await readFile(fullPath, 'utf-8');
      const contentType = this.getContentType(fullPath);
      res.send(html, status, contentType);
    } catch (err: any) {
      res
        .status(500)
        .json({ error: 'Failed to serve file', message: err.message });
    }
  }

  // Start Server
  public listen(port: number, callback?: () => void) {
    const server = http.createServer(async (req, res) => {
      // Cast to our extended types
      const request = req as Request;
      const response = res as Response;

      // --- Attach Response Helpers ---
      response.status = function (code: number): Response {
        this.statusCode = code;
        return this;
      };

      response.json = function (
        data: unknown,
        status: number = 200
      ): FinishedResponse {
        this.status(status);
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(data));
        return this as FinishedResponse;
      };

      response.send = function (
        data: string,
        status: number = 200,
        contentType: ContentType = 'application/json'
      ): FinishedResponse {
        this.status(status);
        this.setHeader('Content-Type', contentType);
        this.end(data);
        return this as FinishedResponse;
      };

      // Add serveHtmlFile method to response
      response.serveHtmlFile = async (
        relativePath: string,
        status = 200
      ): Promise<FinishedResponse> => {
        await this._serveHtmlFile(response, relativePath, status);
        return response as FinishedResponse;
      };

      // --- Parse URL ---
      const parsed = parseUrl(request.url || '', true);
      request.query = parsed.query;
      request.pathname = parsed.pathname || '';

      try {
        // --- Parse Body if Needed ---
        if (this.methodsWithBody.includes(request.method as Method)) {
          request.body = await this.parseBody(request);
        }

        const route = this.matchRoute(request);
        if (!route) {
          response.status(404).json({ error: 'Route not found' });
          return;
        }

        // --- Execute Route Handler ---
        await route.handler(request, response);
      } catch (err: any) {
        response
          .status(500)
          .json({ error: 'Internal Server Error', message: err.message });
      }
    });

    server.listen(port, callback);
  }
}
