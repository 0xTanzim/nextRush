/**
 * 🚀 NextRush Benchmark Suite - Core Types
 *
 * Modular, type-safe benchmark system for web frameworks
 */

export interface BenchmarkResult {
  framework: string;
  version: string;
  test: string;
  requestsPerSecond: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
  totalRequests: number;
  duration: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    leaked: number; // bytes
  };
  errorCount: number;
  cpuUsage: {
    before: NodeJS.CpuUsage;
    after: NodeJS.CpuUsage;
    userPercent: number;
    systemPercent: number;
  };
  throughputMBps: number;
  gcPauses: number;
  concurrency?: number;
  routeCount?: number;
  routeComplexity?: string;
  status: 'success' | 'partial' | 'failed';
  notes?: string;
}

export interface FrameworkInfo {
  name: string;
  version: string;
  isAvailable: boolean;
  installCommand?: string;
  dependencies: string[];
  features: string[];
}

export interface TestCase {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  expectedStatus?: number;
  description: string;
  requests: number;
  concurrency?: number;
}

export interface BenchmarkConfig {
  warmupRequests: number;
  defaultTimeout: number;
  maxConcurrency: number;
  memoryProfiling: boolean;
  cpuProfiling: boolean;
  gcMonitoring: boolean;
}

export interface HttpResponse {
  status: number;
  data: any;
  headers?: Record<string, string>;
  size?: number;
}

export interface BenchmarkReport {
  meta: {
    benchmarkVersion: string;
    timestamp: string;
    date: string;
    nodeVersion: string;
    v8Version: string;
    platform: string;
    cpu: string;
    cores: number;
    totalMemoryGB: string;
  };
  results: BenchmarkResult[];
  summary: any;
  comparison: any;
}

/**
 * Abstract base class for framework adapters
 */
export abstract class FrameworkAdapter {
  protected server: any = null;
  protected port: number = 0;
  protected app: any = null;
  protected isRunning: boolean = false;

  abstract readonly frameworkName: string;
  abstract readonly packageName: string;
  abstract readonly dependencies: string[];

  /**
   * Check if the framework is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // For NextRush, check relative path from the benchmark dist directory
      if (this.packageName.startsWith('../../../')) {
        const fs = await import('fs');
        const path = await import('path');
        // From benchmark/dist/adapters/ to parent/dist/
        const fullPath = path.resolve(
          process.cwd(),
          'dist/adapters',
          this.packageName
        );
        return fs.existsSync(fullPath);
      }

      // For other frameworks, check if installed
      await import(this.packageName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get framework version
   */
  async getVersion(): Promise<string> {
    try {
      if (this.packageName.startsWith('../../../')) {
        // For NextRush, read package.json from parent
        const fs = await import('fs');
        const path = await import('path');
        const pkgPath = path.resolve(process.cwd(), '../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return pkg.version;
      }

      // Use require.resolve to find package.json
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const pkgPath = require.resolve(`${this.packageName}/package.json`);
      const fs = await import('fs');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version;
    } catch (error) {
      // Fallback: try to import the package and check common version patterns
      try {
        const pkg = await import(this.packageName);
        return pkg.version || pkg.default?.version || 'unknown';
      } catch {
        return 'unknown';
      }
    }
  }

  /**
   * Get framework info
   */
  async getInfo(): Promise<FrameworkInfo> {
    const isAvailable = await this.isAvailable();
    const version = isAvailable ? await this.getVersion() : 'not-installed';

    return {
      name: this.frameworkName,
      version,
      isAvailable,
      installCommand: this.packageName.startsWith('../../')
        ? 'Built-in (NextRush)'
        : `pnpm add ${this.dependencies.join(' ')}`,
      dependencies: this.dependencies,
      features: this.getSupportedFeatures(),
    };
  }

  /**
   * Create and configure the application
   */
  abstract createApp(): Promise<void>;

  /**
   * Setup routes for testing
   */
  abstract setupRoutes(): Promise<void>;

  /**
   * Start the server
   */
  abstract startServer(port: number): Promise<void>;

  /**
   * Stop the server
   */
  abstract stopServer(): Promise<void>;

  /**
   * Get supported features
   */
  abstract getSupportedFeatures(): string[];

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.isRunning) {
      await this.stopServer();
    }
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}
