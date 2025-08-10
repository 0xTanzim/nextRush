/**
 * Server Manager for NextRush v2
 * Handles HTTP server lifecycle and management
 *
 * @packageDocumentation
 */

import type { ApplicationOptions } from '@/types/http';
import { EventEmitter } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

/**
 * Server Manager responsible for HTTP server lifecycle
 * Following Single Responsibility Principle
 */
export class ServerManager extends EventEmitter {
  private server: Server | null = null;
  private options: Required<ApplicationOptions>;
  private isShuttingDown = false;

  constructor(
    options: Required<ApplicationOptions>,
    private requestHandler: (req: IncomingMessage, res: ServerResponse) => void
  ) {
    super();
    this.options = options;
  }

  /**
   * Create and configure the HTTP server
   */
  public createServer(): Server {
    if (this.server) {
      return this.server;
    }

    this.server = createServer(this.requestHandler);
    this.setupEventHandlers();
    return this.server;
  }

  /**
   * Start the server
   */
  public async listen(
    port?: number,
    hostname?: string,
    callback?: () => void
  ): Promise<void> {
    const server = this.createServer();

    const actualPort = port ?? this.options.port;
    const actualHostname = hostname ?? this.options.host;

    return new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.removeListener('listening', onListening);
        reject(error);
      };

      const onListening = () => {
        server.removeListener('error', onError);
        this.emit('listening', actualPort, actualHostname);
        if (callback) callback();
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);

      server.listen(actualPort, actualHostname);
    });
  }

  /**
   * Stop the server gracefully
   */
  public async close(): Promise<void> {
    if (!this.server || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.emit('closing');

    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(error => {
        if (error) {
          reject(error);
        } else {
          this.emit('closed');
          resolve();
        }
      });
    });
  }

  /**
   * Get server information
   */
  public getServerInfo(): {
    listening: boolean;
    address: string | null;
    port: number | null;
    shuttingDown: boolean;
  } {
    const address = this.server?.address();
    const addressString = typeof address === 'string' ? address : null;
    const port = typeof address === 'object' && address ? address.port : null;

    return {
      listening: this.server?.listening ?? false,
      address: addressString,
      port,
      shuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Setup server event handlers
   */
  private setupEventHandlers(): void {
    if (!this.server) {
      return;
    }

    this.server.on('error', error => {
      this.emit('error', error);
    });

    this.server.on('request', (req, res) => {
      this.emit('request', req, res);
    });

    this.server.on('close', () => {
      this.emit('close');
    });

    this.server.on('connection', socket => {
      this.emit('connection', socket);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      this.handleShutdown('SIGTERM').catch(() => {
        // Error already handled in handleShutdown
      });
    });
    process.on('SIGINT', () => {
      this.handleShutdown('SIGINT').catch(() => {
        // Error already handled in handleShutdown
      });
    });
  }

  /**
   * Handle shutdown signals
   */
  private async handleShutdown(signal: string): Promise<void> {
    this.emit('shutdown', signal);
    try {
      await this.close();
      this.emit('shutdownComplete');
      process.exit(0);
    } catch (error) {
      this.emit('shutdownError', error);
      process.exit(1);
    }
  }
}
