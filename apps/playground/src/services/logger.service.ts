import { Service } from '@nextrush/di';

/**
 * LoggerService — intentionally NOT registered in the DI container
 * to test @Optional() injection behavior.
 *
 * When used with @Optional(), the controller should receive `undefined`
 * and gracefully handle it. This validates the P0 @Optional fix.
 */
export interface ILogger {
  log(message: string): void;
}

/**
 * A concrete logger that IS registered — used to test
 * @Optional with a registered dependency (should resolve normally).
 */
@Service()
export class ConsoleLogger implements ILogger {
  log(message: string): void {
    console.log(`[ConsoleLogger] ${message}`);
  }
}

/**
 * A logger that is NOT registered — used to test @Optional
 * with a missing dependency (should resolve as undefined).
 */
export class UnregisteredLogger implements ILogger {
  log(message: string): void {
    console.log(`[UnregisteredLogger] ${message}`);
  }
}
