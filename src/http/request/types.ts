import { IncomingMessage } from 'node:http';
import { HttpMethod } from '../../types/http';

export interface RequestParams {
  [key: string]: string;
}

export interface RequestQuery {
  [key: string]: string | string[] | undefined;
}

export interface ParsedRequest extends IncomingMessage {
  method: HttpMethod;
  pathname: string;
  query: RequestQuery;
  params?: RequestParams;
  body?: unknown;
}

export interface BodyParserConfig {
  maxSize?: number;
  timeout?: number;
  allowedContentTypes?: string[];
  strict?: boolean;
}

export interface RequestHandlerConfig {
  bodyParser?: BodyParserConfig;
  timeout?: number;
}
