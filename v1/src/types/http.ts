/**
 * HTTP-related type definitions
 */
import { IncomingMessage, ServerResponse } from 'http';
import { ParsedUrlQuery } from 'querystring';
import { Dict } from './common';

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'ALL';

export type ContentType =
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'text/plain'
  | 'text/html'
  | 'multipart/form-data'
  | string;

export interface ParsedRequest extends IncomingMessage {
  query: ParsedUrlQuery;
  params: Dict<string>;
  body: unknown;
  pathname: string;
  originalUrl: string;
}

export interface ParsedResponse extends ServerResponse {
  locals: Dict<unknown>;
}

export interface RequestContext {
  request: ParsedRequest;
  response: ParsedResponse;
  params: Dict<string>;
  query: ParsedUrlQuery;
  body: unknown;
  startTime: number;
}

export interface ResponseOptions {
  status?: number;
  headers?: Dict<string>;
  contentType?: ContentType;
}

export interface BodyParserOptions {
  maxSize?: number;
  timeout?: number;
  allowedContentTypes?: ContentType[];
  strict?: boolean;
}

export interface RequestParsingOptions {
  parseBody?: boolean;
  bodyParserOptions?: BodyParserOptions;
  parseQuery?: boolean;
  parseParams?: boolean;
}
