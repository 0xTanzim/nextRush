/**
 * Bounded concurrency pool for parallel task execution
 *
 * Limits the number of concurrent operations to prevent resource exhaustion.
 */

/**
 * Pool configuration
 */
export interface PoolOptions {
  /** Maximum concurrent tasks (default: CPU count) */
  concurrency?: number;
}

/**
 * Execute tasks with bounded concurrency
 * @param tasks Array of task functions
 * @param options Configuration
 * @returns Array of results matching task order
 */
export async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  options: PoolOptions = {}
): Promise<T[]> {
  const concurrency = options.concurrency ?? getDefaultConcurrency();
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  let activeCount = 0;
  let error: Error | null = null;

  return new Promise<T[]>((resolve, reject) => {
    function processNext(): void {
      // If error occurred, stop processing
      if (error) {
        if (activeCount === 0) reject(error);
        return;
      }

      if (nextIndex >= tasks.length && activeCount === 0) {
        resolve(results);
        return;
      }

      while (activeCount < concurrency && nextIndex < tasks.length && !error) {
        const taskIndex = nextIndex++;
        activeCount++;

        tasks[taskIndex]?.()
          ?.then((result) => {
            results[taskIndex] = result;
            activeCount--;
            processNext();
          })
          .catch((err) => {
            error = err;
            activeCount--;
            processNext();
          });
      }
    }

    processNext();
  });
}

/**
 * Get default concurrency based on CPU count
 */
function getDefaultConcurrency(): number {
  // Default to 4, or CPU count capped at 8
  try {
    const os = require('node:os');
    const cpuCount = os.cpus?.()?.length ?? 4;
    return Math.min(cpuCount, 8);
  } catch {
    return 4;
  }
}
