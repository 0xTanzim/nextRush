import { NextRushError } from '../../../errors/custom-errors';

/**
 * 🚨 HTTP Error for body parsing errors
 */
export class HttpError extends NextRushError {
  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_SERVER_ERROR'
  ) {
    super(message, statusCode, code);
    this.name = 'HttpError';
  }
}
