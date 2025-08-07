/**
 * Port Manager for Test Isolation
 * Ensures unique ports across parallel test execution
 */

class PortManager {
  private static instance: PortManager;
  private usedPorts = new Set<number>();
  private basePort = 3000;
  private maxPort = 9999;

  private constructor() {}

  public static getInstance(): PortManager {
    if (!PortManager.instance) {
      PortManager.instance = new PortManager();
    }
    return PortManager.instance;
  }

  /**
   * Get next available port
   */
  public getPort(): number {
    let port = this.basePort;
    while (this.usedPorts.has(port) && port <= this.maxPort) {
      port++;
    }

    if (port > this.maxPort) {
      throw new Error('No available ports in range');
    }

    this.usedPorts.add(port);
    return port;
  }

  /**
   * Release a port for reuse
   */
  public releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  /**
   * Get multiple unique ports
   */
  public getPorts(count: number): number[] {
    const ports: number[] = [];
    for (let i = 0; i < count; i++) {
      ports.push(this.getPort());
    }
    return ports;
  }

  /**
   * Reset all ports (useful for test cleanup)
   */
  public reset(): void {
    this.usedPorts.clear();
    this.basePort = 3000;
  }
}

export const portManager = PortManager.getInstance();

/**
 * Helper for test suites to get unique ports
 */
export function getTestPort(): number {
  return portManager.getPort();
}

/**
 * Helper for test suites to get multiple unique ports
 */
export function getTestPorts(count: number): number[] {
  return portManager.getPorts(count);
}

/**
 * Helper to release port after test
 */
export function releaseTestPort(port: number): void {
  portManager.releasePort(port);
}

/**
 * Auto-cleanup wrapper for test functions
 */
export function withUniquePort<T>(
  fn: (port: number) => Promise<T>
): Promise<T> {
  const port = getTestPort();
  return fn(port).finally(() => {
    releaseTestPort(port);
  });
}

/**
 * Auto-cleanup wrapper for multiple ports
 */
export function withUniquePorts<T>(
  count: number,
  fn: (ports: number[]) => Promise<T>
): Promise<T> {
  const ports = getTestPorts(count);
  return fn(ports).finally(() => {
    ports.forEach(port => releaseTestPort(port));
  });
}
