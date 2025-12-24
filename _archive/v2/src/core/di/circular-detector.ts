/**
 * Circular Dependency Detection for NextRush v2 DI System
 *
 * Provides detection and prevention of circular dependencies
 * during service resolution.
 *
 * @packageDocumentation
 */

/**
 * Circular dependency detector
 *
 * Tracks the resolution stack to detect cycles during dependency resolution.
 * Uses a simple array-based approach for lightweight detection.
 *
 * @example
 * ```typescript
 * const detector = new CircularDependencyDetector();
 *
 * detector.enterResolution('ServiceA');
 * detector.enterResolution('ServiceB');
 * detector.enterResolution('ServiceA'); // Throws: Circular dependency detected
 * ```
 */
export class CircularDependencyDetector {
  private resolutionStack: (string | symbol)[] = [];

  /**
   * Enter a new resolution context
   *
   * @param token - Service token being resolved
   * @throws Error if circular dependency is detected
   */
  enterResolution(token: string | symbol): void {
    if (this.resolutionStack.includes(token)) {
      const cycle = [...this.resolutionStack, token]
        .map(t => String(t))
        .join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
    this.resolutionStack.push(token);
  }

  /**
   * Exit the current resolution context
   */
  exitResolution(): void {
    this.resolutionStack.pop();
  }

  /**
   * Reset the resolution stack
   */
  reset(): void {
    this.resolutionStack.length = 0;
  }

  /**
   * Get current resolution depth
   */
  getDepth(): number {
    return this.resolutionStack.length;
  }

  /**
   * Check if currently in a resolution context
   */
  isResolving(): boolean {
    return this.resolutionStack.length > 0;
  }

  /**
   * Get the current resolution path for debugging
   */
  getResolutionPath(): string {
    return this.resolutionStack.map(t => String(t)).join(' -> ');
  }
}
