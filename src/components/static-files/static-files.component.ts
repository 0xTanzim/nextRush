/**
 * 📁 Static Files Component - Enterprise Static File Serving
 * SOLID-compliant component for serving static files
 */

import type { MinimalApplication } from '../../core/interfaces';
import { BaseComponent } from '../../core/base-component';
import type { NextRushRequest, NextRushResponse } from '../../types/express';
import { StaticFileServer, type StaticOptions } from '../../utils/static-files';

/**
 * Static Files Component - Serves static files
 */
export class StaticFilesComponent extends BaseComponent {
  readonly name = 'StaticFiles';

  constructor() {
    super('StaticFiles');
  }
  
  private fileServer: StaticFileServer | null = null;

  /**
   * Install static file serving capabilities
   */
  install(app: MinimalApplication): void {
    // Static file serving is installed
  }

  /**
   * Start the static files component
   */
  override async start(): Promise<void> {
    console.log('Static files component started');
  }

  /**
   * Stop the static files component
   */
  override async stop(): Promise<void> {
    console.log('Static files component stopped');
  }

  /**
   * Configure static file serving
   */
  configure(options: StaticOptions): void {
    this.fileServer = new StaticFileServer(options);
  }

  /**
   * Middleware for serving static files
   */
  middleware(options: StaticOptions) {
    const server = new StaticFileServer(options);
    
    return async (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      try {
        const result = await server.serveFile(req.url || '/');
        
        if (!result) {
          next();
          return;
        }

        // Set headers
        res.setHeader('Content-Type', result.contentType);
        
        if (result.etag) {
          res.setHeader('ETag', result.etag);
          
          // Check if client has cached version
          if (req.headers['if-none-match'] === result.etag) {
            res.status(304).end();
            return;
          }
        }

        if (result.lastModified) {
          res.setHeader('Last-Modified', result.lastModified.toUTCString());
        }

        if (options.maxAge && options.maxAge > 0) {
          res.setHeader('Cache-Control', `public, max-age=${options.maxAge}`);
        }

        res.status(200).end(result.content);
      } catch (error) {
        next();
      }
    };
  }

  /**
   * Serve a single file
   */
  async serveFile(requestPath: string, options: StaticOptions): Promise<{
    content: Buffer;
    contentType: string;
    etag?: string;
    lastModified?: Date;
  } | null> {
    if (!this.fileServer) {
      this.fileServer = new StaticFileServer(options);
    }
    
    return this.fileServer.serveFile(requestPath);
  }
}
