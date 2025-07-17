/**
 * 🚀 NextRush Application - Clean Component Architecture [ARCHIVED]
 * ⚠️  DEPRECATED: This file is kept for reference but not actively used
 * ✅ Main implementation is in ./app/application.ts
 */

import { IncomingMessage, Server, ServerResponse } from 'http';
import { BaseComponent } from './base-component';

/**
 * Application options
 */
export interface ApplicationOptions {
  enableRouter?: boolean;
  enableWebSocket?: boolean;
  enableStaticFiles?: boolean;
  enableTemplate?: boolean;
  port?: number;
  host?: string;
}

/**
 * Component Manager for the clean application
 */
class SimpleComponentManager {
  private components = new Map<string, BaseComponent>();
  private installOrder: string[] = [];

  register(component: BaseComponent): void {
    if (this.components.has(component.name)) {
      throw new Error(`Component '${component.name}' is already registered`);
    }
    this.components.set(component.name, component);
  }

  async installAll(app: NextRushApp): Promise<void> {
    for (const [name, component] of this.components) {
      component.install(app as any);
      this.installOrder.push(name);
    }
  }

  async startAll(): Promise<void> {
    for (const name of this.installOrder) {
      const component = this.components.get(name);
      if (component) {
        await component.start();
      }
    }
  }

  async stopAll(): Promise<void> {
    const reverseOrder = [...this.installOrder].reverse();
    for (const name of reverseOrder) {
      const component = this.components.get(name);
      if (component) {
        await component.stop();
      }
    }
  }

  get<T extends BaseComponent>(name: string): T | undefined {
    return this.components.get(name) as T;
  }
}

/**
 * NextRush Application - Clean Architecture
 */
export class NextRushApp {
  private componentManager = new SimpleComponentManager();
  private server?: Server;
  private appOptions: ApplicationOptions;

  constructor(options: ApplicationOptions = {}) {
    this.appOptions = {
      enableRouter: true,
      enableWebSocket: false,
      enableStaticFiles: false,
      enableTemplate: false,
      port: 3000,
      host: 'localhost',
      ...options,
    };
  }

  /**
   * Add component to application
   */
  use(component: BaseComponent): NextRushApp {
    this.componentManager.register(component);
    return this;
  }

  /**
   * Get component by name
   */
  getComponent<T extends BaseComponent>(name: string): T | undefined {
    return this.componentManager.get<T>(name);
  }

  /**
   * Listen on port and start server
   */
  async listen(
    port?: number,
    host?: string,
    callback?: () => void
  ): Promise<Server> {
    const listenPort = port || this.appOptions.port || 3000;
    const listenHost = host || this.appOptions.host || 'localhost';

    // Install all components
    await this.componentManager.installAll(this);

    // Create HTTP server
    this.server = new Server((req, res) => {
      this.handleRequest(req, res);
    });

    // Initialize WebSocket if enabled
    if ((this as any).initWebSocket) {
      (this as any).initWebSocket(this.server);
    }

    // Start all components
    await this.componentManager.startAll();

    return new Promise((resolve, reject) => {
      this.server!.listen(listenPort, listenHost, () => {
        console.log(
          `🚀 NextRush server running on http://${listenHost}:${listenPort}`
        );
        this.logComponentStatus();
        if (callback) callback();
        resolve(this.server!);
      });

      this.server!.on('error', reject);
    });
  }

  /**
   * Handle HTTP request
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if ((this as any).handle) {
      (this as any).handle(req, res);
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found - No router installed');
    }
  }

  /**
   * Stop server and components
   */
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    await this.componentManager.stopAll();
    console.log('🛑 NextRush server stopped');
  }

  /**
   * Get server instance
   */
  getServer(): Server | undefined {
    return this.server;
  }

  /**
   * Log component status
   */
  private logComponentStatus(): void {
    console.log('📦 Components loaded:');
    // Components will log their own status via their start() methods
  }

  // The following methods will be dynamically installed by components:

  // RouterComponent will install these:
  get?: (...args: any[]) => NextRushApp;
  post?: (...args: any[]) => NextRushApp;
  put?: (...args: any[]) => NextRushApp;
  delete?: (...args: any[]) => NextRushApp;
  patch?: (...args: any[]) => NextRushApp;
  head?: (...args: any[]) => NextRushApp;
  options?: (...args: any[]) => NextRushApp;
  all?: (...args: any[]) => NextRushApp;
  handle?: (req: IncomingMessage, res: ServerResponse) => void;

  // WebSocketComponent will install these:
  ws?: (...args: any[]) => NextRushApp;
  initWebSocket?: (server: Server) => void;

  // StaticFilesComponent will install these:
  static?: (...args: any[]) => NextRushApp;

  // TemplateComponent will install these:
  set?: (...args: any[]) => NextRushApp;
  engine?: (...args: any[]) => NextRushApp;
}

/**
 * Create a new NextRush application
 */
export function createApp(options?: ApplicationOptions): NextRushApp {
  return new NextRushApp(options);
}
