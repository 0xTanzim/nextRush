/**
 * 🛠️ HTTP Client Utilities
 *
 * Zero-dependency HTTP client for benchmarking
 */

import * as http from 'http';
import * as https from 'https';
import { HttpResponse } from '../core/types.js';

export interface RequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Make HTTP request using Node.js built-in modules
 */
export async function makeRequest(
  options: RequestOptions
): Promise<HttpResponse> {
  const { url, method, body, headers = {}, timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const requestHeaders: Record<string, string> = {
      'User-Agent': 'NextRush-Benchmark/3.0',
      ...headers,
    };

    // Handle request body
    if (body && method !== 'GET') {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      requestHeaders['Content-Length'] = Buffer.byteLength(bodyStr).toString();
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: requestHeaders,
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      let size = 0;

      res.on('data', (chunk) => {
        data += chunk;
        size += chunk.length;
      });

      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode || 0,
            data: parsedData,
            headers: res.headers as Record<string, string>,
            size,
          });
        } catch {
          resolve({
            status: res.statusCode || 0,
            data: data,
            size,
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Write body if present
    if (body && method !== 'GET') {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(bodyStr);
    }

    req.end();
  });
}

/**
 * Find an available port
 */
export async function findAvailablePort(
  startPort: number = 3000
): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer();

    server.listen(startPort, () => {
      const port = (server.address() as any)?.port;
      server.close(() => resolve(port));
    });

    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

/**
 * Wait for a port to be available
 */
export async function waitForPort(
  port: number,
  timeout: number = 10000
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      await makeRequest({
        url: `http://localhost:${port}/health`,
        method: 'GET',
      });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return false;
}
