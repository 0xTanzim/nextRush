import { IncomingMessage } from 'node:http';
import { ParsedUrlQuery } from 'querystring';

export interface Request extends IncomingMessage {
  query: ParsedUrlQuery;
  pathname: string;
  body?: unknown;
  params?: Record<string, string>;
}
